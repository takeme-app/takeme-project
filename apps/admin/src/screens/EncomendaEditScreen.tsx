/**
 * EncomendaEditScreen — Editar encomenda conforme Figma 849-37300.
 * Secção motoristas: Figma 1283-34111.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const driverWaitingAsset = require('../../assets/driver-waiting.png');
const motoristaAvatar1 = require('../../assets/motoristas/m1.png');
const motoristaAvatar2 = require('../../assets/motoristas/m2.png');
const motoristaAvatar3 = require('../../assets/motoristas/m3.png');
const motoristaAvatar4 = require('../../assets/motoristas/m4.png');
const logoTakeMeBadge = require('../../assets/motoristas/logo-takeme.png');

type MotoristaBadge = 'takeme' | 'parceiro';

type MotoristaDisponivel = {
  id: string;
  nome: string;
  nota: number;
  viagensTexto: string;
  badge: MotoristaBadge;
  foto: string | number;
  fotoLargura?: number;
  rota: string;
  data: string;
  horaSaida: string;
  valorTotal: string;
  valorUnitario: string;
  pessoasRestantes: string;
  bagageiro: string;
};

/** Lista vazia = estado “aguardando motorista” (ícone 3D). Preencha para o layout do Figma. */
const MOTORISTAS_MOCK: MotoristaDisponivel[] = [
  {
    id: '1',
    nome: 'Matheus Barros',
    nota: 4.8,
    viagensTexto: '(120 viagens concluídas)',
    badge: 'takeme',
    foto: motoristaAvatar1,
    rota: 'Rio de Janeiro - RJ → São Paulo - SP',
    data: '05/09/2025',
    horaSaida: '15:30',
    valorTotal: 'R$ 145,00',
    valorUnitario: 'R$ 70,00',
    pessoasRestantes: '3',
    bagageiro: '70%',
  },
  {
    id: '2',
    nome: 'Carlos Silva',
    nota: 4.7,
    viagensTexto: '(133 viagens concluídas)',
    badge: 'takeme',
    foto: motoristaAvatar2,
    rota: 'Rio de Janeiro - RJ → São Paulo - SP',
    data: '05/09/2025',
    horaSaida: '16:40',
    valorTotal: 'R$ 125,00',
    valorUnitario: 'R$ 65,00',
    pessoasRestantes: '2',
    bagageiro: '80%',
  },
  {
    id: '3',
    nome: 'Fernando Pontes',
    nota: 4.6,
    viagensTexto: '(133 viagens concluídas)',
    badge: 'parceiro',
    foto: motoristaAvatar3,
    fotoLargura: 48,
    rota: 'Rio de Janeiro - RJ → São Paulo - SP',
    data: '05/09/2025',
    horaSaida: '17:15',
    valorTotal: 'R$ 145,00',
    valorUnitario: 'R$ 75,00',
    pessoasRestantes: '3',
    bagageiro: '75%',
  },
  {
    id: '4',
    nome: 'Marta Gomes',
    nota: 4.1,
    viagensTexto: '(143 viagens concluídas)',
    badge: 'takeme',
    foto: motoristaAvatar4,
    rota: 'Rio de Janeiro - RJ → São Paulo - SP',
    data: '05/09/2025',
    horaSaida: '13:40',
    valorTotal: 'R$ 165,00',
    valorUnitario: 'R$ 85,00',
    pessoasRestantes: '4',
    bagageiro: '15%',
  },
];

const arrowBackSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M19 12H5M12 19l-7-7 7-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const xSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round' }));
const checkSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
  React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const infoSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#cba04b', strokeWidth: 2 }),
  React.createElement('path', { d: 'M12 16v-4M12 8h.01', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round' }));
const headphoneSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M3 18v-6a9 9 0 0118 0v6', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const calendarSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));
const calendarSvgLg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));
const starSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: '#cba04b', style: { display: 'block', flexShrink: 0 } },
  React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' }));
const checkOutlineSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const motoristaLinha = (rotulo: string, valor: string) =>
  React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, width: '100%', minWidth: 0 } },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', flexShrink: 0, lineHeight: 1.5, ...font } }, rotulo),
    React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', textAlign: 'right' as const, lineHeight: 1.5, minWidth: 0, wordBreak: 'break-word' as const, ...font } }, valor));

const radioMotorista = (selecionado: boolean, onClick: () => void) =>
  React.createElement('button', {
    type: 'button',
    onClick,
    'aria-pressed': selecionado,
    'aria-label': selecionado ? 'Motorista selecionado' : 'Selecionar motorista',
    style: {
      width: 40,
      height: 40,
      padding: 0,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  },
    React.createElement('span', {
      style: {
        width: 22,
        height: 22,
        borderRadius: '50%',
        border: `2px solid ${selecionado ? '#0d0d0d' : '#9a9a9a'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box' as const,
      },
    }, selecionado ? React.createElement('span', { style: { width: 12, height: 12, borderRadius: '50%', background: '#0d0d0d' } }) : null));

const badgeMotorista = (tipo: MotoristaBadge) => {
  if (tipo === 'parceiro') {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', background: '#fff', padding: '4px 8px', borderRadius: 90 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', lineHeight: 1.5, whiteSpace: 'nowrap' as const, ...font } }, 'Motorista Parceiro'));
  }
  return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, background: '#fff', padding: '4px 8px', borderRadius: 90 } },
    React.createElement('img', { src: logoTakeMeBadge, alt: '', style: { width: 16, height: 16, objectFit: 'cover', flexShrink: 0 } }),
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', lineHeight: 1.5, whiteSpace: 'nowrap' as const, ...font } }, 'Motorista TakeMe'));
};

const cartaoMotorista = (m: MotoristaDisponivel, selecionado: boolean, onSelect: () => void) => {
  const w = m.fotoLargura ?? 56;
  const h = 56;
  const blocoNota = React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: '4px 8px', alignItems: 'center' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
      starSvg,
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#545454', ...font } }, String(m.nota))),
    React.createElement('span', { style: { fontSize: 14, fontWeight: 400, color: '#767676', ...font } }, m.viagensTexto));
  const colunaTexto = React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' } },
      badgeMotorista(m.badge),
      radioMotorista(selecionado, onSelect)),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', lineHeight: 1.5, ...font } }, m.nome),
      blocoNota));
  const cabecalho = React.createElement('div', { style: { borderBottom: '1px solid #e2e2e2', paddingBottom: 12, width: '100%' } },
    React.createElement('div', { style: { display: 'flex', gap: 16, alignItems: 'flex-start', width: '100%', minWidth: 0 } },
      React.createElement('div', { style: { flexShrink: 0 } },
        React.createElement('img', {
          src: m.foto,
          alt: '',
          style: { width: w, height: h, borderRadius: 9999, objectFit: 'cover', display: 'block' },
        })),
      colunaTexto));
  const detalhes = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, width: '100%' } },
    motoristaLinha('Origem - Destino', m.rota),
    motoristaLinha('Data', m.data),
    motoristaLinha('Hora de saída', m.horaSaida),
    motoristaLinha('Valor total', m.valorTotal),
    motoristaLinha('Valor unitário', m.valorUnitario),
    motoristaLinha('Pessoas restantes', m.pessoasRestantes),
    motoristaLinha('Ocupação do bagageiro', m.bagageiro));
  return React.createElement('div', {
    key: m.id,
    style: {
      flex: '1 1 calc(50% - 8px)',
      minWidth: 280,
      boxSizing: 'border-box' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 12,
      padding: '24px 16px',
      borderRadius: 12,
      background: '#f6f6f6',
      border: selecionado ? '2px solid #0d0d0d' : '2px solid transparent',
    },
  }, cabecalho, detalhes);
};

const readField = (label: string, value: string) =>
  React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
    React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
    React.createElement('div', { style: { height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font } }, value));

const encomendaCard = (tamanho: string, valor: string, remetente: string, destinatario: string, recolha: string, entrega: string, obs: string) =>
  React.createElement('div', {
    style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, padding: 20, border: '1px solid #e2e2e2', borderRadius: 16, background: '#fff', alignItems: 'flex-start' },
  },
    React.createElement('div', { style: { width: 56, height: 56, borderRadius: 12, background: '#f1f1f1', flexShrink: 0 } }),
    React.createElement('div', { style: { flex: 1, minWidth: 200, display: 'flex', flexWrap: 'wrap' as const, gap: '12px 24px' } },
      React.createElement('div', null,
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Tamanho:'),
        React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, tamanho)),
      React.createElement('div', null,
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Valor:'),
        React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, valor)),
      React.createElement('div', null,
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Remetente:'),
        React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, remetente)),
      React.createElement('div', null,
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Destinatário:'),
        React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, destinatario)),
      React.createElement('div', { style: { width: '100%', display: 'flex', gap: 24, flexWrap: 'wrap' as const } },
        React.createElement('div', null,
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Recolha:'),
          React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, recolha)),
        React.createElement('div', null,
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Entrega'),
          React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, entrega)),
        React.createElement('div', null,
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Observações:'),
          React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, obs)))),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#faf5eb' } }, headphoneSvg));

export default function EncomendaEditScreen() {
  const navigate = useNavigate();
  const motoristas = MOTORISTAS_MOCK;
  const [motoristaSelecionado, setMotoristaSelecionado] = useState(() => motoristas[0]?.id ?? '');

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24, width: '100%', maxWidth: 1044, margin: '0 auto', boxSizing: 'border-box' as const } },
    // Breadcrumb
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#767676', ...font } },
      React.createElement('span', null, 'Encomendas'),
      React.createElement('span', { style: { margin: '0 4px' } }, '›'),
      React.createElement('span', { style: { color: '#0d0d0d' } }, 'Editar encomenda')),
    // Toolbar
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 } },
      React.createElement('button', { type: 'button', onClick: () => navigate(-1), style: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', padding: 0, ...font } }, arrowBackSvg, 'Voltar'),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', { type: 'button', onClick: () => navigate(-1), style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px', borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font } }, xSvg, 'Cancelar'),
        React.createElement('button', { type: 'button', style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px', borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font } }, checkSvg, 'Salvar alteração'))),
    // Warning banner
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: '#f6f6f6', borderRadius: 12, width: '100%', boxSizing: 'border-box' as const } },
      infoSvg,
      React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, 'Você está editando esta encomenda')),
    // Map + Summary
    React.createElement('div', { style: { display: 'flex', gap: 24, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { flex: '1 1 350px', height: 220, borderRadius: 16, background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } },
        React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, 'Mapa do trajeto')),
      React.createElement('div', { style: { flex: '0 0 280px', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#767676', ...font } }, 'Resumo da viagem •'),
          React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', ...font } }, '#123456')),
        React.createElement('span', { style: { display: 'inline-block', padding: '4px 14px', borderRadius: 999, background: '#a8c6ef', color: '#102d57', fontSize: 13, fontWeight: 700, alignSelf: 'flex-start', ...font } }, 'Agendado'),
        React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#767676', ...font } }, 'Rota'),
        React.createElement('div', { style: { height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font } }, 'SP → RJ'))),
    // Trajeto
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#767676', ...font } }, 'Trajeto de origem e destino'),
      readField('Origem', 'Av. Paulista, 1578 - São Paulo, SP'),
      readField('Destino', 'Av. Atlântica, 1702 - Rio de Janeiro, RJ')),
    // Horário agendado
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Horário agendado para início'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px' } },
        calendarSvg,
        React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, '05 de setembro-2025, 15:30')),
      React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Alterar o horário de início atualizará automaticamente o tempo estimado de chegada.')),
    // Motoristas disponíveis (Figma 1283-34111)
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, paddingBottom: 32, borderBottom: '1px solid #e2e2e2' } },
      motoristas.length === 0
        ? React.createElement(React.Fragment, null,
          React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } },
            'Motoristas disponíveis ',
            React.createElement('span', { style: { fontWeight: 400, color: '#767676' } }, '(Aguardando motorista)')),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: '32px 16px' } },
            React.createElement('div', { style: { width: '100%', maxWidth: 280, minHeight: 160, background: '#f1f1f1', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' as const } },
              React.createElement('img', {
                src: driverWaitingAsset,
                alt: '',
                style: { width: '100%', maxWidth: 200, height: 'auto', maxHeight: 200, objectFit: 'contain' as const },
              }))))
        : React.createElement(React.Fragment, null,
          React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.3, ...font } }, 'Motoristas disponíveis'),
          React.createElement('div', { style: { border: '1px solid #e2e2e2', borderRadius: 12, padding: 24, width: '100%', boxSizing: 'border-box' as const } },
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16 } },
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
                React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', minHeight: 40, display: 'flex', alignItems: 'center', ...font } }, 'Selecione a data'),
                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 0, height: 44, borderRadius: 8, background: '#f1f1f1', paddingLeft: 16, overflow: 'hidden' } },
                  calendarSvgLg,
                  React.createElement('span', { style: { fontSize: 16, fontWeight: 400, color: '#3a3a3a', paddingLeft: 16, paddingRight: 16, flex: 1, lineHeight: 1.5, ...font } }, '05 de setembro-2025'))),
              React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, width: '100%' } },
                motoristas.slice(0, 2).map((m) => cartaoMotorista(m, motoristaSelecionado === m.id, () => setMotoristaSelecionado(m.id)))),
              React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, width: '100%' } },
                motoristas.slice(2, 4).map((m) => cartaoMotorista(m, motoristaSelecionado === m.id, () => setMotoristaSelecionado(m.id)))))),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', width: '100%', marginTop: 0 } },
            React.createElement('button', {
              type: 'button',
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 44,
                padding: '0 24px',
                borderRadius: 999,
                border: '1px solid #0d0d0d',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: '#0d0d0d',
                ...font,
              },
            }, checkOutlineSvg, 'Confirmar substituição')))),
    // Encomendas
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16 } },
      React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Encomendas'),
      encomendaCard('Médio', 'R$ 80,00', 'Fernanda Lima', 'Ana Silva', 'Rua das Acácias, 45', 'Av. Central, 890', 'Frágil - manusear com cuidado'),
      encomendaCard('Pequeno', 'R$ 45,00', 'Pedro Pontes', 'Maria Silva', 'Rua das Acácias, 45', 'Av. Central, 890', 'Frágil - manusear com cuidado')));
}
