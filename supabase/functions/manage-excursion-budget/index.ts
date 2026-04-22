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
 *
 * role esperada para o preparador: 'preparer' ou 'preparador' (case-insensitive).
 */
type BudgetTeamLine = {
  role: string;
  name: string;
  worker_id?: string;
  value_cents: number;
};

type BudgetLines = {
  team?: BudgetTeamLine[];
  basic_items?: Array<{ name: string; quantity: number; value_cents: number }>;
  additional_services?: Array<{ name: string; quantity: number; value_cents: number }>;
  recreation_items?: Array<{ name: string; quantity: number; value_cents: number }>;
  discount?: { type: "percentage" | "fixed"; value: number } | null;
  total_cents: number;
};

// Deriva preparer_payout_cents a partir de budget_lines.team quando o body
// nao envia o valor explicitamente.
//
// Regras (em ordem de prioridade):
//   1) body.preparer_payout_cents numerico e >= 0
//   2) soma de team[].value_cents onde worker_id == preparer_id informado
//   3) soma de team[].value_cents onde role normalizada inclui "prepar"
//   4) 0 (fallback — admin precisa editar via coluna depois)
function derivePreparerPayoutCents(
  explicit: number | undefined,
  preparerId: string | null | undefined,
  team: BudgetTeamLine[] | undefined,
): number {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit >= 0) {
    return Math.floor(explicit);
  }
  if (!team?.length) return 0;

  if (preparerId) {
    const byId = team
      .filter((t) => t.worker_id === preparerId)
      .reduce((acc, t) => acc + (Number(t.value_cents) || 0), 0);
    if (byId > 0) return Math.floor(byId);
  }

  const byRole = team
    .filter((t) => typeof t.role === "string" && t.role.toLowerCase().includes("prepar"))
    .reduce((acc, t) => acc + (Number(t.value_cents) || 0), 0);
  return Math.floor(byRole);
}

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
      action?: string;
      budget_lines?: BudgetLines;
      total_amount_cents?: number;
      driver_id?: string;
      preparer_id?: string;
      preparer_payout_cents?: number;
    };

    const {
      excursion_id,
      action,
      budget_lines,
      total_amount_cents,
      driver_id,
      preparer_id,
      preparer_payout_cents,
    } = body;

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

    const { data: excursion, error: excErr } = await admin
      .from("excursion_requests")
      .select("id, user_id, status, preparer_id, worker_payout_cents")
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

    const effectivePreparerId =
      preparer_id ?? (excursion.preparer_id as string | null | undefined) ?? null;

    // Calcula a fatia do preparador. Fallback 0 evita quebrar o finalize quando
    // admin ainda nao discriminou o custo por funcao no budget_lines.
    const preparerPayout = derivePreparerPayoutCents(
      preparer_payout_cents,
      effectivePreparerId,
      budget_lines.team,
    );

    const updates: Record<string, unknown> = {
      budget_lines,
      total_amount_cents: totalCents,
      preparer_payout_cents: preparerPayout,
      budget_created_by: user.id,
      budget_created_at: nowIso,
      updated_at: nowIso,
    };

    if (driver_id) updates.driver_id = driver_id;
    if (preparer_id) updates.preparer_id = preparer_id;

    if (action === "finalize") {
      updates.status = "quoted";
    }

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
        preparer_payout_cents: preparerPayout,
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
