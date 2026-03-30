import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-auth-token, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authHeader =
      req.headers.get("Authorization") ?? req.headers.get("x-auth-token");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : (authHeader ?? "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Apenas admins podem invocar
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData } = await userClient.auth.getClaims(token);
    const claims = claimsData?.claims as Record<string, unknown> | undefined;
    const role = (claims as any)?.app_metadata?.role;
    if (role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Acesso restrito a administradores" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Body ─────────────────────────────────────────────────────
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
      password?: string;
    };
    const email = body.email?.trim();
    const name = body.name?.trim();
    const password = body.password?.trim();

    if (!email || !name || !password) {
      return new Response(
        JSON.stringify({ error: "email, name e password são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Enviar email via Resend ──────────────────────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@takeme.com.br";

    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const htmlBody = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #F59E0B; font-size: 28px; margin: 0;">Take Me Admin</h1>
        </div>
        <p style="color: #0d0d0d; font-size: 16px; line-height: 1.6;">
          Olá <strong>${name}</strong>,
        </p>
        <p style="color: #545454; font-size: 14px; line-height: 1.6;">
          Você foi adicionado(a) como administrador(a) na plataforma Take Me. Seguem suas credenciais de acesso:
        </p>
        <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; color: #767676; font-size: 12px; text-transform: uppercase;">Email</p>
          <p style="margin: 0 0 16px; color: #0d0d0d; font-size: 16px; font-weight: 600;">${email}</p>
          <p style="margin: 0 0 8px; color: #767676; font-size: 12px; text-transform: uppercase;">Senha temporária</p>
          <p style="margin: 0; color: #0d0d0d; font-size: 16px; font-weight: 600; letter-spacing: 1px;">${password}</p>
        </div>
        <p style="color: #545454; font-size: 13px; line-height: 1.6;">
          Recomendamos que você altere sua senha no primeiro acesso em <strong>Configurações → Atualizar senha</strong>.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e2e2; margin: 24px 0;" />
        <p style="color: #999; font-size: 11px; text-align: center;">
          Take Me — Plataforma de mobilidade e logística
        </p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "Suas credenciais de acesso — Take Me Admin",
        html: htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text().catch(() => "");
      console.error("Resend error:", errBody);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar email de credenciais" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, sent_to: email }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("send-admin-credentials:", err);
    return new Response(
      JSON.stringify({
        error:
          err instanceof Error ? err.message : "Erro ao enviar credenciais",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
