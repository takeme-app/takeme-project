import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// --- Token HMAC (motorista defer_create); tudo neste arquivo para colar no painel Supabase ---
const _encoder = new TextEncoder();

function _base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function _hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    _encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, _encoder.encode(message));
  const arr = new Uint8Array(sig);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type _DeferredDriverPayload = { email: string; exp: number };

async function signDeferredDriverToken(email: string, secret: string, ttlSeconds: number): Promise<string> {
  const norm = email.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: _DeferredDriverPayload = { email: norm, exp };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = _base64UrlEncode(_encoder.encode(payloadJson));
  const sig = await _hmacSha256Hex(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

function getDeferredDriverSecret(): string {
  const a = Deno.env.get("DRIVER_DEFERRED_SIGNUP_SECRET");
  if (a && a.trim().length >= 16) return a.trim();
  const b = Deno.env.get("SUPABASE_JWT_SECRET");
  if (b && b.trim().length >= 16) return b.trim();
  const c = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (c && c.trim().length >= 32) return c.trim().slice(0, 64);
  throw new Error("Defina DRIVER_DEFERRED_SIGNUP_SECRET ou SUPABASE_JWT_SECRET (mín. 16 caracteres)");
}
// --- fim token ---

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
      defer_create?: boolean | string | number;
    };
    const { email, code, password, fullName, phone, defer_create } = body;
    /** Aceita boolean ou string (alguns clientes serializam diferente). Motorista: só valida e-mail, sem criar auth. */
    const wantsDeferredDriverSignup =
      defer_create === true || defer_create === "true" || defer_create === 1;

    if (!email || !code || typeof email !== "string" || typeof code !== "string") {
      return new Response(
        JSON.stringify({ error: "E-mail e código são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!wantsDeferredDriverSignup && (!password || typeof password !== "string" || password.length < 6)) {
      return new Response(
        JSON.stringify({ error: "Senha é obrigatória (mínimo 6 caracteres)" }),
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

    const emailNorm = email.trim().toLowerCase();
    const nowIso = new Date().toISOString();

    const { data: row, error: selectError } = await admin
      .from("email_verification_codes")
      .select("id, code")
      .eq("email", emailNorm)
      .eq("code", codeTrim)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error("[verify-email-code] select codes", selectError);
      return new Response(
        JSON.stringify({ error: "Código inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /** Fallback se o banco ainda tiver char(4) com padding (linhas antigas): comparar dígitos. */
    let rowId = row?.id as string | undefined;
    if (!rowId) {
      const { data: candidates, error: listErr } = await admin
        .from("email_verification_codes")
        .select("id, code")
        .eq("email", emailNorm)
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(5);
      if (listErr) {
        console.error("[verify-email-code] list codes fallback", listErr);
      } else {
        const match = (candidates ?? []).find(
          (c: { id: string; code: string }) =>
            String(c.code ?? "")
              .replace(/\D/g, "")
              .slice(0, 4) === codeTrim
        );
        rowId = match?.id;
      }
    }

    if (!rowId) {
      return new Response(
        JSON.stringify({ error: "Código inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await admin.from("email_verification_codes").delete().eq("id", rowId);

    const phoneDigits = typeof phone === "string" ? phone.replace(/\D/g, "").trim() || null : null;

    console.log("[verify-email-code] deferred driver signup:", wantsDeferredDriverSignup);

    /** Motorista: não cria usuário em Auth aqui — só prova de e-mail (token HMAC para create-motorista-account). */
    if (wantsDeferredDriverSignup) {
      try {
        const secret = getDeferredDriverSecret();
        const signed = await signDeferredDriverToken(email, secret, 7 * 24 * 3600);
        return new Response(
          JSON.stringify({ ok: true, token: signed }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        console.error("[verify-email-code] deferred token", e);
        return new Response(
          JSON.stringify({
            error:
              "Configuração do servidor incompleta (segredo do token). Defina DRIVER_DEFERRED_SIGNUP_SECRET ou SUPABASE_JWT_SECRET.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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
      const msg = (createError.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("already registered") || msg.includes("already exists")) {
        /** Conta já existia — não enviar boas-vindas nem devolver 200 (evita app achar que há token motorista). */
        return new Response(
          JSON.stringify({
            error: "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userError =
        msg.includes("already") || msg.includes("registered")
          ? "Este e-mail já está cadastrado. Faça login ou use outro e-mail."
          : msg.includes("password") || msg.includes("senha")
            ? "Senha inválida. Use no mínimo 6 caracteres."
            : "Erro ao criar conta. Tente novamente.";
      return new Response(
        JSON.stringify({ error: userError }),
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
