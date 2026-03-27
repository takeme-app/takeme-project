/**
 * PagamentosScreen — Pagamentos conforme Figma 905-15884.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  webStyles,
  searchIconSvg,
  filterIconSvg,
} from '../styles/webStyles';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// ── Mock data ───────────────────────────────────────────────────────────
const metrics = [
  { title: 'Pagamentos previstos', value: 'R$ 45.230,00', pct: '+12.5%', desc: 'vs período anterior' },
  { title: 'Pagamentos feitos', value: 'R$ 128.450,00', pct: '+8.2%', desc: 'vs período anterior' },
  { title: 'Lucro', value: 'R$ 83.220,00', pct: '-3.1%', desc: 'vs período anterior', negative: true },
];

type PagRow = {
  preparador: string;
  origem: string;
  destino: string;
  dataFinalizacao: string;
  status: 'Em andamento' | 'Agendado' | 'Cancelado' | 'Concluído';
};

const tableRows: PagRow[] = [
  { preparador: 'João Silva', origem: 'São Paulo - SP', destino: 'Rio de Janeiro - RJ', dataFinalizacao: '24/01/2025\n18:10', status: 'Em andamento' },
  { preparador: 'Pedro Henrique', origem: 'Belo Horizonte - MG', destino: 'Brasília - DF', dataFinalizacao: '23/01/2025\n09:30', status: 'Agendado' },
  { preparador: 'Maria Pontes', origem: 'Curitiba - PR', destino: 'Porto Alegre - RS', dataFinalizacao: '22/01/2025\n10:45', status: 'Agendado' },
  { preparador: 'Julia Campos', origem: 'Salvador - BA', destino: 'Recife - PE', dataFinalizacao: '21/01/2025\n15:16', status: 'Cancelado' },
  { preparador: 'Carlos Silva', origem: 'Fortaleza - CE', destino: 'Natal - RN', dataFinalizacao: '20/01/2025\n16:24', status: 'Concluído' },
  { preparador: 'Matheus Pontes', origem: 'Salvador - BA', destino: 'Curitiba - PR', dataFinalizacao: '19/01/2025\n03:40', status: 'Concluído' },
  { preparador: 'Hugo Silva', origem: 'Brasília - DF', destino: 'Rio de Janeiro - RJ', dataFinalizacao: '18/01/2025\n14:30', status: 'Concluído' },
];

const tableCols = [
  { label: 'Preparador', flex: '1 1 18%', minWidth: 140 },
  { label: 'Origem', flex: '1 1 18%', minWidth: 140 },
  { label: 'Destino', flex: '1 1 20%', minWidth: 160 },
  { label: 'Data e horário\nde finalização', flex: '0 0 130px', minWidth: 130 },
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

export default function PagamentosScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

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
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#f1f1f1', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
      },
    }, filterIconSvg, 'Filtro'),
    React.createElement('button', {
      type: 'button',
      onClick: () => navigate('/pagamentos/gestao'),
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
    ...metrics.map((m) =>
      React.createElement('div', { key: m.title, style: s.metricCard },
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, m.title),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: m.negative ? '#b53838' : '#22c55e', ...font } }, m.pct),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, m.desc)),
        React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, m.value))));

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

  const tableRowEls = tableRows.map((row, idx) => {
    const st = statusStyles[row.status];
    return React.createElement('div', {
      key: idx,
      style: {
        display: 'flex', minHeight: 64, alignItems: 'center', padding: '8px 16px',
        borderBottom: '1px solid #d9d9d9', background: '#fff',
      },
    },
      React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, fontWeight: 500 } }, row.preparador),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth } }, row.origem),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth } }, row.destino),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth, whiteSpace: 'pre-line' as const, fontSize: 13, lineHeight: 1.4 } }, row.dataFinalizacao),
      React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' as const,
            background: st.bg, color: st.color, ...font,
          },
        }, row.status)));
  });

  const tableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  },
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%', border: '1px solid #e2e2e2' } },
      React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
        tableHeader,
        ...tableRowEls)));

  return React.createElement(React.Fragment, null,
    title, searchRow, metricCards, tableSection);
}
