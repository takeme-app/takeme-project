/**
 * EncomendasScreen — Lista de encomendas conforme Figma 849-37135.
 * Uses React.createElement() calls (NOT JSX).
 * Counts calculados via useMemo sobre filteredEncomendasData (refletem filtros do modal).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';
import {
  fetchEncomendas,
  updateShipmentStatus,
  updateDependentShipmentStatus,
} from '../data/queries';
import type { EncomendaListItem } from '../data/types';

const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = require('recharts');
const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// ── SVG icons ──────────────────────────────────────────────────────────────
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const pencilActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const chevronDownSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const closeSmSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

// ── Types ──────────────────────────────────────────────────────────────────
type EncomendaRow = {
  id: string;
  tipo: EncomendaListItem['tipo'];
  destino: string;
  origem: string;
  remetente: string;
  data: string;
  tamanho: string;
  valor: string;
  status: 'Cancelado' | 'Concluído' | 'Agendado' | 'Em andamento';
  rawStatus: string;
};

// ── Constants ──────────────────────────────────────────────────────────────
const tableCols = [
  { label: 'Destino', flex: '1 1 14%', minWidth: 120 },
  { label: 'Origem', flex: '1 1 14%', minWidth: 120 },
  { label: 'Remetente', flex: '1 1 12%', minWidth: 110 },
  { label: 'Data', flex: '0 0 100px', minWidth: 100 },
  { label: 'Tamanho', flex: '0 0 90px', minWidth: 90 },
  { label: 'Valor', flex: '0 0 100px', minWidth: 100 },
  { label: 'Status', flex: '0 0 130px', minWidth: 130 },
  { label: 'Visualizar/Editar', flex: '0 0 96px', minWidth: 96 },
];

const statusStyles: Record<string, { bg: string; color: string }> = {
  'Cancelado': { bg: '#eeafaa', color: '#551611' },
  'Concluído': { bg: '#b0e8d1', color: '#174f38' },
  'Agendado': { bg: '#a8c6ef', color: '#102d57' },
  'Em andamento': { bg: '#fee59a', color: '#654c01' },
};

const UF_NOMES = ['Todos os estados', 'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'];

// ── Helpers ────────────────────────────────────────────────────────────────
const pkgLabel = (ps?: string) => {
  const p = (ps || '').toLowerCase();
  if (p === 'small' || p.includes('pequ')) return 'Pequeno';
  if (p === 'medium' || p.includes('medio') || p.includes('médio')) return 'Médio';
  if (p === 'large' || p === 'xl' || p.includes('grand')) return 'Grande';
  return ps || '—';
};

const fmtBRL = (cents: number) =>
  cents > 0 ? `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

function toEncomendaRow(e: EncomendaListItem): EncomendaRow {
  return {
    id: e.id,
    tipo: e.tipo,
    destino: e.destino,
    origem: e.origem,
    remetente: e.remetente,
    data: e.data,
    tamanho: pkgLabel(e.packageSize),
    valor: fmtBRL(e.amountCents),
    status: e.status,
    rawStatus: String((e as { rawStatus?: string }).rawStatus ?? ''),
  };
}

function isoDatePartLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Local styles ───────────────────────────────────────────────────────────
const s = {
  progressCol: {
    flex: '1 1 calc(50% - 12px)', minWidth: 260, background: '#f6f6f6', borderRadius: 16,
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

// ── Component ──────────────────────────────────────────────────────────────
export default function EncomendasScreen() {
  const navigate = useNavigate();

  // ── Raw data ─────────────────────────────────────────────────────────────
  const [allEncomendasData, setAllEncomendasData] = useState<EncomendaListItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── Estado do dropdown de estados ────────────────────────────────────────
  const [estadosOpen, setEstadosOpen] = useState(false);
  const [estadoSel, setEstadoSel] = useState('Todos os estados');

  // ── Filtro modal página ───────────────────────────────────────────────────
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroDataIni, setFiltroDataIni] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'Em andamento' | 'Agendado' | 'Concluído' | 'Cancelado'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<'todos' | 'shipment' | 'dependent_shipment'>('todos');

  // ── Filtro modal tabela ───────────────────────────────────────────────────
  const [tblFiltroOpen, setTblFiltroOpen] = useState(false);
  const [tblOrigem, setTblOrigem] = useState('');
  const [tblDestino, setTblDestino] = useState('');
  const [tblRemetente, setTblRemetente] = useState('');
  const [tblDestinatario, setTblDestinatario] = useState('');
  const [tblCodigo, setTblCodigo] = useState('');
  const [tblDataInicial, setTblDataInicial] = useState('');
  const [tblStatusEncomenda, setTblStatusEncomenda] = useState<'todos' | 'Em andamento' | 'Agendado' | 'Concluído' | 'Cancelado'>('todos');
  const [tblTipoEncomenda, setTblTipoEncomenda] = useState('Todos');

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetchEncomendas().then((items) => {
      if (!cancelled) { setAllEncomendasData(items); setDataLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  // ── Filtered data (página) → base para KPIs e gráfico ───────────────────
  const filteredEncomendasData = useMemo(() => {
    return allEncomendasData.filter((e) => {
      if (filtroStatus !== 'todos' && e.status !== filtroStatus) return false;
      if (filtroCategoria !== 'todos' && e.tipo !== filtroCategoria) return false;
      if (filtroDataIni && e.createdAtIso) {
        const day = isoDatePartLocal(e.createdAtIso);
        if (day && day < filtroDataIni) return false;
      }
      if (filtroDataFim && e.createdAtIso) {
        const day = isoDatePartLocal(e.createdAtIso);
        if (day && day > filtroDataFim) return false;
      }
      return true;
    });
  }, [allEncomendasData, filtroStatus, filtroCategoria, filtroDataIni, filtroDataFim]);

  // ── Counts (derivados de filteredEncomendasData) ─────────────────────────
  const counts = useMemo(() => ({
    total: filteredEncomendasData.length,
    emAndamento: filteredEncomendasData.filter((e) => e.status === 'Em andamento').length,
    agendadas: filteredEncomendasData.filter((e) => e.status === 'Agendado').length,
    concluidas: filteredEncomendasData.filter((e) => e.status === 'Concluído').length,
    canceladas: filteredEncomendasData.filter((e) => e.status === 'Cancelado').length,
  }), [filteredEncomendasData]);

  // ── Table rows (filtros de tabela sobre filteredEncomendasData) ───────────
  const tableRows = useMemo((): EncomendaRow[] => {
    return filteredEncomendasData.filter((e) => {
      // busca global
      const q = search.trim().toLowerCase();
      if (q && !`${e.origem} ${e.destino} ${e.remetente}`.toLowerCase().includes(q)) return false;
      // filtros tabela
      if (tblOrigem && !e.origem.toLowerCase().includes(tblOrigem.toLowerCase())) return false;
      if (tblDestino && !e.destino.toLowerCase().includes(tblDestino.toLowerCase())) return false;
      if (tblRemetente && !e.remetente.toLowerCase().includes(tblRemetente.toLowerCase())) return false;
      if (tblStatusEncomenda !== 'todos' && e.status !== tblStatusEncomenda) return false;
      if (tblTipoEncomenda !== 'Todos') {
        const pkg = (e.packageSize || '').toLowerCase();
        if (tblTipoEncomenda === 'Pequeno' && !['small', 'pequeño', 'pequ', 'pequen', 'pequena'].some((v) => pkg.includes(v))) return false;
        if (tblTipoEncomenda === 'Medio' && !['medium', 'medio', 'médio'].some((v) => pkg.includes(v))) return false;
        if (tblTipoEncomenda === 'Grande' && !['large', 'xl', 'grand'].some((v) => pkg.includes(v))) return false;
      }
      if (tblCodigo) {
        const cod = tblCodigo.replace(/^#/, '').trim().toLowerCase();
        if (!e.id.toLowerCase().includes(cod)) return false;
      }
      if (tblDestinatario && !e.remetente.toLowerCase().includes(tblDestinatario.toLowerCase())) return false;
      if (tblDataInicial && e.createdAtIso) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(tblDataInicial)) {
          const day = isoDatePartLocal(e.createdAtIso);
          if (day && day < tblDataInicial) return false;
        }
      }
      return true;
    }).map((e) => toEncomendaRow(e));
  }, [filteredEncomendasData, search, tblOrigem, tblDestino, tblRemetente, tblStatusEncomenda, tblTipoEncomenda, tblCodigo, tblDestinatario, tblDataInicial]);

  // ── Top destinos/origens (sobre filteredEncomendasData) ──────────────────
  const { topDestinos, topOrigens } = useMemo(() => {
    const destMap = new Map<string, number>();
    const origMap = new Map<string, number>();
    for (const e of filteredEncomendasData) {
      destMap.set(e.destino, (destMap.get(e.destino) ?? 0) + 1);
      origMap.set(e.origem, (origMap.get(e.origem) ?? 0) + 1);
    }
    const total = filteredEncomendasData.length || 1;
    const td = Array.from(destMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([label, count]) => ({ label, pct: Math.round((count / total) * 100), count: `${count} entregas` }));
    const to = Array.from(origMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([label, count]) => ({ label, pct: Math.round((count / total) * 100), count: `${count} entregas` }));
    return { topDestinos: td, topOrigens: to };
  }, [filteredEncomendasData]);

  // ── Pie chart data ────────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const raw = [
      { name: 'Em andamento', value: counts.emAndamento, color: '#cba04b' },
      { name: 'Agendadas', value: counts.agendadas, color: '#016df9' },
      { name: 'Concluídas', value: counts.concluidas, color: '#0d8344' },
      { name: 'Canceladas', value: counts.canceladas, color: '#d64545' },
    ].filter((d) => d.value > 0);
    if (raw.length === 0) return [{ name: 'Sem dados', value: 1, color: '#e2e2e2' }];
    return raw;
  }, [counts]);

  // ── Refetch after action ──────────────────────────────────────────────────
  const refetch = async () => {
    const items = await fetchEncomendas();
    setAllEncomendasData(items);
  };

  // ── Chip helpers ──────────────────────────────────────────────────────────
  const fChip = (label: string, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', key: label, onClick,
      style: {
        padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 600, ...font,
        background: active ? '#0d0d0d' : '#f1f1f1',
        color: active ? '#fff' : '#0d0d0d',
      },
    }, label);

  const tblField = (label: string, placeholder: string, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, label),
      React.createElement('input', {
        type: 'text', value, placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        style: { height: 44, borderRadius: 8, background: '#f1f1f1', border: 'none', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font },
      }));

  const tblDateInput = (label: string, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, label),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, background: '#f1f1f1', borderRadius: 8, padding: '0 12px 0 16px', gap: 8 } },
        React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
          React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' })),
        React.createElement('input', {
          type: 'date', value,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          'aria-label': label,
          style: { flex: 1, minWidth: 0, height: 40, border: 'none', background: 'transparent', fontSize: 14, color: value ? '#0d0d0d' : '#767676', outline: 'none', ...font },
        })));

  // ── Loading state ─────────────────────────────────────────────────────────
  if (dataLoading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Carregando encomendas...'));
  }

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpiCards = [
    { title: 'Total de Entregas', value: counts.total },
    { title: 'Entregas Concluídas', value: counts.concluidas },
    { title: 'Em Andamento', value: counts.emAndamento },
    { title: 'Agendadas', value: counts.agendadas },
    { title: 'Canceladas', value: counts.canceladas },
  ].map(({ title, value }) =>
    React.createElement('div', { key: title, style: webStyles.statCard },
      React.createElement('div', { style: webStyles.statCardHeader },
        React.createElement('span', { style: webStyles.statCardTitle }, title)),
      React.createElement('span', { style: webStyles.statCardValue }, String(value))));

  const kpiRow = React.createElement('div', { style: webStyles.statCardsRow }, ...kpiCards);

  // ── PieChart section ──────────────────────────────────────────────────────
  const totalForPct = counts.total || 1;
  const dot = (bg: string): React.CSSProperties => ({ width: 16, height: 16, borderRadius: 999, background: bg, flexShrink: 0 });
  const legendText: React.CSSProperties = { fontSize: 15, fontWeight: 400, color: '#0d0d0d', ...font };

  const customTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; color: string } }> }) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const pct = counts.total > 0 ? Math.round((d.value / counts.total) * 100) : 0;
    return React.createElement('div', {
      style: { background: '#0d0d0d', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, ...font, boxShadow: '0 4px 16px rgba(0,0,0,0.25)' },
    }, `${d.name}: ${pct}% (${d.value})`);
  };

  const pieSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 24, padding: 24, borderRadius: 16, background: '#f6f6f6', width: '100%', boxSizing: 'border-box' as const },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Distribuição por status'),
    React.createElement('div', {
      style: { display: 'flex', gap: 48, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' as const },
    },
      // Chart
      React.createElement('div', { style: { width: 280, height: 280, flexShrink: 0 } },
        React.createElement(ResponsiveContainer, { width: '100%', height: '100%' },
          React.createElement(PieChart, null,
            React.createElement(Pie, {
              data: pieData, cx: '50%', cy: '50%',
              innerRadius: 0, outerRadius: 120,
              dataKey: 'value',
              stroke: '#f6f6f6', strokeWidth: 2,
              animationBegin: 0, animationDuration: 800,
            },
              ...pieData.map((entry: { name: string; value: number; color: string }, idx: number) =>
                React.createElement(Cell, { key: `cell-${idx}`, fill: entry.color }))),
            React.createElement(Tooltip, { content: customTooltip })))),
      // Legend
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 32 } },
        React.createElement('p', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } },
          `Total: ${counts.total} entregas`),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, maxWidth: 300 } },
          ...([
            { name: 'Em andamento', value: counts.emAndamento, color: '#cba04b' },
            { name: 'Agendadas', value: counts.agendadas, color: '#016df9' },
            { name: 'Concluídas', value: counts.concluidas, color: '#0d8344' },
            { name: 'Canceladas', value: counts.canceladas, color: '#d64545' },
          ].map(({ name, value, color }) => {
            const pct = Math.round((value / totalForPct) * 100);
            return React.createElement('div', { key: name, style: { display: 'flex', gap: 10, alignItems: 'center' } },
              React.createElement('div', { style: dot(color) }),
              React.createElement('span', { style: legendText }, `${pct}% ${name} (${value})`));
          }))))));

  // ── Progress bar section (Top destinos/origens) ───────────────────────────
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

  const topSection = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    renderProgressCol('Top 5 destinos mais frequentes', topDestinos, '#0d0d0d'),
    renderProgressCol('Top 5 locais de origem', topOrigens, '#cba04b'));

  // ── Search row ────────────────────────────────────────────────────────────
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
        type: 'text', value: search, placeholder: 'Buscar remetente, destino ou origem...',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
        style: { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#0d0d0d', ...font },
      })),
    // Estado dropdown
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
    // Filtro modal página
    React.createElement('button', {
      type: 'button',
      onClick: () => setFiltroOpen(true),
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, filterIconSvg, 'Filtros'));

  // ── Table section ─────────────────────────────────────────────────────────
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
      'data-testid': 'encomendas-open-table-filter',
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

  const tableRowEls = tableRows.map((row) => {
    const st = statusStyles[row.status] ?? { bg: '#e2e2e2', color: '#555' };
    const item = allEncomendasData.find((x) => x.id === row.id);
    return React.createElement('div', {
      key: row.id,
      'data-testid': 'encomenda-table-row',
      style: {
        display: 'flex', height: 64, alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid #d9d9d9', background: '#f6f6f6',
      },
    },
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, fontWeight: 500 } }, row.destino),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500 } }, row.origem),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, fontWeight: 500 } }, row.remetente),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, row.data),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } }, row.tamanho),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[5].flex, minWidth: tableCols[5].minWidth } }, row.valor),
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
        React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar',
          onClick: () => { if (item) navigate(`/encomendas/${item.id}/editar`, { state: { from: 'encomendas' } }); },
        }, eyeActionSvg),
        React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar',
          onClick: () => { if (item) navigate(`/encomendas/${item.id}/editar`, { state: { from: 'encomendas' } }); },
        }, pencilActionSvg),
        row.rawStatus === 'pending_review' ? React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Confirmar encomenda',
          onClick: async () => {
            if (item && confirm('Confirmar esta encomenda?')) {
              if (item.tipo === 'dependent_shipment') await updateDependentShipmentStatus(item.id, 'confirmed');
              else await updateShipmentStatus(item.id, 'confirmed');
              await refetch();
            }
          },
        }, React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#22c55e', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }))) : null,
        row.status !== 'Cancelado' && row.status !== 'Concluído' ? React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Cancelar encomenda',
          onClick: async () => {
            if (item && confirm('Cancelar esta encomenda?')) {
              if (item.tipo === 'dependent_shipment') await updateDependentShipmentStatus(item.id, 'cancelled');
              else await updateShipmentStatus(item.id, 'cancelled');
              await refetch();
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

  // ── Modal filtro página ───────────────────────────────────────────────────
  const filtroModal = filtroOpen ? React.createElement('div', {
    role: 'dialog', 'aria-modal': true,
    style: { position: 'fixed' as const, inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 24, background: 'rgba(0,0,0,0.18)' },
    onClick: () => setFiltroOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 20, padding: 24, width: 360, maxHeight: '90vh', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro'),
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSmSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Data
      React.createElement('h3', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Data da atividade'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#767676', ...font } }, 'Data inicial'),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, background: '#f1f1f1', borderRadius: 8, padding: '0 12px 0 16px', gap: 8 } },
            React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
              React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
              React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' })),
            React.createElement('input', {
              type: 'date', value: filtroDataIni,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFiltroDataIni(e.target.value),
              'aria-label': 'Data inicial',
              style: { flex: 1, minWidth: 0, height: 40, border: 'none', background: 'transparent', fontSize: 14, color: filtroDataIni ? '#0d0d0d' : '#767676', outline: 'none', ...font },
            }))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#767676', ...font } }, 'Data final'),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, background: '#f1f1f1', borderRadius: 8, padding: '0 12px 0 16px', gap: 8 } },
            React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
              React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
              React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' })),
            React.createElement('input', {
              type: 'date', value: filtroDataFim,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFiltroDataFim(e.target.value),
              'aria-label': 'Data final',
              style: { flex: 1, minWidth: 0, height: 40, border: 'none', background: 'transparent', fontSize: 14, color: filtroDataFim ? '#0d0d0d' : '#767676', outline: 'none', ...font },
            })))),
      // Status
      React.createElement('h3', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Status da encomenda'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...(['todos', 'Em andamento', 'Agendado', 'Concluído', 'Cancelado'] as const).map((st) =>
          fChip(st === 'todos' ? 'Todos' : st, filtroStatus === st, () => setFiltroStatus(st)))),
      // Categoria
      React.createElement('h3', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Categoria'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        fChip('Todos', filtroCategoria === 'todos', () => setFiltroCategoria('todos')),
        fChip('Entregas', filtroCategoria === 'shipment', () => setFiltroCategoria('shipment')),
        fChip('Bagagens', filtroCategoria === 'dependent_shipment', () => setFiltroCategoria('dependent_shipment'))),
      // Buttons
      React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 4 } },
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroOpen(false),
          style: { flex: 1, height: 44, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Aplicar filtro'),
        React.createElement('button', {
          type: 'button',
          onClick: () => { setFiltroStatus('todos'); setFiltroCategoria('todos'); setFiltroDataIni(''); setFiltroDataFim(''); },
          style: { flex: 1, height: 44, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Resetar filtros')))) : null;

  // ── Modal filtro tabela ───────────────────────────────────────────────────
  const tblFiltroModal = tblFiltroOpen ? React.createElement('div', {
    role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'encomendas-filtro-tabela-titulo',
    style: { position: 'fixed' as const, inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 24, background: 'rgba(0,0,0,0.18)' },
    onClick: () => setTblFiltroOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 20, padding: 24, width: 400, maxHeight: '90vh', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { id: 'encomendas-filtro-tabela-titulo', style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro da tabela'),
        React.createElement('button', {
          type: 'button', onClick: () => setTblFiltroOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSmSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Fields
      tblField('Origem', 'Ex: São Paulo, SP', tblOrigem, setTblOrigem),
      tblField('Destino', 'Ex: São Luís, MA', tblDestino, setTblDestino),
      tblDateInput('Data inicial', tblDataInicial, setTblDataInicial),
      tblField('Remetente', 'Ex: Nome do remetente', tblRemetente, setTblRemetente),
      tblField('Destinatário', 'Ex: Nome do destinatário', tblDestinatario, setTblDestinatario),
      tblField('Código da encomenda', 'Ex: #3421341342', tblCodigo, setTblCodigo),
      // Status
      React.createElement('h3', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Status da encomenda'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...(['todos', 'Em andamento', 'Agendado', 'Concluído', 'Cancelado'] as const).map((st) =>
          fChip(st === 'todos' ? 'Todos' : st, tblStatusEncomenda === st, () => setTblStatusEncomenda(st)))),
      // Tipo de encomenda
      React.createElement('h3', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Tipo de encomenda'),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
        ...['Todos', 'Pequeno', 'Medio', 'Grande'].map((t) =>
          fChip(t, tblTipoEncomenda === t, () => setTblTipoEncomenda(t)))),
      // Buttons
      React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 4 } },
        React.createElement('button', {
          type: 'button', onClick: () => setTblFiltroOpen(false),
          style: { flex: 1, height: 44, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Aplicar filtro'),
        React.createElement('button', {
          type: 'button',
          onClick: () => { setTblOrigem(''); setTblDestino(''); setTblRemetente(''); setTblDestinatario(''); setTblCodigo(''); setTblDataInicial(''); setTblStatusEncomenda('todos'); setTblTipoEncomenda('Todos'); },
          style: { flex: 1, height: 44, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Resetar filtros')))) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Encomendas'),
    kpiRow,
    pieSection,
    topSection,
    searchRow,
    tableSection,
    filtroModal,
    tblFiltroModal);
}
