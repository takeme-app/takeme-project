/**
 * Colunas de snapshot de precificação em pedidos (bookings, shipments, dependent_shipments).
 * No modelo gross-up (PDF): amount_cents = worker_earning_cents + admin_earning_cents.
 *
 * Campos adicionais `worker_earning_cents`, `admin_earning_cents` e `promo_gain_cents`
 * refletem o split explícito — usados por process-payouts e telas de repasse.
 */

import type { PricingResult } from '@take-me/shared';

export type OrderPricingSnapshotInsert = {
  price_route_base_cents: number;
  pricing_subtotal_cents: number;
  platform_fee_cents: number;
  pricing_surcharges_cents: number;
  promo_discount_cents: number;
  amount_cents: number;
  /** Ganho promocional extra repassado ao worker (cents). */
  promo_gain_cents?: number;
  /** Split do total: o quanto o worker recebe (cents). */
  worker_earning_cents?: number;
  /** Split do total: o quanto a plataforma recebe (cents). */
  admin_earning_cents?: number;
  admin_pct_applied?: number;
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
  /** Campos opcionais do split PDF (quando a cotação já aplicou gross-up). */
  surchargesCents?: number;
  workerEarningCents?: number;
  adminEarningCents?: number;
}): OrderPricingSnapshotInsert & {
  pricing_route_id: string | null;
  admin_pct_applied: number;
} {
  return {
    pricing_route_id: params.pricingRouteId,
    price_route_base_cents: clampNonNegativeInt(params.priceRouteBaseCents),
    pricing_subtotal_cents: clampNonNegativeInt(params.pricingSubtotalCents),
    platform_fee_cents: clampNonNegativeInt(params.platformFeeCents),
    pricing_surcharges_cents: clampNonNegativeInt(params.surchargesCents ?? 0),
    promo_discount_cents: 0,
    promo_gain_cents: 0,
    amount_cents: clampNonNegativeInt(params.amountCents),
    worker_earning_cents:
      params.workerEarningCents != null
        ? clampNonNegativeInt(params.workerEarningCents)
        : clampNonNegativeInt(params.pricingSubtotalCents),
    admin_earning_cents:
      params.adminEarningCents != null
        ? clampNonNegativeInt(params.adminEarningCents)
        : clampNonNegativeInt(params.platformFeeCents),
    admin_pct_applied: params.adminPctApplied,
  };
}

/**
 * Snapshot completo para INSERT em qualquer pedido (bookings/shipments/etc.) a partir
 * do resultado do `computeOrderPricing` (shared). Formato gross-up do PDF.
 */
export function snapshotFromPricingResult(
  result: PricingResult,
  opts: {
    promotionId?: string | null;
    pricingRouteId?: string | null;
    promoWorkerRouteId?: string | null;
  } = {}
): OrderPricingSnapshotInsert & {
  pricing_route_id: string | null;
  promotion_id: string | null;
  promo_worker_route_id: string | null;
  admin_pct_applied: number;
} {
  return {
    price_route_base_cents: clampNonNegativeInt(result.baseCents),
    pricing_subtotal_cents: clampNonNegativeInt(result.baseCents),
    pricing_surcharges_cents: clampNonNegativeInt(result.surchargesCents),
    platform_fee_cents: clampNonNegativeInt(result.adminFeeCents),
    promo_discount_cents: clampNonNegativeInt(result.promoDiscountCents),
    promo_gain_cents: clampNonNegativeInt(result.promoGainCents),
    amount_cents: clampNonNegativeInt(result.totalCents),
    worker_earning_cents: clampNonNegativeInt(result.workerEarningCents),
    admin_earning_cents: clampNonNegativeInt(result.adminEarningCents),
    admin_pct_applied: Number(result.adminPctApplied ?? 0),
    pricing_route_id: opts.pricingRouteId ?? null,
    promotion_id: opts.promotionId ?? null,
    promo_worker_route_id: opts.promoWorkerRouteId ?? null,
  };
}
