/**
 * HomeScreen — Home dashboard content extracted from App.tsx (lines 632-793 + 1014-1020).
 * Uses React.createElement() calls (NOT JSX).
 * Does NOT include header/navbar (that's in Layout).
 */
import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import {
  webStyles,
  searchIconSvg,
  chevronDownSvg,
  filterIconSvg,
  infoIconSvg,
  arrowForwardSvg,
  calendarIconSvg,
  closeIconSvg,
} from '../styles/webStyles';
import {
  fetchHomeCounts,
  fetchPagamentoCounts,
  fetchViagens,
  fetchEncomendas,
  filterViagemListItem,
  filterEncomendaForHome,
  viagemCountsFromItems,
  encomendaCountsFromItems,
  fetchApprovedTripExpensesCents,
  type HomeCounts,
  type ViagemListFilter,
} from '../data/queries';
import type { PagamentoCounts } from '../data/types';

export default function HomeScreen() {
  const [homeSubTab, setHomeSubTab] = useState<'viagens' | 'encomendas'>('viagens');
  const [homeCounts, setHomeCounts] = useState<HomeCounts | null>(null);
  const [pagCounts, setPagCounts] = useState<PagamentoCounts | null>(null);
  const [approvedExpenseCents, setApprovedExpenseCents] = useState(0);
  const [homeSearch, setHomeSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchHomeCounts(), fetchPagamentoCounts(), fetchApprovedTripExpensesCents()]).then(([hc, pc, exp]) => {
      if (!cancelled) {
        setHomeCounts(hc);
        setPagCounts(pc);
        setApprovedExpenseCents(exp.totalCents);
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

  const aplicarFiltroHome = useCallback(async () => {
    const [viagens, encomendas] = await Promise.all([fetchViagens(), fetchEncomendas()]);
    const cat = homeCategoriaToFilter(filterCategoria);
    const vf: ViagemListFilter = {
      status: filterStatus,
      categoria: cat,
      nomeNeedle: homeSearch.trim(),
      origemNeedle: '',
      tableDateYmd: '',
      periodoInicioYmd: filterDateInicio,
      periodoFimYmd: filterDateFim,
      datasIncluidas: 'passadas_e_futuras',
    };
    const vFil = viagens.filter((v) => filterViagemListItem(v, vf));
    const eFil = encomendas.filter((e) => filterEncomendaForHome(e, filterStatus, filterDateInicio, filterDateFim));
    setHomeCounts({
      viagens: viagemCountsFromItems(vFil),
      encomendas: encomendaCountsFromItems(eFil),
    });
    setFilterModalOpen(false);
  }, [filterCategoria, filterDateFim, filterDateInicio, filterStatus, homeSearch]);

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

  const searchSection = React.createElement('div', { style: webStyles.searchRow },
    React.createElement('div', { style: webStyles.searchInputWrap },
      React.createElement('div', { style: webStyles.searchInputInner },
        React.createElement('span', { style: webStyles.searchIcon }, searchIconSvg),
        React.createElement('input', {
          type: 'search',
          value: homeSearch,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHomeSearch(e.target.value),
          placeholder: 'Buscar (aplique o filtro para refletir nos cartões)',
          style: webStyles.searchInput,
          'aria-label': 'Buscar',
        }))),
    React.createElement('div', { style: webStyles.filterGroup },
      ...(isEncomendas ? [] : [
        React.createElement('div', { key: 'takeme-wrap', style: webStyles.dropdownWrap },
          React.createElement('button', { type: 'button', style: webStyles.filterBtn, onClick: () => setTakeMeDropdownOpen((v) => !v), 'aria-expanded': takeMeDropdownOpen, 'aria-haspopup': true }, takeMeSelectedOption, React.createElement('span', null, chevronDownSvg)),
          takeMeDropdownOpen ? React.createElement(React.Fragment, { key: 'takeme-dd' },
            React.createElement('div', { key: 'overlay', style: webStyles.dropdownOverlay, onClick: () => setTakeMeDropdownOpen(false), 'aria-hidden': true }),
            React.createElement('div', { key: 'popover', style: webStyles.dropdownPopover, role: 'menu' },
              React.createElement('button', { type: 'button', style: webStyles.dropdownOption, role: 'menuitem', onClick: () => { setTakeMeSelectedOption('Take Me'); setFilterCategoria(new Set(['take_me'])); setTakeMeDropdownOpen(false); } }, 'Take Me'),
              React.createElement('button', { type: 'button', style: webStyles.dropdownOption, role: 'menuitem', onClick: () => { setTakeMeSelectedOption('Motorista parceiro'); setFilterCategoria(new Set(['motorista'])); setTakeMeDropdownOpen(false); } }, 'Motorista parceiro'))) : null),
      ]),
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
  const statCards = statCardsData.map((s) =>
    React.createElement('div', { key: s.title, style: webStyles.statCard },
      React.createElement('div', { style: webStyles.statCardHeader },
        React.createElement('span', { style: webStyles.statCardTitle }, s.title),
        React.createElement('span', { style: { opacity: 0 } }, '○')),
      React.createElement('span', { style: { ...webStyles.statCardChange, ...(s.positive ? webStyles.statCardChangePos : webStyles.statCardChangeNeg) } }, s.change),
      React.createElement('span', { style: webStyles.statCardValue, 'data-testid': s.testId }, s.value)));

  // Revenue category filter
  const [revenueCategory, setRevenueCategory] = useState<'todos' | 'passageiros' | 'encomendas'>('todos');

  const chartTitle = isEncomendas ? 'Distribuição de valores das encomendas concluídas' : 'Distribuição de receitas';
  const chartDesc = 'Valores consolidados de payouts no projeto (não filtrados pelo modal; os cartões acima refletem o filtro aplicado).';
  // Real chart data from payouts
  const grossCents = (pagCounts?.pagamentosPrevistos ?? 0) + (pagCounts?.pagamentosFeitos ?? 0);
  const adminCents = pagCounts?.lucro ?? 0;
  const workerCents = pagCounts?.pagamentosFeitos ?? 0;
  const totalCents = grossCents || 1; // avoid div by 0
  const adminPct = Math.round((adminCents / totalCents) * 100);
  const workerPct = Math.round((workerCents / totalCents) * 100);
  const otherPct = 100 - adminPct - workerPct;
  const adminDeg = Math.round((adminPct / 100) * 360);
  const workerDeg = adminDeg + Math.round((workerPct / 100) * 360);
  const fmtBRL = (c: number) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const revCatChip = (label: string, value: 'todos' | 'passageiros' | 'encomendas') => {
    const active = revenueCategory === value;
    return React.createElement('button', {
      key: value,
      type: 'button',
      onClick: () => setRevenueCategory(value),
      style: {
        padding: '6px 16px', borderRadius: 999, border: active ? 'none' : '1px solid #e2e2e2',
        background: active ? '#0d0d0d' : '#fff', color: active ? '#fff' : '#545454',
        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
      },
    }, label);
  };
  const revCatRow = React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
    revCatChip('Todos', 'todos'), revCatChip('Passageiros', 'passageiros'), revCatChip('Encomendas', 'encomendas'));

  const chartCardEl = React.createElement('div', { style: webStyles.chartCard },
    React.createElement('h3', { style: webStyles.chartCardTitle }, chartTitle),
    React.createElement('p', { style: webStyles.chartCardDesc }, chartDesc),
    revCatRow,
    React.createElement('div', { style: webStyles.chartRow },
      React.createElement('div', { style: { width: 200, height: 200, borderRadius: '50%', background: `conic-gradient(#cba04b 0deg ${adminDeg}deg, #545454 ${adminDeg}deg ${workerDeg}deg, #0d0d0d ${workerDeg}deg 360deg)`, flexShrink: 0 } }),
      React.createElement('div', { style: webStyles.chartLegend },
        React.createElement('p', { style: webStyles.chartTotal }, `Faturamento total: ${fmtBRL(grossCents)}`),
        React.createElement('div', { style: webStyles.chartLegendItem },
          React.createElement('span', { style: { ...webStyles.chartLegendDot, background: '#cba04b' } }),
          React.createElement('span', { style: webStyles.chartLegendText }, `${adminPct}% Admin (taxas)`)),
        React.createElement('div', { style: webStyles.chartLegendItem },
          React.createElement('span', { style: { ...webStyles.chartLegendDot, background: '#545454' } }),
          React.createElement('span', { style: webStyles.chartLegendText }, `${workerPct}% Motoristas/Preparadores`)),
        React.createElement('div', { style: webStyles.chartLegendItem },
          React.createElement('span', { style: { ...webStyles.chartLegendDot, background: '#0d0d0d' } }),
          React.createElement('span', { style: webStyles.chartLegendText }, `${otherPct}% Outros`)))));

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
