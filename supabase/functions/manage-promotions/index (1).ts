import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Verifica se o usuário é admin via app_metadata. */
function isAdmin(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user?.app_metadata?.role === "admin";
}

/** `target_audiences` → app_slug alvo do push (cliente x motorista). */
function audienceToAppSlug(audience: string): "cliente" | "motorista" | null {
  if (audience === "passengers") return "cliente";
  if (
    audience === "drivers" ||
    audience === "preparers_shipments" ||
    audience === "preparers_excursions"
  ) {
    return "motorista";
  }
  return null;
}

/**
 * Dispara uma notification por usuário ativo em cada app alvo da promoção.
 * Usa `profile_fcm_tokens` como fonte de verdade (devices com push habilitado),
 * agrupando pelo `app_slug` derivado de `target_audiences`.
 *
 * Best-effort: qualquer falha é logada mas não interrompe a criação da promoção.
 */
async function broadcastPromotionNotification(
  admin: ReturnType<typeof createClient>,
  audiences: string[],
  title: string,
  message: string,
): Promise<void> {
  const targetSlugs = new Set<"cliente" | "motorista">();
  for (const aud of audiences) {
    const slug = audienceToAppSlug(aud);
    if (slug) targetSlugs.add(slug);
  }
  if (targetSlugs.size === 0) return;

  for (const slug of targetSlugs) {
    const { data: devices, error: devErr } = await admin
      .from("profile_fcm_tokens")
      .select("profile_id")
      .eq("app_slug", slug);
    if (devErr) {
      console.error(`[manage-promotions] fcm_tokens(${slug}) err:`, devErr.message);
      continue;
    }
    const uniqueIds = Array.from(
      new Set(((devices ?? []) as { profile_id: string }[]).map((d) => d.profile_id)),
    ).filter(Boolean);
    if (uniqueIds.length === 0) continue;

    const rows = uniqueIds.map((uid) => ({
      user_id: uid,
      title,
      message,
      category: "offers_promotions",
      target_app_slug: slug,
    }));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error: insErr } = await admin
        .from("notifications")
        .insert(rows.slice(i, i + CHUNK) as never);
      if (insErr) {
        console.error(`[manage-promotions] notifications insert(${slug}) err:`, insErr.message);
      }
    }
  }
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
    const url = new URL(req.url);
    const promotionId = url.searchParams.get("id");

    // --- GET: listar ou buscar por ID ---
    if (req.method === "GET") {
      if (promotionId) {
        const { data, error } = await admin
          .from("promotions")
          .select("*")
          .eq("id", promotionId)
          .single();
        if (error || !data) {
          return new Response(
            JSON.stringify({ error: "Promoção não encontrada" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await admin
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        return new Response(
          JSON.stringify({ error: "Erro ao listar promoções" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(JSON.stringify(data ?? []), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- POST: criar ---
    if (req.method === "POST") {
      const body = (await req.json()) as {
        title?: string;
        description?: string;
        start_at?: string;
        end_at?: string;
        target_audiences?: string[];
        discount_type?: string;
        discount_value?: number;
        applies_to?: string[];
        is_active?: boolean;
      };

      if (
        !body.title?.trim() ||
        !body.start_at ||
        !body.end_at ||
        !body.discount_type ||
        !body.discount_value ||
        !Array.isArray(body.target_audiences) ||
        body.target_audiences.length === 0 ||
        !Array.isArray(body.applies_to) ||
        body.applies_to.length === 0
      ) {
        return new Response(
          JSON.stringify({
            error:
              "Campos obrigatórios: title, start_at, end_at, target_audiences, discount_type, discount_value, applies_to",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data, error } = await admin
        .from("promotions")
        .insert({
          title: body.title.trim(),
          description: body.description?.trim() || null,
          start_at: body.start_at,
          end_at: body.end_at,
          target_audiences: body.target_audiences,
          discount_type: body.discount_type,
          discount_value: body.discount_value,
          applies_to: body.applies_to,
          is_active: typeof body.is_active === "boolean" ? body.is_active : true,
          gain_pct_to_worker: typeof body.gain_pct_to_worker === "number" ? body.gain_pct_to_worker : 0,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("[manage-promotions] insert:", error);
        return new Response(
          JSON.stringify({
            error: "Erro ao criar promoção",
            details: error.message,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (data && data.is_active) {
        try {
          const gainPct = (data as { gain_pct_to_worker?: number }).gain_pct_to_worker || 0;
          const promoTitle = (data as { title?: string }).title || "Promoção";
          const audiences = ((data as { target_audiences?: string[] }).target_audiences ?? []) as string[];
          const pushTitle = "Nova promoção disponível! 🎉";
          const pushMessage =
            gainPct > 0
              ? `${promoTitle} — Motoristas e preparadores ganham +${gainPct}% extra! Abra o app para participar.`
              : `${promoTitle} — Aproveite descontos especiais! Abra o app para saber mais.`;
          await broadcastPromotionNotification(admin, audiences, pushTitle, pushMessage);
        } catch (e) {
          console.error("[manage-promotions] broadcast notification error:", e);
        }
      }

      return new Response(JSON.stringify({ ok: true, promotion: data }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- PUT/PATCH: atualizar ---
    if (req.method === "PUT" || req.method === "PATCH") {
      if (!promotionId) {
        return new Response(
          JSON.stringify({ error: "id é obrigatório na query string" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const body = (await req.json()) as Record<string, unknown>;
      const allowedFields = [
        "title",
        "description",
        "start_at",
        "end_at",
        "target_audiences",
        "discount_type",
        "discount_value",
        "applies_to",
        "is_active",
        "gain_pct_to_worker",
      ];
      const updates: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in body) updates[key] = body[key];
      }
      updates.updated_at = new Date().toISOString();

      const { data, error } = await admin
        .from("promotions")
        .update(updates)
        .eq("id", promotionId)
        .select()
        .single();

      if (error) {
        console.error("[manage-promotions] update:", error);
        return new Response(
          JSON.stringify({
            error: "Erro ao atualizar promoção",
            details: error.message,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ ok: true, promotion: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- DELETE ---
    if (req.method === "DELETE") {
      if (!promotionId) {
        return new Response(
          JSON.stringify({ error: "id é obrigatório na query string" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const { error } = await admin
        .from("promotions")
        .delete()
        .eq("id", promotionId);
      if (error) {
        console.error("[manage-promotions] delete:", error);
        return new Response(
          JSON.stringify({ error: "Erro ao excluir promoção" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[manage-promotions] unhandled:", err);
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
