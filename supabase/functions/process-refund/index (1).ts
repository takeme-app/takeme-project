import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

function isAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user?.app_metadata?.role === "admin";
}

/**
 * process-refund
 *
 * Processa estorno integral ou parcial via Stripe.
 * Pode ser chamado pelo admin ou internamente (respond-assignment em caso de recusa).
 *
 * Body:
 *   entity_type: "booking" | "shipment" | "dependent_shipment" | "excursion"
 *   entity_id: uuid
 *   amount_cents?: number (se omitido = estorno integral)
 *   reason?: string
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);
    if (userError || !user || !isAdmin(user)) {
      return new Response(
        JSON.stringify({ error: "Acesso restrito a administradores" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      entity_type?: string;
      entity_id?: string;
      amount_cents?: number;
      reason?: string;
    };

    const { entity_type, entity_id, amount_cents, reason } = body;

    if (!entity_type || !entity_id) {
      return new Response(
        JSON.stringify({
          error: "entity_type e entity_id são obrigatórios",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determinar tabela e campo de valor
    let table: string;
    let amountField: string;
    switch (entity_type) {
      case "booking":
        table = "bookings";
        amountField = "amount_cents";
        break;
      case "shipment":
        table = "shipments";
        amountField = "amount_cents";
        break;
      case "dependent_shipment":
        table = "dependent_shipments";
        amountField = "amount_cents";
        break;
      case "excursion":
        table = "excursion_requests";
        amountField = "total_amount_cents";
        break;
      default:
        return new Response(
          JSON.stringify({ error: "entity_type inválido" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Buscar entidade
    const { data: entity, error: entityErr } = await admin
      .from(table)
      .select(`id, ${amountField}, user_id, payment_method_id, stripe_payment_intent_id`)
      .eq("id", entity_id)
      .maybeSingle();

    if (entityErr || !entity) {
      return new Response(
        JSON.stringify({ error: "Entidade não encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const entityAmount = entity[amountField] as number | null;
    if (!entityAmount || entityAmount <= 0) {
      return new Response(
        JSON.stringify({ error: "Entidade sem valor para estorno" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Valor do estorno: parcial ou integral
    const refundAmount = amount_cents && amount_cents > 0
      ? Math.min(amount_cents, entityAmount)
      : entityAmount;

    // Buscar payment_intent_id
    // Nota: o campo stripe_payment_intent_id precisa existir na tabela.
    // Se ainda não existir, este é um placeholder — o estorno só funciona com o PI salvo.
    const paymentIntentId = entity.stripe_payment_intent_id as string | null;

    if (!paymentIntentId) {
      console.warn(
        `[process-refund] ${entity_type}/${entity_id}: stripe_payment_intent_id não encontrado. Estorno não processado.`
      );
      return new Response(
        JSON.stringify({
          error: "payment_intent_id não encontrado. Estorno manual necessário.",
          refund_amount_cents: refundAmount,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Processar refund no Stripe
    const refundParams = new URLSearchParams({
      payment_intent: paymentIntentId,
      amount: String(refundAmount),
    });
    if (reason) {
      refundParams.set("reason", "requested_by_customer");
      refundParams.set("metadata[internal_reason]", reason.slice(0, 500));
    }

    const refundResult = (await stripeFetch(
      stripeSecret,
      "POST",
      "/refunds",
      refundParams
    )) as { id: string; status: string; amount: number };

    // Atualizar status da entidade para cancelado
    const cancelStatus = "cancelled";
    await admin
      .from(table)
      .update({
        status: cancelStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entity_id);

    // Notificar cliente
    if (entity.user_id) {
      await admin.from("notifications").insert({
        user_id: entity.user_id,
        title: "Estorno processado",
        message: `O valor de R$ ${(refundAmount / 100).toFixed(2).replace(".", ",")} será devolvido ao seu método de pagamento.`,
        category: entity_type,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        refund_id: refundResult.id,
        refund_status: refundResult.status,
        refund_amount_cents: refundResult.amount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[process-refund] unhandled:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro ao processar estorno",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
