import { supabase } from './supabase';

/** `base_id` do preparador de encomendas em `worker_profiles`. */
export async function fetchWorkerShipmentBaseId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('worker_profiles')
    .select('base_id')
    .eq('id', userId)
    .maybeSingle();
  const row = data as { base_id?: string | null } | null;
  return row?.base_id ?? null;
}

/** Letra estável para título do modal (ex.: "Coleta A"). */
export function coletaLetterFromShipmentId(id: string): string {
  const hex = id.replace(/-/g, '').slice(0, 8);
  const n = parseInt(hex, 16);
  const safe = Number.isFinite(n) ? n : 0;
  return String.fromCharCode(65 + (safe % 26));
}

export function shipmentCodesMatch(expected: string | null | undefined, entered: string): boolean {
  const a = (expected ?? '').trim().toUpperCase();
  const b = entered.trim().toUpperCase();
  return a.length > 0 && a === b;
}
