/**
 * HomeScreen — Home dashboard content extracted from App.tsx (lines 632-793 + 1014-1020).
 * Uses React.createElement() calls (NOT JSX).
 * Does NOT include header/navbar (that's in Layout).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import React from 'react';
import {
  webStyles,
  chevronDownSvg,
  filterIconSvg,
  infoIconSvg,
  arrowForwardSvg,
  calendarIconSvg,
  closeIconSvg,
} from '../styles/webStyles';
import {
  fetchPagamentoCountsByCategory,
  fetchViagens,
  fetchEncomendas,
  filterViagemListItem,
  filterEncomendaForHome,
  viagemCountsFromItems,
  encomendaCountsFromItems,
  fetchApprovedTripExpensesCents,
  type ViagemListFilter,
  type PagamentoCountsByCategory,
} from '../data/queries';
import type { PagamentoCounts } from '../data/types';

export default function HomeScreen() {
  const [homeSubTab, setHomeSubTab] = useState<'viagens' | 'encomendas'>('viagens');
  const [pagCounts, setPagCounts] = useState<PagamentoCounts | null>(null);
  const [pagByCategory, setPagByCategory] = useState<PagamentoCountsByCategory | null>(null);
  const [approvedExpenseCents, setApprovedExpenseCents] = useState(0);

  // Dados carregados UMA vez — filtros aplicados localmente (instantâneo)
  const [allViagens, setAllViagens] = useState<import('../data/types').ViagemListItem[]>([]);
  const [allEncomendas, setAllEncomendas] = useState<import('../data/types').EncomendaListItem[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchViagens(),
      fetchEncomendas(),
      fetchPagamentoCountsByCategory(),
      fetchApprovedTripExpensesCents(),
    ]).then(([v, e, pbc, exp]) => {
      if (!cancelled) {
        setAllViagens(v);
        setAllEncomendas(e);
        setPagCounts(pbc.all);
        setPagByCategory(pbc);
        setApprovedExpenseCents(exp.totalCents);
        setDataLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterDateInicio, setFilterDateInicio] = useState('');
  const [filterDateFim, setFilterDateFim] = useState('');
  const [filterStatus, setFilterStatus] = useState<'em_andamento' | 'agendadas' | 'concluidas' | 'canceladas'>('em_andamento');
  const [filterCategoria, setFilterCategoria] = useState<Set<'take_me' | 'motorista'>>(new Set(['take_me']));
  const [takeMeDropdownOpen, setTakeMeDropdownOpen] = useState(false);
  const [takeMeSelectedOption, setTakeMeSelectedOption] = useState<'Take Me' | 'Motorista parceiro'>('Take Me');

  const homeCategoriaToFilter = (set: Set<'take_me' | 'motorista'>): ViagemListFilter['categoria'] => {
    const hasT = set.has('take_me');
    const hasM = set.has('motorista');
    if (hasT && hasM) return 'todos';
    if (hasT) return 'take_me';
    if (hasM) return 'motorista';
    return 'todos';
  };

  // Filtrar localmente — instantâneo, sem query ao Supabase
  const homeCounts = useMemo(() => {
    if (!dataLoaded) return null;
    const cat = homeCategoriaToFilter(filterCategoria);
    const vf: ViagemListFilter = {
      status: filterStatus,
      categoria: cat,
      nomeNeedle: '',
      origemNeedle: '',
      tableDateYmd: '',
      periodoInicioYmd: filterDateInicio,
      periodoFimYmd: filterDateFim,
      datasIncluidas: 'passadas_e_futuras',
    };
    const vFil = allViagens.filter((v) => filterViagemListItem(v, vf));
    const eFil = allEncomendas.filter((e) => filterEncomendaForHome(e, filterStatus, filterDateInicio, filterDateFim));
    return {
      viagens: viagemCountsFromItems(vFil),
      encomendas: encomendaCountsFromItems(eFil),
    };
  }, [dataLoaded, allViagens, allEncomendas, filterCategoria, filterStatus, filterDateInicio, filterDateFim]);

  const aplicarFiltroHome = useCallback(() => {
    // Filtros já são aplicados via useMemo — só fechar o modal
    setFilterModalOpen(false);
  }, []);

  const isEncomendas = homeSubTab === 'encomendas';
  const subTabsSection = React.createElement('div', { style: webStyles.subTabsWrap },
    React.createElement('div', { style: webStyles.subTabs },
      React.createElement('button', {
        type: 'button',
        style: { ...webStyles.subTab, ...(!isEncomendas ? webStyles.subTabActive : {}) } as React.CSSProperties,
        onClick: () => setHomeSubTab('viagens'),
      }, React.createElement('span', null, 'Viagens'), !isEncomendas ? React.createElement('span', { style: webStyles.subTabIndicator }) : null),
      React.createElement('button', {
        type: 'button',
        style: { ...webStyles.subTab, ...(isEncomendas ? webStyles.subTabActive : {}) } as React.CSSProperties,
        onClick: () => setHomeSubTab('encomendas'),
      }, React.createElement('span', null, 'Encomendas'), isEncomendas ? React.createElement('span', { style: webStyles.subTabIndicator }) : null)));

  const searchSection = React.createElement('div', { style: { ...webStyles.searchRow, justifyContent: 'flex-end' } },
    React.createElement('div', { style: webStyles.filterGroup },
      React.createElement('button', {
        key: 'filtro', type: 'button', 'data-testid': 'home-open-filter',
        'aria-label': 'Abrir filtro do Início', style: webStyles.filterBtn, onClick: () => setFilterModalOpen(true),
      }, React.createElement('span', null, filterIconSvg), 'Filtro')));

  const fmtExpenseBRL = (c: number) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const expenseCardEl = React.createElement('div', { style: webStyles.expenseCard },
    React.createElement('div', { style: webStyles.expenseCardIcon }, infoIconSvg),
    React.createElement('div', { style: webStyles.expenseCardBody },
      React.createElement('p', { style: webStyles.expenseCardTitle }, 'Despesas aprovadas pelo backoffice'),
      React.createElement('p', { style: webStyles.expenseCardDesc }, 'Soma de payouts com status pago (amostra até 5000 linhas; tipos booking, shipment, dependent_shipment, excursion).'),
      React.createElement('p', { style: webStyles.expenseCardLabel }, 'Total de despesas aprovadas no período'),
      React.createElement('p', { style: webStyles.expenseCardValue }, fmtExpenseBRL(approvedExpenseCents)),
      React.createElement('button', { type: 'button', style: webStyles.expenseCardLink }, 'Ver detalhes em Pagamentos', React.createElement('span', null, arrowForwardSvg))));

  const vc = homeCounts?.viagens;
  const ec = homeCounts?.encomendas;
  const statCardsData = isEncomendas
    ? [
        { title: 'Entregas em andamento', value: String(ec?.emAndamento ?? '—'), change: '', positive: true, testId: 'home-stat-encomendas-em-andamento' as const },
        { title: 'Agendadas', value: String(ec?.agendadas ?? '—'), change: '', positive: true, testId: 'home-stat-encomendas-agendadas' as const },
        { title: 'Concluídas', value: String(ec?.concluidas ?? '—'), change: '', positive: true, testId: 'home-stat-encomendas-concluidas' as const },
        { title: 'Canceladas', value: String(ec?.canceladas ?? '—'), change: '', positive: false, testId: 'home-stat-encomendas-canceladas' as const },
      ]
    : [
        { title: 'Viagens em andamento', value: String(vc?.emAndamento ?? '—'), change: '', positive: true, testId: 'home-stat-viagens-em-andamento' as const },
        { title: 'Agendadas', value: String(vc?.agendadas ?? '—'), change: '', positive: true, testId: 'home-stat-viagens-agendadas' as const },
        { title: 'Concluídas', value: String(vc?.concluidas ?? '—'), change: '', positive: true, testId: 'home-stat-viagens-concluidas' as const },
        { title: 'Canceladas', value: String(vc?.canceladas ?? '—'), change: '', positive: false, testId: 'home-stat-viagens-canceladas' as const },
      ];
  const statusKeyMap: Record<string, 'em_andamento' | 'agendadas' | 'concluidas' | 'canceladas'> = {
    'Viagens em andamento': 'em_andamento', 'Entregas em andamento': 'em_andamento',
    'Agendadas': 'agendadas', 'Concluídas': 'concluidas', 'Canceladas': 'canceladas',
  };

  const statCards = statCardsData.map((s) =>
    React.createElement('button', {
      key: s.title, type: 'button',
      onClick: () => {
        const key = statusKeyMap[s.title];
        if (key) { setFilterStatus(key); aplicarFiltroHome(); }
      },
      style: { ...webStyles.statCard, cursor: 'pointer', border: filterStatus === statusKeyMap[s.title] ? '2px solid #cba04b' : '1px solid transparent', transition: 'border-color 0.2s' },
    },
      React.createElement('div', { style: webStyles.statCardHeader },
        React.createElement('span', { style: webStyles.statCardTitle }, s.title),
        React.createElement('span', { style: { opacity: 0 } }, '○')),
      React.createElement('span', { style: { ...webStyles.statCardChange, ...(s.positive ? webStyles.statCardChangePos : webStyles.statCardChangeNeg) } }, s.change),
      React.createElement('span', { style: webStyles.statCardValue, 'data-testid': s.testId }, s.value)));

  const fmtBRL = (c: number) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

  // ── Gráfico conforme Figma: 3 fatias (Taxas, Valor líquido, Despesas) ──
  // Taxas = admin_amount (gold), Valor líquido = worker_amount (gray), Despesas = surcharges/outros (black)
  const buildChartSection = (
    title: string,
    desc: string,
    chart: { grossCents: number; adminCents: number; workerCents: number } | undefined,
  ) => {
    const gross = chart?.grossCents ?? 0;
    const taxas = chart?.adminCents ?? 0; // plataforma
    const liquido = chart?.workerCents ?? 0; // motoristas/preparadores
    const despesas = Math.max(0, gross - taxas - liquido); // surcharges e outros
    const total = gross || 1;
    const taxasPct = Math.round((taxas / total) * 100);
    const liquidoPct = Math.round((liquido / total) * 100);
    const despesasPct = 100 - taxasPct - liquidoPct;
    const taxasDeg = Math.round((taxasPct / 100) * 360);
    const liquidoDeg = taxasDeg + Math.round((liquidoPct / 100) * 360);

    // Legenda dot style (20px circle como no Figma)
    const dot = (bg: string): React.CSSProperties => ({ width: 20, height: 20, borderRadius: 999, background: bg, flexShrink: 0 });
    const legendText: React.CSSProperties = { fontSize: 16, fontWeight: 400, color: '#0d0d0d', ...font };

    return React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column' as const, gap: 40, padding: 24, borderRadius: 16, background: '#f6f6f6', width: '100%', boxSizing: 'border-box' as const },
    },
      // Header
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
        React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font } }, title),
        React.createElement('p', { style: { fontSize: 14, fontWeight: 400, color: '#767676', margin: 0, lineHeight: 1.5, ...font } }, desc)),
      // Chart + Legend row
      React.createElement('div', {
        style: { display: 'flex', gap: 56, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' as const, width: '100%' },
      },
        // Pizza chart (260px como no Figma, com labels dentro)
        React.createElement('div', { style: { width: 260, height: 260, position: 'relative' as const, flexShrink: 0 } },
          React.createElement('div', {
            style: {
              width: 260, height: 260, borderRadius: '50%',
              background: `conic-gradient(#cba04b 0deg ${taxasDeg}deg, #545454 ${taxasDeg}deg ${liquidoDeg}deg, #0d0d0d ${liquidoDeg}deg 360deg)`,
            },
          }),
          // Labels dentro do gráfico
          React.createElement('span', {
            style: { position: 'absolute' as const, top: '32%', left: '45%', fontSize: 12, color: '#0d0d0d', ...font, pointerEvents: 'none' as const },
          }, `${taxasPct}% Taxas`),
          React.createElement('span', {
            style: { position: 'absolute' as const, top: '58%', left: '15%', fontSize: 12, color: '#fff', ...font, pointerEvents: 'none' as const },
          }, `${liquidoPct}% Valor líquido`),
          React.createElement('span', {
            style: { position: 'absolute' as const, top: '68%', left: '50%', fontSize: 12, color: '#fff', ...font, pointerEvents: 'none' as const },
          }, `${despesasPct}% Despesas`)),
        // Legenda (direita)
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 40 } },
          React.createElement('p', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } },
            `Faturamento total: ${fmtBRL(gross)}`),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24, maxWidth: 340 } },
            React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              React.createElement('div', { style: dot('#cba04b') }),
              React.createElement('span', { style: legendText }, `${taxasPct}% Taxas`)),
            React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              React.createElement('div', { style: dot('#545454') }),
              React.createElement('span', { style: legendText }, `${liquidoPct}% Valor líquido`)),
            React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              React.createElement('div', { style: dot('#0d0d0d') }),
              React.createElement('span', { style: legendText }, `${despesasPct}% Despesas`))))));
  };

  const chartCardEl = isEncomendas
    ? buildChartSection(
        'Distribuição de valores das encomendas concluídas',
        'Distribuição de valores das encomendas concluídas no período filtrado.',
        pagByCategory?.chartEncomendas)
    : buildChartSection(
        'Distribuição de receitas',
        'A receita total inclui todas as viagens concluídas no período filtrado.',
        pagByCategory?.chartPassageiros);

  // Modal Filtro Início (Figma 756-19720)
  const statusOptions: { id: 'em_andamento' | 'agendadas' | 'concluidas' | 'canceladas'; label: string }[] = [
    { id: 'em_andamento', label: 'Em andamento' },
    { id: 'agendadas', label: 'Agendadas' },
    { id: 'concluidas', label: 'Concluídas' },
    { id: 'canceladas', label: 'Canceladas' },
  ];
  const categoriaOptionsInicio: { id: 'take_me' | 'motorista'; label: string }[] = [
    { id: 'take_me', label: 'Take Me' },
    { id: 'motorista', label: 'Motorista parceiro' },
  ];
  const toggleCategoria = (id: 'take_me' | 'motorista') => {
    setFilterCategoria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };
  const filterModalInicioContent = React.createElement('div', { style: { ...webStyles.modalBoxInicio, maxWidth: 560 }, onClick: (e: React.MouseEvent) => e.stopPropagation() },
    React.createElement('div', { style: webStyles.modalHeader },
      React.createElement('div', { style: webStyles.modalHeaderRowInicio },
        React.createElement('h2', { id: 'home-filtro-modal-titulo', style: webStyles.modalTitleCentered }, 'Filtro'))),
    React.createElement('div', { style: webStyles.modalSection },
      React.createElement('h3', { style: webStyles.modalSectionTitle }, 'Data da atividade'),
      React.createElement('p', { style: { fontSize: 12, color: '#767676', margin: '0 0 8px 0', lineHeight: 1.5 } }, 'Formato ISO (YYYY-MM-DD). Vazio = sem limite nesse extremo.'),
      React.createElement('div', { style: webStyles.modalDateField },
        React.createElement('label', { style: webStyles.modalDateLabel }, 'Data inicial'),
        React.createElement('div', { style: webStyles.modalDateInputWrap },
          React.createElement('span', { style: webStyles.modalDateIcon }, calendarIconSvg),
          React.createElement('input', { type: 'date', value: filterDateInicio, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFilterDateInicio(e.target.value), style: webStyles.modalDateInput, 'aria-label': 'Data inicial' }))),
      React.createElement('div', { style: { ...webStyles.modalDateField, marginTop: 8 } },
        React.createElement('label', { style: webStyles.modalDateLabel }, 'Data final'),
        React.createElement('div', { style: webStyles.modalDateInputWrap },
          React.createElement('span', { style: webStyles.modalDateIcon }, calendarIconSvg),
          React.createElement('input', { type: 'date', value: filterDateFim, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFilterDateFim(e.target.value), style: webStyles.modalDateInput, 'aria-label': 'Data final' })))),
    React.createElement('div', { style: webStyles.modalSectionGap12 },
      React.createElement('h3', { style: webStyles.modalSectionTitle }, 'Status da viagem'),
      React.createElement('div', { style: webStyles.modalChips }, ...statusOptions.map((opt) =>
        React.createElement('button', { key: opt.id, type: 'button', style: { ...webStyles.modalChip, ...(filterStatus === opt.id ? webStyles.modalChipActive : webStyles.modalChipInactive) } as React.CSSProperties, onClick: () => setFilterStatus(opt.id) }, opt.label)))),
    React.createElement('div', { style: webStyles.modalSectionGap12 },
      React.createElement('h3', { style: webStyles.modalSectionTitle }, 'Categoria'),
      React.createElement('div', { style: webStyles.modalChips }, ...categoriaOptionsInicio.map((opt) =>
        React.createElement('button', { key: opt.id, type: 'button', style: { ...webStyles.modalChip, ...(filterCategoria.has(opt.id) ? webStyles.modalChipActive : webStyles.modalChipInactive) } as React.CSSProperties, onClick: () => toggleCategoria(opt.id) }, opt.label))),
    React.createElement('div', { style: webStyles.modalButtonWrap },
      React.createElement('button', { type: 'button', style: webStyles.modalApplyBtn, onClick: () => { void aplicarFiltroHome(); } }, 'Aplicar filtro'))));

  const filterModalEl = filterModalOpen
    ? React.createElement('div', { style: webStyles.modalOverlay, onClick: () => setFilterModalOpen(false), role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'home-filtro-modal-titulo' }, filterModalInicioContent)
    : null;

  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Início'),
    subTabsSection,
    searchSection,
    expenseCardEl,
    React.createElement('div', { style: webStyles.statCardsRow }, ...statCards),
    chartCardEl,
    filterModalEl);
}
