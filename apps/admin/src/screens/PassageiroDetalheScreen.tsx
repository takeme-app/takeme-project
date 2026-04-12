/**
 * PassageiroDetalheScreen — Detalhes do passageiro (Figma 1415-42889).
 * Aba «Histórico de atividades»: métricas + lista «Histórico de alterações» alinhadas ao Figma 802:24098 (nós 1185:39674, 1185:39705).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { webStyles, arrowBackSvg } from '../styles/webStyles';
import {
  fetchPassageiroPaymentMethods,
  updateProfileVerified,
  fetchDependentsByUser,
  updateDependentStatus,
  fetchPassageiroDetailForAdmin,
  fetchPassageiroBookings,
  fetchPassageiroEncomendas,
  saveProfileFields,
  insertPassengerPaymentMethodAdmin,
} from '../data/queries';
import type { PaymentMethodRow, ViagemListItem } from '../data/types';
import type { PassageiroEncomendaItem } from '../data/queries';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// ── SVG icons ────────────────────────────────────────────────────────────

// Mastercard icon
const mastercardIcon = React.createElement('svg', { width: 32, height: 20, viewBox: '0 0 32 20', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('circle', { cx: 12, cy: 10, r: 8, fill: '#EB001B' }),
  React.createElement('circle', { cx: 20, cy: 10, r: 8, fill: '#F79E1B' }),
  React.createElement('path', { d: 'M16 3.47a8 8 0 010 13.06 8 8 0 000-13.06z', fill: '#FF5F00' }));

// Visa icon
const visaIcon = React.createElement('svg', { width: 32, height: 20, viewBox: '0 0 32 20', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('rect', { x: 0, y: 0, width: 32, height: 20, rx: 3, fill: '#1A1F71' }),
  React.createElement('text', { x: 16, y: 14, textAnchor: 'middle', fill: '#fff', fontSize: 10, fontWeight: 700, fontFamily: 'Inter, sans-serif' }, 'VISA'));

// PIX icon
const pixIcon = React.createElement('svg', { width: 32, height: 20, viewBox: '0 0 32 20', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('rect', { x: 0, y: 0, width: 32, height: 20, rx: 3, fill: '#32BCAD' }),
  React.createElement('text', { x: 16, y: 14, textAnchor: 'middle', fill: '#fff', fontSize: 9, fontWeight: 700, fontFamily: 'Inter, sans-serif' }, 'PIX'));

// Apple Pay icon
const applePayIcon = React.createElement('svg', { width: 32, height: 20, viewBox: '0 0 32 20', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('rect', { x: 0, y: 0, width: 32, height: 20, rx: 3, fill: '#000' }),
  React.createElement('text', { x: 16, y: 13, textAnchor: 'middle', fill: '#fff', fontSize: 8, fontWeight: 600, fontFamily: 'Inter, sans-serif' }, 'Pay'));

// Edit pencil small
const editSmallSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Figma 1419:45624 — Cancelar (brand/red/red-600 + neutral-300)
const closeXSvgRed = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
// Figma 1419:45626 — Salvar (texto branco em black-500)
const checkSvgWhite = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Plus icon
const plusSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Ícones métricas (Figma 1185:39674 — admin, sem Tailwind)
const metricIconChart = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M3 3v18h18M7 16l4-4 4 4 5-7', stroke: '#0d0d0d', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const metricIconLuggage = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-10 0h10a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2z', stroke: '#0d0d0d', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const metricIconPeople = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm12 0a3 3 0 10-6 0', stroke: '#0d0d0d', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Ícones linha do histórico (Figma 1185:39705)
const histRowIconRoute = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M3 17l6-6 4 4 8-8', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
/** Mesmo traço da lista em PassageirosScreen — abrir detalhe da viagem. */
const eyeViewTripSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const accentActor = '#a37e38';

// ── Styles ────────────────────────────────────────────────────────────────
const s = {
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#767676', ...font,
  } as React.CSSProperties,
  breadcrumbLink: {
    color: '#767676', textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontSize: 14, ...font,
  } as React.CSSProperties,
  breadcrumbCurrent: {
    color: '#0d0d0d', fontWeight: 500, fontSize: 14, ...font,
  } as React.CSSProperties,
  /** Espaçamento vertical vem do `gap` do `main` (Layout); evitar margens que somem ao gap. */
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: 0,
  } as React.CSSProperties,
  backBtn: {
    display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 16, fontWeight: 500, color: '#0d0d0d', ...font,
  } as React.CSSProperties,
  /** Cabeçalho: Editar dados — Figma 1419:45624 (neutral-300, texto preto, pill 44). */
  editHeaderBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, minWidth: 104,
    padding: '8px 24px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    lineHeight: 1.5, whiteSpace: 'nowrap' as const, background: '#f1f1f1', color: '#0d0d0d', ...font,
  } as React.CSSProperties,
  /** Cancelar — Figma 1419:45625 (neutral-300 + red-600). */
  figmaBtnCancelar: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, minWidth: 104,
    padding: '8px 24px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    lineHeight: 1.5, whiteSpace: 'nowrap' as const, background: '#f1f1f1', color: '#b53838', ...font,
  } as React.CSSProperties,
  /** Salvar alteração — Figma 1419:45626 (black-500 + branco). */
  figmaBtnSalvar: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, minWidth: 104,
    padding: '8px 24px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    lineHeight: 1.5, whiteSpace: 'nowrap' as const, background: '#0d0d0d', color: '#fff', ...font,
  } as React.CSSProperties,
  tabsRow: {
    display: 'flex', gap: 0, borderBottom: '1px solid #e2e2e2', margin: 0,
  } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '12px 24px', fontSize: 16, fontWeight: active ? 600 : 400, color: active ? '#0d0d0d' : '#767676',
    borderBottom: active ? '2px solid #0d0d0d' : '2px solid transparent', marginBottom: -1,
    background: 'none', border: 'none', cursor: 'pointer', ...font,
  } as React.CSSProperties),
  /** Título de seção: margem inferior alinhada ao `gap` interno das colunas de aba (24). */
  sectionTitle: {
    fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: '0 0 0 0', ...font,
  } as React.CSSProperties,
  card: {
    border: '1px solid #e2e2e2', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 24,
  } as React.CSSProperties,
  subtitle: {
    fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font,
  } as React.CSSProperties,
  fieldRow: {
    display: 'flex', gap: 16, flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  fieldGroup: {
    display: 'flex', flexDirection: 'column' as const, gap: 4, flex: '1 1 200px', minWidth: 200,
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font,
  } as React.CSSProperties,
  fieldValue: {
    height: 44, background: '#f1f1f1', borderRadius: 8, display: 'flex', alignItems: 'center',
    paddingLeft: 16, paddingRight: 16, fontSize: 16, color: '#3a3a3a', ...font,
  } as React.CSSProperties,
  fieldInput: {
    height: 44, background: '#fff', borderRadius: 8, border: '1px solid #e2e2e2',
    paddingLeft: 16, paddingRight: 16, fontSize: 16, color: '#3a3a3a', outline: 'none',
    width: '100%', boxSizing: 'border-box' as const, ...font,
  } as React.CSSProperties,
  paymentGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
  } as React.CSSProperties,
  paymentCard: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
    border: '1px solid #e2e2e2', borderRadius: 12, background: '#fff',
  } as React.CSSProperties,
  paymentName: {
    fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font,
  } as React.CSSProperties,
  paymentDetails: {
    fontSize: 12, color: '#767676', ...font,
  } as React.CSSProperties,
  addPaymentBtn: {
    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
    padding: 0, fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font, marginTop: 4,
  } as React.CSSProperties,
};

/** Valor exibido como «—» vira string vazia no formulário de edição. */
function strFromDisplayField(v: string): string {
  const t = (v || '').trim();
  return t === '—' ? '' : t;
}

/** Este formulário aceita só PAN de 16 dígitos (4×4). */
const CARD_PAN_MAX_DIGITS = 16;
const CARD_PAN_PLACEHOLDER = '1231 2312 3123 1231';

function inferCardBrandFromPan(digits: string): string | null {
  if (digits.length < 2) return null;
  if (digits[0] === '4') return 'visa';
  if (digits[0] === '5') return 'mastercard';
  if (digits[0] === '6') return 'discover';
  if (digits.startsWith('34') || digits.startsWith('37')) return 'amex';
  return null;
}

function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

/** Ex.: 16 dígitos → «1231 2312 3123 1231» (grupos de 4). Até 19 dígitos para PAN longo. */
function formatCardPanDisplay(digits: string): string {
  if (!digits) return '';
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

function cardPanDigitsFromDisplay(display: string): string {
  return digitsOnly(display, CARD_PAN_MAX_DIGITS);
}

/** MM/AA a partir apenas de dígitos colados ou digitados. */
function formatExpiryDigits(raw: string): string {
  const d = digitsOnly(raw, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function isCardExpiryValid(mmYY: string): boolean {
  const m = mmYY.match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = parseInt(m[1], 10);
  const yy = parseInt(m[2], 10);
  if (month < 1 || month > 12) return false;
  const year = 2000 + yy;
  const now = new Date();
  const endOfExpiryMonth = new Date(year, month, 0, 23, 59, 59, 999);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return endOfExpiryMonth >= startOfThisMonth;
}

function luhnValid(panDigits: string): boolean {
  if (panDigits.length < 13 || panDigits.length > CARD_PAN_MAX_DIGITS) return false;
  let sum = 0;
  let alt = false;
  for (let i = panDigits.length - 1; i >= 0; i--) {
    let n = parseInt(panDigits[i], 10);
    if (Number.isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Nome no cartão: letras (incl. acentos), espaços e pontuação usual; sem dígitos. */
function sanitizeCardHolderName(raw: string): string {
  const max = 120;
  let out = '';
  for (const ch of raw) {
    if (out.length >= max) break;
    if (/\d/.test(ch)) continue;
    if (/[\p{L}\s'.-]/u.test(ch)) out += ch;
  }
  return out;
}

export default function PassageiroDetalheScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: idFromRoute } = useParams<{ id: string }>();
  const navState = location.state as { passageiro?: { id?: string; nome: string; cidade: string; estado: string; dataCriacao: string; cpf: string; status: string }; tab?: string; filter?: string } | null;
  const passageiroState = navState?.passageiro;

  const passageiroId = idFromRoute || passageiroState?.id || '';
  const [detailLoad, setDetailLoad] = useState<Awaited<ReturnType<typeof fetchPassageiroDetailForAdmin>>>(null);
  const [detailLoading, setDetailLoading] = useState(!!passageiroId);
  const [bookings, setBookings] = useState<ViagemListItem[]>([]);
  const [encomendas, setEncomendas] = useState<PassageiroEncomendaItem[]>([]);

  useEffect(() => {
    if (!passageiroId) {
      setDetailLoading(false);
      setDetailLoad(null);
      setBookings([]);
      setEncomendas([]);
      return;
    }
    let cancel = false;
    setDetailLoading(true);
    (async () => {
      const [d, b, e] = await Promise.all([
        fetchPassageiroDetailForAdmin(passageiroId),
        fetchPassageiroBookings(passageiroId),
        fetchPassageiroEncomendas(passageiroId),
      ]);
      if (cancel) return;
      setDetailLoad(d);
      setBookings(b);
      setEncomendas(e);
      setDetailLoading(false);
    })();
    return () => { cancel = true; };
  }, [passageiroId]);

  const passageiro = passageiroState ?? (detailLoad
    ? {
        nome: detailLoad.nome,
        cidade: detailLoad.cidade,
        estado: detailLoad.estado,
        dataCriacao: detailLoad.dataCriacao,
        cpf: detailLoad.cpf,
        status: detailLoad.status === 'Ativo' ? 'Verificado' : 'Pendente',
      }
    : undefined);

  const [activeTab, setActiveTab] = useState<'dados' | 'dependentes' | 'pagamentos' | 'historico'>(navState?.tab === 'historico' ? 'historico' : 'dados');
  const [histFilterType, setHistFilterType] = useState<'viagens' | 'encomendas'>(navState?.filter === 'encomendas' ? 'encomendas' : 'viagens');
  const isVerified = detailLoad ? detailLoad.status === 'Ativo' : passageiro?.status === 'Verificado';
  const [verifying, setVerifying] = useState(false);
  const [verifyConfirmOpen, setVerifyConfirmOpen] = useState(false);
  const [dependents, setDependents] = useState<any[]>([]);

  useEffect(() => {
    if (passageiroId) fetchDependentsByUser(passageiroId).then(setDependents);
  }, [passageiroId]);

  const [realPayMethods, setRealPayMethods] = useState<PaymentMethodRow[]>([]);
  useEffect(() => {
    if (passageiroId) fetchPassageiroPaymentMethods(passageiroId).then(setRealPayMethods);
  }, [passageiroId]);

  const brandIconMap: Record<string, React.ReactElement> = { mastercard: mastercardIcon, visa: visaIcon };
  const paymentMethods = realPayMethods.map((pm) => ({
    name: pm.holder_name || pm.brand || 'Cartão',
    type: pm.type === 'credit' ? 'Crédito' : 'Débito',
    lastDigits: pm.last_four || '',
    icon: brandIconMap[(pm.brand || '').toLowerCase()] || visaIcon,
  }));

  const viagensConcluidas = useMemo(() => bookings.filter((b) => b.status === 'concluído').length, [bookings]);
  const histMetricsData = useMemo(
    () => [
      { title: 'Viagens realizadas', value: String(viagensConcluidas), icon: metricIconChart },
      { title: 'Envios realizados', value: '—', icon: metricIconLuggage },
      { title: 'Excursões realizadas', value: '—', icon: metricIconPeople },
    ],
    [viagensConcluidas],
  );

  // ── Busca e filtro historico ─────────────────────────────────────────
  const [histSearch, setHistSearch] = useState('');
  const [histMonth, setHistMonth] = useState('');

  const filteredBookings = useMemo(() => {
    let result = bookings;
    if (histSearch.trim()) {
      const q = histSearch.trim().toLowerCase();
      result = result.filter((b) =>
        b.origem.toLowerCase().includes(q) ||
        b.destino.toLowerCase().includes(q) ||
        b.passageiro.toLowerCase().includes(q));
    }
    if (histMonth) {
      // histMonth is YYYY-MM
      result = result.filter((b) => b.departureAtIso?.startsWith(histMonth));
    }
    return result;
  }, [bookings, histSearch, histMonth]);

  const historicoAlteracoesRows = useMemo(
    () =>
      filteredBookings.map((b) => ({
        listItem: b,
        action: `Viagem (${b.status})`,
        actor: `${b.origem} → ${b.destino}`,
        when: `${b.data} · ${b.embarque}`,
        icon: histRowIconRoute,
        price: `R$ ${((b.amountCents || 0) / 100).toFixed(2)}`,
        passengers: String(b.passengerCount || 1),
        bagageiro: `${b.trunkOccupancyPct || 0}%`,
      })),
    [filteredBookings],
  );

  const recentPayments = useMemo(
    () => bookings.filter((b) => b.amountCents && b.amountCents > 0).slice(0, 15),
    [bookings],
  );
  const totalPago = useMemo(
    () => recentPayments.reduce((sum, b) => sum + (b.amountCents || 0), 0),
    [recentPayments],
  );

  // ── Add payment method modal state ────────────────────────────────────
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payType, setPayType] = useState<'credito' | 'debito'>('credito');
  const [payNome, setPayNome] = useState('');
  const [payNumero, setPayNumero] = useState('');
  const [payValidade, setPayValidade] = useState('');
  const [payCvv, setPayCvv] = useState('');
  const [payModalError, setPayModalError] = useState<string | null>(null);
  const [paySaving, setPaySaving] = useState(false);

  const [editingDados, setEditingDados] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editCidade, setEditCidade] = useState('');
  const [editEstado, setEditEstado] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileToastMsg, setProfileToastMsg] = useState<string | null>(null);

  const showProfileToast = useCallback((msg: string) => {
    setProfileToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!profileToastMsg) return;
    const t = setTimeout(() => setProfileToastMsg(null), 3500);
    return () => clearTimeout(t);
  }, [profileToastMsg]);

  const nome = passageiro?.nome ?? detailLoad?.nome ?? '—';
  const cpf = passageiro?.cpf ?? detailLoad?.cpf ?? '—';
  const cidade = passageiro?.cidade ?? detailLoad?.cidade ?? '—';
  const estado = passageiro?.estado ?? detailLoad?.estado ?? '—';
  const telefone = detailLoad?.phone ?? '—';

  const handleCancelEdits = useCallback(() => {
    setEditingDados(false);
    setProfileSaveError(null);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (!passageiroId) return;
    if (!editNome.trim()) {
      setProfileSaveError('Informe o nome completo.');
      return;
    }
    setSavingProfile(true);
    setProfileSaveError(null);
    const { error } = await saveProfileFields(passageiroId, {
      full_name: editNome.trim(),
      cpf: editCpf.trim() || null,
      phone: editTelefone.trim() || null,
      city: editCidade.trim() || null,
      state: editEstado.trim() || null,
    });
    setSavingProfile(false);
    if (error) {
      setProfileSaveError(error);
      return;
    }
    const d = await fetchPassageiroDetailForAdmin(passageiroId);
    if (d) setDetailLoad(d);
    setEditingDados(false);
    showProfileToast('Dados do passageiro salvos com sucesso.');
  }, [passageiroId, editNome, editCpf, editTelefone, editCidade, editEstado, showProfileToast]);

  const openEditDados = useCallback(() => {
    setProfileSaveError(null);
    setEditNome(strFromDisplayField(nome));
    setEditCpf(strFromDisplayField(cpf));
    setEditTelefone(strFromDisplayField(telefone));
    setEditCidade(strFromDisplayField(cidade));
    setEditEstado(strFromDisplayField(estado));
    setEditingDados(true);
    setActiveTab('dados');
    showProfileToast('Edição ativada. Use Salvar alteração para gravar.');
  }, [nome, cpf, telefone, cidade, estado, showProfileToast]);

  const handleConfirmVerifyProfile = useCallback(async () => {
    if (!passageiroId) return;
    setVerifying(true);
    await updateProfileVerified(passageiroId, true);
    setVerifying(false);
    setVerifyConfirmOpen(false);
    navigate(-1);
  }, [passageiroId, navigate]);

  if (!passageiroId) {
    return React.createElement('div', { style: { padding: 40, ...font } },
      React.createElement('p', { style: { margin: '0 0 16px' } }, 'Passageiro não identificado.'),
      React.createElement('button', { type: 'button', style: s.breadcrumbLink, onClick: () => navigate('/passageiros') }, 'Voltar à lista'));
  }

  if (detailLoading) {
    return React.createElement('div', { style: { padding: 40, ...font } }, 'Carregando…');
  }

  if (!detailLoad && !passageiroState) {
    return React.createElement('div', { style: { padding: 40, ...font } },
      React.createElement('p', { style: { margin: '0 0 16px' } }, 'Passageiro não encontrado.'),
      React.createElement('button', { type: 'button', style: s.breadcrumbLink, onClick: () => navigate('/passageiros') }, 'Voltar à lista'));
  }

  // ── Breadcrumb ───────────────────────────────────────────────────────
  const breadcrumb = React.createElement('div', { style: s.breadcrumb },
    React.createElement('button', {
      type: 'button', onClick: () => navigate(-1), style: s.breadcrumbLink,
    }, 'Passageiros'),
    React.createElement('span', null, '>'),
    React.createElement('span', { style: s.breadcrumbCurrent }, 'Detalhes do passageiro'));

  // ── Header row: ← Voltar + Editar dados ──────────────────────────────
  const headerRow = React.createElement('div', { style: s.headerRow },
    React.createElement('button', {
      type: 'button', onClick: () => navigate(-1), style: s.backBtn,
    }, arrowBackSvg, 'Voltar'),
    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'center' } },
      !isVerified && passageiroId ? React.createElement('button', {
        type: 'button',
        onClick: () => { setVerifyConfirmOpen(true); },
        disabled: verifying,
        style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px', borderRadius: 999, border: 'none', background: '#22c55e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: verifying ? 'wait' : 'pointer', ...font },
      }, 'Verificar perfil') : null,
      activeTab === 'dados'
        ? (editingDados
          ? React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 16, alignItems: 'center' } },
            React.createElement('button', {
              type: 'button',
              disabled: savingProfile,
              onClick: handleCancelEdits,
              style: {
                ...s.figmaBtnCancelar,
                cursor: savingProfile ? 'not-allowed' : 'pointer',
                opacity: savingProfile ? 0.6 : 1,
              },
            }, closeXSvgRed, 'Cancelar'),
            React.createElement('button', {
              type: 'button',
              disabled: savingProfile,
              title: 'Gravar alterações no perfil do passageiro',
              onClick: () => { void handleSaveProfile(); },
              style: {
                ...s.figmaBtnSalvar,
                cursor: savingProfile ? 'wait' : 'pointer',
                opacity: savingProfile ? 0.7 : 1,
              },
            }, savingProfile ? null : checkSvgWhite, savingProfile ? 'Salvando…' : 'Salvar alteração'))
          : React.createElement('button', {
            type: 'button',
            style: s.editHeaderBtn,
            title: 'Editar nome, CPF, telefone e endereço',
            onClick: openEditDados,
          }, editSmallSvg, 'Editar dados'))
        : null));

  // ── Tabs ──────────────────────────────────────────────────────────────
  const tabs = React.createElement('div', { style: s.tabsRow },
    React.createElement('button', {
      type: 'button', onClick: () => setActiveTab('dados'), style: s.tab(activeTab === 'dados'),
    }, 'Dados pessoais'),
    React.createElement('button', {
      type: 'button', onClick: () => setActiveTab('dependentes'), style: s.tab(activeTab === 'dependentes'),
    }, dependents.length > 0 ? `Dependentes (${dependents.length})` : 'Dependentes'),
    React.createElement('button', {
      type: 'button', onClick: () => setActiveTab('pagamentos'), style: s.tab(activeTab === 'pagamentos'),
    }, 'Pagamentos'),
    React.createElement('button', {
      type: 'button', onClick: () => setActiveTab('historico'), style: s.tab(activeTab === 'historico'),
    }, 'Histórico de atividades'));

  // ── Tab: Dados pessoais ───────────────────────────────────────────────
  const dadosFieldDisplay = (value: string) =>
    React.createElement('div', { style: s.fieldValue }, value);
  const dadosFieldEdit = (value: string, onChange: (v: string) => void, placeholder?: string) =>
    React.createElement('input', {
      type: 'text',
      value,
      placeholder: placeholder || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
      style: s.fieldInput,
    });

  const dadosTab = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24 } },
    editingDados && profileSaveError
      ? React.createElement('p', { style: { fontSize: 14, color: '#b53838', margin: 0, ...font } }, profileSaveError)
      : null,
    React.createElement('h2', { style: s.sectionTitle }, 'Dados do Passageiro'),
    React.createElement('div', { style: s.card },
      // Dados básicos
      React.createElement('h3', { style: s.subtitle }, 'Dados básicos'),
      // Row 1: Nome + CPF
      React.createElement('div', { style: s.fieldRow },
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'Nome completo'),
          editingDados
            ? dadosFieldEdit(editNome, setEditNome, 'Nome completo')
            : dadosFieldDisplay(nome)),
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'CPF'),
          editingDados
            ? dadosFieldEdit(editCpf, setEditCpf, '000.000.000-00')
            : dadosFieldDisplay(cpf))),
      // Row 2: Telefone + Cidade + Estado
      React.createElement('div', { style: s.fieldRow },
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'Telefone'),
          editingDados
            ? dadosFieldEdit(editTelefone, setEditTelefone, '(00) 00000-0000')
            : dadosFieldDisplay(telefone)),
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'Cidade'),
          editingDados
            ? dadosFieldEdit(editCidade, setEditCidade, 'Cidade')
            : dadosFieldDisplay(cidade)),
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'Estado'),
          editingDados
            ? dadosFieldEdit(editEstado, setEditEstado, 'UF')
            : dadosFieldDisplay(estado)))));

  // ── Tab: Dependentes ──────────────────────────────────────────────────
  const dependentesTab = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24 } },
    React.createElement('h2', { style: s.sectionTitle }, 'Dependentes'),
    dependents.length === 0
      ? React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Nenhum dependente cadastrado para este passageiro.')
      : null,
    ...dependents.map((dep: any, i: number) =>
      React.createElement('div', {
        key: dep.id || i,
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f6f6f6', borderRadius: 12, border: '1px solid #e2e2e2' },
      },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, dep.full_name),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } },
            [dep.age ? `${dep.age} anos` : null, dep.gender || null].filter(Boolean).join(' • ') || '—'),
          React.createElement('span', { style: { fontSize: 12, color: dep.status === 'validated' ? '#22c55e' : '#92400e', fontWeight: 600, ...font } },
            dep.status === 'validated' ? 'Validado' : 'Pendente de validação')),
        dep.status !== 'validated'
          ? React.createElement('button', {
              type: 'button',
              onClick: async () => {
                await updateDependentStatus(dep.id, 'validated');
                if (passageiroId) fetchDependentsByUser(passageiroId).then(setDependents);
              },
              style: { height: 36, padding: '0 16px', borderRadius: 999, border: 'none', background: '#22c55e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', ...font },
            }, 'Validar')
          : React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: '#22c55e', padding: '6px 12px', borderRadius: 999, background: '#e8f5e9', ...font } }, '✓ Validado'))));

  // ── Tab: Pagamentos ─────────────────────────────────────────────────
  const pagamentosTab = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24 } },
    // Métodos de pagamento
    React.createElement('h2', { style: s.sectionTitle }, 'Métodos de pagamento'),
    paymentMethods.length === 0
      ? React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Nenhum método de pagamento cadastrado.')
      : React.createElement('div', { style: s.paymentGrid },
        ...paymentMethods.map((pm, i) =>
          React.createElement('div', { key: i, style: s.paymentCard },
            pm.icon,
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const } },
              React.createElement('span', { style: s.paymentName },
                pm.lastDigits ? `${pm.name} ${pm.type.toLowerCase()} ••••${pm.lastDigits}` : pm.name),
              pm.type && pm.lastDigits
                ? React.createElement('span', { style: s.paymentDetails }, pm.type)
                : null)))),
    React.createElement('button', {
      type: 'button',
      style: s.addPaymentBtn,
      onClick: () => {
        setPayNome('');
        setPayNumero('');
        setPayValidade('');
        setPayCvv('');
        setPayModalError(null);
        setPaySaving(false);
        setPayType('credito');
        setPayModalOpen(true);
      },
    }, plusSvg, 'Adicionar método de pagamento'),

    // Separator
    React.createElement('div', { style: { width: '100%', height: 1, background: '#e2e2e2' } }),

    // Histórico de pagamentos
    React.createElement('h3', { style: s.subtitle }, 'Histórico de pagamentos'),
    totalPago > 0
      ? React.createElement('div', {
          style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, marginBottom: 8 },
        },
          React.createElement('div', { style: { flex: '1 1 200px', background: '#f6f6f6', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8 } },
            React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, 'Total gasto'),
            React.createElement('span', { style: { fontSize: 28, fontWeight: 700, color: '#0d0d0d', ...font } }, `R$ ${(totalPago / 100).toFixed(2)}`)),
          React.createElement('div', { style: { flex: '1 1 200px', background: '#f6f6f6', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8 } },
            React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, 'Viagens pagas'),
            React.createElement('span', { style: { fontSize: 28, fontWeight: 700, color: '#0d0d0d', ...font } }, String(recentPayments.length))))
      : null,
    recentPayments.length === 0
      ? React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Nenhum pagamento registrado.')
      : null,
    ...recentPayments.map((b, idx) =>
      React.createElement('div', {
        key: idx,
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f6f6f6', borderRadius: 12, border: '1px solid #e2e2e2' },
      },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0, flex: 1 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, `${b.origem} → ${b.destino}`),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, `${b.data} · ${b.status}`)),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: '#0d0d0d', ...font, flexShrink: 0 } },
          `R$ ${((b.amountCents || 0) / 100).toFixed(2)}`))));

  // ── Tab: Histórico (Figma 802:24098 — blocos 1185:39674 + 1185:39705) ──
  const metricsSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
    React.createElement('p', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 'normal', ...font } }, 'Métricas e histórico'),
    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 24, width: '100%' } },
      ...histMetricsData.map((m) =>
        React.createElement('div', {
          key: m.title,
          style: {
            flex: '1 1 280px',
            minWidth: 0,
            background: '#f6f6f6',
            borderRadius: 16,
            paddingLeft: 24,
            paddingRight: 24,
          },
        },
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 56, width: '100%' } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, width: '100%' } },
              React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font } }, m.title),
              React.createElement('div', {
                style: {
                  width: 44, height: 44, borderRadius: 999, background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                },
              }, m.icon)),
            React.createElement('div', { style: { paddingBottom: 16 } },
              React.createElement('p', {
                style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, lineHeight: 1.5, fontFamily: "'Open Sans', Inter, sans-serif" },
              }, m.value)))))));

  // Search + month filter row
  const histFilterRow = React.createElement('div', { style: { display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'center', width: '100%' } },
    React.createElement('input', {
      type: 'text', value: histSearch, placeholder: 'Buscar por destino ou origem...',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHistSearch(e.target.value),
      style: { flex: '1 1 200px', height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, outline: 'none', ...font },
    }),
    React.createElement('input', {
      type: 'month', value: histMonth,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setHistMonth(e.target.value),
      style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, outline: 'none', ...font },
    }),
    histMonth ? React.createElement('button', {
      type: 'button', onClick: () => setHistMonth(''),
      style: { height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #e2e2e2', background: '#fff', fontSize: 13, cursor: 'pointer', ...font },
    }, 'Limpar') : null);

  const histTypeToggle = React.createElement('div', { style: { display: 'flex', gap: 8 } },
    React.createElement('button', {
      type: 'button', onClick: () => setHistFilterType('viagens'),
      style: {
        height: 36, padding: '0 16px', borderRadius: 999, border: histFilterType === 'viagens' ? 'none' : '1px solid #e2e2e2',
        background: histFilterType === 'viagens' ? '#0d0d0d' : '#fff', color: histFilterType === 'viagens' ? '#fff' : '#0d0d0d',
        fontSize: 13, fontWeight: 600, cursor: 'pointer', ...font,
      },
    }, 'Viagens'),
    React.createElement('button', {
      type: 'button', onClick: () => setHistFilterType('encomendas'),
      style: {
        height: 36, padding: '0 16px', borderRadius: 999, border: histFilterType === 'encomendas' ? 'none' : '1px solid #e2e2e2',
        background: histFilterType === 'encomendas' ? '#0d0d0d' : '#fff', color: histFilterType === 'encomendas' ? '#fff' : '#0d0d0d',
        fontSize: 13, fontWeight: 600, cursor: 'pointer', ...font,
      },
    }, `Encomendas (${encomendas.length})`));

  const statusLabelMap: Record<string, string> = {
    pending_review: 'Aguardando aprovação',
    confirmed: 'Confirmada',
    in_progress: 'Em andamento',
    delivered: 'Entregue',
    cancelled: 'Cancelada',
  };
  const statusColorMap: Record<string, string> = {
    pending_review: '#cba04b',
    confirmed: '#2563eb',
    in_progress: '#f59e0b',
    delivered: '#22c55e',
    cancelled: '#b53838',
  };

  const encomendasSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12, width: '100%' } },
    encomendas.length === 0
      ? React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Nenhuma encomenda registrada para este passageiro.')
      : null,
    ...encomendas.map((enc) =>
      React.createElement('div', {
        key: enc.id,
        style: {
          display: 'flex', alignItems: 'center', gap: 16, padding: 16,
          background: '#f1f1f1', borderRadius: 12, width: '100%', boxSizing: 'border-box' as const,
        },
      },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0, flex: 1 } },
          React.createElement('p', { style: { margin: 0, fontSize: 15, fontWeight: 600, color: '#0d0d0d', lineHeight: 1.5, ...font } },
            `${enc.origem} → ${enc.destino}`),
          React.createElement('p', { style: { margin: 0, fontSize: 13, color: '#767676', ...font } },
            enc.createdAt ? new Date(enc.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')),
        React.createElement('span', {
          style: { fontSize: 12, fontWeight: 600, color: statusColorMap[enc.status] || '#767676', ...font },
        }, statusLabelMap[enc.status] || enc.status),
        React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: '#0d0d0d', ...font, minWidth: 70, textAlign: 'right' as const } },
          `R$ ${(enc.amountCents / 100).toFixed(2).replace('.', ',')}`),
        enc.packageSize !== '—' ? React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, enc.packageSize) : null)));

  const historicoAlteracoesSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 } },
      React.createElement('p', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 'normal', ...font } },
        histFilterType === 'encomendas' ? 'Histórico de encomendas' : 'Histórico de viagens'),
      histTypeToggle),
    histFilterType === 'encomendas' ? encomendasSection : null,
    histFilterType === 'viagens' ? histFilterRow : null,
    histFilterType === 'viagens' && historicoAlteracoesRows.length === 0
      ? React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Nenhuma viagem registrada para este passageiro.')
      : null,
    ...(histFilterType === 'viagens' ? historicoAlteracoesRows : []).map((row, idx) =>
      React.createElement('div', {
        key: row.listItem.bookingId || idx,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 16,
          background: '#f1f1f1',
          borderRadius: 12,
          width: '100%',
          boxSizing: 'border-box' as const,
        },
      },
        React.createElement('div', {
          style: {
            width: 40, height: 40, borderRadius: 999, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          },
        }, row.icon),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0, flex: 1 } },
          React.createElement('p', { style: { margin: 0, fontSize: 16, fontWeight: 600, color: '#0d0d0d', lineHeight: 1.5, ...font } },
            React.createElement('span', null, `${row.action} • `),
            React.createElement('span', { style: { color: accentActor } }, row.actor)),
          React.createElement('p', { style: { margin: 0, fontSize: 14, fontWeight: 500, color: '#767676', lineHeight: 1.5, ...font } }, row.when)),
        // Extra columns: price, passengers, bagageiro, ver viagem
        React.createElement('div', { style: { display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' } },
          React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: '#0d0d0d', ...font, minWidth: 70, textAlign: 'right' as const } }, row.price),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font, minWidth: 50 } }, `${row.passengers} pax`),
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font, minWidth: 40 } }, row.bagageiro),
          row.listItem.bookingId && passageiroId
            ? React.createElement('button', {
              type: 'button',
              'aria-label': 'Visualizar viagem',
              style: webStyles.viagensActionBtn,
              onClick: () => {
                const b = row.listItem;
                navigate(`/passageiros/${passageiroId}/viagem/${b.bookingId}`, {
                  state: {
                    trip: {
                      passageiro: b.passageiro,
                      origem: b.origem,
                      destino: b.destino,
                      data: b.data,
                      embarque: b.embarque,
                      chegada: b.chegada,
                      status: b.status,
                    },
                  },
                });
              },
            }, eyeViewTripSvg)
            : null))));

  const historicoTab = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24, width: '100%' } },
    metricsSection,
    historicoAlteracoesSection);

  // ── Credit card icon for payment modal ─────────────────────────────────
  const creditCardSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('rect', { x: 1, y: 4, width: 22, height: 16, rx: 2, stroke: '#cba04b', strokeWidth: 2 }),
    React.createElement('line', { x1: 1, y1: 10, x2: 23, y2: 10, stroke: '#cba04b', strokeWidth: 2 }));

  // ── Close X icon ──────────────────────────────────────────────────────
  const closeSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  // ── Radio circle ──────────────────────────────────────────────────────
  const radioCircle = (selected: boolean) => React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
    React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: selected ? '#0d0d0d' : '#767676', strokeWidth: 2, fill: 'none' }),
    selected ? React.createElement('circle', { cx: 12, cy: 12, r: 6, fill: '#0d0d0d' }) : null);

  const payFieldBaseStyle: React.CSSProperties = {
    height: 44, background: '#f1f1f1', borderRadius: 8, border: 'none', paddingLeft: 16, paddingRight: 16,
    fontSize: 16, color: '#3a3a3a', outline: 'none', width: '100%', boxSizing: 'border-box', ...font,
  };

  /** Nome: só texto (sem dígitos); colar é normalizado no onChange. */
  const payInputHolder = (label: string, value: string, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
      React.createElement('input', {
        type: 'text',
        inputMode: 'text',
        autoComplete: 'cc-name',
        value,
        placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          setPayModalError(null);
          setPayNome(sanitizeCardHolderName(e.target.value));
        },
        style: payFieldBaseStyle,
      }));

  /** PAN: apenas dígitos na prática; exibição com grupos de 4. */
  const payInputPan = (label: string, value: string, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
      React.createElement('input', {
        type: 'text',
        inputMode: 'numeric',
        pattern: '[0-9 ]*',
        autoComplete: 'off',
        'data-lpignore': 'true',
        maxLength: 19,
        value,
        placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          setPayModalError(null);
          const d = cardPanDigitsFromDisplay(e.target.value);
          setPayNumero(formatCardPanDisplay(d));
        },
        style: { ...payFieldBaseStyle, fontVariantNumeric: 'tabular-nums' as const },
      }));

  /** Validade MM/AA — só dígitos; barra inserida automaticamente. */
  const payInputExpiry = (label: string, value: string, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
      React.createElement('input', {
        type: 'text',
        inputMode: 'numeric',
        autoComplete: 'cc-exp',
        maxLength: 5,
        value,
        placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          setPayModalError(null);
          setPayValidade(formatExpiryDigits(e.target.value));
        },
        style: payFieldBaseStyle,
      }));

  /** CVV: só dígitos, 3–4. */
  const payInputCvv = (label: string, value: string, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
      React.createElement('input', {
        type: 'text',
        inputMode: 'numeric',
        pattern: '[0-9]*',
        maxLength: 4,
        autoComplete: 'cc-csc',
        value,
        placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          setPayModalError(null);
          setPayCvv(digitsOnly(e.target.value, 4));
        },
        style: payFieldBaseStyle,
      }));

  function validatePayModalForm(): string | null {
    const nomeOk = payNome.trim();
    if (!nomeOk) return 'Informe o nome como está no cartão.';
    if (nomeOk.length < 2) return 'Nome no cartão muito curto.';

    const pan = cardPanDigitsFromDisplay(payNumero);
    if (pan.length < 16) return 'Informe os 16 dígitos do cartão (4 grupos de 4).';
    if (!luhnValid(pan)) {
      return 'Os 16 dígitos estão no formato certo, mas o número não passa na verificação de cartão (soma de verificação). Revise os algarismos ou use um cartão de teste, ex.: 4242 4242 4242 4242.';
    }

    if (!/^\d{2}\/\d{2}$/.test(payValidade)) return 'Validade deve estar no formato MM/AA.';
    if (!isCardExpiryValid(payValidade)) return 'Validade inválida ou cartão expirado.';

    const cvv = payCvv;
    if (cvv.length < 3 || cvv.length > 4) return 'CVV deve ter 3 ou 4 dígitos.';

    return null;
  }

  const payCardFormFields = () =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, padding: '16px 16px 8px' } },
      payInputHolder('Nome do cartão', payNome, 'Nome como no cartão'),
      payInputPan('Número do cartão', payNumero, CARD_PAN_PLACEHOLDER),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('div', { style: { flex: 1 } },
          payInputExpiry('Validade', payValidade, 'MM/AA')),
        React.createElement('div', { style: { flex: 1 } },
          payInputCvv('CVV', payCvv, '000'))));

  // ── Payment option row ────────────────────────────────────────────────
  const payOptionRow = (type: 'credito' | 'debito', label: string, selected: boolean) =>
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px',
        cursor: 'pointer', width: '100%', boxSizing: 'border-box' as const,
      },
      onClick: () => { setPayType(type); setPayModalError(null); },
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
        React.createElement('div', {
          style: {
            width: 40, height: 40, borderRadius: 999, background: '#fff8e6',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          },
        }, creditCardSvg),
        React.createElement('span', { style: { fontSize: 16, fontWeight: 500, color: '#0d0d0d', ...font } }, label)),
      radioCircle(selected));

  // ── Payment modal (portal em document.body: evita corte por overflow do layout / homePage)
  const payModalOverlayEl = payModalOpen ? React.createElement('div', {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': 'passageiro-pay-modal-title',
    style: {
      ...webStyles.modalOverlay,
      zIndex: 10050,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    onClick: () => { setPayModalOpen(false); setPayModalError(null); },
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: 560, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' as const,
        boxShadow: '6px 6px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' as const,
        padding: '24px 0',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 24px',
          borderBottom: '1px solid #e2e2e2',
        },
      },
        React.createElement('span', { id: 'passageiro-pay-modal-title', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Cadastrar método de pagamento'),
        React.createElement('button', {
          type: 'button', onClick: () => { setPayModalOpen(false); setPayModalError(null); },
          style: {
            width: 48, height: 48, borderRadius: 999, background: '#f1f1f1', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, closeSvg)),

      // Options
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, padding: '24px 16px' } },
        // Cartão de crédito option
        React.createElement('div', {
          style: {
            border: payType === 'credito' ? '1px solid #0d0d0d' : '1px solid #e2e2e2',
            borderRadius: 12, padding: '12px 0', display: 'flex', flexDirection: 'column' as const,
          },
        },
          payOptionRow('credito', 'Cartão de crédito', payType === 'credito'),
          payType === 'credito' ? payCardFormFields() : null),

        // Cartão de débito option
        React.createElement('div', {
          style: {
            border: payType === 'debito' ? '1px solid #0d0d0d' : '1px solid #e2e2e2',
            borderRadius: 12, padding: '12px 0', display: 'flex', flexDirection: 'column' as const,
          },
        },
          payOptionRow('debito', 'Cartão de débito', payType === 'debito'),
          payType === 'debito' ? payCardFormFields() : null)),

      // Buttons
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, padding: '0 23px' } },
        payModalError
          ? React.createElement('p', { style: { fontSize: 14, color: '#b53838', margin: 0, ...font } }, payModalError)
          : null,
        React.createElement('button', {
          type: 'button',
          disabled: paySaving,
          onClick: async () => {
            const err = validatePayModalForm();
            if (err) {
              setPayModalError(err);
              return;
            }
            if (!passageiroId) {
              setPayModalError('Passageiro não identificado.');
              return;
            }
            const pan = cardPanDigitsFromDisplay(payNumero);
            const m = payValidade.match(/^(\d{2})\/(\d{2})$/);
            if (!m) {
              setPayModalError('Validade inválida.');
              return;
            }
            const expiryMonth = parseInt(m[1], 10);
            const expiryYear = 2000 + parseInt(m[2], 10);
            setPaySaving(true);
            setPayModalError(null);
            const { error: saveErr } = await insertPassengerPaymentMethodAdmin({
              userId: passageiroId,
              type: payType === 'credito' ? 'credit' : 'debit',
              holderName: payNome.trim(),
              lastFour: pan.slice(-4),
              brand: inferCardBrandFromPan(pan),
              expiryMonth,
              expiryYear,
            });
            setPaySaving(false);
            if (saveErr) {
              setPayModalError(saveErr);
              return;
            }
            const list = await fetchPassageiroPaymentMethods(passageiroId);
            setRealPayMethods(list);
            setPayNome('');
            setPayNumero('');
            setPayValidade('');
            setPayCvv('');
            setPayModalError(null);
            setPayModalOpen(false);
            showProfileToast('Método de pagamento cadastrado com sucesso.');
          },
          style: {
            height: 48, background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 16, fontWeight: 500, cursor: paySaving ? 'wait' : 'pointer', opacity: paySaving ? 0.75 : 1, ...font,
          },
          title: 'Cadastrar cartão na carteira do passageiro',
        }, paySaving ? 'Salvando…' : 'Salvar'),
        React.createElement('button', {
          type: 'button',
          disabled: paySaving,
          onClick: () => { setPayModalOpen(false); setPayModalError(null); },
          style: {
            height: 48, background: 'transparent', color: '#0d0d0d', border: 'none', borderRadius: 8,
            fontSize: 16, fontWeight: 500, cursor: paySaving ? 'not-allowed' : 'pointer', opacity: paySaving ? 0.6 : 1, ...font,
          },
        }, 'Cancelar')))) : null;

  const payModal =
    payModalOverlayEl != null && typeof document !== 'undefined'
      ? createPortal(payModalOverlayEl, document.body)
      : payModalOverlayEl;

  const verifyModalOverlayEl = verifyConfirmOpen ? React.createElement('div', {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': 'passageiro-verify-modal-title',
    style: {
      ...webStyles.modalOverlay,
      zIndex: 10051,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    onClick: () => {
      if (!verifying) setVerifyConfirmOpen(false);
    },
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: 440, maxWidth: '90vw',
        boxShadow: '6px 6px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' as const,
        padding: '24px 0',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 16px',
          borderBottom: '1px solid #e2e2e2',
        },
      },
        React.createElement('span', { id: 'passageiro-verify-modal-title', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Verificar perfil'),
        React.createElement('button', {
          type: 'button',
          disabled: verifying,
          onClick: () => { if (!verifying) setVerifyConfirmOpen(false); },
          'aria-label': 'Fechar',
          style: {
            width: 48, height: 48, borderRadius: 999, background: '#f1f1f1', border: 'none',
            cursor: verifying ? 'not-allowed' : 'pointer', opacity: verifying ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, closeSvg)),
      React.createElement('p', {
        style: { fontSize: 16, fontWeight: 400, color: '#3a3a3a', margin: 0, padding: '20px 16px 8px', lineHeight: 1.5, ...font },
      },
        nome && nome !== '—'
          ? `Deseja realmente verificar o perfil de ${nome}? O passageiro será marcado como verificado no sistema.`
          : 'Deseja realmente verificar este perfil? O passageiro será marcado como verificado no sistema.'),
      React.createElement('div', {
        style: { display: 'flex', flexDirection: 'column' as const, gap: 10, padding: '16px 16px 0' },
      },
        React.createElement('button', {
          type: 'button',
          disabled: verifying,
          onClick: () => { void handleConfirmVerifyProfile(); },
          style: {
            height: 48, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 16, fontWeight: 600, cursor: verifying ? 'wait' : 'pointer', opacity: verifying ? 0.85 : 1, ...font,
          },
        }, verifying ? 'Verificando…' : 'Sim, verificar perfil'),
        React.createElement('button', {
          type: 'button',
          disabled: verifying,
          onClick: () => { setVerifyConfirmOpen(false); },
          style: {
            height: 48, background: 'transparent', color: '#0d0d0d', border: 'none', borderRadius: 8,
            fontSize: 16, fontWeight: 500, cursor: verifying ? 'not-allowed' : 'pointer', opacity: verifying ? 0.6 : 1, ...font,
          },
        }, 'Cancelar')))) : null;

  const verifyModal =
    verifyModalOverlayEl != null && typeof document !== 'undefined'
      ? createPortal(verifyModalOverlayEl, document.body)
      : verifyModalOverlayEl;

  const profileToastCheckSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
    React.createElement('circle', { cx: 12, cy: 12, r: 11, fill: '#fff' }),
    React.createElement('path', { d: 'M9 12l2 2 4-4', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  const profileToastEl = profileToastMsg
    ? React.createElement('div', {
        key: profileToastMsg,
        role: 'status',
        'aria-live': 'polite',
        style: {
          position: 'fixed' as const,
          bottom: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'min(90vw, 520px)',
          background: '#0d0d0d',
          borderRadius: 12,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 11000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          boxSizing: 'border-box' as const,
        },
      },
        profileToastCheckSvg,
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.4, ...font } }, profileToastMsg))
    : null;

  // ── Render ────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    breadcrumb,
    headerRow,
    tabs,
    activeTab === 'dados' ? dadosTab
      : activeTab === 'dependentes' ? dependentesTab
      : activeTab === 'pagamentos' ? pagamentosTab
      : historicoTab,
    payModal,
    verifyModal,
    profileToastEl);
}
