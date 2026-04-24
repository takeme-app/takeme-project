import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-auth-token, x-client-info, apikey, content-type",
};

const STRIPE_API = "https://api.stripe.com/v1";

type StripeTransfer = { id: string; amount: number; destination: string };

// Helper para chamar Stripe via form-encoded, com suporte a Idempotency-Key.
async function stripeFetch<T = unknown>(
  secretKey: string,
  method: string,
  path: string,
  body?: URLSearchParams,
  idempotencyKey?: string,
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? body.toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      (data as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new Error(err);
  }
  return data as T;
}

// Decide se o payout precisa de stripe.transfers.create explicito.
// booking: NAO — transfer ja aconteceu no charge via transfer_data (charge-booking).
// shipment, dependent_shipment e excursion: SIM — charge fica na plataforma,
// transfer ocorre aqui. Nota: entity_type 'excursion' corresponde a excursion_requests
// (orcamentos) no banco; o nome curto segue o check constraint em public.payouts.
function needsExplicitTransfer(entityType: string | null | undefined): boolean {
  return (
    entityType === "shipment" ||
    entityType === "dependent_shipment" ||
    entityType === "excursion"
  );
}

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
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const appRole = user.app_metadata && typeof user.app_metadata === "object"
      ? (user.app_metadata as { role?: string }).role
      : undefined;
    const metaRole = user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as { role?: string }).role
      : undefined;
    const jwtAdmin = appRole === "admin" || metaRole === "admin";
    const { data: wp } = await admin
      .from("worker_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const workerAdmin = wp?.role === "admin";
    if (!jwtAdmin && !workerAdmin) {
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
    receipt_url?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    // Body vazio é OK
  }

  const { payout_ids, force = false, dry_run = false, mark_paid = false, receipt_url } = body;

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

  const errors: string[] = [];

  // ── Aplicar driver_penalties pendentes ────────────────────────────────────
  // Para cada worker com penalties pendentes, consome o saldo dos payouts
  // (deduzindo do worker_amount_cents do primeiro payout na ordem de created_at).
  // Se payout_amount < penalty, aplica o que der e mantém o resto pending.
  //
  // NOTA: este bloco é pulado em dry_run e em mark_paid (quando admin está só
  // marcando pagamentos já feitos manualmente).
  const penaltyApplications: Record<
    string,
    Array<{ penalty_id: string; amount_applied: number; payout_id: string }>
  > = {};

  if (!dry_run && !mark_paid) {
    for (const [workerId, workerPayouts] of Object.entries(grouped)) {
      const { data: penalties } = await admin
        .from("driver_penalties")
        .select("id, amount_cents")
        .eq("driver_id", workerId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      const pendingPenalties = (penalties ?? []) as Array<{
        id: string;
        amount_cents: number;
      }>;
      if (pendingPenalties.length === 0) continue;

      // Ordena payouts por created_at (fallback: mantém ordem atual).
      const sortedPayouts = [...workerPayouts].sort((a: any, b: any) =>
        String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
      );

      for (const penalty of pendingPenalties) {
        let remaining = Math.max(0, Math.floor(Number(penalty.amount_cents) || 0));
        if (remaining <= 0) continue;

        for (const p of sortedPayouts) {
          if (remaining <= 0) break;
          const available = Math.max(0, Math.floor(Number(p.worker_amount_cents) || 0));
          if (available <= 0) continue;

          const consume = Math.min(available, remaining);
          const newWorkerAmount = available - consume;

          const { error: updErr } = await admin
            .from("payouts")
            .update({ worker_amount_cents: newWorkerAmount })
            .eq("id", p.id);
          if (updErr) {
            errors.push(
              `Worker ${workerId}: falha ao deduzir penalty ${penalty.id} do payout ${p.id} - ${updErr.message}`,
            );
            break;
          }

          // Atualiza referência em memória para próximos passos.
          p.worker_amount_cents = newWorkerAmount;

          if (!penaltyApplications[workerId]) penaltyApplications[workerId] = [];
          penaltyApplications[workerId].push({
            penalty_id: penalty.id,
            amount_applied: consume,
            payout_id: p.id,
          });

          remaining -= consume;
        }

        const totalPenaltyCents = Math.max(0, Math.floor(Number(penalty.amount_cents) || 0));
        if (remaining <= 0) {
          await admin
            .from("driver_penalties")
            .update({
              status: "applied",
              applied_at: new Date().toISOString(),
              applied_payout_id:
                penaltyApplications[workerId]?.slice(-1)[0]?.payout_id ?? null,
            } as never)
            .eq("id", penalty.id);
        } else if (remaining < totalPenaltyCents) {
          // Aplicação parcial: reduz amount_cents da penalty e mantém pending
          // para consumir no próximo ciclo.
          await admin
            .from("driver_penalties")
            .update({ amount_cents: remaining } as never)
            .eq("id", penalty.id);
        }
      }
    }
  }

  // Log de auditoria das aplicações.
  for (const [workerId, apps] of Object.entries(penaltyApplications)) {
    for (const a of apps) {
      await admin.from("payout_logs").insert({
        payout_id: a.payout_id,
        action: "penalty_applied",
        performed_by: performedBy,
        details: {
          penalty_id: a.penalty_id,
          amount_cents: a.amount_applied,
          worker_id: workerId,
        },
      });
    }
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  // ── Processar ──
  const result = {
    stripe_connect_auto_paid: 0,
    stripe_connect_transfers_created: 0,
    stripe_connect_transfers_failed: 0,
    manual_pix_processing: 0,
    manual_pix_paid: 0,
    below_threshold_skipped: 0,
    total_payouts: payouts.length,
  };

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
      const updatePayload: Record<string, any> = { status: "paid", paid_at: new Date().toISOString() };
      if (receipt_url) updatePayload.receipt_url = receipt_url;
      const { error: updErr } = await admin
        .from("payouts")
        .update(updatePayload)
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
          details: { method: "manual_confirmation", stripe_connect: hasConnect, receipt_url: receipt_url || null },
        });
      }
      result.manual_pix_paid += workerPayouts.length;
      continue;
    }

    // Worker COM Stripe Connect → duas regras distintas por entity_type.
    //
    // - booking: transfer_data[destination] ja rodou no charge (charge-booking),
    //   entao so marcamos paid. Comportamento preservado.
    //
    // - shipment / excursion_request: charge ficou na plataforma (opcao B da
    //   auditoria). Precisamos criar stripe.transfers.create explicito agora,
    //   salvando stripe_transfer_id antes de marcar paid.
    if (hasConnect) {
      if (dry_run) {
        // Contabiliza corretamente no preview
        for (const p of workerPayouts as any[]) {
          if (needsExplicitTransfer(p.entity_type)) {
            result.stripe_connect_transfers_created += 1;
          } else {
            result.stripe_connect_auto_paid += 1;
          }
        }
        continue;
      }

      const nowIso = new Date().toISOString();

      for (const p of workerPayouts as any[]) {
        if (!needsExplicitTransfer(p.entity_type)) {
          // booking: mantem comportamento antigo
          const { error: updErr } = await admin
            .from("payouts")
            .update({ status: "paid", paid_at: nowIso })
            .eq("id", p.id);
          if (updErr) {
            errors.push(`Payout ${p.id}: erro ao marcar Connect paid - ${updErr.message}`);
            continue;
          }
          await admin.from("payout_logs").insert({
            payout_id: p.id,
            action: "auto_released",
            performed_by: performedBy,
            details: { method: "stripe_connect_transfer_at_charge", stripe_connect: true },
          });
          result.stripe_connect_auto_paid += 1;
          continue;
        }

        // shipment ou excursion_request: transfer explicito.
        if (!stripeSecret) {
          const msg = "STRIPE_SECRET_KEY ausente — impossivel criar transfer explicito";
          await admin
            .from("payouts")
            .update({ status: "processing", stripe_transfer_error: msg })
            .eq("id", p.id);
          errors.push(`Payout ${p.id}: ${msg}`);
          result.stripe_connect_transfers_failed += 1;
          continue;
        }

        const amount = Number(p.worker_amount_cents) || 0;
        if (amount <= 0) {
          // Nada a transferir (ex.: 0 cents). Marca paid sem chamar Stripe.
          await admin
            .from("payouts")
            .update({ status: "paid", paid_at: nowIso })
            .eq("id", p.id);
          await admin.from("payout_logs").insert({
            payout_id: p.id,
            action: "auto_released",
            performed_by: performedBy,
            details: { method: "zero_amount_no_transfer", stripe_connect: true },
          });
          result.stripe_connect_auto_paid += 1;
          continue;
        }

        // Idempotency-Key deterministico por payout — safe em re-run.
        const idempotencyKey = `payout_${p.id}`;
        const params = new URLSearchParams();
        params.set("amount", String(amount));
        params.set("currency", "brl");
        params.set("destination", worker.stripe_connect_account_id);
        params.set("metadata[payout_id]", String(p.id));
        params.set("metadata[entity_type]", String(p.entity_type));
        if (p.entity_id) {
          params.set("metadata[entity_id]", String(p.entity_id));
        }
        params.set("metadata[worker_id]", String(workerId));

        try {
          const transfer = await stripeFetch<StripeTransfer>(
            stripeSecret,
            "POST",
            "/transfers",
            params,
            idempotencyKey,
          );

          const { error: updErr } = await admin
            .from("payouts")
            .update({
              status: "paid",
              paid_at: nowIso,
              stripe_transfer_id: transfer.id,
              stripe_transfer_at: nowIso,
              stripe_transfer_error: null,
            })
            .eq("id", p.id);

          if (updErr) {
            // Transfer ja foi pra Stripe — registra erro mas nao rollback
            // (idempotency key cobre eventual retry do mesmo payout).
            errors.push(
              `Payout ${p.id}: transfer ${transfer.id} criado mas update falhou - ${updErr.message}`,
            );
            result.stripe_connect_transfers_failed += 1;
            continue;
          }

          await admin.from("payout_logs").insert({
            payout_id: p.id,
            action: "auto_released",
            performed_by: performedBy,
            details: {
              method: "stripe_connect_explicit_transfer",
              stripe_transfer_id: transfer.id,
              amount_cents: amount,
              destination: worker.stripe_connect_account_id,
            },
          });
          result.stripe_connect_transfers_created += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Fica visivel para retry manual; nao avanca para paid.
          await admin
            .from("payouts")
            .update({ status: "processing", stripe_transfer_error: msg })
            .eq("id", p.id);
          await admin.from("payout_logs").insert({
            payout_id: p.id,
            action: "batch_released",
            performed_by: performedBy,
            details: {
              method: "stripe_connect_explicit_transfer_failed",
              error: msg,
            },
          });
          errors.push(`Payout ${p.id}: transfer falhou - ${msg}`);
          result.stripe_connect_transfers_failed += 1;
        }
      }

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
