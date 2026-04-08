/**
 * Utilitários para uso com @rnmapbox/maps.
 * Mapbox usa [longitude, latitude] (GeoJSON); react-native-maps usa { latitude, longitude }.
 */

export type LatLng = { latitude: number; longitude: number };

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/** Centro do Brasil — câmera inicial segura (zoom ~4). Nunca use (0,0). */
export const FALLBACK_BR_MAP_REGION: MapRegion = {
  latitude: -14.235004,
  longitude: -51.925282,
  latitudeDelta: 8.2,
  longitudeDelta: 8.2,
};

/**
 * Coordenada utilizável para viagem no mapa.
 * Rejeita null/undefined, NaN e (0,0) (Golfo da Guiné).
 */
export function isValidTripCoordinate(lat: unknown, lng: unknown): boolean {
  if (lat == null || lng == null) return false;
  const la = typeof lat === 'number' ? lat : Number(lat);
  const ln = typeof lng === 'number' ? lng : Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (Math.abs(la) < 1e-5 && Math.abs(ln) < 1e-5) return false;
  return la >= -85 && la <= 85 && ln >= -180 && ln <= 180;
}

/** Região segura para o Mapbox: rejeita centro inválido e deltas degenerados. */
export function sanitizeMapRegion(region: MapRegion | null | undefined): MapRegion {
  if (!region || !isValidTripCoordinate(region.latitude, region.longitude)) {
    return { ...FALLBACK_BR_MAP_REGION };
  }
  const ld =
    Number.isFinite(region.latitudeDelta) && region.latitudeDelta > 1e-6
      ? region.latitudeDelta
      : 0.05;
  const lg =
    Number.isFinite(region.longitudeDelta) && region.longitudeDelta > 1e-6
      ? region.longitudeDelta
      : 0.05;
  return {
    latitude: region.latitude,
    longitude: region.longitude,
    latitudeDelta: Math.min(ld, 80),
    longitudeDelta: Math.min(lg, 170),
  };
}

/**
 * Região que engloba origem e destino; null se nenhum par for válido.
 */
export function regionFromOriginDestination(
  oLat: unknown,
  oLng: unknown,
  dLat: unknown,
  dLng: unknown,
): MapRegion | null {
  const oOk = isValidTripCoordinate(oLat, oLng);
  const dOk = isValidTripCoordinate(dLat, dLng);
  if (!oOk && !dOk) return null;
  const pad = 0.004;
  if (oOk && dOk) {
    const ol = Number(oLat);
    const on = Number(oLng);
    const dl = Number(dLat);
    const dn = Number(dLng);
    const latMin = Math.min(ol, dl);
    const latMax = Math.max(ol, dl);
    const lngMin = Math.min(on, dn);
    const lngMax = Math.max(on, dn);
    return {
      latitude: (latMin + latMax) / 2,
      longitude: (lngMin + lngMax) / 2,
      latitudeDelta: Math.max(0.015, latMax - latMin + pad * 2),
      longitudeDelta: Math.max(0.015, lngMax - lngMin + pad * 2),
    };
  }
  if (oOk) {
    return {
      latitude: Number(oLat),
      longitude: Number(oLng),
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    };
  }
  return {
    latitude: Number(dLat),
    longitude: Number(dLng),
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };
}

/** Converte { lat, lng } para [lng, lat] (Mapbox). */
export function toMapboxCoord(point: LatLng): [number, number] {
  return [point.longitude, point.latitude];
}

/** Converte região (react-native-maps) para zoomLevel aproximado. */
export function regionToZoomLevel(region: MapRegion): number {
  const { latitudeDelta } = region;
  // 0.008 -> ~14, 0.02 -> ~12, 0.05 -> ~10
  const zoom = 14 - Math.log2(latitudeDelta / 0.008);
  return Math.round(Math.max(3, Math.min(20, zoom)));
}
