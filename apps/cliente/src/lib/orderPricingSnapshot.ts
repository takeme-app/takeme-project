/**
 * Colunas de snapshot de precificação em pedidos (bookings, shipments, dependent_shipments).
 * Regra do banco: amount_cents = pricing_subtotal_cents + platform_fee_cents.
 *
 * Quando o fluxo ainda não calcula surcharges/promo/rota de catálogo, usamos repasse
 * “plano”: subtotal = valor ao passageiro antes da taxa de plataforma, taxa explícita ou zero.
 */

export type OrderPricingSnapshotInsert = {
  price_route_base_cents: number;
  pricing_subtotal_cents: number;
  platform_fee_cents: number;
  pricing_surcharges_cents: number;
  promo_discount_cents: number;
  amount_cents: number;
};

function clampNonNegativeInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/** Viagem / pedido sem breakdown: taxa plataforma zero, valor integral como base e subtotal. */
export function flatPricingSnapshot(amountCents: number): OrderPricingSnapshotInsert {
  const amt = clampNonNegativeInt(amountCents);
  return {
    price_route_base_cents: amt,
    pricing_subtotal_cents: amt,
    platform_fee_cents: 0,
    pricing_surcharges_cents: 0,
    promo_discount_cents: 0,
    amount_cents: amt,
  };
}

/**
 * Encomenda com subtotal + taxa de plataforma (UI). Se faltar breakdown, cai no plano único.
 * Preferimos subtotal + fee como total quando ambos existem (mais consistente que amountCents solto).
 */
export function shipmentPricingSnapshotFromParams(params: {
  amountCents: number;
  subtotalCents?: number | null;
  feeCents?: number | null;
  /** Valor de catálogo do trecho (antes de tamanho/taxa); quando ausente, assume igual ao subtotal. */
  priceRouteBaseCents?: number | null;
}): OrderPricingSnapshotInsert {
  const { amountCents, subtotalCents, feeCents, priceRouteBaseCents } = params;
  if (subtotalCents != null && feeCents != null) {
    const sub = clampNonNegativeInt(subtotalCents);
    const fee = clampNonNegativeInt(feeCents);
    const total = sub + fee;
    const base =
      priceRouteBaseCents != null ? clampNonNegativeInt(priceRouteBaseCents) : sub;
    return {
      price_route_base_cents: base,
      pricing_subtotal_cents: sub,
      platform_fee_cents: fee,
      pricing_surcharges_cents: 0,
      promo_discount_cents: 0,
      amount_cents: total,
    };
  }
  return flatPricingSnapshot(amountCents);
}

/** Aplicar desconto de promoção a um snapshot existente. */
export function applyPromotionToSnapshot(
  snap: OrderPricingSnapshotInsert,
  promoDiscountCents: number,
  adjustedAdminPct: number,
): OrderPricingSnapshotInsert & { promotion_id?: string; admin_pct_applied?: number } {
  const discount = clampNonNegativeInt(Math.min(promoDiscountCents, snap.amount_cents));
  const newSubtotal = Math.max(0, snap.pricing_subtotal_cents - discount);
  const newFee = clampNonNegativeInt(Math.round(newSubtotal * adjustedAdminPct / 100));
  // O Postgres exige amount_cents = pricing_subtotal_cents + platform_fee_cents (constraint em bookings).
  const newAmount = newSubtotal + newFee;
  return {
    ...snap,
    promo_discount_cents: discount,
    pricing_subtotal_cents: newSubtotal,
    platform_fee_cents: newFee,
    amount_cents: newAmount,
    admin_pct_applied: adjustedAdminPct,
  };
}

/** Campos de precificação para INSERT em `shipments` (snapshot + FK do trecho). */
export function shipmentOrderInsertFromQuoteParams(params: {
  /** Pode ser null quando o preço veio de override (preparador/admin) sem catálogo associado. */
  pricingRouteId: string | null;
  priceRouteBaseCents: number;
  pricingSubtotalCents: number;
  platformFeeCents: number;
  amountCents: number;
  adminPctApplied: number;
}): OrderPricingSnapshotInsert & {
  pricing_route_id: string | null;
  admin_pct_applied: number;
} {
  return {
    pricing_route_id: params.pricingRouteId,
    price_route_base_cents: clampNonNegativeInt(params.priceRouteBaseCents),
    pricing_subtotal_cents: clampNonNegativeInt(params.pricingSubtotalCents),
    platform_fee_cents: clampNonNegativeInt(params.platformFeeCents),
    pricing_surcharges_cents: 0,
    promo_discount_cents: 0,
    amount_cents: clampNonNegativeInt(params.amountCents),
    admin_pct_applied: params.adminPctApplied,
  };
}
