/**
 * Valor debitado no cartão na reserva com cartão (edge `charge-booking`):
 * `max(1, preço_rota_centavos − desconto_promo_centavos)`.
 * A taxa administrativa / split Connect não aumenta esse valor — entra no repasse Stripe.
 */
export function bookingCardChargeAmountCents(routePriceCents: number, promoDiscountCents: number): number {
  const route = Math.floor(Number(routePriceCents));
  const disc = Math.max(0, Math.floor(Number(promoDiscountCents)));
  if (!Number.isFinite(route) || route < 1) return 1;
  return Math.max(1, route - disc);
}
