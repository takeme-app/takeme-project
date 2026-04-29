// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Token HMAC partilhado entre `verify-email-code` e `verify-phone-code` para o
 * fluxo de redefinição de senha. O `complete-password-reset` valida o mesmo
 * formato — `{payloadBase64Url}.{hexHmacSha256}` — e usa apenas `payload.sub`
 * para identificar o utilizador no `auth.admin.updateUserById`.
 */

const encoder = new TextEncoder();

export type PasswordResetPayload = {
  sub: string;
  /** Identificador legível (e-mail real, e-mail fake `{digits}@takeme.com` ou telefone). */
  identifier: string;
  exp: number;
  typ: "pwd_reset";
};

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const arr = new Uint8Array(sig);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolve o segredo HMAC em ordem de preferência. Aceita variáveis legacy
 * (DRIVER_DEFERRED_SIGNUP_SECRET, SUPABASE_JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY)
 * para não exigir migração de secrets já configurados em prod.
 */
export function getPasswordResetSecret(): string {
  const a = Deno.env.get("PASSWORD_RESET_TOKEN_SECRET");
  if (a && a.trim().length >= 16) return a.trim();
  const b = Deno.env.get("DRIVER_DEFERRED_SIGNUP_SECRET");
  if (b && b.trim().length >= 16) return b.trim();
  const c = Deno.env.get("SUPABASE_JWT_SECRET");
  if (c && c.trim().length >= 16) return c.trim();
  const d = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (d && d.trim().length >= 32) return d.trim().slice(0, 64);
  throw new Error(
    "Defina PASSWORD_RESET_TOKEN_SECRET ou SUPABASE_JWT_SECRET (mínimo 16 caracteres)",
  );
}

/** Gera token de 15 minutos. `identifier` é só ilustrativo (logs/debug). */
export async function createPasswordResetToken(
  userId: string,
  identifier: string,
): Promise<string> {
  const secret = getPasswordResetSecret();
  const exp = Math.floor(Date.now() / 1000) + 15 * 60;
  const payload: PasswordResetPayload = {
    sub: userId,
    identifier,
    exp,
    typ: "pwd_reset",
  };
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await hmacSha256Hex(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

/** Resolve `auth.users.id` a partir do telefone (`profiles.phone`). */
export async function findAuthUserIdByPhone(
  admin: ReturnType<typeof createClient>,
  phoneDigits: string,
): Promise<string | null> {
  const variants = new Set<string>([phoneDigits]);
  if (phoneDigits.startsWith("55") && phoneDigits.length > 12) {
    variants.add(phoneDigits.slice(2));
  }
  for (const candidate of variants) {
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", candidate)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[passwordResetToken] lookup phone profile error", error);
      continue;
    }
    if (data?.id) return data.id as string;
  }
  return null;
}
