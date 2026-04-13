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

const SUPPORT_CATEGORY_LABEL: Record<string, string> = {
  excursao: 'Excursões',
  encomendas: 'Encomendas',
  reembolso: 'Reembolso',
  cadastro_transporte: 'Cadastro de transporte',
  autorizar_menores: 'Autorização de menores',
  ouvidoria: 'Ouvidoria',
  denuncia: 'Denúncia',
  outros: 'Suporte',
};

function supportListTitle(category: string | null | undefined): string {
  if (!category) return 'Suporte Take Me';
  return SUPPORT_CATEGORY_LABEL[category] ?? 'Suporte Take Me';
}

export type ClientConversationListRow = {
  id: string;
  driver_id: string | null;
  client_id: string | null;
  booking_id: string | null;
  shipment_id: string | null;
  status: string;
  conversation_kind: string;
  category: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_client: number;
  updated_at: string;
  created_at: string;
  displayName: string;
  participantAvatarKey: string | null;
  /** Origem da conversa na UI (Suporte, Viagem, Encomenda, Motorista). */
  kindLabel: string;
};

function sortKey(r: { last_message_at: string | null; updated_at: string; created_at: string }): number {
  return new Date(r.last_message_at ?? r.updated_at ?? r.created_at).getTime();
}

function conversationKindLabel(r: {
  conversation_kind: string;
  shipment_id: string | null;
  booking_id: string | null;
}): string {
  if (r.conversation_kind === 'support_backoffice') return 'Suporte';
  if (r.shipment_id) return 'Encomenda';
  if (r.booking_id) return 'Viagem';
  return 'Motorista';
}

const CONVERSATIONS_LIST_SELECT_FULL =
  'id, driver_id, client_id, booking_id, shipment_id, status, conversation_kind, category, last_message, last_message_at, unread_client, updated_at, created_at';

const CONVERSATIONS_LIST_SELECT_LEGACY =
  'id, driver_id, client_id, booking_id, status, conversation_kind, category, last_message, last_message_at, unread_client, updated_at, created_at';

function shouldRetryConversationsListWithoutShipment(errMsg: string): boolean {
  const m = errMsg.toLowerCase();
  return m.includes('shipment_id') || m.includes('schema cache');
}

/** Mesmo critério de participação que `getOrCreateActiveSupportConversationId` (shared). */
function conversationsParticipantOrFilter(uid: string): string {
  return `client_id.eq.${uid},driver_id.eq.${uid},support_requester_id.eq.${uid}`;
}

function rpcListUnavailable(err: { message?: string; code?: string } | null): boolean {
  if (!err?.message && !err?.code) return false;
  const msg = String(err.message ?? '').toLowerCase();
  const code = String(err.code ?? '');
  return (
    code === '42883'
    || msg.includes('list_client_conversations_for_app')
    || msg.includes('does not exist')
    || msg.includes('schema cache')
  );
}

type ConversationRowBase = Omit<
  ClientConversationListRow,
  'displayName' | 'participantAvatarKey' | 'kindLabel'
>;

async function mapConversationRowsToList(
  raw: Record<string, unknown>[],
  clientId: string,
): Promise<ClientConversationListRow[]> {
  const base: ConversationRowBase[] = raw.map((r) => ({
    id: String(r.id),
    driver_id: (r.driver_id as string | null | undefined) ?? null,
    client_id: (r.client_id as string | null | undefined) ?? null,
    booking_id: (r.booking_id as string | null | undefined) ?? null,
    shipment_id: (r.shipment_id as string | null | undefined) ?? null,
    status: String(r.status ?? 'active'),
    conversation_kind: String(r.conversation_kind ?? 'driver_client'),
    category: (r.category as string | null | undefined) ?? null,
    last_message: (r.last_message as string | null | undefined) ?? null,
    last_message_at: (r.last_message_at as string | null | undefined) ?? null,
    unread_client: Number(r.unread_client ?? 0),
    updated_at: String(r.updated_at ?? r.created_at ?? new Date().toISOString()),
    created_at: String(r.created_at ?? new Date().toISOString()),
  }));

  const peerProfileIds = [
    ...new Set(
      base
        .filter((r) => r.conversation_kind !== 'support_backoffice')
        .map((r) => {
          const cid = r.client_id;
          const did = r.driver_id;
          if (cid === clientId && did) return did;
          if (did === clientId && cid) return cid;
          return did ?? cid;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let profileById: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
  if (peerProfileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', peerProfileIds);
    profileById = Object.fromEntries(
      (profiles ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [
        p.id,
        { full_name: p.full_name, avatar_url: p.avatar_url },
      ]),
    );
  }

  const rows: ClientConversationListRow[] = base.map((r) => {
    const isSupport = r.conversation_kind === 'support_backoffice';
    let peerId: string | null = null;
    if (!isSupport) {
      if (r.client_id === clientId && r.driver_id) peerId = r.driver_id;
      else if (r.driver_id === clientId && r.client_id) peerId = r.client_id;
      else peerId = r.driver_id ?? r.client_id;
    }
    const prof = peerId ? profileById[peerId] : undefined;
    return {
      ...r,
      shipment_id: r.shipment_id ?? null,
      client_id: r.client_id ?? null,
      displayName: isSupport ? supportListTitle(r.category) : prof?.full_name?.trim() || 'Motorista',
      participantAvatarKey: isSupport ? null : prof?.avatar_url ?? null,
      kindLabel: conversationKindLabel(r),
    };
  });

  rows.sort((a, b) => sortKey(b) - sortKey(a));
  return rows;
}

async function fetchClientConversationsListViaRest(clientId: string): Promise<{
  rows: ClientConversationListRow[];
  error: Error | null;
}> {
  const participantOr = conversationsParticipantOrFilter(clientId);

  let { data, error } = await sb
    .from('conversations')
    .select(CONVERSATIONS_LIST_SELECT_FULL)
    .or(participantOr);

  if (error?.message && shouldRetryConversationsListWithoutShipment(error.message)) {
    const second = await sb
      .from('conversations')
      .select(CONVERSATIONS_LIST_SELECT_LEGACY)
      .or(participantOr);
    data = second.data;
    error = second.error;
  }

  if (error) return { rows: [], error: new Error(error.message) };

  const raw = (data ?? []) as Record<string, unknown>[];
  const rows = await mapConversationRowsToList(raw, clientId);
  return { rows, error: null };
}

/** Lista conversas do passageiro (motorista e suporte) para a tela Perfil → Conversas. */
export async function fetchClientConversationsList(clientId: string): Promise<{
  rows: ClientConversationListRow[];
  error: Error | null;
}> {
  const { data: rpcData, error: rpcError } = await (supabase as { rpc: (n: string) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }> }).rpc(
    'list_client_conversations_for_app',
  );

  if (!rpcError && rpcData != null) {
    const arr = Array.isArray(rpcData) ? rpcData : [rpcData];
    const rows = await mapConversationRowsToList(arr as Record<string, unknown>[], clientId);
    return { rows, error: null };
  }

  if (rpcError && !rpcListUnavailable(rpcError)) {
    return { rows: [], error: new Error(rpcError.message ?? 'Erro ao listar conversas.') };
  }

  return fetchClientConversationsListViaRest(clientId);
}
