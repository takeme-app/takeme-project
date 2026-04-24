/**
 * Ganhos do motorista nas telas de pagamento/histórico.
 *
 * Após o alinhamento das fórmulas do PDF, cada booking persiste `worker_earning_cents`
 * (valor líquido repassado ao motorista após gross-up e split promo/admin). Essa é a
 * fonte única de verdade — `amount_cents` é o total cobrado do passageiro (inclui
 * taxa da plataforma e adicionais), portanto não pode ser usado para calcular
 * receita do motorista.
 *
 * Fallback para registros antigos (sem `worker_earning_cents`): usamos `amount_cents`
 * para não quebrar histórico existente.
 */

type BookingEarningRow = {
  amount_cents: number;
  worker_earning_cents?: number | null;
  status: string;
};

function earningOf(b: BookingEarningRow): number {
  const w = typeof b.worker_earning_cents === 'number' && Number.isFinite(b.worker_earning_cents)
    ? b.worker_earning_cents
    : null;
  if (w != null && w > 0) return w;
  const total = Number(b.amount_cents);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/** Reservas que contam como receita do motorista (ainda não canceladas). */
export function sumDriverRelevantBookingCents(
  rows: BookingEarningRow[] | null | undefined,
): number {
  if (!rows?.length) return 0;
  return rows
    .filter((b) => b.status === 'confirmed' || b.status === 'paid')
    .reduce((s, b) => s + earningOf(b), 0);
}

/** Valor exibido na viagem: soma das reservas ou, se vazio, amount_cents da própria scheduled_trip. */
export function tripDisplayEarningsCents(
  bookings: BookingEarningRow[] | null | undefined,
  tripAmountCents: number | null | undefined,
): number {
  const fromBookings = sumDriverRelevantBookingCents(bookings);
  if (fromBookings > 0) return fromBookings;
  const tripAmt = Number(tripAmountCents);
  return Number.isFinite(tripAmt) && tripAmt > 0 ? tripAmt : 0;
}
