/**
 * AtendimentosScreen — Atendimentos conforme Figma 1044-38472.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState } from 'react';
import { webStyles } from '../styles/webStyles';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// ── Status colors ───────────────────────────────────────────────────────
const statusMap: Record<string, { dot: string; bg: string; color: string; label: string }> = {
  nao_atendida: { dot: '#b53838', bg: '#eeafaa', color: '#551611', label: 'Não atendida' },
  em_atendimento: { dot: '#cba04b', bg: '#fee59a', color: '#654c01', label: 'Em atendimento' },
  atrasada: { dot: '#b53838', bg: '#eeafaa', color: '#551611', label: 'Atrasada' },
  ouvidoria: { dot: '#4A90D9', bg: '#a8c6ef', color: '#102d57', label: 'Ouvidoria' },
  denuncia: { dot: '#b53838', bg: '#eeafaa', color: '#551611', label: 'Denúncia' },
  finalizada: { dot: '#22c55e', bg: '#b0e8d1', color: '#174f38', label: 'Finalizada' },
};

// ── Ticket data (first section — "Meu atendimento") ────────────────────
type Ticket = {
  nome: string;
  avatar: string;
  categoria: string;
  descricao: string;
  tempo: string;
  status: string;
};

const meuAtendimentoTickets: Ticket[] = [
  { nome: 'Maria Silva', avatar: 'M', categoria: 'Excursão', descricao: 'Preciso organizar uma viagem para 15 pessoas de São Paulo para Santos...', tempo: 'há 5 min', status: 'nao_atendida' },
  { nome: 'João Santos', avatar: 'J', categoria: 'Cadastro de transporte', descricao: 'Documentação do veículo anexada para análise', tempo: 'há 5 min', status: 'em_atendimento' },
  { nome: 'Ana Costa', avatar: 'A', categoria: 'Reembolso', descricao: 'Solicitação de reembolso para viagem cancelada', tempo: 'há 2 dias', status: 'atrasada' },
];

const todosTickets: Ticket[] = [
  { nome: 'Pedro Oliveira', avatar: 'P', categoria: 'Ouvidoria', descricao: 'Não consigo acessar minha conta', tempo: 'há 5 min', status: 'nao_atendida' },
  { nome: 'Carla Souza', avatar: 'C', categoria: 'Denúncia', descricao: 'Gostaria de reportar um problema com o motorista', tempo: 'há 16 horas', status: 'atrasada' },
];

// ── Category chips for first section ────────────────────────────────────
const meuCategorias = [
  { label: 'Todos', count: 24 },
  { label: 'Excursão', count: 8 },
  { label: 'Encomendas', count: 5 },
  { label: 'Reembolso', count: 3 },
  { label: 'Cadastro de transporte', count: 6 },
  { label: 'Aurorizar menores', count: 6 },
];

// ── Status chips for second section ─────────────────────────────────────
const todosStatusChips = [
  { label: 'Todos', count: 24 },
  { label: 'Atrasadas', count: 4 },
  { label: 'Não atendidas', count: 3 },
  { label: 'Em atendimento', count: 9 },
  { label: 'Ouvidoria', count: 2 },
  { label: 'Denúncia', count: 6 },
  { label: 'Finalizadas', count: 21 },
];

// ── Avatar colors ───────────────────────────────────────────────────────
const avatarColors: Record<string, string> = {
  M: '#E8725C', J: '#7B61FF', A: '#F5A623', P: '#4A90D9', C: '#50C878',
};

// ── Metrics ─────────────────────────────────────────────────────────────
const metrics = [
  { title: 'Viagens no momento', value: '47' },
  { title: 'Motoristas ativos', value: '128' },
  { title: 'Cancelamentos (hoje)', value: '3' },
  { title: 'Encomendas no momento', value: '12' },
];

// ── Clock SVG ───────────────────────────────────────────────────────────
const clockSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M12 6v6l4 2', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));

// ── Chevron down SVG ────────────────────────────────────────────────────
const chevronDownSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

export default function AtendimentosScreen() {
  const [meuCatActive, setMeuCatActive] = useState('Todos');
  const [todosStatusActive, setTodosStatusActive] = useState('Todos');

  // ── Helper: chip ──────────────────────────────────────────────────────
  const chip = (label: string, count: number, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', onClick,
      style: {
        display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px',
        borderRadius: 999, border: active ? '2px solid #0d0d0d' : '1px solid #e2e2e2',
        background: active ? '#0d0d0d' : '#fff', color: active ? '#fff' : '#0d0d0d',
        fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const, ...font,
      },
    },
      label,
      React.createElement('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 20, height: 20, borderRadius: 999, padding: '0 6px',
          background: active ? '#fff' : '#f1f1f1', color: active ? '#0d0d0d' : '#767676',
          fontSize: 12, fontWeight: 600, ...font,
        },
      }, String(count)));

  // ── Helper: ticket card ───────────────────────────────────────────────
  const ticketCard = (t: Ticket, idx: number) => {
    const st = statusMap[t.status] || statusMap.nao_atendida;
    const avatarBg = avatarColors[t.avatar] || '#999';
    return React.createElement('div', {
      key: `${t.nome}-${idx}`,
      style: {
        display: 'flex', flexDirection: 'column' as const, gap: 16, padding: '20px 0',
        borderBottom: '1px solid #e2e2e2',
      },
    },
      // Status badge
      React.createElement('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          padding: '4px 12px', borderRadius: 999, background: st.bg, color: st.color,
          fontSize: 13, fontWeight: 600, ...font,
        },
      },
        React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 } }),
        st.label),
      // Content row
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 } },
        // Left side
        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 } },
          // Avatar
          React.createElement('div', {
            style: {
              width: 44, height: 44, borderRadius: '50%', background: avatarBg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            },
          }, React.createElement('span', { style: { color: '#fff', fontSize: 18, fontWeight: 600, ...font } }, t.avatar)),
          // Info
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6, minWidth: 0, flex: 1 } },
            // Name + category
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const } },
              React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', ...font } }, t.nome),
              React.createElement('span', {
                style: {
                  padding: '2px 10px', borderRadius: 999, background: '#f1f1f1',
                  fontSize: 12, fontWeight: 500, color: '#0d0d0d', whiteSpace: 'nowrap' as const, ...font,
                },
              }, t.categoria)),
            // Description
            React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, lineHeight: 1.5, ...font } }, t.descricao),
            // Time
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
              clockSvg,
              React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, t.tempo)))),
        // Atender button
        React.createElement('button', {
          type: 'button',
          style: {
            height: 44, padding: '0 24px', borderRadius: 999, border: '1px solid #0d0d0d',
            background: '#fff', fontSize: 14, fontWeight: 600, color: '#0d0d0d',
            cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0, ...font,
          },
        }, 'Atender')));
  };

  // ── Visão geral + Online ──────────────────────────────────────────────
  const headerRow = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  },
    React.createElement('h1', { style: { fontSize: 24, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Visão geral'),
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px',
        border: '1px solid #e2e2e2', borderRadius: 999, cursor: 'pointer',
      },
    },
      React.createElement('span', { style: { width: 10, height: 10, borderRadius: '50%', background: '#22c55e' } }),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#22c55e', ...font } }, 'Online'),
      chevronDownSvg));

  // ── Metric cards ──────────────────────────────────────────────────────
  const metricCards = React.createElement('div', {
    style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, width: '100%' },
  },
    ...metrics.map((m) =>
      React.createElement('div', {
        key: m.title,
        style: {
          flex: '1 1 0', minWidth: 0, background: '#f6f6f6', borderRadius: 16,
          padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 16,
          boxSizing: 'border-box' as const,
        },
      },
        React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, m.title),
        React.createElement('p', { style: { fontSize: 36, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, m.value))));

  // ── Meu atendimento section ───────────────────────────────────────────
  const meuAtendimentoHeader = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 },
  },
    React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Atendimentos'),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement('button', {
        type: 'button',
        style: {
          height: 40, padding: '0 20px', borderRadius: 999, border: '1px solid #e2e2e2',
          background: '#fff', fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
        },
      }, 'Filtrar status'),
      React.createElement('button', {
        type: 'button',
        style: {
          display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px',
          borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff',
          fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
        },
      }, 'Meu atendimento', chevronDownSvg)));

  const meuCatChips = React.createElement('div', {
    style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  },
    ...meuCategorias.map((c) => chip(c.label, c.count, meuCatActive === c.label, () => setMeuCatActive(c.label))));

  const meuTicketCards = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, background: '#f6f6f6', borderRadius: 16, padding: '0 24px' },
  },
    ...meuAtendimentoTickets.map((t, i) => ticketCard(t, i)));

  const meuSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' },
  }, meuAtendimentoHeader, meuCatChips, meuTicketCards);

  // ── Todos atendimentos section ────────────────────────────────────────
  const todosHeader = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  },
    React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Atendimentos'),
    React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'SLA de 24h para marcar como atrasada'));

  const todosChips = React.createElement('div', {
    style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  },
    ...todosStatusChips.map((c) => chip(c.label, c.count, todosStatusActive === c.label, () => setTodosStatusActive(c.label))));

  const todosCards = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, background: '#f6f6f6', borderRadius: 16, padding: '0 24px' },
  },
    ...todosTickets.map((t, i) => ticketCard(t, i)));

  const todosSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' },
  }, todosHeader, todosChips, todosCards);

  // ── Separator ─────────────────────────────────────────────────────────
  const sep = React.createElement('div', { style: { height: 1, background: '#e2e2e2', width: '100%' } });

  return React.createElement(React.Fragment, null,
    headerRow,
    metricCards,
    sep,
    meuSection,
    sep,
    todosSection);
}
