/**
 * Precificação de encomendas (cliente) alinhada ao catálogo `pricing_routes`
 * com `role_type = 'preparer_shipments'` e ao snapshot do banco:
 * pricing_subtotal_cents = base (trecho × tamanho) + adicionais − promo;
 * platform_fee_cents = round(subtotal × admin_pct / 100);
 * amount_cents = subtotal + platform_fee.
 */

import { supabase } from './supabase';
import { getRouteWithDuration, type RoutePoint } from './route';

export type PreparerShipmentPricingRoute = {
  id: string;
  origin_address: string | null;
  destination_address: string;
  pricing_mode: 'daily_rate' | 'per_km' | 'fixed';
  price_cents: number;
  admin_pct: number;
  created_at?: string;
};

/** Corte “bom” para confiar no pareamento texto↔trecho. */
const MATCH_SCORE_STRICT = 0.32;
/** Corte relaxado: ainda exige alguma sobreposição de palavras/endereço. */
const MATCH_SCORE_RELAXED = 0.12;

/** Multiplicador por tamanho (sobre o valor base do trecho); ref. documentação bagageira pequeno/médio/grande. */
const PACKAGE_SIZE_MULT: Record<'pequeno' | 'medio' | 'grande', number> = {
  pequeno: 1,
  medio: 1.12,
  grande: 1.28,
};

function clampInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeAddr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distância em km (Haversine). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
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

/**
 * Pontuação 0–1: quanto o endereço do usuário combina com o trecho cadastrado.
 * Origem vazia no trecho = aceita qualquer origem (1.0).
 */
function scoreAddressMatch(
  userAddr: string,
  routeAddr: string | null | undefined,
  routePartOptional: boolean
): number {
  if (!routeAddr?.trim()) return routePartOptional ? 1 : 0.35;
  const u = normalizeAddr(userAddr);
  const r = normalizeAddr(routeAddr);
  if (!r.length) return routePartOptional ? 1 : 0.35;
  if (u === r) return 1;
  if (u.includes(r) || r.includes(u)) return 0.92;
  const uWords = new Set(u.split(/[\s,]+/).filter((w) => w.length >= 4));
  const rWords = r.split(/[\s,]+/).filter((w) => w.length >= 4);
  if (rWords.length === 0) return 0.5;
  const hits = rWords.filter((w) => uWords.has(w)).length;
  return Math.min(1, hits / rWords.length);
}

function bestScoredInList(
  routes: PreparerShipmentPricingRoute[],
  originAddress: string,
  destAddress: string
): { route: PreparerShipmentPricingRoute; score: number } | null {
  if (!routes.length) return null;
  let best: { route: PreparerShipmentPricingRoute; score: number } | null = null;
  for (const route of routes) {
    const so = scoreAddressMatch(originAddress, route.origin_address, true);
    const sd = scoreAddressMatch(destAddress, route.destination_address, false);
    const score = so * 0.42 + sd * 0.58;
    if (!best || score > best.score) best = { route, score };
  }
  return best;
}

function pickFromSubsetIfMinScore(
  routes: PreparerShipmentPricingRoute[],
  originAddress: string,
  destAddress: string,
  minScore: number
): PreparerShipmentPricingRoute | null {
  const best = bestScoredInList(routes, originAddress, destAddress);
  if (!best) return null;
  if (best.score >= minScore) return best.route;
  return null;
}

function newestRoute(subset: PreparerShipmentPricingRoute[]): PreparerShipmentPricingRoute | null {
  if (!subset.length) return null;
  const sorted = [...subset].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
  return sorted[0] ?? null;
}

/**
 * Escolhe trecho priorizando `per_km`:
 * 1) match forte → 2) match fraco → 3) único trecho per_km → idem fixed → 4) per_km mais recente → 5) qualquer mais recente.
 * Evita ficar sem preço quando há catálogo mas o texto do endereço não bate 100% com o cadastro.
 */
function pickBestRoutePreferPerKm(
  routes: PreparerShipmentPricingRoute[],
  originAddress: string,
  destAddress: string
): PreparerShipmentPricingRoute | null {
  if (!routes.length) return null;
  const perKm = routes.filter((r) => r.pricing_mode === 'per_km');
  const others = routes.filter((r) => r.pricing_mode !== 'per_km');

  return (
    pickFromSubsetIfMinScore(perKm, originAddress, destAddress, MATCH_SCORE_STRICT) ??
    pickFromSubsetIfMinScore(perKm, originAddress, destAddress, MATCH_SCORE_RELAXED) ??
    (perKm.length === 1 ? perKm[0] : null) ??
    pickFromSubsetIfMinScore(others, originAddress, destAddress, MATCH_SCORE_STRICT) ??
    pickFromSubsetIfMinScore(others, originAddress, destAddress, MATCH_SCORE_RELAXED) ??
    (others.length === 1 ? others[0] : null) ??
    newestRoute(perKm) ??
    newestRoute(others) ??
    newestRoute(routes)
  );
}

/** Km para cobrança per_km: distância da rota (Mapbox/OSRM) quando existir; senão Haversine. */
async function billableKmForShipment(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<number> {
  const origin: RoutePoint = { latitude: originLat, longitude: originLng };
  const dest: RoutePoint = { latitude: destLat, longitude: destLng };
  const rt = await getRouteWithDuration(origin, dest);
  if (rt?.distanceMeters != null && Number.isFinite(rt.distanceMeters) && rt.distanceMeters > 0) {
    return Math.max(0, rt.distanceMeters / 1000);
  }
  return Math.max(0, haversineKm(originLat, originLng, destLat, destLng));
}

function catalogBaseCentsFixed(route: PreparerShipmentPricingRoute): number {
  return clampInt(route.price_cents);
}

async function catalogBaseCentsAsync(
  route: PreparerShipmentPricingRoute,
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<number> {
  const mode = route.pricing_mode;
  const pc = route.price_cents;
  if (mode === 'fixed' || mode === 'daily_rate') {
    return catalogBaseCentsFixed(route);
  }
  if (mode === 'per_km') {
    const km = await billableKmForShipment(originLat, originLng, destLat, destLng);
    return clampInt(km * pc);
  }
  return clampInt(pc);
}

export type ShipmentQuoteOk = {
  pricingRouteId: string;
  priceRouteBaseCents: number;
  pricingSubtotalCents: number;
  platformFeeCents: number;
  amountCents: number;
  adminPctApplied: number;
};

export type ShipmentQuoteResponse = { ok: true; quote: ShipmentQuoteOk } | { ok: false; error: string };

export async function quoteShipmentForClient(params: {
  originAddress: string;
  destinationAddress: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  packageSize: 'pequeno' | 'medio' | 'grande';
}): Promise<ShipmentQuoteResponse> {
  const sb = supabase as { from: (t: string) => any };
  const { data, error } = await sb
    .from('pricing_routes')
    .select(
      'id, origin_address, destination_address, pricing_mode, price_cents, admin_pct, role_type, is_active, created_at'
    )
    .eq('role_type', 'preparer_shipments')
    .eq('is_active', true);

  if (error) {
    return { ok: false, error: 'Não foi possível carregar a tabela de preços. Tente novamente.' };
  }

  const rows = (data ?? []) as PreparerShipmentPricingRoute[];
  if (!rows.length) {
    return {
      ok: false,
      error:
        'Ainda não há preços de encomenda cadastrados. Peça ao administrador para incluir um trecho (preferencialmente por km) em Pagamentos.',
    };
  }

  const route = pickBestRoutePreferPerKm(rows, params.originAddress, params.destinationAddress);
  if (!route) {
    return { ok: false, error: 'Não foi possível definir o preço do envio. Tente novamente ou contate o suporte.' };
  }

  const baseCatalog = await catalogBaseCentsAsync(
    route,
    params.originLat,
    params.originLng,
    params.destinationLat,
    params.destinationLng
  );
  const pkgMul = PACKAGE_SIZE_MULT[params.packageSize];
  const pricingSubtotalCents = clampInt(baseCatalog * pkgMul);
  const adminPct = Number(route.admin_pct ?? 0);
  const safePct = Number.isFinite(adminPct) && adminPct >= 0 ? adminPct : 0;
  const platformFeeCents = clampInt((pricingSubtotalCents * safePct) / 100);
  const amountCents = pricingSubtotalCents + platformFeeCents;

  return {
    ok: true,
    quote: {
      pricingRouteId: route.id,
      priceRouteBaseCents: baseCatalog,
      pricingSubtotalCents,
      platformFeeCents,
      amountCents,
      adminPctApplied: safePct,
    },
  };
}
