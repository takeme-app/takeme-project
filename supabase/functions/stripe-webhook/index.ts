import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

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
    return new Response(JSON.stringify({ error: "Assinatura ausente" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const body = await req.text();
  const stripe = new Stripe(stripeSecret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[stripe-webhook] assinatura inválida:", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  if (event.type !== "payment_intent.succeeded") {
    return new Response(JSON.stringify({ received: true, ignored: event.type }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pi = event.data.object as Stripe.PaymentIntent;
  const bookingId = pi.metadata?.booking_id?.trim();
  const shipmentId = pi.metadata?.shipment_id?.trim();
  const dependentShipmentId = pi.metadata?.dependent_shipment_id?.trim();

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  try {
    if (bookingId && (pi.status === "succeeded" || pi.status === "requires_capture")) {
      await admin
        .from("bookings")
        .update({
          status: "paid",
          paid_at: now,
          updated_at: now,
          stripe_payment_intent_id: pi.id,
        } as never)
        .eq("id", bookingId)
        .eq("status", "pending");
    }

    if (shipmentId && pi.status === "succeeded") {
      await admin
        .from("shipments")
        .update({ stripe_payment_intent_id: pi.id, updated_at: now } as never)
        .eq("id", shipmentId)
        .is("stripe_payment_intent_id", null);
    }

    if (dependentShipmentId && pi.status === "succeeded") {
      await admin
        .from("dependent_shipments")
        .update({ stripe_payment_intent_id: pi.id, updated_at: now } as never)
        .eq("id", dependentShipmentId)
        .is("stripe_payment_intent_id", null);
    }
  } catch (e) {
    console.error("[stripe-webhook] atualização Supabase:", e);
    return new Response(JSON.stringify({ error: "Falha ao sincronizar pedido" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
