import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

type EntityTable = "bookings" | "shipments" | "dependent_shipments" | "excursion_requests";

type EntityRef = { table: EntityTable; id: string };

function extractEntityRef(metadata: Stripe.Metadata | null | undefined): EntityRef | null {
  const booking = metadata?.booking_id?.trim();
  if (booking) return { table: "bookings", id: booking };
  const shipment = metadata?.shipment_id?.trim();
  if (shipment) return { table: "shipments", id: shipment };
  const dependent = metadata?.dependent_shipment_id?.trim();
  if (dependent) return { table: "dependent_shipments", id: dependent };
  const excursion = metadata?.excursion_request_id?.trim();
  if (excursion) return { table: "excursion_requests", id: excursion };
  return null;
}

// Deep link por subtype do motorista/preparador para push de conta Connect aprovada.
// takeme/partner: abrem a aba Pagamentos do fluxo de motorista (Payments).
// shipments: abrem a aba de pagamentos no fluxo de preparador de encomendas.
// excursions: abrem a aba de pagamentos no fluxo de preparador de excursoes.
function routeForSubtype(subtype: string | null | undefined): string {
  if (subtype === "shipments") return "PagamentosEncomendas";
  if (subtype === "excursions") return "PagamentosExcursoes";
  return "Payments";
}

async function handlePaymentIntentSucceeded(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
  now: string
): Promise<void> {
  const ref = extractEntityRef(pi.metadata);
  if (!ref) return;

  if (ref.table === "bookings") {
    await admin
      .from("bookings")
      .update({
        status: "paid",
        paid_at: now,
        updated_at: now,
        stripe_payment_intent_id: pi.id,
      } as never)
      .eq("id", ref.id)
      .eq("status", "pending");
    return;
  }

  if (ref.table === "excursion_requests") {
    // 1) Marca orcamento como pago/aprovado + registra PI.
    const { data: updated, error: updErr } = await admin
      .from("excursion_requests")
      .update({
        status: "approved",
        stripe_payment_intent_id: pi.id,
        confirmed_at: now,
        updated_at: now,
      } as never)
      .eq("id", ref.id)
      .is("stripe_payment_intent_id", null)
      .select(
        "id, driver_id, preparer_id, total_amount_cents, worker_payout_cents, preparer_payout_cents",
      )
      .maybeSingle();

    if (updErr) {
      console.error("[stripe-webhook] excursion_requests update falhou:", updErr.message);
      return;
    }
    if (!updated) {
      // Ja havia sido processado (PI anterior) ou nao encontrado — retry-safe.
      return;
    }

    const excursion = updated as {
      id: string;
      driver_id: string | null;
      preparer_id: string | null;
      total_amount_cents: number | null;
      worker_payout_cents: number | null;
      preparer_payout_cents: number | null;
    };

    const workerTotal = Number(excursion.worker_payout_cents) || 0;
    const preparerAmount = Math.max(0, Number(excursion.preparer_payout_cents) || 0);
    const driverAmount = Math.max(0, workerTotal - preparerAmount);
    const grossTotal = Number(excursion.total_amount_cents) || workerTotal;

    // 2) Cria 2 rows em payouts (uma por worker). Invariante:
    //    driverAmount + preparerAmount == worker_payout_cents. process-payouts
    //    decide se gera stripe.transfers.create com base em hasConnect +
    //    entity_type='excursion'.
    //
    // Se algum amount for 0 (ou worker nao tiver id), pula a row — nao poluir
    // a fila com payouts zerados.
    const payoutsToInsert: Array<Record<string, unknown>> = [];

    if (excursion.driver_id && driverAmount > 0) {
      payoutsToInsert.push({
        worker_id: excursion.driver_id,
        entity_type: "excursion",
        entity_id: excursion.id,
        gross_amount_cents: grossTotal,
        worker_amount_cents: driverAmount,
        admin_amount_cents: 0,
        payout_method: "pix",
        status: "pending",
      });
    }
    if (excursion.preparer_id && preparerAmount > 0) {
      payoutsToInsert.push({
        worker_id: excursion.preparer_id,
        entity_type: "excursion",
        entity_id: excursion.id,
        gross_amount_cents: grossTotal,
        worker_amount_cents: preparerAmount,
        admin_amount_cents: 0,
        payout_method: "pix",
        status: "pending",
      });
    }

    if (payoutsToInsert.length === 0) {
      console.warn(
        `[stripe-webhook] excursion ${excursion.id} aprovada sem payouts (driver/preparer ausentes ou valores zero).`,
      );
      return;
    }

    const { error: payoutsErr } = await admin
      .from("payouts")
      .insert(payoutsToInsert as never);
    if (payoutsErr) {
      console.error(
        `[stripe-webhook] falha ao inserir payouts excursion ${excursion.id}:`,
        payoutsErr.message,
      );
    }
    return;
  }

  await admin
    .from(ref.table)
    .update({ stripe_payment_intent_id: pi.id, updated_at: now } as never)
    .eq("id", ref.id)
    .is("stripe_payment_intent_id", null);
}

async function handleChargeRefunded(
  admin: SupabaseClient,
  charge: Stripe.Charge,
  now: string
): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent.trim() : null;
  if (!paymentIntentId) return;

  const fullyRefunded = charge.amount_refunded >= charge.amount;
  const nextStatus = fullyRefunded ? "refunded" : "partially_refunded";

  for (
    const table of [
      "bookings",
      "shipments",
      "dependent_shipments",
      "excursion_requests",
    ] as EntityTable[]
  ) {
    await admin
      .from(table)
      .update({ status: nextStatus, updated_at: now } as never)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .not("status", "in", "(refunded,partially_refunded)");
  }
}

async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  const ref = extractEntityRef(pi.metadata);
  const errMsg = pi.last_payment_error?.message ?? "(sem detalhes)";
  console.warn(
    `[stripe-webhook] payment_intent.payment_failed pi=${pi.id} ref=${ref ? `${ref.table}:${ref.id}` : "none"} err=${errMsg}`
  );
}

async function sendStripeApprovedEmail(toEmail: string, fullName: string | null): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("[stripe-webhook] RESEND_API_KEY ausente — e-mail de aprovação NÃO enviado:", toEmail);
    return;
  }
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Take Me <onboarding@resend.dev>";
  const name = fullName?.trim() || "motorista";
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #111827;">Recebimento automático liberado! 🎉</h2>
      <p style="color: #374151; line-height: 1.6;">Olá, ${name}!</p>
      <p style="color: #374151; line-height: 1.6;">A Stripe concluiu a análise do seu cadastro. A partir de agora, os valores das suas corridas e entregas são depositados <b>automaticamente via PIX</b> na sua conta.</p>
      <p style="color: #374151; line-height: 1.6;">Não precisa fazer mais nada — é só continuar operando normalmente no app.</p>
      <p style="color: #6B7280; margin-top: 32px;">Equipe Take Me</p>
    </div>
  `;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: "Seu recebimento automático Take Me está ativo",
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[stripe-webhook] Resend error:", err);
    }
  } catch (e) {
    console.error("[stripe-webhook] Resend exception:", e);
  }
}

async function handleAccountUpdated(
  admin: SupabaseClient,
  account: Stripe.Account,
  now: string
): Promise<void> {
  if (!account.id) return;

  const chargesNow = Boolean(account.charges_enabled);
  const payoutsNow = Boolean(account.payouts_enabled);
  const detailsNow = Boolean(account.details_submitted);

  // Ler estado anterior para detectar transição false → true e garantir idempotência.
  // subtype e incluido para resolver o deep link correto do push (Payments /
  // PagamentosEncomendas / PagamentosExcursoes).
  const { data: before } = await admin
    .from("worker_profiles")
    .select("id, subtype, stripe_connect_charges_enabled, stripe_connect_notified_approved_at")
    .eq("stripe_connect_account_id", account.id)
    .maybeSingle();

  await admin
    .from("worker_profiles")
    .update({
      stripe_connect_charges_enabled: chargesNow,
      stripe_connect_payouts_enabled: payoutsNow,
      stripe_connect_details_submitted: detailsNow,
      updated_at: now,
    } as never)
    .eq("stripe_connect_account_id", account.id);

  if (!before) return;

  const wasApproved = Boolean((before as { stripe_connect_charges_enabled?: boolean }).stripe_connect_charges_enabled);
  const alreadyNotified = Boolean(
    (before as { stripe_connect_notified_approved_at?: string | null }).stripe_connect_notified_approved_at
  );
  const workerId = (before as { id?: string }).id;
  const subtype = (before as { subtype?: string | null }).subtype ?? null;
  if (!workerId) return;
  if (!chargesNow) return; // não aprovado ainda
  if (wasApproved || alreadyNotified) return; // já estava aprovado; nada a fazer

  // Push via inserção em public.notifications (webhook do Supabase → dispatch-notification-fcm).
  const { error: pushErr } = await admin.from("notifications").insert({
    user_id: workerId,
    title: "Recebimento automático liberado 🎉",
    message:
      "A Stripe concluiu a análise do seu cadastro. Seus pagamentos agora são depositados automaticamente via PIX.",
    category: "account_approved",
    target_app_slug: "motorista",
    data: { route: routeForSubtype(subtype) },
  } as never);
  if (pushErr) {
    console.error("[stripe-webhook] falha ao inserir notification:", pushErr.message);
  }

  // E-mail — buscar endereço via auth.users (admin API).
  try {
    const { data: userRes } = await admin.auth.admin.getUserById(workerId);
    const email = userRes?.user?.email;
    const fullName =
      (userRes?.user?.user_metadata as { full_name?: string; name?: string } | null)?.full_name ??
      (userRes?.user?.user_metadata as { full_name?: string; name?: string } | null)?.name ??
      null;
    if (email) await sendStripeApprovedEmail(email, fullName);
  } catch (e) {
    console.error("[stripe-webhook] falha ao buscar e-mail do motorista:", e);
  }

  // Marcar como notificado para idempotência.
  await admin
    .from("worker_profiles")
    .update({ stripe_connect_notified_approved_at: now } as never)
    .eq("id", workerId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecret || !whSecret || !supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Configuração incompleta no servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response(JSON.stringify({ error: "Assinatura ausente" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  const stripe = new Stripe(stripeSecret);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      whSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[stripe-webhook] assinatura inválida:", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(admin, event.data.object as Stripe.PaymentIntent, now);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(admin, event.data.object as Stripe.Charge, now);
        break;
      case "account.updated":
        await handleAccountUpdated(admin, event.data.object as Stripe.Account, now);
        break;
      default:
        return new Response(JSON.stringify({ received: true, ignored: event.type }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error(`[stripe-webhook] handler error (${event.type}):`, e);
    return new Response(JSON.stringify({ error: "Falha ao processar evento" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true, type: event.type }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
