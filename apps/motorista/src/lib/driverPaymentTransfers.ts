import type { SupabaseClient } from '@supabase/supabase-js';

export type DriverPaymentTransferSource = 'payout' | 'booking' | 'completed_trip';

export type DriverPaymentTransfer = {
  id: string;
  amount_cents: number;
  paid_at: string;
  source: DriverPaymentTransferSource;
};

type BookingRow = { id: string; amount_cents: number; status: string; paid_at: string | null };

type CompletedTripRow = {
  id: string;
  updated_at: string;
  bookings: BookingRow[] | null;
};

/**
 * Lista transferências/ganhos do motorista no intervalo.
 * - Com payouts no período: só payouts (fonte oficial de repasse).
 * - Sem payouts: reservas pagas no período (paid_at) + linhas sintéticas por viagem concluída
 *   no período (updated_at), para reservas confirmadas ou pagas fora do filtro de paid_at.
 */
export async function fetchDriverPaymentTransfers(
  supabase: SupabaseClient,
  userId: string,
  startIso: string,
  endIso: string
): Promise<DriverPaymentTransfer[]> {
  const { data: payoutsData } = await supabase
    .from('payouts')
    .select('id, worker_amount_cents, paid_at')
    .eq('worker_id', userId)
    .eq('status', 'paid')
    .gte('paid_at', startIso)
    .lte('paid_at', endIso)
    .order('paid_at', { ascending: false });

  if (payoutsData && payoutsData.length > 0) {
    return (payoutsData as { id: string; worker_amount_cents: number; paid_at: string }[]).map(
      (p) => ({
        id: p.id,
        amount_cents: p.worker_amount_cents,
        paid_at: p.paid_at,
        source: 'payout' as const,
      })
    );
  }

  const { data: paidBookings } = await supabase
    .from('bookings')
    .select('id, amount_cents, paid_at, status, scheduled_trips!inner(driver_id)')
    .eq('scheduled_trips.driver_id', userId)
    .eq('status', 'paid')
    .gte('paid_at', startIso)
    .lte('paid_at', endIso)
    .order('paid_at', { ascending: false });

  const bookingTransfers: DriverPaymentTransfer[] = (paidBookings ?? []).map((b: BookingRow) => ({
    id: b.id,
    amount_cents: b.amount_cents,
    paid_at: b.paid_at as string,
    source: 'booking' as const,
  }));

  const listedPaidBookingIds = new Set(bookingTransfers.map((t) => t.id));

  const { data: completedTrips } = await supabase
    .from('scheduled_trips')
    .select('id, updated_at, bookings(id, amount_cents, status, paid_at)')
    .eq('driver_id', userId)
    .eq('status', 'completed')
    .gte('updated_at', startIso)
    .lte('updated_at', endIso);

  const tripTransfers: DriverPaymentTransfer[] = [];

  for (const trip of (completedTrips ?? []) as CompletedTripRow[]) {
    const rows = trip.bookings ?? [];
    let extra = 0;
    for (const b of rows) {
      if (b.status !== 'confirmed' && b.status !== 'paid') continue;
      if (b.status === 'paid' && listedPaidBookingIds.has(b.id)) continue;
      extra += Number(b.amount_cents) || 0;
    }
    if (extra > 0) {
      tripTransfers.push({
        id: `st-${trip.id}`,
        amount_cents: extra,
        paid_at: trip.updated_at,
        source: 'completed_trip',
      });
    }
  }

  const combined = [...bookingTransfers, ...tripTransfers].sort(
    (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
  );

  return combined;
}
