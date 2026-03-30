/**
 * HistoricoViagensScreen — Histórico de viagens (dados Supabase).
 * React.createElement() only.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { webStyles, searchIconSvg, filterIconSvg } from '../styles/webStyles';
import { fetchViagens, fetchBookingsForDriver, formatCurrencyBRL } from '../data/queries';
import type { ViagemListItem } from '../data/types';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

function viagemStatusLabel(s: ViagemListItem['status']): string {
  switch (s) {
    case 'concluído': return 'Concluído';
    case 'cancelado': return 'Cancelado';
    case 'agendado': return 'Agendado';
    case 'em_andamento': return 'Em andamento';
    default: return 'Agendado';
  }
}

const iconSvg = (type: string) => {
  const s = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } as React.CSSProperties };
  const p = { stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'list': return React.createElement('svg', s, React.createElement('path', { ...p, d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' }));
    case 'check': return React.createElement('svg', s, React.createElement('path', { ...p, d: 'M22 11.08V12a10 10 0 11-5.93-9.14' }), React.createElement('path', { ...p, d: 'M22 4L12 14.01l-3-3' }));
    case 'calendar': return React.createElement('svg', s, React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ...p }), React.createElement('path', { ...p, d: 'M16 2v4M8 2v4M3 10h18' }));
    case 'send': return React.createElement('svg', s, React.createElement('path', { ...p, d: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z' }));
    case 'x': return React.createElement('svg', s, React.createElement('circle', { cx: 12, cy: 12, r: 10, ...p }), React.createElement('path', { ...p, d: 'M15 9l-6 6M9 9l6 6' }));
    default: return null;
  }
};

type TripRow = {
  id: string;
  rota: string;
  data: string;
  horarios: string;
  passageiros: number;
  bagageiro: string;
  preco: string;
  gastos: string;
  status: string;
};

const statusStyle: Record<string, { bg: string; color: string }> = {
  'Cancelado': { bg: '#eeafaa', color: '#551611' },
  'Agendado': { bg: '#a8c6ef', color: '#102d57' },
  'Em andamento': { bg: '#fee59a', color: '#654c01' },
  'Concluído': { bg: '#b0e8d1', color: '#174f38' },
};

const cols = [
  { label: 'ID', flex: '0 0 70px' },
  { label: 'Origem → Destino', flex: '1 1 22%' },
  { label: 'Data', flex: '0 0 90px' },
  { label: 'Horários', flex: '0 0 90px' },
  { label: 'Passageiros', flex: '0 0 80px' },
  { label: 'Bagageiro', flex: '0 0 72px' },
  { label: 'Preço Total', flex: '0 0 100px' },
  { label: 'Gastos', flex: '0 0 90px' },
  { label: 'Status', flex: '0 0 120px' },
];

const MONTH_INDEX: Record<string, number> = {
  'Janeiro': 0, 'Fevereiro': 1, 'Março': 2, 'Abril': 3, 'Maio': 4, 'Junho': 5,
  'Julho': 6, 'Agosto': 7, 'Setembro': 8, 'Outubro': 9, 'Novembro': 10, 'Dezembro': 11,
};

const FILTER_KEY: Record<string, ViagemListItem['status']> = {
  'Em andamento': 'em_andamento',
  'Agendadas': 'agendado',
  'Concluídas': 'concluído',
  'Canceladas': 'cancelado',
};

function itemsToRows(items: ViagemListItem[]): TripRow[] {
  return items.map((v) => ({
    id: `#${String(v.bookingId).slice(0, 8)}`,
    rota: `${v.origem} → ${v.destino}`,
    data: v.data,
    horarios: `${v.embarque} → ${v.chegada}`,
    passageiros: v.passengerCount,
    bagageiro: v.trunkOccupancyPct > 0 ? `${v.trunkOccupancyPct}%` : '—',
    preco: formatCurrencyBRL(v.amountCents),
    gastos: '—',
    status: viagemStatusLabel(v.status),
  }));
}

export default function HistoricoViagensScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeBookingId, mid: motoristaId } = useParams<{ id?: string; mid?: string }>();
  const [items, setItems] = useState<ViagemListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState('01 de setembro');
  const [filtroDataFim, setFiltroDataFim] = useState('31 de setembro');
  const [mesesOpen, setMesesOpen] = useState(false);
  const [mesSelected, setMesSelected] = useState('Todos os meses');
  const [filtroStatus, setFiltroStatus] = useState('Em andamento');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setLoadErr(null);
    const p = motoristaId
      ? fetchBookingsForDriver(motoristaId)
      : fetchViagens();
    p.then((list) => {
      if (cancel) return;
      setItems(list);
      setLoading(false);
    }).catch(() => {
      if (cancel) return;
      setLoadErr('Não foi possível carregar as viagens.');
      setItems([]);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [motoristaId]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const wantStatus = FILTER_KEY[filtroStatus];
    const monthIdx = mesSelected !== 'Todos os meses' ? MONTH_INDEX[mesSelected] : null;

    return items.filter((v) => {
      if (wantStatus && v.status !== wantStatus) return false;
      if (monthIdx != null) {
        const d = new Date(v.departureAtIso);
        if (Number.isNaN(d.getTime()) || d.getMonth() !== monthIdx) return false;
      }
      if (q) {
        const hay = `${v.origem} ${v.destino} ${v.passageiro}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, filtroStatus, mesSelected]);

  const trips = useMemo(() => itemsToRows(filteredItems), [filteredItems]);

  const metrics = useMemo(() => {
    const total = items.length;
    const concluidas = items.filter((v) => v.status === 'concluído').length;
    const agendadas = items.filter((v) => v.status === 'agendado').length;
    const andamento = items.filter((v) => v.status === 'em_andamento').length;
    const canceladas = items.filter((v) => v.status === 'cancelado').length;
    return [
      { title: 'Viagens totais', value: String(total), icon: 'list' },
      { title: 'Viagens concluídas', value: String(concluidas), icon: 'check' },
      { title: 'Viagens agendadas', value: String(agendadas), icon: 'calendar' },
      { title: 'Viagens em andamento', value: String(andamento), icon: 'send' },
      { title: 'Viagens canceladas', value: String(canceladas), icon: 'x' },
    ];
  }, [items]);

  const donutData = useMemo(() => {
    const total = items.length;
    if (!total) {
      return [
        { label: 'Sem dados', pct: 100, color: '#e2e2e2' },
      ];
    }
    const concluidas = items.filter((v) => v.status === 'concluído').length;
    const agendadas = items.filter((v) => v.status === 'agendado').length;
    const andamento = items.filter((v) => v.status === 'em_andamento').length;
    const canceladas = items.filter((v) => v.status === 'cancelado').length;
    const pct = (n: number) => Math.round((n / total) * 100);
    let d = [
      { label: 'Concluídas', pct: pct(concluidas), color: '#22c55e' },
      { label: 'Agendadas', pct: pct(agendadas), color: '#4A90D9' },
      { label: 'Em andamento', pct: pct(andamento), color: '#cba04b' },
      { label: 'Canceladas', pct: pct(canceladas), color: '#b53838' },
    ];
    const sum = d.reduce((a, x) => a + x.pct, 0);
    if (sum !== 100 && d[0]) d[0].pct += 100 - sum;
    return d;
  }, [items]);

  const fromLabel = location.pathname.startsWith('/motoristas') ? 'Motoristas'
    : location.pathname.startsWith('/passageiros') ? 'Passageiros'
    : 'Viagens';

  // ── Breadcrumb ──────────────────────────────────────────────────────
  const breadcrumb = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#767676', ...font },
  },
    React.createElement('span', null, fromLabel),
    React.createElement('span', { style: { margin: '0 4px' } }, '›'),
    React.createElement('span', { style: { color: '#0d0d0d' } }, 'Histórico completo de viagens'));

  const arrowBackSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M19 12H5M12 19l-7-7 7-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  // ── Search row ──────────────────────────────────────────────────────
  const searchRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' as const },
  },
    React.createElement('div', {
      style: { flex: '1 1 250px', display: 'flex', alignItems: 'center', gap: 8, background: '#f1f1f1', borderRadius: 999, height: 44, padding: '0 16px' },
    },
      searchIconSvg,
      React.createElement('input', {
        type: 'text', value: search, placeholder: 'Buscar origem ou destino...',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
        style: { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#0d0d0d', ...font },
      })),
    React.createElement('button', {
      type: 'button',
      onClick: () => setFiltroOpen(true),
      style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', background: '#f1f1f1', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font },
    }, filterIconSvg, 'Filtro'),
    React.createElement('div', { style: { position: 'relative' as const } },
      React.createElement('button', {
        type: 'button',
        onClick: () => setMesesOpen(!mesesOpen),
        style: { display: 'flex', alignItems: 'center', gap: 6, height: 44, padding: '0 16px', border: '1px solid #e2e2e2', borderRadius: 999, background: '#fff', fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font },
      }, mesSelected,
        React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
          React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
      null));

  const mesesDropdown = mesesOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },
    onClick: () => setMesesOpen(false),
  },
    React.createElement('div', {
      style: {
        position: 'fixed' as const, top: 160, right: 40, background: '#fff', borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)', minWidth: 220, maxHeight: 320,
        overflowY: 'auto' as const, padding: '8px 0',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      ...['Todos os meses', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) =>
        React.createElement('button', {
          key: m, type: 'button',
          onClick: () => { setMesSelected(m); setMesesOpen(false); },
          style: {
            display: 'block', width: '100%', padding: '12px 20px', background: 'none', border: 'none',
            fontSize: 14, fontWeight: mesSelected === m ? 700 : 400,
            color: i > 3 && m !== 'Todos os meses' ? '#d0d0d0' : '#0d0d0d',
            cursor: 'pointer', textAlign: 'left' as const, ...font,
          },
        }, m)))) : null;

  // ── Metric cards ────────────────────────────────────────────────────
  const metricCards = React.createElement('div', {
    style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, width: '100%' },
  },
    ...metrics.map((m, i) =>
      React.createElement('div', {
        key: m.title,
        style: {
          flex: i < 3 ? '1 1 calc(33% - 12px)' : '1 1 calc(50% - 8px)', minWidth: 180,
          background: '#f6f6f6', borderRadius: 16, padding: '16px 20px',
          display: 'flex', flexDirection: 'column' as const, gap: 8, boxSizing: 'border-box' as const,
        },
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#767676', ...font } }, m.title),
          iconSvg(m.icon)),
        React.createElement('span', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', ...font } }, m.value))));

  // ── Donut chart ─────────────────────────────────────────────────────
  let cumPct = 0;
  const gradStops = donutData.map((d) => {
    const start = cumPct;
    cumPct += d.pct;
    return `${d.color} ${start}% ${cumPct}%`;
  }).join(', ');

  const chartSection = React.createElement('div', {
    style: { width: '100%', background: '#f6f6f6', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 16, boxSizing: 'border-box' as const },
  },
    React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Distribuição por status'),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { width: 200, height: 200, borderRadius: '50%', background: `conic-gradient(${gradStops})`, position: 'relative' as const } },
        React.createElement('div', { style: { position: 'absolute' as const, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 100, height: 100, borderRadius: '50%', background: '#f6f6f6' } })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10 } },
        ...donutData.map((d) =>
          React.createElement('div', { key: d.label, style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('div', { style: { width: 14, height: 14, borderRadius: '50%', background: d.color } }),
            React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: d.color, ...font } }, `${d.label} (${d.pct}%)`))))));

  // ── Table ───────────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 13, color: '#0d0d0d', ...font, padding: '0 6px' };

  const tableHeader = React.createElement('div', {
    style: { display: 'flex', height: 48, background: '#e2e2e2', padding: '0 16px', alignItems: 'center' },
  },
    ...cols.map((c) => React.createElement('div', {
      key: c.label, style: { flex: c.flex, fontSize: 12, fontWeight: 400, color: '#767676', ...font, padding: '0 6px', display: 'flex', alignItems: 'center' },
    }, c.label)));

  const tableRows = trips.map((t, idx) => {
    const st = statusStyle[t.status] || statusStyle['Agendado'];
    return React.createElement('div', {
      key: idx,
      style: { display: 'flex', minHeight: 56, alignItems: 'center', padding: '6px 16px', borderBottom: '1px solid #e8e8e8', background: '#f6f6f6' },
    },
      React.createElement('div', { style: { ...cellBase, flex: cols[0].flex, fontWeight: 600 } }, t.id),
      React.createElement('div', { style: { ...cellBase, flex: cols[1].flex } }, t.rota),
      React.createElement('div', { style: { ...cellBase, flex: cols[2].flex } }, t.data),
      React.createElement('div', { style: { ...cellBase, flex: cols[3].flex, whiteSpace: 'nowrap' as const } }, t.horarios),
      React.createElement('div', { style: { ...cellBase, flex: cols[4].flex, justifyContent: 'center' } }, String(t.passageiros)),
      React.createElement('div', { style: { ...cellBase, flex: cols[5].flex } }, t.bagageiro),
      React.createElement('div', { style: { ...cellBase, flex: cols[6].flex, fontWeight: 600 } }, t.preco),
      React.createElement('div', { style: { ...cellBase, flex: cols[7].flex } }, t.gastos),
      React.createElement('div', { style: { ...cellBase, flex: cols[8].flex } },
        React.createElement('span', {
          style: { padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color, whiteSpace: 'nowrap' as const, ...font },
        }, t.status)));
  });

  const tableSection = React.createElement('div', {
    style: { background: '#f6f6f6', borderRadius: 16, overflow: 'hidden', width: '100%' },
  },
    React.createElement('div', { style: { padding: '20px 24px' } },
      React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Lista de viagens')),
    React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
      tableHeader,
      loading
        ? React.createElement('div', { style: { padding: 24, ...font, color: '#767676' } }, 'Carregando…')
        : loadErr
          ? React.createElement('div', { style: { padding: 24, color: '#b53838', ...font } }, loadErr)
          : trips.length === 0
            ? React.createElement('div', { style: { padding: 24, color: '#767676', ...font } }, 'Nenhuma viagem neste filtro.')
            : React.createElement(React.Fragment, null, ...tableRows)));

  // ── Filtro modal ─────────────────────────────────────────────────────
  const calIconSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
    React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
    React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));

  const statusChips = ['Em andamento', 'Agendadas', 'Concluídas', 'Canceladas'];

  const filtroModal = filtroOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    onClick: () => setFiltroOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: '28px 32px', display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,.15)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro'),
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', ...font } }, 'Data da atividade'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Data inicial'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px' } },
          calIconSvg,
          React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, filtroDataInicio))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Data final'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px' } },
          calIconSvg,
          React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, filtroDataFim))),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', ...font } }, 'Status da viagem'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...statusChips.map((s) =>
          React.createElement('button', {
            key: s, type: 'button', onClick: () => setFiltroStatus(s),
            style: {
              height: 36, padding: '0 16px', borderRadius: 999,
              border: filtroStatus === s ? 'none' : '1px solid #e2e2e2',
              background: filtroStatus === s ? '#0d0d0d' : '#fff',
              color: filtroStatus === s ? '#fff' : '#0d0d0d',
              fontSize: 14, fontWeight: 500, cursor: 'pointer', ...font,
            },
          }, s))),
      React.createElement('button', {
        type: 'button', onClick: () => setFiltroOpen(false),
        style: { height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
      }, 'Aplicar filtro'),
      React.createElement('button', {
        type: 'button', onClick: () => setFiltroOpen(false),
        style: { height: 40, background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font },
      }, 'Voltar'))) : null;

  const ctxNote = routeBookingId
    ? React.createElement('p', { style: { fontSize: 12, color: '#767676', margin: '0 0 8px', ...font } }, `Contexto: reserva ${routeBookingId.slice(0, 8)}…`)
    : null;

  return React.createElement('div', { style: { ...webStyles.detailPage, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
    ctxNote,
    breadcrumb,
    React.createElement('button', {
      type: 'button', onClick: () => navigate(-1),
      style: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', padding: 0, ...font },
    }, arrowBackSvg, 'Voltar'),
    searchRow,
    metricCards,
    chartSection,
    tableSection,
    filtroModal,
    mesesDropdown);
}
