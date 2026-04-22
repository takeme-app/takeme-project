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

function isAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user?.app_metadata?.role === "admin";
}

/**
 * process-refund — estorno Stripe (admin JWT ou service_role para cron).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("x-auth-token");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : (authHeader ?? "").trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser(token);
      if (userError || !user || !isAdmin(user)) {
        return new Response(
          JSON.stringify({ error: "Acesso restrito a administradores ou chamadas internas" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
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

    const refundAmount =
      amount_cents && amount_cents > 0
        ? Math.min(amount_cents, entityAmount)
        : entityAmount;

    const paymentIntentId = entity.stripe_payment_intent_id as string | null;

    if (!paymentIntentId) {
      console.warn(
        `[process-refund] ${entity_type}/${entity_id}: stripe_payment_intent_id não encontrado.`
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

    // Reverter transfers explicitos ANTES do refund.
    //
    // Contexto: payouts de shipment/excursion_request usam stripe.transfers.create
    // explicito no process-payouts. Quando ja estao 'paid', o dinheiro saiu da
    // plataforma e foi para o Connect account. Se apenas chamarmos /refunds no
    // PI, a plataforma reembolsa o cliente mas fica sem saldo (Stripe debita da
    // conta platform). Precisamos reverter esses transfers primeiro para trazer
    // o dinheiro de volta a plataforma.
    //
    // Payouts 'pending'/'processing' ja sao cancelados na query mais abaixo —
    // como o dinheiro ainda esta na plataforma, nao precisa reversal.
    //
    // Nao aplica a booking (transfer_data no ato + comportamento default do
    // Stripe reembolsa proporcionalmente do destination quando o PI tem
    // transfer_data).
    const reversalRatio = refundAmount / entityAmount;
    const reversalResults: Array<{
      payout_id: string;
      transfer_id: string;
      reversal_id: string | null;
      reverse_amount_cents: number;
      error?: string;
    }> = [];

    if (
      entity_type === "shipment" ||
      entity_type === "dependent_shipment" ||
      entity_type === "excursion"
    ) {
      const { data: paidPayouts } = await admin
        .from("payouts")
        .select("id, stripe_transfer_id, worker_amount_cents")
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .eq("status", "paid")
        .not("stripe_transfer_id", "is", null);

      for (const pp of paidPayouts ?? []) {
        const transferId = pp.stripe_transfer_id as string | null;
        const workerAmount = Number(pp.worker_amount_cents) || 0;
        if (!transferId || workerAmount <= 0) continue;

        // Reversal proporcional para refund parcial; integral para full refund.
        const reverseAmount = Math.min(
          workerAmount,
          Math.max(1, Math.floor(workerAmount * reversalRatio)),
        );

        const reversalParams = new URLSearchParams({
          amount: String(reverseAmount),
          "metadata[entity_type]": entity_type,
          "metadata[entity_id]": entity_id,
          "metadata[payout_id]": String(pp.id),
          "metadata[reason]": "refund_chain",
        });

        try {
          const reversal = (await stripeFetch(
            stripeSecret,
            "POST",
            `/transfers/${transferId}/reversals`,
            reversalParams,
          )) as { id: string };
          reversalResults.push({
            payout_id: String(pp.id),
            transfer_id: transferId,
            reversal_id: reversal.id,
            reverse_amount_cents: reverseAmount,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(
            `[process-refund] reversal falhou payout=${pp.id} transfer=${transferId}:`,
            msg,
          );
          reversalResults.push({
            payout_id: String(pp.id),
            transfer_id: transferId,
            reversal_id: null,
            reverse_amount_cents: reverseAmount,
            error: msg,
          });
          // Abort refund — sem reversal o saldo nao volta pra plataforma.
          return new Response(
            JSON.stringify({
              error: `Falha ao reverter transfer ${transferId} antes do refund: ${msg}`,
              reversal_results: reversalResults,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

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

    const cancelStatus = "cancelled";
    const now = new Date().toISOString();
    const updatePayload: Record<string, string> = {
      status: cancelStatus,
      updated_at: now,
    };
    await admin.from(table).update(updatePayload as never).eq("id", entity_id);

    // Cancelar payout associado (se existir)
    const { error: payoutCancelErr } = await admin
      .from("payouts")
      .update({
        status: "cancelled",
        cancelled_reason: "refund",
        updated_at: now,
      } as never)
      .eq("entity_type", entity_type)
      .eq("entity_id", entity_id)
      .in("status", ["pending", "processing"]);
    if (payoutCancelErr) {
      console.error("[process-refund] payout cancel:", payoutCancelErr);
    }

    const userId = entity.user_id as string | null | undefined;
    if (userId) {
      await admin.from("notifications").insert({
        user_id: userId,
        title: "Estorno processado",
        message: `O valor de R$ ${(refundAmount / 100).toFixed(2).replace(".", ",")} será devolvido ao seu método de pagamento.`,
        category: entity_type,
      } as never);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        refund_id: refundResult.id,
        refund_status: refundResult.status,
        refund_amount_cents: refundResult.amount,
        reversal_results: reversalResults.length ? reversalResults : undefined,
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
