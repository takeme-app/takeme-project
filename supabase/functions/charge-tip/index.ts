import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-auth-token, x-client-info, apikey, content-type",
};

const STRIPE_API = "https://api.stripe.com/v1";

type EntityType = "booking" | "shipment" | "dependent_shipment";

type TipBody = {
  entity_type?: EntityType;
  entity_id?: string;
  amount_cents?: number;
  stripe_payment_method_id?: string;
  card_intent?: "credit" | "debit";
};

const MIN_TIP_CENTS = 100; // R$ 1,00
const MAX_TIP_CENTS = 100_000; // R$ 1.000,00 — proteção anti-erro de digitação.

async function stripeFetch(
  secretKey: string,
  method: string,
  path: string,
  body?: URLSearchParams,
  idempotencyKey?: string,
): Promise<unknown> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body && method !== "GET" ? body.toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      (data as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new Error(err);
  }
  return data;
}

function tableFromEntity(entity: EntityType): string {
  switch (entity) {
    case "booking":
      return "bookings";
    case "shipment":
      return "shipments";
    case "dependent_shipment":
      return "dependent_shipments";
  }
}

type EntityStatus = {
  id: string;
  user_id: string;
  tip_status: string | null;
  tip_cents: number | null;
  tip_payment_intent_id: string | null;
  scheduled_trip_id?: string | null;
  status: string;
  // shipments: driver_id direto
  driver_id?: string | null;
  // scheduled_trips resolvido (para bookings/dependent_shipments)
  scheduled_trips?: { driver_id: string | null; status: string | null } | null;
};

async function loadEntity(
  admin: SupabaseClient,
  entity: EntityType,
  id: string,
): Promise<{ row: EntityStatus; error: null } | { row: null; error: string; status: number }> {
  const table = tableFromEntity(entity);
  const baseSelect =
    entity === "shipment"
      ? "id, user_id, status, driver_id, scheduled_trip_id, tip_status, tip_cents, tip_payment_intent_id, scheduled_trips:scheduled_trip_id(driver_id, status)"
      : "id, user_id, status, scheduled_trip_id, tip_status, tip_cents, tip_payment_intent_id, scheduled_trips:scheduled_trip_id(driver_id, status)";

  const { data, error } = await admin
    .from(table)
    .select(baseSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { row: null, error: `Falha ao carregar ${entity}: ${error.message}`, status: 500 };
  }
  if (!data) {
    return { row: null, error: `${entity} não encontrado`, status: 404 };
  }
  return { row: data as unknown as EntityStatus, error: null };
}

function entityIsCompleted(entity: EntityType, row: EntityStatus): boolean {
  if (entity === "booking") {
    // Corrida concluída = scheduled_trips.status === 'completed' (sem booking cancelado).
    const bookingStatus = (row.status ?? "").toLowerCase();
    const tripStatus = (row.scheduled_trips?.status ?? "").toLowerCase();
    if (bookingStatus === "cancelled" || bookingStatus === "canceled") return false;
    return tripStatus === "completed";
  }
  // shipments / dependent_shipments → 'delivered'.
  return (row.status ?? "").toLowerCase() === "delivered";
}

function resolveDriverId(entity: EntityType, row: EntityStatus): string | null {
  if (entity === "shipment") {
    const direct = (row.driver_id ?? "").trim();
    if (direct) return direct;
  }
  const fromTrip = (row.scheduled_trips?.driver_id ?? "").trim();
  return fromTrip || null;
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
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as TipBody;
    const entity = body.entity_type;
    const entityId = (body.entity_id ?? "").trim();
    const amountCents = Math.floor(Number(body.amount_cents ?? 0));
    const stripePm = (body.stripe_payment_method_id ?? "").trim();

    if (!entity || !["booking", "shipment", "dependent_shipment"].includes(entity)) {
      return new Response(
        JSON.stringify({ error: "entity_type inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!entityId) {
      return new Response(
        JSON.stringify({ error: "entity_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!stripePm) {
      return new Response(
        JSON.stringify({ error: "stripe_payment_method_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!Number.isInteger(amountCents) || amountCents < MIN_TIP_CENTS) {
      return new Response(
        JSON.stringify({
          error: `Valor mínimo da gorjeta: R$ ${(MIN_TIP_CENTS / 100).toFixed(2).replace(".", ",")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (amountCents > MAX_TIP_CENTS) {
      return new Response(
        JSON.stringify({
          error: `Valor máximo da gorjeta: R$ ${(MAX_TIP_CENTS / 100).toFixed(2).replace(".", ",")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const loaded = await loadEntity(admin, entity, entityId);
    if (loaded.error) {
      return new Response(JSON.stringify({ error: loaded.error }), {
        status: loaded.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const row = loaded.row;

    if (row.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!entityIsCompleted(entity, row)) {
      return new Response(
        JSON.stringify({
          error: "Gorjeta só pode ser enviada após a conclusão.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (row.tip_status === "succeeded") {
      return new Response(
        JSON.stringify({ error: "Gorjeta já foi enviada." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const driverId = resolveDriverId(entity, row);
    if (!driverId) {
      return new Response(
        JSON.stringify({ error: "Motorista não identificado nesta viagem." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Connect obrigatório — gorjeta é 100% transferida via transfer_data.
    const { data: wp } = await admin
      .from("worker_profiles")
      .select("stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("id", driverId)
      .maybeSingle();

    const connectAccount = (wp?.stripe_connect_account_id as string | null | undefined)?.trim() ?? null;
    const chargesEnabled = wp?.stripe_connect_charges_enabled === true;

    if (!connectAccount || !chargesEnabled) {
      return new Response(
        JSON.stringify({
          error:
            "O motorista ainda não finalizou o cadastro de recebimento. Tente novamente em alguns dias.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    const customerId = (profile?.stripe_customer_id as string | null | undefined)?.trim() ?? null;
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "Cliente Stripe não encontrado. Adicione um cartão primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const table = tableFromEntity(entity);
    const idempotencyKey = `tip_${entity}_${entityId}_${amountCents}`;

    const piParams = new URLSearchParams({
      amount: String(amountCents),
      currency: "brl",
      customer: customerId,
      payment_method: stripePm,
      confirm: "true",
      "payment_method_types[0]": "card",
      "metadata[tip]": "true",
      "metadata[entity_type]": entity,
      "metadata[entity_id]": entityId,
      "metadata[user_id]": userId,
      "metadata[driver_id]": driverId,
      // 100% transferido — sem application_fee_amount.
      "transfer_data[destination]": connectAccount,
      "metadata[stripe_connect_destination]": connectAccount,
    });
    if (body.card_intent === "credit" || body.card_intent === "debit") {
      piParams.set("metadata[requested_card_intent]", body.card_intent);
    }

    let pi: {
      id?: string;
      status?: string;
      amount?: number;
      latest_charge?: string;
      client_secret?: string;
      last_payment_error?: { message?: string };
    };
    try {
      pi = (await stripeFetch(
        stripeSecret,
        "POST",
        "/payment_intents",
        piParams,
        idempotencyKey,
      )) as typeof pi;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : "Falha ao cobrar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (pi.status === "requires_action") {
      return new Response(
        JSON.stringify({
          error:
            "Seu banco pediu confirmação extra neste cartão. Tente outro cartão.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (pi.status !== "succeeded" && pi.status !== "requires_capture") {
      const errMsg = pi.last_payment_error?.message ?? `Pagamento não foi aprovado (${pi.status})`;
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const succeeded = pi.status === "succeeded";
    const chargedCents =
      typeof pi.amount === "number" && Number.isFinite(pi.amount) && pi.amount > 0
        ? Math.floor(pi.amount)
        : amountCents;

    const updatePayload: Record<string, unknown> = {
      tip_cents: chargedCents,
      tip_payment_intent_id: pi.id ?? null,
      tip_charge_id: pi.latest_charge ?? null,
      tip_status: succeeded ? "succeeded" : "pending",
      tip_paid_at: succeeded ? new Date().toISOString() : null,
    };

    const { error: updErr } = await admin
      .from(table)
      .update(updatePayload as never)
      .eq("id", entityId);

    if (updErr) {
      console.error("[charge-tip] update error:", updErr.message);
      // Não rola back da cobrança — webhook eventualmente tenta reconciliar.
    }

    try {
      await admin.from("notifications").insert({
        user_id: driverId,
        title: "Você recebeu uma gorjeta",
        message: `O passageiro enviou uma gorjeta de R$ ${(chargedCents / 100).toFixed(2).replace(".", ",")}. Obrigado!`,
        category: "tip",
      } as never);
    } catch (e) {
      console.warn("[charge-tip] notification warn:", e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tip_cents: chargedCents,
        tip_status: succeeded ? "succeeded" : "pending",
        payment_intent_id: pi.id ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[charge-tip]", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
