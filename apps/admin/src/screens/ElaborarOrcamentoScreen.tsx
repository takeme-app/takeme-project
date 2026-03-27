/**
 * ElaborarOrcamentoScreen — Elaborar orçamento de excursão conforme Figma 1429-33354.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const arrowLeftSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M19 12H5M12 19l-7-7 7-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const checkSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const closeSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round' }));
const plusSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const chevronSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', position: 'absolute' as const, right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' as const } },
  React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// ── Styles ──────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px',
  fontSize: 14, color: '#0d0d0d', background: '#f1f1f1', outline: 'none', width: '100%', boxSizing: 'border-box', ...font,
};
const selectWrap: React.CSSProperties = { position: 'relative', flex: 1, minWidth: 0 };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: '#767676', marginBottom: 4, ...font };
const sectionCard: React.CSSProperties = {
  border: '1px solid #e2e2e2', borderRadius: 16, padding: 24,
  display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box',
};
const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
  cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font,
};

// ── Helper: row of fields ───────────────────────────────────────────────
const fieldRow = (children: React.ReactNode[]) =>
  React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } }, ...children);

const field = (label: string, value: string, flex = '1 1 0') =>
  React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex, minWidth: 140 } },
    React.createElement('span', { style: labelStyle }, label),
    React.createElement('input', { type: 'text', defaultValue: value, style: inputStyle, readOnly: true }));

const selectField = (label: string, value: string, flex = '1 1 0') =>
  React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex, minWidth: 140 } },
    React.createElement('span', { style: labelStyle }, label),
    React.createElement('div', { style: selectWrap as any },
      React.createElement('input', { type: 'text', defaultValue: value, style: inputStyle, readOnly: true }),
      chevronSvg));

// ── Item row helper ─────────────────────────────────────────────────────
const itemRow = (item: string, qty: string, valor: string) =>
  React.createElement('div', { style: { display: 'flex', gap: 16, alignItems: 'flex-end' } },
    React.createElement('div', { style: { flex: '2 1 0', minWidth: 140, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('div', { style: selectWrap as any },
        React.createElement('input', { type: 'text', defaultValue: item, style: inputStyle, readOnly: true }),
        chevronSvg)),
    React.createElement('div', { style: { flex: '0 0 80px', display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('input', { type: 'text', defaultValue: qty, style: inputStyle, readOnly: true })),
    React.createElement('div', { style: { flex: '1 1 0', minWidth: 100, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('input', { type: 'text', defaultValue: valor, style: inputStyle, readOnly: true })));

export default function ElaborarOrcamentoScreen() {
  const navigate = useNavigate();

  // ── Breadcrumb ────────────────────────────────────────────────────────
  const breadcrumb = React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#767676', ...font } },
    React.createElement('span', null, 'Atendimentos'),
    React.createElement('span', null, '›'),
    React.createElement('span', null, 'Detalhes do atendimento'),
    React.createElement('span', null, '›'),
    React.createElement('span', { style: { color: '#0d0d0d', fontWeight: 500 } }, 'Elaborar orçamento'));

  // ── Header ────────────────────────────────────────────────────────────
  const header = React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 } },
    React.createElement('button', {
      type: 'button', onClick: () => navigate(-1),
      style: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font },
    }, arrowLeftSvg, 'Voltar'),
    React.createElement('div', { style: { display: 'flex', gap: 8 } },
      React.createElement('button', {
        type: 'button', onClick: () => navigate(-1),
        style: {
          display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px',
          borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff',
          fontSize: 14, fontWeight: 600, color: '#b53838', cursor: 'pointer', ...font,
        },
      }, closeSvg, 'Cancelar'),
      React.createElement('button', {
        type: 'button', onClick: () => navigate(-1),
        style: {
          display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px',
          borderRadius: 999, border: 'none', background: '#0d0d0d',
          fontSize: 14, fontWeight: 600, color: '#fff', cursor: 'pointer', ...font,
        },
      }, checkSvg, 'Finalizar orçamento')));

  // ── Title ─────────────────────────────────────────────────────────────
  const title = React.createElement('h1', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Orçamento de Excursão');

  // ── Detalhes da excursão ──────────────────────────────────────────────
  const detalhesSection = React.createElement('div', { style: sectionCard },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#767676', ...font } }, 'Detalhes da excursão'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: labelStyle }, 'Tipo da solicitação'),
      React.createElement('input', { type: 'text', defaultValue: 'Solicitação de excursão', style: inputStyle, readOnly: true })),
    fieldRow([
      selectField('Destino da excursão', 'Viana - MA'),
      selectField('Data da excursão', '10/11/2025'),
    ]),
    fieldRow([
      field('Quantidade de pessoas', '25'),
      selectField('Tipo de frota', 'Micro-ônibus'),
    ]));

  // ── Equipe vinculada ──────────────────────────────────────────────────
  const equipeSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, width: '100%' } },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#767676', ...font } }, 'Equipe vinculada'),
    fieldRow([
      selectField('Motorista', 'João Carlos da Silva'),
      field('Valor', 'R$ 500,00'),
    ]),
    fieldRow([
      selectField('Preparador de excursões', 'Helena Fonseca'),
      field('Valor', 'R$ 500,00'),
    ]),
    React.createElement('button', { type: 'button', style: addBtn }, plusSvg, 'Adicionar nova pessoa'));

  // ── Itens básicos ─────────────────────────────────────────────────────
  const itensHeader = React.createElement('div', { style: { display: 'flex', gap: 16 } },
    React.createElement('span', { style: { flex: '2 1 0', ...labelStyle } }, 'Item'),
    React.createElement('span', { style: { flex: '0 0 80px', ...labelStyle } }, 'Quantidade'),
    React.createElement('span', { style: { flex: '1 1 0', ...labelStyle } }, 'Valor'));

  const itensSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, width: '100%' } },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#767676', ...font } }, 'Itens básicos'),
    itensHeader,
    itemRow('Micro-ônibus', '1', 'R$ 2.500,00'),
    React.createElement('button', { type: 'button', style: addBtn }, plusSvg, 'Adicionar novo item'));

  // ── Serviços adicionais ───────────────────────────────────────────────
  const servicosSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, width: '100%' } },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#767676', ...font } }, 'Serviços adicionais'),
    React.createElement('div', { style: { display: 'flex', gap: 16 } },
      React.createElement('span', { style: { flex: '2 1 0', ...labelStyle } }, 'Item'),
      React.createElement('span', { style: { flex: '0 0 80px', ...labelStyle } }, 'Quantidade'),
      React.createElement('span', { style: { flex: '1 1 0', ...labelStyle } }, 'Valor')),
    itemRow('Equipe de primeiros socorros', '2', 'R$ 600,00'),
    itemRow('Equipe de recreação', '5', 'R$ 800,00'),
    React.createElement('button', { type: 'button', style: addBtn }, plusSvg, 'Adicionar novo serviço'));

  // ── Adicionais de recreação ───────────────────────────────────────────
  const recreacaoSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, width: '100%' } },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#767676', ...font } }, 'Adicionais de recreação'),
    React.createElement('div', { style: { display: 'flex', gap: 16 } },
      React.createElement('span', { style: { flex: '2 1 0', ...labelStyle } }, 'Item'),
      React.createElement('span', { style: { flex: '0 0 80px', ...labelStyle } }, 'Quantidade'),
      React.createElement('span', { style: { flex: '1 1 0', ...labelStyle } }, 'Valor')),
    itemRow('Bolas de futebol', '8', 'R$ 200,00'),
    itemRow('Bóias', '5', 'R$ 300,00'),
    itemRow('Bolas de basquete', '3', 'R$ 100,00'),
    React.createElement('button', { type: 'button', style: addBtn }, plusSvg, 'Adicionar novo item'));

  // ── Desconto ──────────────────────────────────────────────────────────
  const descontoSection = React.createElement('div', { style: { ...sectionCard, gap: 12 } },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Desconto'),
    fieldRow([
      selectField('Tipo de desconto', 'Porcentagem'),
      field('Valor', '10%'),
    ]));

  // ── Total ─────────────────────────────────────────────────────────────
  const totalRow = React.createElement('div', {
    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid #e2e2e2' },
  },
    React.createElement('span', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', ...font } }, 'Total'),
    React.createElement('span', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', ...font } }, 'R$ 5.000,00'));

  return React.createElement(React.Fragment, null,
    breadcrumb, header, title,
    detalhesSection, equipeSection, itensSection, servicosSection, recreacaoSection,
    descontoSection, totalRow);
}
