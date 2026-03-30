import { getGoogleMapsApiKey } from './expoExtra';

export type GeocodeResult = { lat: number; lng: number; formattedAddress: string };

/** Geocodifica endereço (API REST). Requer Geocoding API ativa na chave. */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = getGoogleMapsApiKey();
  const q = address.trim();
  if (!key || !q) return null;
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}` +
    `&key=${encodeURIComponent(key)}&region=br`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results?: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }>;
    };
    if (data.status !== 'OK' || !data.results?.[0]) return null;
    const r = data.results[0];
    const loc = r.geometry.location;
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
    return { lat: loc.lat, lng: loc.lng, formattedAddress: r.formatted_address };
  } catch {
    return null;
  }
}
