import { supabase } from './supabase';

export type BookingPassengerRow = { name?: string; cpf?: string; bags?: string };

export type BookingTripLiveBooking = {
  id: string;
  status: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  amount_cents: number;
  passenger_count: number;
  bags_count: number;
  passenger_data: unknown;
  scheduled_trip_id: string;
  pickup_code: string | null;
  delivery_code: string | null;
};

export type BookingTripLiveTrip = {
  departure_at: string | null;
  arrival_at: string | null;
};

export function parsePassengerData(raw: unknown): BookingPassengerRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p) => p && typeof p === 'object') as BookingPassengerRow[];
}

/**
 * Dados da reserva + viagem agendada para telas de acompanhamento (passageiro).
 */
export async function loadBookingTripLiveContext(bookingId: string): Promise<{
  data: { booking: BookingTripLiveBooking; trip: BookingTripLiveTrip | null } | null;
  error: string | null;
}> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    return { data: null, error: 'Faça login para ver os dados da viagem.' };
  }
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select(
      'id, status, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, amount_cents, passenger_count, bags_count, passenger_data, scheduled_trip_id, pickup_code, delivery_code'
    )
    .eq('id', bookingId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (bErr) {
    return { data: null, error: bErr.message };
  }
  if (!booking) {
    return { data: null, error: 'Reserva não encontrada.' };
  }
  const b = booking as BookingTripLiveBooking;
  const { data: tripRow } = await supabase
    .from('scheduled_trips')
    .select('departure_at, arrival_at')
    .eq('id', b.scheduled_trip_id)
    .maybeSingle();
  const trip = tripRow as BookingTripLiveTrip | null;
  return { data: { booking: b, trip }, error: null };
}
