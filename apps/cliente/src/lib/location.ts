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

/**
 * Reverse geocoding: coordenadas → endereço legível no formato "Rua, Bairro, Cidade, UF" ou "Cidade, UF".
 * Usa Nominatim (OpenStreetMap), sem API key. Respeite o uso: 1 req/seg, User-Agent identificado.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TakeMe-Cliente/1.0 (mobile app)' },
  });
  if (!res.ok) throw new Error('Falha ao obter endereço');
  const data = (await res.json()) as { display_name?: string; address?: NominatimAddress };
  const fallback = data.display_name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  if (data.address) return formatShortAddress(data.address, fallback);
  return fallback;
}

/**
 * Obtém a localização atual e o endereço (reverse geocode).
 * Retorna { latitude, longitude, address } ou null se permissão negada / erro.
 */
export async function getCurrentPlace(): Promise<{ latitude: number; longitude: number; address: string } | null> {
  const granted = await requestLocationPermission();
  if (!granted) return null;
  const coords = await getCurrentPosition();
  const address = await reverseGeocode(coords.latitude, coords.longitude);
  return { ...coords, address };
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
