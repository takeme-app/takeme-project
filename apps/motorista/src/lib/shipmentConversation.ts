import { supabase } from './supabase';

/**
 * Cria conversa ativa preparador (driver_id) ↔ cliente, ou retorna a já existente para a encomenda.
 */
export async function createOrGetShipmentConversation(
  shipmentId: string,
  preparerUserId: string,
): Promise<{ conversationId: string | null; error?: string }> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('shipment_id' as never, shipmentId as never)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    return { conversationId: (existing as { id: string }).id };
  }

  const { data: ship, error: shipErr } = await supabase
    .from('shipments')
    .select('user_id')
    .eq('id', shipmentId)
    .single();

  if (shipErr || !ship) {
    return { conversationId: null, error: 'Encomenda não encontrada.' };
  }

  const clientId = (ship as { user_id: string }).user_id;
  if (clientId === preparerUserId) {
    return { conversationId: null, error: 'Cliente e preparador não podem ser o mesmo usuário.' };
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
      driver_id: preparerUserId,
      client_id: clientId,
      shipment_id: shipmentId,
      participant_name: p?.full_name?.trim() || 'Cliente',
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

/** Encerra o chat da coleta ao concluir entrega na base. */
export async function closeShipmentConversation(shipmentId: string): Promise<void> {
  await supabase
    .from('conversations')
    .update({ status: 'closed', updated_at: new Date().toISOString() } as never)
    .eq('shipment_id' as never, shipmentId as never)
    .eq('status', 'active');
}
