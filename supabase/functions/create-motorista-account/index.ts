import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// --- Token HMAC (validação); tudo neste arquivo para colar no painel Supabase ---
const _encoder = new TextEncoder();

function _base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function _base64UrlDecodeToString(b64url: string): string {
  const pad = b64url.length % 4 === 0 ? "" : "=".repeat(4 - (b64url.length % 4));
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  return bin;
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

function _timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

type _DeferredDriverPayload = { email: string; exp: number };

async function verifyDeferredDriverToken(token: string, secret: string): Promise<_DeferredDriverPayload | null> {
  const trimmed = token.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = trimmed.slice(0, dot);
  const sigHex = trimmed.slice(dot + 1);
  if (!payloadB64 || !/^[0-9a-f]+$/i.test(sigHex)) return null;
  const expected = await _hmacSha256Hex(secret, payloadB64);
  if (!_timingSafeEqualHex(sigHex.toLowerCase(), expected.toLowerCase())) return null;
  let payload: _DeferredDriverPayload;
  try {
    const json = _base64UrlDecodeToString(payloadB64);
    payload = JSON.parse(json) as _DeferredDriverPayload;
  } catch {
    return null;
  }
  if (!payload.email || typeof payload.exp !== "number") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
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
  if (!resendKey) return;
  const from = Deno.env.get("RESEND_FROM_EMAIL") ?? "Take Me <onboarding@resend.dev>";
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #111827;">Bem-vindo(a) ao Take Me!</h2>
      <p style="color: #374151; line-height: 1.6;">Olá, ${name}!</p>
      <p style="color: #374151; line-height: 1.6;">Sua conta foi criada com sucesso.</p>
      <p style="color: #6B7280; margin-top: 32px;">Equipe Take Me</p>
    </div>
  `;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({ from, to: [to], subject: "Bem-vindo(a) ao Take Me!", html }),
  });
}

type RouteRow = {
  origin_address: string;
  destination_address: string;
  price_per_person_cents: number;
};

type VehicleRow = {
  year: number;
  model: string;
  plate: string;
  passenger_capacity: number;
};

type MotoristaPayload = {
  /** Vazio = fluxo app motorista sem OTP; informe `email` no corpo. */
  token?: string;
  email?: string | null;
  password: string;
  full_name?: string | null;
  phone?: string | null;
  /** App envia take_me | parceiro; aliases takeme | partner aceitos. */
  driver_type: "take_me" | "parceiro" | "takeme" | "partner";
  cpf?: string | null;
  age?: number | null;
  city?: string | null;
  preference_area?: string | null;
  owns_vehicle?: boolean | null;
  years_of_experience?: number | null;
  bank_code?: string | null;
  agency_number?: string | null;
  account_number?: string | null;
  pix_key?: string | null;
  vehicle?: VehicleRow | null;
  routes?: RouteRow[] | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body: MotoristaPayload;
    try {
      body = (await req.json()) as MotoristaPayload;
    } catch {
      return new Response(JSON.stringify({ error: "JSON do corpo inválido ou vazio." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { token, password, full_name, phone, driver_type, email: emailFromPayload, ...rest } = body;
    const tokenStr = typeof token === "string" ? token.trim() : "";
    const emailDirect =
      typeof emailFromPayload === "string" ? emailFromPayload.trim().toLowerCase() : "";
    if (!password || typeof password !== "string" || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Senha é obrigatória (mínimo 6 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let workerSubtype: "take_me" | "parceiro";
    if (driver_type === "take_me" || driver_type === "takeme") {
      workerSubtype = "take_me";
    } else if (driver_type === "parceiro" || driver_type === "partner") {
      workerSubtype = "parceiro";
    } else {
      return new Response(
        JSON.stringify({ error: "Tipo de motorista inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cpfDigits = typeof rest.cpf === "string" ? rest.cpf.replace(/\D/g, "").trim() : "";
    if (!cpfDigits) {
      return new Response(
        JSON.stringify({ error: "CPF é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const routes = Array.isArray(rest.routes) ? rest.routes : [];
    const validRoutes = routes.filter(
      (r) =>
        typeof r?.origin_address === "string" &&
        r.origin_address.trim().length > 0 &&
        typeof r?.destination_address === "string" &&
        r.destination_address.trim().length > 0 &&
        typeof r?.price_per_person_cents === "number" &&
        r.price_per_person_cents > 0
    );
    if (validRoutes.length === 0) {
      return new Response(
        JSON.stringify({ error: "Informe ao menos uma rota com origem, destino e valor por passageiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ownsVehicle = rest.owns_vehicle === true;
    if (ownsVehicle) {
      const v = rest.vehicle;
      const yearNum = typeof v?.year === "number" ? v.year : parseInt(String(v?.year ?? ""), 10);
      const capNum =
        typeof v?.passenger_capacity === "number"
          ? v.passenger_capacity
          : parseInt(String(v?.passenger_capacity ?? ""), 10);
      if (
        !v ||
        !Number.isFinite(yearNum) ||
        !v.model?.trim() ||
        !v.plate?.trim() ||
        !Number.isFinite(capNum) ||
        capNum < 1
      ) {
        return new Response(
          JSON.stringify({ error: "Dados do veículo incompletos (ano, modelo, placa e capacidade)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      (rest as { vehicle?: VehicleRow }).vehicle = {
        year: yearNum,
        model: v.model.trim(),
        plate: v.plate.trim(),
        passenger_capacity: capNum,
      };
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl?.trim() || !serviceRoleKey?.trim()) {
      console.error("[create-motorista-account] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente");
      return new Response(
        JSON.stringify({
          error: "Configuração da função incompleta (secrets SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);

    /** E-mail: token HMAC, pending UUID legado, ou corpo (motorista sem OTP). */
    let email: string;
    let legacyPendingId: string | null = null;
    let pendingMeta: { full_name: string | null; phone: string | null } | null = null;

    const emailLooksValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

    if (tokenStr.includes(".")) {
      let secret: string;
      try {
        secret = getDeferredDriverSecret();
      } catch (e) {
        console.error(e);
        return new Response(
          JSON.stringify({ error: "Configuração do servidor incompleta para validar o cadastro." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const payload = await verifyDeferredDriverToken(tokenStr, secret);
      if (!payload?.email) {
        return new Response(
          JSON.stringify({ error: "Token inválido ou expirado. Valide seu e-mail novamente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      email = payload.email;
    } else if (tokenStr.length > 0) {
      const { data: pending, error: pendingErr } = await admin
        .from("pending_registrations")
        .select("email, full_name, phone")
        .eq("id", tokenStr)
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .single();

      if (pendingErr || !pending) {
        return new Response(
          JSON.stringify({ error: "Token inválido ou expirado. Valide seu e-mail novamente." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      email = pending.email;
      legacyPendingId = tokenStr;
      pendingMeta = { full_name: pending.full_name ?? null, phone: pending.phone ?? null };
    } else {
      if (!emailDirect || !emailLooksValid(emailDirect)) {
        return new Response(
          JSON.stringify({
            error: "E-mail é obrigatório para concluir o cadastro (fluxo sem código de verificação).",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      email = emailDirect;
    }

    const phoneFromBody = typeof phone === "string" ? phone.replace(/\D/g, "").trim() || null : null;
    const fullName = full_name ?? pendingMeta?.full_name ?? null;
    const phoneDigits =
      phoneFromBody ??
      (pendingMeta?.phone ? String(pendingMeta.phone).replace(/\D/g, "").trim() || null : null);

    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phoneDigits,
      },
    });

    if (createError) {
      const msg = (createError.message ?? "").toLowerCase();
      const userError =
        msg.includes("already") || msg.includes("registered")
          ? "Este e-mail já está cadastrado. Faça login ou use outro e-mail."
          : "Erro ao criar conta. Tente novamente.";
      return new Response(
        JSON.stringify({ error: userError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = createData?.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      await sendWelcomeEmail(email, fullName ?? undefined);
    } catch (mailErr) {
      console.error("[create-motorista-account] sendWelcomeEmail", mailErr);
    }

    /**
     * CHECK em produção: subtype IN ('takeme','partner','shipments','excursions').
     * O app usa take_me | parceiro — converter aqui antes do INSERT.
     */
    const subtypeForDb = workerSubtype === "take_me" ? "takeme" : "partner";

    const { error: profileUpsertErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName,
        phone: phoneDigits,
        cpf: cpfDigits,
        city: rest.city ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (profileUpsertErr) {
      console.error("[create-motorista-account] profiles upsert", profileUpsertErr);
    }

    const nowIso = new Date().toISOString();
    const ageVal = rest.age;
    const ageForDb =
      ageVal === null || ageVal === undefined
        ? null
        : typeof ageVal === "number" && Number.isFinite(ageVal)
          ? Math.round(ageVal)
          : parseInt(String(ageVal), 10);
    const expYears = rest.years_of_experience;
    const expForDb =
      expYears === null || expYears === undefined
        ? null
        : typeof expYears === "number" && Number.isFinite(expYears)
          ? Math.round(expYears)
          : parseInt(String(expYears), 10);

    const { error: workerErr } = await admin.from("worker_profiles").insert({
      id: userId,
      role: "driver",
      subtype: subtypeForDb,
      status: "inactive",
      cpf: cpfDigits,
      age: ageForDb !== null && Number.isFinite(ageForDb) ? ageForDb : null,
      city: rest.city ?? null,
      experience_years: expForDb !== null && Number.isFinite(expForDb) ? expForDb : null,
      bank_code: rest.bank_code?.trim() || null,
      bank_agency: rest.agency_number?.trim() || null,
      bank_account: rest.account_number?.trim() || null,
      pix_key: rest.pix_key?.trim() || null,
      has_own_vehicle: ownsVehicle,
      preference_area: rest.preference_area?.trim() || null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (workerErr) {
      console.error("[create-motorista-account] worker_profiles", workerErr);
      const w = workerErr as { message?: string; code?: string; details?: string; hint?: string };
      return new Response(
        JSON.stringify({
          error: "Erro ao salvar perfil de motorista. Confira colunas da tabela worker_profiles e constraints (ex.: subtype).",
          details: [w.message, w.details, w.hint, w.code].filter(Boolean).join(" | ") || undefined,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (ownsVehicle && rest.vehicle) {
      const v = rest.vehicle;
      const { error: vehErr } = await admin.from("vehicles").insert({
        worker_id: userId,
        year: v.year,
        model: v.model.trim(),
        plate: v.plate.trim().toUpperCase().slice(0, 12),
        passenger_capacity: v.passenger_capacity,
        status: "pending",
        is_active: true,
      });
      if (vehErr) {
        console.error("[create-motorista-account] vehicles", vehErr);
        const ve = vehErr as { message?: string; code?: string; details?: string; hint?: string };
        return new Response(
          JSON.stringify({
            error: "Erro ao salvar veículo.",
            details: [ve.message, ve.details, ve.hint, ve.code].filter(Boolean).join(" | ") || undefined,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    for (const r of validRoutes) {
      const { error: routeErr } = await admin.from("worker_routes").insert({
        worker_id: userId,
        origin_address: r.origin_address.trim(),
        destination_address: r.destination_address.trim(),
        price_per_person_cents: Math.round(r.price_per_person_cents),
        is_active: true,
      });
      if (routeErr) {
        console.error("[create-motorista-account] worker_routes", routeErr);
        const re = routeErr as { message?: string; code?: string; details?: string; hint?: string };
        return new Response(
          JSON.stringify({
            error: "Erro ao salvar rotas.",
            details: [re.message, re.details, re.hint, re.code].filter(Boolean).join(" | ") || undefined,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (legacyPendingId) {
      await admin.from("pending_registrations").delete().eq("id", legacyPendingId);
    }

    if (createData?.user?.id) {
      const { error: notifErr } = await admin.from("notifications").insert({
        user_id: createData.user.id,
        title: "Conta criada",
        message: "Seu cadastro foi enviado. Verificaremos seus documentos em breve.",
        category: "account",
        target_app_slug: "motorista",
      });
      if (notifErr) console.error("[create-motorista-account] notifications", notifErr);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    let details: string;
    if (err instanceof Error) details = `${err.name}: ${err.message}`;
    else if (typeof err === "string") details = err;
    else {
      try {
        details = JSON.stringify(err);
      } catch {
        details = String(err);
      }
    }
    console.error("[create-motorista-account] unhandled", details, err);
    return new Response(
      JSON.stringify({
        error: "Erro interno na função.",
        details: details.slice(0, 800),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
