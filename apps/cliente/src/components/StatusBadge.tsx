import { View, StyleSheet } from 'react-native';
import { Text } from './Text';

/** Variantes para lista principal Atividades (seções Confirmadas / Planejadas) */
export type ActivitySectionBadge = 'confirmada' | 'planejada';

/** Variantes para status de viagem (Histórico e Detalhes) e envio */
export type TripStatusBadge = 'concluida' | 'cancelada' | 'em_andamento' | 'em_analise' | 'aguardando_motorista';

export type StatusBadgeVariant = ActivitySectionBadge | TripStatusBadge;

const VARIANT_STYLES: Record<
  StatusBadgeVariant,
  { backgroundColor: string; color: string }
> = {
  confirmada: { backgroundColor: '#dcfce7', color: '#166534' },
  planejada: { backgroundColor: '#f1f1f1', color: '#525252' },
  concluida: { backgroundColor: '#dcfce7', color: '#166534' },
  cancelada: { backgroundColor: '#e11d48', color: '#FFFFFF' },
  em_andamento: { backgroundColor: '#fef3c7', color: '#0d0d0d' },
  em_analise: { backgroundColor: '#e5e5e5', color: '#0d0d0d' },
  aguardando_motorista: { backgroundColor: '#e5e5e5', color: '#0d0d0d' },
};

const VARIANT_LABELS: Record<StatusBadgeVariant, string> = {
  confirmada: 'Confirmada',
  planejada: 'Planejada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  em_andamento: 'Em andamento',
  em_analise: 'Em análise',
  aguardando_motorista: 'Aguardando aceite do motorista',
};

type Props = {
  variant: StatusBadgeVariant;
  label?: string;
};

export function StatusBadge({ variant, label }: Props) {
  const style = VARIANT_STYLES[variant];
  const text = label ?? VARIANT_LABELS[variant];
  return (
    <View style={[styles.badge, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.text, { color: style.color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** Mapeia só `bookings.status` (sem `scheduled_trips`). Preferir `clientViagemStatusBadge` quando houver viagem. */
export function bookingStatusToBadge(status: string | undefined): TripStatusBadge {
  if (!status) return 'em_analise';
  const s = status.toLowerCase();
  if (s === 'cancelled' || s === 'canceled' || s === 'cancelada') return 'cancelada';
  if (s === 'completed' || s === 'concluido') return 'concluida';
  if (s === 'in_progress' || s === 'em_andamento') return 'em_andamento';
  if (s === 'confirmed') return 'em_andamento';
  if (s === 'paid' || s === 'pending') return 'aguardando_motorista';
  return 'em_analise';
}

/**
 * Combina reserva + viagem agendada (`scheduled_trips.status`).
 * Alinhado ao fluxo motorista: active → em andamento / aguardando; completed → concluída; cancelled em qualquer lado → cancelada.
 */
export function clientViagemStatusBadge(
  bookingStatus: string | undefined,
  tripStatus: string | undefined | null,
): TripStatusBadge {
  const b = String(bookingStatus ?? '').trim().toLowerCase();
  const t = String(tripStatus ?? '').trim().toLowerCase();

  if (b === 'cancelled' || b === 'canceled' || t === 'cancelled' || t === 'canceled') {
    return 'cancelada';
  }
  if (t === 'completed') {
    return 'concluida';
  }
  if (t === 'active') {
    if (b === 'confirmed' || b === 'in_progress') return 'em_andamento';
    if (b === 'paid' || b === 'pending') return 'aguardando_motorista';
    return 'em_analise';
  }
  return bookingStatusToBadge(bookingStatus);
}

/** Mapeia status do backend para variante do badge (shipments.status). Inclui awaiting_driver para quando o app motorista existir. */
export function shipmentStatusToBadge(status: string | undefined): TripStatusBadge {
  if (!status) return 'em_analise';
  const s = status.toLowerCase();
  if (s === 'delivered') return 'concluida';
  if (s === 'cancelled' || s === 'canceled') return 'cancelada';
  if (s === 'awaiting_driver') return 'aguardando_motorista';
  if (s === 'in_progress' || s === 'confirmed') return 'em_andamento';
  if (s === 'pending_review') return 'em_analise';
  return 'em_analise';
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
