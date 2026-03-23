/**
 * ViagemEditScreen — Edit trip page (Figma node 802:24098).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  webStyles,
  arrowBackSvg,
  starSvg,
  logoArrowSmallSvg,
  calendarIconSvg,
  statusPill,
  statusStyles,
  statusLabels,
  type ViagemRow,
} from '../styles/webStyles';

// ── Inline SVG icons ────────────────────────────────────────────────────
const closeXSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const checkSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const headsetSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M3 18v-6a9 9 0 0118 0v6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const trashSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const editPencilSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const peopleSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const inventorySvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M20 8H4V6h16v2zM4 20h16v-2H4v2zm0-6h16v-2H4v2z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const chartSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 20V10M12 20V4M6 20v-6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const nearMeSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const personSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const personAddSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const packageSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const warningSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const clockSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M12 6v6l4 2', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const locationPinSvg = React.createElement('svg', { width: 44, height: 44, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 10, r: 3, stroke: '#cba04b', strokeWidth: 2 }));
const starFilledSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', fill: '#F59E0B', stroke: '#F59E0B', strokeWidth: 1 }));

// ── Shared style constants ──────────────────────────────────────────────
const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };
const inputStyle: React.CSSProperties = {
  width: '100%', height: 44, background: '#f1f1f1', border: 'none', borderRadius: 8,
  paddingLeft: 16, fontSize: 16, color: '#3a3a3a', outline: 'none', boxSizing: 'border-box',
  ...font,
};
const labelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: '#0d0d0d', marginBottom: 4, ...font };
const sectionTitle: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font };
const grayText: React.CSSProperties = { fontSize: 14, color: '#767676', ...font };
const boldText: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#0d0d0d', ...font };
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, width: '100%' };
const pillBtn = (bg: string, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '8px 24px',
  borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
  background: bg, color, ...font, ...(extra || {}),
});

export default function ViagemEditScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const trip = (location.state as { trip?: ViagemRow } | null)?.trip ?? null;

  const [origem, setOrigem] = useState(trip?.origem ?? 'Av. Paulista, 1578 - São Paulo, SP');
  const [destino, setDestino] = useState(trip?.destino ?? 'Av. Atlântica, 1702 - Rio de Janeiro, RJ');
  const [horarioInicio, setHorarioInicio] = useState('05 de setembro-2025, 15:30');
  const [rota, setRota] = useState('SP → RJ');
  const [horarioSaida, setHorarioSaida] = useState('15:30');
  const [ocupacao, setOcupacao] = useState(75);
  const [selectedMotorista, setSelectedMotorista] = useState(0);
  const [dataMotorista, setDataMotorista] = useState('05 de setembro-2025');
  const [removePassageiroIdx, setRemovePassageiroIdx] = useState<number | null>(null);
  const [editEncomendaIdx, setEditEncomendaIdx] = useState<number | null>(null);
  const [editEncomendaData, setEditEncomendaData] = useState({ nome: '', recolha: '', entrega: '', destinatario: '', telefone: '', observacoes: '' });
  const [addEncomendaOpen, setAddEncomendaOpen] = useState(false);
  const [addEncomendaData, setAddEncomendaData] = useState({ cliente: '', recolha: '', entrega: '', destinatario: '', contato: '', valor: '', observacoes: '' });
  const [addPassageiroOpen, setAddPassageiroOpen] = useState(false);
  const [addPassageiroData, setAddPassageiroData] = useState({ id: '', nome: '', contato: '', mala: '', valor: '' });
  const [malaDropdownOpen, setMalaDropdownOpen] = useState(false);

  // ── Image zoom modal (Figma 1170-26615) ──────────────────────────────
  const [imageZoomOpen, setImageZoomOpen] = useState(false);

  // ── Toast state ───────────────────────────────────────────────────────
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToastMsg(msg); }, []);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  if (!trip) {
    return React.createElement('div', { style: webStyles.detailPage },
      React.createElement('div', { style: webStyles.detailSection },
        React.createElement('p', null, 'Nenhuma viagem selecionada.'),
        React.createElement('button', { type: 'button', style: webStyles.detailBackBtn, onClick: () => navigate('/viagens') }, arrowBackSvg, 'Voltar à lista')));
  }

  // ── 1. Header Section ────────────────────────────────────────────────
  const headerSection = React.createElement('div', { style: { borderBottom: '1px solid #e2e2e2', paddingBottom: 32, display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
    // Breadcrumb
    React.createElement('div', { style: webStyles.detailBreadcrumb },
      React.createElement('span', null, 'Viagens'),
      React.createElement('span', { style: { margin: '0 4px' } }, '\u203A'),
      React.createElement('span', { style: webStyles.detailBreadcrumbCurrent }, 'Editar viagem')),
    // Toolbar
    React.createElement('div', { style: webStyles.detailToolbar },
      React.createElement('button', { type: 'button', style: { ...webStyles.detailBackBtn, borderRadius: 999 }, onClick: () => navigate('/viagens') },
        arrowBackSvg, 'Voltar'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
        React.createElement('button', { type: 'button', style: pillBtn('#f1f1f1', '#b53838') }, closeXSvg, 'Cancelar'),
        React.createElement('button', { type: 'button', onClick: () => showToast('Viagem atualizada com sucesso'), style: pillBtn('#0d0d0d', '#ffffff') }, checkSvg, 'Salvar alteração'))),
    // Warning toast
    React.createElement('div', { style: {
      display: 'flex', alignItems: 'center', gap: 8, background: '#fff8e6',
      border: '0.5px solid #cba04b', borderRadius: 8, height: 48, padding: '12px 8px 12px 16px',
    } },
      warningSvg,
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Você está editando esta viagem')));

  // ── 2. Main Edit Form (two columns) ──────────────────────────────────
  const inputWithIcon = (icon: React.ReactNode, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { position: 'relative' as const, width: '100%' } },
      React.createElement('div', { style: { position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const } }, icon),
      React.createElement('input', { type: 'text', value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value), style: { ...inputStyle, paddingLeft: 40 } }));

  const leftColumn = React.createElement('div', { style: { flex: 1, maxWidth: 581, display: 'flex', flexDirection: 'column' as const, gap: 24 } },
    // Map placeholder (clickable → zoom modal)
    React.createElement('div', { style: {
      background: '#fff8e6', borderRadius: 12, height: 255, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    }, onClick: () => setImageZoomOpen(true) },
      React.createElement('div', { style: { width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #cba04b 0%, #e8c96a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        locationPinSvg)),
    // Section title
    React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#767676', ...font } }, 'Trajeto de origem e destino'),
    // Origem
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Origem'),
      React.createElement('input', { type: 'text', value: origem, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setOrigem(e.target.value), style: inputStyle })),
    // Destino
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Destino'),
      React.createElement('input', { type: 'text', value: destino, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDestino(e.target.value), style: inputStyle })),
    // Horário agendado
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Horário agendado para início'),
      inputWithIcon(calendarIconSvg, horarioInicio, setHorarioInicio)),
    // Helper text
    React.createElement('span', { style: grayText }, 'Alterar o horário de início atualizará automaticamente o tempo estimado de chegada.'));

  const rightColumn = React.createElement('div', { style: { width: 308, flexShrink: 0, position: 'sticky' as const, top: 0, alignSelf: 'flex-start' as const, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
    // Resumo title
    React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#767676', ...font } }, 'Resumo da viagem \u2022 #123456'),
    // Status pill
    React.createElement('div', { style: { alignSelf: 'flex-start' } },
      statusPill(statusLabels[trip.status] || 'Agendado', statusStyles[trip.status]?.bg || '#a8c6ef', statusStyles[trip.status]?.color || '#102d57')),
    // Rota
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Rota'),
      React.createElement('input', { type: 'text', value: rota, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRota(e.target.value), style: inputStyle })),
    // Horário de saída
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Horario de saída'),
      inputWithIcon(clockSvg, horarioSaida, setHorarioSaida)),
    // Ocupação do bagageiro
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('span', { style: labelStyle }, 'Ocupação do bagageiro:'),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, ocupacao + '%')),
      React.createElement('div', { style: { position: 'relative' as const, width: '100%', height: 16, display: 'flex', alignItems: 'center' } },
        React.createElement('div', { style: { position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)', left: 0, right: 0, height: 4, background: '#e2e2e2', borderRadius: 2 } }),
        React.createElement('div', { style: { position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)', left: 0, width: ocupacao + '%', height: 4, background: 'rgba(203,160,75,0.7)', borderRadius: 2 } }),
        React.createElement('input', {
          type: 'range', min: 0, max: 100, value: ocupacao,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setOcupacao(Number(e.target.value)),
          style: {
            width: '100%', height: 16, opacity: 0, cursor: 'pointer', position: 'absolute' as const, left: 0, top: 0, margin: 0, zIndex: 2,
          },
        }),
        React.createElement('div', { style: {
          position: 'absolute' as const, top: '50%', transform: 'translate(-50%, -50%)',
          left: ocupacao + '%', width: 16, height: 16, borderRadius: '50%', background: '#cba04b',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)', pointerEvents: 'none' as const, zIndex: 1,
        } }))));

  const mainForm = React.createElement('div', { style: { display: 'flex', gap: 32, width: '100%' } },
    leftColumn, rightColumn);

  // ── 3. Motoristas disponíveis ────────────────────────────────────────
  const motoristas = [
    { name: 'Matheus Barros', badge: 'Motorista TakeMe', rating: '4.8', trips: 120, origemDestino: 'SP → RJ', data: '05/09/2025', horaSaida: '15:30', valorTotal: 'R$ 450,00', valorUnitario: 'R$ 150,00', pessoasRestantes: '1 vaga', ocupacaoBag: '75%' },
    { name: 'Pedro Silva', badge: 'Motorista Parceiro', rating: '4.5', trips: 89, origemDestino: 'SP → RJ', data: '05/09/2025', horaSaida: '16:00', valorTotal: 'R$ 400,00', valorUnitario: 'R$ 133,00', pessoasRestantes: '2 vagas', ocupacaoBag: '50%' },
    { name: 'Lucas Oliveira', badge: 'Motorista TakeMe', rating: '4.9', trips: 200, origemDestino: 'SP → RJ', data: '05/09/2025', horaSaida: '15:45', valorTotal: 'R$ 470,00', valorUnitario: 'R$ 157,00', pessoasRestantes: '0 vagas', ocupacaoBag: '100%' },
    { name: 'Rafael Costa', badge: 'Motorista Parceiro', rating: '4.3', trips: 55, origemDestino: 'SP → RJ', data: '05/09/2025', horaSaida: '16:30', valorTotal: 'R$ 380,00', valorUnitario: 'R$ 127,00', pessoasRestantes: '3 vagas', ocupacaoBag: '25%' },
  ];

  const motoristaInfoRow = (label: string, value: string) =>
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' } },
      React.createElement('span', { style: grayText }, label),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, value));

  const motoristaCard = (m: typeof motoristas[0], idx: number) => {
    const isSelected = selectedMotorista === idx;
    return React.createElement('div', {
      key: idx,
      style: {
        border: isSelected ? '2px solid #0d0d0d' : '1px solid #e2e2e2', borderRadius: 12,
        padding: '16px 24px', display: 'flex', flexDirection: 'column' as const, gap: 12, cursor: 'pointer',
        boxSizing: 'border-box' as const,
      },
      onClick: () => setSelectedMotorista(idx),
    },
      // Top: Avatar + badge + radio
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement('div', { style: { width: 56, height: 56, borderRadius: '50%', background: '#e2e2e2', flexShrink: 0 } }),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: '#ffefc2', marginBottom: 4 } },
            logoArrowSmallSvg,
            React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: '#0d0d0d', ...font } }, m.badge)),
          React.createElement('div', { style: boldText }, m.name),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
            starFilledSvg,
            React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#545454', ...font } }, m.rating),
            React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, '(' + m.trips + ' viagens concluídas)'))),
        // Radio button
        React.createElement('div', { style: {
          width: 20, height: 20, borderRadius: '50%', border: '2px solid ' + (isSelected ? '#0d0d0d' : '#767676'),
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        } },
          isSelected ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null)),
      // Separator
      React.createElement('div', { style: { height: 1, background: '#e2e2e2', width: '100%' } }),
      // Info rows
      motoristaInfoRow('Origem-Destino', m.origemDestino),
      motoristaInfoRow('Data', m.data),
      motoristaInfoRow('Hora de saída', m.horaSaida),
      motoristaInfoRow('Valor total', m.valorTotal),
      motoristaInfoRow('Valor unitário', m.valorUnitario),
      motoristaInfoRow('Pessoas restantes', m.pessoasRestantes),
      motoristaInfoRow('Ocupação do bagageiro', m.ocupacaoBag));
  };

  const motoristasSection = React.createElement('div', { style: { borderTop: '1px solid #e2e2e2', paddingTop: 32, display: 'flex', flexDirection: 'column' as const, gap: 24, width: '100%' } },
    React.createElement('h2', { style: sectionTitle }, 'Motoristas disponíveis'),
    React.createElement('div', { style: { background: '#ffffff', border: '1px solid #e2e2e2', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 24 } },
      // Date select
      React.createElement('div', { style: fieldWrap },
        React.createElement('label', { style: grayText }, 'Selecione a data'),
        inputWithIcon(calendarIconSvg, dataMotorista, setDataMotorista)),
      // 2x2 grid
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } },
        ...motoristas.map(motoristaCard)),
      // Confirm button
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
        React.createElement('button', { type: 'button', style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '8px 24px',
          borderRadius: 999, border: '1px solid #0d0d0d', background: 'transparent',
          cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font,
        } }, checkSvg, 'Confirmar substituição'))));

  // ── 4. Passageiros & Encomendas ──────────────────────────────────────
  const passageiros = [
    { name: 'Maria Silva', rating: '4.8', mala: 'Média', valor: 'R$ 150,00' },
    { name: 'Ana Costa', rating: '4.6', mala: 'Grande', valor: 'R$ 150,00' },
    { name: 'João Porto', rating: '4.9', mala: 'Pequena', valor: 'R$ 150,00' },
  ];

  const passageiroCard = (p: typeof passageiros[0], idx: number) =>
    React.createElement('div', { key: idx, style: { paddingBottom: 16, borderBottom: idx < passageiros.length - 1 ? '1px solid #e2e2e2' : 'none', display: 'flex', flexDirection: 'column' as const, gap: 12 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement('div', { style: { width: 48, height: 48, borderRadius: '50%', background: '#e2e2e2', flexShrink: 0 } }),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: boldText }, p.name),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 } },
            starFilledSvg,
            React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#545454', ...font } }, p.rating))),
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', { type: 'button', style: { width: 40, height: 40, borderRadius: '50%', background: '#ffefc2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } }, headsetSvg),
          React.createElement('button', { type: 'button', onClick: () => setRemovePassageiroIdx(idx), style: { width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } }, trashSvg))),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', paddingTop: 4 } },
        React.createElement('div', null,
          React.createElement('div', { style: grayText }, 'Mala:'),
          React.createElement('div', { style: boldText }, p.mala)),
        React.createElement('div', { style: { textAlign: 'right' as const } },
          React.createElement('div', { style: grayText }, 'Valor unitário:'),
          React.createElement('div', { style: boldText }, p.valor))));

  const passageirosSection = React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
    React.createElement('h2', { style: sectionTitle }, 'Passageiros'),
    React.createElement('div', { style: { border: '1px solid #e2e2e2', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
      ...passageiros.map(passageiroCard),
      React.createElement('button', { type: 'button', onClick: () => { setAddPassageiroOpen(true); setAddPassageiroData({ id: '', nome: '', contato: '', mala: '', valor: '' }); setMalaDropdownOpen(false); }, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', textDecoration: 'underline', alignSelf: 'flex-start', padding: 0, ...font } }, '+ Adicionar')));

  const encomendas = [
    { name: 'Encomenda Tech Store', recolha: 'Rua das Acácias, 45', entrega: 'Av. Central, 890', destinatario: 'Ana Silva', observacoes: 'Frágil - manusear com cuidado', valor: 'R$ 80,00' },
    { name: 'Encomenda Loja ABC', recolha: 'Rua B, 123', entrega: 'Rua C, 456', destinatario: 'Pedro Lima', observacoes: 'Entregar até 18h', valor: 'R$ 45,00' },
  ];

  const encomendaInfoRow = (label: string, value: string) =>
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '2px 0' } },
      React.createElement('span', { style: grayText }, label),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, value));

  const encomendaCard = (enc: typeof encomendas[0], idx: number) =>
    React.createElement('div', { key: idx, style: { paddingBottom: 16, borderBottom: idx < encomendas.length - 1 ? '1px solid #e2e2e2' : 'none', display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('span', { style: boldText }, enc.name),
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', { type: 'button', onClick: () => { setEditEncomendaIdx(idx); setEditEncomendaData({ nome: enc.name.replace('Encomenda ', ''), recolha: enc.recolha, entrega: enc.entrega, destinatario: enc.destinatario, telefone: '(21) 98888-7777', observacoes: enc.observacoes }); }, style: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } }, editPencilSvg),
          React.createElement('button', { type: 'button', style: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' } }, trashSvg))),
      encomendaInfoRow('Recolha', enc.recolha),
      encomendaInfoRow('Entrega', enc.entrega),
      encomendaInfoRow('Destinatário', enc.destinatario),
      encomendaInfoRow('Observações', enc.observacoes),
      encomendaInfoRow('Valor', enc.valor));

  const encomendasSection = React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
    React.createElement('h2', { style: sectionTitle }, 'Encomendas'),
    React.createElement('div', { style: { border: '1px solid #e2e2e2', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
      ...encomendas.map(encomendaCard),
      React.createElement('button', { type: 'button', onClick: () => { setAddEncomendaOpen(true); setAddEncomendaData({ cliente: '', recolha: '', entrega: '', destinatario: '', contato: '', valor: '', observacoes: '' }); }, style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', textDecoration: 'underline', alignSelf: 'flex-start', padding: 0, ...font } }, '+ Adicionar')));

  const passageirosEncomendasRow = React.createElement('div', { style: { display: 'flex', gap: 24, width: '100%' } },
    passageirosSection, encomendasSection);

  // ── 5. Métricas e histórico ──────────────────────────────────────────
  const metricas = [
    { title: 'Ocupação do bagageiro', icon: inventorySvg, value: '75%' },
    { title: 'Passageiros embarcados', icon: peopleSvg, value: '3' },
    { title: 'Encomendas em trânsito', icon: chartSvg, value: '2' },
  ];

  const metricCard = (m: typeof metricas[0], idx: number) =>
    React.createElement('div', { key: idx, style: { flex: 1, background: '#f6f6f6', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
        React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, m.title),
        React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, m.icon)),
      React.createElement('span', { style: { fontSize: 40, fontWeight: 700, color: '#0d0d0d', ...font } }, m.value));

  const metricasSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
    React.createElement('h2', { style: sectionTitle }, 'Métricas e histórico'),
    React.createElement('div', { style: { display: 'flex', gap: 16, width: '100%' } },
      ...metricas.map(metricCard)));

  // ── 6. Histórico de alterações ───────────────────────────────────────
  const historico = [
    { icon: nearMeSvg, action: 'Rota alterada', name: 'João Henrique', date: '03 de setembro-2025, 10:30' },
    { icon: personSvg, action: 'Motorista substituído', name: 'Pedro Silva', date: '02 de setembro-2025, 14:15' },
    { icon: personAddSvg, action: 'Passageiro adicionado', name: 'Ana Costa', date: '01 de setembro-2025, 09:00' },
    { icon: packageSvg, action: 'Encomenda adicionada', name: 'Tech Store', date: '31 de agosto-2025, 16:45' },
  ];

  const historicoItem = (h: typeof historico[0], idx: number) =>
    React.createElement('div', { key: idx, style: { display: 'flex', alignItems: 'center', gap: 12, background: '#f6f6f6', borderRadius: 12, padding: 16 } },
      React.createElement('div', { style: { width: 40, height: 40, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, h.icon),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { fontSize: 14, color: '#0d0d0d', ...font } },
          React.createElement('span', { style: { fontWeight: 600 } }, h.action),
          ' \u2022 ',
          React.createElement('span', { style: { color: '#cba04b', fontWeight: 600 } }, h.name)),
        React.createElement('div', { style: { fontSize: 14, color: '#767676', marginTop: 2, ...font } }, h.date)));

  const historicoSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
    React.createElement('h2', { style: sectionTitle }, 'Histórico de alterações'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      ...historico.map(historicoItem)));

  // ── Remove passageiro modal (Figma 814-24464) ──────────────────────
  const removeModal = removePassageiroIdx !== null
    ? React.createElement('div', {
        style: {
          position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        },
        onClick: () => setRemovePassageiroIdx(null),
      },
        React.createElement('div', {
          style: {
            background: '#fff', borderRadius: 16, padding: '24px 0', width: '100%', maxWidth: 400,
            boxShadow: '6px 6px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' as const, gap: 24,
            alignItems: 'center',
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          // Header
          React.createElement('div', { style: { borderBottom: '1px solid #e2e2e2', paddingBottom: 24, paddingLeft: 16, paddingRight: 16, width: '100%', boxSizing: 'border-box' as const } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' } },
              React.createElement('div', { style: { maxWidth: 316 } },
                React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 'normal', ...font } },
                  'Tem certeza que deseja remover', React.createElement('br'), 'este passageiro?')),
              React.createElement('button', {
                type: 'button', 'aria-label': 'Fechar',
                onClick: () => setRemovePassageiroIdx(null),
                style: {
                  width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                },
              }, React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
                React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }))))),
          // CTA buttons
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, width: '100%', padding: '0 16px', boxSizing: 'border-box' as const } },
            React.createElement('button', {
              type: 'button',
              onClick: () => { setRemovePassageiroIdx(null); showToast('Passageiro removido com sucesso'); },
              style: {
                width: '100%', height: 48, background: '#f1f1f1', border: 'none', borderRadius: 8,
                cursor: 'pointer', fontSize: 16, fontWeight: 600, color: '#b53838', ...font,
              },
            }, 'Remover'),
            React.createElement('button', {
              type: 'button',
              onClick: () => setRemovePassageiroIdx(null),
              style: {
                width: '100%', height: 48, background: 'transparent', border: 'none', borderRadius: 8,
                cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#0d0d0d', ...font,
              },
            }, 'Voltar'))))
    : null;

  // ── Edit encomenda slide panel (Figma 814-26519) ────────────────────
  const editEncField = (label: string, key: keyof typeof editEncomendaData) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
      React.createElement('label', { style: labelStyle }, label),
      React.createElement('input', {
        type: 'text', value: editEncomendaData[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditEncomendaData(prev => ({ ...prev, [key]: e.target.value })),
        style: inputStyle,
      }));

  const editEncomendaPanel = editEncomendaIdx !== null
    ? React.createElement('div', {
        style: {
          position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999,
        },
        onClick: () => setEditEncomendaIdx(null),
      },
        React.createElement('div', {
          style: {
            background: '#fff', borderRadius: '16px 0 0 16px', width: '100%', maxWidth: 520,
            maxHeight: '100vh', boxShadow: '6px 6px 12px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column' as const, padding: '24px 32px 24px 32px',
            overflowY: 'auto' as const,
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          // Header
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #e2e2e2', marginBottom: 24, flexShrink: 0 } },
            React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Editar encomenda'),
            React.createElement('button', {
              type: 'button', 'aria-label': 'Fechar',
              onClick: () => setEditEncomendaIdx(null),
              style: { width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
            }, React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
              React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })))),
          // Fields
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, flex: 1 } },
            editEncField('Nome', 'nome'),
            editEncField('Recolha', 'recolha'),
            editEncField('Entrega', 'entrega'),
            editEncField('Destinatário', 'destinatario'),
            editEncField('Telefone do destinatário', 'telefone'),
            // Observações textarea
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                React.createElement('label', { style: labelStyle }, 'Observações'),
                React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Opcional')),
              React.createElement('textarea', {
                value: editEncomendaData.observacoes,
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditEncomendaData(prev => ({ ...prev, observacoes: e.target.value })),
                style: {
                  ...inputStyle, height: 100, paddingTop: 16, resize: 'vertical' as const,
                  lineHeight: 'normal', verticalAlign: 'top' as const,
                },
              }))),
          // Buttons
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, marginTop: 24, flexShrink: 0 } },
            React.createElement('button', {
              type: 'button',
              onClick: () => { setEditEncomendaIdx(null); showToast('Encomenda atualizada com sucesso'); },
              style: { width: '100%', height: 48, background: '#0d0d0d', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#fff', ...font },
            }, 'Salvar ajustes'),
            React.createElement('button', {
              type: 'button',
              onClick: () => setEditEncomendaIdx(null),
              style: { width: '100%', height: 48, background: '#e2e2e2', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#b53838', ...font },
            }, 'Cancelar'))))
    : null;

  // ── Add encomenda slide panel (Figma 814-26848) ─────────────────────
  const addEncField = (label: string, key: keyof typeof addEncomendaData, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
      React.createElement('label', { style: labelStyle }, label),
      React.createElement('input', {
        type: 'text', value: addEncomendaData[key], placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAddEncomendaData(prev => ({ ...prev, [key]: e.target.value })),
        style: { ...inputStyle, color: addEncomendaData[key] ? '#3a3a3a' : '#767676' },
      }));

  const addEncomendaPanel = addEncomendaOpen
    ? React.createElement('div', {
        style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999 },
        onClick: () => setAddEncomendaOpen(false),
      },
        React.createElement('div', {
          style: {
            background: '#fff', borderRadius: '16px 0 0 16px', width: '100%', maxWidth: 520,
            maxHeight: '100vh', boxShadow: '6px 6px 12px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column' as const, padding: '24px 32px 24px 32px',
            overflowY: 'auto' as const,
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          // Header
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #e2e2e2', marginBottom: 24, flexShrink: 0 } },
            React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Adicionar encomenda'),
            React.createElement('button', {
              type: 'button', 'aria-label': 'Fechar',
              onClick: () => setAddEncomendaOpen(false),
              style: { width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
            }, React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
              React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })))),
          // Fields
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, flex: 1 } },
            addEncField('Cliente remetente', 'cliente', 'Nome do remetente'),
            addEncField('Local de recolha', 'recolha', 'Endereço de recolha'),
            addEncField('Local de entrega', 'entrega', 'Endereço de entrega'),
            addEncField('Nome do destinatário', 'destinatario', 'Ex: Roberto Santos'),
            addEncField('Contato destinatário', 'contato', 'Ex: (21) 98888-7777'),
            addEncField('Valor', 'valor', 'R$ 0,00'),
            // Observações textarea
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                React.createElement('label', { style: labelStyle }, 'Observações'),
                React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Opcional')),
              React.createElement('textarea', {
                value: addEncomendaData.observacoes, placeholder: 'Informações adicionais',
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setAddEncomendaData(prev => ({ ...prev, observacoes: e.target.value })),
                style: { ...inputStyle, height: 80, paddingTop: 16, resize: 'vertical' as const, lineHeight: 'normal', verticalAlign: 'top' as const },
              }))),
          // Buttons
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, marginTop: 24, flexShrink: 0 } },
            React.createElement('button', {
              type: 'button', onClick: () => { setAddEncomendaOpen(false); showToast('Encomenda adicionada com sucesso'); },
              style: { width: '100%', height: 48, background: '#0d0d0d', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#fff', ...font },
            }, 'Adicionar encomenda'),
            React.createElement('button', {
              type: 'button', onClick: () => setAddEncomendaOpen(false),
              style: { width: '100%', height: 48, background: '#e2e2e2', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#b53838', ...font },
            }, 'Cancelar'))))
    : null;

  // ── Add passageiro slide panel (Figma 814-26985) ───────────────────
  const chevronDownSvgSmall = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  const malaOptions = ['Pequena', 'Média', 'Grande'];

  const addPassageiroField = (label: string, key: keyof typeof addPassageiroData, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
      React.createElement('label', { style: labelStyle }, label),
      React.createElement('input', {
        type: 'text', value: addPassageiroData[key], placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAddPassageiroData(prev => ({ ...prev, [key]: e.target.value })),
        style: { ...inputStyle, color: addPassageiroData[key] ? '#3a3a3a' : '#767676' },
      }));

  const malaDropdown = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%', position: 'relative' as const } },
    React.createElement('label', { style: labelStyle }, 'Tamanho da mala'),
    React.createElement('button', {
      type: 'button',
      onClick: () => setMalaDropdownOpen(!malaDropdownOpen),
      style: {
        ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', textAlign: 'left' as const,
        color: addPassageiroData.mala ? '#3a3a3a' : '#767676',
      },
    },
      React.createElement('span', null, addPassageiroData.mala || 'Selecione o tamanho'),
      chevronDownSvgSmall),
    malaDropdownOpen
      ? React.createElement('div', {
          style: {
            position: 'absolute' as const, top: '100%', left: 0, right: 0, marginTop: 4,
            background: '#fff', borderRadius: 8, boxShadow: '6px 6px 12px rgba(0,0,0,0.15)',
            zIndex: 10, overflow: 'hidden' as const,
          },
        },
          ...malaOptions.map(opt =>
            React.createElement('button', {
              key: opt, type: 'button',
              onClick: () => { setAddPassageiroData(prev => ({ ...prev, mala: opt })); setMalaDropdownOpen(false); },
              style: {
                width: '100%', padding: '10px 16px', background: addPassageiroData.mala === opt ? '#f1f1f1' : '#fff',
                border: 'none', cursor: 'pointer', fontSize: 16, color: '#0d0d0d', textAlign: 'left' as const, ...font,
              },
            }, opt)))
      : null);

  const addPassageiroPanel = addPassageiroOpen
    ? React.createElement('div', {
        style: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999 },
        onClick: () => { setAddPassageiroOpen(false); setMalaDropdownOpen(false); },
      },
        React.createElement('div', {
          style: {
            background: '#fff', borderRadius: '16px 0 0 16px', width: '100%', maxWidth: 520,
            maxHeight: '100vh', boxShadow: '6px 6px 12px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column' as const, padding: '24px 32px',
            overflowY: 'auto' as const,
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          // Header
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #e2e2e2', marginBottom: 24, flexShrink: 0 } },
            React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Adicionar passageiro'),
            React.createElement('button', {
              type: 'button', 'aria-label': 'Fechar',
              onClick: () => { setAddPassageiroOpen(false); setMalaDropdownOpen(false); },
              style: { width: 48, height: 48, borderRadius: '50%', background: '#f1f1f1', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
            }, React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
              React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })))),
          // Fields
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, flex: 1 } },
            addPassageiroField('ID do passageiro', 'id', 'ID do passageiro'),
            addPassageiroField('Nome completo', 'nome', 'Nome do passageiro'),
            addPassageiroField('Contato', 'contato', 'Ex: (21) 98888-7777'),
            malaDropdown,
            addPassageiroField('Valor', 'valor', 'R$ 0,00')),
          // Buttons
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, marginTop: 24, flexShrink: 0 } },
            React.createElement('button', {
              type: 'button', onClick: () => { setAddPassageiroOpen(false); setMalaDropdownOpen(false); showToast('Passageiro adicionado com sucesso'); },
              style: { width: '100%', height: 48, background: '#0d0d0d', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#fff', ...font },
            }, 'Adicionar passageiro'),
            React.createElement('button', {
              type: 'button', onClick: () => { setAddPassageiroOpen(false); setMalaDropdownOpen(false); },
              style: { width: '100%', height: 48, background: '#e2e2e2', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 500, color: '#b53838', ...font },
            }, 'Cancelar'))))
    : null;

  // ── Toast (Figma 814-24562) ─────────────────────────────────────────
  const checkCircleSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
    React.createElement('circle', { cx: 12, cy: 12, r: 11, fill: '#fff' }),
    React.createElement('path', { d: 'M9 12l2 2 4-4', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  const toastEl = toastMsg
    ? React.createElement('div', {
        key: toastMsg,
        style: {
          position: 'fixed' as const, bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: '#0d0d0d', borderRadius: 12, padding: '16px 24px',
          display: 'flex', alignItems: 'center', gap: 12, zIndex: 10000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap' as const,
          opacity: 1,
        },
      },
        checkCircleSvg,
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#fff', ...font } }, toastMsg))
    : null;

  // ── Image zoom modal (Figma 1170-26615) ──────────────────────────────
  const imageZoomModal = imageZoomOpen
    ? React.createElement('div', {
        style: {
          position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column' as const,
          alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 9999,
          padding: 32,
        },
        onClick: () => setImageZoomOpen(false),
      },
        // Enlarged image area
        React.createElement('div', {
          style: {
            width: '100%', maxWidth: 900, height: 675, borderRadius: 14,
            overflow: 'hidden' as const, background: '#fff8e6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          React.createElement('div', { style: { width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #cba04b 0%, #e8c96a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            locationPinSvg)),
        // Fechar button
        React.createElement('button', {
          type: 'button',
          onClick: () => setImageZoomOpen(false),
          style: {
            width: '100%', maxWidth: 514, height: 48, background: 'transparent',
            border: '1px solid #0d0d0d', borderRadius: 8, cursor: 'pointer',
            fontSize: 16, fontWeight: 500, color: '#0d0d0d', ...font,
            backgroundColor: 'rgba(255,255,255,0.95)',
          },
        }, 'Fechar'))
    : null;

  // ── Final render ─────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: webStyles.detailPage },
      headerSection,
      mainForm,
      motoristasSection,
      passageirosEncomendasRow,
      metricasSection,
      historicoSection,
      removeModal,
      editEncomendaPanel,
      addEncomendaPanel,
      addPassageiroPanel,
      imageZoomModal),
    toastEl);
}
