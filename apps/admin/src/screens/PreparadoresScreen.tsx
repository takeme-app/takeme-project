/**
 * PreparadoresScreen — Preparadores conforme Figma 898-20340.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState } from 'react';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// SVG icons
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const pencilActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const starSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: '#cba04b', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' }));

// Avatar colors
const avatarColors: Record<string, string> = {
  C: '#4A90D9', J: '#7B61FF', F: '#E8725C', E: '#50C878', M: '#F5A623', D: '#9B59B6',
};

// ── Metric data ─────────────────────────────────────────────────────────
const metrics = [
  { title: 'Total de preparadores ativos', value: '47', pct: '+8%', desc: 'vs semana anterior' },
  { title: 'Encomendas em andamento', value: '23', pct: '+12%', desc: 'vs semana anterior' },
  { title: 'Avaliação média geral', value: '4.8', pct: '+3%', desc: 'vs semana anterior' },
];

// ── Table data ──────────────────────────────────────────────────────────
type PrepRow = {
  nome: string;
  origem: string;
  destino: string;
  dataInicio: string;
  previsao: string;
  avaliacao: number;
  status: 'Em andamento' | 'Agendado' | 'Cancelado' | 'Concluído';
};

const tableRows: PrepRow[] = [
  { nome: 'Carlos Silva', origem: 'Curitiba - PR', destino: 'Campinas - SP', dataInicio: '26/10/2025\n08:30', previsao: '26/10/2025\n18:00', avaliacao: 4.4, status: 'Em andamento' },
  { nome: 'João Porto', origem: 'Porto Alegre - RS', destino: 'Recife - PE', dataInicio: '26/10/2025\n08:30', previsao: '26/10/2025\n18:00', avaliacao: 4.5, status: 'Em andamento' },
  { nome: 'Jorge Silva', origem: 'Recife - PE', destino: 'São Paulo - SP', dataInicio: '26/10/2025\n08:30', previsao: '26/10/2025\n18:00', avaliacao: 4.6, status: 'Agendado' },
  { nome: 'Fernando Silva', origem: 'Brasília - DF', destino: 'Curitiba - PR', dataInicio: '26/10/2025\n08:30', previsao: '26/10/2025\n18:00', avaliacao: 4.1, status: 'Agendado' },
  { nome: 'Everton Pereira', origem: 'Salvador - BA', destino: 'Porto Alegre - RS', dataInicio: '26/10/2025\n08:30', previsao: '26/10/2025\n18:00', avaliacao: 4.2, status: 'Cancelado' },
  { nome: 'Marcio Pontes', origem: 'Curitiba - PR', destino: 'Brasília - DF', dataInicio: '26/10/2025\n08:30', previsao: '26/10/2025\n18:00', avaliacao: 4.7, status: 'Concluído' },
  { nome: 'Danilo Santos', origem: 'São Paulo - SP', destino: 'Recife - PE', dataInicio: '26/10/2025\n08:30', previsao: '26/10/2025\n18:00', avaliacao: 4.8, status: 'Concluído' },
];

const tableCols = [
  { label: 'Preparador', flex: '1 1 15%', minWidth: 150 },
  { label: 'Origem', flex: '1 1 12%', minWidth: 110 },
  { label: 'Destino', flex: '1 1 12%', minWidth: 110 },
  { label: 'Data/Hora Início', flex: '0 0 110px', minWidth: 110 },
  { label: 'Previsão Entrega', flex: '0 0 110px', minWidth: 110 },
  { label: 'Avaliação', flex: '0 0 80px', minWidth: 80 },
  { label: 'Status', flex: '0 0 130px', minWidth: 130 },
  { label: 'Visualizar/Editar', flex: '0 0 96px', minWidth: 96 },
];

const statusStyles: Record<string, { bg: string; color: string }> = {
  'Em andamento': { bg: '#fee59a', color: '#654c01' },
  'Agendado': { bg: '#a8c6ef', color: '#102d57' },
  'Cancelado': { bg: '#eeafaa', color: '#551611' },
  'Concluído': { bg: '#b0e8d1', color: '#174f38' },
};

// ── Styles ──────────────────────────────────────────────────────────────
const s = {
  tabsRow: { display: 'flex', gap: 0, borderBottom: '1px solid #e2e2e2', marginBottom: 24 } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '12px 24px', fontSize: 16, fontWeight: active ? 600 : 400,
    color: active ? '#0d0d0d' : '#767676',
    borderBottom: active ? '2px solid #0d0d0d' : '2px solid transparent', marginBottom: -1,
    background: 'none', border: 'none', cursor: 'pointer', ...font,
  } as React.CSSProperties),
  metricCard: {
    flex: '1 1 0', minWidth: 200, background: '#f6f6f6', borderRadius: 16,
    padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8,
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
    width: 100, height: 100, borderRadius: '50%', background: '#f6f6f6',
  } as React.CSSProperties,
};

export default function PreparadoresScreen() {
  const [activeTab, setActiveTab] = useState<'encomendas' | 'excursoes'>('encomendas');
  const [search, setSearch] = useState('');

  // ── Tabs ──────────────────────────────────────────────────────────────
  const tabs = React.createElement('div', { style: s.tabsRow },
    React.createElement('button', {
      type: 'button', onClick: () => setActiveTab('encomendas'), style: s.tab(activeTab === 'encomendas'),
    }, 'Preparador de encomendas'),
    React.createElement('button', {
      type: 'button', onClick: () => setActiveTab('excursoes'), style: s.tab(activeTab === 'excursoes'),
    }, 'Preparador de excursões'));

  // ── Section title ─────────────────────────────────────────────────────
  const sectionTitle = React.createElement('h2', {
    style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font },
  }, activeTab === 'encomendas' ? 'Preparador de encomendas' : 'Preparador de excursões');

  // ── Search row ────────────────────────────────────────────────────────
  const searchRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%' },
  },
    React.createElement('div', {
      style: {
        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
        background: '#f1f1f1', borderRadius: 999, height: 44, paddingLeft: 16, paddingRight: 16,
      },
    },
      searchIconSvg,
      React.createElement('input', {
        type: 'text', value: search, placeholder: 'Buscar por preparador, destino ou origem...',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
        style: { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#0d0d0d', ...font },
      })),
    React.createElement('button', {
      type: 'button',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
      },
    }, filterIconSvg, 'Filtro'));

  // ── Metrics ───────────────────────────────────────────────────────────
  const metricCards = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    ...metrics.map((m) =>
      React.createElement('div', { key: m.title, style: s.metricCard },
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, m.title),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: '#22c55e', ...font } }, m.pct),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, m.desc)),
        React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, m.value))));

  // ── Donut chart ───────────────────────────────────────────────────────
  const donutGradient = 'conic-gradient(#767676 0% 65%, #cba04b 65% 100%)';
  const chartSection = React.createElement('div', { style: s.chartCard },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Distribuição por tipo de preparo'),
    React.createElement('div', { style: s.donutWrap },
      React.createElement('div', { style: { ...s.donut, background: donutGradient } },
        React.createElement('div', { style: s.donutHole })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('div', { style: { width: 16, height: 16, borderRadius: '50%', background: '#767676' } }),
          React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Encomendas 65%')),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('div', { style: { width: 16, height: 16, borderRadius: '50%', background: '#cba04b' } }),
          React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#cba04b', ...font } }, 'Excursões 35%')))));

  // ── Table ─────────────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 6px' };

  const tableToolbar = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 80, padding: '20px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0',
    },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Lista de preparadores de encomendas'),
    React.createElement('button', {
      type: 'button',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '8px 24px',
        background: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer',
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font,
      },
    }, filterIconSvg, 'Filtro'));

  const tableHeader = React.createElement('div', {
    style: {
      display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9',
      padding: '0 16px', alignItems: 'center',
    },
  },
    ...tableCols.map((c) => React.createElement('div', {
      key: c.label,
      style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 6px', display: 'flex', alignItems: 'center', height: '100%' },
    }, c.label)));

  const tableRowEls = tableRows.map((row, idx) => {
    const initial = row.nome.charAt(0);
    const avatarBg = avatarColors[initial] || '#999';
    const st = statusStyles[row.status];
    return React.createElement('div', {
      key: idx,
      style: {
        display: 'flex', minHeight: 64, alignItems: 'center', padding: '8px 16px',
        borderBottom: '1px solid #d9d9d9', background: '#f6f6f6',
      },
    },
      // Preparador (avatar + name)
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, gap: 10 } },
        React.createElement('div', {
          style: {
            width: 36, height: 36, borderRadius: '50%', background: avatarBg, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, React.createElement('span', { style: { color: '#fff', fontSize: 14, fontWeight: 600, ...font } }, initial)),
        React.createElement('span', { style: { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, row.nome)),
      // Origem
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500 } }, row.origem),
      // Destino
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, fontWeight: 500 } }, row.destino),
      // Data/Hora Início
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth, whiteSpace: 'pre-line' as const, fontSize: 13, lineHeight: 1.4 } }, row.dataInicio),
      // Previsão Entrega
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth, whiteSpace: 'pre-line' as const, fontSize: 13, lineHeight: 1.4 } }, row.previsao),
      // Avaliação
      React.createElement('div', { style: { ...cellBase, flex: tableCols[5].flex, minWidth: tableCols[5].minWidth, gap: 4 } },
        starSvg, React.createElement('span', null, row.avaliacao.toFixed(1))),
      // Status
      React.createElement('div', { style: { ...cellBase, flex: tableCols[6].flex, minWidth: tableCols[6].minWidth } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' as const,
            background: st.bg, color: st.color, ...font,
          },
        }, row.status)),
      // Actions
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

  // ── Render ─────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    tabs,
    sectionTitle,
    searchRow,
    metricCards,
    chartSection,
    tableSection);
}
