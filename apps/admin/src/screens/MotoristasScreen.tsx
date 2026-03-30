/**
 * MotoristasScreen — Lista de motoristas conforme Figma 825-4375.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';
import { fetchMotoristas, fetchMotoristaTableRows } from '../data/queries';
import type { MotoristaListItem } from '../data/types';
import type { MotoristaTableRow } from '../data/queries';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// SVG icons for view/edit actions
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const pencilActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Edit/swap icon for "Trocar motorista" button
const swapIconSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Avatar colors by initial
const avatarColors: Record<string, string> = {
  C: '#4A90D9', J: '#7B61FF', E: '#E8725C', M: '#50C878', D: '#F5A623',
};

type MotoristaRow = {
  nome: string;
  origem: string;
  destino: string;
  data: string;
  embarque: string;
  chegada: string;
  status: 'Concluído' | 'Cancelado' | 'Agendado' | 'Em andamento';
};

const tableCols = [
  { label: 'Motoristas', flex: '1 1 15%', minWidth: 140 },
  { label: 'Origem', flex: '1 1 15%', minWidth: 120 },
  { label: 'Destino', flex: '1 1 15%', minWidth: 120 },
  { label: 'Data', flex: '0 0 96px', minWidth: 96 },
  { label: 'Embarque', flex: '0 0 76px', minWidth: 76 },
  { label: 'Chegada', flex: '0 0 72px', minWidth: 72 },
  { label: 'Status', flex: '0 0 120px', minWidth: 120 },
  { label: 'Visualizar/Editar', flex: '0 0 90px', minWidth: 90 },
];

const statusStyles: Record<string, { bg: string; color: string }> = {
  'Concluído': { bg: '#b0e8d1', color: '#174f38' },
  'Cancelado': { bg: '#eeafaa', color: '#551611' },
  'Agendado': { bg: '#a8c6ef', color: '#102d57' },
  'Em andamento': { bg: '#fee59a', color: '#654c01' },
};

// ── Chart legend items ────────────────────────────────────────────────
const chartLegend = [
  { label: 'Quantidade no app', color: '#22c55e' },
  { label: 'Quantidade de parceiros', color: '#3b82f6' },
  { label: 'Avaliação média geral', color: '#cba04b' },
];

// ── Local styles ──────────────────────────────────────────────────────
const s = {
  metricCard: {
    flex: '1 1 0', minWidth: 0, background: '#f6f6f6', borderRadius: 16,
    padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 24,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  metricTitle: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } as React.CSSProperties,
  metricValue: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } as React.CSSProperties,
  wideCard: {
    flex: '1 1 calc(50% - 12px)', minWidth: 280, background: '#f6f6f6', borderRadius: 16,
    padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 16,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  chartCard: {
    width: '100%', background: '#f6f6f6', borderRadius: 16, padding: 24,
    display: 'flex', flexDirection: 'column' as const, gap: 16, boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  donutWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  donut: {
    width: 200, height: 200, borderRadius: '50%', position: 'relative' as const, flexShrink: 0,
  } as React.CSSProperties,
  donutHole: {
    position: 'absolute' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: 80, height: 80, borderRadius: '50%', background: '#f6f6f6',
  } as React.CSSProperties,
  legendWrap: { display: 'flex', flexDirection: 'column' as const, gap: 12 } as React.CSSProperties,
  legendItem: { display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  legendDot: { width: 16, height: 16, borderRadius: '50%', flexShrink: 0 } as React.CSSProperties,
  legendText: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } as React.CSSProperties,
};

export default function MotoristasScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [trocarOpen, setTrocarOpen] = useState(false);
  const [trocarSelected, setTrocarSelected] = useState(0);
  const [trocarDate, setTrocarDate] = useState('01 de setembro');
  const [trocarMotivo, setTrocarMotivo] = useState('');
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroDateInicio, setFiltroDateInicio] = useState('05 de setembro');
  const [filtroDateFim, setFiltroDateFim] = useState('30 de setembro');
  const [filtroDatasIncluidas, setFiltroDatasIncluidas] = useState<'passadas' | 'passadas_futuras' | 'futuras'>('passadas_futuras');
  const [filtroStatus, setFiltroStatus] = useState<'em_andamento' | 'agendadas' | 'concluidas' | 'canceladas'>('em_andamento');
  const [filtroCategoria, setFiltroCategoria] = useState<'todos' | 'take_me' | 'parceiro'>('take_me');
  // Table filter state
  const [tblFilterOpen, setTblFilterOpen] = useState(false);
  const [tblIdMotorista, setTblIdMotorista] = useState('');
  const [tblNomeMotorista, setTblNomeMotorista] = useState('');
  const [tblIdViagem, setTblIdViagem] = useState('');
  const [tblOrigem, setTblOrigem] = useState('');
  const [tblDestino, setTblDestino] = useState('');
  const [tblEmbarque, setTblEmbarque] = useState('');
  const [tblChegada, setTblChegada] = useState('');
  const [tblDataInicial, setTblDataInicial] = useState('01 de setembro');
  const [tblFiltroCategoria, setTblFiltroCategoria] = useState('Take Me');

  // ── Real data from Supabase ─────────────────────────────────────────
  const [motoristasData, setMotoristasData] = useState<MotoristaListItem[]>([]);
  const [tableData, setTableData] = useState<MotoristaTableRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMotoristas(), fetchMotoristaTableRows()]).then(([stats, rows]) => {
      if (!cancelled) { setMotoristasData(stats); setTableData(rows); setDataLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const totalMotoristas = motoristasData.length;
  const emViagem = motoristasData.filter((m) => m.viagensAtivas > 0).length;
  const semViagem = motoristasData.filter((m) => m.viagensAtivas === 0).length;
  const comAgendadas = motoristasData.filter((m) => m.viagensAgendadas > 0).length;

  const metrics = [
    { title: 'Totais de motoristas', value: String(totalMotoristas) },
    { title: 'Motoristas em viagens', value: String(emViagem) },
    { title: 'Motoristas sem viagem', value: String(semViagem) },
    { title: 'Motoristas com viagens agendadas', value: String(comAgendadas) },
  ];

  const topDrivers = motoristasData.slice(0, 5).map((m) => ({ viagens: m.totalViagens, nome: m.nome }));

  const filteredTableData = tableData.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.nome.toLowerCase().includes(q) && !t.origem.toLowerCase().includes(q) && !t.destino.toLowerCase().includes(q)) return false;
    }
    const nn = tblNomeMotorista.trim().toLowerCase();
    if (nn && !t.nome.toLowerCase().includes(nn)) return false;
    const oo = tblOrigem.trim().toLowerCase();
    if (oo && !t.origem.toLowerCase().includes(oo)) return false;
    const dd = tblDestino.trim().toLowerCase();
    if (dd && !t.destino.toLowerCase().includes(dd)) return false;
    const he = tblEmbarque.trim().toLowerCase();
    if (he && !t.embarque.toLowerCase().includes(he)) return false;
    const hc = tblChegada.trim().toLowerCase();
    if (hc && !t.chegada.toLowerCase().includes(hc)) return false;
    const vid = tblIdViagem.trim().toLowerCase().replace(/#/g, '');
    if (vid && !t.tripId.toLowerCase().includes(vid) && !t.data.toLowerCase().includes(vid)) return false;
    const mid = tblIdMotorista.trim().toLowerCase().replace(/#/g, '');
    if (mid && !t.driverId.toLowerCase().includes(mid) && !t.nome.toLowerCase().includes(mid)) return false;

    if (filtroStatus === 'em_andamento' && t.status !== 'Em andamento') return false;
    if (filtroStatus === 'agendadas' && t.status !== 'Agendado') return false;
    if (filtroStatus === 'concluidas' && t.status !== 'Concluído') return false;
    if (filtroStatus === 'canceladas' && t.status !== 'Cancelado') return false;

    return true;
  });

  const tableRows: MotoristaRow[] = filteredTableData.map((t) => ({
    nome: t.nome,
    origem: t.origem,
    destino: t.destino,
    data: t.data,
    embarque: t.embarque,
    chegada: t.chegada,
    status: t.status,
  }));

  // ── Search row ────────────────────────────────────────────────────────
  const searchRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' as const },
  },
    // Search input
    React.createElement('div', {
      style: {
        flex: '1 1 300px', display: 'flex', alignItems: 'center', gap: 8,
        background: '#f1f1f1', borderRadius: 999, height: 44, paddingLeft: 16, paddingRight: 16,
      },
    },
      searchIconSvg,
      React.createElement('input', {
        type: 'text', value: search, placeholder: 'Buscar motorista, destino ou origem...',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
        style: {
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          fontSize: 14, color: '#0d0d0d', ...font,
        },
      })),
    // Trocar motorista button
    React.createElement('button', {
      type: 'button',
      onClick: () => setTrocarOpen(true),
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, swapIconSvg, 'Trocar motorista'),
    // Filtro button
    React.createElement('button', {
      type: 'button',
      onClick: () => setFiltroOpen(true),
      'data-testid': 'motoristas-open-page-filter',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, filterIconSvg, 'Filtro'));

  // ── Top metric cards (4) ──────────────────────────────────────────────
  const metricCards = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    ...metrics.map((m) =>
      React.createElement('div', { key: m.title, style: s.metricCard },
        React.createElement('p', { style: s.metricTitle }, m.title),
        React.createElement('p', { style: s.metricValue }, m.value))));

  // ── Second row: Média de km + Top motoristas ──────────────────────────
  const secondRow = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    // Média de km
    React.createElement('div', { style: s.wideCard },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, 'Média de km por viagens'),
      React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, '1')),
    // Top motoristas
    React.createElement('div', { style: s.wideCard },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, 'Motoristas com maior números de viagens'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        ...topDrivers.map((d) =>
          React.createElement('p', {
            key: d.nome,
            style: { fontSize: 16, fontWeight: 400, color: '#0d0d0d', margin: 0, ...font },
          },
            `${d.viagens} viagens • `,
            React.createElement('span', { style: { fontWeight: 700 } }, d.nome))))));

  // ── Donut chart section ───────────────────────────────────────────────
  const donutGradient = 'conic-gradient(#22c55e 0% 40%, #3b82f6 40% 75%, #cba04b 75% 100%)';
  const chartSection = React.createElement('div', { style: s.chartCard },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Distribuição de viagens por status'),
    React.createElement('p', { style: { fontSize: 14, fontWeight: 400, color: '#767676', margin: 0, ...font } }, 'Dados consolidados com base no período selecionado'),
    React.createElement('div', { style: s.donutWrap },
      React.createElement('div', { style: { ...s.donut, background: donutGradient } },
        React.createElement('div', { style: s.donutHole })),
      React.createElement('div', { style: s.legendWrap },
        ...chartLegend.map((item) =>
          React.createElement('div', { key: item.label, style: s.legendItem },
            React.createElement('div', { style: { ...s.legendDot, background: item.color } }),
            React.createElement('span', { style: s.legendText }, item.label))))));

  // ── Table section ─────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 8px' };

  // Table filter toolbar
  const tableToolbar = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 80, padding: '20px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0',
    },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font } }, 'Lista de motoristas'),
    React.createElement('button', {
      type: 'button',
      onClick: () => setTblFilterOpen(true),
      'data-testid': 'motoristas-open-table-filter',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '8px 24px',
        background: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer',
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font,
      },
    }, filterIconSvg, 'Filtro'));

  // Table header
  const tableHeader = React.createElement('div', {
    style: {
      display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9',
      padding: '0 16px', alignItems: 'center',
    },
  },
    ...tableCols.map((c) => React.createElement('div', {
      key: c.label,
      style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%' },
    }, c.label)));

  // Table rows
  const tableRowEls = tableRows.map((row, idx) => {
    const trip = filteredTableData[idx];
    const initial = row.nome.charAt(0);
    const avatarBg = avatarColors[initial] || '#999';
    const st = statusStyles[row.status] || { bg: '#eee', color: '#333' };

    return React.createElement('div', {
      key: trip?.tripId ?? idx,
      'data-testid': 'motorista-table-row',
      style: {
        display: 'flex', height: 64, alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid #d9d9d9', background: '#f6f6f6',
      },
    },
      // Motoristas (avatar + name)
      React.createElement('div', {
        style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, gap: 8, overflow: 'hidden' },
      },
        React.createElement('div', {
          style: {
            width: 36, height: 36, borderRadius: '50%', background: avatarBg, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          },
        }, React.createElement('span', { style: { color: '#fff', fontSize: 14, fontWeight: 600, ...font } }, initial)),
        React.createElement('span', { style: { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 13 } }, row.nome)),
      // Origem
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 13 } }, row.origem),
      // Destino
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 13 } }, row.destino),
      // Data
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, row.data),
      // Embarque
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } }, row.embarque),
      // Chegada
      React.createElement('div', { style: { ...cellBase, flex: tableCols[5].flex, minWidth: tableCols[5].minWidth } }, row.chegada),
      // Status
      React.createElement('div', { style: { ...cellBase, flex: tableCols[6].flex, minWidth: tableCols[6].minWidth } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' as const,
            background: st.bg, color: st.color, ...font,
          },
        }, row.status)),
      // Visualizar/Editar
      React.createElement('div', {
        style: { flex: tableCols[7].flex, minWidth: tableCols[7].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
      },
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar', onClick: () => {
          const t = trip;
          if (!t) return;
          navigate(`/motoristas/${t.driverId}/viagem/${t.tripId}`, { state: { trip: { passageiro: t.nome, origem: t.origem, destino: t.destino, data: t.data, embarque: t.embarque, chegada: t.chegada, status: t.status === 'Concluído' ? 'concluído' : t.status === 'Cancelado' ? 'cancelado' : t.status === 'Agendado' ? 'agendado' : 'em_andamento' } } });
        } }, eyeActionSvg),
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar', onClick: () => { if (trip) navigate(`/motoristas/${trip.driverId}/editar`); } }, pencilActionSvg)));
  });

  const tableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
      tableToolbar,
      React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
        tableHeader,
        ...tableRowEls)));

  if (dataLoading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Carregando motoristas...'));
  }

  // ── Trocar motorista slide panel ──────────────────────────────────────
  const tmDrivers = tableData.length > 0
    ? [...new Map(tableData.map((t) => [t.driverId, t])).values()].map((t, i) => ({
        nome: t.nome, rota: `${t.origem} → ${t.destino}`, data: t.data,
        valorTotal: 'R$ 150,00', valorUnitario: 'R$ 75,00', pessoasRestantes: '2', ocupacao: '80%',
      }))
    : [{ nome: 'Motorista', rota: '—', data: '—', valorTotal: '—', valorUnitario: '—', pessoasRestantes: '—', ocupacao: '—' }];

  const radioSvg = (selected: boolean) => React.createElement('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' },
    React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#0d0d0d', strokeWidth: 2, fill: 'none' }),
    selected ? React.createElement('circle', { cx: 12, cy: 12, r: 5, fill: '#0d0d0d' }) : null);

  const tmField = (label: string, val: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: '#0d0d0d', ...font } }, label),
      React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, val));

  const trocarMotoristaPanel = trocarOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 },
    onClick: () => setTrocarOpen(false),
  },
    React.createElement('div', {
      style: {
        position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 480,
        background: '#fff', borderRadius: '16px 0 0 16px', padding: '28px 24px',
        display: 'flex', flexDirection: 'column' as const, gap: 20,
        overflowY: 'auto' as const, maxHeight: '100vh',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' } },
        React.createElement('div', null,
          React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Trocar motorista'),
          React.createElement('p', { style: { fontSize: 13, color: '#767676', margin: '4px 0 0', ...font } }, 'Selecione outro motorista disponível para continuar.')),
        React.createElement('button', {
          type: 'button', onClick: () => setTrocarOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Data da atividade
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Data da atividade'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Data'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px' } },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
            React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
            React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' })),
          React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, trocarDate))),
      // Viagem atual
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Viagem atual'),
      ...tmDrivers.slice(0, 1).map((d, i) =>
        React.createElement('button', {
          key: `current-${i}`, type: 'button',
          onClick: () => setTrocarSelected(i),
          style: { display: 'flex', gap: 12, alignItems: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' as const },
        },
          radioSvg(trocarSelected === i),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
            React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, d.nome),
            tmField('Origem - Destino', d.rota),
            tmField('Data', d.data),
            tmField('Valor total', d.valorTotal),
            tmField('Valor unitário', d.valorUnitario),
            tmField('Pessoas restantes', d.pessoasRestantes),
            tmField('Ocupação do bagageiro', d.ocupacao)))),
      // Outras viagens disponíveis
      tmDrivers.length > 1 ? React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Outras viagens disponíveis') : null,
      ...tmDrivers.slice(1).map((d, i) =>
        React.createElement('button', {
          key: `other-${i}`, type: 'button',
          onClick: () => setTrocarSelected(i + 1),
          style: { display: 'flex', gap: 12, alignItems: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' as const },
        },
          radioSvg(trocarSelected === i + 1),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
            React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, d.nome),
            tmField('Origem - Destino', d.rota),
            tmField('Data', d.data),
            tmField('Valor total', d.valorTotal),
            tmField('Valor unitário', d.valorUnitario),
            tmField('Pessoas restantes', d.pessoasRestantes),
            tmField('Ocupação do bagageiro', d.ocupacao)))),
      // Motivo
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Motivo da troca'),
        React.createElement('textarea', {
          value: trocarMotivo,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setTrocarMotivo(e.target.value),
          placeholder: 'Descreva o motivo da troca...',
          style: { width: '100%', minHeight: 80, borderRadius: 8, border: '1px solid #e2e2e2', padding: 12, fontSize: 14, color: '#0d0d0d', resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const, ...font },
        })),
      // Buttons
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, marginTop: 8 } },
        React.createElement('button', {
          type: 'button', onClick: () => setTrocarOpen(false),
          style: { height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Confirmar troca'),
        React.createElement('button', {
          type: 'button', onClick: () => setTrocarOpen(false),
          style: { height: 48, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#0d0d0d', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Cancelar')))) : null;

  // ── Filtro modal ───────────────────────────────────────────────────────
  const fRadio = (selected: boolean, label: string, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', onClick,
      style: { display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' },
    },
      React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#0d0d0d', strokeWidth: 2 }),
        selected ? React.createElement('circle', { cx: 12, cy: 12, r: 5, fill: '#0d0d0d' }) : null),
      React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, label));

  const fChip = (label: string, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', onClick,
      style: {
        height: 36, padding: '0 16px', borderRadius: 999,
        border: active ? 'none' : '1px solid #e2e2e2',
        background: active ? '#0d0d0d' : '#fff', color: active ? '#fff' : '#0d0d0d',
        fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const, ...font,
      },
    }, label);

  const fDateField = (label: string, value: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, label),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px' } },
        React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
          React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' })),
        React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, value)));

  const filtroModal = filtroOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setFiltroOpen(false),
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': 'motoristas-filtro-pagina-titulo',
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)', maxHeight: '90vh', overflowY: 'auto' as const,
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { id: 'motoristas-filtro-pagina-titulo', style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro'),
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Data da atividade
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Data da atividade'),
      fDateField('Data inicial', filtroDateInicio),
      fDateField('Data final', filtroDateFim),
      // Datas incluídas
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Datas incluídas'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        fRadio(filtroDatasIncluidas === 'passadas', 'Somente passadas', () => setFiltroDatasIncluidas('passadas')),
        fRadio(filtroDatasIncluidas === 'passadas_futuras', 'Passadas e futuras', () => setFiltroDatasIncluidas('passadas_futuras')),
        fRadio(filtroDatasIncluidas === 'futuras', 'Somente futuras', () => setFiltroDatasIncluidas('futuras'))),
      // Status da viagem
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Status da viagem'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        fChip('Em andamento', filtroStatus === 'em_andamento', () => setFiltroStatus('em_andamento')),
        fChip('Agendadas', filtroStatus === 'agendadas', () => setFiltroStatus('agendadas')),
        fChip('Concluídas', filtroStatus === 'concluidas', () => setFiltroStatus('concluidas')),
        fChip('Canceladas', filtroStatus === 'canceladas', () => setFiltroStatus('canceladas'))),
      // Categoria
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Categoria'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        fChip('Todos', filtroCategoria === 'todos', () => setFiltroCategoria('todos')),
        fChip('Take Me', filtroCategoria === 'take_me', () => setFiltroCategoria('take_me')),
        fChip('Motorista parceiro', filtroCategoria === 'parceiro', () => setFiltroCategoria('parceiro'))),
      // Buttons
      React.createElement('button', {
        type: 'button', onClick: () => setFiltroOpen(false),
        style: { height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
      }, 'Aplicar filtro'),
      React.createElement('button', {
        type: 'button', onClick: () => setFiltroOpen(false),
        style: { height: 48, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#0d0d0d', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
      }, 'Voltar'))) : null;

  // ── Table filter modal (Filtro da tabela) ──────────────────────────────
  const tblField = (label: string, placeholder: string, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
      React.createElement('input', {
        type: 'text', value, placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        style: { height: 44, borderRadius: 8, background: '#f1f1f1', border: 'none', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
      }));

  const tblChip = (label: string, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', onClick,
      style: {
        height: 36, padding: '0 16px', borderRadius: 999,
        border: active ? 'none' : '1px solid #e2e2e2',
        background: active ? '#0d0d0d' : '#fff', color: active ? '#fff' : '#0d0d0d',
        fontSize: 14, fontWeight: 500, cursor: 'pointer', ...font,
      },
    }, label);

  const calSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
    React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
    React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));

  const tblFilterModal = tblFilterOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    onClick: () => setTblFilterOpen(false),
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': 'motoristas-filtro-tabela-titulo',
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: '28px 32px', display: 'flex', flexDirection: 'column' as const, gap: 16, boxShadow: '0 20px 60px rgba(0,0,0,.15)', maxHeight: '90vh', overflowY: 'auto' as const },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { id: 'motoristas-filtro-tabela-titulo', style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro da tabela'),
        React.createElement('button', {
          type: 'button', onClick: () => setTblFilterOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Fields
      tblField('Id do motorista', 'Ex: #12312312', tblIdMotorista, setTblIdMotorista),
      tblField('Nome do motorista', 'Ex: Carlos Silva', tblNomeMotorista, setTblNomeMotorista),
      tblField('ID da viagem', 'Ex: #12312312', tblIdViagem, setTblIdViagem),
      tblField('Origem', 'Ex: São Paulo, SP', tblOrigem, setTblOrigem),
      tblField('Destino', 'Ex: Rio de janeiro, JR', tblDestino, setTblDestino),
      tblField('Hora do embarque', 'Ex: 09:00', tblEmbarque, setTblEmbarque),
      tblField('Hora de chegada', 'Ex: 12:00', tblChegada, setTblChegada),
      // Data inicial
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Data inicial'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px' } },
          calSvg,
          React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, tblDataInicial))),
      // Status da viagem
      React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', ...font } }, 'Status da viagem'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...([
          { id: 'em_andamento' as const, label: 'Em andamento' },
          { id: 'agendadas' as const, label: 'Agendadas' },
          { id: 'concluidas' as const, label: 'Concluídas' },
          { id: 'canceladas' as const, label: 'Canceladas' },
        ].map((o) =>
          tblChip(o.label, filtroStatus === o.id, () => setFiltroStatus(o.id))))),
      // Categoria
      React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', ...font } }, 'Categoria'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...['Todos', 'Take Me', 'Motorista parceiro'].map((c) =>
          tblChip(c, tblFiltroCategoria === c, () => setTblFiltroCategoria(c)))),
      // Buttons
      React.createElement('button', {
        type: 'button', onClick: () => setTblFilterOpen(false),
        style: { height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
      }, 'Aplicar filtro'),
      React.createElement('button', {
        type: 'button', onClick: () => setTblFilterOpen(false),
        style: { height: 40, background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font },
      }, 'Voltar'))) : null;

  // ── Render ─────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Motoristas'),
    searchRow,
    metricCards,
    secondRow,
    chartSection,
    tableSection,
    trocarMotoristaPanel,
    filtroModal,
    tblFilterModal);
}
