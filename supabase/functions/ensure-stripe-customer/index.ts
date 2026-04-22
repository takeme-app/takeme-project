import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auth-token",
};

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeFetch(
  secretKey: string,
  method: string,
  path: string,
  body?: URLSearchParams
): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${STRIPE_API}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
  };
  if (body && method !== "GET") opts.body = body.toString();
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new Error(err);
  }
  return data;
}

function normalizeBrCpf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return null;
  return d;
}

/** Anexa CPF ao Customer Stripe (BR). Ignora erro de duplicata. */
async function ensureCustomerBrCpf(
  stripeSecret: string,
  customerId: string,
  cpfDigits: string
): Promise<void> {
  try {
    await stripeFetch(
      stripeSecret,
      "POST",
      `/customers/${encodeURIComponent(customerId)}/tax_ids`,
      new URLSearchParams({ type: "br_cpf", value: cpfDigits }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate|already been taken|resource_already_exists/i.test(msg)) return;
    console.warn("[ensure-stripe-customer] tax_id br_cpf:", msg);
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
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let bodyCpf: string | null = null;
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = (await req.json().catch(() => ({}))) as { cpf?: string; holder_cpf?: string };
        bodyCpf = normalizeBrCpf(j.cpf ?? j.holder_cpf);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado (STRIPE_SECRET_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
    let customerId = profile?.stripe_customer_id as string | null | undefined;

    if (customerId) {
      if (bodyCpf) await ensureCustomerBrCpf(stripeSecret, customerId, bodyCpf);
      return new Response(
        JSON.stringify({ ok: true, stripe_customer_id: customerId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const customerParams = new URLSearchParams();
    if (user.email) customerParams.set("email", user.email);
    const name = user.user_metadata?.full_name;
    if (typeof name === "string" && name.trim()) customerParams.set("name", name.trim());
    if (bodyCpf) {
      customerParams.set("tax_id_data[0][type]", "br_cpf");
      customerParams.set("tax_id_data[0][value]", bodyCpf);
    }
    const customerRes = await stripeFetch(stripeSecret, "POST", "/customers", customerParams) as { id: string };
    const newCustomerId = customerRes.id;

    await admin.from("profiles").update({
      stripe_customer_id: newCustomerId,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);

    return new Response(
      JSON.stringify({ ok: true, stripe_customer_id: newCustomerId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("ensure-stripe-customer:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro ao garantir Customer" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
