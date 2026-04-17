import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-auth-token, x-client-info, apikey, content-type",
};

const STRIPE_API = "https://api.stripe.com/v1";
const CANCEL_REASON = "driver_journey_started_not_accepted";

async function stripeFetch(
  secretKey: string,
  method: string,
  path: string,
  body?: URLSearchParams,
): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${STRIPE_API}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body && method !== "GET"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
  };
  if (body && method !== "GET") opts.body = body.toString();
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      (data as { error?: { message?: string } })?.error?.message ??
      res.statusText;
    throw new Error(err);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("x-auth-token");
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
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);
    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as { trip_id?: string };
    const tripId = typeof body.trip_id === "string" ? body.trip_id.trim() : "";
    if (!tripId) {
      return new Response(JSON.stringify({ error: "trip_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: "Stripe não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: trip, error: tripErr } = await admin
      .from("scheduled_trips")
      .select("id, driver_id, driver_journey_started_at")
      .eq("id", tripId)
      .maybeSingle();

    if (tripErr || !trip) {
      return new Response(JSON.stringify({ error: "Viagem não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const row = trip as { driver_id?: string | null; driver_journey_started_at?: string | null };
    if (String(row.driver_id ?? "") !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!row.driver_journey_started_at) {
      return new Response(JSON.stringify({ error: "Viagem ainda não iniciada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    type EntRow = {
      id: string;
      user_id: string;
      amount_cents: number | null;
      stripe_payment_intent_id: string | null;
    };

    const results: { entity: string; id: string; ok: boolean; detail?: string }[] = [];

    const refundEntity = async (
      table: "bookings" | "shipments" | "dependent_shipments",
      entityLabel: string,
      payoutEntityType: "booking" | "shipment" | "dependent_shipment",
    ) => {
      const { data: rows, error: qErr } = await admin
        .from(table)
        .select("id, user_id, amount_cents, stripe_payment_intent_id, cancellation_reason, status")
        .eq("scheduled_trip_id", tripId)
        .eq("cancellation_reason", CANCEL_REASON)
        .eq("status", "cancelled");
      if (qErr) {
        results.push({ entity: entityLabel, id: "*", ok: false, detail: qErr.message });
        return;
      }
      for (const r of (rows ?? []) as EntRow[]) {
        const pi = (r.stripe_payment_intent_id ?? "").trim();
        const cents = Math.max(0, Math.floor(Number(r.amount_cents ?? 0)));
        if (!pi || cents <= 0) {
          results.push({ entity: entityLabel, id: r.id, ok: true, detail: "sem cobrança Stripe" });
          continue;
        }
        try {
          await stripeFetch(stripeSecret, "POST", "/refunds", new URLSearchParams({
            payment_intent: pi,
            amount: String(cents),
            reason: "requested_by_customer",
            "metadata[internal_reason]": CANCEL_REASON,
          }));

          await admin
            .from("payouts")
            .update({
              status: "cancelled",
              cancelled_reason: "refund",
              updated_at: new Date().toISOString(),
            } as never)
            .eq("entity_type", payoutEntityType)
            .eq("entity_id", r.id)
            .in("status", ["pending", "processing"]);

          await admin.from("notifications").insert({
            user_id: r.user_id,
            title: "Pedido não confirmado — estorno",
            message:
              "O motorista iniciou a viagem sem aceitar sua solicitação. O valor pago será estornado ao método de pagamento.",
            category: entityLabel,
          } as never);

          results.push({ entity: entityLabel, id: r.id, ok: true });
        } catch (e) {
          results.push({
            entity: entityLabel,
            id: r.id,
            ok: false,
            detail: e instanceof Error ? e.message : String(e),
          });
        }
      }
    };

    await refundEntity("bookings", "booking", "booking");
    await refundEntity("shipments", "shipment", "shipment");
    await refundEntity("dependent_shipments", "dependent_shipment", "dependent_shipment");

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[refund-journey-start-not-accepted]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
