import { supabase } from './supabase';
import { closeBookingConversation } from './bookingConversation';
import { closeShipmentConversation } from './shipmentConversation';

/** Encerra chats ativos (reservas + encomendas na viagem) quando a corrida termina. */
export async function closeConversationsForScheduledTrip(tripId: string): Promise<void> {
  const { data: bookings } = await supabase.from('bookings').select('id').eq('scheduled_trip_id', tripId);
  for (const b of bookings ?? []) {
    await closeBookingConversation((b as { id: string }).id);
  }

  const { data: shipments } = await supabase.from('shipments').select('id').eq('scheduled_trip_id', tripId);
  for (const s of shipments ?? []) {
    await closeShipmentConversation((s as { id: string }).id);
  }
}
