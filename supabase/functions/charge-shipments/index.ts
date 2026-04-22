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

type Row = {
  id: string;
  user_id: string;
  amount_cents: number;
  status: string;
  payment_method: string;
  stripe_payment_intent_id: string | null;
};

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
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: "Stripe não configurado (STRIPE_SECRET_KEY)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const claims = claimsData?.claims as { sub?: string } | undefined;
    const userId = claims?.sub;
    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      shipment_id?: string;
      dependent_shipment_id?: string;
      payment_method_id?: string;
      stripe_payment_method_id?: string;
    };
    const shipmentId = body.shipment_id?.trim();
    const dependentId = body.dependent_shipment_id?.trim();
    const paymentMethodIdSupabase = body.payment_method_id?.trim();
    const stripePaymentMethodIdFromClient = body.stripe_payment_method_id?.trim();

    if ((!shipmentId && !dependentId) || (shipmentId && dependentId)) {
      return new Response(
        JSON.stringify({
          error: "Envie exatamente um de: shipment_id ou dependent_shipment_id, e o método de pagamento.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const table = shipmentId ? "shipments" : "dependent_shipments";
    const id = shipmentId ?? dependentId!;

    const { data: row, error: rowErr } = await admin
      .from(table)
      .select("id, user_id, amount_cents, status, payment_method, stripe_payment_intent_id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Envio não encontrado ou não pertence ao usuário" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const s = row as Row;
    if (s.stripe_payment_intent_id) {
      return new Response(JSON.stringify({ error: "Este envio já foi cobrado no Stripe" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["confirmed", "pending_review"].includes(s.status)) {
      return new Response(JSON.stringify({ error: "Status do envio não permite cobrança" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["credito", "debito", "pix"].includes(s.payment_method)) {
      return new Response(JSON.stringify({ error: "Cobrança Stripe só para cartão ou Pix no app" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("id", userId).single();
    const customerId = profile?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "Cliente Stripe não encontrado; adicione um método de pagamento primeiro" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountCents = Number(s.amount_cents);
    if (!Number.isInteger(amountCents) || amountCents < 1) {
      return new Response(JSON.stringify({ error: "Valor do envio inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaKey = shipmentId ? "shipment_id" : "dependent_shipment_id";

    // ── Pix (BR): só payment_method_types=pix — sem pm_ de cartão.
    if (s.payment_method === "pix") {
      if (paymentMethodIdSupabase || stripePaymentMethodIdFromClient) {
        return new Response(
          JSON.stringify({
            error:
              "Para Pix não envie payment_method_id nem stripe_payment_method_id; a cobrança usa o cliente Stripe.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const pixParams = new URLSearchParams({
        amount: String(amountCents),
        currency: "brl",
        customer: customerId,
        "payment_method_types[]": "pix",
        confirm: "true",
        [`metadata[${metaKey}]`]: id,
        "metadata[user_id]": userId,
      });
      const piPix = (await stripeFetch(stripeSecret, "POST", "/payment_intents", pixParams)) as {
        id?: string;
        status?: string;
        last_payment_error?: { message?: string };
        next_action?: {
          type?: string;
          pix_display_qr_code?: {
            image_url_png?: string;
            hosted_voucher_url?: string;
            data?: string;
          };
        };
      };
      if (piPix.status === "succeeded" || piPix.status === "requires_capture") {
        const { error: updateErrPix } = await admin
          .from(table)
          .update({ stripe_payment_intent_id: piPix.id ?? null } as never)
          .eq("id", id)
          .eq("user_id", userId);
        if (updateErrPix) {
          console.error("charge-shipments: update after Pix PI succeeded", updateErrPix);
          return new Response(
            JSON.stringify({ error: "Pagamento aprovado mas falha ao gravar envio; contate o suporte" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify(
            shipmentId ? { ok: true, shipment_id: id } : { ok: true, dependent_shipment_id: id },
          ),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (piPix.status === "requires_action" && piPix.next_action?.type === "pix_display_qr_code") {
        const qr = piPix.next_action.pix_display_qr_code;
        return new Response(
          JSON.stringify({
            ok: true,
            pix_requires_payment: true,
            payment_intent_id: piPix.id ?? null,
            image_url_png: qr?.image_url_png ?? null,
            hosted_voucher_url: qr?.hosted_voucher_url ?? null,
            pix_copy_paste: qr?.data ?? null,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errMsg = piPix.last_payment_error?.message ?? `Pix não disponível (status=${piPix.status ?? "?"})`;
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paymentMethodIdSupabase && !stripePaymentMethodIdFromClient) {
      return new Response(
        JSON.stringify({
          error: "Envie payment_method_id (cartão salvo) ou stripe_payment_method_id (pm_…).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        return new Response(JSON.stringify({ error: "Método de pagamento não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      stripePaymentMethodId = pmRow.provider_id as string;
    }

    const piParams = new URLSearchParams({
      amount: String(amountCents),
      currency: "brl",
      customer: customerId,
      "payment_method": stripePaymentMethodId,
      confirm: "true",
      "payment_method_types[0]": "card",
      [`metadata[${metaKey}]`]: id,
      "metadata[user_id]": userId,
    });

    const pi = (await stripeFetch(stripeSecret, "POST", "/payment_intents", piParams)) as {
      id?: string;
      status?: string;
      last_payment_error?: { message?: string };
    };
    if (pi.status === "requires_action") {
      return new Response(
        JSON.stringify({
          error:
            "Seu banco pediu uma confirmação extra neste cartão que não pode ser concluída neste fluxo. Tente outro cartão ou use Pix.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (pi.status !== "succeeded" && pi.status !== "requires_capture") {
      const errMsg = pi.last_payment_error?.message ?? "Pagamento não foi aprovado";
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateErr } = await admin
      .from(table)
      .update({
        stripe_payment_intent_id: pi.id ?? null,
      } as never)
      .eq("id", id)
      .eq("user_id", userId);

    if (updateErr) {
      console.error(
        "[charge-shipments] update after PI succeeded:",
        JSON.stringify({ message: updateErr.message, details: updateErr.details, hint: updateErr.hint, code: updateErr.code }),
      );
      const detail = updateErr.message?.trim() || "sem detalhe";
      return new Response(
        JSON.stringify({ error: `Pagamento aprovado mas falha ao gravar envio; contate o suporte. (detalhe: ${detail})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(
        shipmentId
          ? { ok: true, shipment_id: id }
          : { ok: true, dependent_shipment_id: id }
      ),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("charge-shipments:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao processar cobrança" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
