import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-auth-token, x-client-info, apikey, content-type",
};

/**
 * process-payouts — Processa payouts pendentes em lote.
 *
 * Aceita:
 * - service_role key (para cron/automação)
 * - JWT de admin (para execução manual via dashboard)
 *
 * Body (JSON, todos opcionais):
 * - payout_ids: string[]   → processar apenas estes payouts
 * - force: boolean         → ignorar threshold mínimo
 * - dry_run: boolean       → preview sem executar
 * - mark_paid: boolean     → marcar diretamente como paid (para confirmação manual pós-transferência)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // ── Auth: service_role key OR admin JWT ──
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  let isServiceRole = false;
  let performedBy: string | null = null;

  if (token === serviceRoleKey) {
    isServiceRole = true;
  } else {
    // Verificar se é JWT de admin
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const tempClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authErr } = await tempClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Verificar role admin
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: wp } = await admin
      .from("worker_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!wp || wp.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    performedBy = user.id;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // ── Parse body ──
  let body: {
    payout_ids?: string[];
    force?: boolean;
    dry_run?: boolean;
    mark_paid?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    // Body vazio é OK
  }

  const { payout_ids, force = false, dry_run = false, mark_paid = false } = body;

  // ── Ler configurações da plataforma ──
  let minThresholdCents = 0;
  let autoEnabled = false;
  {
    const { data: settings } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", ["payout_auto_enabled", "payout_min_threshold_cents"]);
    for (const s of settings || []) {
      if (s.key === "payout_auto_enabled") autoEnabled = s.value === true || s.value === "true";
      if (s.key === "payout_min_threshold_cents") minThresholdCents = Number(s.value) || 0;
    }
  }

  // Se chamada do cron e auto não habilitado, sair
  if (isServiceRole && !autoEnabled && !payout_ids?.length) {
    return new Response(
      JSON.stringify({ ok: true, message: "Auto-payout desabilitado", processed: null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Buscar payouts pendentes ──
  let query = admin
    .from("payouts")
    .select("id, worker_id, entity_type, entity_id, gross_amount_cents, worker_amount_cents, admin_amount_cents, status, payout_method, created_at")
    .order("worker_id")
    .order("created_at");

  if (mark_paid) {
    // Modo confirmar pagamento: buscar processing
    query = query.in("status", ["pending", "processing"]);
  } else {
    query = query.eq("status", "pending");
  }

  if (payout_ids && payout_ids.length > 0) {
    query = query.in("id", payout_ids);
  }

  const { data: payouts, error: payoutsErr } = await query.limit(500);
  if (payoutsErr) {
    return new Response(
      JSON.stringify({ error: "Erro ao buscar payouts: " + payoutsErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!payouts || payouts.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, message: "Nenhum payout pendente", processed: { total: 0 } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ── Buscar dados dos workers ──
  const workerIds = [...new Set(payouts.map((p: any) => p.worker_id))];
  const { data: workers } = await admin
    .from("worker_profiles")
    .select("id, stripe_connect_account_id, pix_key, bank_code, bank_agency, bank_account")
    .in("id", workerIds);

  const workerMap: Record<string, any> = {};
  for (const w of workers || []) {
    workerMap[w.id] = w;
  }

  // ── Agrupar payouts por worker ──
  const grouped: Record<string, any[]> = {};
  for (const p of payouts as any[]) {
    if (!grouped[p.worker_id]) grouped[p.worker_id] = [];
    grouped[p.worker_id].push(p);
  }

  // ── Processar ──
  const result = {
    stripe_connect_auto_paid: 0,
    manual_pix_processing: 0,
    manual_pix_paid: 0,
    below_threshold_skipped: 0,
    total_payouts: payouts.length,
  };
  const errors: string[] = [];

  for (const [workerId, workerPayouts] of Object.entries(grouped)) {
    const worker = workerMap[workerId];
    const hasConnect = Boolean(worker?.stripe_connect_account_id);
    const totalWorkerCents = workerPayouts.reduce((sum: number, p: any) => sum + (p.worker_amount_cents || 0), 0);
    const payoutIds = workerPayouts.map((p: any) => p.id);

    // Se é modo mark_paid (admin confirmando pagamento manual já feito)
    if (mark_paid) {
      if (dry_run) {
        result.manual_pix_paid += workerPayouts.length;
        continue;
      }
      const { error: updErr } = await admin
        .from("payouts")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", payoutIds);
      if (updErr) {
        errors.push(`Worker ${workerId}: erro ao marcar paid - ${updErr.message}`);
        continue;
      }
      // Log
      for (const pid of payoutIds) {
        await admin.from("payout_logs").insert({
          payout_id: pid,
          action: "batch_released",
          performed_by: performedBy,
          details: { method: "manual_confirmation", stripe_connect: hasConnect },
        });
      }
      result.manual_pix_paid += workerPayouts.length;
      continue;
    }

    // Worker COM Stripe Connect → dinheiro já transferido no charge
    if (hasConnect) {
      if (dry_run) {
        result.stripe_connect_auto_paid += workerPayouts.length;
        continue;
      }
      const { error: updErr } = await admin
        .from("payouts")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", payoutIds);
      if (updErr) {
        errors.push(`Worker ${workerId}: erro ao marcar Connect paid - ${updErr.message}`);
        continue;
      }
      for (const pid of payoutIds) {
        await admin.from("payout_logs").insert({
          payout_id: pid,
          action: "auto_released",
          performed_by: performedBy,
          details: { method: "stripe_connect_transfer_at_charge", stripe_connect: true },
        });
      }
      result.stripe_connect_auto_paid += workerPayouts.length;
      continue;
    }

    // Worker SEM Stripe Connect → verificar threshold
    if (!force && minThresholdCents > 0 && totalWorkerCents < minThresholdCents) {
      result.below_threshold_skipped += workerPayouts.length;
      continue;
    }

    // Marcar como processing (admin vai pagar externamente via PIX/banco)
    if (dry_run) {
      result.manual_pix_processing += workerPayouts.length;
      continue;
    }

    const { error: updErr } = await admin
      .from("payouts")
      .update({ status: "processing" })
      .in("id", payoutIds);
    if (updErr) {
      errors.push(`Worker ${workerId}: erro ao marcar processing - ${updErr.message}`);
      continue;
    }
    for (const pid of payoutIds) {
      await admin.from("payout_logs").insert({
        payout_id: pid,
        action: "batch_released",
        performed_by: performedBy,
        details: {
          method: "manual_pix",
          requires_export: true,
          worker_total_cents: totalWorkerCents,
          pix_key: worker?.pix_key || null,
        },
      });
    }
    result.manual_pix_processing += workerPayouts.length;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      dry_run,
      processed: result,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
