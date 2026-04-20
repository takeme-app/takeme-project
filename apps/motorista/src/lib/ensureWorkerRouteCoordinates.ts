import type { SupabaseClient } from '@supabase/supabase-js';
import { googleForwardGeocode } from '@take-me/shared';
import { getGoogleMapsApiKey } from './googleMapsConfig';

/**
 * Garante que `worker_routes` tenha origem/destino geocodificados.
 * Rotas criadas só com texto (ex.: cadastro inicial) ficam sem lat/lng; ao montar
 * `scheduled_trips` o app usava fallback no mapa e o passageiro não via a oferta.
 */
export async function ensureWorkerRouteHasCoordinates(
  client: SupabaseClient,
  routeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: row, error } = await client
    .from('worker_routes')
    .select('id, origin_address, destination_address, origin_lat, origin_lng, destination_lat, destination_lng')
    .eq('id', routeId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: error?.message ?? 'Rota não encontrada.' };
  }

  const fin = (v: unknown) => v != null && Number.isFinite(Number(v));
  if (fin(row.origin_lat) && fin(row.origin_lng) && fin(row.destination_lat) && fin(row.destination_lng)) {
    return { ok: true };
  }

  const apiKey = getGoogleMapsApiKey()?.trim();
  if (!apiKey) {
    return {
      ok: false,
      message:
        'Configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY para localizar no mapa rotas sem coordenadas, ou redefina a rota em Minhas rotas.',
    };
  }

  let oLat = row.origin_lat as number | null | undefined;
  let oLng = row.origin_lng as number | null | undefined;
  let dLat = row.destination_lat as number | null | undefined;
  let dLng = row.destination_lng as number | null | undefined;

  if (!fin(oLat) || !fin(oLng)) {
    const o = await googleForwardGeocode(`${String(row.origin_address).trim()}, Brasil`, apiKey);
    if (!o) return { ok: false, message: 'Não foi possível localizar a origem da rota. Refine o endereço em Minhas rotas.' };
    oLat = o.latitude;
    oLng = o.longitude;
  }

  if (!fin(dLat) || !fin(dLng)) {
    const d = await googleForwardGeocode(`${String(row.destination_address).trim()}, Brasil`, apiKey);
    if (!d) return { ok: false, message: 'Não foi possível localizar o destino da rota. Refine o endereço em Minhas rotas.' };
    dLat = d.latitude;
    dLng = d.longitude;
  }

  const { error: upErr } = await client
    .from('worker_routes')
    .update({
      origin_lat: oLat,
      origin_lng: oLng,
      destination_lat: dLat,
      destination_lng: dLng,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', routeId);

  if (upErr) return { ok: false, message: upErr.message };
  return { ok: true };
}
