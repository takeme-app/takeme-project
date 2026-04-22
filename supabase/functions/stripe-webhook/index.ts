import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

type EntityTable = "bookings" | "shipments" | "dependent_shipments";

type EntityRef = { table: EntityTable; id: string };

function extractEntityRef(metadata: Stripe.Metadata | null | undefined): EntityRef | null {
  const booking = metadata?.booking_id?.trim();
  if (booking) return { table: "bookings", id: booking };
  const shipment = metadata?.shipment_id?.trim();
  if (shipment) return { table: "shipments", id: shipment };
  const dependent = metadata?.dependent_shipment_id?.trim();
  if (dependent) return { table: "dependent_shipments", id: dependent };
  return null;
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

  for (const table of ["bookings", "shipments", "dependent_shipments"] as EntityTable[]) {
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

async function handleAccountUpdated(
  admin: SupabaseClient,
  account: Stripe.Account,
  now: string
): Promise<void> {
  if (!account.id) return;
  await admin
    .from("worker_profiles")
    .update({
      stripe_connect_charges_enabled: Boolean(account.charges_enabled),
      stripe_connect_payouts_enabled: Boolean(account.payouts_enabled),
      stripe_connect_details_submitted: Boolean(account.details_submitted),
      updated_at: now,
    } as never)
    .eq("stripe_connect_account_id", account.id);
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
