import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function isAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user?.app_metadata?.role === "admin";
}

/**
 * Schema esperado do budget_lines:
 * {
 *   team: [{ role, name, worker_id?, value_cents }],
 *   basic_items: [{ name, quantity, value_cents }],
 *   additional_services: [{ name, quantity, value_cents }],
 *   recreation_items: [{ name, quantity, value_cents }],
 *   discount: { type: "percentage"|"fixed", value: number } | null,
 *   total_cents: number
 * }
 */
type BudgetLines = {
  team?: Array<{
    role: string;
    name: string;
    worker_id?: string;
    value_cents: number;
  }>;
  basic_items?: Array<{
    name: string;
    quantity: number;
    value_cents: number;
  }>;
  additional_services?: Array<{
    name: string;
    quantity: number;
    value_cents: number;
  }>;
  recreation_items?: Array<{
    name: string;
    quantity: number;
    value_cents: number;
  }>;
  discount?: { type: "percentage" | "fixed"; value: number } | null;
  total_cents: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);
    if (userError || !user || !isAdmin(user)) {
      return new Response(
        JSON.stringify({ error: "Acesso restrito a administradores" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => ({}))) as {
      excursion_id?: string;
      action?: string; // "save_draft" | "finalize"
      budget_lines?: BudgetLines;
      total_amount_cents?: number;
      driver_id?: string;
      preparer_id?: string;
    };

    const { excursion_id, action, budget_lines, total_amount_cents, driver_id, preparer_id } =
      body;

    if (!excursion_id || typeof excursion_id !== "string") {
      return new Response(
        JSON.stringify({ error: "excursion_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action !== "save_draft" && action !== "finalize") {
      return new Response(
        JSON.stringify({
          error: "action deve ser 'save_draft' ou 'finalize'",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar excursão
    const { data: excursion, error: excErr } = await admin
      .from("excursion_requests")
      .select("id, user_id, status")
      .eq("id", excursion_id)
      .single();

    if (excErr || !excursion) {
      return new Response(
        JSON.stringify({ error: "Excursão não encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!budget_lines || typeof budget_lines !== "object") {
      return new Response(
        JSON.stringify({ error: "budget_lines é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const totalCents =
      total_amount_cents ?? budget_lines.total_cents ?? 0;

    const nowIso = new Date().toISOString();

    const updates: Record<string, unknown> = {
      budget_lines,
      total_amount_cents: totalCents,
      budget_created_by: user.id,
      budget_created_at: nowIso,
      updated_at: nowIso,
    };

    // Vincular motorista e preparador se informados
    if (driver_id) updates.driver_id = driver_id;
    if (preparer_id) updates.preparer_id = preparer_id;

    if (action === "finalize") {
      // Finalizar = mudar status para "quoted" e notificar cliente
      updates.status = "quoted";
    }
    // save_draft = só salva sem mudar status

    const { error: updateErr } = await admin
      .from("excursion_requests")
      .update(updates)
      .eq("id", excursion_id);

    if (updateErr) {
      console.error("[manage-excursion-budget] update:", updateErr);
      return new Response(
        JSON.stringify({
          error: "Erro ao salvar orçamento",
          details: updateErr.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Notificar cliente quando finalizado
    if (action === "finalize" && excursion.user_id) {
      await admin.from("notifications").insert({
        user_id: excursion.user_id,
        title: "Orçamento da excursão pronto",
        message: `O orçamento da sua excursão foi elaborado. Valor total: R$ ${(totalCents / 100).toFixed(2).replace(".", ",")}. Acesse o app para aceitar.`,
        category: "excursion",
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        action,
        total_amount_cents: totalCents,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[manage-excursion-budget] unhandled:", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno",
        details: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
