import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-auth-token, x-client-info, apikey, content-type",
};

/**
 * URLs aceitas pelo Stripe em Account Links (não aceita deep links tipo takeme://).
 * Em modo teste, http:// é permitido pela Stripe; em live, só https://.
 * @see https://docs.stripe.com/connect/express-accounts
 */
function isStripeRedirectUrlOk(u: string, live: boolean): boolean {
  try {
    const p = new URL(u);
    if (p.protocol === "https:") return true;
    if (!live && p.protocol === "http:") return true;
    return false;
  } catch {
    return false;
  }
}

function firstStripeValidUrl(candidates: (string | undefined)[], live: boolean): string | null {
  for (const c of candidates) {
    const s = c?.trim();
    if (s && isStripeRedirectUrlOk(s, live)) return s;
  }
  return null;
}

/** Fallback só para a API aceitar (mesmo padrão dos exemplos Stripe); produção deve usar secrets HTTPS reais. */
const DEFAULT_RETURN_URL = "https://example.com/stripe-connect-return";
const DEFAULT_REFRESH_URL = "https://example.com/stripe-connect-refresh";

type ResolvedConnectUrls = { returnUrl: string; refreshUrl: string };

function resolveStripeConnectUrls(
  body: { return_url?: string; refresh_url?: string },
  stripeSecret: string,
): ResolvedConnectUrls {
  const live = stripeSecret.startsWith("sk_live_");
  const envReturn = Deno.env.get("STRIPE_CONNECT_RETURN_URL")?.trim();
  const envRefresh = Deno.env.get("STRIPE_CONNECT_REFRESH_URL")?.trim();

  const returnUrl = firstStripeValidUrl(
    [body.return_url, envReturn, DEFAULT_RETURN_URL],
    live,
  ) ?? DEFAULT_RETURN_URL;

  const refreshUrl = firstStripeValidUrl(
    [body.refresh_url, envRefresh, envReturn, returnUrl, DEFAULT_REFRESH_URL],
    live,
  ) ?? returnUrl;

  return { returnUrl, refreshUrl };
}

/** Stripe às vezes só aceita `account_onboarding` (ex.: conta ainda não elegível a `account_update`). */
function shouldRetryAccountLinkAsOnboarding(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (!msg.includes("account_update")) return false;
  return msg.includes("account_onboarding") || msg.includes("Valid types");
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
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    const userId = user?.id;
    if (userError || !userId) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      return_url?: string;
      refresh_url?: string;
      link_type?: "onboarding" | "update";
      /** Abre o Express Dashboard da conta conectada (pendências, repasses) — não é Account Link. */
      flow?: "account_link" | "express_login";
    };

    const { returnUrl, refreshUrl } = resolveStripeConnectUrls(body, stripeSecret);
    const live = stripeSecret.startsWith("sk_live_");
    const br = body.return_url?.trim();
    const bf = body.refresh_url?.trim();
    if ((br && !isStripeRedirectUrlOk(br, live)) || (bf && !isStripeRedirectUrlOk(bf, live))) {
      console.info(
        "stripe-connect-link: return/refresh do app não são aceitos pela Stripe (ex.: takeme://); usando",
        returnUrl,
        refreshUrl,
      );
    }

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

    if (body.flow === "express_login") {
      if (!accountId) {
        return new Response(
          JSON.stringify({ error: "Conta Stripe ainda não criada. Use primeiro o cadastro na Stripe." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      return new Response(
        JSON.stringify({
          url: loginLink.url,
          stripe_connect_account_id: accountId,
          flow: "express_login",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const linkType = body.link_type === "update" ? "account_update" : "account_onboarding";

    if (!accountId) {
      if (linkType === "account_update") {
        return new Response(
          JSON.stringify({ error: "Conta Stripe Connect ainda não foi criada — inicie o onboarding primeiro." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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

    let effectiveType: "account_onboarding" | "account_update" = linkType;
    let link: Awaited<ReturnType<typeof stripe.accountLinks.create>>;
    try {
      link = await stripe.accountLinks.create({
        account: accountId,
        type: effectiveType,
        return_url: returnUrl,
        refresh_url: refreshUrl,
      });
    } catch (firstErr) {
      if (linkType === "account_update" && shouldRetryAccountLinkAsOnboarding(firstErr)) {
        console.info(
          "stripe-connect-link: account_update recusado pela Stripe, repetindo com account_onboarding",
          accountId,
        );
        effectiveType = "account_onboarding";
        link = await stripe.accountLinks.create({
          account: accountId,
          type: "account_onboarding",
          return_url: returnUrl,
          refresh_url: refreshUrl,
        });
      } else {
        throw firstErr;
      }
    }

    return new Response(
      JSON.stringify({
        url: link.url,
        stripe_connect_account_id: accountId,
        account_link_type: effectiveType,
      }),
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
