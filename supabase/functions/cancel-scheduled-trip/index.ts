import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-auth-token, x-client-info, apikey, content-type",
};

const DEFAULT_PENALTY_PCT = 10;

async function readSetting(
  admin: ReturnType<typeof createClient>,
  key: string,
): Promise<unknown> {
  try {
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return (data as { value?: unknown } | null)?.value ?? null;
  } catch (e) {
    console.warn(`[cancel-scheduled-trip] setting ${key} warn:`, e);
    return null;
  }
}

function toNumber(raw: unknown, fallback: number): number {
  if (raw == null) return fallback;
  const val =
    typeof raw === "object" && raw !== null && "value" in raw
      ? (raw as { value: unknown }).value
      : raw;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(raw: unknown, fallback: boolean): boolean {
  if (raw == null) return fallback;
  const val =
    typeof raw === "object" && raw !== null && "value" in raw
      ? (raw as { value: unknown }).value
      : raw;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "true";
  if (typeof val === "number") return val !== 0;
  return fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      scheduled_trip_id?: string;
      reason?: string;
    };
    const tripId =
      typeof body.scheduled_trip_id === "string"
        ? body.scheduled_trip_id.trim()
        : "";
    const rawReason = typeof body.reason === "string" ? body.reason.trim() : "";
    const reason = rawReason.length > 0 ? rawReason.slice(0, 500) : "driver_cancelled_scheduled_trip";

    if (!tripId) {
      return new Response(
        JSON.stringify({ error: "scheduled_trip_id obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: tripRaw, error: tripErr } = await admin
      .from("scheduled_trips")
      .select("id, driver_id, status, departure_at")
      .eq("id", tripId)
      .maybeSingle();

    if (tripErr || !tripRaw) {
      return new Response(JSON.stringify({ error: "Viagem não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trip = tripRaw as {
      id: string;
      driver_id: string | null;
      status: string;
      departure_at: string | null;
    };

    if (String(trip.driver_id ?? "") !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trip.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Viagem já está cancelada" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const penaltyPct = toNumber(
      await readSetting(admin, "driver_cancellation_penalty_pct"),
      DEFAULT_PENALTY_PCT,
    );
    const penaltyEnabled = toBoolean(
      await readSetting(admin, "driver_cancellation_penalty_enabled"),
      true,
    );

    type PaidBooking = {
      id: string;
      user_id: string;
      amount_cents: number | null;
      admin_earning_cents: number | null;
      stripe_payment_intent_id: string | null;
      status: string;
    };

    const { data: paidRows, error: paidErr } = await admin
      .from("bookings")
      .select(
        "id, user_id, amount_cents, admin_earning_cents, stripe_payment_intent_id, status"
      )
      .eq("scheduled_trip_id", tripId)
      .in("status", ["paid", "confirmed"]);

    if (paidErr) {
      return new Response(
        JSON.stringify({ error: `Falha ao listar reservas: ${paidErr.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paidBookings = (paidRows ?? []) as PaidBooking[];

    // Dispara refund para cada booking pago antes de cancelar a viagem.
    // Motivo: process-refund marca booking como cancelled individualmente,
    // e queremos fazer isso ANTES do trigger sync_bookings_when_scheduled_trip_cancelled
    // para não perder o payment_intent_id via race.
    const refundResults: Array<{
      booking_id: string;
      ok: boolean;
      refund_amount_cents?: number;
      error?: string;
    }> = [];

    for (const b of paidBookings) {
      const pi = (b.stripe_payment_intent_id ?? "").trim();
      const cents = Math.max(0, Math.floor(Number(b.amount_cents ?? 0)));
      if (!pi || cents <= 0) {
        refundResults.push({
          booking_id: b.id,
          ok: true,
          refund_amount_cents: 0,
          error: "sem cobrança Stripe",
        });
        continue;
      }

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/process-refund`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            entity_type: "booking",
            entity_id: b.id,
            reason: "driver_cancelled_scheduled_trip",
          }),
        });
        const resBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          refund_amount_cents?: number;
        };
        if (!res.ok) {
          refundResults.push({
            booking_id: b.id,
            ok: false,
            error: resBody.error ?? res.statusText,
          });
          continue;
        }
        refundResults.push({
          booking_id: b.id,
          ok: true,
          refund_amount_cents: Number(resBody.refund_amount_cents ?? cents),
        });

        // Marca cancelled_by='driver' e policy snapshot no booking individual.
        const nowIso = new Date().toISOString();
        await admin
          .from("bookings")
          .update({
            cancelled_by: "driver",
            cancelled_at: nowIso,
            cancellation_reason: "driver_cancelled_scheduled_trip",
            cancellation_policy_applied: {
              triggered_by: "driver_cancelled_scheduled_trip",
              inside_free_window: false,
              will_refund: true,
              refund_amount_cents: Number(resBody.refund_amount_cents ?? cents),
            },
            updated_at: nowIso,
          } as never)
          .eq("id", b.id);
      } catch (e) {
        refundResults.push({
          booking_id: b.id,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Atualiza scheduled_trips -> cancelled. Trigger propaga para bookings
    // que não foram tratados individualmente (ex.: pending sem pagamento).
    const nowIso = new Date().toISOString();
    const { error: tripUpdErr } = await admin
      .from("scheduled_trips")
      .update({ status: "cancelled", updated_at: nowIso } as never)
      .eq("id", tripId);

    if (tripUpdErr) {
      return new Response(
        JSON.stringify({
          error: `Falha ao cancelar viagem: ${tripUpdErr.message}`,
          refund_results: refundResults,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calcula multa total e grava driver_penalties se houver bookings pagos.
    let penaltyCents = 0;
    const successfulRefunds = refundResults.filter(
      (r) => r.ok && Number(r.refund_amount_cents ?? 0) > 0,
    );

    if (penaltyEnabled && successfulRefunds.length > 0 && trip.driver_id) {
      for (const rr of successfulRefunds) {
        const matching = paidBookings.find((b) => b.id === rr.booking_id);
        if (!matching) continue;
        const total = Math.max(0, Math.floor(Number(matching.amount_cents ?? 0)));
        const adminEarning = Math.max(
          0,
          Math.floor(Number(matching.admin_earning_cents ?? 0)),
        );
        const pctCents = Math.round((total * penaltyPct) / 100);
        const thisPenalty = adminEarning + pctCents;
        if (thisPenalty <= 0) continue;
        penaltyCents += thisPenalty;

        const { error: insErr } = await admin
          .from("driver_penalties")
          .insert({
            driver_id: trip.driver_id,
            scheduled_trip_id: tripId,
            booking_id: matching.id,
            reason: "driver_cancelled_after_payment",
            amount_cents: thisPenalty,
            status: "pending",
          } as never);
        if (insErr) {
          console.error(
            "[cancel-scheduled-trip] driver_penalties insert error:",
            insErr.message,
          );
        }
      }
    }

    // Notificações para passageiros reembolsados (complementa o trigger).
    for (const rr of successfulRefunds) {
      const matching = paidBookings.find((b) => b.id === rr.booking_id);
      if (!matching) continue;
      try {
        await admin.from("notifications").insert({
          user_id: matching.user_id,
          title: "Viagem cancelada pelo motorista",
          message:
            "O motorista cancelou a viagem. O valor pago será estornado integralmente no cartão em 5 a 10 dias.",
          category: "booking",
        } as never);
      } catch (e) {
        console.warn("[cancel-scheduled-trip] notification warn:", e);
      }
    }

    return new Response(
      JSON.stringify({
        cancelled: true,
        refunded_count: successfulRefunds.length,
        total_paid_bookings: paidBookings.length,
        penalty_cents: penaltyCents,
        penalty_enabled: penaltyEnabled,
        refund_results: refundResults,
        reason,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[cancel-scheduled-trip]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
