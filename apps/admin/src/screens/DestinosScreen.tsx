/**
 * DestinosScreen — Lista de destinos conforme Figma 849-21654.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
const plusSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const chevronDownSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// ── Metric data ─────────────────────────────────────────────────────────
const metricsRow1 = [
  { title: 'Total de Destinos', value: '248', pct: '+12%', pctColor: '#22c55e', desc: 'vs período anterior' },
  { title: 'Média KM/Viagem', value: '342 km', pct: '+5%', pctColor: '#22c55e', desc: 'vs período anterior' },
  { title: 'Preço Gasolina', value: 'R$ 5,89', suffix: ' por litro', pct: '', pctColor: '', desc: '' },
];

const metricsRow2 = [
  { title: 'Preço KM/h', value: 'R$ 2,45', suffix: ' custo operacional', pct: '', pctColor: '', desc: '' },
  { title: 'Gasto Aproximado', value: 'R$ 45.890', pct: '-8%', pctColor: '#b53838', desc: 'vs período anterior' },
];

// ── Bar chart data ──────────────────────────────────────────────────────
const barData = [
  { label: 'São Luís', value: 45 },
  { label: 'Viana', value: 38 },
  { label: 'Recife', value: 30 },
  { label: 'João Pessoa', value: 29 },
  { label: 'Santa Inês', value: 26 },
];
const barMax = 50;

// ── Table data ──────────────────────────────────────────────────────────
type DestinoRow = {
  origem: string;
  destino: string;
  totalAtividades: number;
  dataCriacao: string;
  status: 'Ativo' | 'Inativo';
};

const tableRows: DestinoRow[] = [
  { origem: 'São Paulo - SP', destino: 'Campinas - SP', totalAtividades: 420, dataCriacao: '23/10/2025', status: 'Inativo' },
  { origem: 'Rio de Janeiro - RJ', destino: 'Niterói - RJ', totalAtividades: 420, dataCriacao: '25/10/2025', status: 'Ativo' },
  { origem: 'Brasília - DF', destino: 'Goiânia - GO', totalAtividades: 420, dataCriacao: '25/10/2025', status: 'Ativo' },
  { origem: 'São Paulo - SP', destino: 'Campinas - SP', totalAtividades: 420, dataCriacao: '25/10/2025', status: 'Ativo' },
  { origem: 'São Paulo - SP', destino: 'Goiânia - GO', totalAtividades: 335, dataCriacao: '25/10/2025', status: 'Ativo' },
  { origem: 'Brasília - DF', destino: 'Goiânia - GO', totalAtividades: 335, dataCriacao: '25/10/2025', status: 'Ativo' },
  { origem: 'Curitiba - PR', destino: 'Florianópolis - SC', totalAtividades: 335, dataCriacao: '25/10/2025', status: 'Inativo' },
];

const tableCols = [
  { label: 'Origem', flex: '1 1 16%', minWidth: 130 },
  { label: 'Destino', flex: '1 1 16%', minWidth: 130 },
  { label: 'Total de Atividades', flex: '0 0 140px', minWidth: 140 },
  { label: 'Data de criação', flex: '0 0 120px', minWidth: 120 },
  { label: 'Status', flex: '0 0 100px', minWidth: 100 },
  { label: 'Visualizar/Editar', flex: '0 0 96px', minWidth: 96 },
];

const statusStyles: Record<string, { bg: string; color: string }> = {
  'Ativo': { bg: '#22c55e', color: '#fff' },
  'Inativo': { bg: '#b53838', color: '#fff' },
};

// ── Styles ──────────────────────────────────────────────────────────────
const s = {
  metricCard: {
    flex: '1 1 0', minWidth: 180, background: '#f6f6f6', borderRadius: 16,
    padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  metricTitle: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } as React.CSSProperties,
  metricValue: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font, display: 'inline' } as React.CSSProperties,
  metricSuffix: { fontSize: 14, fontWeight: 400, color: '#767676', ...font } as React.CSSProperties,
  pctRow: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 } as React.CSSProperties,
  chartCard: {
    width: '100%', background: '#f6f6f6', borderRadius: 16, padding: 24,
    display: 'flex', flexDirection: 'column' as const, gap: 16, boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  barRow: { display: 'flex', alignItems: 'flex-end', gap: 16, justifyContent: 'center', height: 160 } as React.CSSProperties,
  barItem: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8 } as React.CSSProperties,
};

export default function DestinosScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // ── Search row ────────────────────────────────────────────────────────
  const searchRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' as const },
  },
    // Search input
    React.createElement('div', {
      style: {
        flex: '1 1 250px', display: 'flex', alignItems: 'center', gap: 8,
        background: '#f1f1f1', borderRadius: 999, height: 44, paddingLeft: 16, paddingRight: 16,
      },
    },
      searchIconSvg,
      React.createElement('input', {
        type: 'text', value: search, placeholder: 'Buscar motorista, destino ou origem...',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
        style: { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#0d0d0d', ...font },
      })),
    // + Nova rota button
    React.createElement('button', {
      type: 'button',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#22c55e', color: '#fff', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, plusSvg, 'Nova rota'),
    // Todos os estados dropdown
    React.createElement('button', {
      type: 'button',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px',
        background: '#fff', border: '1px solid #e2e2e2', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, 'Todos os estados', chevronDownSvg),
    // Filtro button
    React.createElement('button', {
      type: 'button',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, filterIconSvg, 'Filtro'));

  // ── Metric cards helper ───────────────────────────────────────────────
  const renderMetric = (m: typeof metricsRow1[0]) =>
    React.createElement('div', { key: m.title, style: s.metricCard },
      React.createElement('p', { style: s.metricTitle }, m.title),
      m.pct ? React.createElement('div', { style: s.pctRow },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: m.pctColor, ...font } }, m.pct),
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, m.desc)) : null,
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: m.pct ? 0 : 16 } },
        React.createElement('span', { style: s.metricValue }, m.value),
        (m as any).suffix ? React.createElement('span', { style: s.metricSuffix }, (m as any).suffix) : null));

  const metricCardsRow1 = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  }, ...metricsRow1.map(renderMetric));

  const metricCardsRow2 = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  }, ...metricsRow2.map(renderMetric));

  // ── Bar chart helper ──────────────────────────────────────────────────
  const renderBarChart = (title: string, subtitle: string, color: string) =>
    React.createElement('div', { style: s.chartCard },
      React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, title),
      React.createElement('p', { style: { fontSize: 14, fontWeight: 400, color: '#767676', margin: 0, ...font } }, subtitle),
      React.createElement('div', { style: s.barRow },
        ...barData.map((d) => {
          const h = (d.value / barMax) * 140;
          return React.createElement('div', { key: d.label, style: s.barItem },
            React.createElement('div', {
              style: {
                width: 56, height: h, background: color, borderRadius: '8px 8px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const,
              },
            },
              React.createElement('span', {
                style: { fontSize: 11, fontWeight: 700, color: '#fff', ...font, textAlign: 'center' as const, lineHeight: 1.2 },
              }, `${d.value}\nviagens`)),
            React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#0d0d0d', ...font, textAlign: 'center' as const } }, d.label));
        })));

  const origensChart = renderBarChart('Top 10 Principais Origens', 'Destinos mais procurados no período selecionado', '#0d0d0d');
  const destinosChart = renderBarChart('Top 5 Principais Destinos', 'Destinos mais procurados no período selecionado', '#cba04b');

  // ── Table section ─────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 8px' };

  const tableToolbar = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 80, padding: '20px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0',
    },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font } }, 'Lista de destinos'),
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
      style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%' },
    }, c.label)));

  const tableRowEls = tableRows.map((row, idx) => {
    const st = statusStyles[row.status];
    return React.createElement('div', {
      key: idx,
      style: {
        display: 'flex', height: 64, alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid #d9d9d9', background: '#f6f6f6',
      },
    },
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, fontWeight: 500 } }, row.origem),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500 } }, row.destino),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth } }, String(row.totalAtividades)),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, row.dataCriacao),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' as const,
            background: st.bg, color: st.color, ...font,
          },
        }, row.status)),
      React.createElement('div', {
        style: { flex: tableCols[5].flex, minWidth: tableCols[5].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
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
    React.createElement('h1', { style: webStyles.homeTitle }, 'Destinos'),
    searchRow,
    metricCardsRow1,
    metricCardsRow2,
    origensChart,
    destinosChart,
    tableSection);
}
