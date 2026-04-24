/**
 * MultasMotoristasScreen — Gestão das penalidades (driver_penalties).
 * Lista pendentes/aplicadas/dispensadas, permite dispensar manualmente.
 * Segue o padrão React.createElement dos demais screens admin (sem JSX).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

type PenaltyRow = {
  id: string;
  driver_id: string;
  scheduled_trip_id: string | null;
  booking_id: string | null;
  reason: string;
  amount_cents: number;
  status: 'pending' | 'applied' | 'waived' | 'cancelled';
  applied_at: string | null;
  waived_at: string | null;
  waived_note: string | null;
  created_at: string;
  driver_name?: string | null;
};

type StatusFilter = 'all' | 'pending' | 'applied' | 'waived' | 'cancelled';

function formatBrl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'driver_cancelled_after_payment':
      return 'Motorista cancelou com passageiros pagos';
    default:
      return reason;
  }
}

function statusLabel(status: PenaltyRow['status']): string {
  switch (status) {
    case 'pending': return 'Pendente';
    case 'applied': return 'Aplicada';
    case 'waived': return 'Dispensada';
    case 'cancelled': return 'Cancelada';
    default: return status;
  }
}

function statusColor(status: PenaltyRow['status']): string {
  switch (status) {
    case 'pending': return '#EAB308';
    case 'applied': return '#22c55e';
    case 'waived': return '#767676';
    case 'cancelled': return '#dc2626';
    default: return '#0d0d0d';
  }
}

export default function MultasMotoristasScreen() {
  const [rows, setRows] = useState<PenaltyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [waivingId, setWaivingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('driver_penalties')
      .select(
        'id, driver_id, scheduled_trip_id, booking_id, reason, amount_cents, status, applied_at, waived_at, waived_note, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(500);
    const list = (data ?? []) as PenaltyRow[];
    const driverIds = [...new Set(list.map((r) => r.driver_id))];
    let names: Record<string, string> = {};
    if (driverIds.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from('profiles')
        .select('id, full_name')
        .in('id', driverIds);
      names = Object.fromEntries(((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map((p) => [p.id, p.full_name ?? '']));
    }
    setRows(list.map((r) => ({ ...r, driver_name: names[r.driver_id] ?? '—' })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const totals = useMemo(() => {
    const totalPending = rows.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount_cents, 0);
    const totalApplied = rows.filter((r) => r.status === 'applied').reduce((s, r) => s + r.amount_cents, 0);
    return { totalPending, totalApplied, countPending: rows.filter((r) => r.status === 'pending').length };
  }, [rows]);

  const handleWaive = useCallback(async (row: PenaltyRow) => {
    if (row.status !== 'pending') return;
    const note = window.prompt('Observação da dispensa (opcional):') ?? '';
    if (!window.confirm(`Dispensar multa de ${formatBrl(row.amount_cents)} do motorista?`)) return;
    setWaivingId(row.id);
    const { data: session } = await (supabase as any).auth.getSession();
    const userId = session?.session?.user?.id ?? null;
    const { error } = await (supabase as any)
      .from('driver_penalties')
      .update({
        status: 'waived',
        waived_at: new Date().toISOString(),
        waived_by: userId,
        waived_note: note || null,
      })
      .eq('id', row.id);
    setWaivingId(null);
    if (error) {
      window.alert(`Erro ao dispensar: ${error.message}`);
      return;
    }
    await load();
  }, [load]);

  const chip = (label: string, value: StatusFilter) =>
    React.createElement('button', {
      key: value,
      type: 'button',
      onClick: () => setFilter(value),
      style: {
        height: 36,
        padding: '0 14px',
        borderRadius: 999,
        border: 'none',
        cursor: 'pointer',
        background: filter === value ? '#0d0d0d' : '#f1f1f1',
        color: filter === value ? '#fff' : '#0d0d0d',
        fontSize: 13,
        fontWeight: 600,
        ...font,
      },
    }, label);

  const headerCell = (label: string, width?: string | number) =>
    React.createElement('th', {
      style: {
        textAlign: 'left' as const,
        padding: '12px 16px',
        fontSize: 12,
        fontWeight: 600,
        color: '#767676',
        borderBottom: '1px solid #e2e2e2',
        background: '#fafafa',
        ...font,
        ...(width ? { width } : {}),
      },
    }, label);

  const dataCell = (content: React.ReactNode, extra: React.CSSProperties = {}) =>
    React.createElement('td', {
      style: {
        padding: '14px 16px',
        fontSize: 14,
        color: '#0d0d0d',
        borderBottom: '1px solid #f1f1f1',
        ...font,
        ...extra,
      },
    }, content);

  const theadRow = React.createElement(
    'tr',
    null,
    headerCell('Motorista'),
    headerCell('Motivo'),
    headerCell('Valor', 120),
    headerCell('Status', 140),
    headerCell('Criada em', 180),
    headerCell('Aplicada em', 180),
    headerCell('Ações', 120),
  );

  const tbodyContent = loading
    ? React.createElement(
        'tr',
        null,
        React.createElement(
          'td',
          { colSpan: 7, style: { padding: 24, textAlign: 'center' as const, color: '#767676', ...font } },
          'Carregando…',
        ),
      )
    : filtered.length === 0
      ? React.createElement(
          'tr',
          null,
          React.createElement(
            'td',
            { colSpan: 7, style: { padding: 24, textAlign: 'center' as const, color: '#767676', ...font } },
            'Nenhuma penalidade nesse filtro.',
          ),
        )
      : filtered.map((row) =>
          React.createElement(
            'tr',
            { key: row.id },
            dataCell(row.driver_name ?? row.driver_id.slice(0, 8)),
            dataCell(reasonLabel(row.reason), { color: '#444' }),
            dataCell(formatBrl(row.amount_cents), { fontWeight: 600 }),
            dataCell(
              React.createElement(
                'span',
                {
                  style: {
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: `${statusColor(row.status)}22`,
                    color: statusColor(row.status),
                    fontSize: 12,
                    fontWeight: 600,
                  },
                },
                statusLabel(row.status),
              ),
            ),
            dataCell(formatDate(row.created_at)),
            dataCell(row.applied_at ? formatDate(row.applied_at) : '—'),
            dataCell(
              row.status === 'pending'
                ? React.createElement(
                    'button',
                    {
                      type: 'button',
                      onClick: () => {
                        void handleWaive(row);
                      },
                      disabled: waivingId === row.id,
                      style: {
                        height: 32,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: '1px solid #e2e2e2',
                        background: '#fff',
                        color: '#0d0d0d',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        ...font,
                      },
                    },
                    waivingId === row.id ? 'Dispensando…' : 'Dispensar',
                  )
                : '—',
            ),
          ),
        );

  const tableBlock = React.createElement(
    'div',
    { style: { marginTop: 16, background: '#fff', borderRadius: 12, border: '1px solid #e2e2e2', overflowX: 'auto' as const } },
    React.createElement(
      'table',
      { style: { width: '100%', borderCollapse: 'collapse' as const } },
      React.createElement('thead', null, theadRow),
      React.createElement('tbody', null, tbodyContent),
    ),
  );

  return React.createElement('div', { style: { padding: 24, ...font } },
    React.createElement('h1', { style: { fontSize: 24, fontWeight: 700, margin: 0, color: '#0d0d0d', ...font } }, 'Multas de motoristas'),
    React.createElement('p', { style: { color: '#767676', marginTop: 8, fontSize: 14, ...font } },
      'Penalidades por cancelamento com passageiros pagos. Os valores pendentes são descontados automaticamente do próximo payout.'),

    React.createElement('div', { style: { display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { flex: '1 1 200px', background: '#fff', border: '1px solid #e2e2e2', borderRadius: 12, padding: 16 } },
        React.createElement('div', { style: { fontSize: 12, color: '#767676', ...font } }, 'Pendentes'),
        React.createElement('div', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', marginTop: 4, ...font } }, `${totals.countPending} · ${formatBrl(totals.totalPending)}`)),
      React.createElement('div', { style: { flex: '1 1 200px', background: '#fff', border: '1px solid #e2e2e2', borderRadius: 12, padding: 16 } },
        React.createElement('div', { style: { fontSize: 12, color: '#767676', ...font } }, 'Total aplicado'),
        React.createElement('div', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', marginTop: 4, ...font } }, formatBrl(totals.totalApplied)))),

    React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' as const } },
      chip('Pendentes', 'pending'),
      chip('Aplicadas', 'applied'),
      chip('Dispensadas', 'waived'),
      chip('Canceladas', 'cancelled'),
      chip('Todas', 'all')),

    tableBlock,
  );
}
