import { supabase } from './supabase';

const sb = supabase as { from: (table: string) => any };

export async function ensureDriverClientConversation(opts: {
  clientId: string;
  driverId: string;
  bookingId?: string | null;
}): Promise<{ conversationId: string | null; error: Error | null }> {
  const { clientId, driverId, bookingId } = opts;

  if (bookingId) {
    const { data: byBooking } = await sb
      .from('conversations')
      .select('id')
      .eq('booking_id', bookingId)
      .maybeSingle();
    if (byBooking?.id) return { conversationId: byBooking.id, error: null };
  }

  let q = sb
    .from('conversations')
    .select('id')
    .eq('client_id', clientId)
    .eq('driver_id', driverId);
  if (bookingId) q = q.eq('booking_id', bookingId);
  else q = q.is('booking_id', null);
  const { data: existing } = await q.maybeSingle();
  if (existing?.id) return { conversationId: existing.id, error: null };

  const { data: clientProfile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', clientId)
    .single();

  const { data: inserted, error } = await sb
    .from('conversations')
    .insert({
      driver_id: driverId,
      client_id: clientId,
      booking_id: bookingId ?? null,
      status: 'active',
      participant_name: clientProfile?.full_name ?? 'Passageiro',
      participant_avatar: clientProfile?.avatar_url ?? null,
    })
    .select('id')
    .single();

  if (error) {
    let retry = sb
      .from('conversations')
      .select('id')
      .eq('client_id', clientId)
      .eq('driver_id', driverId);
    retry = bookingId ? retry.eq('booking_id', bookingId) : retry.is('booking_id', null);
    const { data: again } = await retry.maybeSingle();
    if (again?.id) return { conversationId: again.id, error: null };
    return { conversationId: null, error: new Error(error.message) };
  }
  return { conversationId: inserted?.id ?? null, error: null };
}

export async function markConversationReadByClient(conversationId: string): Promise<void> {
  await sb.from('conversations').update({ unread_client: 0 }).eq('id', conversationId);
}
