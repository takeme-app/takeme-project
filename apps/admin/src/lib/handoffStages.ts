/**
 * Rótulos de estágio operacional para encomendas (§8.1 e §8.2 de codigos-pin-referencia.md).
 * Sem PINs — só texto para listas e resumo no admin.
 */

export type ShipmentStageInput = {
  status: string;
  baseId: string | null;
  pickedUpByPreparerAt: string | null;
  deliveredToBaseAt: string | null;
  pickedUpByDriverFromBaseAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
};

function hasTs(v: string | null | undefined): boolean {
  return v != null && String(v).trim() !== '';
}

/** Cenário 3 (com base) e 4 (sem base) em `shipments`. */
export function getShipmentOperationalStageLabel(s: ShipmentStageInput): string {
  const st = (s.status || '').toLowerCase();
  if (st === 'cancelled') return 'Cancelada';
  if (hasTs(s.deliveredAt)) return 'Entregue';

  const comBase = s.baseId != null && String(s.baseId).trim() !== '';

  if (comBase) {
    if (hasTs(s.pickedUpByDriverFromBaseAt) && !hasTs(s.deliveredAt)) {
      return 'Em trânsito: base → destinatário';
    }
    if (hasTs(s.deliveredToBaseAt) && !hasTs(s.pickedUpByDriverFromBaseAt)) {
      return 'Na base: aguardando motorista retirar';
    }
    if (hasTs(s.pickedUpByPreparerAt) && !hasTs(s.deliveredToBaseAt)) {
      return 'Em trânsito: cliente → base';
    }
    if (!hasTs(s.pickedUpByPreparerAt)) {
      return 'Aguardando preparador (handoff inicial)';
    }
    return 'Em andamento';
  }

  if (hasTs(s.pickedUpAt) && !hasTs(s.deliveredAt)) {
    return 'Em trânsito após coleta';
  }
  if (!hasTs(s.pickedUpAt)) {
    return 'Aguardando coleta no cliente';
  }
  return 'Em andamento';
}

export function getDependentOperationalStageLabel(
  pickedUpAt: string | null,
  deliveredAt: string | null,
  status: string,
): string {
  const st = (status || '').toLowerCase();
  if (st === 'cancelled') return 'Cancelada';
  if (hasTs(deliveredAt)) return 'Entregue';
  if (hasTs(pickedUpAt) && !hasTs(deliveredAt)) return 'Em trânsito';
  if (!hasTs(pickedUpAt)) return 'Aguardando embarque';
  return 'Em andamento';
}
