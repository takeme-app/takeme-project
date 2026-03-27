import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * expire-assignments
 *
 * Função schedulada (cron) que verifica worker_assignments com:
 *   status = 'assigned' AND expires_at < now()
 * e marca como 'expired'. Em seguida cancela a entidade e notifica o cliente.
 *
 * Pode ser chamada via cron (pg_cron ou Supabase cron) ou manualmente pelo admin.
 * Recomendação: rodar a cada 5 minutos.
 *
 * Supabase cron config:
 *   Schedule: "*/5 * * * *"
 *   URL: POST /functions/v1/expire-assignments
 *   Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Autenticação: aceita service_role key ou admin JWT
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim() ?? "";

    // Validar que é service role ou admin
    if (token !== serviceRoleKey) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const {
        data: { user },
      } = await userClient.auth.getUser(token);
      if (!user || user.app_metadata?.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Não autorizado" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const nowIso = new Date().toISOString();

    // Buscar assignments expirados
    const { data: expired, error: fetchErr } = await admin
      .from("worker_assignments")
      .select("id, worker_id, entity_type, entity_id")
      .eq("status", "assigned")
      .lt("expires_at", nowIso);

    if (fetchErr) {
      console.error("[expire-assignments] fetch:", fetchErr);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar atribuições expiradas" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!expired || expired.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, expired_count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let expiredCount = 0;
    const errors: string[] = [];

    for (const assignment of expired) {
      try {
        // Marcar como expired
        await admin
          .from("worker_assignments")
          .update({ status: "expired" })
          .eq("id", assignment.id);

        // Cancelar entidade
        const table = getTableName(assignment.entity_type);
        if (table) {
          await admin
            .from(table)
            .update({
              status: "cancelled",
              updated_at: nowIso,
            })
            .eq("id", assignment.entity_id);
        }

        // Notificar cliente
        const userId = await getEntityUserId(
          admin,
          assignment.entity_type,
          assignment.entity_id
        );
        if (userId) {
          await admin.from("notifications").insert({
            user_id: userId,
            title: "Solicitação expirada",
            message:
              "O motorista não respondeu a tempo. Sua solicitação foi cancelada e o valor será estornado.",
            category: assignment.entity_type,
          });
        }

        // Notificar motorista
        await admin.from("notifications").insert({
          user_id: assignment.worker_id,
          title: "Solicitação expirada",
          message:
            "Você não respondeu a tempo e a solicitação foi cancelada.",
          category: assignment.entity_type,
        });

        // TODO: Disparar estorno via process-refund ou Stripe direto
        // Pode chamar a Edge Function process-refund internamente:
        // await fetch(`${supabaseUrl}/functions/v1/process-refund`, { ... })
        console.log(
          `[expire-assignments] Expirado: ${assignment.entity_type}/${assignment.entity_id} — estorno pendente`
        );

        expiredCount++;
      } catch (e) {
        const msg = `assignment ${assignment.id}: ${e instanceof Error ? e.message : String(e)}`;
        console.error("[expire-assignments]", msg);
        errors.push(msg);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        expired_count: expiredCount,
        total_found: expired.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[expire-assignments] unhandled:", err);
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

function getTableName(entityType: string): string | null {
  switch (entityType) {
    case "booking":
      return "bookings";
    case "shipment":
      return "shipments";
    case "dependent_shipment":
      return "dependent_shipments";
    case "excursion":
      return "excursion_requests";
    default:
      return null;
  }
}

async function getEntityUserId(
  admin: ReturnType<typeof createClient>,
  entityType: string,
  entityId: string
): Promise<string | null> {
  const table = getTableName(entityType);
  if (!table) return null;
  const { data } = await admin
    .from(table)
    .select("user_id")
    .eq("id", entityId)
    .maybeSingle();
  return data?.user_id ?? null;
}
