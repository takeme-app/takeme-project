import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-auth-token, x-client-info, apikey, content-type",
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

type GeoResult = {
  lat: number;
  lng: number;
  display_name: string;
};

/**
 * Geocodifica um endereço usando Nominatim (OpenStreetMap).
 * Limitado ao Brasil (countrycodes=br).
 */
async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
    countrycodes: "br",
  });

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      "User-Agent": "TakeMeApp/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.error("[geocode] Nominatim error:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (!Array.isArray(data) || data.length === 0) return null;

  const first = data[0]!;
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    display_name: first.display_name,
  };
}

/**
 * geocode
 *
 * Modos de uso:
 *
 * 1) Geocodificação simples (retorna lat/lng):
 *    POST { address: "Fortaleza - CE" }
 *    → { ok, lat, lng, display_name }
 *
 * 2) Geocodificar e atualizar worker_route:
 *    POST { worker_route_id: "uuid" }
 *    → geocodifica origin_address e destination_address da rota
 *    → atualiza origin_lat/lng e destination_lat/lng na tabela
 *
 * 3) Geocodificar e atualizar scheduled_trip:
 *    POST { scheduled_trip_id: "uuid" }
 *    → geocodifica origin_address e destination_address
 *    → atualiza as coordenadas na tabela
 *
 * 4) Geocodificar ao criar scheduled_trip a partir de worker_route:
 *    POST { worker_route_id: "uuid", create_trip: true, ...trip_fields }
 *    → geocodifica a rota, cria a scheduled_trip com coordenadas preenchidas
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader =
      req.headers.get("Authorization") ?? req.headers.get("x-auth-token");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : (authHeader ?? "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json().catch(() => ({}))) as {
      address?: string;
      worker_route_id?: string;
      scheduled_trip_id?: string;
      create_trip?: boolean;
      // Campos opcionais para criar trip
      departure_at?: string;
      arrival_at?: string;
      seats_available?: number;
      bags_available?: number;
      day_of_week?: number;
      departure_time?: string;
      arrival_time?: string;
      price_per_person_cents?: number;
    };

    // --- Modo 1: Geocodificação simples ---
    if (body.address && !body.worker_route_id && !body.scheduled_trip_id) {
      const trimmed = body.address.trim();
      if (!trimmed) {
        return new Response(
          JSON.stringify({ error: "Endereço vazio" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const result = await geocodeAddress(trimmed);
      if (!result) {
        return new Response(
          JSON.stringify({ error: "Endereço não encontrado" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          lat: result.lat,
          lng: result.lng,
          display_name: result.display_name,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Modo 2: Geocodificar worker_route ---
    if (body.worker_route_id && !body.create_trip) {
      const { data: route, error: routeErr } = await admin
        .from("worker_routes")
        .select("id, worker_id, origin_address, destination_address")
        .eq("id", body.worker_route_id)
        .single();

      if (routeErr || !route) {
        return new Response(
          JSON.stringify({ error: "Rota não encontrada" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Verificar que o usuário é o dono da rota
      if (route.worker_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Sem permissão para esta rota" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const [originGeo, destGeo] = await Promise.all([
        geocodeAddress(route.origin_address),
        geocodeAddress(route.destination_address),
      ]);

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (originGeo) {
        updates.origin_lat = originGeo.lat;
        updates.origin_lng = originGeo.lng;
      }
      if (destGeo) {
        updates.destination_lat = destGeo.lat;
        updates.destination_lng = destGeo.lng;
      }

      await admin
        .from("worker_routes")
        .update(updates)
        .eq("id", body.worker_route_id);

      return new Response(
        JSON.stringify({
          ok: true,
          origin: originGeo
            ? { lat: originGeo.lat, lng: originGeo.lng }
            : null,
          destination: destGeo
            ? { lat: destGeo.lat, lng: destGeo.lng }
            : null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Modo 3: Geocodificar scheduled_trip existente ---
    if (body.scheduled_trip_id) {
      const { data: trip, error: tripErr } = await admin
        .from("scheduled_trips")
        .select(
          "id, driver_id, origin_address, destination_address, origin_lat, origin_lng, destination_lat, destination_lng"
        )
        .eq("id", body.scheduled_trip_id)
        .single();

      if (tripErr || !trip) {
        return new Response(
          JSON.stringify({ error: "Viagem não encontrada" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (trip.driver_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Sem permissão para esta viagem" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const needsOrigin = !trip.origin_lat || !trip.origin_lng;
      const needsDest = !trip.destination_lat || !trip.destination_lng;

      const [originGeo, destGeo] = await Promise.all([
        needsOrigin ? geocodeAddress(trip.origin_address) : null,
        needsDest ? geocodeAddress(trip.destination_address) : null,
      ]);

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (originGeo) {
        updates.origin_lat = originGeo.lat;
        updates.origin_lng = originGeo.lng;
      }
      if (destGeo) {
        updates.destination_lat = destGeo.lat;
        updates.destination_lng = destGeo.lng;
      }

      if (Object.keys(updates).length > 1) {
        await admin
          .from("scheduled_trips")
          .update(updates)
          .eq("id", body.scheduled_trip_id);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          origin: originGeo
            ? { lat: originGeo.lat, lng: originGeo.lng }
            : { lat: trip.origin_lat, lng: trip.origin_lng },
          destination: destGeo
            ? { lat: destGeo.lat, lng: destGeo.lng }
            : { lat: trip.destination_lat, lng: trip.destination_lng },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --- Modo 4: Geocodificar worker_route + criar scheduled_trip ---
    if (body.worker_route_id && body.create_trip) {
      const { data: route, error: routeErr } = await admin
        .from("worker_routes")
        .select("*")
        .eq("id", body.worker_route_id)
        .single();

      if (routeErr || !route) {
        return new Response(
          JSON.stringify({ error: "Rota não encontrada" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (route.worker_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Sem permissão para esta rota" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Geocodificar se a rota não tiver coordenadas
      let originLat = route.origin_lat as number | null;
      let originLng = route.origin_lng as number | null;
      let destLat = route.destination_lat as number | null;
      let destLng = route.destination_lng as number | null;

      const [originGeo, destGeo] = await Promise.all([
        !originLat || !originLng
          ? geocodeAddress(route.origin_address)
          : null,
        !destLat || !destLng
          ? geocodeAddress(route.destination_address)
          : null,
      ]);

      if (originGeo) {
        originLat = originGeo.lat;
        originLng = originGeo.lng;
      }
      if (destGeo) {
        destLat = destGeo.lat;
        destLng = destGeo.lng;
      }

      if (!originLat || !originLng || !destLat || !destLng) {
        return new Response(
          JSON.stringify({
            error:
              "Não foi possível geocodificar os endereços da rota. Verifique origem e destino.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Atualizar coordenadas na worker_route se foram geocodificadas agora
      if (originGeo || destGeo) {
        const routeUpdates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (originGeo) {
          routeUpdates.origin_lat = originLat;
          routeUpdates.origin_lng = originLng;
        }
        if (destGeo) {
          routeUpdates.destination_lat = destLat;
          routeUpdates.destination_lng = destLng;
        }
        await admin
          .from("worker_routes")
          .update(routeUpdates)
          .eq("id", body.worker_route_id);
      }

      // Validar campos obrigatórios da trip
      if (!body.departure_at || !body.arrival_at) {
        return new Response(
          JSON.stringify({
            error: "departure_at e arrival_at são obrigatórios para criar viagem",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Criar scheduled_trip
      const { data: trip, error: tripErr } = await admin
        .from("scheduled_trips")
        .insert({
          driver_id: user.id,
          route_id: body.worker_route_id,
          origin_address: route.origin_address,
          origin_lat: originLat,
          origin_lng: originLng,
          destination_address: route.destination_address,
          destination_lat: destLat,
          destination_lng: destLng,
          departure_at: body.departure_at,
          arrival_at: body.arrival_at,
          seats_available: body.seats_available ?? 4,
          bags_available: body.bags_available ?? 4,
          day_of_week: body.day_of_week ?? null,
          departure_time: body.departure_time ?? null,
          arrival_time: body.arrival_time ?? null,
          price_per_person_cents:
            body.price_per_person_cents ??
            route.price_per_person_cents ??
            null,
          status: "active",
          is_active: true,
        })
        .select()
        .single();

      if (tripErr) {
        console.error("[geocode] create trip:", tripErr);
        return new Response(
          JSON.stringify({
            error: "Erro ao criar viagem",
            details: tripErr.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, scheduled_trip: trip }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error:
          "Informe address, worker_route_id ou scheduled_trip_id",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[geocode] unhandled:", err);
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
