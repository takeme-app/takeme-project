import { supabase } from './supabase';

const DEST_MATCH = 0.002;

/** Chave YYYY-MM-DD no fuso de São Paulo (mesmo critério de “dia” da viagem no app). */
export function calendarDayKeySaoPaulo(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function destMatches(
  destLat: number,
  destLng: number,
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  if (lat == null || lng == null) return false;
  return Math.abs(destLat - lat) < DEST_MATCH && Math.abs(destLng - lng) < DEST_MATCH;
}

type StDep = { departure_at?: string | null } | { departure_at?: string | null }[] | null;

function departureAtFromJoin(st: StDep): string | null {
  if (!st) return null;
  const row = Array.isArray(st) ? st[0] : st;
  const v = row?.departure_at;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Impede novo pedido se já existir viagem/envio ativo para o mesmo destino (coords ~200 m)
 * no mesmo dia de referência (viagem = dia da `scheduled_trip`; envio = dia da viagem vinculada ou dia do pedido em SP).
 */
export async function getDuplicateDestinationSameDayMessage(args: {
  userId: string;
  destLat: number;
  destLng: number;
  /** Dia de referência YYYY-MM-DD (SP), ex.: saída da `scheduled_trip` ou hoje para envio imediato. */
  dayKey: string;
}): Promise<string | null> {
  const { userId, destLat, destLng, dayKey } = args;

  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select('id, destination_lat, destination_lng, status, scheduled_trips(departure_at)')
    .eq('user_id', userId)
    .in('status', ['pending', 'paid', 'confirmed']);
  if (!bErr && Array.isArray(bookings)) {
    for (const row of bookings as {
      destination_lat?: number;
      destination_lng?: number;
      scheduled_trips?: StDep;
    }[]) {
      const depIso = departureAtFromJoin(row.scheduled_trips ?? null);
      if (!depIso) continue;
      if (calendarDayKeySaoPaulo(depIso) !== dayKey) continue;
      if (destMatches(destLat, destLng, row.destination_lat, row.destination_lng)) {
        return 'Você já tem uma viagem solicitada para este destino neste dia. Cancele ou escolha outro dia ou destino.';
      }
    }
  }

  const { data: shipments, error: sErr } = await supabase
    .from('shipments')
    .select('id, destination_lat, destination_lng, status, created_at, scheduled_trip_id, scheduled_trips(departure_at)')
    .eq('user_id', userId)
    .in('status', ['pending_review', 'confirmed', 'in_progress']);
  if (!sErr && Array.isArray(shipments)) {
    for (const row of shipments as {
      destination_lat?: number;
      destination_lng?: number;
      created_at?: string;
      scheduled_trips?: StDep;
    }[]) {
      const depTrip = departureAtFromJoin(row.scheduled_trips ?? null);
      const day =
        depTrip != null ? calendarDayKeySaoPaulo(depTrip) : calendarDayKeySaoPaulo(row.created_at ?? new Date().toISOString());
      if (day !== dayKey) continue;
      if (destMatches(destLat, destLng, row.destination_lat, row.destination_lng)) {
        return 'Você já tem um envio para este destino neste dia. Aguarde concluir ou cancele antes de solicitar outro.';
      }
    }
  }

  const { data: dependents, error: dErr } = await supabase
    .from('dependent_shipments')
    .select('id, destination_lat, destination_lng, status, created_at, scheduled_trips(departure_at)')
    .eq('user_id', userId)
    .in('status', ['pending_review', 'confirmed', 'in_progress']);
  if (!dErr && Array.isArray(dependents)) {
    for (const row of dependents as {
      destination_lat?: number;
      destination_lng?: number;
      created_at?: string;
      scheduled_trips?: StDep;
    }[]) {
      const depTrip = departureAtFromJoin(row.scheduled_trips ?? null);
      const day =
        depTrip != null ? calendarDayKeySaoPaulo(depTrip) : calendarDayKeySaoPaulo(row.created_at ?? new Date().toISOString());
      if (day !== dayKey) continue;
      if (destMatches(destLat, destLng, row.destination_lat, row.destination_lng)) {
        return 'Você já tem um envio de dependente para este destino neste dia. Aguarde concluir ou cancele antes de solicitar outro.';
      }
    }
  }

  return null;
}
