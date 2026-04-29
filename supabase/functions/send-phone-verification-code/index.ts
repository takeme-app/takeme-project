// TODO (onboarding telefone/WhatsApp):
// - Integrar com a Meta WhatsApp Cloud API quando as credenciais estiverem disponíveis
//   (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_TEMPLATE_NAME).
// - Enquanto não integrado, em ambiente de dev retornamos `dev_code` no payload para
//   permitir testar o fluxo ponta-a-ponta sem depender do provedor.
// - Em produção: apenas grava no banco e tenta enviar via WhatsApp; NUNCA devolver `dev_code`.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function normalizePhoneBR(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  // Aceita 10 (fixo) ou 11 (celular) dígitos com DDD. Não inclui +55 aqui porque o app
  // repassa apenas dígitos brasileiros.
  if (digits.length < 10 || digits.length > 13) return null;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[send-phone-verification-code] requisição recebida");
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

    const { phone, purpose: purposeRaw } = body as {
      phone?: string;
      purpose?: string;
    };

    const phoneDigits = normalizePhoneBR(phone);
    if (!phoneDigits) {
      return new Response(
        JSON.stringify({ error: "Telefone inválido. Informe DDD + número." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[send-phone-verification-code] SUPABASE_URL/SERVICE_ROLE_KEY ausente");
      return new Response(
        JSON.stringify({ error: "Configuração da função incompleta." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const purpose = parsePurpose(purposeRaw);

    /**
     * Para signup bloqueamos quando o telefone JÁ existe (evita duplicar conta).
     * Para password_reset bloqueamos quando o telefone NÃO existe — espelha o
     * comportamento do `send-email-verification-code` e dá UX clara ao utilizador.
     * Aceita variantes "55XXXXXXXXX" (com DDI) caindo de volta para os 11 dígitos.
     */
    const phoneVariants = new Set<string>([phoneDigits]);
    if (phoneDigits.startsWith("55") && phoneDigits.length > 12) {
      phoneVariants.add(phoneDigits.slice(2));
    }

    let existingPhoneId: string | null = null;
    for (const candidate of phoneVariants) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", candidate)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        existingPhoneId = data.id as string;
        break;
      }
    }

    if (purpose === "signup" && existingPhoneId) {
      return new Response(
        JSON.stringify({
          error: "Este telefone já está cadastrado. Faça login ou use outro número.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (purpose === "password_reset" && !existingPhoneId) {
      return new Response(
        JSON.stringify({
          error:
            "Não encontramos uma conta com este telefone. Verifique o número ou cadastre-se.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Limpa códigos anteriores para esse telefone/purpose.
    const { error: delErr } = await supabase
      .from("phone_verification_codes")
      .delete()
      .eq("phone", phoneDigits)
      .eq("purpose", purpose);
    if (delErr) {
      console.error("[send-phone-verification-code] delete códigos anteriores:", delErr);
    }

    const code = generateCode();

    const insertRow: Record<string, unknown> = {
      phone: phoneDigits,
      code,
      purpose,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    const { error: insertError } = await supabase
      .from("phone_verification_codes")
      .insert(insertRow as never);

    if (insertError) {
      console.error("[send-phone-verification-code] insert error:", insertError);
      const rawMsg = `${insertError.message ?? ""} ${(insertError as { details?: string }).details ?? ""}`;
      const msg = rawMsg.toLowerCase();
      const missingTable =
        msg.includes("could not find") && msg.includes("phone_verification_codes");
      const userMsg = missingTable
        ? "Banco de dados desatualizado: aplique a migração de phone_verification_codes."
        : "Erro ao gerar código. Tente novamente.";
      return new Response(JSON.stringify({ error: userMsg }), {
        status: missingTable ? 503 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Integração real com WhatsApp Cloud API — TODO. Por enquanto:
    //  - Em prod: devolvemos ok=true sem enviar.
    //  - Em dev (APP_ENV !== "prod"): devolvemos dev_code para o app conseguir testar.
    const appEnv = Deno.env.get("APP_ENV")?.trim() ?? "dev";
    const isProd = appEnv === "prod";
    console.log(
      "[send-phone-verification-code] código gerado para",
      phoneDigits,
      purpose,
      isProd ? "(prod: não retorna dev_code)" : "(dev: retorna dev_code)",
    );

    // Quando o envio real estiver ativo, substituir este log pela chamada ao endpoint da Meta:
    // await fetch("https://graph.facebook.com/v20.0/<PHONE_NUMBER_ID>/messages", {...});
    console.log("[send-phone-verification-code] STUB: WhatsApp ainda não integrado. Código:", code);

    const responseBody: Record<string, unknown> = { ok: true };
    if (!isProd) responseBody.dev_code = code;

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-phone-verification-code] exceção:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
