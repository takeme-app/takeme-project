/**
 * ViagemDetalheScreen — Detalhe da viagem (dados Supabase por :id ou state).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  webStyles,
  DETAIL_TRIP_MAP_HEIGHT,
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
  liveFollowMyLocationSvg,
  type ViagemRow,
  type DetailTimelineItem,
} from '../styles/webStyles';
import { fetchBookingDetailForAdmin, fetchMotoristas, fetchShipmentsForScheduledTrip } from '../data/queries';
import { supabase } from '../lib/supabase';
import { resolveStorageDisplayUrl } from '../lib/storageDisplayUrl';
import type { BookingDetailForAdmin, TripShipmentListItem } from '../data/types';
import type { MotoristaListItem } from '../data/types';
import MapView from '../components/MapView';
import { useTripStops } from '../hooks/useTripStops';
import { useTripMapCoords } from '../hooks/useTripMapCoords';

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

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pendente de análise',
  confirmed: 'Confirmada',
  in_progress: 'Em andamento',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
};

function shipmentStatusLabel(status: string): string {
  return SHIPMENT_STATUS_LABEL[status] || status || '—';
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
  const [acompanharTempoReal, setAcompanharTempoReal] = useState(false);
  const [linkedShipments, setLinkedShipments] = useState<TripShipmentListItem[]>([]);
  const [tripCoords] = useTripMapCoords(detail);
  const [driverStats, setDriverStats] = useState<{ rating: number | null; totalTrips: number; avatarUrl: string | null }>({ rating: null, totalTrips: 0, avatarUrl: null });
  const [driverAvatarSrc, setDriverAvatarSrc] = useState<string | null>(null);
  const [passengerAvatarSrc, setPassengerAvatarSrc] = useState<string | null>(null);
  const [docActionToast, setDocActionToast] = useState<string | null>(null);

  useEffect(() => {
    if (!docActionToast) return;
    const t = setTimeout(() => setDocActionToast(null), 3500);
    return () => clearTimeout(t);
  }, [docActionToast]);

  useEffect(() => {
    const raw = detail?.listItem?.passageiroAvatarUrl;
    if (!raw) { setPassengerAvatarSrc(null); return; }
    let c = false;
    void resolveStorageDisplayUrl(supabase as any, raw).then((url) => { if (!c && url) setPassengerAvatarSrc(url); });
    return () => { c = true; };
  }, [detail?.listItem?.passageiroAvatarUrl]);

  useEffect(() => {
    if (!driverStats.avatarUrl) { setDriverAvatarSrc(null); return; }
    let c = false;
    void resolveStorageDisplayUrl(supabase as any, driverStats.avatarUrl).then((url) => { if (!c && url) setDriverAvatarSrc(url); });
    return () => { c = true; };
  }, [driverStats.avatarUrl]);

  // Multi-ponto: buscar paradas da viagem
  const tripIdForStops = detail?.listItem?.tripId || null;
  const { waypoints: tripWaypoints, stops: tripStops } = useTripStops(tripIdForStops);

  const driverStartCoord = useMemo(() => {
    const d = tripStops.find((s) => s.stop_type === 'driver_origin' && s.lat != null && s.lng != null);
    if (d) return { lat: d.lat!, lng: d.lng! };
    if (tripCoords.vehicleOrigin) return tripCoords.vehicleOrigin;
    return undefined;
  }, [tripStops, tripCoords.vehicleOrigin]);

  /**
   * “Acompanhar em tempo real”: o GPS do motorista existe só no dispositivo (expo-location no app).
   * Não há coluna/tabela de posição persistida no Supabase neste projeto — o mapa centra na partida
   * cadastrada (`driver_origin` / origem da viagem), não no movimento em tempo real do veículo.
   */
  const followTargetCoord = useMemo(
    () => driverStartCoord ?? tripCoords.origin,
    [driverStartCoord, tripCoords.origin],
  );

  const onFollowVehicleInterrupted = useCallback(() => setAcompanharTempoReal(false), []);

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

  // Fetch trip coordinates and linked shipments
  useEffect(() => {
    if (!detail?.listItem?.tripId) return;
    let cancel = false;
    const tripId = detail.listItem.tripId;
    const driverId = detail.listItem.driverId;
    // Driver stats (rating + total trips)
    if (driverId) {
      Promise.all([
        (supabase as any).from('worker_ratings').select('rating').eq('worker_id', driverId),
        (supabase as any).from('scheduled_trips').select('id').eq('driver_id', driverId),
        supabase.from('profiles').select('avatar_url').eq('id', driverId).single(),
      ]).then(([ratingsRes, tripsRes, profileRes]: any[]) => {
        if (cancel) return;
        const ratings = ratingsRes.data || [];
        const avgRating = ratings.length > 0 ? Math.round(ratings.reduce((s: number, r: any) => s + r.rating, 0) / ratings.length * 10) / 10 : null;
        setDriverStats({
          rating: avgRating,
          totalTrips: tripsRes.data?.length || 0,
          avatarUrl: profileRes.data?.avatar_url || null,
        });
      });
    }
    fetchShipmentsForScheduledTrip(tripId).then((rows) => {
      if (!cancel) setLinkedShipments(rows);
    });
    return () => { cancel = true; };
  }, [detail?.listItem?.tripId]);

  const t: ViagemRow | null = useMemo(() => {
    if (detail) return rowFromDetail(detail);
    return stateObj?.trip ?? null;
  }, [detail, stateObj]);

  const tripPainelConcluido = t?.status === 'concluído';

  /** Alinhado a `bookings.passenger_count`: titular + extras em `passenger_data`, sem duplicar nome do titular. */
  const passengerDisplayRows = useMemo(() => {
    type Row = { name: string; pData?: { name?: string; cpf?: string; bags?: number } };
    if (!detail) {
      return t ? [{ name: t.passageiro }] as Row[] : [];
    }
    const count = Math.max(1, Number(detail.passengerCount) || 1);
    const primary = (detail.listItem.passageiro || 'Sem nome').trim();
    const primaryKey = primary.toLowerCase();
    const primaryPData = detail.passengerData.find(
      (p) => (p.name || '').trim().toLowerCase() === primaryKey,
    );
    const rows: Row[] = [{ name: primary || 'Sem nome', pData: primaryPData }];
    const seen = new Set<string>([primaryKey]);
    for (const p of detail.passengerData) {
      if (rows.length >= count) break;
      const nm = (p.name || '').trim();
      if (!nm) continue;
      const k = nm.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push({ name: nm, pData: p });
    }
    return rows;
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
    : (stateObj?.motoristaNome ?? '—');
  const motoristaBadge = !detail
    ? 'Motorista TakeMe'
    : (v?.motoristaCategoria === 'motorista' ? 'Motorista Parceiro' : 'Motorista TakeMe');
  const motoristaTrips = driverStats.totalTrips > 0 ? String(driverStats.totalTrips) : '—';
  const motoristaTripsLabel = `(${motoristaTrips} viagens)`;
  const motoristaRating = driverStats.rating != null ? String(driverStats.rating) : '—';

  const starFilledSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', fill: '#F59E0B', stroke: '#F59E0B', strokeWidth: 1 }));

  const motoristaInfo = (label: string, value: string, icon: React.ReactNode) =>
    React.createElement('div', { style: webStyles.detailMotoristaInfoBlock },
      React.createElement('div', { style: webStyles.detailMotoristaInfoIconWrap }, icon),
      React.createElement('div', { style: webStyles.detailMotoristaInfoText },
        React.createElement('div', { style: webStyles.detailResumoLabel }, label),
        React.createElement('div', { style: webStyles.detailResumoValue }, value)));

  const motoristaDriverBlock = React.createElement('div', { style: webStyles.detailMotoristaDriverBlock },
    driverAvatarSrc
      ? React.createElement('img', { src: driverAvatarSrc, alt: motoristaNome, style: { ...webStyles.detailMotoristaAvatar, objectFit: 'cover' as const } })
      : React.createElement('div', { style: webStyles.detailMotoristaAvatar },
          React.createElement('span', { style: { color: '#767676', fontSize: 20, fontWeight: 600, fontFamily: 'Inter, sans-serif' } }, motoristaNome.charAt(0))),
    React.createElement('div', { style: webStyles.detailMotoristaDriverInfo },
      React.createElement('div', { style: webStyles.detailMotoristaBadge },
        (detail ? v?.motoristaCategoria !== 'motorista' : true) ? logoArrowSmallSvg : null,
        motoristaBadge),
      React.createElement('span', { style: webStyles.detailMotoristaName }, motoristaNome),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        driverStats.rating != null ? starFilledSvg : starSvg,
        React.createElement('span', { style: webStyles.detailMotoristaRating }, motoristaRating),
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

  const passageiroCard = (row: { name: string; pData?: { name?: string; cpf?: string; bags?: number } }, idx: number) => {
    const name = row.name;
    const pData = row.pData;
    const bags =
      pData?.bags != null && Number.isFinite(Number(pData.bags))
        ? Number(pData.bags)
        : detail && detail.passengerCount <= 1
          ? Math.max(1, detail.bagsCount ?? 1)
          : 1;
    const bagLabel = bags <= 1 ? 'Pequena' : bags <= 2 ? 'Média' : 'Grande';
    const unitPrice = detail && detail.passengerCount > 0
      ? fmtBRL(Math.round((detail.amountCents ?? 0) / detail.passengerCount))
      : 'R$ 150,00';
    const cpfLabel = pData?.cpf ? `CPF: ${pData.cpf}` : '';

    return React.createElement('div', { key: `pax-${idx}-${name}`, style: { background: '#f6f6f6', borderRadius: 12, padding: 16, minWidth: 280, maxWidth: 330, flex: '1 1 280px', display: 'flex', flexDirection: 'column' as const, gap: 0 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: 12, borderBottom: '1px solid #e2e2e2' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 } },
          idx === 0 && passengerAvatarSrc
            ? React.createElement('img', { src: passengerAvatarSrc, alt: name, style: { width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 } })
            : React.createElement('div', { style: { width: 48, height: 48, borderRadius: '50%', background: '#e2e2e2', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: '#767676', fontFamily: 'Inter, sans-serif' } },
                name.charAt(0).toUpperCase()),
          React.createElement('div', { style: { flex: 1, minWidth: 0 } },
            React.createElement('div', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, name),
            cpfLabel ? React.createElement('div', { style: { fontSize: 12, color: '#767676', fontFamily: 'Inter, sans-serif', marginTop: 2 } }, cpfLabel) : null,
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 } },
              starFilledSvg,
              React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#545454', fontFamily: 'Inter, sans-serif' } }, '—'))))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, paddingTop: 12 } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('span', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Mala'),
          React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, bagLabel)),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('span', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif' } }, 'Valor unitário:'),
          React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, unitPrice))));
  };

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
      ...passengerDisplayRows.map((row, i) => passageiroCard(row, i))));

  const acompanharTempoRealBtn = followTargetCoord
    ? React.createElement('button', {
      type: 'button',
      style: {
        ...webStyles.detailLiveFollowBtn,
        ...(acompanharTempoReal ? { boxShadow: 'inset 0 0 0 2px #C9A227' } : {}),
      },
      'aria-pressed': acompanharTempoReal,
      title: acompanharTempoReal
        ? 'Clique novamente ou arraste o mapa para sair do modo acompanhar'
        : 'Aproximar o mapa e manter o veículo centrado; segue atualizações de posição quando disponíveis.',
      onClick: () => setAcompanharTempoReal((v) => !v),
    },
      liveFollowMyLocationSvg,
      'Acompanhar em tempo real')
    : null;

  const firstSection = React.createElement('div', { style: { ...webStyles.detailSection, ...detailSectionBorder } },
    React.createElement('div', { style: webStyles.detailBreadcrumb },
      React.createElement('span', null, fromLabel),
      React.createElement('span', { style: { margin: '0 4px' } }, '›'),
      React.createElement('span', { style: webStyles.detailBreadcrumbCurrent }, 'Detalhes da viagem')),
    React.createElement('div', { style: webStyles.detailToolbar },
      React.createElement('button', { type: 'button', style: webStyles.detailBackBtn, onClick: () => navigate(-1) }, arrowBackSvg, 'Voltar'),
      React.createElement('div', { style: { ...webStyles.detailDocBtns, gap: 16 } },
        acompanharTempoRealBtn,
        React.createElement('button', {
          type: 'button',
          style: webStyles.detailDocBtn,
          title: 'Em desenvolvimento — emissão fiscal ainda não disponível no painel.',
          onClick: () => setDocActionToast('Emissão de nota fiscal ainda não está disponível neste painel.'),
        },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
            React.createElement('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', stroke: '#0d0d0d', strokeWidth: 2 }),
            React.createElement('path', { d: 'M14 2v6h6', stroke: '#0d0d0d', strokeWidth: 2 })),
          'Ver NF'),
        React.createElement('button', {
          type: 'button',
          style: webStyles.detailDocBtn,
          title: 'Em desenvolvimento — download de recibo ainda não disponível.',
          onClick: () => setDocActionToast('Download de recibo ainda não está disponível neste painel.'),
        },
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
      React.createElement('div', { style: { ...webStyles.detailMapWrap, position: 'relative' as const, overflow: 'hidden' } },
        React.createElement(MapView, {
          origin: tripCoords.origin,
          destination: tripCoords.destination,
          driverStart: driverStartCoord,
          waypoints: tripWaypoints.length > 0 ? tripWaypoints : undefined,
          height: DETAIL_TRIP_MAP_HEIGHT,
          staticMode: false,
          connectPoints: true,
          followVehicle: acompanharTempoReal,
          followTarget: acompanharTempoReal && followTargetCoord ? followTargetCoord : undefined,
          onFollowVehicleInterrupted: onFollowVehicleInterrupted,
          tripCompleted: tripPainelConcluido,
          style: { borderRadius: 0 },
        }),
        React.createElement('button', {
          type: 'button',
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); setImageZoomOpen(true); },
          style: {
            position: 'absolute' as const,
            top: 10,
            right: 10,
            zIndex: 2,
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: 'rgba(255,255,255,0.95)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            fontSize: 13,
            fontWeight: 600,
            color: '#0d0d0d',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          },
        }, 'Ampliar mapa')),
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

  // ── Resumo conforme Figma (3 colunas space-between, icones transparentes) ──
  const resumoIcon = (svg: React.ReactNode) =>
    React.createElement('div', {
      style: { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    }, svg);

  const resumoCell = (icon: React.ReactNode, label: string, value: string, hidden?: boolean) =>
    React.createElement('div', {
      style: { display: 'flex', gap: 16, alignItems: 'center', flex: '1 1 0', minWidth: 0, opacity: hidden ? 0 : 1 },
    },
      resumoIcon(icon),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0 } },
        React.createElement('div', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const, lineHeight: 1.5 } }, label),
        React.createElement('div', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const, lineHeight: 1.5 } }, value)));

  const resumoRow = (...cells: React.ReactNode[]) =>
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' },
    }, ...cells);

  // SVG icons (stroke #0d0d0d, no fill background)
  const iconId = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z', stroke: '#0d0d0d', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const iconMoney = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('rect', { x: 2, y: 6, width: 20, height: 12, rx: 2, stroke: '#0d0d0d', strokeWidth: 1.5 }),
    React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 1.5 }));
  const iconCalendar = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#0d0d0d', strokeWidth: 1.5 }),
    React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#0d0d0d', strokeWidth: 1.5, strokeLinecap: 'round' }));
  const iconClock = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#0d0d0d', strokeWidth: 1.5 }),
    React.createElement('path', { d: 'M12 6v6l4 2', stroke: '#0d0d0d', strokeWidth: 1.5, strokeLinecap: 'round' }));
  const iconBag = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z', stroke: '#0d0d0d', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const iconPeople = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', stroke: '#0d0d0d', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const iconChart = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M3 17l6-6 4 4 8-8', stroke: '#0d0d0d', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  const bookingIdLabel = v?.bookingId ? `#${String(v.bookingId).slice(0, 8)}` : (isMockTrip ? '#123456' : (id ? `#${String(id).slice(0, 8)}` : '—'));
  const totalCents = detail?.amountCents ?? (isMockTrip ? 15430 : 0);
  const unitCents = detail && detail.passengerCount > 0 ? Math.round(totalCents / detail.passengerCount) : (isMockTrip ? 8000 : totalCents);
  const dur = detail?.tripDepartureAtIso && detail?.tripArrivalAtIso
    ? tripDurationMin(detail.tripDepartureAtIso, detail.tripArrivalAtIso)
    : v
      ? tripDurationMin(
        v.departureAtIso,
        new Date(new Date(v.departureAtIso).getTime() + 3600000).toISOString(),
      )
      : (isMockTrip ? '50 minutos' : '—');
  const distKmLabel = isMockTrip ? '18,4 km' : '—';

  const resumoSection = React.createElement('div', {
    style: { borderBottom: '1px solid #e2e2e2', paddingBottom: 32, display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' },
  },
    React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif', margin: 0 } }, 'Resumo da Viagem'),
    resumoRow(
      resumoCell(iconId, 'ID da viagem', bookingIdLabel),
      resumoCell(iconMoney, 'Preço total', fmtBRL(totalCents)),
      resumoCell(iconCalendar, 'Data', t.data)),
    resumoRow(
      resumoCell(iconClock, 'Duração', dur),
      resumoCell(iconBag, 'Valor unitário', fmtBRL(unitCents)),
      resumoCell(iconPeople, 'Total de passageiros', `${detail?.passengerCount ?? 1} pessoa(s)`)),
    resumoRow(
      resumoCell(iconBag, 'Despesas', '—'),
      resumoCell(iconChart, 'Km da viagem', distKmLabel),
      resumoCell(iconPeople, '', '', true)));

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

  // ── Encomendas conforme Figma: linhas horizontais ──────────────────
  const encField = (label: string, value: string, multiline?: boolean) =>
    React.createElement('div', { style: { flex: '1 1 0', minWidth: 0 } },
      React.createElement('div', { style: { fontSize: 12, color: '#767676', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 } }, label),
      React.createElement('div', {
        style: {
          fontSize: 14, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
          ...(multiline
            ? { whiteSpace: 'normal' as const, wordBreak: 'break-word' as const }
            : { overflow: 'hidden', textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }),
        },
      }, value));

  const shipmentRow = (s: TripShipmentListItem) => {
    const ps = s.packageSize;
    const sizeLabel = ps === 'pequeno' ? 'Pequeno' : ps === 'medio' ? 'Médio' : ps === 'grande' ? 'Grande' : ps || '—';
    return React.createElement('div', {
      key: s.id,
      style: { background: '#f6f6f6', borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 16 },
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const } },
        s.photoUrl
          ? React.createElement('img', { src: s.photoUrl, alt: '', style: { width: 44, height: 44, borderRadius: 8, objectFit: 'cover' as const, flexShrink: 0 } })
          : React.createElement('div', { style: { width: 44, height: 44, borderRadius: 8, background: '#e2e2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 } }, '\u{1F4E6}'),
        encField('Tamanho:', sizeLabel),
        encField('Valor:', fmtBRL(s.amountCents)),
        encField('Remetente:', s.senderName),
        encField('Destinatário:', s.recipientName),
        encField('Status:', shipmentStatusLabel(s.status))),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        encField('Recolha:', s.originAddress || '—', true),
        encField('Entrega:', s.destinationAddress || '—', true),
        s.instructions
          ? encField('Observações:', s.instructions, true)
          : React.createElement('div', { style: { flex: '1 1 0', minWidth: 0 } })));
  };

  const encomendasSection = React.createElement('div', { style: { ...webStyles.detailPassageirosSection, borderBottom: 'none' } },
    React.createElement('h2', { style: webStyles.detailSectionTitle }, 'Encomendas'),
    linkedShipments.length === 0
      ? React.createElement('p', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif', maxWidth: 560, lineHeight: 1.5 } },
          'Não há encomendas associadas a esta viagem agendada. Envios aparecem aqui quando estão atribuídos à mesma viagem do motorista.')
      : React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16 } },
          ...linkedShipments.map(shipmentRow)));

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
            overflow: 'hidden' as const, background: '#e8e8e8',
            display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', flexShrink: 0,
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          React.createElement(MapView, {
            origin: tripCoords.origin,
            destination: tripCoords.destination,
            driverStart: driverStartCoord,
            waypoints: tripWaypoints.length > 0 ? tripWaypoints : undefined,
            height: 675,
            staticMode: false,
            connectPoints: true,
            followVehicle: acompanharTempoReal,
            followTarget: acompanharTempoReal && followTargetCoord ? followTargetCoord : undefined,
            onFollowVehicleInterrupted: onFollowVehicleInterrupted,
            tripCompleted: tripPainelConcluido,
            style: { borderRadius: 0, width: '100%', height: '100%' },
          })),
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

  const docToastEl = docActionToast
    ? React.createElement('div', {
      role: 'status',
      style: {
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 420,
        padding: '12px 20px',
        borderRadius: 12,
        backgroundColor: '#111827',
        color: '#fff',
        fontSize: 14,
        fontWeight: 500,
        fontFamily: 'Inter, sans-serif',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        zIndex: 9999,
        textAlign: 'center',
      },
    }, docActionToast)
    : null;

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: webStyles.detailPage },
      firstSection,
      resumoSection,
      ocupacaoSection,
      ...contextSections),
    imageZoomModal,
    docToastEl);
}
