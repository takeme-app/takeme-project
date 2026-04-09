import { supabase } from './supabase';

/**
 * Chat motorista ↔ passageiro para uma reserva (booking).
 * Reutiliza `conversations.booking_id`.
 */
export async function createOrGetBookingConversation(
  bookingId: string,
  driverUserId: string
): Promise<{ conversationId: string | null; error?: string }> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('booking_id' as never, bookingId as never)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    return { conversationId: (existing as { id: string }).id };
  }

  const { data: row, error: bErr } = await supabase
    .from('bookings')
    .select('user_id, scheduled_trips!inner(driver_id)')
    .eq('id', bookingId)
    .single();

  if (bErr || !row) {
    return { conversationId: null, error: 'Reserva não encontrada.' };
  }

  const st = (row as { scheduled_trips?: { driver_id?: string } }).scheduled_trips;
  if (st?.driver_id !== driverUserId) {
    return { conversationId: null, error: 'Esta reserva não pertence às suas viagens.' };
  }

  const clientId = (row as { user_id: string }).user_id;
  if (clientId === driverUserId) {
    return { conversationId: null, error: 'Cliente e motorista não podem ser o mesmo usuário.' };
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', clientId)
    .maybeSingle();
  const p = prof as { full_name?: string | null; avatar_url?: string | null } | null;

  const { data: inserted, error: insErr } = await supabase
    .from('conversations')
    .insert({
      driver_id: driverUserId,
      client_id: clientId,
      booking_id: bookingId,
      participant_name: p?.full_name?.trim() || 'Passageiro',
      participant_avatar: p?.avatar_url ?? null,
      status: 'active',
    } as never)
    .select('id')
    .single();

  if (insErr) {
    return { conversationId: null, error: insErr.message };
  }
  return { conversationId: (inserted as { id: string }).id };
}

export async function closeBookingConversation(bookingId: string): Promise<void> {
  await supabase
    .from('conversations')
    .update({ status: 'closed', updated_at: new Date().toISOString() } as never)
    .eq('booking_id' as never, bookingId as never)
    .eq('status', 'active');
}
