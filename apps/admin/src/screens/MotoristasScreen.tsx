/**
 * MotoristasScreen — Lista de motoristas (padrão HomeScreen/ViagensScreen).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';
import { fetchMotoristas, fetchMotoristaTableRows } from '../data/queries';
import type { MotoristaListItem } from '../data/types';
import type { MotoristaTableRow } from '../data/queries';

const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = require('recharts');

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// ── SVG icons ─────────────────────────────────────────────────────────────
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const pencilActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const swapIconSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const closeSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

// ── Table columns ─────────────────────────────────────────────────────────
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

// ── Avatar helper ─────────────────────────────────────────────────────────
const renderAvatar = (nome: string, avatarUrl?: string | null) => {
  const initial = (nome || '?')[0].toUpperCase();
  const colors = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899'];
  const bg = colors[initial.charCodeAt(0) % colors.length];
  if (avatarUrl) return React.createElement('img', { src: avatarUrl, alt: nome, style: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 } });
  return React.createElement('div', { style: { width: 36, height: 36, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0, ...font } }, initial);
};

export default function MotoristasScreen() {
  const navigate = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────
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

  // ── Search & filter state ─────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'em_andamento' | 'agendadas' | 'concluidas' | 'canceladas'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<'todos' | 'take_me' | 'parceiro'>('todos');
  const [filtroDateInicio, setFiltroDateInicio] = useState('');
  const [filtroDateFim, setFiltroDateFim] = useState('');

  // ── Table filter state ─────────────────────────────────────────────────
  const [tblFilterOpen, setTblFilterOpen] = useState(false);
  const [tblNomeMotorista, setTblNomeMotorista] = useState('');
  const [tblOrigem, setTblOrigem] = useState('');
  const [tblDestino, setTblDestino] = useState('');

  // ── Trocar motorista panel ─────────────────────────────────────────────
  const [trocarOpen, setTrocarOpen] = useState(false);
  const [trocarSelected, setTrocarSelected] = useState(0);
  const [trocarDate, setTrocarDate] = useState('01 de setembro');
  const [trocarMotivo, setTrocarMotivo] = useState('');

  // ── Filtered table data ────────────────────────────────────────────────
  const filteredTableData = useMemo(() => {
    return tableData.filter((t) => {
      const q = search.toLowerCase();
      if (q && !t.nome.toLowerCase().includes(q) && !t.origem.toLowerCase().includes(q) && !t.destino.toLowerCase().includes(q)) return false;

      if (filtroStatus !== 'todos') {
        const expected = filtroStatus === 'em_andamento' ? 'Em andamento'
          : filtroStatus === 'agendadas' ? 'Agendado'
          : filtroStatus === 'concluidas' ? 'Concluído'
          : 'Cancelado';
        if (t.status !== expected) return false;
      }
      if (filtroCategoria === 'take_me' && t.categoria !== 'take_me') return false;
      if (filtroCategoria === 'parceiro' && t.categoria !== 'parceiro') return false;

      if (tblNomeMotorista && !t.nome.toLowerCase().includes(tblNomeMotorista.toLowerCase())) return false;
      if (tblOrigem && !t.origem.toLowerCase().includes(tblOrigem.toLowerCase())) return false;
      if (tblDestino && !t.destino.toLowerCase().includes(tblDestino.toLowerCase())) return false;

      return true;
    });
  }, [tableData, search, filtroStatus, filtroCategoria, tblNomeMotorista, tblOrigem, tblDestino]);

  // ── Status counts from filtered table data (for pie chart) ────────────
  const statusCounts = useMemo(() => {
    const c = { concluidas: 0, agendadas: 0, emAndamento: 0, canceladas: 0, total: 0 };
    filteredTableData.forEach((t) => {
      c.total++;
      if (t.status === 'Concluído') c.concluidas++;
      else if (t.status === 'Agendado') c.agendadas++;
      else if (t.status === 'Em andamento') c.emAndamento++;
      else if (t.status === 'Cancelado') c.canceladas++;
    });
    return c;
  }, [filteredTableData]);

  const pieData = useMemo(() => [
    { name: 'Concluídas', value: statusCounts.concluidas, color: '#0d8344' },
    { name: 'Agendadas', value: statusCounts.agendadas, color: '#016df9' },
    { name: 'Em andamento', value: statusCounts.emAndamento, color: '#cba04b' },
    { name: 'Canceladas', value: statusCounts.canceladas, color: '#d64545' },
  ].filter((d) => d.value > 0), [statusCounts]);

  // ── KPI metrics ───────────────────────────────────────────────────────
  const totalMotoristas = motoristasData.length;
  const emViagem = motoristasData.filter((m) => m.viagensAtivas > 0).length;
  const semViagem = motoristasData.filter((m) => m.viagensAtivas === 0).length;
  const comAgendadas = motoristasData.filter((m) => m.viagensAgendadas > 0).length;
  const topDrivers = motoristasData.slice(0, 5);
  const ratingList = motoristasData.filter((m) => m.rating != null && m.rating > 0);
  const avgRating = ratingList.length > 0
    ? (ratingList.reduce((s, m) => s + (m.rating ?? 0), 0) / ratingList.length).toFixed(1)
    : '—';

  // ── Pie tooltip ────────────────────────────────────────────────────────
  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const total = statusCounts.total || 1;
    const pct = Math.round((d.value / total) * 100);
    return React.createElement('div', {
      style: { background: '#0d0d0d', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, ...font, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' },
    }, `${d.name}: ${pct}% (${d.value})`);
  };

  // ── Chip helper ────────────────────────────────────────────────────────
  const fChip = (label: string, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', key: label, onClick,
      style: { padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, ...font, background: active ? '#0d0d0d' : '#f1f1f1', color: active ? '#fff' : '#0d0d0d' },
    }, label);

  // ── Loading state ──────────────────────────────────────────────────────
  if (dataLoading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', ...font } }, 'Carregando motoristas...'));
  }

  // ── Metric card ────────────────────────────────────────────────────────
  const metricCard = (title: string, value: string) =>
    React.createElement('div', { key: title, style: { flex: '1 1 0', minWidth: 0, background: '#f6f6f6', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 24, boxSizing: 'border-box' as const } },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, title),
      React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, value));

  const metricCards = React.createElement('div', { style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const } },
    metricCard('Total de motoristas', String(totalMotoristas)),
    metricCard('Motoristas em viagem', String(emViagem)),
    metricCard('Motoristas sem viagem', String(semViagem)),
    metricCard('Com viagens agendadas', String(comAgendadas)));

  // ── Second row: avg rating + top drivers ──────────────────────────────
  const secondRow = React.createElement('div', { style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const } },
    React.createElement('div', { style: { flex: '1 1 calc(50% - 12px)', minWidth: 280, background: '#f6f6f6', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 16, boxSizing: 'border-box' as const } },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, 'Avaliação média geral'),
      React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, avgRating)),
    React.createElement('div', { style: { flex: '1 1 calc(50% - 12px)', minWidth: 280, background: '#f6f6f6', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 16, boxSizing: 'border-box' as const } },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, 'Motoristas com maior número de viagens'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        ...topDrivers.map((d) =>
          React.createElement('p', { key: d.id, style: { fontSize: 14, fontWeight: 400, color: '#0d0d0d', margin: 0, ...font } },
            `${d.totalViagens} viagens • `,
            React.createElement('span', { style: { fontWeight: 700 } }, d.nome))))));

  // ── Pie chart section ─────────────────────────────────────────────────
  const dot = (color: string) => ({ width: 20, height: 20, borderRadius: '50%', background: color, flexShrink: 0 });

  const chartSection = React.createElement('div', { style: { background: '#f6f6f6', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Distribuição de viagens'),
    React.createElement('p', { style: { fontSize: 14, fontWeight: 400, color: '#767676', margin: 0, ...font } }, 'Dados consolidados com base no período selecionado'),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { width: 280, height: 280, flexShrink: 0 } },
        React.createElement(ResponsiveContainer, { width: '100%', height: '100%' },
          React.createElement(PieChart, null,
            React.createElement(Pie, {
              data: pieData.length ? pieData : [{ name: 'Sem dados', value: 1, color: '#e2e2e2' }],
              cx: '50%', cy: '50%', innerRadius: 0, outerRadius: 120,
              dataKey: 'value', stroke: '#f6f6f6', strokeWidth: 2,
              animationBegin: 0, animationDuration: 800,
            },
              ...(pieData.length ? pieData : [{ name: 'Sem dados', value: 1, color: '#e2e2e2' }]).map((_: any, idx: number) => {
                const data = pieData.length ? pieData : [{ name: 'Sem dados', value: 1, color: '#e2e2e2' }];
                return React.createElement(Cell, { key: `cell-${idx}`, fill: data[idx].color });
              })),
            React.createElement(Tooltip, { content: customTooltip })))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16 } },
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, `Total de viagens: ${statusCounts.total}`),
        ...pieData.map((d) => {
          const pct = statusCounts.total > 0 ? Math.round((d.value / statusCounts.total) * 100) : 0;
          return React.createElement('div', { key: d.name, style: { display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement('div', { style: dot(d.color) }),
            React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, `${d.name}: ${pct}% (${d.value})`));
        }))));

  // ── Search row ─────────────────────────────────────────────────────────
  const searchRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' as const },
  },
    React.createElement('div', {
      style: { flex: '1 1 300px', display: 'flex', alignItems: 'center', gap: 8, background: '#f1f1f1', borderRadius: 999, height: 44, paddingLeft: 16, paddingRight: 16 },
    },
      searchIconSvg,
      React.createElement('input', {
        type: 'text', value: search, placeholder: 'Buscar motorista, destino ou origem...',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
        style: { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#0d0d0d', ...font },
      })),
    React.createElement('button', {
      type: 'button', onClick: () => setTrocarOpen(true),
      style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const },
    }, swapIconSvg, 'Trocar motorista'),
    React.createElement('button', {
      type: 'button', onClick: () => setFiltroOpen(true), 'data-testid': 'motoristas-open-page-filter',
      style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px', borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font },
    }, filterIconSvg, 'Filtros'));

  // ── Table section ─────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 8px' };

  const tableHeader = React.createElement('div', {
    style: { display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9', padding: '0 16px', alignItems: 'center' },
  },
    ...tableCols.map((c) => React.createElement('div', {
      key: c.label,
      style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%' },
    }, c.label)));

  const tableRowEls = filteredTableData.map((t, idx) => {
    const st = statusStyles[t.status] || { bg: '#eee', color: '#333' };
    return React.createElement('div', {
      key: t.tripId, 'data-testid': 'motorista-table-row',
      style: { display: 'flex', height: 64, alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #d9d9d9', background: '#f6f6f6' },
    },
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, gap: 8, overflow: 'hidden' } },
        renderAvatar(t.nome, t.avatarUrl),
        React.createElement('span', { style: { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 13 } }, t.nome)),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 13 } }, t.origem),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 13 } }, t.destino),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, t.data),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } }, t.embarque),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[5].flex, minWidth: tableCols[5].minWidth } }, t.chegada),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[6].flex, minWidth: tableCols[6].minWidth } },
        React.createElement('span', {
          style: { display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' as const, background: st.bg, color: st.color, ...font },
        }, t.status)),
      React.createElement('div', { style: { flex: tableCols[7].flex, minWidth: tableCols[7].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 } },
        React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar',
          onClick: () => navigate(`/motoristas/${t.driverId}/viagem/${t.tripId}`, {
            state: { trip: { passageiro: t.nome, origem: t.origem, destino: t.destino, data: t.data, embarque: t.embarque, chegada: t.chegada, status: t.status === 'Concluído' ? 'concluído' : t.status === 'Cancelado' ? 'cancelado' : t.status === 'Agendado' ? 'agendado' : 'em_andamento' } },
          }),
        }, eyeActionSvg),
        React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar',
          onClick: () => navigate(`/motoristas/${t.driverId}/editar`),
        }, pencilActionSvg)));
  });

  const tableSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' } },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 80, padding: '20px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0' },
      },
        React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font } }, 'Lista de motoristas'),
        React.createElement('button', {
          type: 'button', onClick: () => setTblFilterOpen(true), 'data-testid': 'motoristas-open-table-filter',
          style: { display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '8px 24px', background: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font },
        }, filterIconSvg, 'Filtro')),
      React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
        tableHeader,
        ...tableRowEls)));

  // ── Filtro modal ───────────────────────────────────────────────────────
  const filtroModal = filtroOpen ? React.createElement('div', {
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'motoristas-filtro-titulo',
    style: { position: 'fixed' as const, inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 24, background: 'rgba(0,0,0,0.18)' },
    onClick: () => setFiltroOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 20, padding: 24, width: 380, maxHeight: '90vh', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { id: 'motoristas-filtro-titulo', style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtros'),
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Período'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6 } },
          React.createElement('label', { style: { fontSize: 13, color: '#767676', ...font } }, 'Data inicial'),
          React.createElement('input', {
            type: 'date', value: filtroDateInicio,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFiltroDateInicio(e.target.value),
            style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
          }),
          React.createElement('label', { style: { fontSize: 13, color: '#767676', ...font } }, 'Data final'),
          React.createElement('input', {
            type: 'date', value: filtroDateFim,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFiltroDateFim(e.target.value),
            style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
          }))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Status da viagem'),
        React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
          fChip('Todos', filtroStatus === 'todos', () => setFiltroStatus('todos')),
          fChip('Em andamento', filtroStatus === 'em_andamento', () => setFiltroStatus('em_andamento')),
          fChip('Agendadas', filtroStatus === 'agendadas', () => setFiltroStatus('agendadas')),
          fChip('Concluídas', filtroStatus === 'concluidas', () => setFiltroStatus('concluidas')),
          fChip('Canceladas', filtroStatus === 'canceladas', () => setFiltroStatus('canceladas')))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Categoria'),
        React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
          fChip('Todos', filtroCategoria === 'todos', () => setFiltroCategoria('todos')),
          fChip('Take Me', filtroCategoria === 'take_me', () => setFiltroCategoria('take_me')),
          fChip('Parceiro', filtroCategoria === 'parceiro', () => setFiltroCategoria('parceiro')))),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroOpen(false),
          style: { flex: 1, height: 44, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Aplicar'),
        React.createElement('button', {
          type: 'button',
          onClick: () => { setFiltroStatus('todos'); setFiltroCategoria('todos'); setFiltroDateInicio(''); setFiltroDateFim(''); setFiltroOpen(false); },
          style: { flex: 1, height: 44, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Resetar')))) : null;

  // ── Table filter modal ─────────────────────────────────────────────────
  const tblFilterModal = tblFilterOpen ? React.createElement('div', {
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'motoristas-filtro-tabela-titulo',
    style: { position: 'fixed' as const, inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 24, background: 'rgba(0,0,0,0.18)' },
    onClick: () => setTblFilterOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 20, padding: 24, width: 360, maxHeight: '90vh', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { id: 'motoristas-filtro-tabela-titulo', style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro da tabela'),
        React.createElement('button', {
          type: 'button', onClick: () => setTblFilterOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6 } },
        React.createElement('label', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Nome do motorista'),
        React.createElement('input', {
          type: 'text', value: tblNomeMotorista, placeholder: 'Ex: Carlos Silva',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblNomeMotorista(e.target.value),
          style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
        })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6 } },
        React.createElement('label', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Origem'),
        React.createElement('input', {
          type: 'text', value: tblOrigem, placeholder: 'Ex: São Paulo, SP',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblOrigem(e.target.value),
          style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
        })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6 } },
        React.createElement('label', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Destino'),
        React.createElement('input', {
          type: 'text', value: tblDestino, placeholder: 'Ex: Rio de Janeiro, RJ',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblDestino(e.target.value),
          style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
        })),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', {
          type: 'button', onClick: () => setTblFilterOpen(false),
          style: { flex: 1, height: 44, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Aplicar'),
        React.createElement('button', {
          type: 'button',
          onClick: () => { setTblNomeMotorista(''); setTblOrigem(''); setTblDestino(''); setTblFilterOpen(false); },
          style: { flex: 1, height: 44, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Resetar')))) : null;

  // ── Trocar motorista slide panel ──────────────────────────────────────
  const tmDrivers = tableData.length > 0
    ? [...new Map(tableData.map((t) => [t.driverId, t])).values()].map((t) => ({
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
      style: { position: 'fixed' as const, top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 480, background: '#fff', borderRadius: '16px 0 0 16px', padding: '28px 24px', display: 'flex', flexDirection: 'column' as const, gap: 20, overflowY: 'auto' as const, maxHeight: '100vh' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' } },
        React.createElement('div', null,
          React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Trocar motorista'),
          React.createElement('p', { style: { fontSize: 13, color: '#767676', margin: '4px 0 0', ...font } }, 'Selecione outro motorista disponível para continuar.')),
        React.createElement('button', {
          type: 'button', onClick: () => setTrocarOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Data da atividade'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Data'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px' } },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
            React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
            React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' })),
          React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, trocarDate))),
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Viagem atual'),
      ...tmDrivers.slice(0, 1).map((d, i) =>
        React.createElement('button', {
          key: `current-${i}`, type: 'button', onClick: () => setTrocarSelected(i),
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
      tmDrivers.length > 1 ? React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Outras viagens disponíveis') : null,
      ...tmDrivers.slice(1).map((d, i) =>
        React.createElement('button', {
          key: `other-${i}`, type: 'button', onClick: () => setTrocarSelected(i + 1),
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
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Motivo da troca'),
        React.createElement('textarea', {
          value: trocarMotivo, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setTrocarMotivo(e.target.value),
          placeholder: 'Descreva o motivo da troca...',
          style: { width: '100%', minHeight: 80, borderRadius: 8, border: '1px solid #e2e2e2', padding: 12, fontSize: 14, color: '#0d0d0d', resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const, ...font },
        })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, marginTop: 8 } },
        React.createElement('button', {
          type: 'button', onClick: () => setTrocarOpen(false),
          style: { height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Confirmar troca'),
        React.createElement('button', {
          type: 'button', onClick: () => setTrocarOpen(false),
          style: { height: 48, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#0d0d0d', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Cancelar')))) : null;

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
