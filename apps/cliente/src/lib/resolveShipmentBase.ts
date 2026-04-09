import { supabase } from './supabase';

type LatLng = { latitude: number; longitude: number };

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Escolhe a base ativa mais adequada para o envio (coordenadas da coleta, depois cidade no endereço).
 * Usado para preencher `shipments.base_id` e alinhar com o preparador da mesma base.
 */
export async function resolveShipmentBaseId(params: {
  origin: LatLng;
  originAddress: string;
}): Promise<string | null> {
  const { data: bases, error } = await supabase
    .from('bases')
    .select('id, lat, lng, city')
    .eq('is_active', true);

  if (error || !bases?.length) return null;

  const rows = bases as { id: string; lat: number | null; lng: number | null; city: string | null }[];

  const oLat = params.origin.latitude;
  const oLng = params.origin.longitude;
  const oOk = Number.isFinite(oLat) && Number.isFinite(oLng);

  if (oOk) {
    let bestId: string | null = null;
    let bestKm = Infinity;
    for (const b of rows) {
      if (b.lat == null || b.lng == null) continue;
      const d = haversineKm({ latitude: oLat, longitude: oLng }, { latitude: b.lat, longitude: b.lng });
      if (d < bestKm) {
        bestKm = d;
        bestId = b.id;
      }
    }
    if (bestId) return bestId;
  }

  const addr = params.originAddress.toLowerCase();
  for (const b of rows) {
    const c = b.city?.trim().toLowerCase();
    if (c && addr.includes(c)) return b.id;
  }

  return rows[0]!.id;
}
