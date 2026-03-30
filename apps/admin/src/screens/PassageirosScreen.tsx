/**
 * PassageirosScreen — Lista de passageiros (padrão HomeScreen/ViagensScreen).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
  editIconSvg,
  calendarIconSvg,
  closeIconSvg,
} from '../styles/webStyles';
import { fetchPassageiros, fetchPassageiroBookings } from '../data/queries';
import type { PassageiroListItem } from '../data/types';

const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = require('recharts');

const font = { fontFamily: 'Inter, sans-serif' };

// ── SVG icons ─────────────────────────────────────────────────────────────
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const pencilActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const closeSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

// ── Table columns ─────────────────────────────────────────────────────────
const tableCols = [
  { label: 'Passageiros', flex: '1 1 18%', minWidth: 170 },
  { label: 'Cidade', flex: '1 1 14%', minWidth: 120 },
  { label: 'Estado', flex: '1 1 14%', minWidth: 120 },
  { label: 'Data criação', flex: '0 0 105px', minWidth: 105 },
  { label: 'CPF', flex: '0 0 140px', minWidth: 140 },
  { label: 'Status', flex: '0 0 100px', minWidth: 100 },
  { label: 'Visualizar/Editar', flex: '0 0 96px', minWidth: 96 },
];

const statusStyles = {
  Ativo: { background: '#e6f9e6', color: '#22c55e' },
  Inativo: { background: '#fde8e8', color: '#b53838' },
};

// ── Avatar helper ─────────────────────────────────────────────────────────
const renderAvatar = (nome: string, avatarUrl?: string | null) => {
  const initial = (nome || '?')[0].toUpperCase();
  const colors = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899'];
  const bg = colors[initial.charCodeAt(0) % colors.length];
  if (avatarUrl) return React.createElement('img', { src: avatarUrl, alt: nome, style: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 } });
  return React.createElement('div', { style: { width: 36, height: 36, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0, ...font } }, initial);
};

export default function PassageirosScreen() {
  const navigate = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────
  const [allPassageiros, setAllPassageiros] = useState<PassageiroListItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPassageiros().then((items) => {
      if (!cancelled) { setAllPassageiros(items); setDataLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  // ── Filter modal state ─────────────────────────────────────────────────
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos');
  const [filtroDateInicio, setFiltroDateInicio] = useState('');
  const [filtroDateFim, setFiltroDateFim] = useState('');

  // ── Table filter modal state ───────────────────────────────────────────
  const [tblFiltroOpen, setTblFiltroOpen] = useState(false);
  const [tblFilterNome, setTblFilterNome] = useState('');
  const [tblFilterCidade, setTblFilterCidade] = useState('');
  const [tblFilterEstado, setTblFilterEstado] = useState('');
  const [tblFilterStatus, setTblFilterStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos');

  // ── Search ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');

  // ── Alterar passageiro panel state ─────────────────────────────────────
  const [alterarOpen, setAlterarOpen] = useState(false);
  const [alterarRow, setAlterarRow] = useState<PassageiroListItem | null>(null);
  const [alterarId, setAlterarId] = useState('#312312312');
  const [alterarNome, setAlterarNome] = useState('');
  const [alterarContato, setAlterarContato] = useState('(21) 98888-7777');
  const [alterarMala, setAlterarMala] = useState('Pequena');
  const [alterarValor, setAlterarValor] = useState('R$ 25,00');
  const [alterarMalaDropOpen, setAlterarMalaDropOpen] = useState(false);

  const openAlterarPanel = (p: PassageiroListItem) => {
    setAlterarRow(p);
    setAlterarNome(p.nome);
    setAlterarOpen(true);
    setAlterarMalaDropOpen(false);
  };

  // ── Trocar motorista panel state ───────────────────────────────────────
  const [trocarOpen, setTrocarOpen] = useState(false);
  const [trocarSelected, setTrocarSelected] = useState(0);
  const [trocarDate, setTrocarDate] = useState('01 de setembro');
  const [trocarMotivo, setTrocarMotivo] = useState('');

  // ── Filtered data (modal filters) ─────────────────────────────────────
  const filteredPassageiros = useMemo(() => {
    return allPassageiros.filter((p) => {
      if (filtroStatus === 'ativo' && p.status !== 'Ativo') return false;
      if (filtroStatus === 'inativo' && p.status !== 'Inativo') return false;
      if (filtroDateInicio && p.createdAtIso && p.createdAtIso < filtroDateInicio) return false;
      if (filtroDateFim && p.createdAtIso && p.createdAtIso > filtroDateFim) return false;
      return true;
    });
  }, [allPassageiros, filtroStatus, filtroDateInicio, filtroDateFim]);

  // ── Counts (KPIs + chart) from modal-filtered data ─────────────────────
  const pCounts = useMemo(() => ({
    total: filteredPassageiros.length,
    ativos: filteredPassageiros.filter((p) => p.status === 'Ativo').length,
    inativos: filteredPassageiros.filter((p) => p.status === 'Inativo').length,
  }), [filteredPassageiros]);

  // ── Table rows (modal + table filters + search) ────────────────────────
  const tableRows = useMemo(() => {
    return filteredPassageiros.filter((p) => {
      const q = search.toLowerCase();
      if (q && !p.nome.toLowerCase().includes(q) && !p.cidade.toLowerCase().includes(q) && !p.estado.toLowerCase().includes(q)) return false;
      const n = tblFilterNome.toLowerCase();
      if (n && !p.nome.toLowerCase().includes(n)) return false;
      const c = tblFilterCidade.toLowerCase();
      if (c && !p.cidade.toLowerCase().includes(c)) return false;
      const e = tblFilterEstado.toLowerCase();
      if (e && !p.estado.toLowerCase().includes(e)) return false;
      if (tblFilterStatus === 'ativo' && p.status !== 'Ativo') return false;
      if (tblFilterStatus === 'inativo' && p.status !== 'Inativo') return false;
      return true;
    });
  }, [filteredPassageiros, search, tblFilterNome, tblFilterCidade, tblFilterEstado, tblFilterStatus]);

  // ── Pie chart data ─────────────────────────────────────────────────────
  const pieData = useMemo(() => [
    { name: 'Ativos', value: pCounts.ativos, color: '#22c55e' },
    { name: 'Inativos', value: pCounts.inativos, color: '#ef4444' },
  ].filter((d) => d.value > 0), [pCounts]);

  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const total = pCounts.total || 1;
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

  const fRadio = (checked: boolean, label: string, onChange: () => void) =>
    React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, ...font } },
      React.createElement('input', { type: 'radio', checked, onChange, style: { accentColor: '#0d0d0d' } }),
      label);

  // ── Loading state ──────────────────────────────────────────────────────
  if (dataLoading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', ...font } }, 'Carregando passageiros...'));
  }

  // ── KPI metric card ────────────────────────────────────────────────────
  const metricCard = (title: string, value: string, testId?: string) =>
    React.createElement('div', { style: { flex: '1 1 0', minWidth: 200, background: '#f6f6f6', borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, title),
      React.createElement('p', { 'data-testid': testId, style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, value));

  const metricCards = React.createElement('div', { style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const } },
    metricCard('Total de passageiros', String(pCounts.total), 'pcount-total'),
    metricCard('Passageiros ativos', String(pCounts.ativos), 'pcount-ativos'),
    metricCard('Passageiros inativos', String(pCounts.inativos), 'pcount-inativos'));

  // ── Pie chart section ─────────────────────────────────────────────────
  const dot = (color: string) => ({ width: 20, height: 20, borderRadius: '50%', background: color, flexShrink: 0 });

  const pieSection = React.createElement('div', { style: { background: '#f6f6f6', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Distribuição de passageiros'),
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
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, `Total: ${pCounts.total}`),
        ...pieData.map((d) => {
          const pct = pCounts.total > 0 ? Math.round((d.value / pCounts.total) * 100) : 0;
          return React.createElement('div', { key: d.name, style: { display: 'flex', alignItems: 'center', gap: 10 } },
            React.createElement('div', { style: dot(d.color) }),
            React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, `${d.name}: ${pct}% (${d.value})`));
        }))));

  // ── Search row ─────────────────────────────────────────────────────────
  const searchRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' as const },
  },
    React.createElement('button', {
      type: 'button', onClick: () => setFiltroOpen(true), 'data-testid': 'passageiros-open-page-filter',
      style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px', borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500, ...font },
    }, filterIconSvg, 'Filtros'));

  // ── Table section ─────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 8px' };

  const tableHeader = React.createElement('div', {
    style: { display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9', padding: '0 16px', alignItems: 'center' },
  },
    ...tableCols.map((c) => React.createElement('div', {
      key: c.label,
      style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#767676', ...font, padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%' },
    }, c.label)));

  const tableRowEls = tableRows.map((p, idx) => {
    const st = statusStyles[p.status] || { background: '#f1f1f1', color: '#767676' };
    return React.createElement('div', {
      key: p.id, 'data-testid': 'passageiro-table-row',
      style: { display: 'flex', height: 64, alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #d9d9d9', background: '#f6f6f6' },
    },
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, gap: 8, overflow: 'hidden', cursor: 'pointer' }, onClick: () => openAlterarPanel(p) },
        renderAvatar(p.nome, p.avatarUrl),
        React.createElement('span', { style: { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 13 } }, p.nome)),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 13 } }, p.cidade),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontSize: 13 } }, p.estado),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, p.dataCriacao),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } }, p.cpf),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[5].flex, minWidth: tableCols[5].minWidth } },
        React.createElement('span', { style: { display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const, ...st, ...font } }, p.status)),
      React.createElement('div', { style: { flex: tableCols[6].flex, minWidth: tableCols[6].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 } },
        React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar',
          onClick: () => {
            void (async () => {
              const bookings = await fetchPassageiroBookings(p.id);
              const first = bookings[0];
              if (first) {
                navigate(`/passageiros/${p.id}/viagem/${first.bookingId}`, {
                  state: { trip: { passageiro: p.nome, origem: first.origem, destino: first.destino, data: first.data, embarque: first.embarque, chegada: first.chegada, status: first.status } },
                });
              } else navigate(`/passageiros/${p.id}`);
            })();
          },
        }, eyeActionSvg),
        React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar',
          onClick: () => {
            void (async () => {
              const bookings = await fetchPassageiroBookings(p.id);
              const first = bookings[0];
              if (first) {
                navigate(`/passageiros/${p.id}/viagem/${first.bookingId}/editar`, {
                  state: { trip: { passageiro: p.nome, origem: first.origem, destino: first.destino, data: first.data, embarque: first.embarque, chegada: first.chegada, status: first.status }, from: 'Passageiros' },
                });
              } else navigate(`/passageiros/${p.id}`);
            })();
          },
        }, pencilActionSvg)));
  });

  const tableSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' } },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 80, padding: '20px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0' },
      },
        React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Lista de passageiros'),
        React.createElement('button', {
          type: 'button', onClick: () => setTblFiltroOpen(true), 'data-testid': 'passageiros-open-table-filter',
          style: { display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '8px 24px', background: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font },
        }, filterIconSvg, 'Filtro')),
      React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
        tableHeader,
        ...tableRowEls)));

  // ── Filtro modal ───────────────────────────────────────────────────────
  const filtroModal = filtroOpen ? React.createElement('div', {
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'filtro-titulo',
    style: { position: 'fixed' as const, inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 24, background: 'rgba(0,0,0,0.18)' },
    onClick: () => setFiltroOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 20, padding: 24, width: 360, maxHeight: '90vh', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { id: 'filtro-titulo', style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtros'),
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Data de criação'),
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
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Status'),
        React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
          fChip('Todos', filtroStatus === 'todos', () => setFiltroStatus('todos')),
          fChip('Ativo', filtroStatus === 'ativo', () => setFiltroStatus('ativo')),
          fChip('Inativo', filtroStatus === 'inativo', () => setFiltroStatus('inativo')))),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroOpen(false),
          style: { flex: 1, height: 44, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Aplicar'),
        React.createElement('button', {
          type: 'button',
          onClick: () => { setFiltroStatus('todos'); setFiltroDateInicio(''); setFiltroDateFim(''); setFiltroOpen(false); },
          style: { flex: 1, height: 44, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Resetar')))) : null;

  // ── Filtro de tabela modal ─────────────────────────────────────────────
  const tblFiltroModal = tblFiltroOpen ? React.createElement('div', {
    role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tbl-filtro-titulo',
    style: { position: 'fixed' as const, inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 24, background: 'rgba(0,0,0,0.18)' },
    onClick: () => setTblFiltroOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 20, padding: 24, width: 360, maxHeight: '90vh', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { id: 'tbl-filtro-titulo', style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro da tabela'),
        React.createElement('button', {
          type: 'button', onClick: () => setTblFiltroOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6 } },
        React.createElement('label', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Nome'),
        React.createElement('input', {
          type: 'text', value: tblFilterNome, placeholder: 'Ex: Carlos Silva',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblFilterNome(e.target.value),
          style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
        })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6 } },
        React.createElement('label', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Cidade'),
        React.createElement('input', {
          type: 'text', value: tblFilterCidade, placeholder: 'Ex: São Paulo',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblFilterCidade(e.target.value),
          style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
        })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6 } },
        React.createElement('label', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Estado'),
        React.createElement('input', {
          type: 'text', value: tblFilterEstado, placeholder: 'Ex: SP',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblFilterEstado(e.target.value),
          style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
        })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Status'),
        React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
          fChip('Todos', tblFilterStatus === 'todos', () => setTblFilterStatus('todos')),
          fChip('Ativo', tblFilterStatus === 'ativo', () => setTblFilterStatus('ativo')),
          fChip('Inativo', tblFilterStatus === 'inativo', () => setTblFilterStatus('inativo')))),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', {
          type: 'button', onClick: () => setTblFiltroOpen(false),
          style: { flex: 1, height: 44, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Aplicar'),
        React.createElement('button', {
          type: 'button',
          onClick: () => { setTblFilterNome(''); setTblFilterCidade(''); setTblFilterEstado(''); setTblFilterStatus('todos'); setTblFiltroOpen(false); },
          style: { flex: 1, height: 44, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Resetar')))) : null;

  // ── Trocar motorista panel ─────────────────────────────────────────────
  const tmDrivers = [
    { name: 'Maria Joaquina', rota: 'Rio de Janeiro - RJ → São Paulo - SP', data: '25/10/2025', valorTotal: 'R$ 150,00', valorUnit: 'R$ 75,00', pessoas: '2', ocupacao: '80%' },
    { name: 'Pedro Albuquerque', rota: 'Rio de Janeiro - RJ → São Paulo - SP', data: '26/10/2025', valorTotal: 'R$ 145,00', valorUnit: 'R$ 70,00', pessoas: '3', ocupacao: '70%' },
  ];

  const tmRadioSvg = (sel: boolean) =>
    React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
      React.createElement('circle', { cx: 12, cy: 12, r: 9, stroke: sel ? '#0d0d0d' : '#767676', strokeWidth: 2 }),
      sel ? React.createElement('circle', { cx: 12, cy: 12, r: 5, fill: '#0d0d0d' }) : null);

  const tmInfoRow = (label: string, value: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, label),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 400, color: '#0d0d0d', ...font } }, value));

  const tmDriverCard = (d: typeof tmDrivers[0], idx: number) =>
    React.createElement('div', { key: idx, style: { display: 'flex', flexDirection: 'column' as const } },
      React.createElement('button', {
        type: 'button', onClick: () => setTrocarSelected(idx),
        style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px 0', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 },
      }, tmRadioSvg(trocarSelected === idx),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, d.name)),
      React.createElement('div', { style: { paddingLeft: 39, paddingBottom: 16, borderBottom: '1px solid #e2e2e2', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        tmInfoRow('Origem - Destino', d.rota), tmInfoRow('Data', d.data),
        tmInfoRow('Valor total', d.valorTotal), tmInfoRow('Valor unitário', d.valorUnit),
        tmInfoRow('Pessoas restantes', d.pessoas), tmInfoRow('Ocupação do bagageiro', d.ocupacao)));

  const trocarMotoristaPanel = trocarOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999 },
    onClick: () => setTrocarOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: '16px 0 0 16px', width: '100%', maxWidth: 520, maxHeight: '100vh', boxShadow: '6px 6px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' as const, padding: '24px 32px', overflowY: 'auto' as const },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #e2e2e2', marginBottom: 24, flexShrink: 0 } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, maxWidth: 344 } },
          React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Trocar motorista'),
          React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Selecione outro motorista disponível para continuar.')),
        React.createElement('button', {
          type: 'button', 'aria-label': 'Fechar', onClick: () => setTrocarOpen(false),
          style: { width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
        }, closeIconSvg)),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24, paddingLeft: 16, paddingRight: 16 } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, paddingBottom: 16 } },
          React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Data da atividade'),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
            React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Data'),
            React.createElement('div', { style: { position: 'relative' as const, width: '100%' } },
              React.createElement('div', { style: { position: 'absolute' as const, left: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const } }, calendarIconSvg),
              React.createElement('input', {
                type: 'text', value: trocarDate,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTrocarDate(e.target.value),
                style: { width: '100%', height: 44, background: '#f1f1f1', border: 'none', borderRadius: 8, paddingLeft: 48, fontSize: 16, color: '#767676', outline: 'none', boxSizing: 'border-box' as const, ...font },
              })))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
          React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Viagem atual'),
          tmDriverCard(tmDrivers[0], 0)),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
          React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Outras viagens disponíveis'),
          ...tmDrivers.slice(1).map((d, i) => tmDriverCard(d, i + 1))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Motivo'),
            React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Opcional')),
          React.createElement('textarea', {
            value: trocarMotivo, placeholder: 'Veículo teve problema mecânico.',
            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setTrocarMotivo(e.target.value),
            style: { width: '100%', height: 156, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: 16, fontSize: 16, color: trocarMotivo ? '#3a3a3a' : '#767676', outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const, ...font },
          }))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, marginTop: 24, padding: '0 23px', flexShrink: 0 } },
        React.createElement('button', {
          type: 'button', onClick: () => setTrocarOpen(false),
          style: { width: '100%', height: 48, background: '#0d0d0d', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#fff', ...font },
        }, 'Confirmar troca'),
        React.createElement('button', {
          type: 'button', onClick: () => setTrocarOpen(false),
          style: { width: '100%', height: 48, background: '#f1f1f1', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#b53838', ...font },
        }, 'Cancelar')))) : null;

  // ── Alterar passageiro panel ───────────────────────────────────────────
  const malaOptions = ['Pequena', 'Média', 'Grande'];

  const chevronDownIcon = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M8 10l4 4 4-4', stroke: '#545454', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  const alterarField = (label: string, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' } },
      React.createElement('div', { style: { minHeight: 40, display: 'flex', alignItems: 'center' } },
        React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label)),
      React.createElement('div', { style: { width: '100%', height: 44, background: '#f1f1f1', borderRadius: 8, display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 16 } },
        React.createElement('input', {
          type: 'text', value,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          style: { width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: '#3a3a3a', ...font },
        })));

  const malaDropdown = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%', position: 'relative' as const } },
    React.createElement('div', { style: { minHeight: 40, display: 'flex', alignItems: 'center' } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Tamanho da mala')),
    React.createElement('button', {
      type: 'button', onClick: () => setAlterarMalaDropOpen(!alterarMalaDropOpen),
      style: { width: '100%', height: 44, background: '#f1f1f1', borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 4 },
    },
      React.createElement('span', { style: { fontSize: 16, color: '#3a3a3a', ...font, textAlign: 'left' as const } }, alterarMala),
      React.createElement('div', { style: { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, chevronDownIcon)),
    alterarMalaDropOpen ? React.createElement('div', {
      style: { position: 'absolute' as const, top: 84, left: 0, right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, overflow: 'hidden' },
    }, ...malaOptions.map((opt) =>
      React.createElement('button', {
        key: opt, type: 'button',
        onClick: () => { setAlterarMala(opt); setAlterarMalaDropOpen(false); },
        style: { width: '100%', height: 44, padding: '0 16px', background: alterarMala === opt ? '#f1f1f1' : '#fff', border: 'none', cursor: 'pointer', textAlign: 'left' as const, fontSize: 16, color: '#0d0d0d', ...font },
      }, opt))) : null);

  const alterarPassageiroPanel = alterarOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999 },
    onClick: () => setAlterarOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: '16px 0 0 16px', width: '100%', maxWidth: 520, maxHeight: '100vh', boxShadow: '6px 6px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' as const, padding: '64px 32px 88px', overflowY: 'auto' as const },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', flex: 1, gap: 32 } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 32 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #e2e2e2' } },
            React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Alterar passageiro'),
            React.createElement('button', {
              type: 'button', 'aria-label': 'Fechar', onClick: () => setAlterarOpen(false),
              style: { width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
            }, closeIconSvg)),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
            alterarField('ID do passageiro', alterarId, setAlterarId),
            alterarField('Nome completo', alterarNome, setAlterarNome),
            alterarField('Contato', alterarContato, setAlterarContato),
            malaDropdown,
            alterarField('Valor', alterarValor, setAlterarValor))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10 } },
          React.createElement('button', {
            type: 'button', onClick: () => setAlterarOpen(false),
            style: { width: '100%', height: 48, background: '#0d0d0d', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#fff', ...font },
          }, 'Salvar dados'),
          React.createElement('button', {
            type: 'button', onClick: () => setAlterarOpen(false),
            style: { width: '100%', height: 48, background: '#e2e2e2', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#b53838', ...font },
          }, 'Cancelar'))))) : null;

  // ── Main render ───────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Passageiros'),
    searchRow,
    metricCards,
    pieSection,
    tableSection,
    filtroModal,
    tblFiltroModal,
    trocarMotoristaPanel,
    alterarPassageiroPanel);
}
