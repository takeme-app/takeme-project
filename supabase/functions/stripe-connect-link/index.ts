import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-auth-token, x-client-info, apikey, content-type",
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
      return new Response(JSON.stringify({ error: "Stripe não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = (claimsData?.claims as { sub?: string } | undefined)?.sub;
    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      return_url?: string;
      refresh_url?: string;
    };
    const returnUrl =
      body.return_url?.trim() ||
      Deno.env.get("STRIPE_CONNECT_RETURN_URL") ||
      "https://example.com/stripe-connect-return";
    const refreshUrl =
      body.refresh_url?.trim() ||
      Deno.env.get("STRIPE_CONNECT_REFRESH_URL") ||
      returnUrl;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: wp, error: wpErr } = await admin
      .from("worker_profiles")
      .select("id, stripe_connect_account_id")
      .eq("id", userId)
      .maybeSingle();

    if (wpErr || !wp) {
      return new Response(
        JSON.stringify({ error: "Perfil de motorista/preparador não encontrado. Complete o cadastro no app." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecret);
    let accountId = (wp.stripe_connect_account_id as string | null | undefined)?.trim() ?? "";

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "BR",
        metadata: { worker_user_id: userId },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      await admin
        .from("worker_profiles")
        .update({ stripe_connect_account_id: accountId, updated_at: new Date().toISOString() } as never)
        .eq("id", userId);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });

    return new Response(
      JSON.stringify({ url: link.url, stripe_connect_account_id: accountId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("stripe-connect-link:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao gerar link Stripe" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
