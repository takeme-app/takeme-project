/**
 * PagamentosGestaoScreen — Gestão de pagamentos conforme Figma 905-22168.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  filterIconSvg,
} from '../styles/webStyles';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// SVG icons
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const starSvg = React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: '#cba04b', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' }));

const tabs = ['Motorista', 'Encomenda', 'Trecho', 'Preparadores', 'Adicionais', 'Avaliações'] as const;

const avatarColors: Record<string, string> = {
  C: '#4A90D9', J: '#7B61FF', E: '#50C878', M: '#F5A623', D: '#9B59B6',
};

type MotoristaRow = {
  nome: string;
  rating: number;
  numTrechos: string;
  horario: string;
  dataInicio: string;
};

const motoristaRows: MotoristaRow[] = [
  { nome: 'Carlos Silva', rating: 4.4, numTrechos: '193 rotas', horario: '08:00 - 18:00', dataInicio: '12/10/2025' },
  { nome: 'João Porto', rating: 4.2, numTrechos: '149 rotas', horario: '08:00 - 18:00', dataInicio: '09/09/2025' },
  { nome: 'Jorge Silva', rating: 4.1, numTrechos: '156 rotas', horario: '08:00 - 18:00', dataInicio: '05/08/2025' },
  { nome: 'Carlos Silva', rating: 4.1, numTrechos: '151 rotas', horario: '08:00 - 18:00', dataInicio: '02/07/2025' },
  { nome: 'Everton Pereira', rating: 4.5, numTrechos: '161 rotas', horario: '08:00 - 18:00', dataInicio: '03/06/2025' },
  { nome: 'Marcio Pontes', rating: 4.9, numTrechos: '205 rotas', horario: '08:00 - 18:00', dataInicio: '01/06/2025' },
  { nome: 'Danilo Santos', rating: 4.3, numTrechos: '183 rotas', horario: '08:00 - 18:00', dataInicio: '10/04/2025' },
];

const tableCols = [
  { label: 'Motorista', flex: '1 1 25%', minWidth: 180 },
  { label: 'Número de Trechos', flex: '0 0 140px', minWidth: 140 },
  { label: 'Horário de\nfuncionamento', flex: '0 0 140px', minWidth: 140 },
  { label: 'Data de início\nna plataforma', flex: '0 0 130px', minWidth: 130 },
  { label: 'Visualizar/Editar', flex: '0 0 100px', minWidth: 100 },
];

const metricsMotorista = [
  { title: 'Média de ganho por trecho', value: '18.5%', suffix: ' de lucro', pct: '+12.5%', negative: false },
  { title: 'Média de ganho fixo por trecho', value: 'R$ 45,80', suffix: ' por rota', pct: '+8.2%', negative: false },
  { title: 'Média de ganho por trecho pelo administrador', value: '12.3%', suffix: ' de lucro', pct: '-3.1%', negative: true },
];

const metricsEncomenda = [
  { title: 'Média de valor\nde encomenda pequena', value: 'R$ 45,00', suffix: '', pct: '', negative: false },
  { title: 'Média de valor\nde encomenda média', value: 'R$ 75,00', suffix: '', pct: '', negative: false },
  { title: 'Média de valor\nde encomenda grande', value: 'R$ 45,00', suffix: '', pct: '', negative: false },
];

type EncomendaTrechoRow = {
  codigo: string;
  origem: string;
  destino: string;
  tipo: string;
  valor: string;
};

const encomendaTrechoRows: EncomendaTrechoRow[] = [
  { codigo: '#98712', origem: 'São Paulo - SP', destino: 'Campinas - SP', tipo: 'Média', valor: 'R$ 75.00' },
  { codigo: '#98713', origem: 'Recife - PE', destino: 'João Pessoa - PB', tipo: 'Grande', valor: 'R$ 120.00' },
  { codigo: '#98714', origem: 'Brasília - DF', destino: 'São Paulo - SP', tipo: 'Pequena', valor: 'R$ 45.00' },
  { codigo: '#98715', origem: 'Brasília - DF', destino: 'Campinas - SP', tipo: 'Média', valor: 'R$ 72.00' },
  { codigo: '#98716', origem: 'Porto Alegre - RS', destino: 'Curitiba - PR', tipo: 'Grande', valor: 'R$ 118.00' },
];

const encomendaCols = [
  { label: 'Código (ID)', flex: '0 0 110px', minWidth: 110 },
  { label: 'Origem', flex: '1 1 20%', minWidth: 140 },
  { label: 'Destino', flex: '1 1 20%', minWidth: 140 },
  { label: 'Tipo', flex: '0 0 100px', minWidth: 100 },
  { label: 'Valor', flex: '0 0 110px', minWidth: 110 },
  { label: 'Editar/Remover', flex: '0 0 110px', minWidth: 110 },
];

const metricsTrecho = [
  { title: 'Média de valor por trecho', value: 'R$ 85,00', suffix: ' por trajeto', pct: '+4.3%', negative: false },
];

const metricsPreparadores = [
  { title: 'Média de ganho por trecho', value: '12.5%', suffix: ' de lucro', pct: '+8.5%', negative: false },
  { title: 'Média de ganho fixo por trecho', value: 'R$ 41,40', suffix: ' por rota', pct: '+7.5%', negative: false },
  { title: 'Média de ganho por trecho pelo administrador', value: '11.5%', suffix: ' de lucro', pct: '-2.9%', negative: true },
];

type PreparadorGestaoRow = {
  nome: string;
  rating: number;
  origem: string;
  destino: string;
  numCidades: number;
  horario: string;
};

const preparadorGestaoRows: PreparadorGestaoRow[] = [
  { nome: 'Everton Pereira', rating: 4.5, origem: 'São Paulo - SP', destino: 'Brasília - DF', numCidades: 7, horario: '08:00 - 18:00' },
  { nome: 'Jorge Silva', rating: 4.3, origem: 'João Pessoa - PB', destino: 'São Paulo - SP', numCidades: 12, horario: '09:00 - 19:00' },
  { nome: 'João Porto', rating: 4.1, origem: 'São Paulo - SP', destino: 'Curitiba - PR', numCidades: 8, horario: '10:00 - 20:00' },
  { nome: 'Carlos Magno', rating: 4.2, origem: 'Recife - PE', destino: 'João Pessoa - PB', numCidades: 10, horario: '08:00 - 18:00' },
  { nome: 'Eduardo Silva', rating: 4.3, origem: 'Brasília - DF', destino: 'Curitiba - PR', numCidades: 9, horario: '10:00 - 20:00' },
  { nome: 'Danilo Santos', rating: 4.1, origem: 'São Paulo - SP', destino: 'Curitiba - PR', numCidades: 7, horario: '08:00 - 18:00' },
];

const preparadorGestaoCols = [
  { label: 'Preparador', flex: '1 1 22%', minWidth: 170 },
  { label: 'Origem', flex: '1 1 16%', minWidth: 130 },
  { label: 'Destino', flex: '1 1 16%', minWidth: 130 },
  { label: 'Número de cidades', flex: '0 0 130px', minWidth: 130 },
  { label: 'Horário de\nfuncionamento', flex: '0 0 130px', minWidth: 130 },
  { label: 'Visualizar', flex: '0 0 80px', minWidth: 80 },
];

const metricsAdicionais = [
  { title: 'Média de valor de adicionais', value: 'R$ 85,00', suffix: ' por trajeto', pct: '', negative: false },
];

// Special card for Adicionais: "Adicionais automáticos vs. manuais" and "Total de adicionais ativos"
// These are rendered inline in the tab content, not via the generic metrics renderer.

type AdicionalRow = {
  codigo: string;
  nome: string;
  tipo: string;
  unidade: string;
  valor: string;
  inclusao: string;
};

const adicionalRows: AdicionalRow[] = [
  { codigo: '#98712', nome: 'Pedágio SP - Campinas', tipo: 'Viagem', unidade: 'KM', valor: 'R$ 12,50', inclusao: 'Automática' },
  { codigo: '#98712', nome: 'Taxa de embarque', tipo: 'Excursão', unidade: 'Ida', valor: 'R$ 25,00', inclusao: 'Manual' },
  { codigo: '#98712', nome: 'Combustível adicional', tipo: 'Encomenda', unidade: 'KM', valor: 'R$ 38,00', inclusao: 'Automática' },
  { codigo: '#98712', nome: 'Lavagem interna', tipo: 'Viagem', unidade: 'Hora', valor: 'R$ 45,00', inclusao: 'Manual' },
  { codigo: '#98712', nome: 'Taxa de entrega expressa', tipo: 'Encomenda', unidade: 'Ida', valor: 'R$ 60,00', inclusao: 'Automática' },
];

const adicionalCols = [
  { label: 'Código trecho', flex: '0 0 110px', minWidth: 110 },
  { label: 'Nome', flex: '1 1 20%', minWidth: 160 },
  { label: 'Tipo', flex: '0 0 100px', minWidth: 100 },
  { label: 'Unidade', flex: '0 0 80px', minWidth: 80 },
  { label: 'Valor', flex: '0 0 100px', minWidth: 100 },
  { label: 'Inclusão', flex: '0 0 110px', minWidth: 110 },
  { label: 'Editar/Remover', flex: '0 0 110px', minWidth: 110 },
];

type AvaliacaoItem = {
  nome: string;
  data: string;
  stars: number;
  comentario: string;
  tipo: string;
};

const avaliacoes: AvaliacaoItem[] = [
  { nome: 'Maria Santos', data: '15/01/2025', stars: 5, comentario: 'Excelente serviço! Motorista muito educado e pontual.', tipo: 'Motorista' },
  { nome: 'João Santos', data: '14/01/2025', stars: 4, comentario: 'Bom atendimento, mas poderia ser mais rápido na preparação.', tipo: 'Preparador de excursões' },
  { nome: 'Ana Paula', data: '11/01/2025', stars: 5, comentario: 'Perfeito! Encomenda muito bem embalada e organizada.', tipo: 'Preparador de encomendas' },
  { nome: 'Carlos Pereira', data: '11/01/2025', stars: 3, comentario: 'Serviço ok, mas o ônibus estava um pouco sujo.', tipo: 'Motorista' },
];

const trechoRows: EncomendaTrechoRow[] = [
  { codigo: '#98712', origem: 'São Paulo - SP', destino: 'Campinas - SP', tipo: 'Viagem', valor: 'R$ 75.00' },
  { codigo: '#98713', origem: 'Recife - PE', destino: 'João Pessoa - PB', tipo: 'Excursão', valor: 'R$ 120.00' },
  { codigo: '#98714', origem: 'Brasília - DF', destino: 'São Paulo - SP', tipo: 'Excursão', valor: 'R$ 45.00' },
  { codigo: '#98715', origem: 'Brasília - DF', destino: 'Campinas - SP', tipo: 'Viagem', valor: 'R$ 72.00' },
  { codigo: '#98716', origem: 'Porto Alegre - RS', destino: 'Curitiba - PR', tipo: 'Viagem', valor: 'R$ 118.00' },
];

const s = {
  tabsRow: { display: 'flex', gap: 0, borderBottom: '1px solid #e2e2e2', marginBottom: 24 } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '12px 24px', fontSize: 16, fontWeight: active ? 600 : 400,
    color: active ? '#0d0d0d' : '#767676',
    borderBottom: active ? '2px solid #0d0d0d' : '2px solid transparent', marginBottom: -1,
    background: 'none', border: 'none', cursor: 'pointer', ...font,
  } as React.CSSProperties),
  metricCard: {
    flex: '1 1 0', minWidth: 220, background: '#f6f6f6', borderRadius: 16,
    padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
};

export default function PagamentosGestaoScreen() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Motorista');

  // ── Breadcrumb ────────────────────────────────────────────────────────
  const breadcrumb = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#767676', ...font },
  },
    React.createElement('span', null, 'Pagamentos'),
    React.createElement('span', null, '>'),
    React.createElement('span', null, 'Percificação e porcentagem'),
    React.createElement('span', null, '>'),
    React.createElement('span', { style: { fontWeight: 600, color: '#0d0d0d' } }, activeTab));

  // ── Header row ────────────────────────────────────────────────────────
  const headerRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' as const, gap: 12 },
  },
    React.createElement('button', {
      type: 'button', onClick: () => navigate('/pagamentos'),
      style: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: '#0d0d0d', padding: 0, ...font },
    },
      React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
        React.createElement('path', { d: 'M19 12H5M12 19l-7-7 7-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
      'Voltar'),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      React.createElement('button', {
        type: 'button',
        style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
          background: '#f1f1f1', border: 'none', borderRadius: 999,
          fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
        },
      }, filterIconSvg, 'Filtro'),
      React.createElement('button', {
        type: 'button',
        style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
          background: '#fff', border: '1px solid #e2e2e2', borderRadius: 999,
          fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
        },
      },
        React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
          React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
          React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
        'Editar forma de pagamento'),
      React.createElement('button', {
        type: 'button',
        style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
          background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 999,
          fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
        },
      },
        React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
          React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
        'Criar novo trecho')));

  // ── Tabs ───────────────────────────────────────────────────────────────
  const tabsEl = React.createElement('div', { style: s.tabsRow },
    ...tabs.map((t) => React.createElement('button', {
      key: t, type: 'button', onClick: () => setActiveTab(t), style: s.tab(activeTab === t),
    }, t)));

  // ── Metrics ───────────────────────────────────────────────────────────
  const currentMetrics = activeTab === 'Encomenda' ? metricsEncomenda : activeTab === 'Trecho' ? metricsTrecho : activeTab === 'Preparadores' ? metricsPreparadores : metricsMotorista;
  const metricCards = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    ...currentMetrics.map((m) =>
      React.createElement('div', { key: m.title, style: { ...s.metricCard, whiteSpace: 'pre-line' as const } },
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, whiteSpace: 'pre-line' as const, ...font } }, m.title),
        m.pct ? React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: m.negative ? '#b53838' : '#22c55e', marginTop: 4, ...font } }, m.pct) : null,
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 } },
          React.createElement('span', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', ...font } }, m.value),
          m.suffix ? React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, m.suffix) : null))));

  // ── Table ─────────────────────────────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 6px' };

  const tableToolbar = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 64, padding: '16px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0',
    },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Lista de motoristas'));

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

  const tableRowEls = motoristaRows.map((row, idx) => {
    const initial = row.nome.charAt(0);
    const avatarBg = avatarColors[initial] || '#999';
    return React.createElement('div', {
      key: idx,
      style: {
        display: 'flex', minHeight: 64, alignItems: 'center', padding: '8px 16px',
        borderBottom: '1px solid #d9d9d9', background: '#f6f6f6',
      },
    },
      // Motorista (avatar + name + rating)
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, gap: 10 } },
        React.createElement('div', {
          style: {
            width: 40, height: 40, borderRadius: '50%', background: avatarBg, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, React.createElement('span', { style: { color: '#fff', fontSize: 16, fontWeight: 600, ...font } }, initial)),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
          React.createElement('span', { style: { fontWeight: 500, fontSize: 14, ...font } }, row.nome),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 3 } },
            starSvg,
            React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, row.rating.toFixed(1))))),
      // Número de Trechos
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth } }, row.numTrechos),
      // Horário
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth } }, row.horario),
      // Data início
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, row.dataInicio),
      // Visualizar
      React.createElement('div', {
        style: { flex: tableCols[4].flex, minWidth: tableCols[4].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'center' },
      },
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar' }, eyeActionSvg)));
  });

  const tableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
      tableToolbar,
      React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
        tableHeader,
        ...tableRowEls)));

  // ── Encomenda table ────────────────────────────────────────────────────
  const pencilSvg = React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const trashSvg = React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  const encTableToolbar = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, padding: '16px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0' },
  }, React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Lista de trechos de encomendas'));

  const encTableHeader = React.createElement('div', {
    style: { display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9', padding: '0 16px', alignItems: 'center' },
  }, ...encomendaCols.map((c) => React.createElement('div', {
    key: c.label, style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 6px', display: 'flex', alignItems: 'center', height: '100%' },
  }, c.label)));

  const encTableRowEls = encomendaTrechoRows.map((row, idx) =>
    React.createElement('div', {
      key: idx, style: { display: 'flex', minHeight: 56, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #d9d9d9', background: '#f6f6f6' },
    },
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[0].flex, minWidth: encomendaCols[0].minWidth, fontWeight: 500 } }, row.codigo),
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[1].flex, minWidth: encomendaCols[1].minWidth } }, row.origem),
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[2].flex, minWidth: encomendaCols[2].minWidth } }, row.destino),
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[3].flex, minWidth: encomendaCols[3].minWidth, fontWeight: 500 } }, row.tipo),
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[4].flex, minWidth: encomendaCols[4].minWidth, fontWeight: 600 } }, row.valor),
      React.createElement('div', { style: { flex: encomendaCols[5].flex, minWidth: encomendaCols[5].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 } },
        React.createElement('button', { type: 'button', style: { ...webStyles.viagensActionBtn }, 'aria-label': 'Editar' }, pencilSvg),
        React.createElement('button', { type: 'button', style: { ...webStyles.viagensActionBtn }, 'aria-label': 'Remover' }, trashSvg))));

  const encTableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  }, React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
    encTableToolbar,
    React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } }, encTableHeader, ...encTableRowEls)));

  // ── Trecho table (reuses encomenda cols but with trechoRows) ────────
  const trechoTableToolbar = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, padding: '16px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0' },
  }, React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Lista de trechos de encomendas'));

  const trechoTableRowEls = trechoRows.map((row, idx) =>
    React.createElement('div', {
      key: idx, style: { display: 'flex', minHeight: 56, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #d9d9d9', background: '#f6f6f6' },
    },
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[0].flex, minWidth: encomendaCols[0].minWidth, fontWeight: 500 } }, row.codigo),
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[1].flex, minWidth: encomendaCols[1].minWidth } }, row.origem),
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[2].flex, minWidth: encomendaCols[2].minWidth } }, row.destino),
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[3].flex, minWidth: encomendaCols[3].minWidth, fontWeight: 500 } }, row.tipo),
      React.createElement('div', { style: { ...cellBase, flex: encomendaCols[4].flex, minWidth: encomendaCols[4].minWidth, fontWeight: 600 } }, row.valor),
      React.createElement('div', { style: { flex: encomendaCols[5].flex, minWidth: encomendaCols[5].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 } },
        React.createElement('button', { type: 'button', style: { ...webStyles.viagensActionBtn }, 'aria-label': 'Editar' }, pencilSvg),
        React.createElement('button', { type: 'button', style: { ...webStyles.viagensActionBtn }, 'aria-label': 'Remover' }, trashSvg))));

  const trechoTableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  }, React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
    trechoTableToolbar,
    React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } }, encTableHeader, ...trechoTableRowEls)));

  // ── Preparadores table ─────────────────────────────────────────────────
  const prepGestaoToolbar = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, padding: '16px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0' },
  }, React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Lista de preparadores'));

  const prepGestaoHeader = React.createElement('div', {
    style: { display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9', padding: '0 16px', alignItems: 'center' },
  }, ...preparadorGestaoCols.map((c) => React.createElement('div', {
    key: c.label, style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 6px', display: 'flex', alignItems: 'center', height: '100%', whiteSpace: 'pre-line' as const },
  }, c.label)));

  const prepGestaoRowEls = preparadorGestaoRows.map((row, idx) => {
    const initial = row.nome.charAt(0);
    const avatarBg = avatarColors[initial] || '#999';
    return React.createElement('div', {
      key: idx, style: { display: 'flex', minHeight: 64, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #d9d9d9', background: '#f6f6f6' },
    },
      React.createElement('div', { style: { ...cellBase, flex: preparadorGestaoCols[0].flex, minWidth: preparadorGestaoCols[0].minWidth, gap: 10 } },
        React.createElement('div', { style: { width: 40, height: 40, borderRadius: '50%', background: avatarBg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          React.createElement('span', { style: { color: '#fff', fontSize: 16, fontWeight: 600, ...font } }, initial)),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
          React.createElement('span', { style: { fontWeight: 500, fontSize: 14, ...font } }, row.nome),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 3 } }, starSvg,
            React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, row.rating.toFixed(1))))),
      React.createElement('div', { style: { ...cellBase, flex: preparadorGestaoCols[1].flex, minWidth: preparadorGestaoCols[1].minWidth } }, row.origem),
      React.createElement('div', { style: { ...cellBase, flex: preparadorGestaoCols[2].flex, minWidth: preparadorGestaoCols[2].minWidth } }, row.destino),
      React.createElement('div', { style: { ...cellBase, flex: preparadorGestaoCols[3].flex, minWidth: preparadorGestaoCols[3].minWidth } }, String(row.numCidades)),
      React.createElement('div', { style: { ...cellBase, flex: preparadorGestaoCols[4].flex, minWidth: preparadorGestaoCols[4].minWidth } }, row.horario),
      React.createElement('div', { style: { flex: preparadorGestaoCols[5].flex, minWidth: preparadorGestaoCols[5].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar' }, eyeActionSvg)));
  });

  const prepGestaoSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  }, React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
    prepGestaoToolbar, React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } }, prepGestaoHeader, ...prepGestaoRowEls)));

  // ── Adicionais content ─────────────────────────────────────────────────
  const adicionaisMetricRow = React.createElement('div', {
    style: { display: 'flex', gap: 24, width: '100%', flexWrap: 'wrap' as const },
  },
    // Card 1: Média de valor
    React.createElement('div', { style: { ...s.metricCard } },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Média de valor de adicionais'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 16 } },
        React.createElement('span', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', ...font } }, 'R$ 85,00'),
        React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, ' por trajeto'))),
    // Card 2: Automáticos vs Manuais
    React.createElement('div', { style: { ...s.metricCard } },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Adicionais automáticos vs. manuais'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, marginTop: 16 } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between' } },
          React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, 'Automáticos'),
          React.createElement('span', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', ...font } }, '65%')),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between' } },
          React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, 'Manuais'),
          React.createElement('span', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', ...font } }, '35%')))),
    // Card 3: Total ativos
    React.createElement('div', { style: { ...s.metricCard } },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Total de adicionais ativos'),
      React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, marginTop: 16, ...font } }, '27')));

  const adicToolbar = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, padding: '16px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0' },
  }, React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Custos adicionais'));

  const adicHeader = React.createElement('div', {
    style: { display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9', padding: '0 16px', alignItems: 'center' },
  }, ...adicionalCols.map((c) => React.createElement('div', {
    key: c.label, style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 6px', display: 'flex', alignItems: 'center', height: '100%' },
  }, c.label)));

  const adicRowEls = adicionalRows.map((row, idx) =>
    React.createElement('div', {
      key: idx, style: { display: 'flex', minHeight: 56, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #d9d9d9', background: '#f6f6f6' },
    },
      React.createElement('div', { style: { ...cellBase, flex: adicionalCols[0].flex, minWidth: adicionalCols[0].minWidth, fontWeight: 500 } }, row.codigo),
      React.createElement('div', { style: { ...cellBase, flex: adicionalCols[1].flex, minWidth: adicionalCols[1].minWidth } }, row.nome),
      React.createElement('div', { style: { ...cellBase, flex: adicionalCols[2].flex, minWidth: adicionalCols[2].minWidth } }, row.tipo),
      React.createElement('div', { style: { ...cellBase, flex: adicionalCols[3].flex, minWidth: adicionalCols[3].minWidth } }, row.unidade),
      React.createElement('div', { style: { ...cellBase, flex: adicionalCols[4].flex, minWidth: adicionalCols[4].minWidth, fontWeight: 600 } }, row.valor),
      React.createElement('div', { style: { ...cellBase, flex: adicionalCols[5].flex, minWidth: adicionalCols[5].minWidth } }, row.inclusao),
      React.createElement('div', { style: { flex: adicionalCols[6].flex, minWidth: adicionalCols[6].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 } },
        React.createElement('button', { type: 'button', style: { ...webStyles.viagensActionBtn }, 'aria-label': 'Editar' }, pencilSvg),
        React.createElement('button', { type: 'button', style: { ...webStyles.viagensActionBtn }, 'aria-label': 'Remover' }, trashSvg))));

  const adicSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  }, React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
    adicToolbar, React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } }, adicHeader, ...adicRowEls)));

  // ── Conditional content ───────────────────────────────────────────────
  let tabContent: React.ReactElement[];
  if (activeTab === 'Encomenda') tabContent = [metricCards, encTableSection];
  else if (activeTab === 'Trecho') tabContent = [metricCards, trechoTableSection];
  else if (activeTab === 'Preparadores') tabContent = [metricCards, prepGestaoSection];
  else if (activeTab === 'Adicionais') tabContent = [adicionaisMetricRow, adicSection];
  else if (activeTab === 'Avaliações') {
    const starIcon = (filled: boolean) => React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: filled ? '#cba04b' : 'none', style: { display: 'block' } },
      React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', stroke: '#cba04b', strokeWidth: 1.5, fill: filled ? '#cba04b' : 'none' }));
    const renderStars = (count: number) => React.createElement('div', { style: { display: 'flex', gap: 2 } },
      ...[1, 2, 3, 4, 5].map((i) => React.createElement('span', { key: i }, starIcon(i <= count))));

    const avgCard = React.createElement('div', {
      style: { width: '100%', background: '#f6f6f6', borderRadius: 16, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', boxSizing: 'border-box' as const },
    },
      React.createElement('div', null,
        React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Média geral de avaliação'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 16 } },
          React.createElement('span', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', ...font } }, '4.6'),
          React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: '#22c55e', ...font } }, '+0,3 vs semana anterior'))),
      React.createElement('div', {
        style: { width: 48, height: 48, borderRadius: '50%', background: '#cba04b', display: 'flex', alignItems: 'center', justifyContent: 'center' },
      }, React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: '#fff' },
        React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' }))));

    const reviewList = React.createElement('div', {
      style: { width: '100%', background: '#fff', borderRadius: 16, border: '1px solid #e2e2e2', padding: '24px 28px', display: 'flex', flexDirection: 'column' as const, gap: 0, boxSizing: 'border-box' as const },
    },
      React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, marginBottom: 16, ...font } }, 'Todas as avaliações'),
      ...avaliacoes.map((a, idx) =>
        React.createElement('div', {
          key: idx,
          style: { padding: '16px 0', borderTop: idx > 0 ? '1px solid #e2e2e2' : 'none', display: 'flex', flexDirection: 'column' as const, gap: 12 },
        },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
              React.createElement('div', {
                style: { width: 40, height: 40, borderRadius: '50%', background: avatarColors[a.nome.charAt(0)] || '#999', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
              }, React.createElement('span', { style: { color: '#fff', fontSize: 16, fontWeight: 600, ...font } }, a.nome.charAt(0))),
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
                React.createElement('span', { style: { fontWeight: 600, fontSize: 14, color: '#0d0d0d', ...font } }, a.nome),
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                  React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, a.data),
                  renderStars(a.stars)))),
            React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { cursor: 'pointer' } },
              React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            React.createElement('p', { style: { fontSize: 14, color: '#0d0d0d', margin: 0, ...font } }, a.comentario),
            React.createElement('span', { style: { fontSize: 13, color: '#767676', whiteSpace: 'nowrap' as const, ...font } }, a.tipo)))));

    tabContent = [avgCard, reviewList];
  }
  else tabContent = [metricCards, tableSection];

  return React.createElement(React.Fragment, null,
    breadcrumb, headerRow, tabsEl, ...tabContent);
}
