/**
 * ViagemEditScreen — Edit trip page (Figma node 802:24098).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  webStyles,
  DETAIL_TRIP_MAP_HEIGHT,
  arrowBackSvg,
  starSvg,
  logoArrowSmallSvg,
  calendarIconSvg,
  statusPill,
  statusStyles,
  statusLabels,
  type ViagemRow,
} from '../styles/webStyles';
import {
  fetchBookingDetailForAdmin,
  fetchMotoristas,
  updateBookingFields,
  updateScheduledTripFields,
} from '../data/queries';
import type { BookingDetailForAdmin, MotoristaListItem } from '../data/types';
import MapView from '../components/MapView';
import { useTripStops } from '../hooks/useTripStops';
import { recalculateTripStops } from '../data/queries';
import PlacesAddressInput from '../components/PlacesAddressInput';
import { supabase } from '../lib/supabase';
import { useTripMapCoords } from '../hooks/useTripMapCoords';
import { geocodeAddress } from '../lib/googleGeocoding';

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
const warningSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const clockSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M12 6v6l4 2', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
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

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

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

function bagLabel(bags?: number): string {
  if (bags == null || !Number.isFinite(bags)) return '—';
  if (bags <= 1) return 'Pequena';
  if (bags <= 2) return 'Média';
  return 'Grande';
}

export default function ViagemEditScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const stateTrip = (location.state as { trip?: ViagemRow } | null)?.trip ?? null;

  const [detail, setDetail] = useState<BookingDetailForAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [driversList, setDriversList] = useState<MotoristaListItem[]>([]);

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [departureLocal, setDepartureLocal] = useState('');
  const [rota, setRota] = useState('');
  const [ocupacao, setOcupacao] = useState(0);
  const [selectedMotorista, setSelectedMotorista] = useState(0);
  const [dataMotorista, setDataMotorista] = useState('');
  const [removePassageiroIdx, setRemovePassageiroIdx] = useState<number | null>(null);
  const [editEncomendaIdx, setEditEncomendaIdx] = useState<number | null>(null);
  const [editEncomendaData, setEditEncomendaData] = useState({ nome: '', recolha: '', entrega: '', destinatario: '', telefone: '', observacoes: '' });
  const [addEncomendaOpen, setAddEncomendaOpen] = useState(false);
  const [addEncomendaData, setAddEncomendaData] = useState({ cliente: '', recolha: '', entrega: '', destinatario: '', contato: '', valor: '', observacoes: '' });
  const [addPassageiroOpen, setAddPassageiroOpen] = useState(false);
  const [addPassageiroData, setAddPassageiroData] = useState({ id: '', nome: '', contato: '', mala: '', valor: '' });
  const [malaDropdownOpen, setMalaDropdownOpen] = useState(false);

  // Busca de passageiro no banco
  // Multi-ponto
  const tripIdForStops = detail?.listItem?.tripId || null;
  const { waypoints: tripWaypoints, regenerate: regenerateStops } = useTripStops(tripIdForStops);

  const [passengerSearch, setPassengerSearch] = useState('');
  const [passengerResults, setPassengerResults] = useState<any[]>([]);
  const [passengerSearching, setPassengerSearching] = useState(false);
  const searchPassengers = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setPassengerResults([]); return; }
    setPassengerSearching(true);
    const q = query.trim().toLowerCase();
    const { data } = await (supabase as any)
      .from('profiles')
      .select('id, full_name, cpf, phone')
      .or(`full_name.ilike.%${q}%,cpf.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(8);
    setPassengerResults(data || []);
    setPassengerSearching(false);
  }, []);

  // ── Mapa e Veículo ───────────────────────────────────────────────────
  const [tripCoords, setTripCoords] = useTripMapCoords(detail);
  const [vehicleInfo, setVehicleInfo] = useState<{ model: string; plate: string; year: number | null } | null>(null);

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

  useEffect(() => {
    let cancel = false;
    const id = routeId;
    if (!id) {
      setLoading(false);
      setLoadError('ID da viagem ausente na URL.');
      return () => { cancel = true; };
    }
    setLoading(true);
    setLoadError(null);
    fetchBookingDetailForAdmin(id).then((d) => {
      if (cancel) return;
      if (!d) {
        setDetail(null);
        setLoadError('Reserva não encontrada.');
        setLoading(false);
        return;
      }
      setDetail(d);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [routeId]);

  useEffect(() => {
    fetchMotoristas().then((m) => setDriversList(m.slice(0, 24)));
  }, []);

  // Veículo do motorista (coordenadas do mapa vêm de useTripMapCoords)
  useEffect(() => {
    if (!detail?.listItem?.tripId) return;
    let cancel = false;
    const driverId = detail.listItem.driverId;
    if (driverId) {
      (supabase as any).from('vehicles')
        .select('model, plate, year')
        .eq('worker_id', driverId)
        .eq('is_active', true)
        .limit(1)
        .single()
        .then(({ data }: any) => {
          if (!cancel && data) setVehicleInfo(data);
        });
    } else {
      setVehicleInfo(null);
    }
    return () => { cancel = true; };
  }, [detail?.listItem?.tripId, detail?.listItem?.driverId]);

  useEffect(() => {
    if (!detail) return;
    setOrigem(detail.originFull || detail.listItem.origem);
    setDestino(detail.destinationFull || detail.listItem.destino);
    setDepartureLocal(toDatetimeLocalValue(detail.listItem.departureAtIso));
    setRota(`${detail.listItem.origem} → ${detail.listItem.destino}`);
    const trunk = detail.trunkOccupancyPct;
    setOcupacao(Number.isFinite(trunk) ? Math.min(100, Math.max(0, Math.round(trunk))) : 0);
    setDataMotorista(detail.listItem.data);
  }, [detail]);

  useEffect(() => {
    if (!detail || !driversList.length) return;
    const idx = driversList.findIndex((m) => m.id === detail.listItem.driverId);
    setSelectedMotorista(idx >= 0 ? idx : 0);
  }, [detail?.listItem.driverId, detail?.listItem.bookingId, driversList]);

  const trip: ViagemRow | null = useMemo(() => {
    if (detail) return rowFromDetail(detail);
    return stateTrip;
  }, [detail, stateTrip]);

  const saveTrip = useCallback(async () => {
    if (!detail?.listItem.bookingId) return;
    const depIso = fromDatetimeLocalValue(departureLocal);
    if (!depIso) {
      showToast('Defina um horário de partida válido.');
      return;
    }
    let oLat = tripCoords.origin?.lat ?? detail.originLat ?? null;
    let oLng = tripCoords.origin?.lng ?? detail.originLng ?? null;
    let dLat = tripCoords.destination?.lat ?? detail.destinationLat ?? null;
    let dLng = tripCoords.destination?.lng ?? detail.destinationLng ?? null;
    if (oLat == null || oLng == null) {
      const g = await geocodeAddress(origem);
      if (g) {
        oLat = g.lat;
        oLng = g.lng;
        setTripCoords((c) => ({ ...c, origin: { lat: g.lat, lng: g.lng } }));
      }
    }
    if (dLat == null || dLng == null) {
      const g = await geocodeAddress(destino);
      if (g) {
        dLat = g.lat;
        dLng = g.lng;
        setTripCoords((c) => ({ ...c, destination: { lat: g.lat, lng: g.lng } }));
      }
    }
    if (oLat == null || oLng == null || dLat == null || dLng == null) {
      showToast('Não foi possível obter coordenadas de origem e destino. Use as sugestões do Google ou configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.');
      return;
    }

    setSaving(true);
    const bErr = await updateBookingFields(detail.listItem.bookingId, {
      origin_address: origem,
      destination_address: destino,
      origin_lat: oLat,
      origin_lng: oLng,
      destination_lat: dLat,
      destination_lng: dLng,
    });
    let tErr: { error: string | null } = { error: null };
    if (detail.listItem.tripId && depIso) {
      const newDriverId = driversList[selectedMotorista]?.id ?? detail.listItem.driverId;
      tErr = await updateScheduledTripFields(detail.listItem.tripId, {
        departure_at: depIso,
        trunk_occupancy_pct: ocupacao,
        ...(newDriverId ? { driver_id: newDriverId } : {}),
      });
    }
    setSaving(false);
    const err = bErr.error || tErr.error;
    if (err) showToast(err);
    else {
      showToast('Viagem atualizada com sucesso');
      const d2 = await fetchBookingDetailForAdmin(detail.listItem.bookingId);
      if (d2) setDetail(d2);
    }
  }, [detail, departureLocal, origem, destino, ocupacao, driversList, selectedMotorista, showToast, tripCoords]);

  if (loading) {
    return React.createElement('div', { style: { ...webStyles.detailPage, padding: 40, fontFamily: 'Inter, sans-serif' } }, 'Carregando…');
  }

  if (loadError || !detail || !trip) {
    return React.createElement('div', { style: webStyles.detailPage },
      React.createElement('div', { style: webStyles.detailSection },
        React.createElement('p', null, loadError || 'Nenhuma viagem selecionada.'),
        React.createElement('button', { type: 'button', style: webStyles.detailBackBtn, onClick: () => navigate(-1) }, arrowBackSvg, 'Voltar à lista')));
  }

  // ── 1. Header Section ────────────────────────────────────────────────
  const headerSection = React.createElement('div', { style: { borderBottom: '1px solid #e2e2e2', paddingBottom: 32, display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
    // Breadcrumb
    React.createElement('div', { style: webStyles.detailBreadcrumb },
      React.createElement('span', null, location.pathname.startsWith('/motoristas') ? 'Motoristas' : location.pathname.startsWith('/passageiros') ? 'Passageiros' : location.pathname.startsWith('/encomendas') ? 'Encomendas' : location.pathname.startsWith('/preparadores') ? 'Preparadores' : 'Viagens'),
      React.createElement('span', { style: { margin: '0 4px' } }, '\u203A'),
      React.createElement('span', { style: webStyles.detailBreadcrumbCurrent }, 'Editar viagem')),
    // Toolbar
    React.createElement('div', { style: webStyles.detailToolbar },
      React.createElement('button', { type: 'button', style: { ...webStyles.detailBackBtn, borderRadius: 999 }, onClick: () => navigate(-1) },
        arrowBackSvg, 'Voltar'),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
        React.createElement('button', { type: 'button', onClick: () => navigate(-1), style: pillBtn('#f1f1f1', '#b53838') }, closeXSvg, 'Cancelar'),
        React.createElement('button', { type: 'button', disabled: saving, onClick: () => { void saveTrip(); }, style: pillBtn('#0d0d0d', '#ffffff', saving ? { opacity: 0.6, cursor: 'not-allowed' } : undefined) }, checkSvg, saving ? 'Salvando…' : 'Salvar alteração'))),
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
    // Mapa Mapbox GL (origem verde, destino vermelho, linha do trajeto) + ampliar
    React.createElement('div', { style: { position: 'relative' as const, borderRadius: 12, overflow: 'hidden', minHeight: DETAIL_TRIP_MAP_HEIGHT, height: DETAIL_TRIP_MAP_HEIGHT } },
      React.createElement(MapView, {
        origin: tripCoords.origin,
        destination: tripCoords.destination,
        waypoints: tripWaypoints.length > 0 ? tripWaypoints : undefined,
        height: DETAIL_TRIP_MAP_HEIGHT,
        staticMode: false,
        connectPoints: true,
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
          ...font,
        },
      }, 'Ampliar mapa')),
    // Section title
    React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#767676', ...font } }, 'Trajeto de origem e destino'),
    // Origem
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Origem'),
      React.createElement(PlacesAddressInput, {
        value: origem,
        onChange: setOrigem,
        onPlaceResolved: (p) => {
          setOrigem(p.formattedAddress);
          setTripCoords((c) => ({ ...c, origin: { lat: p.lat, lng: p.lng } }));
        },
        inputStyle,
        placeholder: 'Buscar endereço de origem…',
      })),
    // Destino
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Destino'),
      React.createElement(PlacesAddressInput, {
        value: destino,
        onChange: setDestino,
        onPlaceResolved: (p) => {
          setDestino(p.formattedAddress);
          setTripCoords((c) => ({ ...c, destination: { lat: p.lat, lng: p.lng } }));
        },
        inputStyle,
        placeholder: 'Buscar endereço de destino…',
      })),
    // Horário agendado
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Horário agendado para início'),
      React.createElement('div', { style: { position: 'relative' as const, width: '100%' } },
        React.createElement('div', { style: { position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const } }, calendarIconSvg),
        React.createElement('input', {
          type: 'datetime-local',
          value: departureLocal,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDepartureLocal(e.target.value),
          style: { ...inputStyle, paddingLeft: 40 },
        }))),
    // Helper text
    React.createElement('span', { style: grayText }, 'Alterar o horário de início atualizará automaticamente o tempo estimado de chegada.'));

  const rightColumn = React.createElement('div', { style: { width: 308, flexShrink: 0, position: 'sticky' as const, top: 0, alignSelf: 'flex-start' as const, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
    // Resumo title
    React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#767676', ...font } }, `Resumo da viagem \u2022 #${String(detail.listItem.bookingId).slice(0, 8)}`),
    // Status pill
    React.createElement('div', { style: { alignSelf: 'flex-start' } },
      statusPill(statusLabels[trip.status] || 'Agendado', statusStyles[trip.status]?.bg || '#a8c6ef', statusStyles[trip.status]?.color || '#102d57')),
    // Rota
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Rota'),
      React.createElement('input', { type: 'text', value: rota, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRota(e.target.value), style: inputStyle })),
    // Horário de saída (espelha partida agendada)
    React.createElement('div', { style: fieldWrap },
      React.createElement('label', { style: labelStyle }, 'Horario de saída'),
      React.createElement('div', { style: { position: 'relative' as const, width: '100%' } },
        React.createElement('div', { style: { position: 'absolute' as const, left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const } }, clockSvg),
        React.createElement('input', {
          type: 'datetime-local',
          value: departureLocal,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDepartureLocal(e.target.value),
          style: { ...inputStyle, paddingLeft: 40 },
        }))),
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
  type MotoristaCardRow = {
    name: string;
    badge: string;
    rating: string;
    trips: number;
    origemDestino: string;
    data: string;
    horaSaida: string;
    valorTotal: string;
    valorUnitario: string;
    pessoasRestantes: string;
    ocupacaoBag: string;
  };

  const motoristaRows: MotoristaCardRow[] = driversList.map((m) => ({
    name: m.nome,
    badge: 'Motorista',
    rating: m.rating != null ? String(m.rating) : '—',
    trips: m.totalViagens,
    origemDestino: rota,
    data: trip.data,
    horaSaida: trip.embarque,
    valorTotal: '—',
    valorUnitario: '—',
    pessoasRestantes: '—',
    ocupacaoBag: `${ocupacao}%`,
  }));

  const motoristaInfoRow = (label: string, value: string) =>
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' } },
      React.createElement('span', { style: grayText }, label),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, value));

  const motoristaCard = (m: MotoristaCardRow, idx: number) => {
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
      motoristaRows.length === 0
        ? React.createElement('p', { style: { ...grayText, margin: 0 } }, 'Nenhum motorista cadastrado.')
        : React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } },
          ...motoristaRows.map(motoristaCard)),
      // Confirm button
      React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
        React.createElement('button', { type: 'button', onClick: async () => {
          if (!detail?.listItem?.tripId) return;
          const newDriverId = driversList[selectedMotorista]?.id;
          if (!newDriverId) { showToast('Selecione um motorista primeiro.'); return; }
          setSaving(true);
          const { error } = await updateScheduledTripFields(detail.listItem.tripId, { driver_id: newDriverId });
          setSaving(false);
          if (error) { showToast(error); } else {
            showToast('Motorista substituído com sucesso! Recalculando rota...');
            // Recalcular stops com nova origem do motorista
            await recalculateTripStops(detail.listItem.tripId);
            await regenerateStops();
            const d2 = await fetchBookingDetailForAdmin(detail.listItem.bookingId);
            if (d2) setDetail(d2);
          }
        }, style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '8px 24px',
          borderRadius: 999, border: '1px solid #0d0d0d', background: 'transparent',
          cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font,
        } }, checkSvg, 'Confirmar substituição'))));

  // ── 4. Passageiros & Encomendas ──────────────────────────────────────
  const unitCents = detail.passengerCount > 0 ? Math.round(detail.amountCents / detail.passengerCount) : detail.amountCents;
  const passageiros: { name: string; rating: string; mala: string; valor: string }[] = [];
  passageiros.push({
    name: detail.listItem.passageiro,
    rating: '—',
    mala: bagLabel(detail.bagsCount),
    valor: fmtBRL(unitCents),
  });
  const seen = new Set<string>([detail.listItem.passageiro.trim().toLowerCase()]);
  detail.passengerData.forEach((p) => {
    const n = (p.name || '').trim();
    if (!n) return;
    const k = n.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    passageiros.push({ name: n, rating: '—', mala: bagLabel(p.bags), valor: fmtBRL(unitCents) });
  });

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
          React.createElement('button', {
            type: 'button',
            title: 'Remover passageiro',
            onClick: async () => {
              if (!detail?.listItem?.bookingId) return;
              const currentData = detail.passengerData || [];
              const newData = currentData.filter((_: any, i: number) => i !== idx);
              const { error } = await updateBookingFields(detail.listItem.bookingId, {
                passenger_data: newData,
                passenger_count: newData.length,
              } as any);
              if (error) { showToast(error); } else {
                showToast('Passageiro removido');
                const d2 = await fetchBookingDetailForAdmin(detail.listItem.bookingId);
                if (d2) setDetail(d2);
              }
            },
            style: { width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
          }, trashSvg))),
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
      React.createElement('button', {
        type: 'button',
        onClick: () => { setAddPassageiroOpen(true); setAddPassageiroData({ id: '', nome: '', contato: '', mala: '', valor: '' }); },
        style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', textDecoration: 'underline', alignSelf: 'flex-start', padding: 0, ...font },
      }, '+ Adicionar')));

  const encomendas: { name: string; recolha: string; entrega: string; destinatario: string; observacoes: string; valor: string }[] = [];

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
      encomendas.length === 0
        ? React.createElement('p', { style: { ...grayText, margin: 0 } }, 'Não há encomendas vinculadas a esta reserva no sistema.')
        : React.createElement(React.Fragment, null, ...encomendas.map(encomendaCard)),
      React.createElement('button', {
        type: 'button',
        onClick: () => { setAddEncomendaOpen(true); setAddEncomendaData({ cliente: '', recolha: '', entrega: '', destinatario: '', contato: '', valor: '', observacoes: '' }); },
        style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', textDecoration: 'underline', alignSelf: 'flex-start', padding: 0, ...font },
      }, '+ Adicionar')));

  const passageirosEncomendasRow = React.createElement('div', { style: { display: 'flex', gap: 24, width: '100%' } },
    passageirosSection, encomendasSection);

  // ── 5. Métricas e histórico ──────────────────────────────────────────
  const metricas = [
    { title: 'Ocupação do bagageiro', icon: inventorySvg, value: `${ocupacao}%` },
    { title: 'Passageiros (reserva)', icon: peopleSvg, value: String(detail.passengerCount) },
    { title: 'Encomendas vinculadas', icon: chartSvg, value: String(encomendas.length) },
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

  // ── 6. Histórico de alterações (sem tabela de auditoria — estado honesto)
  const historico: { icon: React.ReactNode; action: string; name: string; date: string }[] = [];

  const historicoItem = (h: (typeof historico)[0], idx: number) =>
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
    historico.length === 0
      ? React.createElement('p', { style: { ...grayText, margin: 0 } }, 'Não há registro de alterações no painel (sem fonte de auditoria).')
      : React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
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
              type: 'button', onClick: async () => {
                if (!addEncomendaData.destinatario.trim()) { showToast('Preencha ao menos o destinatário.'); return; }
                const { error } = await (supabase as any).from('shipments').insert({
                  user_id: detail?.userId || detail?.listItem?.bookingId,
                  origin_address: addEncomendaData.recolha.trim() || origem,
                  destination_address: addEncomendaData.entrega.trim() || destino,
                  recipient_name: addEncomendaData.destinatario.trim(),
                  recipient_phone: addEncomendaData.contato.trim() || null,
                  instructions: addEncomendaData.observacoes.trim() || null,
                  amount_cents: Math.round(parseFloat(addEncomendaData.valor.replace(/[^\d.,]/g, '').replace(',', '.') || '0') * 100),
                  package_size: 'medio',
                  status: 'confirmed',
                  when_option: 'now',
                  payment_method: 'pix',
                });
                if (error) { showToast(error.message || 'Erro ao criar encomenda'); } else {
                  showToast('Encomenda adicionada com sucesso');
                }
                setAddEncomendaOpen(false);
              },
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
            // Busca de passageiro existente
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%', position: 'relative' as const } },
              React.createElement('label', { style: labelStyle }, 'Buscar passageiro'),
              React.createElement('input', {
                type: 'text', value: passengerSearch, placeholder: 'CPF, nome ou telefone...',
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  setPassengerSearch(e.target.value);
                  searchPassengers(e.target.value);
                },
                style: { ...inputStyle, color: passengerSearch ? '#3a3a3a' : '#767676' },
              }),
              passengerResults.length > 0 ? React.createElement('div', {
                style: {
                  position: 'absolute' as const, top: 76, left: 0, right: 0, background: '#fff',
                  borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50,
                  maxHeight: 200, overflowY: 'auto' as const,
                },
              },
                ...passengerResults.map((p: any) =>
                  React.createElement('button', {
                    key: p.id, type: 'button',
                    onClick: () => {
                      setAddPassageiroData(prev => ({ ...prev, id: p.cpf || p.id, nome: p.full_name || '' }));
                      setPassengerSearch('');
                      setPassengerResults([]);
                    },
                    style: {
                      display: 'flex', flexDirection: 'column' as const, gap: 2, width: '100%',
                      padding: '10px 16px', background: 'none', border: 'none', borderBottom: '1px solid #e2e2e2',
                      cursor: 'pointer', textAlign: 'left' as const, ...font,
                    },
                  },
                    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d' } }, p.full_name || 'Sem nome'),
                    React.createElement('span', { style: { fontSize: 12, color: '#767676' } },
                      [p.cpf && `CPF: ${p.cpf}`, p.phone && `Tel: ${p.phone}`].filter(Boolean).join(' • '))))) : null,
              passengerSearching ? React.createElement('span', { style: { fontSize: 12, color: '#767676', marginTop: 4, ...font } }, 'Buscando...') : null),
            addPassageiroField('ID do passageiro', 'id', 'CPF ou ID do passageiro'),
            addPassageiroField('Nome completo', 'nome', 'Nome do passageiro'),
            addPassageiroField('Contato', 'contato', 'Ex: (21) 98888-7777'),
            malaDropdown,
            addPassageiroField('Valor', 'valor', 'R$ 0,00')),
          // Buttons
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, marginTop: 24, flexShrink: 0 } },
            React.createElement('button', {
              type: 'button', onClick: async () => {
                if (!detail?.listItem?.bookingId || !addPassageiroData.nome.trim()) { showToast('Preencha ao menos o nome.'); return; }
                const currentData = detail.passengerData || [];
                const bags = addPassageiroData.mala === 'Grande' ? 3 : addPassageiroData.mala === 'Média' ? 2 : 1;
                const newPassenger = { name: addPassageiroData.nome.trim(), cpf: addPassageiroData.id.trim() || '', bags };
                const newData = [...currentData, newPassenger];
                const { error } = await updateBookingFields(detail.listItem.bookingId, {
                  passenger_data: newData,
                  passenger_count: newData.length,
                } as any);
                if (error) { showToast(error); } else {
                  showToast('Passageiro adicionado com sucesso');
                  const d2 = await fetchBookingDetailForAdmin(detail.listItem.bookingId);
                  if (d2) setDetail(d2);
                }
                setAddPassageiroOpen(false); setMalaDropdownOpen(false);
              },
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
            overflow: 'hidden' as const, background: '#e8e8e8',
            display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', flexShrink: 0,
          },
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
          React.createElement(MapView, {
            origin: tripCoords.origin,
            destination: tripCoords.destination,
            height: 675,
            staticMode: false,
            connectPoints: true,
            style: { borderRadius: 0, width: '100%', height: '100%' },
          })),
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

  // Mapa do trajeto integrado no leftColumn (sem seção separada)

  // ── Info do veículo ─────────────────────────────────────────────────
  const vehicleSection = vehicleInfo ? React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 12, width: '100%', paddingBottom: 24, borderBottom: '1px solid #e2e2e2' },
  },
    React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Veículo'),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { flex: '1 1 200px', background: '#f6f6f6', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Modelo'),
        React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', ...font } }, vehicleInfo.model || '—')),
      React.createElement('div', { style: { flex: '1 1 150px', background: '#f6f6f6', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Placa'),
        React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', ...font } }, vehicleInfo.plate || '—')),
      React.createElement('div', { style: { flex: '1 1 100px', background: '#f6f6f6', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Ano'),
        React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', ...font } }, vehicleInfo.year ? String(vehicleInfo.year) : '—')))) : null;

  // ── Final render ─────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: webStyles.detailPage },
      headerSection,
      mainForm,
      vehicleSection,
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
