/** Par lat/lng válido para mapa (exclui ausente e 0,0 usado como placeholder). */
export function parseCoordPair(lat: unknown, lng: unknown): { lat: number; lng: number } | undefined {
  const la = typeof lat === 'number' ? lat : parseFloat(String(lat ?? ''));
  const ln = typeof lng === 'number' ? lng : parseFloat(String(lng ?? ''));
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return undefined;
  if (Math.abs(la) < 1e-9 && Math.abs(ln) < 1e-9) return undefined;
  return { lat: la, lng: ln };
}
