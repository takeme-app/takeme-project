import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-auth-token, x-client-info, apikey, content-type",
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

/**
 * Busca o payment_intent ou charge associado a uma entidade para fazer refund.
 * Retorna o ID do pagamento Stripe ou null.
 */
async function findStripePaymentForEntity(
  admin: ReturnType<typeof createClient>,
  entityType: string,
  entityId: string
): Promise<string | null> {
  // Buscar amount e payment_method_id conforme o tipo de entidade
  let table: string;
  switch (entityType) {
    case "booking":
      table = "bookings";
      break;
    case "shipment":
      table = "shipments";
      break;
    case "dependent_shipment":
      table = "dependent_shipments";
      break;
    case "excursion":
      table = "excursion_requests";
      break;
    default:
      return null;
  }

  const { data } = await admin
    .from(table)
    .select("amount_cents, payment_method_id, user_id")
    .eq("id", entityId)
    .maybeSingle();

  if (!data) return null;

  // Nota: em produção, o payment_intent_id deve ser salvo na tabela ao processar o pagamento.
  // Esta função é um placeholder — o refund real depende de ter o payment_intent_id armazenado.
  // Por enquanto retorna os dados necessários para o refund.
  return data.amount_cents > 0 ? entityId : null;
}

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
      assignment_id?: string;
      action?: string; // "accept" | "reject"
      rejection_reason?: string;
    };

    const { assignment_id, action, rejection_reason } = body;

    if (!assignment_id || typeof assignment_id !== "string") {
      return new Response(
        JSON.stringify({ error: "assignment_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (action !== "accept" && action !== "reject") {
      return new Response(
        JSON.stringify({ error: "action deve ser 'accept' ou 'reject'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // --- Buscar assignment ---
    const { data: assignment, error: assignErr } = await admin
      .from("worker_assignments")
      .select("*")
      .eq("id", assignment_id)
      .eq("worker_id", user.id)
      .single();

    if (assignErr || !assignment) {
      return new Response(
        JSON.stringify({ error: "Atribuição não encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (assignment.status !== "assigned") {
      return new Response(
        JSON.stringify({
          error: `Atribuição já foi respondida (status: ${assignment.status})`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se expirou
    if (assignment.expires_at && new Date(assignment.expires_at) < new Date()) {
      // Marcar como expired se ainda não foi
      await admin
        .from("worker_assignments")
        .update({ status: "expired" })
        .eq("id", assignment_id);
      return new Response(
        JSON.stringify({
          error: "Prazo para responder expirou",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const nowIso = new Date().toISOString();

    if (action === "accept") {
      // --- ACEITAR ---
      const { error: updateErr } = await admin
        .from("worker_assignments")
        .update({
          status: "accepted",
          accepted_at: nowIso,
        })
        .eq("id", assignment_id);

      if (updateErr) {
        console.error("[respond-assignment] accept update:", updateErr);
        return new Response(
          JSON.stringify({ error: "Erro ao aceitar atribuição" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Buscar user_id da entidade para notificar o cliente
      const entityUserId = await getEntityUserId(
        admin,
        assignment.entity_type,
        assignment.entity_id
      );
      if (entityUserId) {
        await admin.from("notifications").insert({
          user_id: entityUserId,
          title: "Solicitação aceita",
          message: "Seu pedido foi aceito e está sendo processado.",
          category: assignment.entity_type,
        });
      }

      return new Response(JSON.stringify({ ok: true, status: "accepted" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // --- RECUSAR ---
      const { error: updateErr } = await admin
        .from("worker_assignments")
        .update({
          status: "rejected",
          rejected_at: nowIso,
          rejection_reason:
            typeof rejection_reason === "string"
              ? rejection_reason.trim().slice(0, 500)
              : null,
        })
        .eq("id", assignment_id);

      if (updateErr) {
        console.error("[respond-assignment] reject update:", updateErr);
        return new Response(
          JSON.stringify({ error: "Erro ao recusar atribuição" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Cancelar a entidade (booking, shipment, etc.)
      await cancelEntity(admin, assignment.entity_type, assignment.entity_id);

      // Notificar cliente
      const entityUserId = await getEntityUserId(
        admin,
        assignment.entity_type,
        assignment.entity_id
      );
      if (entityUserId) {
        await admin.from("notifications").insert({
          user_id: entityUserId,
          title: "Solicitação recusada",
          message:
            "Sua solicitação foi recusada pelo motorista. O valor será estornado.",
          category: assignment.entity_type,
        });
      }

      // Estorno via Stripe
      await processRefund(admin, assignment.entity_type, assignment.entity_id);

      return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[respond-assignment] unhandled:", err);
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

/** Busca o user_id (cliente) da entidade. */
async function getEntityUserId(
  admin: ReturnType<typeof createClient>,
  entityType: string,
  entityId: string
): Promise<string | null> {
  const table =
    entityType === "booking"
      ? "bookings"
      : entityType === "shipment"
        ? "shipments"
        : entityType === "dependent_shipment"
          ? "dependent_shipments"
          : entityType === "excursion"
            ? "excursion_requests"
            : null;
  if (!table) return null;
  const { data } = await admin
    .from(table)
    .select("user_id")
    .eq("id", entityId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/** Cancela a entidade associada à atribuição recusada. */
async function cancelEntity(
  admin: ReturnType<typeof createClient>,
  entityType: string,
  entityId: string
): Promise<void> {
  const table =
    entityType === "booking"
      ? "bookings"
      : entityType === "shipment"
        ? "shipments"
        : entityType === "dependent_shipment"
          ? "dependent_shipments"
          : entityType === "excursion"
            ? "excursion_requests"
            : null;
  if (!table) return;
  const cancelStatus =
    entityType === "booking" ? "cancelled" : "cancelled";
  await admin
    .from(table)
    .update({ status: cancelStatus, updated_at: new Date().toISOString() })
    .eq("id", entityId);
}

/** Processa estorno integral via Stripe. */
async function processRefund(
  admin: ReturnType<typeof createClient>,
  entityType: string,
  entityId: string
): Promise<void> {
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecret) {
    console.warn("[respond-assignment] STRIPE_SECRET_KEY não definida, estorno ignorado");
    return;
  }

  // Buscar dados da entidade para o refund
  const table =
    entityType === "booking"
      ? "bookings"
      : entityType === "shipment"
        ? "shipments"
        : entityType === "dependent_shipment"
          ? "dependent_shipments"
          : entityType === "excursion"
            ? "excursion_requests"
            : null;
  if (!table) return;

  const amountField =
    entityType === "excursion" ? "total_amount_cents" : "amount_cents";

  const { data } = await admin
    .from(table)
    .select(`${amountField}, payment_method_id, user_id`)
    .eq("id", entityId)
    .maybeSingle();

  if (!data || !data[amountField] || data[amountField] <= 0) {
    console.warn("[respond-assignment] sem valor para estorno:", entityType, entityId);
    return;
  }

  // Buscar stripe_customer_id do cliente
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", data.user_id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    console.warn("[respond-assignment] cliente sem stripe_customer_id, estorno ignorado");
    return;
  }

  // Nota: Em produção, o payment_intent_id deve ser armazenado na tabela de pagamentos
  // ao processar a cobrança. Aqui fazemos refund se houver um payment_intent vinculado.
  // Este é um placeholder — ajustar conforme o fluxo real de cobrança.
  try {
    // Se houver um campo stripe_payment_intent_id na entidade, usar aqui:
    // const refundParams = new URLSearchParams({ payment_intent: data.stripe_payment_intent_id });
    // await stripeFetch(stripeSecret, "POST", "/refunds", refundParams);
    console.log(
      `[respond-assignment] Refund pendente: ${entityType}/${entityId}, valor: ${data[amountField]} centavos`
    );
  } catch (e) {
    console.error("[respond-assignment] Stripe refund error:", e);
  }
}
