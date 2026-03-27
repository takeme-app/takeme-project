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
  { label: 'Motoristas', flex: '1 1 16%', minWidth: 150 },
  { label: 'Origem', flex: '1 1 14%', minWidth: 130 },
  { label: 'Destino', flex: '1 1 14%', minWidth: 120 },
  { label: 'Data', flex: '0 0 100px', minWidth: 100 },
  { label: 'Embarque', flex: '0 0 80px', minWidth: 80 },
  { label: 'Chegada', flex: '0 0 72px', minWidth: 72 },
  { label: 'Status', flex: '0 0 130px', minWidth: 130 },
  { label: 'Visualizar/Editar', flex: '0 0 96px', minWidth: 96 },
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

  const tableRows: MotoristaRow[] = tableData.map((t) => ({
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
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, swapIconSvg, 'Trocar motorista'),
    // Filtro button
    React.createElement('button', {
      type: 'button',
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
    const initial = row.nome.charAt(0);
    const avatarBg = avatarColors[initial] || '#999';
    const st = statusStyles[row.status] || { bg: '#eee', color: '#333' };

    return React.createElement('div', {
      key: idx,
      style: {
        display: 'flex', height: 64, alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid #d9d9d9', background: '#f6f6f6',
      },
    },
      // Motoristas (avatar + name)
      React.createElement('div', {
        style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, gap: 10 },
      },
        React.createElement('div', {
          style: {
            width: 40, height: 40, borderRadius: '50%', background: avatarBg, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          },
        }, React.createElement('span', { style: { color: '#fff', fontSize: 16, fontWeight: 600, ...font } }, initial)),
        React.createElement('span', { style: { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, row.nome)),
      // Origem
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, row.origem),
      // Destino
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, row.destino),
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
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar' }, eyeActionSvg),
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar' }, pencilActionSvg)));
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

  // ── Render ─────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Motoristas'),
    searchRow,
    metricCards,
    secondRow,
    chartSection,
    tableSection);
}
