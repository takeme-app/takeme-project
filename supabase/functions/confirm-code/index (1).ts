import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-auth-token, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader =
      req.headers.get("Authorization") ?? req.headers.get("x-auth-token");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : (authHeader ?? "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Body ---
    const body = (await req.json().catch(() => ({}))) as {
      entity_type?: string; // "shipment" | "dependent_shipment" | "booking"
      entity_id?: string;
      step?: string; // "pickup" | "delivery"
      code?: string;
    };

    const { entity_type, entity_id, step, code } = body;

    if (!entity_type || !entity_id || !step || !code) {
      return new Response(
        JSON.stringify({
          error: "Campos obrigatórios: entity_type, entity_id, step, code",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (step !== "pickup" && step !== "delivery") {
      return new Response(
        JSON.stringify({ error: "step deve ser 'pickup' ou 'delivery'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const codeTrim = String(code).replace(/\D/g, "").slice(0, 4);
    if (codeTrim.length !== 4) {
      return new Response(
        JSON.stringify({ error: "Código deve ter 4 dígitos" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determinar tabela
    let table: string;
    switch (entity_type) {
      case "shipment":
        table = "shipments";
        break;
      case "dependent_shipment":
        table = "dependent_shipments";
        break;
      case "booking":
        table = "bookings";
        break;
      default:
        return new Response(
          JSON.stringify({
            error:
              "entity_type deve ser 'shipment', 'dependent_shipment' ou 'booking'",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Para bookings, usar scheduled_trips (pickup_code / delivery_code)
    if (entity_type === "booking") {
      // Buscar o booking e a scheduled_trip vinculada
      const { data: booking, error: bookingErr } = await admin
        .from("bookings")
        .select("id, scheduled_trip_id, status")
        .eq("id", entity_id)
        .single();

      if (bookingErr || !booking) {
        return new Response(
          JSON.stringify({ error: "Reserva não encontrada" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: trip, error: tripErr } = await admin
        .from("scheduled_trips")
        .select("pickup_code, delivery_code, driver_id")
        .eq("id", booking.scheduled_trip_id)
        .single();

      if (tripErr || !trip) {
        return new Response(
          JSON.stringify({ error: "Viagem não encontrada" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verificar se é o motorista
      if (trip.driver_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Apenas o motorista pode confirmar" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const expectedCode =
        step === "pickup" ? trip.pickup_code : trip.delivery_code;
      if (!expectedCode || codeTrim !== expectedCode.replace(/\D/g, "")) {
        return new Response(
          JSON.stringify({ error: "Código incorreto" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Atualizar status do booking
      const newStatus = step === "pickup" ? "confirmed" : "paid";
      await admin
        .from("bookings")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entity_id);

      // Notificar passageiro
      const { data: bookingFull } = await admin
        .from("bookings")
        .select("user_id")
        .eq("id", entity_id)
        .maybeSingle();
      if (bookingFull?.user_id) {
        const msg =
          step === "pickup"
            ? "Sua coleta foi confirmada pelo motorista."
            : "Sua entrega foi confirmada. Boa viagem!";
        await admin.from("notifications").insert({
          user_id: bookingFull.user_id,
          title: step === "pickup" ? "Coleta confirmada" : "Entrega confirmada",
          message: msg,
          category: "booking",
        });
      }

      return new Response(
        JSON.stringify({ ok: true, step, status: newStatus }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Shipments e dependent_shipments ---
    const codeField = step === "pickup" ? "pickup_code" : "delivery_code";
    const timestampField =
      step === "pickup" ? "picked_up_at" : "delivered_at";

    const { data: entity, error: entityErr } = await admin
      .from(table)
      .select(`id, ${codeField}, ${timestampField}, status, user_id`)
      .eq("id", entity_id)
      .single();

    if (entityErr || !entity) {
      return new Response(
        JSON.stringify({ error: "Registro não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se já foi confirmado
    if (entity[timestampField]) {
      return new Response(
        JSON.stringify({
          error: `${step === "pickup" ? "Coleta" : "Entrega"} já foi confirmada`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar código
    const expectedCode = entity[codeField];
    if (
      !expectedCode ||
      codeTrim !== String(expectedCode).replace(/\D/g, "")
    ) {
      return new Response(JSON.stringify({ error: "Código incorreto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar timestamp e status
    const newStatus = step === "pickup" ? "in_progress" : "delivered";
    const nowIso = new Date().toISOString();

    const { error: updateErr } = await admin
      .from(table)
      .update({
        [timestampField]: nowIso,
        status: newStatus,
        updated_at: nowIso,
      })
      .eq("id", entity_id);

    if (updateErr) {
      console.error("[confirm-code] update:", updateErr);
      return new Response(
        JSON.stringify({ error: "Erro ao confirmar" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Notificar cliente
    if (entity.user_id) {
      const label =
        entity_type === "shipment" ? "encomenda" : "dependente";
      const msg =
        step === "pickup"
          ? `A coleta da sua ${label} foi confirmada.`
          : `A entrega da sua ${label} foi confirmada.`;
      await admin.from("notifications").insert({
        user_id: entity.user_id,
        title:
          step === "pickup" ? "Coleta confirmada" : "Entrega confirmada",
        message: msg,
        category: entity_type,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, step, status: newStatus }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[confirm-code] unhandled:", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        details: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
