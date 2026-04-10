import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-auth-token, x-client-info, apikey, content-type",
};

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeFetch(
  secretKey: string,
  method: string,
  path: string,
  body?: URLSearchParams
): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${STRIPE_API}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
  };
  if (body && method !== "GET") opts.body = body.toString();
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string } })?.error?.message ?? res.statusText;
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
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado (STRIPE_SECRET_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const claims = claimsData?.claims as { sub?: string } | undefined;
    const userId = claims?.sub;
    if (claimsError || !userId) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      booking_id?: string;
      /** UUID em `payment_methods.id` (cartão salvo na carteira) */
      payment_method_id?: string;
      /** ID Stripe `pm_...` retornado pelo PaymentSheet / Stripe RN no checkout */
      stripe_payment_method_id?: string;
    };
    const bookingId = body.booking_id?.trim();
    const paymentMethodIdSupabase = body.payment_method_id?.trim();
    const stripePaymentMethodIdFromClient = body.stripe_payment_method_id?.trim();
    if (!bookingId || (!paymentMethodIdSupabase && !stripePaymentMethodIdFromClient)) {
      return new Response(
        JSON.stringify({
          error: "Envie booking_id e payment_method_id (cartão salvo) ou stripe_payment_method_id (pm_… do checkout).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: booking, error: bookingErr } = await admin
      .from("bookings")
      .select("id, user_id, amount_cents, status, worker_payout_cents, scheduled_trips(driver_id)")
      .eq("id", bookingId)
      .eq("user_id", userId)
      .single();
    if (bookingErr || !booking) {
      return new Response(
        JSON.stringify({ error: "Reserva não encontrada ou não pertence ao usuário" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (booking.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Reserva já foi paga ou cancelada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let stripePaymentMethodId: string;
    if (stripePaymentMethodIdFromClient) {
      stripePaymentMethodId = stripePaymentMethodIdFromClient;
    } else {
      const { data: pmRow, error: pmErr } = await admin
        .from("payment_methods")
        .select("id, user_id, provider_id")
        .eq("id", paymentMethodIdSupabase!)
        .eq("user_id", userId)
        .single();
      if (pmErr || !pmRow?.provider_id) {
        return new Response(
          JSON.stringify({ error: "Método de pagamento não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      stripePaymentMethodId = pmRow.provider_id as string;
    }

    const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("id", userId).single();
    const customerId = profile?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "Cliente Stripe não encontrado; adicione um método de pagamento primeiro" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountCents = Number(booking.amount_cents);
    if (!Number.isInteger(amountCents) || amountCents < 1) {
      return new Response(
        JSON.stringify({ error: "Valor da reserva inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stRaw = booking.scheduled_trips as { driver_id?: string } | { driver_id?: string }[] | null;
    const st = Array.isArray(stRaw) ? stRaw[0] : stRaw;
    const driverId = st?.driver_id?.trim();
    let connectAccountId: string | null = null;
    let applicationFeeCents: number | null = null;

    if (driverId) {
      const { data: wp } = await admin
        .from("worker_profiles")
        .select("stripe_connect_account_id")
        .eq("id", driverId)
        .maybeSingle();
      connectAccountId = (wp?.stripe_connect_account_id as string | null | undefined)?.trim() ?? null;

      const workerPayout = booking.worker_payout_cents;
      const payout =
        workerPayout != null && Number.isFinite(Number(workerPayout))
          ? Math.max(0, Math.floor(Number(workerPayout)))
          : null;

      if (connectAccountId && payout != null) {
        if (payout > amountCents) {
          return new Response(
            JSON.stringify({ error: "Inconsistência de valores da reserva (repasse > total)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        applicationFeeCents = amountCents - payout;
        if (applicationFeeCents < 0) {
          return new Response(
            JSON.stringify({ error: "Taxa de aplicação inválida para Stripe Connect" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const piParams = new URLSearchParams({
      amount: String(amountCents),
      currency: "brl",
      customer: customerId,
      "payment_method": stripePaymentMethodId,
      confirm: "true",
      "metadata[booking_id]": bookingId,
    });
    if (connectAccountId && applicationFeeCents != null) {
      piParams.set("application_fee_amount", String(applicationFeeCents));
      piParams.set("transfer_data[destination]", connectAccountId);
      piParams.set("metadata[stripe_connect_destination]", connectAccountId);
    }
    const pi = await stripeFetch(stripeSecret, "POST", "/payment_intents", piParams) as {
      id?: string;
      status?: string;
      last_payment_error?: { message?: string };
    };
    if (pi.status !== "succeeded" && pi.status !== "requires_capture") {
      const errMsg = pi.last_payment_error?.message ?? "Pagamento não foi aprovado";
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: updateErr } = await admin
      .from("bookings")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stripe_payment_intent_id: pi.id ?? null,
      })
      .eq("id", bookingId)
      .eq("user_id", userId);
    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Reserva cobrada mas falha ao atualizar status; contate o suporte" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (driverId) {
      const workerPayout = booking.worker_payout_cents;
      const payoutCents =
        workerPayout != null && Number.isFinite(Number(workerPayout))
          ? Math.max(0, Math.floor(Number(workerPayout)))
          : null;
      if (payoutCents != null) {
        const { data: existingPayout } = await admin
          .from("payouts")
          .select("id")
          .eq("entity_type", "booking")
          .eq("entity_id", bookingId)
          .maybeSingle();
        if (!existingPayout) {
          const adminCents = Math.max(0, amountCents - payoutCents);
          const { error: payoutErr } = await admin.from("payouts").insert({
            worker_id: driverId,
            entity_type: "booking",
            entity_id: bookingId,
            gross_amount_cents: amountCents,
            worker_amount_cents: payoutCents,
            admin_amount_cents: adminCents,
            status: "pending",
            payout_method: "pix",
          } as never);
          if (payoutErr) {
            console.error("[charge-booking] payout insert:", payoutErr);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, booking_id: bookingId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("charge-booking:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao processar cobrança" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
