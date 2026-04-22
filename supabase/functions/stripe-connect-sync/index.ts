import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

/**
 * stripe-connect-sync
 *
 * Sincroniza as flags Stripe Connect do motorista logado no banco, consultando
 * `accounts.retrieve` direto na Stripe. Útil como plano B quando o webhook
 * `account.updated` está atrasado ou não está configurado.
 *
 * POST (JWT do motorista) -> { charges_enabled, payouts_enabled, details_submitted,
 *                              stripe_connect_account_id, requirements_due_count }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-auth-token, x-client-info, apikey, content-type",
};

// Deep link por subtype do motorista/preparador — precisa casar com rotas
// registradas no RootNavigator de cada fluxo do app motorista.
// takeme/partner -> Payments (tela default do motorista)
// shipments -> PagamentosEncomendas
// excursions -> PagamentosExcursoes
function routeForSubtype(subtype: string | null | undefined): string {
  if (subtype === "shipments") return "PagamentosEncomendas";
  if (subtype === "excursions") return "PagamentosExcursoes";
  return "Payments";
}

async function sendStripeApprovedEmail(toEmail: string, fullName: string | null): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("[stripe-connect-sync] RESEND_API_KEY ausente — e-mail não enviado:", toEmail);
    return;
  }
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Take Me <onboarding@resend.dev>";
  const name = fullName?.trim() || "motorista";
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #111827;">Recebimento automático liberado! 🎉</h2>
      <p style="color: #374151; line-height: 1.6;">Olá, ${name}!</p>
      <p style="color: #374151; line-height: 1.6;">A Stripe concluiu a análise do seu cadastro. A partir de agora, os valores das suas corridas e entregas são depositados <b>automaticamente via PIX</b> na sua conta.</p>
      <p style="color: #374151; line-height: 1.6;">Não precisa fazer mais nada — é só continuar operando normalmente no app.</p>
      <p style="color: #6B7280; margin-top: 32px;">Equipe Take Me</p>
    </div>
  `;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: "Seu recebimento automático Take Me está ativo",
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[stripe-connect-sync] Resend error:", err);
    }
  } catch (e) {
    console.error("[stripe-connect-sync] Resend exception:", e);
  }
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
    const authUserId = user?.id;
    if (userError || !authUserId) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body to detect admin-initiated sync of another worker.
    let targetWorkerId: string | null = null;
    try {
      const body = req.method === "POST" ? await req.json().catch(() => null) : null;
      const raw = body && typeof body === "object" ? (body as Record<string, unknown>).worker_id : null;
      if (typeof raw === "string" && raw.trim()) targetWorkerId = raw.trim();
    } catch {
      // ignore — no body = sync self.
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // If body requested a specific worker_id, verify the caller is admin
    // (worker_profiles.role='admin', gerenciado por manage-admin-users).
    let userId = authUserId;
    if (targetWorkerId && targetWorkerId !== authUserId) {
      const { data: callerWp } = await admin
        .from("worker_profiles")
        .select("role, subtype")
        .eq("id", authUserId)
        .maybeSingle();
      const callerRole = (callerWp as { role?: string } | null)?.role;
      if (callerRole !== "admin") {
        return new Response(JSON.stringify({ error: "Apenas admin pode sincronizar outro worker" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = targetWorkerId;
    }

    const { data: wp, error: wpErr } = await admin
      .from("worker_profiles")
      .select(
        "id, subtype, stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_notified_approved_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (wpErr || !wp) {
      return new Response(JSON.stringify({ error: "Perfil de motorista não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = (wp.stripe_connect_account_id as string | null | undefined)?.trim();
    if (!accountId) {
      return new Response(
        JSON.stringify({
          error: "Conta Stripe Connect não foi criada ainda. Abra a configuração para iniciar.",
          stripe_connect_account_id: null,
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          requirements_due_count: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeSecret);
    const account = await stripe.accounts.retrieve(accountId);

    const chargesEnabled = Boolean(account.charges_enabled);
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const detailsSubmitted = Boolean(account.details_submitted);
    const requirementsDue = [
      ...(account.requirements?.currently_due ?? []),
      ...(account.requirements?.past_due ?? []),
    ];

    const now = new Date().toISOString();
    await admin
      .from("worker_profiles")
      .update({
        stripe_connect_charges_enabled: chargesEnabled,
        stripe_connect_payouts_enabled: payoutsEnabled,
        stripe_connect_details_submitted: detailsSubmitted,
        updated_at: now,
      } as never)
      .eq("id", userId);

    // Transição false → true detectada via fallback (quando o webhook account.updated
    // não chegou). Dispara notificação + e-mail uma única vez.
    const wasApproved = Boolean(
      (wp as { stripe_connect_charges_enabled?: boolean }).stripe_connect_charges_enabled
    );
    const alreadyNotified = Boolean(
      (wp as { stripe_connect_notified_approved_at?: string | null }).stripe_connect_notified_approved_at
    );
    if (chargesEnabled && !wasApproved && !alreadyNotified) {
      const subtype = (wp as { subtype?: string | null }).subtype ?? null;
      const { error: pushErr } = await admin.from("notifications").insert({
        user_id: userId,
        title: "Recebimento automático liberado 🎉",
        message:
          "A Stripe concluiu a análise do seu cadastro. Seus pagamentos agora são depositados automaticamente via PIX.",
        category: "account_approved",
        target_app_slug: "motorista",
        data: { route: routeForSubtype(subtype) },
      } as never);
      if (pushErr) console.error("[stripe-connect-sync] falha ao inserir notification:", pushErr.message);

      try {
        const { data: userRes } = await admin.auth.admin.getUserById(userId);
        const email = userRes?.user?.email;
        const meta = (userRes?.user?.user_metadata ?? null) as
          | { full_name?: string; name?: string }
          | null;
        const fullName = meta?.full_name ?? meta?.name ?? null;
        if (email) await sendStripeApprovedEmail(email, fullName);
      } catch (e) {
        console.error("[stripe-connect-sync] falha ao buscar e-mail do motorista:", e);
      }

      await admin
        .from("worker_profiles")
        .update({ stripe_connect_notified_approved_at: now } as never)
        .eq("id", userId);
    }

    return new Response(
      JSON.stringify({
        stripe_connect_account_id: accountId,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        details_submitted: detailsSubmitted,
        requirements_due_count: requirementsDue.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("stripe-connect-sync:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Falha ao sincronizar com a Stripe" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
