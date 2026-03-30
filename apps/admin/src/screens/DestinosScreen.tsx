/**
 * DestinosScreen — Lista de destinos conforme Figma 849-21654.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
  calendarIconSvg,
} from '../styles/webStyles';
import { fetchDestinos, fetchTakemeRoutes, createTakemeRoute, updateTakemeRoute } from '../data/queries';
import type { DestinoListItem } from '../data/types';

const { BarChart, Bar, XAxis, YAxis, Tooltip: RechTooltip, ResponsiveContainer } = require('recharts');

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// ── Helper components ─────────────────────────────────────────────────────────

const fChip = (label: string, active: boolean, onClick: () => void) =>
  React.createElement('button', {
    type: 'button', key: label, onClick,
    style: {
      padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
      fontSize: 13, fontWeight: 600, ...font,
      background: active ? '#0d0d0d' : '#f1f1f1',
      color: active ? '#fff' : '#0d0d0d',
      height: 40, whiteSpace: 'nowrap' as const,
    },
  }, label);

// SVG icons
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const pencilActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const plusSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const chevronDownSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const closeSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

// ── Types ─────────────────────────────────────────────────────────────────────

type DestinoRow = {
  origem: string;
  destino: string;
  totalAtividades: number;
  dataCriacao: string;
  status: 'Ativo' | 'Inativo';
};

type FiltroDatasIncluidas = 'passadas' | 'ambas' | 'futuras' | null;
type FiltroStatusViagem = 'todos' | 'em_andamento' | 'agendadas' | 'concluidas' | 'canceladas';
type FiltroCategoria = 'todos' | 'take_me' | 'motorista_parceiro';

// ── Table config ──────────────────────────────────────────────────────────────

const tableCols = [
  { label: 'Origem', flex: '1 1 16%', minWidth: 130 },
  { label: 'Destino', flex: '1 1 16%', minWidth: 130 },
  { label: 'Total de Atividades', flex: '0 0 140px', minWidth: 140 },
  { label: 'Data de criação', flex: '0 0 120px', minWidth: 120 },
  { label: 'Status', flex: '0 0 100px', minWidth: 100 },
  { label: 'Visualizar/Editar', flex: '0 0 96px', minWidth: 96 },
];

const statusStyles: Record<string, { bg: string; color: string }> = {
  'Ativo': { bg: '#22c55e', color: '#fff' },
  'Inativo': { bg: '#ef4444', color: '#fff' },
};

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  metricCard: {
    flex: '1 1 0', minWidth: 160, background: '#f6f6f6', borderRadius: 16,
    padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  metricTitle: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } as React.CSSProperties,
  metricValue: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } as React.CSSProperties,
  chartCard: {
    width: '100%', background: '#f6f6f6', borderRadius: 16, padding: 24,
    display: 'flex', flexDirection: 'column' as const, gap: 16, boxSizing: 'border-box' as const,
  } as React.CSSProperties,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DestinosScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [estadosDropdownOpen, setEstadosDropdownOpen] = useState(false);
  const [estadoSelected, setEstadoSelected] = useState('Todos os estados');

  // Criar rota modal
  const [criarRotaOpen, setCriarRotaOpen] = useState(false);
  const [crEstadoOrigem, setCrEstadoOrigem] = useState('');
  const [crCidadeOrigem, setCrCidadeOrigem] = useState('');
  const [crEstadoDestino, setCrEstadoDestino] = useState('');
  const [crCidadeDestino, setCrCidadeDestino] = useState('');
  const [crRotaAtiva, setCrRotaAtiva] = useState(true);

  // Visualizar destino modal
  const [vizDestinoOpen, setVizDestinoOpen] = useState(false);
  const [vizDestino, setVizDestino] = useState<DestinoRow | null>(null);

  // Editar rota modal — inclui edRotaOrigem/edRotaDestino para identificar a rota
  const [editarRotaOpen, setEditarRotaOpen] = useState(false);
  const [edEstadoOrigem, setEdEstadoOrigem] = useState('');
  const [edCidadeOrigem, setEdCidadeOrigem] = useState('');
  const [edEstadoDestino, setEdEstadoDestino] = useState('');
  const [edCidadeDestino, setEdCidadeDestino] = useState('');
  const [edRotaAtiva, setEdRotaAtiva] = useState(true);
  const [edRotaOrigemOriginal, setEdRotaOrigemOriginal] = useState('');
  const [edRotaDestinoOriginal, setEdRotaDestinoOriginal] = useState('');

  // Filtro da página
  const [filtroPaginaOpen, setFiltroPaginaOpen] = useState(false);
  const [filtroDataInicial, setFiltroDataInicial] = useState('');
  const [filtroDataFinal, setFiltroDataFinal] = useState('');
  const [filtroDatasIncluidas, setFiltroDatasIncluidas] = useState<FiltroDatasIncluidas>(null);
  const [filtroStatusViagem, setFiltroStatusViagem] = useState<FiltroStatusViagem>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('todos');

  // Filtro da tabela
  const [filtroTabelaOpen, setFiltroTabelaOpen] = useState(false);
  const [tabelaFiltroOrigem, setTabelaFiltroOrigem] = useState('');
  const [tabelaFiltroDestino, setTabelaFiltroDestino] = useState('');
  const [tabelaFiltroHoraEmbarque, setTabelaFiltroHoraEmbarque] = useState('');
  const [tabelaFiltroHoraChegada, setTabelaFiltroHoraChegada] = useState('');
  const [tabelaFiltroDataInicial, setTabelaFiltroDataInicial] = useState('');
  const [tabelaFiltroStatusViagem, setTabelaFiltroStatusViagem] = useState<FiltroStatusViagem>('todos');
  const [tabelaFiltroCategoria, setTabelaFiltroCategoria] = useState<FiltroCategoria>('todos');

  // Data
  const [destinosData, setDestinosData] = useState<DestinoListItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDestinos().then((items) => {
      if (!cancelled) { setDestinosData(items); setDataLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  // ── Filtered data ─────────────────────────────────────────────────────────

  const filteredDestinosData = useMemo(() => {
    return destinosData.filter((d) => {
      const q = search.trim().toLowerCase();
      if (q && !`${d.origem} ${d.destino}`.toLowerCase().includes(q)) return false;
      if (estadoSelected !== 'Todos os estados') {
        const u = estadoSelected.toLowerCase();
        if (!d.origem.toLowerCase().includes(u) && !d.destino.toLowerCase().includes(u)) return false;
      }
      // Status: só filtra se não for 'todos'
      if (filtroStatusViagem !== 'todos' && d.tripStatusCounts[filtroStatusViagem] === 0) return false;
      if (tabelaFiltroStatusViagem !== 'todos' && d.tripStatusCounts[tabelaFiltroStatusViagem] === 0) return false;
      // Categoria
      if (filtroCategoria === 'take_me' && d.takeMeCount === 0) return false;
      if (filtroCategoria === 'motorista_parceiro' && d.partnerCount === 0) return false;
      if (tabelaFiltroCategoria === 'take_me' && d.takeMeCount === 0) return false;
      if (tabelaFiltroCategoria === 'motorista_parceiro' && d.partnerCount === 0) return false;
      // Datas incluídas
      if (filtroDatasIncluidas === 'passadas' && !d.hasPastDeparture) return false;
      if (filtroDatasIncluidas === 'futuras' && !d.hasFutureDeparture) return false;
      // Tabela origem/destino
      const o = tabelaFiltroOrigem.trim().toLowerCase();
      if (o && !d.origem.toLowerCase().includes(o)) return false;
      const dest = tabelaFiltroDestino.trim().toLowerCase();
      if (dest && !d.destino.toLowerCase().includes(dest)) return false;
      // Data inicial (página)
      if (filtroDataInicial) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(filtroDataInicial) && d.primeiraDataIso && d.primeiraDataIso < filtroDataInicial) return false;
      }
      // Data inicial (tabela)
      const di = tabelaFiltroDataInicial.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(di) && d.primeiraDataIso && d.primeiraDataIso < di) return false;
      if (di && !/^\d{4}-\d{2}-\d{2}$/.test(di) && !d.primeiraData.toLowerCase().includes(di.toLowerCase())) return false;
      return true;
    });
  }, [
    destinosData, search, estadoSelected,
    filtroStatusViagem, filtroCategoria, filtroDatasIncluidas, filtroDataInicial, filtroDataFinal,
    tabelaFiltroOrigem, tabelaFiltroDestino, tabelaFiltroStatusViagem, tabelaFiltroCategoria, tabelaFiltroDataInicial,
  ]);

  const tableRows: DestinoRow[] = filteredDestinosData.map((d) => ({
    origem: d.origem,
    destino: d.destino,
    totalAtividades: d.totalAtividades,
    dataCriacao: d.primeiraData,
    status: d.ativo ? 'Ativo' as const : 'Inativo' as const,
  }));

  // ── KPI cards ─────────────────────────────────────────────────────────────

  const kpiCards = [
    { title: 'Total de Rotas', value: filteredDestinosData.length, testId: 'destinos-total' },
    { title: 'Rotas Take Me', value: filteredDestinosData.filter(d => d.takeMeCount > 0).length, testId: 'destinos-takeme' },
    { title: 'Rotas Parceiros', value: filteredDestinosData.filter(d => d.partnerCount > 0).length, testId: 'destinos-parceiros' },
    { title: 'Com saídas futuras', value: filteredDestinosData.filter(d => d.hasFutureDeparture).length, testId: 'destinos-futuras' },
  ];

  // ── Bar chart data ────────────────────────────────────────────────────────

  const barData = filteredDestinosData.slice(0, 8).map((d) => ({
    name: `${d.origem.split(',')[0] ?? d.origem.split(' - ')[0] ?? d.origem} → ${d.destino.split(',')[0] ?? d.destino.split(' - ')[0] ?? d.destino}`,
    viagens: d.totalAtividades,
  }));

  const barTooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload?.[0]) return null;
    return React.createElement('div', {
      style: {
        background: '#0d0d0d', color: '#fff', padding: '10px 16px',
        borderRadius: 10, fontSize: 13, fontWeight: 600, ...font,
      },
    }, `${label}: ${payload[0].value} viagens`);
  };

  // ── Editar rota — salvar ──────────────────────────────────────────────────

  const handleSalvarEditar = async () => {
    const newOrigin = `${edCidadeOrigem}${edEstadoOrigem ? ' - ' + edEstadoOrigem : ''}`.trim();
    const newDest = `${edCidadeDestino}${edEstadoDestino ? ' - ' + edEstadoDestino : ''}`.trim();
    // Buscar a rota correspondente em takeme_routes pelo par original origem/destino
    const routes = await fetchTakemeRoutes();
    const match = routes.find(
      (r: any) =>
        r.origin_address === edRotaOrigemOriginal &&
        r.destination_address === edRotaDestinoOriginal,
    );
    if (match) {
      await updateTakemeRoute(match.id, {
        origin_address: newOrigin || edRotaOrigemOriginal,
        destination_address: newDest || edRotaDestinoOriginal,
        is_active: edRotaAtiva,
      });
    }
    setEditarRotaOpen(false);
    fetchDestinos().then(setDestinosData);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const selectField = (label: string, placeholder: string, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4, minWidth: 180 } },
      React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px', cursor: 'pointer',
        },
      },
        React.createElement('span', { style: { fontSize: 14, color: value ? '#0d0d0d' : '#999', ...font } }, value || placeholder),
        React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
          React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }))));

  const filtroRadioCircle = (selected: boolean) =>
    React.createElement('div', {
      style: {
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? '#0d0d0d' : '#c4c4c4'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      },
    }, selected ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null);

  const filtroDateField = (subLabel: string, value: string, placeholder: string, setValue: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, width: '100%' } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, subLabel),
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', height: 44, background: '#f1f1f1',
          borderRadius: 8, paddingLeft: 16, position: 'relative' as const, width: '100%', boxSizing: 'border-box' as const,
        },
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', flexShrink: 0 } }, calendarIconSvg),
        React.createElement('div', { style: { flex: 1, position: 'relative' as const, minWidth: 0, paddingLeft: 16, height: '100%', display: 'flex', alignItems: 'center' } },
          !value ? React.createElement('span', {
            style: {
              position: 'absolute' as const, left: 16, top: '50%', transform: 'translateY(-50%)',
              fontSize: 16, color: '#767676', ...font, pointerEvents: 'none' as const,
            },
          }, placeholder) : null,
          React.createElement('input', {
            type: 'date', value,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
            style: {
              width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent',
              fontSize: 16, color: value ? '#0d0d0d' : 'transparent', ...font,
              position: 'relative' as const, zIndex: 1,
            },
          }))));

  const filtroTextField = (subLabel: string, value: string, placeholder: string, setValue: (v: string) => void) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, width: '100%' } },
      React.createElement('div', { style: { minHeight: 40, display: 'flex', alignItems: 'center' } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, subLabel)),
      React.createElement('input', {
        type: 'text', value, placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
        style: {
          width: '100%', height: 44, boxSizing: 'border-box' as const,
          background: '#f1f1f1', border: 'none', borderRadius: 8,
          padding: '0 16px', fontSize: 16, color: '#0d0d0d', ...font,
        },
      }));

  const filtroRadioRow = (optLabel: string, optValue: NonNullable<FiltroDatasIncluidas>) =>
    React.createElement('button', {
      type: 'button',
      onClick: () => setFiltroDatasIncluidas(filtroDatasIncluidas === optValue ? null : optValue),
      style: {
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px 10px 0',
        borderRadius: 6, textAlign: 'left' as const,
      },
    }, filtroRadioCircle(filtroDatasIncluidas === optValue),
    React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, optLabel));

  const filtroSectionTitle = (t: string) =>
    React.createElement('p', {
      style: {
        fontSize: 18, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
      },
    }, t);

  const modalCloseBtn = (onClose: () => void) =>
    React.createElement('button', {
      type: 'button', onClick: onClose,
      style: {
        width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      },
      'aria-label': 'Fechar',
    }, closeSvg);

  const toggleSwitchEl = (active: boolean, onToggle: () => void) =>
    React.createElement('div', {
      onClick: onToggle,
      style: {
        width: 48, height: 28, borderRadius: 14, background: active ? '#0d0d0d' : '#d9d9d9',
        position: 'relative' as const, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
      },
    },
      React.createElement('div', {
        style: {
          width: 22, height: 22, borderRadius: '50%', background: '#fff',
          position: 'absolute' as const, top: 3, left: active ? 23 : 3, transition: 'left 0.2s',
        },
      }));

  // ── Search row ────────────────────────────────────────────────────────────

  const searchRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' as const },
  },
    React.createElement('button', {
      type: 'button', onClick: () => setCriarRotaOpen(true),
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, plusSvg, 'Nova rota'),
    React.createElement('div', { style: { position: 'relative' as const } },
      React.createElement('button', {
        type: 'button', onClick: () => setEstadosDropdownOpen(!estadosDropdownOpen),
        style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px',
          background: '#fff', border: '1px solid #e2e2e2', borderRadius: 999,
          fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
        },
      }, estadoSelected, chevronDownSvg),
      estadosDropdownOpen ? React.createElement('div', {
        style: {
          position: 'absolute' as const, top: 52, left: 0, background: '#fff', borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)', minWidth: 240, maxHeight: 300,
          overflowY: 'auto' as const, zIndex: 50,
        },
      },
        ...['Todos os estados', 'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'].map((uf, i, arr) =>
          React.createElement('button', {
            key: uf, type: 'button',
            onClick: () => { setEstadoSelected(uf); setEstadosDropdownOpen(false); },
            style: {
              display: 'block', width: '100%', padding: '14px 20px', background: 'none',
              borderTop: 'none', borderRight: 'none', borderLeft: 'none',
              borderBottom: i < arr.length - 1 ? '1px solid #f1f1f1' : 'none',
              fontSize: 14, fontWeight: estadoSelected === uf ? 600 : 400,
              color: estadoSelected === uf ? '#0d0d0d' : '#767676', cursor: 'pointer', textAlign: 'left' as const, ...font,
            },
          }, uf))) : null),
    React.createElement('button', {
      type: 'button', onClick: () => setFiltroPaginaOpen(true),
      'data-testid': 'destinos-open-page-filter',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font, whiteSpace: 'nowrap' as const,
      },
    }, filterIconSvg, 'Filtro'));

  // ── KPI row ────────────────────────────────────────────────────────────────

  const kpiRow = React.createElement('div', {
    style: { display: 'flex', gap: 20, width: '100%', flexWrap: 'wrap' as const },
  },
    ...kpiCards.map((card) =>
      React.createElement('div', { key: card.title, style: s.metricCard, 'data-testid': card.testId },
        React.createElement('p', { style: s.metricTitle }, card.title),
        React.createElement('p', { style: { ...s.metricValue, marginTop: 8 } }, String(card.value)))));

  // ── Bar chart ─────────────────────────────────────────────────────────────

  const chartCard = React.createElement('div', { style: s.chartCard },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Top 8 Rotas por Atividades'),
    React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Rotas com maior número de viagens no período filtrado'),
    React.createElement('div', { style: { width: '100%', height: 320 } },
      React.createElement(ResponsiveContainer, { width: '100%', height: '100%' },
        React.createElement(BarChart, {
          data: barData,
          layout: 'vertical',
          margin: { left: 20, right: 20, top: 8, bottom: 8 },
        },
          React.createElement(XAxis, {
            type: 'number',
            tick: { fontSize: 12, fontFamily: 'Inter, sans-serif' },
            axisLine: false,
            tickLine: false,
          }),
          React.createElement(YAxis, {
            type: 'category',
            dataKey: 'name',
            tick: { fontSize: 11, fontFamily: 'Inter, sans-serif' },
            width: 160,
            axisLine: false,
            tickLine: false,
          }),
          React.createElement(RechTooltip, { content: barTooltipContent }),
          React.createElement(Bar, {
            dataKey: 'viagens',
            fill: '#0d0d0d',
            radius: [0, 6, 6, 0],
            maxBarSize: 32,
          })))));

  // ── Table section ─────────────────────────────────────────────────────────

  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 8px' };

  const tableToolbar = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 80, padding: '20px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0',
    },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font } }, 'Lista de destinos'),
    React.createElement('button', {
      type: 'button', onClick: () => setFiltroTabelaOpen(true),
      'data-testid': 'destinos-open-table-filter',
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
    const st = statusStyles[row.status];
    const rowKey = `${row.origem}|||${row.destino}`;
    return React.createElement('div', {
      key: rowKey,
      'data-testid': 'destino-table-row',
      style: {
        display: 'flex', height: 64, alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid #d9d9d9', background: '#f6f6f6',
      },
    },
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, fontWeight: 500 } }, row.origem),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, fontWeight: 500 } }, row.destino),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth } }, String(row.totalAtividades)),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, row.dataCriacao),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' as const,
            background: st.bg, color: st.color, ...font,
          },
        }, row.status)),
      React.createElement('div', {
        style: { flex: tableCols[5].flex, minWidth: tableCols[5].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
      },
        React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar',
          onClick: () => { setVizDestino(row); setVizDestinoOpen(true); },
        }, eyeActionSvg),
        React.createElement('button', {
          type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar',
          onClick: () => {
            const origemParts = row.origem.split(' - ');
            const destParts = row.destino.split(' - ');
            setEdCidadeOrigem(origemParts[0] ?? row.origem);
            setEdEstadoOrigem(origemParts[1] ?? '');
            setEdCidadeDestino(destParts[0] ?? row.destino);
            setEdEstadoDestino(destParts[1] ?? '');
            setEdRotaAtiva(row.status === 'Ativo');
            setEdRotaOrigemOriginal(row.origem);
            setEdRotaDestinoOriginal(row.destino);
            setEditarRotaOpen(true);
          },
        }, pencilActionSvg)));
  });

  const tableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
      tableToolbar,
      React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
        tableHeader,
        ...tableRowEls)));

  // ── Criar rota modal ──────────────────────────────────────────────────────

  const criarRotaModal = criarRotaOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    onClick: () => setCriarRotaOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, padding: '28px 32px', display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,.15)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Criar rota'),
        React.createElement('button', {
          type: 'button', onClick: () => setCriarRotaOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        selectField('Estado da origem', 'Selecione um estado', crEstadoOrigem, setCrEstadoOrigem),
        selectField('Cidade de origem', 'Selecione uma cidade', crCidadeOrigem, setCrCidadeOrigem)),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        selectField('Estado do destino', 'Selecione um estado', crEstadoDestino, setCrEstadoDestino),
        selectField('Cidade de destino', 'Selecione uma cidade', crCidadeDestino, setCrCidadeDestino)),
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', ...font } }, 'Manter rota ativa'),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', lineHeight: 1.5, ...font } }, 'Ao manter a rota ativa, você garante que ela seja exibida e possa ser utilizada por todos os usuários da plataforma.')),
        toggleSwitchEl(crRotaAtiva, () => setCrRotaAtiva(!crRotaAtiva))),
      React.createElement('button', {
        type: 'button',
        onClick: async () => {
          const origin = `${crCidadeOrigem}${crEstadoOrigem ? ' - ' + crEstadoOrigem : ''}`.trim();
          const dest = `${crCidadeDestino}${crEstadoDestino ? ' - ' + crEstadoDestino : ''}`.trim();
          if (origin && dest) {
            await createTakemeRoute({ origin_address: origin, destination_address: dest, price_per_person_cents: 0 });
            const items = await fetchDestinos();
            setDestinosData(items);
          }
          setCriarRotaOpen(false);
        },
        style: { height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
      }, 'Salvar'),
      React.createElement('button', {
        type: 'button', onClick: () => setCriarRotaOpen(false),
        style: { height: 40, background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font },
      }, 'Cancelar'))) : null;

  // ── Editar rota modal ─────────────────────────────────────────────────────

  const editarRotaModal = editarRotaOpen ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    onClick: () => setEditarRotaOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, padding: '28px 32px', display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,.15)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Editar rota'),
        React.createElement('button', {
          type: 'button', onClick: () => setEditarRotaOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        selectField('Estado da origem', 'Selecione', edEstadoOrigem, setEdEstadoOrigem),
        selectField('Cidade de origem', 'Selecione', edCidadeOrigem, setEdCidadeOrigem)),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        selectField('Estado do destino', 'Selecione', edEstadoDestino, setEdEstadoDestino),
        selectField('Cidade de destino', 'Selecione', edCidadeDestino, setEdCidadeDestino)),
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', ...font } }, 'Manter rota ativa'),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', lineHeight: 1.5, ...font } }, 'Ao manter a rota ativa, você garante que ela seja exibida e possa ser utilizada por todos os usuários da plataforma.')),
        toggleSwitchEl(edRotaAtiva, () => setEdRotaAtiva(!edRotaAtiva))),
      React.createElement('button', {
        type: 'button', onClick: handleSalvarEditar,
        style: { height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
      }, 'Salvar'),
      React.createElement('button', {
        type: 'button', onClick: () => setEditarRotaOpen(false),
        style: { height: 40, background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font },
      }, 'Cancelar'))) : null;

  // ── Visualizar destino modal ──────────────────────────────────────────────

  const vizReadField = (label: string, value: string) =>
    React.createElement('div', { style: { flex: '1 1 0', minWidth: 180, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, label),
      React.createElement('div', { style: { height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font } }, value));

  const vizDestinoModal = vizDestinoOpen && vizDestino ? React.createElement('div', {
    style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    onClick: () => setVizDestinoOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, padding: '28px 32px', display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,.15)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Detalhes do destino'),
        React.createElement('button', {
          type: 'button', onClick: () => setVizDestinoOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, closeSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        vizReadField('Origem', vizDestino.origem),
        vizReadField('Destino', vizDestino.destino)),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        vizReadField('Total de atividades', String(vizDestino.totalAtividades)),
        vizReadField('Data de criação', vizDestino.dataCriacao)),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Status:'),
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 14px', borderRadius: 999,
            fontSize: 13, fontWeight: 700,
            background: statusStyles[vizDestino.status].bg,
            color: statusStyles[vizDestino.status].color, ...font,
          },
        }, vizDestino.status)),
      React.createElement('button', {
        type: 'button', onClick: () => setVizDestinoOpen(false),
        style: { height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
      }, 'Fechar'))) : null;

  // ── Filtro da página modal ────────────────────────────────────────────────

  const filtroModal = filtroPaginaOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 24,
    },
    onClick: () => setFiltroPaginaOpen(false),
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': 'destinos-filtro-pagina-titulo',
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: 'min(90vh, 900px)',
        overflowY: 'auto' as const, boxShadow: '6px 6px 12px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column' as const, gap: 24, padding: '24px 0', boxSizing: 'border-box' as const,
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', {
        style: {
          borderBottom: '1px solid #e2e2e2', paddingBottom: 24,
          display: 'flex', flexDirection: 'column' as const, alignItems: 'center', width: '100%',
        },
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 16px', boxSizing: 'border-box' as const } },
          React.createElement('h2', { id: 'destinos-filtro-pagina-titulo', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro'),
          modalCloseBtn(() => setFiltroPaginaOpen(false)))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, padding: '0 24px', width: '100%', boxSizing: 'border-box' as const } },
        filtroSectionTitle('Data da atividade'),
        filtroDateField('Data inicial', filtroDataInicial, '01 de setembro', setFiltroDataInicial),
        filtroDateField('Data final', filtroDataFinal, '31 de setembro', setFiltroDataFinal)),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, padding: '0 24px', width: '100%', boxSizing: 'border-box' as const } },
        filtroSectionTitle('Datas incluídas'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, width: '100%' } },
          filtroRadioRow('Somente passadas', 'passadas'),
          filtroRadioRow('Passadas e futuras', 'ambas'),
          filtroRadioRow('Somente futuras', 'futuras'))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, padding: '0 24px', width: '100%', boxSizing: 'border-box' as const } },
        filtroSectionTitle('Status da viagem'),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' } },
          fChip('Todos', filtroStatusViagem === 'todos', () => setFiltroStatusViagem('todos')),
          fChip('Em andamento', filtroStatusViagem === 'em_andamento', () => setFiltroStatusViagem('em_andamento')),
          fChip('Agendadas', filtroStatusViagem === 'agendadas', () => setFiltroStatusViagem('agendadas')),
          fChip('Concluídas', filtroStatusViagem === 'concluidas', () => setFiltroStatusViagem('concluidas')),
          fChip('Canceladas', filtroStatusViagem === 'canceladas', () => setFiltroStatusViagem('canceladas')))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, padding: '0 24px', width: '100%', boxSizing: 'border-box' as const } },
        filtroSectionTitle('Categoria'),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' } },
          fChip('Todos', filtroCategoria === 'todos', () => setFiltroCategoria('todos')),
          fChip('Take Me', filtroCategoria === 'take_me', () => setFiltroCategoria('take_me')),
          fChip('Motorista parceiro', filtroCategoria === 'motorista_parceiro', () => setFiltroCategoria('motorista_parceiro')))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, padding: '0 24px', width: '100%', boxSizing: 'border-box' as const } },
        React.createElement('button', {
          type: 'button',
          onClick: () => {
            setFiltroDataInicial('');
            setFiltroDataFinal('');
            setFiltroDatasIncluidas(null);
            setFiltroStatusViagem('todos');
            setFiltroCategoria('todos');
          },
          style: {
            width: '100%', height: 48, borderRadius: 8, border: 'none', background: 'transparent',
            color: '#b53838', fontSize: 16, fontWeight: 500, cursor: 'pointer', ...font,
          },
        }, 'Resetar filtros'),
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroPaginaOpen(false),
          style: {
            width: '100%', height: 48, borderRadius: 8, border: 'none', background: '#0d0d0d', color: '#fff',
            fontSize: 16, fontWeight: 500, cursor: 'pointer', ...font,
          },
        }, 'Aplicar filtro')))) : null;

  // ── Filtro da tabela modal ────────────────────────────────────────────────

  const filtroTabelaModal = filtroTabelaOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, padding: 24,
    },
    onClick: () => setFiltroTabelaOpen(false),
    role: 'dialog' as const,
    'aria-modal': true,
    'aria-labelledby': 'destinos-filtro-tabela-titulo',
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: 'min(90vh, 900px)',
        overflowY: 'auto' as const, boxShadow: '6px 6px 12px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column' as const, gap: 24, padding: '24px 0', boxSizing: 'border-box' as const,
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', {
        style: {
          borderBottom: '1px solid #e2e2e2', paddingBottom: 24,
          display: 'flex', flexDirection: 'column' as const, alignItems: 'center', width: '100%',
        },
      },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 16px', boxSizing: 'border-box' as const } },
          React.createElement('h2', { id: 'destinos-filtro-tabela-titulo', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Filtro da tabela'),
          modalCloseBtn(() => setFiltroTabelaOpen(false)))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, padding: '0 24px', width: '100%', boxSizing: 'border-box' as const } },
        filtroTextField('Origem', tabelaFiltroOrigem, 'Ex: São Paulo, SP', setTabelaFiltroOrigem),
        filtroTextField('Destino', tabelaFiltroDestino, 'Ex: São Luis, MA', setTabelaFiltroDestino),
        filtroTextField('Hora do embarque', tabelaFiltroHoraEmbarque, 'Ex: 09:00', setTabelaFiltroHoraEmbarque),
        filtroTextField('Hora de chegada', tabelaFiltroHoraChegada, 'Ex: 12:00', setTabelaFiltroHoraChegada),
        filtroDateField('Data inicial', tabelaFiltroDataInicial, '01 de setembro', setTabelaFiltroDataInicial)),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, padding: '0 24px', width: '100%', boxSizing: 'border-box' as const } },
        filtroSectionTitle('Status da viagem'),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' } },
          fChip('Todos', tabelaFiltroStatusViagem === 'todos', () => setTabelaFiltroStatusViagem('todos')),
          fChip('Em andamento', tabelaFiltroStatusViagem === 'em_andamento', () => setTabelaFiltroStatusViagem('em_andamento')),
          fChip('Agendadas', tabelaFiltroStatusViagem === 'agendadas', () => setTabelaFiltroStatusViagem('agendadas')),
          fChip('Concluídas', tabelaFiltroStatusViagem === 'concluidas', () => setTabelaFiltroStatusViagem('concluidas')),
          fChip('Canceladas', tabelaFiltroStatusViagem === 'canceladas', () => setTabelaFiltroStatusViagem('canceladas')))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, padding: '0 24px', width: '100%', boxSizing: 'border-box' as const } },
        filtroSectionTitle('Categoria'),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' } },
          fChip('Todos', tabelaFiltroCategoria === 'todos', () => setTabelaFiltroCategoria('todos')),
          fChip('Take Me', tabelaFiltroCategoria === 'take_me', () => setTabelaFiltroCategoria('take_me')),
          fChip('Motorista parceiro', tabelaFiltroCategoria === 'motorista_parceiro', () => setTabelaFiltroCategoria('motorista_parceiro')))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, padding: '0 24px', width: '100%', boxSizing: 'border-box' as const } },
        React.createElement('button', {
          type: 'button',
          onClick: () => {
            setTabelaFiltroOrigem('');
            setTabelaFiltroDestino('');
            setTabelaFiltroHoraEmbarque('');
            setTabelaFiltroHoraChegada('');
            setTabelaFiltroDataInicial('');
            setTabelaFiltroStatusViagem('todos');
            setTabelaFiltroCategoria('todos');
          },
          style: {
            width: '100%', height: 48, borderRadius: 8, border: 'none', background: 'transparent',
            color: '#b53838', fontSize: 16, fontWeight: 500, cursor: 'pointer', ...font,
          },
        }, 'Resetar filtros'),
        React.createElement('button', {
          type: 'button', onClick: () => setFiltroTabelaOpen(false),
          style: {
            width: '100%', height: 48, borderRadius: 8, border: 'none', background: '#0d0d0d', color: '#fff',
            fontSize: 16, fontWeight: 500, cursor: 'pointer', ...font,
          },
        }, 'Aplicar filtro')))) : null;

  // ── Loading state ─────────────────────────────────────────────────────────

  if (dataLoading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Carregando destinos...'));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Destinos'),
    searchRow,
    kpiRow,
    chartCard,
    tableSection,
    criarRotaModal,
    editarRotaModal,
    vizDestinoModal,
    filtroModal,
    filtroTabelaModal);
}
