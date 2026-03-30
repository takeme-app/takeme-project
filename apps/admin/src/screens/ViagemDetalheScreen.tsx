/**
 * ViagemDetalheScreen — Detalhe da viagem (dados Supabase por :id ou state).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { fetchBookingDetailForAdmin, fetchMotoristas } from '../data/queries';
import type { BookingDetailForAdmin } from '../data/types';
import type { MotoristaListItem } from '../data/types';

function rowFromDetail(d: BookingDetailForAdmin): ViagemRow {
  const v = d.listItem;
  return {
    passageiro: v.passageiro,
    origem: v.origem,
    destino: v.destino,
    data: v.data,
    embarque: v.embarque,
    chegada: v.chegada,
    status: v.status,
  };
}

function fmtBRL(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tripDurationMin(depIso: string, arrIso: string): string {
  const a = new Date(depIso).getTime();
  const b = new Date(arrIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return '—';
  const m = Math.round((b - a) / 60000);
  return `${m} minutos`;
}

export default function ViagemDetalheScreen() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const stateObj = location.state as { trip?: ViagemRow; from?: string; motoristaNome?: string } | null;
  const [detail, setDetail] = useState<BookingDetailForAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [availDrivers, setAvailDrivers] = useState<MotoristaListItem[]>([]);
  const [selectedDriver, setSelectedDriver] = useState(0);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);

  const isMotoristas = location.pathname.startsWith('/motoristas');
  const isPassageiros = location.pathname.startsWith('/passageiros');
  const fromLabel = isMotoristas ? 'Motoristas'
    : isPassageiros ? 'Passageiros'
    : location.pathname.startsWith('/encomendas') ? 'Encomendas'
    : location.pathname.startsWith('/preparadores') ? 'Preparadores'
    : stateObj?.from || 'Viagens';

  useEffect(() => {
    let cancel = false;
    if (!id) {
      setLoading(false);
      return () => { cancel = true; };
    }
    // Histórico mock (PassageiroDetalhe) usa ids tipo act-1 — não consultar Supabase
    if (id.startsWith('act-')) {
      setDetail(null);
      setLoading(false);
      return () => { cancel = true; };
    }
    setLoading(true);
    fetchBookingDetailForAdmin(id).then((d) => {
      if (!cancel) {
        setDetail(d);
        setLoading(false);
      }
    });
    return () => { cancel = true; };
  }, [id]);

  useEffect(() => {
    if (!isMotoristas) return;
    fetchMotoristas().then((m) => setAvailDrivers(m.slice(0, 12)));
  }, [isMotoristas]);

  const t: ViagemRow | null = useMemo(() => {
    if (detail) return rowFromDetail(detail);
    return stateObj?.trip ?? null;
  }, [detail, stateObj]);

  const passengerNames = useMemo(() => {
    const names: string[] = [];
    if (detail) {
      names.push(detail.listItem.passageiro);
      detail.passengerData.forEach((p: { name?: string | null }) => { if (p.name) names.push(p.name); });
    } else if (t) {
      names.push(t.passageiro);
    }
    return [...new Set(names.filter(Boolean))];
  }, [detail, t]);

  if (loading) {
    return React.createElement('div', { style: webStyles.detailPage },
      React.createElement('p', { style: { padding: 32, fontFamily: 'Inter, sans-serif' } }, 'Carregando…'));
  }

  if (!t) {
    return React.createElement('div', { style: webStyles.detailPage },
      React.createElement('div', { style: webStyles.detailSection },
        React.createElement('p', null, id ? 'Viagem não encontrada.' : 'Nenhuma viagem selecionada.'),
        React.createElement('button', { type: 'button', style: webStyles.detailBackBtn, onClick: () => navigate(-1) }, arrowBackSvg, 'Voltar à lista')));
  }

  const v = detail?.listItem;
  const isMockTrip = !detail && !!t;
  const bagPct = detail?.trunkOccupancyPct != null
    ? `${detail.trunkOccupancyPct}%`
    : (detail ? `${Math.min(100, (detail.bagsCount ?? 1) * 15)}%` : '80%');
  const seatsHint = v?.driverId ? 'Ver viagem' : '—';

  const getDetailTimelineItems = (row: ViagemRow): DetailTimelineItem[] => [
    { id: 'inicio', icon: 'clock', label: 'Início', value: row.embarque },
    { id: 'origem', icon: 'origin', label: 'Origem', value: detail?.originFull || row.origem, showConnectorAfter: true },
    { id: 'destino', icon: 'destination', label: 'Destino', value: detail?.destinationFull || row.destino },
    { id: 'ocupacao', icon: 'inventory', label: 'Ocupação bagageiro', value: bagPct },
    { id: 'chegada', icon: 'clock', label: 'Horário de chegada', value: row.chegada },
  ];
  const timelineItems = getDetailTimelineItems(t);
  const detailSectionBorder = { borderBottom: '1px solid #e2e2e2', paddingBottom: 32 };

  const motoristaNome = detail
    ? (v?.motoristaNome ?? '—')
    : (stateObj?.motoristaNome ?? 'Matheus Barros');
  const motoristaBadge = !detail
    ? 'Motorista TakeMe'
    : (v?.motoristaCategoria === 'motorista' ? 'Motorista Parceiro' : 'Motorista TakeMe');
  const tripCount = v?.driverId ? availDrivers.find((x) => x.id === v.driverId)?.totalViagens : undefined;
  const motoristaTrips = detail
    ? (tripCount != null ? String(tripCount) : '—')
    : '120';
  const motoristaTripsLabel = detail ? `(${motoristaTrips} viagens)` : `(${motoristaTrips} viagens concluídas)`;

  const headsetIconSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M3 18v-6a9 9 0 0118 0v6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    React.createElement('path', { d: 'M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const starFilledSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', fill: '#F59E0B', stroke: '#F59E0B', strokeWidth: 1 }));

  const motoristaInfo = (label: string, value: string, icon: React.ReactNode) =>
    React.createElement('div', { style: webStyles.detailMotoristaInfoBlock },
      React.createElement('div', { style: webStyles.detailMotoristaInfoIconWrap }, icon),
      React.createElement('div', { style: webStyles.detailMotoristaInfoText },
        React.createElement('div', { style: webStyles.detailResumoLabel }, label),
        React.createElement('div', { style: webStyles.detailResumoValue }, value)));
  const motoristaDriverBlock = React.createElement('div', { style: webStyles.detailMotoristaDriverBlock },
    React.createElement('div', { style: webStyles.detailMotoristaAvatar }),
    React.createElement('div', { style: webStyles.detailMotoristaDriverInfo },
      React.createElement('div', { style: webStyles.detailMotoristaBadge },
        (detail ? v?.motoristaCategoria !== 'motorista' : true) ? logoArrowSmallSvg : null,
        motoristaBadge),
      React.createElement('span', { style: webStyles.detailMotoristaName }, motoristaNome),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        detail ? starSvg : starFilledSvg,
        React.createElement('span', { style: webStyles.detailMotoristaRating }, detail ? '—' : '4.8'),
        React.createElement('span', { style: webStyles.detailMotoristaRatingMuted }, motoristaTripsLabel))));
  const motoristaRow1 = React.createElement('div', { style: webStyles.detailMotoristaRow },
    motoristaDriverBlock,
    React.createElement('div', { style: webStyles.detailMotoristaInfoGroup },
      motoristaInfo(detail ? 'Lugares / info' : 'Lugares restantes', detail ? seatsHint : '1 vaga', peopleOutlineSvg),
      motoristaInfo('Chegada prevista', t.chegada, locationOnOutlineSvg)));
  const motoristaRow2 = React.createElement('div', { style: webStyles.detailMotoristaRow },
    React.createElement('div', { style: webStyles.detailMotoristaSpacer }),
    React.createElement('div', { style: webStyles.detailMotoristaInfoGroup },
      motoristaInfo('Saída', t.embarque, accessTimeOutlineSvg),
      motoristaInfo('Bagageiro', detail ? bagPct : 'Grande', inventoryOutlineSvg)));
  const motoristaCard = React.createElement('div', { style: webStyles.detailMotoristaCard },
    React.createElement('div', { style: webStyles.detailMotoristaCardInner },
      motoristaRow1,
      motoristaRow2));
  const motoristaSection = React.createElement('div', { style: webStyles.detailPassageirosSection },
    React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Motorista'),
    motoristaCard);

  const passageiroCard = (name: string) =>
    React.createElement('div', { style: { background: '#f6f6f6', borderRadius: 12, padding: 16, minWidth: 280, maxWidth: 330, flex: '1 1 280px', display: 'flex', flexDirection: 'column' as const, gap: 0 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottom: '1px solid #e2e2e2', justifyContent: 'space-between' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { width: 48, height: 48, borderRadius: '50%', background: '#e2e2e2', flexShrink: 0 } }),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, name),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 } },
              starFilledSvg,
              React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#545454', fontFamily: 'Inter, sans-serif' } }, '4.8')))),
        React.createElement('div', { style: { width: 40, height: 40, borderRadius: '50%', background: '#ffefc2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, headsetIconSvg)),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, paddingTop: 12 } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('span', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Mala'),
          React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, 'Média')),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('span', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Valor unitário:'),
          React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, 'R$ 150,00'))));

  const passageirosChevronBtn = React.createElement('button', {
    type: 'button',
    style: {
      width: 29, height: 29, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, flexShrink: 0,
    },
    'aria-label': 'Ver mais passageiros',
  },
    React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
      React.createElement('path', { d: 'M9 18l6-6-6-6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })));
  const passageirosSection = React.createElement('div', { style: webStyles.detailPassageirosSection },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16 } },
      React.createElement('h2', { style: { ...webStyles.detailSectionTitle, margin: 0 } }, 'Passageiros'),
      passageirosChevronBtn),
    React.createElement('div', { style: { display: 'flex', gap: 24, overflowX: 'auto' as const } },
      ...passengerNames.map((n) => passageiroCard(n))));

  const firstSection = React.createElement('div', { style: { ...webStyles.detailSection, ...detailSectionBorder } },
    React.createElement('div', { style: webStyles.detailBreadcrumb },
      React.createElement('span', null, fromLabel),
      React.createElement('span', { style: { margin: '0 4px' } }, '›'),
      React.createElement('span', { style: webStyles.detailBreadcrumbCurrent }, 'Detalhes da viagem')),
    React.createElement('div', { style: webStyles.detailToolbar },
      React.createElement('button', { type: 'button', style: webStyles.detailBackBtn, onClick: () => navigate(-1) }, arrowBackSvg, 'Voltar'),
      React.createElement('div', { style: { ...webStyles.detailDocBtns, gap: 8 } },
        isMotoristas ? React.createElement('button', { type: 'button', style: { ...webStyles.detailDocBtn, background: '#0d0d0d', color: '#fff', border: '1px solid #0d0d0d' } },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
            React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#fff', strokeWidth: 2 }),
            React.createElement('circle', { cx: 12, cy: 12, r: 3, fill: '#fff' })),
          'Acompanhar em tempo real') : null,
        React.createElement('button', { type: 'button', style: webStyles.detailDocBtn },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
            React.createElement('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', stroke: '#0d0d0d', strokeWidth: 2 }),
            React.createElement('path', { d: 'M14 2v6h6', stroke: '#0d0d0d', strokeWidth: 2 })),
          'Ver NF'),
        React.createElement('button', { type: 'button', style: webStyles.detailDocBtn },
          receiptSvg,
          'Recibo'),
        isMotoristas ? React.createElement('button', {
          type: 'button',
          onClick: () => navigate(`${location.pathname}/historico`, { state: location.state }),
          style: webStyles.detailDocBtn,
        },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
            React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#0d0d0d', strokeWidth: 2 }),
            React.createElement('path', { d: 'M12 6v6l4 2', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })),
          'Histórico') : null)),
    React.createElement('div', { style: webStyles.detailMapTimelineRow },
      React.createElement('div', { style: { ...webStyles.detailMapWrap, cursor: 'pointer', position: 'relative' as const }, onClick: () => setImageZoomOpen(true) },
        React.createElement('div', {
          style: {
            position: 'absolute', inset: 0,
            background: 'linear-gradient(165deg, #c8d9e8 0%, #dde8f0 35%, #e4ebe8 70%, #d0ddd5 100%)',
          },
        }),
        React.createElement('svg', {
          width: '100%', height: '100%', viewBox: '0 0 704 255', preserveAspectRatio: 'xMidYMid slice',
          style: { display: 'block', position: 'relative' as const, zIndex: 1 },
        },
          React.createElement('path', {
            d: 'M120 180 Q 280 40 420 100 T 620 70',
            fill: 'none', stroke: '#1a73e8', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.92,
          }),
          React.createElement('g', { transform: 'translate(108,168)' },
            React.createElement('circle', { r: 18, fill: '#0d0d0d' }),
            React.createElement('path', { d: 'M-4-2h8v6h-8z M0-8v4', stroke: '#fff', strokeWidth: 1.5, fill: 'none' })),
          React.createElement('circle', { cx: 598, cy: 62, r: 14, fill: '#1a73e8', stroke: '#fff', strokeWidth: 3 }),
          React.createElement('circle', { cx: 598, cy: 62, r: 5, fill: '#fff' }))),
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

  const bookingIdLabel = v?.bookingId ? `#${String(v.bookingId).slice(0, 8)}` : (isMockTrip ? '#123456' : (id ? `#${String(id).slice(0, 8)}` : '—'));
  const totalCents = detail?.amountCents ?? (isMockTrip ? 15430 : 0);
  const unitCents = detail && detail.passengerCount > 0 ? Math.round(totalCents / detail.passengerCount) : (isMockTrip ? 8000 : totalCents);
  const dur = v ? tripDurationMin(
    v.departureAtIso,
    new Date(new Date(v.departureAtIso).getTime() + 3600000).toISOString(),
  ) : (isMockTrip ? '50 minutos' : '—');
  const distKmLabel = isMockTrip ? '18,4 km' : '—';

  const resumoSection = React.createElement('div', { style: webStyles.detailSection },
    React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Resumo da Viagem'),
    React.createElement('div', { style: webStyles.detailResumoGrid },
      resumoItem(React.createElement('span', { style: { color: '#fff', fontSize: 14 } }, '*'), 'ID da viagem', bookingIdLabel),
      resumoItem(receiptSvg, 'Preço total', fmtBRL(totalCents)),
      resumoItem(calendarIconSvg, 'Data', t.data),
      resumoItem(timeSvg, 'Duração (estimada)', dur),
      resumoItem(receiptSvg, 'Valor unitário (médio)', fmtBRL(unitCents)),
      resumoItem(peopleSvgWhite, 'Total de passageiros', isMockTrip ? '4 pessoas' : `${detail?.passengerCount ?? 1} pessoa(s)`),
      resumoItem(receiptSvg, 'Despesas', isMockTrip ? 'R$ 80,00' : '—'),
      resumoItem(React.createElement('span', { style: { color: '#fff', fontSize: 12 } }, 'km'), 'Km da viagem', isMockTrip ? '120km' : distKmLabel)));

  const ocupacaoSection = React.createElement('div', { style: webStyles.detailSection },
    React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Ocupação e desempenho'),
    React.createElement('div', { style: webStyles.detailPerfCards },
      React.createElement('div', { style: webStyles.detailPerfCard },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('span', { style: { ...webStyles.detailPerfCardTitle, whiteSpace: 'pre-line' as const } }, 'Ocupação \nmédia do bagageiro'),
          React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, inventorySvgLight)),
        React.createElement('span', { style: webStyles.detailPerfCardValue }, bagPct)),
      React.createElement('div', { style: webStyles.detailPerfCard },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('span', { style: webStyles.detailPerfCardTitle }, 'Tempo total de viagem'),
          React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none' },
              React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#0d0d0d', strokeWidth: 2 }),
              React.createElement('path', { d: 'M12 6v6l4 2', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
        React.createElement('span', { style: webStyles.detailPerfCardValue }, isMockTrip ? '50 min' : dur)),
      React.createElement('div', { style: webStyles.detailPerfCard },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('span', { style: webStyles.detailPerfCardTitle }, 'Distância percorrida'),
          React.createElement('div', { style: { width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, chartLineSvg)),
        React.createElement('span', { style: webStyles.detailPerfCardValue }, distKmLabel))));

  const encomendasSection = React.createElement('div', { style: { ...webStyles.detailPassageirosSection, borderBottom: 'none' } },
    React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Encomendas'),
    React.createElement('p', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif' } },
      'Não há encomendas vinculadas a esta reserva no sistema.'));

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

  const driverField = (label: string, val: string) =>
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'Inter, sans-serif' } },
      React.createElement('span', { style: { color: '#767676', fontWeight: 500 } }, label),
      React.createElement('span', { style: { color: '#0d0d0d', fontWeight: 600 } }, val));

  type DriverCard = { nome: string; badge: string; rating: number; viagens: number; rota: string; data: string; horaSaida: string; valorTotal: string; valorUnitario: string; pessoasRestantes: string; ocupacao: string };

  const driverList: DriverCard[] = availDrivers.map((m) => ({
    nome: m.nome,
    badge: 'Motorista',
    rating: Number(m.rating ?? 0),
    viagens: m.totalViagens,
    rota: `${t.origem} → ${t.destino}`,
    data: t.data,
    horaSaida: t.embarque,
    valorTotal: '—',
    valorUnitario: '—',
    pessoasRestantes: '—',
    ocupacao: '—',
  }));

  const driverCard = (d: DriverCard, idx: number) =>
    React.createElement('button', {
      key: d.nome + idx, type: 'button',
      onClick: () => setSelectedDriver(idx),
      style: {
        flex: '1 1 calc(50% - 12px)', minWidth: 280, padding: 20, borderRadius: 16,
        border: selectedDriver === idx ? '2px solid #0d0d0d' : '1px solid #e2e2e2',
        background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, gap: 8, textAlign: 'left' as const,
      },
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          selectedDriver === idx ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null),
        React.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: '#cba04b', fontFamily: 'Inter, sans-serif' } }, d.badge)),
      React.createElement('span', { style: { fontSize: 15, fontWeight: 700, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, d.nome),
      React.createElement('span', { style: { fontSize: 12, color: '#767676', fontFamily: 'Inter, sans-serif' } }, `★ ${d.rating}  (${d.viagens} viagens)`),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, marginTop: 4 } },
        driverField('Origem - Destino', d.rota.length > 40 ? `${d.rota.slice(0, 40)}…` : d.rota),
        driverField('Data', d.data),
        driverField('Hora de saída', d.horaSaida),
        driverField('Valor total', d.valorTotal),
        driverField('Valor unitário', d.valorUnitario),
        driverField('Pessoas restantes', d.pessoasRestantes),
        driverField('Ocupação do bagageiro', d.ocupacao)));

  const motoristasDispSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
    React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, fontFamily: 'Inter, sans-serif' } }, 'Motoristas disponíveis'),
    driverList.length === 0
      ? React.createElement('p', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Nenhum motorista listado.')
      : React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        ...driverList.map((d, i) => driverCard(d, i))),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
      React.createElement('button', {
        type: 'button',
        style: {
          height: 44, padding: '0 28px', borderRadius: 999, border: '1px solid #e2e2e2',
          background: '#fff', fontSize: 14, fontWeight: 600, color: '#0d0d0d', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        },
      }, 'Confirmar substituição')));

  const contextSections = isMotoristas
    ? [motoristasDispSection, passageirosSection, encomendasSection]
    : isPassageiros
    ? [passageirosSection, motoristaSection, encomendasSection]
    : [motoristaSection, passageirosSection, encomendasSection];

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: webStyles.detailPage },
      firstSection,
      resumoSection,
      ocupacaoSection,
      ...contextSections),
    imageZoomModal);
}
