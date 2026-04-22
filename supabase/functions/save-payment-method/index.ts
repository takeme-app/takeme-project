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
    const stripeSecretRaw = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeSecret = stripeSecretRaw?.trim() ?? "";
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado (STRIPE_SECRET_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (stripeSecret.startsWith("pk_")) {
      return new Response(
        JSON.stringify({
          error:
            "STRIPE_SECRET_KEY no projeto está com chave publicável (pk_…). Nas Edge Functions use a chave secreta da Stripe (sk_test_… / sk_live_… ou rk_…). Ajuste em Supabase → Project Settings → Edge Functions → Secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!stripeSecret.startsWith("sk_") && !stripeSecret.startsWith("rk_")) {
      return new Response(
        JSON.stringify({
          error:
            "STRIPE_SECRET_KEY inválida: deve começar com sk_ ou rk_ (chave secreta ou restrita da Stripe).",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: authUser }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !authUser) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = authUser.id;
    const userEmail = authUser.email ?? null;

    const body = (await req.json().catch(() => ({}))) as {
      payment_method_id?: string;
      type?: string;
      card?: { number?: string; exp_month?: number; exp_year?: number; cvc?: string };
      holder_name?: string;
    };
    const type = body.type === "debit" ? "debit" : "credit";
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await admin.from("profiles").select("stripe_customer_id, full_name").eq("id", userId).single();
    let customerId = profile?.stripe_customer_id as string | null | undefined;

    if (!customerId) {
      const customerParams = new URLSearchParams();
      if (userEmail) customerParams.set("email", userEmail);
      const name = (profile as { full_name?: string } | null)?.full_name;
      if (typeof name === "string" && name.trim()) customerParams.set("name", name.trim());
      const customerRes = await stripeFetch(stripeSecret, "POST", "/customers", customerParams) as { id: string };
      customerId = customerRes.id;
      await admin.from("profiles").update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
    }

    let paymentMethodId: string;

    if (body.payment_method_id?.trim()?.startsWith("pm_")) {
      paymentMethodId = body.payment_method_id.trim();
      await stripeFetch(stripeSecret, "POST", `/payment_methods/${paymentMethodId}/attach`, new URLSearchParams({
        customer: customerId,
      }));
    } else if (body.card?.number && body.card?.exp_month != null && body.card?.exp_year != null && body.card?.cvc != null) {
      const num = String(body.card.number).replace(/\D/g, "");
      if (num.length < 13) {
        return new Response(
          JSON.stringify({ error: "Número do cartão inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const expMonth = Number(body.card.exp_month);
      const expYear = Number(body.card.exp_year);
      if (expMonth < 1 || expMonth > 12) {
        return new Response(
          JSON.stringify({ error: "Mês de validade inválido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const year = expYear < 100 ? 2000 + expYear : expYear;
      const pmParams = new URLSearchParams({
        type: "card",
        "card[number]": num,
        "card[exp_month]": String(expMonth),
        "card[exp_year]": String(year),
        "card[cvc]": String(body.card.cvc).replace(/\D/g, "").slice(0, 4),
      });
      const holderNameParam = (typeof body.holder_name === "string" && body.holder_name.trim()) ? body.holder_name.trim() : null;
      if (holderNameParam) pmParams.set("billing_details[name]", holderNameParam);
      const createRes = await stripeFetch(stripeSecret, "POST", "/payment_methods", pmParams) as { id: string };
      paymentMethodId = createRes.id;
      await stripeFetch(stripeSecret, "POST", `/payment_methods/${paymentMethodId}/attach`, new URLSearchParams({
        customer: customerId,
      }));
    } else {
      return new Response(
        JSON.stringify({ error: "Envie payment_method_id ou card (number, exp_month, exp_year, cvc)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pm = await stripeFetch(stripeSecret, "GET", `/payment_methods/${paymentMethodId}`) as {
      card?: { last4?: string; brand?: string; exp_month?: number; exp_year?: number };
      billing_details?: { name?: string };
    };
    const card = pm?.card;
    const last4 = card?.last4 ?? null;
    const brand = card?.brand ?? null;
    const expiryMonth = card?.exp_month ?? null;
    const expiryYear = card?.exp_year ?? null;
    const holderName = (pm?.billing_details?.name?.trim()) || null;

    const { error: insertErr } = await admin.from("payment_methods").insert({
      user_id: userId,
      type,
      last_four: last4,
      brand,
      expiry_month: expiryMonth,
      expiry_year: expiryYear,
      holder_name: holderName,
      provider: "stripe",
      provider_id: paymentMethodId,
    });

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message ?? "Erro ao salvar cartão" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: notifErr } = await admin.from("notifications").insert({
      user_id: userId,
      title: "Cartão cadastrado",
      message: "Seu cartão foi adicionado com sucesso.",
      category: "payment",
      target_app_slug: "cliente",
    });
    if (notifErr) {
      console.warn("save-payment-method: notification insert (best-effort):", notifErr.message);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("save-payment-method:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao processar pagamento" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
