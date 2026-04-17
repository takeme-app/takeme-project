import { supabase } from './supabase';
import { isValidGlobeCoordinate } from '../components/googleMaps';

/** Cenário preparador: perfil deve ser preparador de encomendas; com base no envio, deve coincidir com `worker_profiles.base_id`. */
export type PreparerShipmentAccessResult =
  | { ok: true; workerBaseId: string | null }
  | { ok: false; message: string };

export async function assertPreparerShipmentsForShipment(args: {
  userId: string;
  shipmentBaseId: string | null;
}): Promise<PreparerShipmentAccessResult> {
  const { data, error } = await supabase
    .from('worker_profiles')
    .select('role, subtype, base_id')
    .eq('id', args.userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: [error.message, error.hint].filter(Boolean).join(' — ') || 'Não foi possível carregar seu perfil.',
    };
  }
  if (!data) {
    return { ok: false, message: 'Perfil de trabalhador não encontrado.' };
  }

  const wp = data as { role?: string | null; subtype?: string | null; base_id?: string | null };
  if (String(wp.subtype ?? '').trim() !== 'shipments' || String(wp.role ?? '').trim() !== 'preparer') {
    return { ok: false, message: 'Esta área é apenas para preparadores de encomendas.' };
  }

  if (args.shipmentBaseId) {
    const need = String(args.shipmentBaseId).trim();
    const have = wp.base_id != null ? String(wp.base_id).trim() : '';
    if (!have || have !== need) {
      return { ok: false, message: 'Esta coleta não pertence à sua base.' };
    }
  }

  return { ok: true, workerBaseId: wp.base_id ?? null };
}

/**
 * Base efetiva para o fluxo preparador → base (cenário 1).
 * - Se o envio já tem `base_id`, usa esse.
 * - Se não: chama `nearest_active_base` na origem do cliente; só aceita se o resultado for a **mesma base** do preparador (`workerBaseId`), para não mostrar rota para base errada.
 */
export async function resolveShipmentBaseIdForPreparerScreen(args: {
  shipmentBaseId: string | null;
  originLat: number | null;
  originLng: number | null;
  workerBaseId: string | null;
}): Promise<{ resolvedBaseId: string | null }> {
  if (args.shipmentBaseId) {
    return { resolvedBaseId: String(args.shipmentBaseId).trim() };
  }
  const wb = args.workerBaseId != null ? String(args.workerBaseId).trim() : '';
  if (!wb) {
    return { resolvedBaseId: null };
  }
  if (
    args.originLat == null ||
    args.originLng == null ||
    !isValidGlobeCoordinate(args.originLat, args.originLng)
  ) {
    return { resolvedBaseId: null };
  }

  const { data, error } = await supabase.rpc('nearest_active_base' as never, {
    p_lat: args.originLat,
    p_lng: args.originLng,
  } as never);

  if (error) {
    return { resolvedBaseId: null };
  }

  const raw = data as unknown;
  const rows = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const first = rows[0] as { id?: string } | undefined;
  const rid = first?.id != null ? String(first.id).trim() : '';
  if (!rid || rid !== wb) {
    return { resolvedBaseId: null };
  }

  return { resolvedBaseId: rid };
}

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

/** Só dígitos; exige 4 no esperado e no informado e igualdade (evita aceitar código qualquer quando o esperado está vazio). */
export function shipmentCodesMatch(expected: string | null | undefined, entered: string): boolean {
  const exp = String(expected ?? '').replace(/\D/g, '');
  const ent = String(entered ?? '').replace(/\D/g, '');
  return exp.length === 4 && ent.length === 4 && ent === exp;
}
