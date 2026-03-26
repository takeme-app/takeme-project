/**
 * PromocoesScreen — Promoções conforme Figma 867-19582.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState } from 'react';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// ── Mock data ───────────────────────────────────────────────────────────
const metrics1 = [
  { title: 'Total de Promoções', value: '48', pct: '+12%', desc: 'vs mês anterior' },
  { title: 'Promoções Ativas', value: '12', pct: '+8%', desc: 'vs mês anterior' },
  { title: 'Promoções Inativas', value: '36', pct: '-3%', desc: 'vs mês anterior', negative: true },
];

const metrics2 = [
  { title: 'Adesão Motoristas', value: '68%', pct: '+5%', desc: 'vs mês anterior' },
  { title: 'Adesão Preparadores', value: '72%', pct: '+7%', desc: 'vs mês anterior' },
];

type PromoRow = {
  nome: string;
  dataInicio: string;
  dataTermino: string;
  tipoPublico: string;
  status: 'Ativo' | 'Inativo';
};

const tableRows: PromoRow[] = [
  { nome: 'Desconto de Natal 2025', dataInicio: '01/12/2025\n08:00', dataTermino: '15/12/2025\n23:59', tipoPublico: 'Passageiro', status: 'Inativo' },
  { nome: 'Bônus Motoristas - Novembro', dataInicio: '01/11/2024\n08:00', dataTermino: '20/11/2024\n23:59', tipoPublico: 'Motorista', status: 'Inativo' },
  { nome: 'Cashback Preparadores', dataInicio: '05/11/2024\n08:00', dataTermino: '10/11/2024\n23:59', tipoPublico: 'Preparador', status: 'Inativo' },
  { nome: 'Black Friday', dataInicio: '01/11/2024\n08:00', dataTermino: '05/11/2024\n23:59', tipoPublico: 'Passageiro', status: 'Ativo' },
  { nome: 'Bônus Preparadores', dataInicio: '05/10/2024\n08:00', dataTermino: '10/10/2024\n23:59', tipoPublico: 'Preparador', status: 'Ativo' },
  { nome: 'Desconto Encomendas Express', dataInicio: '01/09/2024\n08:00', dataTermino: '15/09/2024\n23:59', tipoPublico: 'Encomenda', status: 'Ativo' },
  { nome: 'Cashback Motoristas', dataInicio: '01/08/2024\n08:00', dataTermino: '10/08/2024\n23:59', tipoPublico: 'Motorista', status: 'Ativo' },
];

const tableCols = [
  { label: 'Nome da Promoção', flex: '1 1 25%', minWidth: 180 },
  { label: 'Data de Início', flex: '0 0 130px', minWidth: 130 },
  { label: 'Data de Término', flex: '0 0 130px', minWidth: 130 },
  { label: 'Tipo de Público', flex: '0 0 120px', minWidth: 120 },
  { label: 'Status', flex: '0 0 90px', minWidth: 90 },
];

// ── Chart data (4 days × 3 lines) ──────────────────────────────────────
const chartData = {
  labels: ['Dia 1', 'Dia 2', 'Dia 3', 'Dia 4'],
  motoristas: [30, 58, 35, 40],
  preparadores: [25, 54, 30, 28],
  passageiros: [5, 46, 22, 20],
};

// ── Styles ──────────────────────────────────────────────────────────────
const s = {
  metricCard: {
    flex: '1 1 0', minWidth: 200, background: '#f6f6f6', borderRadius: 16,
    padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  chartCard: {
    width: '100%', background: '#f6f6f6', borderRadius: 16, padding: 24,
    display: 'flex', flexDirection: 'column' as const, gap: 16, boxSizing: 'border-box' as const,
  } as React.CSSProperties,
};

// ── SVG line chart ──────────────────────────────────────────────────────
function buildLineChart() {
  const W = 700, H = 200, padL = 40, padR = 20, padT = 10, padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = 80;
  const xStep = chartW / (chartData.labels.length - 1);

  const toX = (i: number) => padL + i * xStep;
  const toY = (v: number) => padT + chartH - (v / maxVal) * chartH;

  const makePath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');

  const gridLines: React.ReactElement[] = [];
  for (let pct = 0; pct <= 80; pct += 20) {
    const y = toY(pct);
    gridLines.push(
      React.createElement('line', { key: `g${pct}`, x1: padL, x2: W - padR, y1: y, y2: y, stroke: '#e2e2e2', strokeWidth: 1 }),
      React.createElement('text', { key: `t${pct}`, x: padL - 6, y: y + 4, textAnchor: 'end', fontSize: 11, fill: '#767676', ...font }, `${pct}%`),
    );
  }

  const xLabels = chartData.labels.map((l, i) =>
    React.createElement('text', { key: `xl${i}`, x: toX(i), y: H - 4, textAnchor: 'middle', fontSize: 11, fill: '#767676', ...font }, l));

  const lines = [
    { values: chartData.motoristas, color: '#767676' },
    { values: chartData.preparadores, color: '#22c55e' },
    { values: chartData.passageiros, color: '#b53838' },
  ];

  const pathEls = lines.map((l, li) => [
    React.createElement('path', { key: `p${li}`, d: makePath(l.values), fill: 'none', stroke: l.color, strokeWidth: 2 }),
    ...l.values.map((v, i) =>
      React.createElement('circle', { key: `c${li}-${i}`, cx: toX(i), cy: toY(v), r: 4, fill: '#fff', stroke: l.color, strokeWidth: 2 })),
  ]).flat();

  return React.createElement('svg', { viewBox: `0 0 ${W} ${H}`, style: { width: '100%', maxWidth: W, height: 'auto' } },
    ...gridLines, ...xLabels, ...pathEls);
}

// ── Component ───────────────────────────────────────────────────────────
export default function PromocoesScreen() {
  const [search, setSearch] = useState('');

  // ── Title ─────────────────────────────────────────────────────────────
  const title = React.createElement('h1', { style: webStyles.homeTitle }, 'Promoções');

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
        type: 'text', value: search, placeholder: 'Buscar por nome ou título da promoção...',
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
    }, filterIconSvg, 'Filtro'),
    React.createElement('button', {
      type: 'button',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
      },
    },
      React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
        React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
      'Criar nova promoção'));

  // ── Metrics row 1 ─────────────────────────────────────────────────────
  const metricCards1 = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    ...metrics1.map((m) =>
      React.createElement('div', { key: m.title, style: s.metricCard },
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, m.title),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: m.negative ? '#b53838' : '#22c55e', ...font } }, m.pct),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, m.desc)),
        React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, m.value))));

  // ── Metrics row 2 ─────────────────────────────────────────────────────
  const metricCards2 = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    ...metrics2.map((m) =>
      React.createElement('div', { key: m.title, style: s.metricCard },
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, m.title),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: '#22c55e', ...font } }, m.pct),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, m.desc)),
        React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, m.value))));

  // ── Chart section ─────────────────────────────────────────────────────
  const chartSection = React.createElement('div', { style: s.chartCard },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Crescimento de Adesão - Mês Atual'),
    buildLineChart(),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 8 } },
      ...([
        { label: 'Motoristas', color: '#767676' },
        { label: 'Preparadores', color: '#22c55e' },
        { label: 'Passageiros', color: '#b53838' },
      ].map((l) =>
        React.createElement('div', { key: l.label, style: { display: 'flex', alignItems: 'center', gap: 6 } },
          React.createElement('svg', { width: 20, height: 12, viewBox: '0 0 20 12' },
            React.createElement('line', { x1: 0, y1: 6, x2: 20, y2: 6, stroke: l.color, strokeWidth: 2 }),
            React.createElement('circle', { cx: 10, cy: 6, r: 3, fill: '#fff', stroke: l.color, strokeWidth: 2 })),
          React.createElement('span', { style: { fontSize: 13, color: l.color, fontWeight: 500, ...font } }, l.label))))));

  // ── Table ─────────────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 6px' };

  const tableToolbar = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 64, padding: '16px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0',
    },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Lista de promoções'),
    React.createElement('button', { type: 'button', style: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 } },
      React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('circle', { cx: 12, cy: 5, r: 1.5, fill: '#0d0d0d' }),
        React.createElement('circle', { cx: 12, cy: 12, r: 1.5, fill: '#0d0d0d' }),
        React.createElement('circle', { cx: 12, cy: 19, r: 1.5, fill: '#0d0d0d' }))));

  const tableHeader = React.createElement('div', {
    style: {
      display: 'flex', height: 48, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9',
      padding: '0 16px', alignItems: 'center',
    },
  },
    ...tableCols.map((c) => React.createElement('div', {
      key: c.label,
      style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 6px', display: 'flex', alignItems: 'center', height: '100%' },
    }, c.label)));

  const tableRowEls = tableRows.map((row, idx) => {
    const statusBg = row.status === 'Ativo' ? '#b0e8d1' : '#eeafaa';
    const statusColor = row.status === 'Ativo' ? '#174f38' : '#551611';
    return React.createElement('div', {
      key: idx,
      style: {
        display: 'flex', minHeight: 56, alignItems: 'center', padding: '8px 16px',
        borderBottom: '1px solid #d9d9d9', background: '#f6f6f6',
      },
    },
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, fontWeight: 500 } }, row.nome),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, whiteSpace: 'pre-line' as const, fontSize: 13, lineHeight: 1.4 } }, row.dataInicio),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, whiteSpace: 'pre-line' as const, fontSize: 13, lineHeight: 1.4 } }, row.dataTermino),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, row.tipoPublico),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5,
            background: statusBg, color: statusColor, ...font,
          },
        }, row.status)));
  });

  const tableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
      tableToolbar,
      React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
        tableHeader,
        ...tableRowEls)));

  return React.createElement(React.Fragment, null,
    title, searchRow, metricCards1, metricCards2, chartSection, tableSection);
}
