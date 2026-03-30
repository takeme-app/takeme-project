/**
 * PassageirosScreen — Lista de passageiros conforme Figma.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
  editIconSvg,
  calendarIconSvg,
  closeIconSvg,
} from '../styles/webStyles';
import { fetchPassageiros, fetchPassageiroCounts, fetchPassageiroBookings, type PassageiroCounts } from '../data/queries';
import type { PassageiroListItem } from '../data/types';

// SVG icons for view/edit actions
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const pencilActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Avatar colors by initial
const avatarColors: Record<string, string> = {
  C: '#4A90D9', J: '#7B61FF', E: '#E8725C', M: '#50C878', D: '#F5A623',
};

type PassageiroRow = {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  dataCriacao: string;
  cpf: string;
  status: 'Ativo' | 'Inativo';
};

const tableCols = [
  { label: 'Passageiros', flex: '1 1 18%', minWidth: 170 },
  { label: 'Cidade', flex: '1 1 14%', minWidth: 120 },
  { label: 'Estado', flex: '1 1 14%', minWidth: 120 },
  { label: 'Data criação', flex: '0 0 105px', minWidth: 105 },
  { label: 'CPF', flex: '0 0 140px', minWidth: 140 },
  { label: 'Status', flex: '0 0 100px', minWidth: 100 },
  { label: 'Visualizar/Editar', flex: '0 0 96px', minWidth: 96 },
];

// Local styles
const s = {
  metricCard: {
    ...webStyles.viagensMetricCard,
  } as React.CSSProperties,
  metricTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: '#767676',
    fontFamily: 'Inter, sans-serif',
    margin: 0,
  } as React.CSSProperties,
  metricPctRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  } as React.CSSProperties,
  metricPct: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,
  metricDesc: {
    fontSize: 12,
    fontWeight: 400,
    color: '#767676',
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,
  metricValue: {
    fontSize: 32,
    fontWeight: 700,
    color: '#0d0d0d',
    fontFamily: 'Inter, sans-serif',
    marginTop: 8,
  } as React.CSSProperties,
  chartsRow: {
    display: 'flex',
    gap: 24,
    width: '100%',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  chartCard: {
    flex: '1 1 calc(50% - 12px)',
    minWidth: 300,
    background: '#f1f1f1',
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  chartCardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#0d0d0d',
    margin: 0,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,
  chartCardSubtitle: {
    fontSize: 14,
    fontWeight: 400,
    color: '#767676',
    margin: 0,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,
  donutWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  donut: {
    width: 200,
    height: 200,
    borderRadius: '50%',
    position: 'relative' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  donutHole: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#ffffff',
  } as React.CSSProperties,
  legendWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  } as React.CSSProperties,
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,
  legendText: {
    fontSize: 14,
    fontWeight: 400,
    color: '#0d0d0d',
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,
  tableSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  } as React.CSSProperties,
  tableSectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#0d0d0d',
    margin: 0,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,
  statusPillAtivo: {
    background: '#e6f9e6',
    color: '#22c55e',
    borderRadius: 999,
    padding: '4px 16px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  statusPillInativo: {
    background: '#fde8e8',
    color: '#b53838',
    borderRadius: 999,
    padding: '4px 16px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
};

export default function PassageirosScreen() {
  const navigate = useNavigate();

  // ── Real data from Supabase ─────────────────────────────────────────
  const [passageirosData, setPassageirosData] = useState<PassageiroListItem[]>([]);
  const [pCounts, setPCounts] = useState<PassageiroCounts>({ total: 0, ativos: 0, inativos: 0 });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [items, c] = await Promise.all([fetchPassageiros(), fetchPassageiroCounts()]);
      if (!cancelled) { setPassageirosData(items); setPCounts(c); setDataLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const tableRowsAll: PassageiroRow[] = passageirosData.map((p) => ({
    id: p.id,
    nome: p.nome,
    cidade: p.cidade,
    estado: p.estado,
    dataCriacao: p.dataCriacao,
    cpf: p.cpf,
    status: p.status,
  }));

  // Filter is applied below after filterStatus state is declared

  const metrics = [
    { title: 'Totais de passageiros', pct: '', pctPositive: true, desc: '', value: String(pCounts.total) },
    { title: 'Ativos', pct: '', pctPositive: true, desc: '', value: String(pCounts.ativos) },
    { title: 'Inativos', pct: '', pctPositive: false, desc: '', value: String(pCounts.inativos) },
  ];

  // ── Trocar motorista panel state (Figma 1224-20561) ─────────────────
  const [trocarOpen, setTrocarOpen] = useState(false);
  const [trocarSelected, setTrocarSelected] = useState(0);
  const [trocarDate, setTrocarDate] = useState('01 de setembro');
  const [trocarMotivo, setTrocarMotivo] = useState('');

  // ── Alterar passageiro panel state (Figma 1271-33075) ─────────────
  const [alterarOpen, setAlterarOpen] = useState(false);
  const [alterarRow, setAlterarRow] = useState<PassageiroRow | null>(null);
  const [alterarId, setAlterarId] = useState('#312312312');
  const [alterarNome, setAlterarNome] = useState('');
  const [alterarContato, setAlterarContato] = useState('(21) 98888-7777');
  const [alterarMala, setAlterarMala] = useState('Pequena');
  const [alterarValor, setAlterarValor] = useState('R$ 25,00');
  const [alterarMalaDropOpen, setAlterarMalaDropOpen] = useState(false);

  const openAlterarPanel = (row: PassageiroRow) => {
    setAlterarRow(row);
    setAlterarNome(row.nome);
    setAlterarOpen(true);
    setAlterarMalaDropOpen(false);
  };

  // ── Table filter modal state (Figma 1190-19717) ────────────────────
  const [tableFilterOpen, setTableFilterOpen] = useState(false);
  const [tblFilterNome, setTblFilterNome] = useState('');
  const [tblFilterOrigem, setTblFilterOrigem] = useState('');
  const [tblFilterDate, setTblFilterDate] = useState('01 de setembro');
  const [tblFilterCategoria, setTblFilterCategoria] = useState<'todos' | 'take_me' | 'motorista'>('take_me');

  // ── Filter modal state (Figma 837-14711) ───────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDateInicio, setFilterDateInicio] = useState('01 de setembro');
  const [filterDateFim, setFilterDateFim] = useState('31 de setembro');
  const [filterDatasIncluidas, setFilterDatasIncluidas] = useState<'somente_passadas' | 'passadas_e_futuras' | 'somente_futuras'>('passadas_e_futuras');
  const [filterStatus, setFilterStatus] = useState<'em_andamento' | 'agendadas' | 'concluidas' | 'canceladas'>('em_andamento');
  const [filterFaixa, setFilterFaixa] = useState<'10_20' | '21_30' | '30_60'>('10_20');
  const [filterGenero, setFilterGenero] = useState<'masculino' | 'feminino'>('feminino');

  // Apply filters — modal da tabela (tbl*) + chip de status do modal principal
  const tableRows = tableRowsAll.filter((row) => {
    const statusLower = row.status.toLowerCase();
    if (filterStatus === 'em_andamento' && !statusLower.includes('ativ')) return false;
    if (filterStatus === 'agendadas') return false;
    if (filterStatus === 'concluidas' && !statusLower.includes('verificad')) return false;
    if (filterStatus === 'canceladas' && !statusLower.includes('inativ') && !statusLower.includes('cancel')) return false;
    const nn = tblFilterNome.trim().toLowerCase();
    if (nn && !row.nome.toLowerCase().includes(nn)) return false;
    const oo = tblFilterOrigem.trim().toLowerCase();
    if (oo && !(`${row.cidade} ${row.estado}`.toLowerCase().includes(oo))) return false;
    return true;
  });

  // ── Search row ────────────────────────────────────────────────────────
  const searchRow = React.createElement('div', { style: webStyles.searchRow },
    React.createElement('div', { style: webStyles.searchInputWrap },
      React.createElement('div', { style: webStyles.searchInputInner },
        React.createElement('span', { style: webStyles.searchIcon }, searchIconSvg),
        React.createElement('input', { type: 'search', placeholder: 'Buscar passageiro, destino ou origem...', style: webStyles.searchInput, 'aria-label': 'Buscar' }))),
    React.createElement('div', { style: webStyles.filterGroup },
      React.createElement('button', { type: 'button', style: webStyles.filterBtn, onClick: () => { setTrocarOpen(true); setTrocarSelected(0); setTrocarMotivo(''); } }, React.createElement('span', null, editIconSvg), 'Trocar motorista'),
      React.createElement('button', { type: 'button', 'data-testid': 'passageiros-open-page-filter', style: webStyles.filterBtn, onClick: () => setFilterOpen(true) }, React.createElement('span', null, filterIconSvg), 'Filtro')));

  // ── Metric cards ──────────────────────────────────────────────────────
  const metricCardEl = (m: typeof metrics[0]) =>
    React.createElement('div', { key: m.title, style: s.metricCard },
      React.createElement('span', { style: s.metricTitle }, m.title),
      React.createElement('div', { style: s.metricPctRow },
        React.createElement('span', { style: { ...s.metricPct, color: m.pctPositive ? '#22c55e' : '#b53838' } }, m.pct),
        React.createElement('span', { style: s.metricDesc }, m.desc)),
      React.createElement('span', { style: s.metricValue }, m.value));

  const metricCards = React.createElement('div', { style: webStyles.statCardsRow },
    ...metrics.map(metricCardEl));

  // ── Donut charts ──────────────────────────────────────────────────────
  // Gender donut: Homens 58% (blue), Mulheres 42% (red)
  // 58% = 208.8deg, 42% = 151.2deg
  const genderGradient = 'conic-gradient(#3b82f6 0deg 208.8deg, #ef4444 208.8deg 360deg)';
  const genderChart = React.createElement('div', { style: s.chartCard },
    React.createElement('h3', { style: s.chartCardTitle }, 'Distribuição Demográfica'),
    React.createElement('p', { style: s.chartCardSubtitle }, 'Por gênero'),
    React.createElement('div', { style: s.donutWrap },
      React.createElement('div', { style: { ...s.donut, background: genderGradient } },
        React.createElement('div', { style: s.donutHole })),
      React.createElement('div', { style: s.legendWrap },
        React.createElement('div', { style: s.legendItem },
          React.createElement('span', { style: { ...s.legendDot, background: '#3b82f6' } }),
          React.createElement('span', { style: s.legendText }, 'Homens 58%')),
        React.createElement('div', { style: s.legendItem },
          React.createElement('span', { style: { ...s.legendDot, background: '#ef4444' } }),
          React.createElement('span', { style: s.legendText }, 'Mulheres 42%')))));

  // Age donut: 5-17 anos 22% (dark), 21-30 anos 48% (gray), 30-60 anos 30% (gold)
  // 22% = 79.2deg, 48% = 172.8deg, 30% = 108deg
  const ageGradient = 'conic-gradient(#1a1a1a 0deg 79.2deg, #9ca3af 79.2deg 252deg, #cba04b 252deg 360deg)';
  const ageChart = React.createElement('div', { style: s.chartCard },
    React.createElement('h3', { style: s.chartCardTitle }, 'Distribuição Demográfica'),
    React.createElement('p', { style: s.chartCardSubtitle }, 'Por faixa etária'),
    React.createElement('div', { style: s.donutWrap },
      React.createElement('div', { style: { ...s.donut, background: ageGradient } },
        React.createElement('div', { style: s.donutHole })),
      React.createElement('div', { style: s.legendWrap },
        React.createElement('div', { style: s.legendItem },
          React.createElement('span', { style: { ...s.legendDot, background: '#1a1a1a' } }),
          React.createElement('span', { style: s.legendText }, '5-17 anos: 22%')),
        React.createElement('div', { style: s.legendItem },
          React.createElement('span', { style: { ...s.legendDot, background: '#9ca3af' } }),
          React.createElement('span', { style: s.legendText }, '21-30 anos: 48%')),
        React.createElement('div', { style: s.legendItem },
          React.createElement('span', { style: { ...s.legendDot, background: '#cba04b' } }),
          React.createElement('span', { style: s.legendText }, '30-60 anos: 30%')))));

  const chartsSection = React.createElement('div', { style: s.chartsRow }, genderChart, ageChart);

  // ── Table section ─────────────────────────────────────────────────────
  const tableHeader = React.createElement('div', {
    style: { ...webStyles.viagensTableHeader, display: 'flex' },
  },
    ...tableCols.map((c) => React.createElement('div', {
      key: c.label,
      style: {
        flex: c.flex, minWidth: c.minWidth, padding: '0 8px',
        display: 'flex', alignItems: 'center',
        fontSize: 12, fontWeight: 400, lineHeight: '1.5',
        fontFamily: 'Inter, sans-serif', color: '#767676',
      },
    }, c.label)));

  const renderAvatar = (name: string) => {
    const initial = name.charAt(0).toUpperCase();
    const bg = avatarColors[initial] || '#999';
    return React.createElement('div', {
      style: { ...webStyles.viagensAvatar, background: bg },
    }, React.createElement('span', {
      style: { color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: 'Inter, sans-serif' },
    }, initial));
  };

  const cellBase = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', fontFamily: 'Inter, sans-serif', padding: '0 8px' } as const;

  const tableRowEl = (row: PassageiroRow, idx: number) => {
    const statusStyle = row.status === 'Ativo' ? s.statusPillAtivo : s.statusPillInativo;
    return React.createElement('div', {
      key: row.id,
      'data-testid': 'passageiro-table-row',
      style: { ...webStyles.viagensTableRow, display: 'flex', background: idx % 2 === 1 ? '#ffffff' : undefined },
    },
      // Passageiros (avatar + name)
      React.createElement('div', {
        style: { ...webStyles.viagensPassengerCell, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, cursor: 'pointer' },
        onClick: () => openAlterarPanel(row),
      },
        renderAvatar(row.nome),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', fontFamily: 'Inter, sans-serif', lineHeight: '1.5' } }, row.nome)),
      // Cidade
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, row.cidade),
      // Estado
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, row.estado),
      // Data criação
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth, fontWeight: 400 } }, row.dataCriacao),
      // CPF
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth, fontWeight: 400 } }, row.cpf),
      // Status
      React.createElement('div', { style: { ...cellBase, flex: tableCols[5].flex, minWidth: tableCols[5].minWidth } },
        React.createElement('span', { style: statusStyle }, row.status)),
      // Visualizar/Editar
      React.createElement('div', {
        style: { flex: tableCols[6].flex, minWidth: tableCols[6].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' },
      },
        React.createElement('div', { style: webStyles.viagensActionIcons },
          React.createElement('button', {
            type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar',
            onClick: () => {
              void (async () => {
                const bookings = await fetchPassageiroBookings(row.id);
                const first = bookings[0];
                if (first) {
                  navigate(`/passageiros/${row.id}/viagem/${first.bookingId}`, {
                    state: {
                      trip: {
                        passageiro: row.nome, origem: first.origem, destino: first.destino, data: first.data,
                        embarque: first.embarque, chegada: first.chegada, status: first.status,
                      },
                    },
                  });
                } else navigate(`/passageiros/${row.id}`);
              })();
            },
          }, eyeActionSvg),
          React.createElement('button', {
            type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar',
            onClick: () => {
              void (async () => {
                const bookings = await fetchPassageiroBookings(row.id);
                const first = bookings[0];
                if (first) {
                  navigate(`/passageiros/${row.id}/viagem/${first.bookingId}/editar`, {
                    state: {
                      trip: {
                        passageiro: row.nome, origem: first.origem, destino: first.destino, data: first.data,
                        embarque: first.embarque, chegada: first.chegada, status: first.status,
                      },
                      from: 'Passageiros',
                    },
                  });
                } else navigate(`/passageiros/${row.id}`);
              })();
            },
          }, pencilActionSvg))));
  };

  const tableSectionEl = React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16, width: '100%' } },
    React.createElement('div', { style: s.tableSectionHeader },
      React.createElement('h2', { style: s.tableSectionTitle }, 'Passageiros'),
      React.createElement('button', { type: 'button', style: webStyles.filterBtn, onClick: () => setTableFilterOpen(true), 'data-testid': 'passageiros-open-table-filter' }, React.createElement('span', null, filterIconSvg), 'Filtro')),
    React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
      tableHeader,
      ...tableRows.map(tableRowEl)));

  // ── Trocar motorista slide panel (Figma 1224-20561) ─────────────────
  const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

  const tmDrivers = [
    { name: 'Maria Joaquina', rota: 'Rio de Janeiro - RJ → São Paulo - SP', data: '25/10/2025', valorTotal: 'R$ 150,00', valorUnit: 'R$ 75,00', pessoas: '2', ocupacao: '80%' },
    { name: 'Pedro Albuquerque', rota: 'Rio de Janeiro - RJ → São Paulo - SP', data: '26/10/2025', valorTotal: 'R$ 145,00', valorUnit: 'R$ 70,00', pessoas: '3', ocupacao: '70%' },
    { name: 'Marcio Felipe', rota: 'Rio de Janeiro - RJ → São Paulo - SP', data: '26/10/2025', valorTotal: 'R$ 145,00', valorUnit: 'R$ 70,00', pessoas: '3', ocupacao: '70%' },
    { name: 'Pedro Albuquerque', rota: 'Rio de Janeiro - RJ → São Paulo - SP', data: '26/10/2025', valorTotal: 'R$ 145,00', valorUnit: 'R$ 70,00', pessoas: '3', ocupacao: '70%' },
  ];

  const tmRadioSvg = (sel: boolean) =>
    React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
      React.createElement('circle', { cx: 12, cy: 12, r: 9, stroke: sel ? '#0d0d0d' : '#767676', strokeWidth: 2 }),
      sel ? React.createElement('circle', { cx: 12, cy: 12, r: 5, fill: '#0d0d0d' }) : null);

  const tmInfoRow = (label: string, value: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, label),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 400, color: '#0d0d0d', ...font } }, value));

  const tmDriverCard = (d: typeof tmDrivers[0], idx: number) =>
    React.createElement('div', { key: idx, style: { display: 'flex', flexDirection: 'column' as const } },
      React.createElement('button', {
        type: 'button', onClick: () => setTrocarSelected(idx),
        style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px 0', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 },
      }, tmRadioSvg(trocarSelected === idx),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, d.name)),
      React.createElement('div', { style: { paddingLeft: 39, paddingBottom: 16, borderBottom: '1px solid #e2e2e2', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        tmInfoRow('Origem - Destino', d.rota), tmInfoRow('Data', d.data),
        tmInfoRow('Valor total', d.valorTotal), tmInfoRow('Valor unitário', d.valorUnit),
        tmInfoRow('Pessoas restantes', d.pessoas), tmInfoRow('Ocupação do bagageiro', d.ocupacao)));

  const trocarMotoristaPanel = trocarOpen
    ? React.createElement('div', {
        style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999 },
        onClick: () => setTrocarOpen(false),
      },
        React.createElement('div', {
          style: {
            background: '#fff', borderRadius: '16px 0 0 16px', width: '100%', maxWidth: 520,
            maxHeight: '100vh', boxShadow: '6px 6px 12px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column' as const, padding: '24px 32px', overflowY: 'auto' as const,
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          // Header
          React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #e2e2e2', marginBottom: 24, flexShrink: 0 } },
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, maxWidth: 344 } },
              React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Trocar motorista'),
              React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Selecione outro motorista disponível para continuar.')),
            React.createElement('button', {
              type: 'button', 'aria-label': 'Fechar', onClick: () => setTrocarOpen(false),
              style: { width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
            }, closeIconSvg)),
          // Content
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24, paddingLeft: 16, paddingRight: 16 } },
            // Data da atividade
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, paddingBottom: 16 } },
              React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Data da atividade'),
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
                React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Data'),
                React.createElement('div', { style: { position: 'relative' as const, width: '100%' } },
                  React.createElement('div', { style: { position: 'absolute' as const, left: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const } }, calendarIconSvg),
                  React.createElement('input', {
                    type: 'text', value: trocarDate,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTrocarDate(e.target.value),
                    style: { width: '100%', height: 44, background: '#f1f1f1', border: 'none', borderRadius: 8, paddingLeft: 48, fontSize: 16, color: '#767676', outline: 'none', boxSizing: 'border-box' as const, ...font },
                  })))),
            // Viagem atual
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
              React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Viagem atual'),
              tmDriverCard(tmDrivers[0], 0)),
            // Outras viagens disponíveis
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
              React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Outras viagens disponíveis'),
              ...tmDrivers.slice(1).map((d, i) => tmDriverCard(d, i + 1))),
            // Motivo textarea
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Motivo'),
                React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Opcional')),
              React.createElement('textarea', {
                value: trocarMotivo, placeholder: 'Veículo teve problema mecânico.',
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setTrocarMotivo(e.target.value),
                style: { width: '100%', height: 156, background: '#f1f1f1', border: 'none', borderRadius: 8, padding: 16, fontSize: 16, color: trocarMotivo ? '#3a3a3a' : '#767676', outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const, lineHeight: 'normal', ...font },
              }))),
          // Buttons
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, marginTop: 24, padding: '0 23px', flexShrink: 0 } },
            React.createElement('button', {
              type: 'button', onClick: () => setTrocarOpen(false),
              style: { width: '100%', height: 48, background: '#0d0d0d', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#fff', ...font },
            }, 'Confirmar troca'),
            React.createElement('button', {
              type: 'button', onClick: () => setTrocarOpen(false),
              style: { width: '100%', height: 48, background: '#f1f1f1', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#b53838', ...font },
            }, 'Cancelar'))))
    : null;

  // ── Filter modal (Figma 837-14711) ──────────────────────────────────

  const radioSvg = (selected: boolean) =>
    React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
      React.createElement('circle', { cx: 12, cy: 12, r: 9, stroke: selected ? '#0d0d0d' : '#767676', strokeWidth: 2 }),
      selected ? React.createElement('circle', { cx: 12, cy: 12, r: 5, fill: '#0d0d0d' }) : null);

  const chipBtn = (label: string, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', onClick,
      style: {
        height: 40, padding: '0 16px', borderRadius: 90, border: 'none', cursor: 'pointer',
        background: active ? '#0d0d0d' : '#f1f1f1', color: active ? '#fff' : '#0d0d0d',
        fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' as const, ...font,
      },
    }, label);

  const radioRow = (label: string, selected: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', onClick,
      style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px 0', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, width: '100%' },
    },
      radioSvg(selected),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label));

  const dateField = (label: string, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
      React.createElement('div', { style: { position: 'relative' as const, width: '100%' } },
        React.createElement('div', { style: { position: 'absolute' as const, left: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const } }, calendarIconSvg),
        React.createElement('input', {
          type: 'text', value,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          style: { width: '100%', height: 44, background: '#f1f1f1', border: 'none', borderRadius: 8, paddingLeft: 48, fontSize: 16, color: '#767676', outline: 'none', boxSizing: 'border-box' as const, ...font },
        })));

  const filterModalContent = React.createElement('div', {
    style: {
      background: '#fff', borderRadius: 16, padding: '24px 0', width: '100%', maxWidth: 560,
      maxHeight: '90vh', overflowY: 'auto' as const,
      boxShadow: '6px 6px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' as const, gap: 24,
    },
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  },
    // Header
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', paddingBottom: 24, borderBottom: '1px solid #e2e2e2' } },
      React.createElement('h2', { id: 'passageiros-filtro-pagina-titulo', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro'),
      React.createElement('button', {
        type: 'button', 'aria-label': 'Fechar',
        onClick: () => setFilterOpen(false),
        style: { width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
      }, closeIconSvg)),
    // Data da atividade
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Data da atividade'),
      dateField('Data inicial', filterDateInicio, setFilterDateInicio),
      dateField('Data final', filterDateFim, setFilterDateFim)),
    // Datas incluídas
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
      React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Datas incluídas'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const } },
        radioRow('Somente passadas', filterDatasIncluidas === 'somente_passadas', () => setFilterDatasIncluidas('somente_passadas')),
        radioRow('Passadas e futuras', filterDatasIncluidas === 'passadas_e_futuras', () => setFilterDatasIncluidas('passadas_e_futuras')),
        radioRow('Somente futuras', filterDatasIncluidas === 'somente_futuras', () => setFilterDatasIncluidas('somente_futuras')))),
    // Status da viagem
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
      React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Status da viagem'),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        chipBtn('Em andamento', filterStatus === 'em_andamento', () => setFilterStatus('em_andamento')),
        chipBtn('Agendadas', filterStatus === 'agendadas', () => setFilterStatus('agendadas')),
        chipBtn('Concluídas', filterStatus === 'concluidas', () => setFilterStatus('concluidas')),
        chipBtn('Canceladas', filterStatus === 'canceladas', () => setFilterStatus('canceladas')))),
    // Faixa Etária
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
      React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Faixa Etária'),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        chipBtn('10-20 anos', filterFaixa === '10_20', () => setFilterFaixa('10_20')),
        chipBtn('21-30 anos', filterFaixa === '21_30', () => setFilterFaixa('21_30')),
        chipBtn('30-60 anos', filterFaixa === '30_60', () => setFilterFaixa('30_60')))),
    // Gênero
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
      React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Gênero'),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        chipBtn('Masculino', filterGenero === 'masculino', () => setFilterGenero('masculino')),
        chipBtn('Feminino', filterGenero === 'feminino', () => setFilterGenero('feminino')))),
    // Buttons
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, padding: '0 23px' } },
      React.createElement('button', {
        type: 'button',
        onClick: () => setFilterOpen(false),
        style: { width: '100%', height: 48, background: '#0d0d0d', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#fff', ...font },
      }, 'Aplicar filtro'),
      React.createElement('button', {
        type: 'button',
        onClick: () => setFilterOpen(false),
        style: { width: '100%', height: 48, background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#0d0d0d', ...font },
      }, 'Voltar')));

  const filterModalEl = filterOpen
    ? React.createElement('div', {
        style: webStyles.modalOverlay,
        onClick: () => setFilterOpen(false),
        role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'passageiros-filtro-pagina-titulo',
      }, filterModalContent)
    : null;

  // ── Table filter modal (Figma 1190-19717) ──────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, background: '#f1f1f1', border: 'none', borderRadius: 8,
    paddingLeft: 16, fontSize: 16, color: '#3a3a3a', outline: 'none', boxSizing: 'border-box', ...font,
  };
  const tblChip = (label: string, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', onClick,
      style: {
        height: 40, padding: '0 16px', borderRadius: 90, border: 'none', cursor: 'pointer',
        background: active ? '#0d0d0d' : '#f1f1f1', color: active ? '#fff' : '#0d0d0d',
        fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' as const, ...font,
      },
    }, label);

  const tableFilterContent = React.createElement('div', {
    style: {
      background: '#fff', borderRadius: 16, padding: '24px 0', width: '100%', maxWidth: 560,
      maxHeight: '90vh', overflowY: 'auto' as const,
      boxShadow: '6px 6px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' as const, gap: 24,
    },
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  },
    // Header
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', paddingBottom: 24, borderBottom: '1px solid #e2e2e2' } },
      React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro da tabela'),
      React.createElement('button', {
        type: 'button', 'aria-label': 'Fechar', onClick: () => setTableFilterOpen(false),
        style: { width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
      }, closeIconSvg)),
    // Nome do passageiro
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Nome do passageiro'),
      React.createElement('input', {
        type: 'text', value: tblFilterNome, placeholder: 'Ex: Carlos Silva',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblFilterNome(e.target.value),
        style: { ...inputStyle, color: tblFilterNome ? '#3a3a3a' : '#767676' },
      })),
    // Origem
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Origem'),
      React.createElement('input', {
        type: 'text', value: tblFilterOrigem, placeholder: 'Ex: São Paulo',
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblFilterOrigem(e.target.value),
        style: { ...inputStyle, color: tblFilterOrigem ? '#3a3a3a' : '#767676' },
      })),
    // Data inicial
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Data inicial'),
      React.createElement('div', { style: { position: 'relative' as const, width: '100%' } },
        React.createElement('div', { style: { position: 'absolute' as const, left: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const } }, calendarIconSvg),
        React.createElement('input', {
          type: 'text', value: tblFilterDate,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblFilterDate(e.target.value),
          style: { ...inputStyle, paddingLeft: 48, color: '#767676' },
        }))),
    // Status da viagem
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
      React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Status da viagem'),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        tblChip('Em andamento', filterStatus === 'em_andamento', () => setFilterStatus('em_andamento')),
        tblChip('Agendadas', filterStatus === 'agendadas', () => setFilterStatus('agendadas')),
        tblChip('Concluídas', filterStatus === 'concluidas', () => setFilterStatus('concluidas')),
        tblChip('Canceladas', filterStatus === 'canceladas', () => setFilterStatus('canceladas')))),
    // Categoria
    React.createElement('div', { style: { padding: '0 24px', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
      React.createElement('span', { style: { fontSize: 18, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Categoria'),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        tblChip('Todos', tblFilterCategoria === 'todos', () => setTblFilterCategoria('todos')),
        tblChip('Take Me', tblFilterCategoria === 'take_me', () => setTblFilterCategoria('take_me')),
        tblChip('Motorista parceiro', tblFilterCategoria === 'motorista', () => setTblFilterCategoria('motorista')))),
    // Buttons
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, padding: '0 23px' } },
      React.createElement('button', {
        type: 'button', onClick: () => setTableFilterOpen(false),
        style: { width: '100%', height: 48, background: '#0d0d0d', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#fff', ...font },
      }, 'Aplicar filtro'),
      React.createElement('button', {
        type: 'button', onClick: () => setTableFilterOpen(false),
        style: { width: '100%', height: 48, background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#0d0d0d', ...font },
      }, 'Voltar')));

  const tableFilterEl = tableFilterOpen
    ? React.createElement('div', {
        style: webStyles.modalOverlay,
        onClick: () => setTableFilterOpen(false),
        role: 'dialog', 'aria-modal': true, 'aria-label': 'Filtro da tabela',
      }, tableFilterContent)
    : null;

  // ── Alterar passageiro slide panel (Figma 1271-33075) ────────────────

  const malaOptions = ['Pequena', 'Média', 'Grande'];

  const chevronDownIcon = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M8 10l4 4 4-4', stroke: '#545454', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  const alterarField = (label: string, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' } },
      React.createElement('div', { style: { minHeight: 40, display: 'flex', alignItems: 'center' } },
        React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label)),
      React.createElement('div', { style: { width: '100%', height: 44, background: '#f1f1f1', borderRadius: 8, display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 16 } },
        React.createElement('input', {
          type: 'text', value,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          style: { width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: '#3a3a3a', ...font },
        })));

  const malaDropdown = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%', position: 'relative' as const } },
    React.createElement('div', { style: { minHeight: 40, display: 'flex', alignItems: 'center' } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Tamanho da mala')),
    React.createElement('button', {
      type: 'button',
      onClick: () => setAlterarMalaDropOpen(!alterarMalaDropOpen),
      style: {
        width: '100%', height: 44, background: '#f1f1f1', borderRadius: 8, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 4,
      },
    },
      React.createElement('span', { style: { fontSize: 16, color: '#3a3a3a', ...font, textAlign: 'left' as const } }, alterarMala),
      React.createElement('div', { style: { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, chevronDownIcon)),
    alterarMalaDropOpen
      ? React.createElement('div', {
          style: {
            position: 'absolute' as const, top: 84, left: 0, right: 0, background: '#fff', borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 10, overflow: 'hidden',
          },
        },
          ...malaOptions.map((opt) =>
            React.createElement('button', {
              key: opt, type: 'button',
              onClick: () => { setAlterarMala(opt); setAlterarMalaDropOpen(false); },
              style: {
                width: '100%', height: 44, padding: '0 16px', background: alterarMala === opt ? '#f1f1f1' : '#fff',
                border: 'none', cursor: 'pointer', textAlign: 'left' as const, fontSize: 16, color: '#0d0d0d', ...font,
              },
            }, opt)))
      : null);

  const alterarPassageiroPanel = alterarOpen
    ? React.createElement('div', {
        style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999 },
        onClick: () => setAlterarOpen(false),
      },
        React.createElement('div', {
          style: {
            background: '#fff', borderRadius: '16px 0 0 16px', width: '100%', maxWidth: 520,
            maxHeight: '100vh', boxShadow: '6px 6px 12px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column' as const, padding: '64px 32px 88px', overflowY: 'auto' as const,
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          // Scrollable content wrapper
          React.createElement('div', {
            style: { display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', flex: 1, gap: 32 },
          },
            // Top section
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 32 } },
              // Header
              React.createElement('div', {
                style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #e2e2e2' },
              },
                React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Alterar passageiro'),
                React.createElement('button', {
                  type: 'button', 'aria-label': 'Fechar', onClick: () => setAlterarOpen(false),
                  style: { width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
                }, closeIconSvg)),
              // Fields
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
                alterarField('ID do passageiro', alterarId, setAlterarId),
                alterarField('Nome completo', alterarNome, setAlterarNome),
                alterarField('Contato', alterarContato, setAlterarContato),
                malaDropdown,
                alterarField('Valor', alterarValor, setAlterarValor))),
            // Buttons
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10 } },
              React.createElement('button', {
                type: 'button', onClick: () => setAlterarOpen(false),
                style: { width: '100%', height: 48, background: '#0d0d0d', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#fff', ...font },
              }, 'Salvar dados'),
              React.createElement('button', {
                type: 'button', onClick: () => setAlterarOpen(false),
                style: { width: '100%', height: 48, background: '#e2e2e2', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#b53838', ...font },
              }, 'Cancelar')))))
    : null;

  if (dataLoading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Carregando passageiros...'));
  }

  // ── Main render ───────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Passageiros'),
    searchRow,
    metricCards,
    chartsSection,
    tableSectionEl,
    filterModalEl,
    tableFilterEl,
    trocarMotoristaPanel,
    alterarPassageiroPanel);
}
