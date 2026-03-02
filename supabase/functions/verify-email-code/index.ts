import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWelcomeEmail(email: string, fullName: string | undefined): Promise<void> {
  const to = email.trim().toLowerCase();
  const name = typeof fullName === "string" && fullName.trim() ? fullName.trim() : "você";
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("[verify-email-code] RESEND_API_KEY não definida — e-mail de boas-vindas NÃO enviado. Destinatário:", to);
    return;
  }
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Take Me <onboarding@resend.dev>";
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #111827;">Bem-vindo(a) ao Take Me!</h2>
      <p style="color: #374151; line-height: 1.6;">Olá, ${name}!</p>
      <p style="color: #374151; line-height: 1.6;">Sua conta foi criada com sucesso. Agora você pode agendar viagens, envios e muito mais.</p>
      <p style="color: #374151; line-height: 1.6;">Qualquer dúvida, estamos à disposição.</p>
      <p style="color: #6B7280; margin-top: 32px;">Equipe Take Me</p>
    </div>
  `;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Bem-vindo(a) ao Take Me!",
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as {
      email?: string;
      code?: string;
      password?: string;
      fullName?: string;
      phone?: string;
    };
    const { email, code, password, fullName, phone } = body;
    if (!email || !code || typeof email !== "string" || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "email e code são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "password é obrigatório (mín. 6 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const codeTrim = code.replace(/\D/g, "").slice(0, 4);
    if (codeTrim.length !== 4) {
      return new Response(
        JSON.stringify({ error: "Código inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: row, error: selectError } = await admin
      .from("email_verification_codes")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .eq("code", codeTrim)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .single();

    if (selectError || !row) {
      return new Response(
        JSON.stringify({ error: "Código inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await admin.from("email_verification_codes").delete().eq("id", row.id);

    const phoneDigits = typeof phone === "string" ? phone.replace(/\D/g, "").trim() || null : null;
    if (phoneDigits) {
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("phone", phoneDigits)
        .limit(1)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({ error: "Este telefone já está em uso. Use outro número ou faça login na conta existente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName ?? null,
        phone: phoneDigits ?? null,
      },
    });

    if (createError) {
      const msg = createError.message ?? "";
      if (msg.includes("already") || msg.includes("already registered") || msg.includes("already exists")) {
        await sendWelcomeEmail(email, fullName);
        return new Response(
          JSON.stringify({ ok: true, already_exists: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: createError.message ?? "Erro ao criar conta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await sendWelcomeEmail(email, fullName);

    const newUserId = createData?.user?.id;
    if (newUserId) {
      await admin.from("notifications").insert({
        user_id: newUserId,
        title: "Conta criada",
        message: "Seu e-mail foi verificado e sua conta está ativa.",
        category: "account",
      });
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
