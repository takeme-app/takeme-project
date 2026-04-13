import * as Location from 'expo-location';

export type Coords = { latitude: number; longitude: number };

/**
 * Solicita permissão de localização (quando em uso).
 * Retorna true se concedida, false caso contrário.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

/** Evita que getCurrentPositionAsync fique pendurado indefinidamente (comum em emulador / GPS fraco). */
const POSITION_TIMEOUT_MS = 22_000;
const GEOCODE_FETCH_TIMEOUT_MS = 14_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Retorna a localização atual do dispositivo.
 * Requer permissão concedida (use requestLocationPermission antes).
 */
export async function getCurrentPosition(): Promise<Coords> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

/** Tenta GPS atual; em falha ou timeout usa última posição conhecida (útil no Android / emulador). */
export async function getCurrentOrLastKnownCoords(): Promise<Coords | null> {
  try {
    return await withTimeout(getCurrentPosition(), POSITION_TIMEOUT_MS);
  } catch {
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000 });
      if (last?.coords?.latitude != null && last.coords.longitude != null) {
        return { latitude: last.coords.latitude, longitude: last.coords.longitude };
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * Reverse geocoding: coordenadas → endereço legível no formato "Rua, Bairro, Cidade, UF" ou "Cidade, UF".
 * Usa Nominatim (OpenStreetMap), sem API key. Respeite o uso: 1 req/seg, User-Agent identificado.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
  const ctrl = new AbortController();
  const kill = setTimeout(() => ctrl.abort(), GEOCODE_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'TakeMe-Cliente/1.0 (mobile app)' },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(kill);
  }
  if (!res.ok) throw new Error('Falha ao obter endereço');
  const data = (await res.json()) as { display_name?: string; address?: NominatimAddress };
  const fallback = data.display_name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  if (data.address) return formatShortAddress(data.address, fallback);
  return fallback;
}

export type ResolveCurrentPlaceResult =
  | { kind: 'place'; latitude: number; longitude: number; address: string }
  | { kind: 'permission_denied' }
  | { kind: 'unavailable' };

function formatCoordsOnlyAddress(c: Coords): string {
  return `Localização (${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)})`;
}

/**
 * Localização + endereço, com distinção entre permissão negada e GPS/rede indisponível.
 * Não lança: adequado para montagem de tela e contexto global.
 */
export async function resolveCurrentPlace(): Promise<ResolveCurrentPlaceResult> {
  const granted = await requestLocationPermission();
  if (!granted) return { kind: 'permission_denied' };
  const coords = await getCurrentOrLastKnownCoords();
  if (!coords) return { kind: 'unavailable' };
  try {
    const address = await reverseGeocode(coords.latitude, coords.longitude);
    return { kind: 'place', latitude: coords.latitude, longitude: coords.longitude, address };
  } catch {
    return {
      kind: 'place',
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: formatCoordsOnlyAddress(coords),
    };
  }
}

/**
 * Obtém a localização atual e o endereço (reverse geocode).
 * Retorna { latitude, longitude, address } ou null se permissão negada ou GPS indisponível.
 */
export async function getCurrentPlace(): Promise<{ latitude: number; longitude: number; address: string } | null> {
  const r = await resolveCurrentPlace();
  if (r.kind === 'place') {
    return { latitude: r.latitude, longitude: r.longitude, address: r.address };
  }
  return null;
}

/**
 * Distância em km entre dois pontos usando fórmula de Haversine.
 * Retorna null se lat2/lng2 forem nulos.
 */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number | undefined,
  lng2: number | undefined,
): number | null {
  if (lat2 == null || lng2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Formata distância em km/m para exibição. */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km.toFixed(1)} km`;
}

export type AddressSuggestion = {
  address: string;
  latitude: number;
  longitude: number;
  /** Cidade (Nominatim) quando disponível — usada em envios para fila de motoristas. */
  city?: string;
};

/** Siglas dos estados brasileiros (Nominatim devolve nome completo). */
const BR_STATE_UF: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amazonas': 'AM', 'bahia': 'BA', 'ceará': 'CE',
  'distrito federal': 'DF', 'espírito santo': 'ES', 'goiás': 'GO', 'maranhão': 'MA', 'mato grosso': 'MT',
  'mato grosso do sul': 'MS', 'minas gerais': 'MG', 'pará': 'PA', 'paraíba': 'PB', 'pernambuco': 'PE',
  'piauí': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  'rondônia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP', 'sergipe': 'SE',
  'tocantins': 'TO',
};

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
};

/** Formata endereço essencial: "Rua, Bairro, Cidade, UF" ou "Cidade, UF". Estado sempre como UF (ex.: PB). */
function formatShortAddress(addr: NominatimAddress | undefined, fallback: string): string {
  if (!addr) return fallback;
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? '';
  const state = addr.state ?? '';
  const stateNorm = state.toLowerCase().trim();
  const uf = BR_STATE_UF[stateNorm] ?? (state.length === 2 ? state : stateNorm.slice(0, 2).toUpperCase());
  const road = addr.road ?? '';
  const number = addr.house_number ?? '';
  const suburb = addr.suburb ?? addr.neighbourhood ?? '';
  if (road) {
    const street = number ? `${road}, ${number}` : road;
    const parts = [street, suburb, city, uf].filter(Boolean);
    return parts.join(', ');
  }
  if (city && uf) return `${city}, ${uf}`;
  if (city) return city;
  return fallback;
}

/**
 * Autocomplete de endereços (estilo Google Maps).
 * Usa Nominatim Search. Respeite 1 req/seg; em produção considere Google Places Autocomplete.
 * Aceita cidade, rua, endereço completo. Resultados resumidos no formato "Cidade, UF" ou "Rua, Cidade - UF".
 */
export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=10&countrycodes=br`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TakeMe-Cliente/1.0 (mobile app)' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    address?: NominatimAddress;
  }>;
  const mapped = data.map((item) => {
    const short = formatShortAddress(item.address, item.display_name ?? '');
    const addr = item.address;
    const cityRaw =
      addr?.city?.trim() ??
      addr?.town?.trim() ??
      addr?.village?.trim() ??
      addr?.municipality?.trim() ??
      '';
    return {
      address: short,
      latitude: parseFloat(item.lat ?? '0'),
      longitude: parseFloat(item.lon ?? '0'),
      ...(cityRaw ? { city: cityRaw } : {}),
    };
  }).filter((s) => s.address.length > 0);

  const seen = new Set<string>();
  return mapped.filter((s) => {
    const key = s.address.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
