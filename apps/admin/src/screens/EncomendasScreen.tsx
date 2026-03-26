/**
 * EncomendasScreen — Lista de encomendas conforme Figma 849-37135.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect } from 'react';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';
import { fetchEncomendas, fetchEncomendaCounts, type EncomendaCounts } from '../data/queries';
import type { EncomendaListItem } from '../data/types';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// SVG icons
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const pencilActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const chevronDownSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

type EncomendaRow = {
  destino: string;
  origem: string;
  remetente: string;
  data: string;
  embarque: string;
  chegada: string;
  status: 'Cancelado' | 'Concluído' | 'Agendado' | 'Em andamento';
};

const tableCols = [
  { label: 'Destino', flex: '1 1 14%', minWidth: 120 },
  { label: 'Origem', flex: '1 1 14%', minWidth: 120 },
  { label: 'Remetente', flex: '1 1 12%', minWidth: 110 },
  { label: 'Data', flex: '0 0 100px', minWidth: 100 },
  { label: 'Embarque', flex: '0 0 80px', minWidth: 80 },
  { label: 'Chegada', flex: '0 0 72px', minWidth: 72 },
  { label: 'Status', flex: '0 0 130px', minWidth: 130 },
  { label: 'Visualizar/Editar', flex: '0 0 96px', minWidth: 96 },
];

const statusStyles: Record<string, { bg: string; color: string }> = {
  'Cancelado': { bg: '#eeafaa', color: '#551611' },
  'Concluído': { bg: '#b0e8d1', color: '#174f38' },
  'Agendado': { bg: '#a8c6ef', color: '#102d57' },
  'Em andamento': { bg: '#fee59a', color: '#654c01' },
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
  progressCol: {
    flex: '1 1 calc(33.3% - 16px)', minWidth: 260, background: '#f6f6f6', borderRadius: 16,
    padding: 20, display: 'flex', flexDirection: 'column' as const, gap: 16,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  progressItem: { display: 'flex', flexDirection: 'column' as const, gap: 6 } as React.CSSProperties,
  progressLabelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties,
  progressLabel: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } as React.CSSProperties,
  progressCount: { fontSize: 12, fontWeight: 400, color: '#767676', ...font } as React.CSSProperties,
  progressBarBg: { width: '100%', height: 8, background: '#e2e2e2', borderRadius: 4, overflow: 'hidden' as const } as React.CSSProperties,
  progressPct: { fontSize: 12, fontWeight: 600, color: '#0d0d0d', marginTop: 2, ...font } as React.CSSProperties,
};

export default function EncomendasScreen() {
  const [search, setSearch] = useState('');

  // ── Real data from Supabase ─────────────────────────────────────────
  const [encomendasData, setEncomendasData] = useState<EncomendaListItem[]>([]);
  const [eCounts, setECounts] = useState<EncomendaCounts>({ total: 0, concluidas: 0, emAndamento: 0, agendadas: 0, canceladas: 0 });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [items, c] = await Promise.all([fetchEncomendas(), fetchEncomendaCounts()]);
      if (!cancelled) { setEncomendasData(items); setECounts(c); setDataLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const tableRows: EncomendaRow[] = encomendasData.map((e) => ({
    destino: e.destino,
    origem: e.origem,
    remetente: e.remetente,
    data: e.data,
    embarque: '—',
    chegada: '—',
    status: e.status,
  }));

  const metricsRow1 = [
    { title: 'Total de Entregas', value: String(eCounts.total), pct: '', pctColor: '', desc: '' },
    { title: 'Entregas Concluídas', value: String(eCounts.concluidas), pct: '', pctColor: '', desc: '' },
    { title: 'Em Andamento', value: String(eCounts.emAndamento), pct: '', pctColor: '', desc: '' },
  ];
  const metricsRow2 = [
    { title: 'Agendadas', value: String(eCounts.agendadas), pct: '', pctColor: '', desc: '' },
    { title: 'Canceladas', value: String(eCounts.canceladas), pct: '', pctColor: '', desc: '' },
  ];

  const destMap = new Map<string, number>();
  const origMap = new Map<string, number>();
  for (const e of encomendasData) {
    destMap.set(e.destino, (destMap.get(e.destino) ?? 0) + 1);
    origMap.set(e.origem, (origMap.get(e.origem) ?? 0) + 1);
  }
  const topDestinos = Array.from(destMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([label, count]) => ({ label, pct: encomendasData.length ? Math.round((count / encomendasData.length) * 100) : 0, count: `${count} entregas` }));
  const topOrigens = Array.from(origMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([label, count]) => ({ label, pct: encomendasData.length ? Math.round((count / encomendasData.length) * 100) : 0, count: `${count} entregas` }));

  const sizeMap = new Map<string, number>();
  for (const e of encomendasData) { if (e.packageSize) sizeMap.set(e.packageSize, (sizeMap.get(e.packageSize) ?? 0) + 1); }
  const sizeTotal = Array.from(sizeMap.values()).reduce((a, b) => a + b, 0) || 1;
  const tipoEncomenda = Array.from(sizeMap.entries()).map(([label, count]) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    pct: Math.round((count / sizeTotal) * 100),
    count: `${count} entregas`,
  }));

  // ── Search row ────────────────────────────────────────────────────────
  const searchRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' as const },
  },
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
    React.createElement('button', {
      type: 'button',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px',
        background: '#fff', border: '1px solid #e2e2e2', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, 'Todos os estados', chevronDownSvg),
    React.createElement('button', {
      type: 'button',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, filterIconSvg, 'Filtro'));

  // ── Metric card helper ────────────────────────────────────────────────
  const renderMetric = (m: { title: string; value: string; pct?: string; pctColor?: string; desc?: string; suffix?: string }) =>
    React.createElement('div', { key: m.title, style: s.metricCard },
      React.createElement('p', { style: s.metricTitle }, m.title),
      m.pct ? React.createElement('div', { style: s.pctRow },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: m.pctColor, ...font } }, m.pct),
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, m.desc)) : null,
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: m.pct ? 0 : 16 } },
        React.createElement('span', { style: s.metricValue }, m.value),
        m.suffix ? React.createElement('span', { style: s.metricSuffix }, m.suffix) : null));

  const metricRow = (items: typeof metricsRow1) =>
    React.createElement('div', { style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const } },
      ...items.map(renderMetric));

  // ── Progress bar section helper ───────────────────────────────────────
  const renderProgressCol = (title: string, items: { label: string; pct: number; count: string }[], barColor: string) =>
    React.createElement('div', { style: s.progressCol },
      React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, title),
      ...items.map((item) =>
        React.createElement('div', { key: item.label, style: s.progressItem },
          React.createElement('div', { style: s.progressLabelRow },
            React.createElement('span', { style: s.progressLabel }, item.label),
            React.createElement('span', { style: s.progressCount }, item.count)),
          React.createElement('div', { style: s.progressBarBg },
            React.createElement('div', { style: { width: `${item.pct}%`, height: '100%', background: barColor, borderRadius: 4 } })),
          React.createElement('span', { style: s.progressPct }, `${item.pct}%`))));

  const progressSection = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    renderProgressCol('Tipo de Encomenda', tipoEncomenda, '#cba04b'),
    renderProgressCol('Top 10 destinos mais frequentes', topDestinos, '#0d0d0d'),
    renderProgressCol('Top 10 locais de origem', topOrigens, '#cba04b'));

  // ── Table section ─────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 8px' };

  const tableToolbar = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 80, padding: '20px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0',
    },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font } }, 'Lista de encomendas'),
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
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, fontWeight: 500 } }, row.destino),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500 } }, row.origem),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, fontWeight: 500 } }, row.remetente),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, row.data),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } }, row.embarque),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[5].flex, minWidth: tableCols[5].minWidth } }, row.chegada),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[6].flex, minWidth: tableCols[6].minWidth } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' as const,
            background: st.bg, color: st.color, ...font,
          },
        }, row.status)),
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
      React.createElement('span', { style: { fontSize: 16, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Carregando encomendas...'));
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Encomendas'),
    searchRow,
    metricRow(metricsRow1),
    metricRow(metricsRow2),
    progressSection,
    tableSection);
}
