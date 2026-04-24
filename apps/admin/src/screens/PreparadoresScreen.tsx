/**
 * PreparadoresScreen — Preparadores conforme Figma 898-20340.
 * Filtro da página: Figma 898-22995. Filtro da tabela: Figma 1280-35489 (1227-24261).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  filterIconSvg,
} from '../styles/webStyles';
import { fetchPreparadoresWorkersBySubtype } from '../data/queries';
import type { PreparadorListItem } from '../data/types';

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
const calendarSvgLg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));
const closeModalSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

type FiltroStatusChip = 'todos' | 'em_andamento' | 'agendadas' | 'concluidas' | 'canceladas';
type FiltroPeriodo = 'todos' | 'semana' | 'mes' | 'ano';
type FiltroCategoria = 'todos' | 'takeme' | 'parceiro';

// Avatar colors
const avatarColors: Record<string, string> = {
  C: '#4A90D9', J: '#7B61FF', F: '#E8725C', E: '#50C878', M: '#F5A623', D: '#9B59B6',
};

type PrepRow = {
  id: string;
  nome: string;
  origem: string;
  destino: string;
  dataInicio: string;
  rawDate: string; // ISO date for filtering (YYYY-MM-DD)
  previsao: string;
  avaliacao: number;
  status: 'Em andamento' | 'Agendado' | 'Cancelado' | 'Concluído';
};

const statusChipParaRow: Record<Exclude<FiltroStatusChip, 'todos'>, PrepRow['status']> = {
  em_andamento: 'Em andamento',
  agendadas: 'Agendado',
  concluidas: 'Concluído',
  canceladas: 'Cancelado',
};

const tableCols = [
  { label: 'Preparador', flex: '1 1 15%', minWidth: 148 },
  { label: 'Origem', flex: '1 1 12%', minWidth: 104 },
  { label: 'Destino', flex: '1 1 12%', minWidth: 104 },
  { label: 'Data/Hora Início', flex: '0 0 108px', minWidth: 108 },
  { label: 'Previsão Entrega', flex: '0 0 108px', minWidth: 108 },
  { label: 'Avaliação', flex: '0 0 76px', minWidth: 76 },
  { label: 'Status', flex: '0 0 124px', minWidth: 124 },
  { label: 'Visualizar/Editar', flex: '0 0 100px', minWidth: 100 },
];

const TABLE_GRID_MIN_WIDTH = tableCols.reduce((acc, c) => acc + c.minWidth, 0);

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
};

const chipFiltro = (label: string, selecionado: boolean, onClick: () => void) =>
  React.createElement('button', {
    type: 'button',
    onClick,
    style: {
      height: 40,
      padding: '0 16px',
      borderRadius: 90,
      border: 'none',
      cursor: 'pointer',
      background: selecionado ? '#0d0d0d' : '#f1f1f1',
      color: selecionado ? '#fff' : '#0d0d0d',
      fontSize: 14,
      fontWeight: 500,
      lineHeight: 1.5,
      whiteSpace: 'nowrap' as const,
      ...font,
    },
  }, label);

export default function PreparadoresScreen() {
  const navigate = useNavigate();
  const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = require('recharts');

  const [viewportW, setViewportW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  const [activeTab, setActiveTab] = useState<'encomendas' | 'excursoes'>('encomendas');
  // ── Filtro da página (Figma 898-22995) ──────────────────────────────
  const [filtroPaginaOpen, setFiltroPaginaOpen] = useState(false);
  const [appliedPeriodoPagina, setAppliedPeriodoPagina] = useState<FiltroPeriodo>('todos');
  const [appliedDataInicialPagina, setAppliedDataInicialPagina] = useState('');
  const [appliedDataFinalPagina, setAppliedDataFinalPagina] = useState('');
  const [appliedStatusPagina, setAppliedStatusPagina] = useState<FiltroStatusChip>('todos');
  const [draftPeriodoPagina, setDraftPeriodoPagina] = useState<FiltroPeriodo>('todos');
  const [draftDataInicialPagina, setDraftDataInicialPagina] = useState('');
  const [draftDataFinalPagina, setDraftDataFinalPagina] = useState('');
  const [draftStatusPagina, setDraftStatusPagina] = useState<FiltroStatusChip>('todos');
  // ── Filtro da tabela (Figma 1280-35489) ─────────────────────────────
  const [filtroTabelaOpen, setFiltroTabelaOpen] = useState(false);
  const [appliedStatusTabela, setAppliedStatusTabela] = useState<FiltroStatusChip>('todos');
  const [appliedNomeModal, setAppliedNomeModal] = useState('');
  const [appliedOrigemModal, setAppliedOrigemModal] = useState('');
  const [appliedDestinoModal, setAppliedDestinoModal] = useState('');
  const [appliedHoraEmbarque, setAppliedHoraEmbarque] = useState('');
  const [appliedHoraChegada, setAppliedHoraChegada] = useState('');
  const [appliedDataInicialTabela, setAppliedDataInicialTabela] = useState('');
  const [appliedCategoria, setAppliedCategoria] = useState<FiltroCategoria>('todos');
  const [draftStatusTabela, setDraftStatusTabela] = useState<FiltroStatusChip>('todos');
  const [draftNomeModal, setDraftNomeModal] = useState('');
  const [draftOrigemModal, setDraftOrigemModal] = useState('');
  const [draftDestinoModal, setDraftDestinoModal] = useState('');
  const [draftHoraEmbarque, setDraftHoraEmbarque] = useState('');
  const [draftHoraChegada, setDraftHoraChegada] = useState('');
  const [draftDataInicialTabela, setDraftDataInicialTabela] = useState('');
  const [draftCategoria, setDraftCategoria] = useState<FiltroCategoria>('todos');

  const abrirFiltroPagina = useCallback(() => {
    setDraftPeriodoPagina(appliedPeriodoPagina);
    setDraftDataInicialPagina(appliedDataInicialPagina);
    setDraftDataFinalPagina(appliedDataFinalPagina);
    setDraftStatusPagina(appliedStatusPagina);
    setFiltroTabelaOpen(false);
    setFiltroPaginaOpen(true);
  }, [appliedPeriodoPagina, appliedDataInicialPagina, appliedDataFinalPagina, appliedStatusPagina]);

  const fecharFiltroPagina = useCallback(() => setFiltroPaginaOpen(false), []);

  const aplicarFiltroPagina = useCallback(() => {
    setAppliedPeriodoPagina(draftPeriodoPagina);
    // Converter período em datas se não preenchidas manualmente
    let di = draftDataInicialPagina;
    let df = draftDataFinalPagina;
    if (draftPeriodoPagina !== 'todos' && !di && !df) {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (draftPeriodoPagina === 'semana') {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay());
        di = d.toISOString().slice(0, 10);
        df = today;
      } else if (draftPeriodoPagina === 'mes') {
        di = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        df = today;
      } else if (draftPeriodoPagina === 'ano') {
        di = `${now.getFullYear()}-01-01`;
        df = today;
      }
    }
    setAppliedDataInicialPagina(di);
    setAppliedDataFinalPagina(df);
    setAppliedStatusPagina(draftStatusPagina);
    setAppliedStatusTabela(draftStatusPagina);
    setFiltroPaginaOpen(false);
  }, [draftPeriodoPagina, draftDataInicialPagina, draftDataFinalPagina, draftStatusPagina]);

  const abrirFiltroTabela = useCallback(() => {
    setDraftStatusTabela(appliedStatusTabela);
    setDraftNomeModal(appliedNomeModal);
    setDraftOrigemModal(appliedOrigemModal);
    setDraftDestinoModal(appliedDestinoModal);
    setDraftHoraEmbarque(appliedHoraEmbarque);
    setDraftHoraChegada(appliedHoraChegada);
    setDraftDataInicialTabela(appliedDataInicialTabela);
    setDraftCategoria(appliedCategoria);
    setFiltroPaginaOpen(false);
    setFiltroTabelaOpen(true);
  }, [activeTab, appliedStatusTabela, appliedNomeModal, appliedOrigemModal, appliedDestinoModal, appliedHoraEmbarque, appliedHoraChegada, appliedDataInicialTabela, appliedCategoria]);

  const fecharFiltroTabela = useCallback(() => setFiltroTabelaOpen(false), []);

  const aplicarFiltroTabela = useCallback(() => {
    setAppliedStatusTabela(draftStatusTabela);
    setAppliedStatusPagina(draftStatusTabela);
    setAppliedNomeModal(draftNomeModal);
    setAppliedOrigemModal(draftOrigemModal);
    setAppliedDestinoModal(draftDestinoModal);
    setAppliedHoraEmbarque(draftHoraEmbarque);
    setAppliedHoraChegada(draftHoraChegada);
    setAppliedDataInicialTabela(draftDataInicialTabela);
    setAppliedCategoria(draftCategoria);
    setFiltroTabelaOpen(false);
  }, [draftStatusTabela, draftNomeModal, draftOrigemModal, draftDestinoModal, draftHoraEmbarque, draftHoraChegada, draftDataInicialTabela, draftCategoria]);

  useEffect(() => {
    if (!filtroPaginaOpen && !filtroTabelaOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltroPaginaOpen(false);
        setFiltroTabelaOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtroPaginaOpen, filtroTabelaOpen]);

  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toolbarStackActions = viewportW < 560;

  // ── Real data from Supabase ─────────────────────────────────────────
  const [preparadoresData, setPreparadoresData] = useState<PreparadorListItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    // Lista vem de `worker_profiles` (role=preparer) filtrada por subtype.
    // Origem/destino/previsão ficam como "—" porque o cadastro do preparador
    // não carrega pedido específico; detalhes por pedido ficam em /atendimentos.
    const subtype = activeTab === 'excursoes' ? 'excursions' : 'shipments';
    fetchPreparadoresWorkersBySubtype(subtype).then((items) => {
      if (!cancelled) { setPreparadoresData(items); setDataLoading(false); }
    });
    return () => { cancelled = true; };
  }, [activeTab]);

  const tableRows: PrepRow[] = useMemo(() => preparadoresData.map((p) => ({
    id: p.id,
    nome: p.nome,
    origem: p.origem,
    destino: p.destino,
    dataInicio: p.dataInicio,
    rawDate: p.rawDate ?? '',
    previsao: p.previsao,
    avaliacao: p.avaliacao ?? 0,
    status: p.status,
  })), [preparadoresData]);

  // ── filteredData: base for KPIs and chart ───────────────────────────
  const filteredData = useMemo(() => {
    return tableRows.filter((r) => {
      if (appliedStatusPagina !== 'todos') {
        const expected = statusChipParaRow[appliedStatusPagina as Exclude<FiltroStatusChip, 'todos'>];
        if (r.status !== expected) return false;
      }
      if (appliedDataInicialPagina && r.rawDate && r.rawDate < appliedDataInicialPagina) return false;
      if (appliedDataFinalPagina && r.rawDate && r.rawDate > appliedDataFinalPagina) return false;
      return true;
    });
  }, [tableRows, appliedStatusPagina, appliedDataInicialPagina, appliedDataFinalPagina]);

  // ── tableRowsFiltered ───────────────────────────────────────────────
  const tableRowsFiltered = useMemo(() => {
    let rows = [...filteredData];
    // Table filter: status (overrides page filter if set)
    if (appliedStatusTabela !== 'todos') {
      rows = rows.filter((r) => r.status === statusChipParaRow[appliedStatusTabela as Exclude<FiltroStatusChip, 'todos'>]);
    }
    // Table filter: text fields
    const n = appliedNomeModal.trim().toLowerCase();
    if (n) rows = rows.filter((r) => r.nome.toLowerCase().includes(n));
    const o = appliedOrigemModal.trim().toLowerCase();
    if (o) rows = rows.filter((r) => r.origem.toLowerCase().includes(o));
    const d = appliedDestinoModal.trim().toLowerCase();
    if (d) rows = rows.filter((r) => r.destino.toLowerCase().includes(d));
    const diTab = appliedDataInicialTabela.trim();
    if (diTab) rows = rows.filter((r) => !r.rawDate || r.rawDate >= diTab);
    return rows;
  }, [filteredData, appliedStatusTabela, appliedNomeModal, appliedOrigemModal, appliedDestinoModal, appliedDataInicialTabela]);

  // ── KPIs from filteredData ──────────────────────────────────────────
  const isExcursoes = activeTab === 'excursoes';
  const emAndamento = filteredData.filter((p) => p.status === 'Em andamento').length;
  const avgRating = filteredData.length > 0
    ? (filteredData.reduce((s, p) => s + (p.avaliacao ?? 0), 0) / filteredData.length).toFixed(1)
    : '—';
  const metrics = isExcursoes
    ? [
        { title: 'Total de preparadores ativos', value: String(filteredData.length) },
        { title: 'Excursões em andamento', value: String(emAndamento) },
        { title: 'Avaliação média geral', value: avgRating },
      ]
    : [
        { title: 'Total de preparadores ativos', value: String(filteredData.length) },
        { title: 'Encomendas em andamento', value: String(emAndamento) },
        { title: 'Avaliação média geral', value: avgRating },
      ];

  // ── Recharts data ───────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const c = { emAndamento: 0, agendado: 0, concluido: 0, cancelado: 0 };
    filteredData.forEach((p) => {
      if (p.status === 'Em andamento') c.emAndamento++;
      else if (p.status === 'Agendado') c.agendado++;
      else if (p.status === 'Concluído') c.concluido++;
      else if (p.status === 'Cancelado') c.cancelado++;
    });
    return c;
  }, [filteredData]);

  const pieData = useMemo(() => [
    { name: 'Em andamento', value: statusCounts.emAndamento, color: '#cba04b' },
    { name: 'Agendado', value: statusCounts.agendado, color: '#016df9' },
    { name: 'Concluído', value: statusCounts.concluido, color: '#0d8344' },
    { name: 'Cancelado', value: statusCounts.cancelado, color: '#d64545' },
  ].filter((d) => d.value > 0), [statusCounts]);

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

  // ── Search row (Filtro button only, aligned right) ────────────────────
  const searchRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, width: '100%' },
  },
    React.createElement('button', {
      type: 'button',
      onClick: abrirFiltroPagina,
      'data-testid': 'preparadores-open-page-filter',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
      },
    }, filterIconSvg, 'Filtros'));

  // ── Metrics ───────────────────────────────────────────────────────────
  const metricCards = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    ...metrics.map((m) =>
      React.createElement('div', { key: m.title, style: s.metricCard },
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, m.title),
        React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, m.value))));

  // ── Recharts PieChart ─────────────────────────────────────────────────
  const chartSection = React.createElement('div', { style: s.chartCard },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Distribuição por status'),
    React.createElement(ResponsiveContainer, { width: '100%', height: 220 },
      React.createElement(PieChart, null,
        React.createElement(Pie, {
          data: pieData,
          dataKey: 'value',
          innerRadius: 60,
          outerRadius: 100,
          paddingAngle: pieData.length > 1 ? 2 : 0,
        },
          ...pieData.map((entry: { name: string; value: number; color: string }) =>
            React.createElement(Cell, { key: entry.name, fill: entry.color }))),
        React.createElement(Tooltip, null))),
    React.createElement('div', {
      style: { display: 'flex', flexWrap: 'wrap' as const, gap: 12, justifyContent: 'center' },
    },
      ...pieData.map((entry: { name: string; value: number; color: string }) =>
        React.createElement('div', {
          key: entry.name,
          style: { display: 'flex', alignItems: 'center', gap: 6 },
        },
          React.createElement('div', { style: { width: 12, height: 12, borderRadius: '50%', background: entry.color, flexShrink: 0 } }),
          React.createElement('span', { style: { fontSize: 13, color: '#0d0d0d', ...font } }, `${entry.name} (${entry.value})`)))));

  // ── Table ─────────────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    fontSize: 14,
    color: '#0d0d0d',
    ...font,
    padding: '6px',
    minWidth: 0,
    boxSizing: 'border-box' as const,
  };
  const cellTextEllipsis: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    minWidth: 0,
    width: '100%',
  };

  const tableToolbar = React.createElement('div', {
    style: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 72,
      padding: viewportW < 480 ? '14px 16px' : '18px 20px',
      background: '#f6f6f6',
      borderRadius: '16px 16px 0 0',
      boxSizing: 'border-box' as const,
      width: '100%',
    },
  },
    React.createElement('p', {
      style: {
        fontSize: viewportW < 400 ? 15 : 16,
        fontWeight: 600,
        color: '#0d0d0d',
        margin: 0,
        flex: toolbarStackActions ? '1 1 100%' : '1 1 200px',
        minWidth: 0,
        lineHeight: 1.35,
        paddingRight: toolbarStackActions ? 0 : 8,
        ...font,
      },
    }, isExcursoes ? 'Lista de preparadores de excursões' : 'Lista de preparadores de encomendas'),
    React.createElement('button', {
      type: 'button',
      onClick: abrirFiltroTabela,
      'data-testid': 'preparadores-open-table-filter',
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 40,
        padding: '8px 20px',
        background: '#fff',
        border: '1px solid #e2e2e2',
        borderRadius: 999,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
        color: '#0d0d0d',
        flexShrink: 0,
        width: toolbarStackActions ? '100%' : 'auto',
        boxSizing: 'border-box' as const,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        ...font,
      },
    }, filterIconSvg, 'Filtro'));

  const headerCellStyle = (c: (typeof tableCols)[0]): React.CSSProperties => ({
    flex: c.flex,
    minWidth: c.minWidth,
    maxWidth: c.flex.startsWith('0 0') ? c.minWidth : undefined,
    fontSize: 11,
    fontWeight: 400,
    color: '#0d0d0d',
    ...font,
    padding: '8px 6px',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1.25,
    whiteSpace: 'normal' as const,
    wordBreak: 'break-word' as const,
    boxSizing: 'border-box' as const,
  });

  const tableHeader = React.createElement('div', {
    style: {
      display: 'flex',
      minHeight: 53,
      background: '#e2e2e2',
      borderBottom: '1px solid #d9d9d9',
      padding: '0 12px',
      alignItems: 'stretch',
      width: '100%',
      minWidth: TABLE_GRID_MIN_WIDTH,
      boxSizing: 'border-box' as const,
    },
  },
    ...tableCols.map((c) => React.createElement('div', { key: c.label, style: headerCellStyle(c) }, c.label)));

  const tableRowEls = tableRowsFiltered.map((row, idx) => {
    const initial = row.nome.charAt(0);
    const avatarBg = avatarColors[initial] || '#999';
    const st = statusStyles[row.status];
    return React.createElement('div', {
      key: row.id || `${row.nome}-${idx}`,
      'data-testid': 'preparador-table-row',
      style: {
        display: 'flex',
        minHeight: 64,
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #d9d9d9',
        background: '#f6f6f6',
        width: '100%',
        minWidth: TABLE_GRID_MIN_WIDTH,
        boxSizing: 'border-box' as const,
      },
    },
      // Preparador (avatar + name)
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, maxWidth: tableCols[0].flex.startsWith('0 0') ? tableCols[0].minWidth : undefined, gap: 10 } },
        React.createElement('div', {
          style: {
            width: 36, height: 36, borderRadius: '50%', background: avatarBg, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, React.createElement('span', { style: { color: '#fff', fontSize: 14, fontWeight: 600, ...font } }, initial)),
        React.createElement('span', { style: { fontWeight: 500, ...cellTextEllipsis } }, row.nome)),
      // Origem
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, maxWidth: tableCols[1].flex.startsWith('0 0') ? tableCols[1].minWidth : undefined, fontWeight: 500 } },
        React.createElement('span', { style: cellTextEllipsis }, row.origem)),
      // Destino
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, maxWidth: tableCols[2].flex.startsWith('0 0') ? tableCols[2].minWidth : undefined, fontWeight: 500 } },
        React.createElement('span', { style: cellTextEllipsis }, row.destino)),
      // Data/Hora Início
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth, maxWidth: tableCols[3].minWidth, whiteSpace: 'pre-line' as const, fontSize: 13, lineHeight: 1.4, alignItems: 'flex-start' as const } }, row.dataInicio),
      // Previsão Entrega
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth, maxWidth: tableCols[4].minWidth, whiteSpace: 'pre-line' as const, fontSize: 13, lineHeight: 1.4, alignItems: 'flex-start' as const } }, row.previsao),
      // Avaliação
      React.createElement('div', { style: { ...cellBase, flex: tableCols[5].flex, minWidth: tableCols[5].minWidth, maxWidth: tableCols[5].minWidth, gap: 4, flexShrink: 0 } },
        starSvg, React.createElement('span', null, (row.avaliacao ?? 0).toFixed(1))),
      // Status
      React.createElement('div', { style: { ...cellBase, flex: tableCols[6].flex, minWidth: tableCols[6].minWidth, maxWidth: tableCols[6].minWidth, alignItems: 'flex-start' as const } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 10px', borderRadius: 999,
            fontSize: 12, fontWeight: 700, lineHeight: 1.45, whiteSpace: 'normal' as const, wordBreak: 'break-word' as const,
            background: st.bg, color: st.color, ...font,
            maxWidth: '100%',
            boxSizing: 'border-box' as const,
          },
        }, row.status)),
      // Actions
      React.createElement('div', {
        style: {
          flex: tableCols[7].flex,
          minWidth: tableCols[7].minWidth,
          maxWidth: tableCols[7].minWidth,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          flexShrink: 0,
          padding: '6px',
          boxSizing: 'border-box' as const,
        },
      },
        React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar',
          onClick: () => navigate(`/preparadores/${row.id}`, { state: { tab: activeTab } }),
        }, eyeActionSvg),
        React.createElement('button', {
          type: 'button',
          style: webStyles.viagensActionBtn,
          'aria-label': 'Editar',
          onClick: () => navigate(`/preparadores/${row.id}/editar`, { state: { tab: activeTab } }),
        }, pencilActionSvg)));
  });

  const tableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%', minWidth: 0, maxWidth: '100%' },
  },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%', minWidth: 0, maxWidth: '100%' } },
      tableToolbar,
      React.createElement('div', {
        style: {
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflowX: 'auto' as const,
          WebkitOverflowScrolling: 'touch' as const,
          overscrollBehaviorX: 'contain' as const,
        },
      },
        tableHeader,
        ...tableRowEls)));

  const inputTabelaStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 16,
    fontWeight: 400,
    color: '#0d0d0d',
    padding: '0 16px',
    height: '100%',
    ...font,
  };

  const campoTextoTabela = (rotulo: string, valor: string, onChange: (v: string) => void, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, width: '100%', gap: 0 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', minHeight: 40, display: 'flex', alignItems: 'center', ...font } }, rotulo),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, borderRadius: 8, background: '#f1f1f1', paddingLeft: 16, overflow: 'hidden', width: '100%', boxSizing: 'border-box' as const } },
        React.createElement('input', {
          type: 'text',
          value: valor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          placeholder,
          style: { ...inputTabelaStyle, color: valor ? '#0d0d0d' : '#767676' },
        })));

  const campoDataInicialTabela = (valor: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, width: '100%', gap: 0 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', minHeight: 40, display: 'flex', alignItems: 'center', ...font } }, 'Data inicial'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, borderRadius: 8, background: '#f1f1f1', paddingLeft: 16, overflow: 'hidden', width: '100%', boxSizing: 'border-box' as const } },
        calendarSvgLg,
        React.createElement('input', {
          type: 'date',
          value: valor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          placeholder: '',
          style: { ...inputTabelaStyle, color: valor ? '#0d0d0d' : '#767676' },
        })));

  const tituloSecaoModal18: React.CSSProperties = { fontSize: 18, fontWeight: 600, color: '#0d0d0d', lineHeight: 1.5, ...font };

  const campoDataPagina = (rotulo: string, valor: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, width: '100%', gap: 0 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', minHeight: 40, display: 'flex', alignItems: 'center', ...font } }, rotulo),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, borderRadius: 8, background: '#f1f1f1', paddingLeft: 16, overflow: 'hidden', width: '100%', boxSizing: 'border-box' as const } },
        calendarSvgLg,
        React.createElement('input', {
          type: 'date',
          value: valor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          style: { ...inputTabelaStyle, color: valor ? '#0d0d0d' : '#767676' },
        })));

  const overlayModalStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    boxSizing: 'border-box',
  };

  const filtroPaginaModal = filtroPaginaOpen
    ? React.createElement('div', {
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': 'filtro-pagina-preparadores-titulo',
      style: overlayModalStyle,
      onClick: fecharFiltroPagina,
    },
      React.createElement('div', {
        style: {
          background: '#fff',
          borderRadius: 16,
          boxShadow: '6px 6px 12px 0 rgba(0,0,0,0.15)',
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          overflowY: 'auto' as const,
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 24,
          padding: '24px 0',
          boxSizing: 'border-box' as const,
        },
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      },
        React.createElement('div', { style: { borderBottom: '1px solid #e2e2e2', paddingBottom: 24, width: '100%' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingLeft: 16, paddingRight: 16, width: '100%', boxSizing: 'border-box' as const } },
            React.createElement('div', { style: { flex: '1 1 auto', minWidth: 0 } },
              React.createElement('h2', { id: 'filtro-pagina-preparadores-titulo', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro'),
              React.createElement('p', {
                style: { fontSize: 14, fontWeight: 400, color: '#767676', margin: '6px 0 0 0', lineHeight: 1.4, ...font },
              }, isExcursoes ? 'Contexto: preparadores de excursões' : 'Contexto: preparadores de encomendas')),
            React.createElement('button', {
              type: 'button',
              onClick: fecharFiltroPagina,
              'aria-label': 'Fechar',
              style: {
                width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#f1f1f1', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, marginTop: -2,
              },
            }, closeModalSvg))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, isExcursoes ? 'Datas da excursão' : 'Datas do preparo'),
          campoDataPagina('Data inicial', draftDataInicialPagina, setDraftDataInicialPagina),
          campoDataPagina('Data final', draftDataFinalPagina, setDraftDataFinalPagina)),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, 'Período'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            chipFiltro('Todos', draftPeriodoPagina === 'todos', () => setDraftPeriodoPagina('todos')),
            chipFiltro('Esta semana', draftPeriodoPagina === 'semana', () => setDraftPeriodoPagina('semana')),
            chipFiltro('Este mês', draftPeriodoPagina === 'mes', () => setDraftPeriodoPagina('mes')),
            chipFiltro('Este ano', draftPeriodoPagina === 'ano', () => setDraftPeriodoPagina('ano')))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, 'Status'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            chipFiltro('Todos', draftStatusPagina === 'todos', () => setDraftStatusPagina('todos')),
            chipFiltro('Em andamento', draftStatusPagina === 'em_andamento', () => setDraftStatusPagina('em_andamento')),
            chipFiltro('Agendadas', draftStatusPagina === 'agendadas', () => setDraftStatusPagina('agendadas')),
            chipFiltro('Concluídas', draftStatusPagina === 'concluidas', () => setDraftStatusPagina('concluidas')),
            chipFiltro('Canceladas', draftStatusPagina === 'canceladas', () => setDraftStatusPagina('canceladas')))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('button', {
            type: 'button',
            onClick: aplicarFiltroPagina,
            style: {
              width: '100%', height: 48, borderRadius: 8, border: 'none', background: '#0d0d0d', color: '#fff',
              fontSize: 16, fontWeight: 500, lineHeight: 1.5, cursor: 'pointer', ...font,
            },
          }, 'Aplicar filtro'),
          React.createElement('button', {
            type: 'button',
            onClick: () => { setDraftPeriodoPagina('todos'); setDraftDataInicialPagina(''); setDraftDataFinalPagina(''); setDraftStatusPagina('todos'); },
            style: {
              width: '100%', height: 48, borderRadius: 8, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838',
              fontSize: 16, fontWeight: 500, lineHeight: 1.5, cursor: 'pointer', ...font,
            },
          }, 'Redefinir filtros'))))
    : null;

  const filtroTabelaModal = filtroTabelaOpen
    ? React.createElement('div', {
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': 'filtro-tabela-preparadores-titulo',
      style: overlayModalStyle,
      onClick: fecharFiltroTabela,
    },
      React.createElement('div', {
        style: {
          background: '#fff',
          borderRadius: 16,
          boxShadow: '6px 6px 12px 0 rgba(0,0,0,0.15)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto' as const,
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 24,
          padding: '24px 0',
          boxSizing: 'border-box' as const,
        },
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      },
        React.createElement('div', { style: { borderBottom: '1px solid #e2e2e2', paddingBottom: 24, width: '100%' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 16, width: '100%', boxSizing: 'border-box' as const, gap: 12 } },
            React.createElement('div', { style: { flex: '1 1 auto', minWidth: 0 } },
              React.createElement('h2', { id: 'filtro-tabela-preparadores-titulo', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.25, ...font } }, 'Filtro da tabela'),
              React.createElement('p', {
                style: { fontSize: 14, fontWeight: 400, color: '#767676', margin: '6px 0 0 0', lineHeight: 1.4, ...font },
              }, isExcursoes ? 'Filtra apenas a lista de excursões abaixo.' : 'Filtra apenas a lista de encomendas abaixo.')),
            React.createElement('button', {
              type: 'button',
              onClick: fecharFiltroTabela,
              'aria-label': 'Fechar',
              style: {
                width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#f1f1f1', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, marginTop: -2,
              },
            }, closeModalSvg))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          campoTextoTabela('Nome do preparador', draftNomeModal, setDraftNomeModal, 'Ex: Carlos'),
          campoTextoTabela('Origem', draftOrigemModal, setDraftOrigemModal, 'Ex: São Paulo, SP'),
          campoTextoTabela('Destino', draftDestinoModal, setDraftDestinoModal, 'Ex: São Luis, SP'),
          campoTextoTabela(isExcursoes ? 'Hora do embarque' : 'Data/Hora de início', draftHoraEmbarque, setDraftHoraEmbarque, isExcursoes ? 'Ex: 09:00' : 'Ex: 08:30 ou trecho da data'),
          campoTextoTabela(isExcursoes ? 'Hora de chegada' : 'Previsão de entrega', draftHoraChegada, setDraftHoraChegada, isExcursoes ? 'Ex: 12:00' : 'Ex: 18:00 ou trecho da previsão'),
          campoDataInicialTabela(draftDataInicialTabela, setDraftDataInicialTabela)),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, isExcursoes ? 'Status da viagem' : 'Status da encomenda'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            chipFiltro('Todos', draftStatusTabela === 'todos', () => setDraftStatusTabela('todos')),
            chipFiltro('Em andamento', draftStatusTabela === 'em_andamento', () => setDraftStatusTabela('em_andamento')),
            chipFiltro('Agendadas', draftStatusTabela === 'agendadas', () => setDraftStatusTabela('agendadas')),
            chipFiltro('Concluídas', draftStatusTabela === 'concluidas', () => setDraftStatusTabela('concluidas')),
            chipFiltro('Canceladas', draftStatusTabela === 'canceladas', () => setDraftStatusTabela('canceladas')))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, 'Categoria'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            chipFiltro('Todos', draftCategoria === 'todos', () => setDraftCategoria('todos')),
            chipFiltro('Take Me', draftCategoria === 'takeme', () => setDraftCategoria('takeme')),
            chipFiltro('Motorista parceiro', draftCategoria === 'parceiro', () => setDraftCategoria('parceiro')))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('button', {
            type: 'button',
            onClick: aplicarFiltroTabela,
            style: {
              width: '100%', height: 48, borderRadius: 8, border: 'none', background: '#0d0d0d', color: '#fff',
              fontSize: 16, fontWeight: 500, lineHeight: 1.5, cursor: 'pointer', ...font,
            },
          }, 'Aplicar filtro'),
          React.createElement('button', {
            type: 'button',
            onClick: () => { setDraftStatusTabela('todos'); setDraftNomeModal(''); setDraftOrigemModal(''); setDraftDestinoModal(''); setDraftHoraEmbarque(''); setDraftHoraChegada(''); setDraftDataInicialTabela(''); setDraftCategoria('todos'); },
            style: {
              width: '100%', height: 48, borderRadius: 8, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838',
              fontSize: 16, fontWeight: 500, lineHeight: 1.5, cursor: 'pointer', ...font,
            },
          }, 'Redefinir filtros'))))
    : null;

  if (dataLoading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Carregando preparadores...'));
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    tabs,
    sectionTitle,
    searchRow,
    metricCards,
    chartSection,
    tableSection,
    filtroPaginaModal,
    filtroTabelaModal);
}
