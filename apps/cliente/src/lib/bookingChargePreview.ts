/**
 * @deprecated Use `computeOrderPricing` from `@take-me/shared` (fórmula gross-up do PDF).
 * Mantido temporariamente para retrocompat enquanto o CheckoutScreen ainda usa
 * o fluxo antigo; deve ser removido junto com o refactor de cliente-checkout-ui.
 */
export function bookingCardChargeAmountCents(routePriceCents: number, promoDiscountCents: number): number {
  const route = Math.floor(Number(routePriceCents));
  const disc = Math.max(0, Math.floor(Number(promoDiscountCents)));
  if (!Number.isFinite(route) || route < 1) return 1;
  return Math.max(1, route - disc);
}
