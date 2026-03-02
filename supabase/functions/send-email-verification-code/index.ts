import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[send-email-verification-code] requisição recebida");
  try {
    const body = await req.json();
    const { email, phone: phoneRaw } = body as { email?: string; phone?: string };
    if (!email || typeof email !== "string") {
      console.error("[send-email-verification-code] email ausente ou inválido", { body });
      return new Response(
        JSON.stringify({ error: "email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const emailNorm = email.trim().toLowerCase();

    const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailExists = (listData?.users ?? []).some(
      (u) => (u.email ?? "").toLowerCase() === emailNorm
    );
    if (emailExists) {
      return new Response(
        JSON.stringify({
          error: "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneDigits =
      typeof phoneRaw === "string" ? phoneRaw.replace(/\D/g, "").trim() || null : null;
    if (phoneDigits) {
      const { data: existingPhone } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", phoneDigits)
        .limit(1)
        .maybeSingle();
      if (existingPhone) {
        return new Response(
          JSON.stringify({
            error:
              "Este telefone já está em uso. Use outro número ou faça login na conta existente.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const code = generateCode();

    const { error: insertError } = await supabase.from("email_verification_codes").insert({
      email: emailNorm,
      code,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      console.error("[send-email-verification-code] insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar código" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[send-email-verification-code] código salvo no banco para", emailNorm);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Take Me <onboarding@resend.dev>";
    console.log("[send-email-verification-code] RESEND_API_KEY definida:", !!resendKey, "| FROM:", fromEmail);

    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [emailNorm],
          subject: "Seu código de confirmação - Take Me",
          html: `<p>Seu código de confirmação é: <strong>${code}</strong></p><p>Válido por 10 minutos.</p>`,
        }),
      });
      const resBody = await res.text();
      console.log("[send-email-verification-code] Resend response status:", res.status, "body:", resBody);
      if (!res.ok) {
        console.error("[send-email-verification-code] Resend error:", res.status, resBody);
        return new Response(
          JSON.stringify({ error: "Falha ao enviar e-mail. Tente novamente." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.log("[send-email-verification-code] Código (dev, e-mail NÃO enviado):", code, "para", email);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-email-verification-code] exceção:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
