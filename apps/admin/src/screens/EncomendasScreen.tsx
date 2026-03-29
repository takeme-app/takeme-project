/**
 * EncomendasScreen — Lista de encomendas conforme Figma 849-37135.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';
import { fetchEncomendas, fetchEncomendaCounts, updateShipmentStatus, updateDependentShipmentStatus, type EncomendaCounts } from '../data/queries';
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

const UF_NOMES = ['Todos os estados', 'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'];

export default function EncomendasScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [estadosOpen, setEstadosOpen] = useState(false);
  const [estadoSel, setEstadoSel] = useState('Todos os estados');
  // Filtro modal state
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroDataIni, setFiltroDataIni] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroDatas, setFiltroDatas] = useState<'passadas' | 'ambas' | 'futuras' | null>(null);
  const [filtroStatus, setFiltroStatus] = useState('Em andamento');
  const [filtroCategoria, setFiltroCategoria] = useState('Take Me');
  // Table filter modal state
  const [tblFiltroOpen, setTblFiltroOpen] = useState(false);
  const [tblOrigem, setTblOrigem] = useState('');
  const [tblDestino, setTblDestino] = useState('');
  const [tblHoraEmbarque, setTblHoraEmbarque] = useState('');
  const [tblIntervaloChegada, setTblIntervaloChegada] = useState('');
  const [tblIntervaloEmbarque, setTblIntervaloEmbarque] = useState('');
  const [tblDataInicial, setTblDataInicial] = useState('');
  const [tblRemetente, setTblRemetente] = useState('');
  const [tblDestinatario, setTblDestinatario] = useState('');
  const [tblCodigo, setTblCodigo] = useState('');
  const [tblStatusEncomenda, setTblStatusEncomenda] = useState('Em andamento');
  const [tblTipoEncomenda, setTblTipoEncomenda] = useState('Todos');

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
    React.createElement('div', { style: { position: 'relative' as const } },
      React.createElement('button', {
        type: 'button',
        onClick: () => setEstadosOpen(!estadosOpen),
        style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px',
          background: '#fff', border: '1px solid #e2e2e2', borderRadius: 999,
          fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
        },
      }, estadoSel, chevronDownSvg),
      estadosOpen ? React.createElement('div', {
        style: {
          position: 'absolute' as const, top: 52, left: 0, background: '#fff', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)', minWidth: 240, maxHeight: 300,
          overflowY: 'auto' as const, zIndex: 50,
        },
      },
        ...UF_NOMES.map((uf, i, arr) =>
          React.createElement('button', {
            key: uf, type: 'button',
            onClick: () => { setEstadoSel(uf); setEstadosOpen(false); },
            style: {
              display: 'block', width: '100%', padding: '14px 20px', background: 'none',
              borderTop: 'none', borderRight: 'none', borderLeft: 'none',
              borderBottom: i < arr.length - 1 ? '1px solid #f1f1f1' : 'none',
              fontSize: 14, fontWeight: estadoSel === uf ? 600 : 400,
              color: estadoSel === uf ? '#0d0d0d' : '#767676', cursor: 'pointer', textAlign: 'left' as const, ...font,
            },
          }, uf))) : null),
    React.createElement('button', {
      type: 'button',
      onClick: () => setFiltroOpen(true),
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
      onClick: () => setTblFiltroOpen(true),
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
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar', onClick: () => navigate(`/viagens/${idx}`, { state: { from: 'encomendas' } }) }, eyeActionSvg),
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar', onClick: () => navigate(`/encomendas/${idx}/editar`, { state: { from: 'encomendas' } }) }, pencilActionSvg),
        row.rawStatus !== 'cancelled' && row.rawStatus !== 'delivered' ? React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Cancelar encomenda',
          onClick: async () => {
            const item = encomendasData[idx];
            if (item && confirm('Cancelar esta encomenda?')) {
              if (item.tipo === 'Dependente') await updateDependentShipmentStatus(item.id, 'cancelled');
              else await updateShipmentStatus(item.id, 'cancelled');
              const [items, c] = await Promise.all([fetchEncomendas(), fetchEncomendaCounts()]);
              setEncomendasData(items); setECounts(c);
            }
          },
        }, React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round' }))) : null));
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

  // ── Filtro modal (Figma 849-38738) ────────────────────────────────────
  const filtroRadio = (label: string, val: 'passadas' | 'ambas' | 'futuras') =>
    React.createElement('button', {
      type: 'button', onClick: () => setFiltroDatas(filtroDatas === val ? null : val),
      style: { display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', width: '100%' },
    },
      React.createElement('div', {
        style: { width: 20, height: 20, borderRadius: '50%', border: `2px solid ${filtroDatas === val ? '#0d0d0d' : '#c4c4c4'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
      }, filtroDatas === val ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label));

  const filtroPill = (label: string, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', onClick,
      style: {
        height: 40, padding: '0 16px', borderRadius: 90, border: 'none', cursor: 'pointer',
        background: active ? '#0d0d0d' : '#f1f1f1', color: active ? '#fff' : '#0d0d0d',
        fontSize: 14, fontWeight: 500, ...font, whiteSpace: 'nowrap' as const,
      },
    }, label);

  const filtroModal = filtroOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    onClick: () => setFiltroOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: '28px 32px', display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,.15)', maxHeight: '90vh', overflowY: 'auto' as const },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro'),
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Data da atividade
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Data da atividade'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Data inicial'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, background: '#f1f1f1', borderRadius: 8, padding: '0 16px', gap: 8 } },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
            React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
            React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' })),
          React.createElement('span', { style: { fontSize: 14, color: filtroDataIni ? '#0d0d0d' : '#767676', ...font } }, filtroDataIni || '01 de setembro'))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Data final'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, background: '#f1f1f1', borderRadius: 8, padding: '0 16px', gap: 8 } },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
            React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
            React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' })),
          React.createElement('span', { style: { fontSize: 14, color: filtroDataFim ? '#0d0d0d' : '#767676', ...font } }, filtroDataFim || '31 de setembro'))),
      // Datas incluídas
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Datas incluídas'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const } },
        filtroRadio('Somente passadas', 'passadas'),
        filtroRadio('Passadas e futuras', 'ambas'),
        filtroRadio('Somente futuras', 'futuras')),
      // Status da viagem
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Status da viagem'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...['Em andamento', 'Agendadas', 'Concluídas', 'Canceladas'].map((st) => filtroPill(st, filtroStatus === st, () => setFiltroStatus(st)))),
      // Categoria
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Categoria'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...['Todos', 'Take Me', 'Motorista parceiro'].map((cat) => filtroPill(cat, filtroCategoria === cat, () => setFiltroCategoria(cat)))),
      // Buttons
      React.createElement('button', {
        type: 'button', onClick: () => setFiltroOpen(false),
        style: { width: '100%', height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' as const, flexShrink: 0, ...font },
      }, 'Aplicar filtro'),
      React.createElement('button', {
        type: 'button', onClick: () => setFiltroOpen(false),
        style: { height: 40, background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font },
      }, 'Voltar'))) : null;

  // ── Table filter modal (Figma 1252-39455) ────────────────────────────
  const tblField = (label: string, placeholder: string, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, label),
      React.createElement('input', {
        type: 'text', value, placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        style: { height: 44, borderRadius: 8, background: '#f1f1f1', border: 'none', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
      }));

  const tblDateField = (label: string, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, label),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, background: '#f1f1f1', borderRadius: 8, padding: '0 16px', gap: 8 } },
        React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
          React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' })),
        React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, placeholder)));

  const tblPill = (label: string, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', onClick,
      style: {
        height: 40, padding: '0 16px', borderRadius: 90, border: 'none', cursor: 'pointer',
        background: active ? '#0d0d0d' : '#f1f1f1', color: active ? '#fff' : '#0d0d0d',
        fontSize: 14, fontWeight: 500, ...font, whiteSpace: 'nowrap' as const,
      },
    }, label);

  const tblFiltroModal = tblFiltroOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    onClick: () => setTblFiltroOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: '28px 32px 32px', display: 'flex', flexDirection: 'column' as const, gap: 16, boxShadow: '0 20px 60px rgba(0,0,0,.15)', maxHeight: '90vh', overflowY: 'auto' as const },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro da tabela'),
        React.createElement('button', {
          type: 'button', onClick: () => setTblFiltroOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Fields
      tblField('Origem', 'Ex: São Paulo, SP', tblOrigem, setTblOrigem),
      tblField('Destino', 'Ex: São Luis, SP', tblDestino, setTblDestino),
      tblField('Hora do embarque', 'Ex: 09:00', tblHoraEmbarque, setTblHoraEmbarque),
      tblField('Intervalo de chegada', 'Ex: 22:00', tblIntervaloChegada, setTblIntervaloChegada),
      tblField('Intervalor de embarque', 'Ex: 00:00', tblIntervaloEmbarque, setTblIntervaloEmbarque),
      tblDateField('Data inicial', '01 de setembro'),
      tblField('Remetente', 'Ex: Nome do remetente', tblRemetente, setTblRemetente),
      tblField('Destinatário', 'Ex: Nome do destinatário', tblDestinatario, setTblDestinatario),
      tblField('Código da encomenda', 'Ex: #3421341342', tblCodigo, setTblCodigo),
      // Status da encomenda
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Status da encomenda'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...['Em andamento', 'Agendadas', 'Concluídas', 'Canceladas'].map((st) => tblPill(st, tblStatusEncomenda === st, () => setTblStatusEncomenda(st)))),
      // Tipo de encomenda
      React.createElement('h3', { style: { fontSize: 16, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Tipo de encomenda'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...['Todos', 'Pequeno', 'Medio', 'Grande'].map((t) => tblPill(t, tblTipoEncomenda === t, () => setTblTipoEncomenda(t)))),
      // Buttons
      React.createElement('button', {
        type: 'button', onClick: () => setTblFiltroOpen(false),
        style: { width: '100%', height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxSizing: 'border-box' as const, flexShrink: 0, ...font },
      }, 'Aplicar filtro'),
      React.createElement('button', {
        type: 'button', onClick: () => setTblFiltroOpen(false),
        style: { height: 40, background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font },
      }, 'Voltar'))) : null;

  // ── Render ─────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Encomendas'),
    searchRow,
    metricRow(metricsRow1),
    metricRow(metricsRow2),
    progressSection,
    tableSection,
    filtroModal,
    tblFiltroModal);
}
