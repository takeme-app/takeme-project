import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Sempre 4 dígitos (1000–9999). Usa CSPRNG para não depender de Math.random no Deno. */
function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = 1000 + (buf[0]! % 9000);
  return String(n);
}

type Purpose = "signup" | "password_reset";

function parsePurpose(raw: unknown): Purpose {
  if (raw === "password_reset") return "password_reset";
  return "signup";
}

type AuthUserLike = {
  id: string;
  email?: string | null;
  /** E-mail novo pendente de confirmação (coluna auth.users.email_change na API admin). */
  new_email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  identities?: Array<{ email?: string | null; identity_data?: Record<string, unknown> }>;
};

function metaEmail(meta: Record<string, unknown> | null | undefined): string | undefined {
  const e = meta?.email;
  return typeof e === "string" ? e : undefined;
}

/** E-mail em users.email, metadados (cadastro por telefone etc.) e identities (OAuth). */
function authUserMatchesEmailNorm(u: AuthUserLike, emailNorm: string): boolean {
  const set = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const t = (raw ?? "").trim().toLowerCase();
    if (t) set.add(t);
  };
  add(u.email ?? undefined);
  add(u.new_email ?? undefined);
  add(metaEmail(u.user_metadata ?? undefined));
  add(metaEmail(u.app_metadata ?? undefined));
  for (const id of u.identities ?? []) {
    if (typeof id.email === "string") add(id.email);
    const em = id.identity_data?.email;
    if (typeof em === "string") add(em);
  }
  return set.has(emailNorm);
}

/**
 * 1) RPC em SQL (auth.users + auth.identities) — rápido e não depende da ordem do listUsers.
 * 2) Fallback: paginar listUsers (útil se a migração ainda não rodou) e casar e-mail + identities.
 */
async function findAuthUserByEmailNorm(
  admin: ReturnType<typeof createClient>,
  emailNorm: string,
): Promise<{ id: string } | null> {
  try {
    const { data: rpcId, error: rpcErr } = await admin.rpc("lookup_auth_user_id_by_normalized_email", {
      p_email: emailNorm,
    });
    if (!rpcErr && rpcId != null && String(rpcId).length > 0) {
      return { id: String(rpcId) };
    }
    if (rpcErr) {
      console.warn("[send-email-verification-code] rpc lookup_auth_user_id_by_normalized_email", rpcErr);
    }

    const perPage = 1000;
    const maxPages = 500;
    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("[send-email-verification-code] listUsers", { page, error });
        return null;
      }
      const users = data?.users ?? [];
      const hit = users.find((u) => authUserMatchesEmailNorm(u as AuthUserLike, emailNorm));
      if (hit) return { id: hit.id };
      if (users.length < perPage) return null;
    }
    return null;
  } catch (e) {
    console.error("[send-email-verification-code] findAuthUserByEmailNorm exceção:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[send-email-verification-code] requisição recebida");
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Corpo JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { email, phone: phoneRaw, purpose: purposeRaw, checkEmailOnly: checkEmailOnlyRaw } = body as {
      email?: string;
      phone?: string;
      purpose?: string;
      /** Só verifica se o e-mail já existe no Auth (signup); não grava código nem envia e-mail. */
      checkEmailOnly?: boolean;
    };
    if (!email || typeof email !== "string") {
      console.error("[send-email-verification-code] email ausente ou inválido", { body });
      return new Response(
        JSON.stringify({ error: "E-mail é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[send-email-verification-code] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente");
      return new Response(
        JSON.stringify({
          error: "Configuração da função incompleta (secrets SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailNorm = email.trim().toLowerCase();
    const purpose = parsePurpose(purposeRaw);

    const existingUser = await findAuthUserByEmailNorm(supabase, emailNorm);

    if (checkEmailOnlyRaw === true) {
      if (purpose !== "signup") {
        return new Response(JSON.stringify({ error: "Solicitação inválida." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (existingUser) {
        return new Response(
          JSON.stringify({
            error: "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (purpose === "signup") {
      if (existingUser) {
        return new Response(
          JSON.stringify({
            error: "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      if (!existingUser) {
        return new Response(
          JSON.stringify({
            error: "Não encontramos uma conta com este e-mail. Verifique o endereço ou cadastre-se.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const phoneDigits =
      typeof phoneRaw === "string" ? phoneRaw.replace(/\D/g, "").trim() || null : null;
    if (purpose === "signup" && phoneDigits) {
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
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { error: delErr } = await supabase
      .from("email_verification_codes")
      .delete()
      .eq("email", emailNorm)
      .eq("purpose", purpose);
    if (delErr) {
      console.error("[send-email-verification-code] delete códigos anteriores:", delErr);
    }

    const code = generateCode();

    const insertRow: Record<string, unknown> = {
      email: emailNorm,
      code,
      purpose,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    if (purpose === "password_reset" && existingUser?.id) {
      insertRow.user_id = existingUser.id;
    }

    const { error: insertError } = await supabase.from("email_verification_codes").insert(insertRow as never);

    if (insertError) {
      console.error("[send-email-verification-code] insert error:", insertError);
      const rawMsg = `${insertError.message ?? ""} ${(insertError as { details?: string }).details ?? ""}`;
      const msg = rawMsg.toLowerCase();
      const isCodeLen =
        msg.includes("email_verification_codes_code_len") ||
        (msg.includes("violates check constraint") && msg.includes("code"));
      // Não usar só "purpose" + "column": violação NOT NULL vem como
      // `null value in column "purpose"...` e gerava falso "aplique migrações".
      const isMissingPurposeColumn =
        (msg.includes("does not exist") && msg.includes("purpose")) ||
        (msg.includes("could not find") && msg.includes("purpose") && msg.includes("email_verification_codes"));
      const isRlsBlock =
        msg.includes("row-level security") ||
        msg.includes("violates row-level security policy");
      const userMsg = isCodeLen
        ? "Banco de dados desatualizado: aplique a migração de códigos de 4 dígitos (email_verification_codes)."
        : isMissingPurposeColumn
        ? "Banco de dados desatualizado: aplique as migrações de email_verification_codes (coluna purpose)."
        : isRlsBlock
        ? "Não foi possível gravar o código (permissão no banco). Aplique a migração RLS de email_verification_codes para service_role ou verifique o papel da chave usada na função."
        : "Erro ao gerar código. Tente novamente.";
      return new Response(JSON.stringify({ error: userMsg }), {
        status: isCodeLen || isMissingPurposeColumn ? 503 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[send-email-verification-code] código salvo no banco para", emailNorm, purpose);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Take Me <onboarding@resend.dev>";
    console.log("[send-email-verification-code] RESEND_API_KEY definida:", !!resendKey, "| FROM:", fromEmail);

    const subject =
      purpose === "password_reset"
        ? "Seu código para redefinir a senha - Take Me"
        : "Seu código de confirmação - Take Me";
    const html =
      purpose === "password_reset"
        ? `<p>Use este código de 4 dígitos para redefinir sua senha no app Take Me:</p><p style="font-size:24px;font-weight:bold;letter-spacing:0.15em;">${code}</p><p>Válido por 10 minutos. Se você não solicitou, ignore este e-mail.</p>`
        : `<p>Seu código de confirmação (4 dígitos) é: <strong style="font-size:20px;letter-spacing:0.12em;">${code}</strong></p><p>Válido por 10 minutos.</p>`;
    const text =
      purpose === "password_reset"
        ? `Take Me — redefinição de senha\n\nSeu código de 4 dígitos: ${code}\n\nVálido por 10 minutos. Se você não solicitou, ignore este e-mail.`
        : `Take Me — confirmação de e-mail\n\nSeu código de 4 dígitos: ${code}\n\nVálido por 10 minutos.`;

    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [emailNorm],
            subject,
            html,
            text,
          }),
        });
        const resBody = await res.text();
        console.log("[send-email-verification-code] Resend response status:", res.status, "body:", resBody);
        if (!res.ok) {
          console.error("[send-email-verification-code] Resend error:", res.status, resBody);
          return new Response(
            JSON.stringify({ error: "Falha ao enviar e-mail. Tente novamente." }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (resendErr) {
        console.error("[send-email-verification-code] Resend fetch exceção:", resendErr);
        return new Response(
          JSON.stringify({ error: "Falha ao contatar o provedor de e-mail. Tente novamente." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      console.log("[send-email-verification-code] Código (dev, e-mail NÃO enviado):", code, "para", email);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[send-email-verification-code] exceção:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
