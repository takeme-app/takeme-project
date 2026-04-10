/** Par lat/lng válido para mapa (exclui ausente e 0,0 usado como placeholder). */
export function parseCoordPair(lat: unknown, lng: unknown): { lat: number; lng: number } | undefined {
  const la = typeof lat === 'number' ? lat : parseFloat(String(lat ?? ''));
  const ln = typeof lng === 'number' ? lng : parseFloat(String(lng ?? ''));
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return undefined;
  if (Math.abs(la) < 1e-9 && Math.abs(ln) < 1e-9) return undefined;
  return { lat: la, lng: ln };
}

export type LatLng = { lat: number; lng: number };

const R_EARTH_KM = 6371;

/** Distância em km (fórmula de Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Offset aproximado em km de `from` → `to` (plano local, adequado a trechos < ~500 km). */
function kmOffset(from: LatLng, to: LatLng): { x: number; y: number } {
  const phi = ((from.lat + to.lat) / 2) * (Math.PI / 180);
  const x = ((to.lng - from.lng) * Math.PI) / 180 * R_EARTH_KM * Math.cos(phi);
  const y = ((to.lat - from.lat) * Math.PI) / 180 * R_EARTH_KM;
  return { x, y };
}

/** Distância mínima do ponto P ao segmento AB (km). */
export function distancePointToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const seg = kmOffset(a, b);
  const pt = kmOffset(a, p);
  const len2 = seg.x * seg.x + seg.y * seg.y;
  if (len2 < 1e-8) return Math.hypot(pt.x, pt.y);
  let t = (pt.x * seg.x + pt.y * seg.y) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = t * seg.x;
  const qy = t * seg.y;
  return Math.hypot(pt.x - qx, pt.y - qy);
}

/** Posição projetada de P no segmento AB: 0 = A, 1 = B (clamp). */
export function alongSegmentT(p: LatLng, a: LatLng, b: LatLng): number {
  const seg = kmOffset(a, b);
  const pt = kmOffset(a, p);
  const len2 = seg.x * seg.x + seg.y * seg.y;
  if (len2 < 1e-8) return 0;
  return Math.max(0, Math.min(1, (pt.x * seg.x + pt.y * seg.y) / len2));
}

/**
 * Garante que recolha/entrega da encomenda caem ao longo do corredor da rota principal A→B
 * (origem/destino da viagem agendada) e que a ordem faz sentido no sentido da viagem.
 */
export function validateShipmentStopsAlongTripRoute(
  tripA: LatLng | undefined,
  tripB: LatLng | undefined,
  pickup: LatLng,
  delivery: LatLng,
): { ok: true } | { ok: false; message: string } {
  if (!tripA || !tripB) return { ok: true };

  const segmentKm = haversineKm(tripA, tripB);

  // Rota muito curta: exige pontos perto de A ou B (mesma região).
  if (segmentKm < 1.5) {
    const maxNearKm = 28;
    const dPu = Math.min(haversineKm(pickup, tripA), haversineKm(pickup, tripB));
    const dDel = Math.min(haversineKm(delivery, tripA), haversineKm(delivery, tripB));
    if (dPu > maxNearKm) {
      return {
        ok: false,
        message:
          'O local de recolha está longe da rota principal desta viagem. Ajuste para um endereço na mesma região da origem/destino cadastrados.',
      };
    }
    if (dDel > maxNearKm) {
      return {
        ok: false,
        message:
          'O local de entrega está longe da rota principal desta viagem. Ajuste para um endereço na mesma região da origem/destino cadastrados.',
      };
    }
    return { ok: true };
  }

  const maxCorridorKm = Math.min(52, Math.max(8, segmentKm * 0.12));
  const dCorPu = distancePointToSegmentKm(pickup, tripA, tripB);
  const dCorDel = distancePointToSegmentKm(delivery, tripA, tripB);
  if (dCorPu > maxCorridorKm) {
    return {
      ok: false,
      message:
        `O local de recolha não acompanha a rota A→B desta viagem (até ~${Math.round(maxCorridorKm)} km do trajeto). Escolha um ponto ao longo do percurso principal.`,
    };
  }
  if (dCorDel > maxCorridorKm) {
    return {
      ok: false,
      message:
        `O local de entrega não acompanha a rota A→B desta viagem (até ~${Math.round(maxCorridorKm)} km do trajeto). Escolha um ponto ao longo do percurso principal.`,
    };
  }

  const tPu = alongSegmentT(pickup, tripA, tripB);
  const tDel = alongSegmentT(delivery, tripA, tripB);
  const orderSlack = 0.05;
  if (tPu > tDel + orderSlack) {
    return {
      ok: false,
      message:
        'A ordem dos endereços não segue o sentido da viagem: a entrega não pode ficar “antes” da recolha ao longo da rota principal (origem → destino).',
    };
  }

  return { ok: true };
}
