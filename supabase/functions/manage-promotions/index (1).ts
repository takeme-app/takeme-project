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
