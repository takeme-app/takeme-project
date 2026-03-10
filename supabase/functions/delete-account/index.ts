import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_API = "https://api.stripe.com/v1";

/** Buckets com dados por user_id (prefixo = user_id/). */
const USER_BUCKETS = [
  "avatars",
  "dependent-documents",
  "shipment-photos",
  "excursion-passenger-docs",
];

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
      ...(body && method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
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

/** Lista recursivamente todos os caminhos de arquivos sob um prefixo no bucket. */
async function listAllObjectPaths(
  admin: ReturnType<typeof createClient>,
  bucketId: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data: items, error } = await admin.storage
      .from(bucketId)
      .list(prefix, { limit, offset });
    if (error) {
      console.warn(`delete-account list ${bucketId}/${prefix}:`, error.message);
      break;
    }
    if (!Array.isArray(items) || items.length === 0) break;
    for (const item of items) {
      const name = item?.name;
      if (!name) continue;
      const itemPath = prefix ? `${prefix}/${name}` : name;
      if (item.id != null) {
        paths.push(itemPath);
      } else {
        const nested = await listAllObjectPaths(admin, bucketId, itemPath);
        paths.push(...nested);
      }
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return paths;
}

/** Timeout em ms para a limpeza de storage (evita timeout da função). */
const STORAGE_CLEANUP_TIMEOUT_MS = 15_000;

/** Remove todos os objetos do usuário nos buckets (com timeout para não travar a resposta). */
async function deleteUserStorageObjects(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<void> {
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error("storage_cleanup_timeout")), STORAGE_CLEANUP_TIMEOUT_MS)
  );
  const work = (async () => {
    const prefix = userId;
    for (const bucketId of USER_BUCKETS) {
      try {
        const paths = await listAllObjectPaths(admin, bucketId, prefix);
        const batchSize = 500;
        for (let i = 0; i < paths.length; i += batchSize) {
          const batch = paths.slice(i, i + batchSize);
          const { error } = await admin.storage.from(bucketId).remove(batch);
          if (error) console.warn(`delete-account storage remove ${bucketId}:`, error.message);
        }
      } catch (e) {
        console.warn(`delete-account storage ${bucketId}:`, e);
      }
    }
  })();
  await Promise.race([work, timeout]).catch((e) => {
    if (e?.message === "storage_cleanup_timeout") {
      console.warn("delete-account storage: timeout, prosseguindo com exclusão do usuário");
    } else {
      throw e;
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("delete-account: missing env SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== "EXCLUIR") {
      return new Response(
        JSON.stringify({ error: "Confirmação inválida. Digite EXCLUIR para confirmar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1) Ler stripe_customer_id antes de qualquer exclusão
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    const stripeCustomerId = profile?.stripe_customer_id as string | null | undefined;

    // 2) Apagar objetos do usuário nos buckets (não falha a exclusão se der erro)
    try {
      await deleteUserStorageObjects(admin, user.id);
    } catch (storageErr) {
      console.warn("delete-account storage:", storageErr);
    }

    // 3) Apagar customer no Stripe (se existir)
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeCustomerId?.startsWith("cus_") && stripeSecret) {
      try {
        await stripeFetch(stripeSecret, "DELETE", `/customers/${stripeCustomerId}`);
      } catch (e) {
        console.warn("delete-account Stripe customer delete:", e);
        // Não falha a exclusão da conta se o Stripe falhar (customer pode já ter sido removido)
      }
    }

    // 4) Excluir usuário no Auth (cascade remove profiles, dependents, etc.)
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      const msg = deleteError?.message ?? "Não foi possível excluir a conta.";
      console.error("delete-account deleteUser:", deleteError);
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
