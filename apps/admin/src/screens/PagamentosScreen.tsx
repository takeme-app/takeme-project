/**
 * PagamentosScreen — Pagamentos conforme Figma 905-15884.
 * Modal filtro da tabela: Figma 905-21772.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';
import { PAGAMENTOS_GESTAO_PREPARADORES_HREF } from '../constants/pagamentosGestaoNav';
import { fetchPagamentos, fetchPagamentoCounts } from '../data/queries';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { PagamentoListItem, PagamentoCounts } from '../data/types';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const calendarSvgLg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));
const closeModalSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

type PagPeriodoFiltro = 'semana' | 'mes' | 'ano';
type PagStatusFiltro = PagamentoListItem['status'];

function getPeriodRange(t: PagPeriodoFiltro): { start: Date; end: Date } {
  const now = new Date();
  if (t === 'semana') {
    const d = new Date(now);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }
  if (t === 'mes') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end };
}

function payoutDateInPeriod(iso: string, rangeStart: Date, rangeEnd: Date): boolean {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return true;
  return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
}

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

function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const tableCols = [
  { label: 'Profissional', flex: '1 1 20%', minWidth: 150 },
  { label: 'Tipo', flex: '0 0 120px', minWidth: 120 },
  { label: 'Valor bruto', flex: '0 0 130px', minWidth: 130 },
  { label: 'Data', flex: '0 0 110px', minWidth: 110 },
  { label: 'Status', flex: '0 0 130px', minWidth: 130 },
];

const statusStyles: Record<string, { bg: string; color: string }> = {
  'Em andamento': { bg: '#fee59a', color: '#654c01' },
  'Agendado': { bg: '#a8c6ef', color: '#102d57' },
  'Cancelado': { bg: '#eeafaa', color: '#551611' },
  'Concluído': { bg: '#b0e8d1', color: '#174f38' },
};

const s = {
  metricCard: {
    flex: '1 1 0', minWidth: 200, background: '#f6f6f6', borderRadius: 16,
    padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
};

type PagAppliedFiltro = {
  status: PagStatusFiltro;
  periodo: PagPeriodoFiltro;
  dataIni?: string;
  dataFim?: string;
};

export default function PagamentosScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [pagamentos, setPagamentos] = useState<PagamentoListItem[]>([]);
  const [counts, setCounts] = useState<PagamentoCounts>({ pagamentosPrevistos: 0, pagamentosFeitos: 0, lucro: 0 });
  const [loading, setLoading] = useState(true);
  const [filtroModalOpen, setFiltroModalOpen] = useState(false);
  const [filtroTabelaAtivo, setFiltroTabelaAtivo] = useState(false);
  const [appliedFiltro, setAppliedFiltro] = useState<PagAppliedFiltro>({
    status: 'Concluído',
    periodo: 'mes',
  });
  const [draftStatus, setDraftStatus] = useState<PagStatusFiltro>('Concluído');
  const [draftPeriodo, setDraftPeriodo] = useState<PagPeriodoFiltro>('mes');
  const [draftDataIni, setDraftDataIni] = useState('');
  const [draftDataFim, setDraftDataFim] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPagamentos(), fetchPagamentoCounts()]).then(([items, c]) => {
      if (!cancelled) { setPagamentos(items); setCounts(c); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const abrirFiltroModal = useCallback(() => {
    if (filtroTabelaAtivo) {
      setDraftStatus(appliedFiltro.status);
      setDraftPeriodo(appliedFiltro.periodo);
      setDraftDataIni(appliedFiltro.dataIni ?? '');
      setDraftDataFim(appliedFiltro.dataFim ?? '');
    } else {
      setDraftStatus('Concluído');
      setDraftPeriodo('mes');
      setDraftDataIni('');
      setDraftDataFim('');
    }
    setFiltroModalOpen(true);
  }, [filtroTabelaAtivo, appliedFiltro]);

  const fecharFiltroModal = useCallback(() => setFiltroModalOpen(false), []);

  const aplicarFiltroModal = useCallback(() => {
    setAppliedFiltro({
      status: draftStatus,
      periodo: draftPeriodo,
      dataIni: draftDataIni.trim() || undefined,
      dataFim: draftDataFim.trim() || undefined,
    });
    setFiltroTabelaAtivo(true);
    setFiltroModalOpen(false);
  }, [draftStatus, draftPeriodo, draftDataIni, draftDataFim]);

  useEffect(() => {
    if (!filtroModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fecharFiltroModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtroModalOpen, fecharFiltroModal]);

  const pendingCount = useMemo(() => pagamentos.filter((p) => p.status === 'Agendado').length, [pagamentos]);

  const metrics = [
    { title: 'Pagamentos previstos', value: fmtBRL(counts.pagamentosPrevistos), pct: '+12.5%', desc: 'vs período anterior' },
    { title: 'Pagamentos feitos', value: fmtBRL(counts.pagamentosFeitos), pct: '+8.2%', desc: 'vs período anterior' },
    { title: 'Lucro', value: fmtBRL(counts.lucro), pct: counts.lucro > 0 ? '+' : '', desc: 'vs período anterior', negative: counts.lucro <= 0 },
    { title: 'Aguardando liberação', value: String(pendingCount), pct: '', desc: 'pagamentos pendentes', negative: pendingCount > 0, isCount: true },
  ];

  const filteredRows = useMemo(() => {
    return pagamentos.filter((r) => {
      if (search) {
        const s = search.toLowerCase();
        if (!r.workerName.toLowerCase().includes(s) && !r.entityType.toLowerCase().includes(s)) return false;
      }
      if (!filtroTabelaAtivo) return true;
      if (r.status !== appliedFiltro.status) return false;
      const { start, end } = getPeriodRange(appliedFiltro.periodo);
      if (!payoutDateInPeriod(r.dateAtIso, start, end)) return false;
      if (appliedFiltro.dataIni) {
        const q = appliedFiltro.dataIni.toLowerCase();
        if (!r.dataFinalizacao.toLowerCase().includes(q)) return false;
      }
      if (appliedFiltro.dataFim) {
        const q = appliedFiltro.dataFim.toLowerCase();
        if (!r.dataFinalizacao.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [pagamentos, search, filtroTabelaAtivo, appliedFiltro]);

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

  const tituloSecaoModal18: React.CSSProperties = { fontSize: 18, fontWeight: 600, color: '#0d0d0d', lineHeight: 1.5, ...font };

  const campoDataPagamento = (rotulo: string, valor: string, onChange: (v: string) => void, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, width: '100%', gap: 0 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', minHeight: 40, display: 'flex', alignItems: 'center', ...font } }, rotulo),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', height: 44, borderRadius: 8, background: '#f1f1f1', paddingLeft: 16, overflow: 'hidden', width: '100%', boxSizing: 'border-box' as const } },
        calendarSvgLg,
        React.createElement('input', {
          type: 'text',
          value: valor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          placeholder,
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

  const filtroTabelaModal = filtroModalOpen
    ? React.createElement('div', {
      role: 'dialog',
      'aria-modal': true,
      'aria-labelledby': 'filtro-tabela-pagamentos-titulo',
      style: overlayModalStyle,
      onClick: fecharFiltroModal,
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
            React.createElement('h2', { id: 'filtro-tabela-pagamentos-titulo', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.25, ...font } }, 'Filtro da tabela'),
            React.createElement('button', {
              type: 'button',
              onClick: fecharFiltroModal,
              'aria-label': 'Fechar',
              style: {
                width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#f1f1f1', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, marginTop: -2,
              },
            }, closeModalSvg))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, 'Data da atividade'),
          campoDataPagamento('Data inicial', draftDataIni, setDraftDataIni, '05 de setembro'),
          campoDataPagamento('Data final', draftDataFim, setDraftDataFim, '30 de setembro')),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, 'Status da excursão'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            chipFiltro('Concluída', draftStatus === 'Concluído', () => setDraftStatus('Concluído')),
            chipFiltro('Agendada', draftStatus === 'Agendado', () => setDraftStatus('Agendado')),
            chipFiltro('Em andamento', draftStatus === 'Em andamento', () => setDraftStatus('Em andamento')),
            chipFiltro('Cancelada', draftStatus === 'Cancelado', () => setDraftStatus('Cancelado')))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, 'Período'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            chipFiltro('Esta semana', draftPeriodo === 'semana', () => setDraftPeriodo('semana')),
            chipFiltro('Este mês', draftPeriodo === 'mes', () => setDraftPeriodo('mes')),
            chipFiltro('Este ano', draftPeriodo === 'ano', () => setDraftPeriodo('ano')))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('button', {
            type: 'button',
            onClick: aplicarFiltroModal,
            style: {
              width: '100%', height: 48, borderRadius: 8, border: 'none', background: '#0d0d0d', color: '#fff',
              fontSize: 16, fontWeight: 500, lineHeight: 1.5, cursor: 'pointer', ...font,
            },
          }, 'Aplicar filtro'),
          React.createElement('button', {
            type: 'button',
            onClick: fecharFiltroModal,
            style: {
              width: '100%', height: 48, borderRadius: 8, border: 'none', background: 'transparent', color: '#0d0d0d',
              fontSize: 16, fontWeight: 500, lineHeight: 1.5, cursor: 'pointer', ...font,
            },
          }, 'Voltar'))))
    : null;

  const title = React.createElement('h1', { style: webStyles.homeTitle }, 'Pagamentos');

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
      onClick: abrirFiltroModal,
      'data-testid': 'pagamentos-open-table-filter',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
      },
    }, filterIconSvg, 'Filtro'),
    React.createElement('button', {
      type: 'button',
      onClick: () => navigate(PAGAMENTOS_GESTAO_PREPARADORES_HREF),
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px',
        background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const, ...font,
      },
    }, 'Acessar gestão de pagamentos'));

  // ── Metrics ───────────────────────────────────────────────────────────
  const metricCards = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    ...metrics.map((m: any) =>
      React.createElement('div', { key: m.title, style: { ...s.metricCard, ...(m.isCount && pendingCount > 0 ? { border: '1px solid #fbbf24', background: '#fffbeb' } : {}) } },
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, m.title),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 } },
          m.pct ? React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: m.negative ? '#b53838' : '#22c55e', ...font } }, m.pct) : null,
          React.createElement('span', { style: { fontSize: 12, color: m.negative ? '#b53838' : '#767676', ...font } }, m.desc)),
        React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: m.isCount && pendingCount > 0 ? '#b53838' : '#0d0d0d', margin: 0, ...font } }, m.value))));

  // ── Table ─────────────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 6px' };

  const tableHeader = React.createElement('div', {
    style: {
      display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9',
      padding: '0 16px', alignItems: 'center',
    },
  },
    ...tableCols.map((c) => React.createElement('div', {
      key: c.label,
      style: {
        flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font,
        padding: '0 6px', display: 'flex', alignItems: 'center', height: '100%', whiteSpace: 'pre-line' as const,
      },
    }, c.label)));

  const tableRowEls = filteredRows.map((row) => {
    const st = statusStyles[row.status];
    return React.createElement('div', {
      key: row.id,
      'data-testid': 'pagamento-table-row',
      style: {
        display: 'flex', minHeight: 64, alignItems: 'center', padding: '8px 16px',
        borderBottom: '1px solid #d9d9d9', background: '#fff',
      },
    },
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, fontWeight: 500 } }, row.workerName),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth } }, row.entityType),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth } }, fmtBRL(row.grossAmountCents)),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth, whiteSpace: 'pre-line' as const, fontSize: 13, lineHeight: 1.4 } }, row.dataFinalizacao),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' as const,
            background: st.bg, color: st.color, ...font,
          },
        }, row.status)),
      row.status === 'Agendado'
        ? React.createElement('button', {
            type: 'button',
            onClick: async () => {
              if (!isSupabaseConfigured || !row.id) return;
              if (!confirm('Liberar este pagamento ao profissional?')) return;
              await (supabase as any).from('payouts').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', row.id);
              const [items, c] = await Promise.all([fetchPagamentos(), fetchPagamentoCounts()]);
              setPagamentos(items); setCounts(c);
            },
            style: { marginLeft: 8, height: 28, padding: '0 10px', borderRadius: 999, border: 'none', background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const },
          }, '💸 Liberar')
        : null);
  });

  const tableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%', border: '1px solid #e2e2e2' } },
      React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
        tableHeader,
        ...tableRowEls)));

  if (loading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', ...font } }, 'Carregando pagamentos...'));
  }

  const emptyMsg = filteredRows.length === 0
    ? React.createElement('div', { style: { padding: 40, textAlign: 'center' as const, color: '#767676', ...font } }, 'Nenhum pagamento encontrado.')
    : null;

  return React.createElement(React.Fragment, null,
    title, searchRow, metricCards, emptyMsg || tableSection, filtroTabelaModal);
}
