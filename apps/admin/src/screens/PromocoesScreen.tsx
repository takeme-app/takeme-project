/**
 * PromocoesScreen — Promoções conforme Figma 867-19582.
 * Modal filtro da tabela: Figma 867-21529.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';
import { fetchPromocoes, fetchPromocaoCounts } from '../data/queries';
import type { PromocaoListItem } from '../data/types';
import type { PromocaoCounts } from '../data/queries';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const calendarSvgLg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));
const closeModalSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

type PromoPeriodoFiltro = 'semana' | 'mes' | 'ano';

type PromoAppliedFiltro = {
  status: 'Ativo' | 'Inativo';
  periodo: PromoPeriodoFiltro;
  escopoEsteMes: boolean;
  dataIni?: string;
  dataFim?: string;
};

function getPeriodRange(t: PromoPeriodoFiltro): { start: Date; end: Date } {
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

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 <= b1 && a1 >= b0;
}

function rowOverlapsRange(row: PromocaoListItem, rangeStart: Date, rangeEnd: Date): boolean {
  if (!row.startAtIso || !row.endAtIso) return true;
  const rs = new Date(row.startAtIso).getTime();
  const re = new Date(row.endAtIso).getTime();
  if (Number.isNaN(rs) || Number.isNaN(re)) return true;
  return intervalsOverlap(rs, re, rangeStart.getTime(), rangeEnd.getTime());
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

const tableCols = [
  { label: 'Nome da Promoção', flex: '1 1 25%', minWidth: 180 },
  { label: 'Data de Início', flex: '0 0 130px', minWidth: 130 },
  { label: 'Data de Término', flex: '0 0 130px', minWidth: 130 },
  { label: 'Tipo de Público', flex: '0 0 120px', minWidth: 120 },
  { label: 'Status', flex: '0 0 90px', minWidth: 90 },
];

// ── Styles ──────────────────────────────────────────────────────────────
const s = {
  metricCard: {
    flex: '1 1 0', minWidth: 200, background: '#f6f6f6', borderRadius: 16,
    padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
};

// ── Component ───────────────────────────────────────────────────────────
export default function PromocoesScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [promoData, setPromoData] = useState<PromocaoListItem[]>([]);
  const [promoCounts, setPromoCounts] = useState<PromocaoCounts>({ total: 0, ativas: 0, inativas: 0 });
  const [loading, setLoading] = useState(true);
  const [filtroModalOpen, setFiltroModalOpen] = useState(false);
  const [filtroTabelaAtivo, setFiltroTabelaAtivo] = useState(false);
  const [appliedFiltro, setAppliedFiltro] = useState<PromoAppliedFiltro>({
    status: 'Ativo',
    periodo: 'mes',
    escopoEsteMes: true,
  });
  const [draftStatus, setDraftStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
  const [draftPeriodo, setDraftPeriodo] = useState<PromoPeriodoFiltro>('mes');
  const [draftEscopo, setDraftEscopo] = useState<'todas' | 'este_mes'>('este_mes');
  const [draftDataIni, setDraftDataIni] = useState('');
  const [draftDataFim, setDraftDataFim] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPromocoes(), fetchPromocaoCounts()]).then(([items, c]) => {
      if (!cancelled) { setPromoData(items); setPromoCounts(c); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const abrirFiltroModal = useCallback(() => {
    if (filtroTabelaAtivo) {
      setDraftStatus(appliedFiltro.status);
      setDraftPeriodo(appliedFiltro.periodo);
      setDraftEscopo(appliedFiltro.escopoEsteMes ? 'este_mes' : 'todas');
      setDraftDataIni(appliedFiltro.dataIni ?? '');
      setDraftDataFim(appliedFiltro.dataFim ?? '');
    } else {
      setDraftStatus('Ativo');
      setDraftPeriodo('mes');
      setDraftEscopo('este_mes');
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
      escopoEsteMes: draftEscopo === 'este_mes',
      dataIni: draftDataIni.trim() || undefined,
      dataFim: draftDataFim.trim() || undefined,
    });
    setFiltroTabelaAtivo(true);
    setFiltroModalOpen(false);
  }, [draftStatus, draftPeriodo, draftEscopo, draftDataIni, draftDataFim]);

  useEffect(() => {
    if (!filtroModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fecharFiltroModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtroModalOpen, fecharFiltroModal]);

  const metrics1 = [
    { title: 'Total de Promoções', value: String(promoCounts.total), pct: '', desc: '' },
    { title: 'Promoções Ativas', value: String(promoCounts.ativas), pct: '', desc: '' },
    { title: 'Promoções Inativas', value: String(promoCounts.inativas), pct: '', desc: '', negative: true },
  ];

  const filteredRows = useMemo(() => {
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return promoData.filter((r) => {
      if (search) {
        const s = search.toLowerCase();
        if (!r.nome.toLowerCase().includes(s) && !r.tipoPublico.toLowerCase().includes(s)) return false;
      }
      if (!filtroTabelaAtivo) return true;

      if (r.status !== appliedFiltro.status) return false;

      const { start, end } = getPeriodRange(appliedFiltro.periodo);
      if (!rowOverlapsRange(r, start, end)) return false;

      if (appliedFiltro.escopoEsteMes && !rowOverlapsRange(r, inicioMes, fimMes)) return false;

      if (appliedFiltro.dataIni) {
        const q = appliedFiltro.dataIni.toLowerCase();
        if (!r.dataInicio.toLowerCase().includes(q)) return false;
      }
      if (appliedFiltro.dataFim) {
        const q = appliedFiltro.dataFim.toLowerCase();
        if (!r.dataTermino.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [promoData, search, filtroTabelaAtivo, appliedFiltro]);

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

  const campoDataPromo = (rotulo: string, valor: string, onChange: (v: string) => void, placeholder: string) =>
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
      'aria-labelledby': 'filtro-tabela-promocoes-titulo',
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
            React.createElement('div', { style: { flex: '1 1 auto', minWidth: 0 } },
              React.createElement('h2', { id: 'filtro-tabela-promocoes-titulo', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.25, ...font } }, 'Filtro da tabela'),
              React.createElement('p', {
                style: { fontSize: 14, fontWeight: 400, color: '#767676', margin: '6px 0 0 0', lineHeight: 1.4, ...font },
              }, 'Filtra apenas a lista de promoções abaixo.')),
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
          campoDataPromo('Data inicial', draftDataIni, setDraftDataIni, '01 de setembro'),
          campoDataPromo('Data final', draftDataFim, setDraftDataFim, '31 de dezembro')),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, 'Status'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            chipFiltro('Ativo', draftStatus === 'Ativo', () => setDraftStatus('Ativo')),
            chipFiltro('Inativo', draftStatus === 'Inativo', () => setDraftStatus('Inativo')))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, 'Período'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            chipFiltro('Esta semana', draftPeriodo === 'semana', () => setDraftPeriodo('semana')),
            chipFiltro('Este mês', draftPeriodo === 'mes', () => setDraftPeriodo('mes')),
            chipFiltro('Este ano', draftPeriodo === 'ano', () => setDraftPeriodo('ano')))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecaoModal18 }, 'Promoções'),
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            chipFiltro('Todas as promoções', draftEscopo === 'todas', () => setDraftEscopo('todas')),
            chipFiltro('Promoções deste mês', draftEscopo === 'este_mes', () => setDraftEscopo('este_mes')))),
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
      onClick: abrirFiltroModal,
      'data-testid': 'promocoes-open-table-filter',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
      },
    }, filterIconSvg, 'Filtro'),
    React.createElement('button', {
      type: 'button',
      onClick: () => navigate('/promocoes/nova'),
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

  const tableRowEls = filteredRows.map((row) => {
    const statusBg = row.status === 'Ativo' ? '#b0e8d1' : '#eeafaa';
    const statusColor = row.status === 'Ativo' ? '#174f38' : '#551611';
    return React.createElement('div', {
      key: row.id,
      'data-testid': 'promocao-table-row',
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

  if (loading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', ...font } }, 'Carregando promoções...'));
  }

  const emptyMsg = filteredRows.length === 0
    ? React.createElement('div', { style: { padding: 40, textAlign: 'center' as const, color: '#767676', ...font } }, 'Nenhuma promoção encontrada.')
    : null;

  return React.createElement(React.Fragment, null,
    title, searchRow, metricCards1, emptyMsg || tableSection, filtroTabelaModal);
}
