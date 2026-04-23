// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * notify-preparer-excursion-upcoming
 *
 * Cron (recomendado a cada 5 minutos). Busca excursões com
 * scheduled_departure_at dentro da janela [now+38min, now+42min] ainda
 * sem `upcoming_40min_notified_at` e com `preparer_id` definido. Para cada
 * uma, respeita a preferência do preparador via RPC `should_notify_user`
 * (categoria `excursion_upcoming_40min` -> grupo `excursions_dependents`),
 * insere a notificação com deeplink `DetalhesExcursao { excursionId }` e
 * marca o timestamp para garantir idempotência.
 *
 * Texto (literal do spec - Fase 6):
 *   Título : "Sua viagem inciará em 40 minutos"
 *   Corpo  : "Prepare-se para a saída da excursão. Toque para ver os
 *             detalhes."
 *
 * Autenticação: aceita apenas service-role key no header Authorization.
 * Agendamento sugerido (Supabase cron ou pg_cron):
 *   every 5 minutes
 *   POST <project>/functions/v1/notify-preparer-excursion-upcoming
 *   Header: Authorization: Bearer <SERVICE_ROLE_KEY>
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isServiceRoleToken(token: string): boolean {
  const p = decodeJwtPayload(token);
  return p?.role === "service_role" && p?.iss === "supabase";
}

type ExcursionRow = {
  id: string;
  preparer_id: string;
  scheduled_departure_at: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const token = (req.headers.get("Authorization") ?? "")
    .replace("Bearer ", "")
    .trim();
  if (!isServiceRoleToken(token) && token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const nowMs = Date.now();
  const lower = new Date(nowMs + 38 * 60_000).toISOString();
  const upper = new Date(nowMs + 42 * 60_000).toISOString();

  const { data, error } = await admin
    .from("excursion_requests")
    .select("id, preparer_id, scheduled_departure_at")
    .in("status", ["approved", "scheduled", "in_analysis", "quoted"])
    .not("preparer_id", "is", null)
    .is("upcoming_40min_notified_at", null)
    .gte("scheduled_departure_at", lower)
    .lte("scheduled_departure_at", upper)
    .limit(500);

  if (error) {
    console.error("[notify-preparer-excursion-upcoming] select:", error);
    return new Response(
      JSON.stringify({
        error: "Erro ao consultar excursões",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const rows = (data ?? []) as ExcursionRow[];
  let sent = 0;
  const errors: unknown[] = [];

  for (const r of rows) {
    try {
      const { data: allowed, error: prefErr } = await admin.rpc(
        "should_notify_user",
        {
          p_user_id: r.preparer_id,
          p_category: "excursion_upcoming_40min",
        } as any,
      );
      if (prefErr) {
        errors.push({ excursion: r.id, step: "pref", detail: prefErr.message });
        continue;
      }

      if (allowed) {
        const { error: insErr } = await admin.from("notifications").insert({
          user_id: r.preparer_id,
          title: "Sua viagem inciará em 40 minutos",
          message:
            "Prepare-se para a saída da excursão. Toque para ver os detalhes.",
          category: "excursion_upcoming_40min",
          target_app_slug: "motorista",
          data: {
            route: "DetalhesExcursao",
            params: { excursionId: r.id },
          },
        } as never);

        if (insErr) {
          errors.push({
            excursion: r.id,
            step: "insert",
            detail: insErr.message,
          });
          continue;
        }
        sent += 1;
      }

      // Marca como tratada mesmo quando a preferência bloqueou — evita
      // tentar de novo a cada ciclo do cron.
      const { error: upErr } = await admin
        .from("excursion_requests")
        .update({
          upcoming_40min_notified_at: new Date().toISOString(),
        } as never)
        .eq("id", r.id)
        .is("upcoming_40min_notified_at", null);

      if (upErr) {
        errors.push({
          excursion: r.id,
          step: "update",
          detail: upErr.message,
        });
      }
    } catch (e) {
      errors.push({
        excursion: r.id,
        step: "catch",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return new Response(
    JSON.stringify({
      ok: errors.length === 0,
      scanned: rows.length,
      sent,
      errors,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
