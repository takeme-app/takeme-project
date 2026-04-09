/** Reservas que contam como receita do motorista (ainda não canceladas). */
export function sumDriverRelevantBookingCents(
  rows: { amount_cents: number; status: string }[] | null | undefined
): number {
  if (!rows?.length) return 0;
  return rows
    .filter((b) => b.status === 'confirmed' || b.status === 'paid')
    .reduce((s, b) => s + (Number(b.amount_cents) || 0), 0);
}

/** Valor exibido na viagem: soma das reservas ou, se vazio, amount_cents da própria scheduled_trip. */
export function tripDisplayEarningsCents(
  bookings: { amount_cents: number; status: string }[] | null | undefined,
  tripAmountCents: number | null | undefined
): number {
  const fromBookings = sumDriverRelevantBookingCents(bookings);
  if (fromBookings > 0) return fromBookings;
  const tripAmt = Number(tripAmountCents);
  return Number.isFinite(tripAmt) && tripAmt > 0 ? tripAmt : 0;
}
