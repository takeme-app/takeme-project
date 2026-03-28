/**
 * ViagemDetalheScreen — Trip detail page extracted from App.tsx (lines 893-1003).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  webStyles,
  arrowBackSvg,
  calendarIconSvg,
  receiptSvg,
  timeSvg,
  inventorySvgLight,
  chartLineSvg,
  logoArrowSmallSvg,
  starSvg,
  peopleOutlineSvg,
  locationOnOutlineSvg,
  accessTimeOutlineSvg,
  inventoryOutlineSvg,
  detailTimelineIcons,
  statusStyles,
  statusLabels,
  statusPill,
  type ViagemRow,
  type DetailTimelineItem,
} from '../styles/webStyles';

export default function ViagemDetalheScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const trip = (location.state as { trip?: ViagemRow } | null)?.trip ?? null;

  if (!trip) {
    return React.createElement('div', { style: webStyles.detailPage },
      React.createElement('div', { style: webStyles.detailSection },
        React.createElement('p', null, 'Nenhuma viagem selecionada.'),
        React.createElement('button', { type: 'button', style: webStyles.detailBackBtn, onClick: () => navigate(-1) }, arrowBackSvg, 'Voltar à lista')));
  }

  const t = trip;
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const detailSectionBorder = { borderBottom: '1px solid #e2e2e2', paddingBottom: 32 };

  const getDetailTimelineItems = (t: ViagemRow): DetailTimelineItem[] => [
    { id: 'inicio', icon: 'clock', label: 'Início', value: t.embarque },
    { id: 'origem', icon: 'origin', label: 'Origem', value: t.origem, showConnectorAfter: true },
    { id: 'destino', icon: 'destination', label: 'Destino', value: t.destino },
    { id: 'ocupacao', icon: 'inventory', label: 'Ocupação bagageiro', value: '80%' },
    { id: 'chegada', icon: 'clock', label: 'Horário de chegada', value: t.chegada },
  ];

  const timelineItems = getDetailTimelineItems(t);

  // Card Motorista (Figma 792-15711)
  const motoristaInfo = (label: string, value: string, icon: React.ReactNode) =>
    React.createElement('div', { style: webStyles.detailMotoristaInfoBlock },
      React.createElement('div', { style: webStyles.detailMotoristaInfoIconWrap }, icon),
      React.createElement('div', { style: webStyles.detailMotoristaInfoText },
        React.createElement('div', { style: webStyles.detailResumoLabel }, label),
        React.createElement('div', { style: webStyles.detailResumoValue }, value)));
  const motoristaDriverBlock = React.createElement('div', { style: webStyles.detailMotoristaDriverBlock },
    React.createElement('div', { style: webStyles.detailMotoristaAvatar }),
    React.createElement('div', { style: webStyles.detailMotoristaDriverInfo },
      React.createElement('div', { style: webStyles.detailMotoristaBadge }, logoArrowSmallSvg, 'Motorista TakeMe'),
      React.createElement('span', { style: webStyles.detailMotoristaName }, 'Matheus Barros'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        starSvg,
        React.createElement('span', { style: webStyles.detailMotoristaRating }, '4.8'),
        React.createElement('span', { style: webStyles.detailMotoristaRatingMuted }, '(120 viagens concluídas)'))));
  const motoristaRow1 = React.createElement('div', { style: webStyles.detailMotoristaRow },
    motoristaDriverBlock,
    React.createElement('div', { style: webStyles.detailMotoristaInfoGroup },
      motoristaInfo('Lugares restantes', '1 vaga', peopleOutlineSvg),
      motoristaInfo('Chegada prevista', t.chegada, locationOnOutlineSvg)));
  const motoristaRow2 = React.createElement('div', { style: webStyles.detailMotoristaRow },
    React.createElement('div', { style: webStyles.detailMotoristaSpacer }),
    React.createElement('div', { style: webStyles.detailMotoristaInfoGroup },
      motoristaInfo('Saída', t.embarque, accessTimeOutlineSvg),
      motoristaInfo('Bagageiro', 'Grande', inventoryOutlineSvg)));
  const motoristaCard = React.createElement('div', { style: webStyles.detailMotoristaCard },
    React.createElement('div', { style: webStyles.detailMotoristaCardInner },
      motoristaRow1,
      motoristaRow2));
  const motoristaSection = React.createElement('div', { style: webStyles.detailPassageirosSection },
    React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Motorista'),
    motoristaCard);

  const headsetIconSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M3 18v-6a9 9 0 0118 0v6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    React.createElement('path', { d: 'M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const starFilledSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', fill: '#F59E0B', stroke: '#F59E0B', strokeWidth: 1 }));
  const passageiroCard = (name: string) =>
    React.createElement('div', { style: { background: '#f6f6f6', borderRadius: 12, padding: 16, minWidth: 280, flex: '1 1 0%', display: 'flex', flexDirection: 'column' as const, gap: 0 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: '1px solid #e2e2e2' } },
        React.createElement('div', { style: { width: 48, height: 48, borderRadius: '50%', background: '#e2e2e2', flexShrink: 0 } }),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, name),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 } },
            starFilledSvg,
            React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#545454', fontFamily: 'Inter, sans-serif' } }, '4.8'))),
        React.createElement('div', { style: { width: 40, height: 40, borderRadius: '50%', background: '#ffefc2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, headsetIconSvg)),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', paddingTop: 12 } },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Mala'),
          React.createElement('div', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, 'Média')),
        React.createElement('div', { style: { textAlign: 'right' as const } },
          React.createElement('div', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Valor unitário:'),
          React.createElement('div', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, 'R$ 150,00'))));
  const passageirosSection = React.createElement('div', { style: webStyles.detailPassageirosSection },
    React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Passageiros'),
    React.createElement('div', { style: { display: 'flex', gap: 24, overflowX: 'auto' as const } },
      passageiroCard('Maria Silva'),
      passageiroCard('Maria Silva'),
      passageiroCard('Maria Silva')));

  const firstSection = React.createElement('div', { style: { ...webStyles.detailSection, ...detailSectionBorder } },
    React.createElement('div', { style: webStyles.detailBreadcrumb },
      React.createElement('span', null, 'Viagens'),
      React.createElement('span', { style: { margin: '0 4px' } }, '›'),
      React.createElement('span', { style: webStyles.detailBreadcrumbCurrent }, 'Detalhes da viagem')),
    React.createElement('div', { style: webStyles.detailToolbar },
      React.createElement('button', { type: 'button', style: webStyles.detailBackBtn, onClick: () => navigate(-1) }, arrowBackSvg, 'Voltar'),
      React.createElement('div', { style: webStyles.detailDocBtns },
        React.createElement('button', { type: 'button', style: webStyles.detailDocBtn }, 'Ver NF'),
        React.createElement('button', { type: 'button', style: webStyles.detailDocBtn }, 'Recibo'))),
    React.createElement('div', { style: webStyles.detailMapTimelineRow },
      React.createElement('div', { style: { ...webStyles.detailMapWrap, cursor: 'pointer' }, onClick: () => setImageZoomOpen(true) },
        React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#767676', fontSize: 14 } }, 'Mapa do trajeto')),
      React.createElement('div', { style: webStyles.detailTimeline },
        React.createElement('div', { style: webStyles.detailTimelineBadgeWrap }, statusPill(statusLabels[t.status], statusStyles[t.status].bg, statusStyles[t.status].color)),
        React.createElement('div', { style: webStyles.detailTimelineRows },
          ...timelineItems.map((item) =>
            React.createElement('div', { key: item.id, style: webStyles.detailTimelineItem },
              item.showConnectorAfter
                ? React.createElement('div', { style: webStyles.detailTimelineIconCol },
                    React.createElement('div', { style: webStyles.detailTimelineIcon }, detailTimelineIcons[item.icon]),
                    React.createElement('div', { style: webStyles.detailTimelineConnector }))
                : React.createElement('div', { style: webStyles.detailTimelineIcon }, detailTimelineIcons[item.icon]),
              React.createElement('div', { style: webStyles.detailTimelineTextBlock },
                React.createElement('p', { style: webStyles.detailTimelineLabel }, item.label),
                React.createElement('p', { style: webStyles.detailTimelineValue }, item.value))))))));

  const resumoItem = (icon: React.ReactNode, label: string, value: string) =>
    React.createElement('div', { style: webStyles.detailResumoItem },
      React.createElement('div', { style: webStyles.detailResumoIcon }, icon),
      React.createElement('div', null,
        React.createElement('div', { style: webStyles.detailResumoLabel }, label),
        React.createElement('div', { style: webStyles.detailResumoValue }, value)));
  const peopleSvgWhite = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' }, React.createElement('path', { d: 'M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z', fill: '#fff' }));
  const resumoSection = React.createElement('div', { style: webStyles.detailSection },
      React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Resumo da Viagem'),
      React.createElement('div', { style: webStyles.detailResumoGrid },
        resumoItem(React.createElement('span', { style: { color: '#fff', fontSize: 14 } }, '*'), 'ID da viagem', '#123456'),
        resumoItem(receiptSvg, 'Preço total', 'R$ 154,30'),
        resumoItem(calendarIconSvg, 'Data', t.data),
        resumoItem(timeSvg, 'Duração', '50 minutos'),
        resumoItem(receiptSvg, 'Valor unitário', 'R$ 80,00'),
        resumoItem(peopleSvgWhite, 'Total de passageiros', '4 pessoas'),
        resumoItem(receiptSvg, 'Despesas', 'R$ 80,00'),
        resumoItem(React.createElement('span', { style: { color: '#fff', fontSize: 12 } }, 'km'), 'Km da viagem', '120km')));

  const ocupacaoSection = React.createElement('div', { style: webStyles.detailSection },
      React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Ocupação e desempenho'),
      React.createElement('div', { style: webStyles.detailPerfCards },
        React.createElement('div', { style: webStyles.detailPerfCard }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, React.createElement('span', { style: webStyles.detailPerfCardTitle }, 'Ocupação média do bagageiro'), React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, inventorySvgLight)), React.createElement('span', { style: webStyles.detailPerfCardValue }, '80%')),
        React.createElement('div', { style: webStyles.detailPerfCard }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, React.createElement('span', { style: webStyles.detailPerfCardTitle }, 'Tempo total de viagem'), React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none' }, React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#0d0d0d', strokeWidth: 2 }), React.createElement('path', { d: 'M12 6v6l4 2', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))), React.createElement('span', { style: webStyles.detailPerfCardValue }, '50 min')),
        React.createElement('div', { style: webStyles.detailPerfCard }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, React.createElement('span', { style: webStyles.detailPerfCardTitle }, 'Distância percorrida'), React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, chartLineSvg)), React.createElement('span', { style: webStyles.detailPerfCardValue }, '18,4 km'))));

  const encomendaFieldStyle = { minWidth: 0 } as React.CSSProperties;
  const encomendaLabelStyle = { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif' } as React.CSSProperties;
  const encomendaValueStyle = { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } as React.CSSProperties;
  const encomendaCard = (tamanho: string, valor: string, remetente: string, destinatario: string, recolha: string, entrega: string, obs: string) =>
    React.createElement('div', { style: { background: '#f6f6f6', borderRadius: 12, padding: '24px 16px', display: 'flex', flexDirection: 'column' as const, gap: 16 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 16 } },
        React.createElement('div', { style: { width: 48, height: 48, borderRadius: 10, background: '#e2e2e2', flexShrink: 0, cursor: 'pointer' }, onClick: () => setImageZoomOpen(true) }),
        React.createElement('div', { style: { display: 'flex', flex: 1, gap: 24, flexWrap: 'wrap' as const } },
          React.createElement('div', { style: encomendaFieldStyle },
            React.createElement('div', { style: encomendaLabelStyle }, 'Tamanho:'),
            React.createElement('div', { style: encomendaValueStyle }, tamanho)),
          React.createElement('div', { style: encomendaFieldStyle },
            React.createElement('div', { style: encomendaLabelStyle }, 'Valor:'),
            React.createElement('div', { style: encomendaValueStyle }, valor)),
          React.createElement('div', { style: encomendaFieldStyle },
            React.createElement('div', { style: encomendaLabelStyle }, 'Remetente:'),
            React.createElement('div', { style: encomendaValueStyle }, remetente)),
          React.createElement('div', { style: encomendaFieldStyle },
            React.createElement('div', { style: encomendaLabelStyle }, 'Destinatário:'),
            React.createElement('div', { style: encomendaValueStyle }, destinatario))),
        React.createElement('div', { style: { width: 40, height: 40, borderRadius: '50%', background: '#ffefc2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, headsetIconSvg)),
      React.createElement('div', { style: { display: 'flex', gap: 16, paddingLeft: 64 } },
        React.createElement('div', { style: { display: 'flex', flex: 1, gap: 24, flexWrap: 'wrap' as const } },
          React.createElement('div', { style: encomendaFieldStyle },
            React.createElement('div', { style: encomendaLabelStyle }, 'Recolha:'),
            React.createElement('div', { style: encomendaValueStyle }, recolha)),
          React.createElement('div', { style: encomendaFieldStyle },
            React.createElement('div', { style: encomendaLabelStyle }, 'Entrega'),
            React.createElement('div', { style: encomendaValueStyle }, entrega)),
          React.createElement('div', { style: { ...encomendaFieldStyle, flex: '2 1 200px' } },
            React.createElement('div', { style: encomendaLabelStyle }, 'Observações:'),
            React.createElement('div', { style: encomendaValueStyle }, obs)))));
  const encomendasSection = React.createElement('div', { style: { ...webStyles.detailPassageirosSection, borderBottom: 'none' } },
    React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Encomendas'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16 } },
      encomendaCard('Médio', 'R$ 80,00', 'Fernanda Lima', 'Ana Silva', 'Rua das Acácias, 45', 'Av. Central, 890', 'Frágil - manusear com cuidado'),
      encomendaCard('Pequeno', 'R$ 45,00', 'Pedro Pontes', 'Maria Silva', 'Rua das Acácias, 45', 'Av. Central, 890', 'Frágil - manusear com cuidado')));

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
        React.createElement('div', {
          style: {
            width: '100%', maxWidth: 900, height: 675, borderRadius: 14,
            overflow: 'hidden' as const, background: '#fff8e6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          React.createElement('div', { style: { color: '#767676', fontSize: 18, fontFamily: 'Inter, sans-serif' } }, 'Mapa do trajeto')),
        React.createElement('button', {
          type: 'button',
          onClick: () => setImageZoomOpen(false),
          style: {
            width: '100%', maxWidth: 514, height: 48, background: 'rgba(255,255,255,0.95)',
            border: '1px solid #0d0d0d', borderRadius: 8, cursor: 'pointer',
            fontSize: 16, fontWeight: 500, color: '#0d0d0d', fontFamily: 'Inter, sans-serif',
          },
        }, 'Fechar'))
    : null;

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: webStyles.detailPage },
      firstSection,
      resumoSection,
      ocupacaoSection,
      motoristaSection,
      passageirosSection,
      encomendasSection),
    imageZoomModal);
}
