/**
 * HomeScreen — Home dashboard content extracted from App.tsx (lines 632-793 + 1014-1020).
 * Uses React.createElement() calls (NOT JSX).
 * Does NOT include header/navbar (that's in Layout).
 */
import { useState } from 'react';
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

export default function HomeScreen() {
  const [homeSubTab, setHomeSubTab] = useState<'viagens' | 'encomendas'>('viagens');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterDateInicio, setFilterDateInicio] = useState('');
  const [filterDateFim, setFilterDateFim] = useState('');
  const [filterStatus, setFilterStatus] = useState<'em_andamento' | 'agendadas' | 'concluidas' | 'canceladas'>('em_andamento');
  const [filterCategoria, setFilterCategoria] = useState<Set<'take_me' | 'motorista'>>(new Set(['take_me']));
  const [takeMeDropdownOpen, setTakeMeDropdownOpen] = useState(false);
  const [takeMeSelectedOption, setTakeMeSelectedOption] = useState<'Take Me' | 'Motorista parceiro'>('Take Me');

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
        React.createElement('input', { type: 'search', placeholder: 'Buscar', style: webStyles.searchInput, 'aria-label': 'Buscar' }))),
    React.createElement('div', { style: webStyles.filterGroup },
      ...(isEncomendas ? [] : [
        React.createElement('div', { key: 'takeme-wrap', style: webStyles.dropdownWrap },
          React.createElement('button', { type: 'button', style: webStyles.filterBtn, onClick: () => setTakeMeDropdownOpen((v) => !v), 'aria-expanded': takeMeDropdownOpen, 'aria-haspopup': true }, takeMeSelectedOption, React.createElement('span', null, chevronDownSvg)),
          takeMeDropdownOpen ? React.createElement(React.Fragment, { key: 'takeme-dd' },
            React.createElement('div', { key: 'overlay', style: webStyles.dropdownOverlay, onClick: () => setTakeMeDropdownOpen(false), 'aria-hidden': true }),
            React.createElement('div', { key: 'popover', style: webStyles.dropdownPopover, role: 'menu' },
              React.createElement('button', { type: 'button', style: webStyles.dropdownOption, role: 'menuitem', onClick: () => { setTakeMeSelectedOption('Take Me'); setTakeMeDropdownOpen(false); } }, 'Take Me'),
              React.createElement('button', { type: 'button', style: webStyles.dropdownOption, role: 'menuitem', onClick: () => { setTakeMeSelectedOption('Motorista parceiro'); setTakeMeDropdownOpen(false); } }, 'Motorista parceiro'))) : null),
      ]),
      React.createElement('button', { key: 'filtro', type: 'button', style: webStyles.filterBtn, onClick: () => setFilterModalOpen(true) }, React.createElement('span', null, filterIconSvg), 'Filtro')));

  const expenseCardEl = React.createElement('div', { style: webStyles.expenseCard },
    React.createElement('div', { style: webStyles.expenseCardIcon }, infoIconSvg),
    React.createElement('div', { style: webStyles.expenseCardBody },
      React.createElement('p', { style: webStyles.expenseCardTitle }, 'Despesas aprovadas pelo backoffice'),
      React.createElement('p', { style: webStyles.expenseCardDesc }, 'Sumarização baseada na data da entidade de despesas das viagens e somente com status aprovado.'),
      React.createElement('p', { style: webStyles.expenseCardLabel }, 'Total de despesas aprovadas no período'),
      React.createElement('p', { style: webStyles.expenseCardValue }, 'R$ 16.550,00'),
      React.createElement('button', { type: 'button', style: webStyles.expenseCardLink }, 'Ver detalhes em Pagamentos', React.createElement('span', null, arrowForwardSvg))));

  const statCardsData = isEncomendas
    ? [
        { title: 'Entregas em andamento', value: '15', change: '+6% vs semana anterior', positive: true },
        { title: 'Agendadas', value: '24', change: '+3% vs semana anterior', positive: true },
        { title: 'Concluídas', value: '16', change: '+10% vs semana anterior', positive: true },
        { title: 'Canceladas', value: '15', change: '-9% vs semana anterior', positive: false },
      ]
    : [
        { title: 'Viagens em andamento', value: '24', change: '+12% vs semana anterior', positive: true },
        { title: 'Agendadas', value: '48', change: '+8% vs semana anterior', positive: true },
        { title: 'Concluídas', value: '24', change: '+18% vs semana anterior', positive: true },
        { title: 'Canceladas', value: '12', change: '-5% vs semana anterior', positive: false },
      ];
  const statCards = statCardsData.map((s) =>
    React.createElement('div', { key: s.title, style: webStyles.statCard },
      React.createElement('div', { style: webStyles.statCardHeader },
        React.createElement('span', { style: webStyles.statCardTitle }, s.title),
        React.createElement('span', { style: { opacity: 0 } }, '○')),
      React.createElement('span', { style: { ...webStyles.statCardChange, ...(s.positive ? webStyles.statCardChangePos : webStyles.statCardChangeNeg) } }, s.change),
      React.createElement('span', { style: webStyles.statCardValue }, s.value)));

  const chartTitle = isEncomendas ? 'Distribuição de valores das encomendas concluídas' : 'Distribuição de receitas';
  const chartDesc = isEncomendas ? 'Distribuição de valores das encomendas concluídas no período filtrado.' : 'A receita total inclui todas as viagens concluídas no período filtrado.';
  const chartCardEl = React.createElement('div', { style: webStyles.chartCard },
    React.createElement('h3', { style: webStyles.chartCardTitle }, chartTitle),
    React.createElement('p', { style: webStyles.chartCardDesc }, chartDesc),
    React.createElement('div', { style: webStyles.chartRow },
      React.createElement('div', { style: { width: 200, height: 200, borderRadius: '50%', background: 'conic-gradient(#cba04b 0deg 144deg, #545454 144deg 252deg, #0d0d0d 252deg 360deg)', flexShrink: 0 } }),
      React.createElement('div', { style: webStyles.chartLegend },
        React.createElement('p', { style: webStyles.chartTotal }, 'Faturamento total: R$ 40.000,00'),
        React.createElement('div', { style: webStyles.chartLegendItem },
          React.createElement('span', { style: { ...webStyles.chartLegendDot, background: '#cba04b' } }),
          React.createElement('span', { style: webStyles.chartLegendText }, '40% Taxas')),
        React.createElement('div', { style: webStyles.chartLegendItem },
          React.createElement('span', { style: { ...webStyles.chartLegendDot, background: '#545454' } }),
          React.createElement('span', { style: webStyles.chartLegendText }, '30% Valor líquido')),
        React.createElement('div', { style: webStyles.chartLegendItem },
          React.createElement('span', { style: { ...webStyles.chartLegendDot, background: '#0d0d0d' } }),
          React.createElement('span', { style: webStyles.chartLegendText }, '30% Despesas')))));

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
        React.createElement('h2', { style: webStyles.modalTitleCentered }, 'Filtro'))),
    React.createElement('div', { style: webStyles.modalSection },
      React.createElement('h3', { style: webStyles.modalSectionTitle }, 'Data da atividade'),
      React.createElement('div', { style: webStyles.modalDateField },
        React.createElement('label', { style: webStyles.modalDateLabel }, 'Data inicial'),
        React.createElement('div', { style: webStyles.modalDateInputWrap },
          React.createElement('span', { style: webStyles.modalDateIcon }, calendarIconSvg),
          React.createElement('input', { type: 'text', placeholder: 'dd/mm/aaaa', value: filterDateInicio, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFilterDateInicio(e.target.value), style: webStyles.modalDateInput, 'aria-label': 'Data inicial' }))),
      React.createElement('div', { style: { ...webStyles.modalDateField, marginTop: 8 } },
        React.createElement('label', { style: webStyles.modalDateLabel }, 'Data final'),
        React.createElement('div', { style: webStyles.modalDateInputWrap },
          React.createElement('span', { style: webStyles.modalDateIcon }, calendarIconSvg),
          React.createElement('input', { type: 'text', placeholder: 'dd/mm/aaaa', value: filterDateFim, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFilterDateFim(e.target.value), style: webStyles.modalDateInput, 'aria-label': 'Data final' })))),
    React.createElement('div', { style: webStyles.modalSectionGap12 },
      React.createElement('h3', { style: webStyles.modalSectionTitle }, 'Status da viagem'),
      React.createElement('div', { style: webStyles.modalChips }, ...statusOptions.map((opt) =>
        React.createElement('button', { key: opt.id, type: 'button', style: { ...webStyles.modalChip, ...(filterStatus === opt.id ? webStyles.modalChipActive : webStyles.modalChipInactive) } as React.CSSProperties, onClick: () => setFilterStatus(opt.id) }, opt.label)))),
    React.createElement('div', { style: webStyles.modalSectionGap12 },
      React.createElement('h3', { style: webStyles.modalSectionTitle }, 'Categoria'),
      React.createElement('div', { style: webStyles.modalChips }, ...categoriaOptionsInicio.map((opt) =>
        React.createElement('button', { key: opt.id, type: 'button', style: { ...webStyles.modalChip, ...(filterCategoria.has(opt.id) ? webStyles.modalChipActive : webStyles.modalChipInactive) } as React.CSSProperties, onClick: () => toggleCategoria(opt.id) }, opt.label))),
    React.createElement('div', { style: webStyles.modalButtonWrap },
      React.createElement('button', { type: 'button', style: webStyles.modalApplyBtn, onClick: () => setFilterModalOpen(false) }, 'Aplicar filtro'))));

  const filterModalEl = filterModalOpen
    ? React.createElement('div', { style: webStyles.modalOverlay, onClick: () => setFilterModalOpen(false), role: 'dialog', 'aria-modal': true, 'aria-label': 'Filtro' }, filterModalInicioContent)
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
