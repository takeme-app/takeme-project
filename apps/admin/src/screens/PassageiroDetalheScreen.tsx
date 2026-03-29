/**
 * PassageiroDetalheScreen — Detalhes do passageiro (Figma 1415-42889).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { webStyles, arrowBackSvg, filterIconSvg } from '../styles/webStyles';
import { fetchPassageiroPaymentMethods, updateProfileVerified, fetchDependentsByUser, updateDependentStatus } from '../data/queries';
import type { PaymentMethodRow } from '../data/types';

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
const editSmallSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Plus icon
const plusSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// ── Fallback payment methods (used when no real data) ────────────────────
const fallbackPaymentMethods = [
  { name: 'Nubank', type: 'Débito', lastDigits: '9424', icon: mastercardIcon },
  { name: 'BlackVisa', type: 'Crédito', lastDigits: '9414', icon: visaIcon },
  { name: 'PIX', type: '', lastDigits: '', icon: pixIcon },
  { name: 'Apple Pay', type: '', lastDigits: '', icon: applePayIcon },
];

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
  headerRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 24,
  } as React.CSSProperties,
  backBtn: {
    display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 16, fontWeight: 500, color: '#0d0d0d', ...font,
  } as React.CSSProperties,
  editBtn: {
    display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px', borderRadius: 90, background: '#f1f1f1', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font,
  } as React.CSSProperties,
  tabsRow: {
    display: 'flex', gap: 0, borderBottom: '1px solid #e2e2e2', marginBottom: 32,
  } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '12px 24px', fontSize: 16, fontWeight: active ? 600 : 400, color: active ? '#0d0d0d' : '#767676',
    borderBottom: active ? '2px solid #0d0d0d' : '2px solid transparent', marginBottom: -1,
    background: 'none', border: 'none', cursor: 'pointer', ...font,
  } as React.CSSProperties),
  sectionTitle: {
    fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: '0 0 16px 0', ...font,
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

// ── SVG: eye action ──────────────────────────────────────────────────────
const eyeActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// SVG: pencil action
const pencilActionSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// SVG: chevron left / right for pagination
const chevronLeftSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M15 18l-6-6 6-6', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const chevronRightSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M9 18l6-6-6-6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// ── Activity history table data ──────────────────────────────────────────
type ActivityRow = {
  atividade: string;
  origem: string;
  destino: string;
  data: string;
  embarque: string;
  chegada: string;
  status: 'agendado' | 'concluido' | 'cancelado' | 'em_andamento';
};

const activityRows: ActivityRow[] = [
  { atividade: 'Viagem', origem: 'São Luís - MA', destino: 'Viana - MA', data: '25/10/2025', embarque: '08:00', chegada: '09:30', status: 'em_andamento' },
  { atividade: 'Viagem', origem: 'São Luís - MA', destino: 'Viana - MA', data: '25/10/2025', embarque: '08:00', chegada: '09:30', status: 'agendado' },
  { atividade: 'Viagem', origem: 'São Luís - MA', destino: 'Viana - MA', data: '25/10/2025', embarque: '08:00', chegada: '09:30', status: 'concluido' },
  { atividade: 'Envio de encomenda', origem: 'São Luís - MA', destino: 'Viana - MA', data: '25/10/2025', embarque: '08:00', chegada: '09:30', status: 'cancelado' },
  { atividade: 'Envio de encomenda', origem: 'São Luís - MA', destino: 'Viana - MA', data: '25/10/2025', embarque: '08:00', chegada: '09:30', status: 'cancelado' },
  { atividade: 'Envio de dependente', origem: 'São Luís - MA', destino: 'Viana - MA', data: '25/10/2025', embarque: '08:00', chegada: '09:30', status: 'concluido' },
  { atividade: 'Envio de dependente', origem: 'São Luís - MA', destino: 'Viana - MA', data: '25/10/2025', embarque: '08:00', chegada: '09:30', status: 'concluido' },
];

// Metric cards for historico tab
const histMetrics = [
  { title: 'Viagens realizadas', value: '35' },
  { title: 'Envios realizados', value: '3' },
  { title: 'Excursões realizadas', value: '2' },
];

const activityCols = [
  { label: 'Atividade', flex: '1 1 15%', minWidth: 140 },
  { label: 'Origem', flex: '1 1 12%', minWidth: 110 },
  { label: 'Destino', flex: '1 1 12%', minWidth: 90 },
  { label: 'Data', flex: '0 0 100px', minWidth: 100 },
  { label: 'Embarque', flex: '0 0 80px', minWidth: 80 },
  { label: 'Chegada', flex: '0 0 72px', minWidth: 72 },
  { label: 'Status', flex: '0 0 130px', minWidth: 130 },
  { label: 'Visualizar/Editar', flex: '0 0 96px', minWidth: 96 },
];

const statusConfig: Record<ActivityRow['status'], { label: string; bg: string; color: string }> = {
  em_andamento: { label: 'Em andamento', bg: '#fee59a', color: '#654c01' },
  agendado: { label: 'Agendado', bg: '#a8c6ef', color: '#102d57' },
  concluido: { label: 'Concluído', bg: '#b0e8d1', color: '#174f38' },
  cancelado: { label: 'Cancelado', bg: '#eeafaa', color: '#551611' },
};

export default function PassageiroDetalheScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const passageiro = (location.state as { passageiro?: { nome: string; cidade: string; estado: string; dataCriacao: string; cpf: string; status: string } })?.passageiro;

  const [activeTab, setActiveTab] = useState<'dados' | 'historico'>('dados');
  const passageiroId = (location.state as any)?.passageiro?.id;
  const isVerified = passageiro?.status === 'Verificado';
  const [verifying, setVerifying] = useState(false);
  const [dependents, setDependents] = useState<any[]>([]);

  useEffect(() => {
    if (passageiroId) fetchDependentsByUser(passageiroId).then(setDependents);
  }, [passageiroId]);

  // ── Real payment methods from Supabase ──────────────────────────────
  const [realPayMethods, setRealPayMethods] = useState<PaymentMethodRow[]>([]);
  useEffect(() => {
    const pId = (location.state as any)?.passageiro?.id;
    if (pId) {
      fetchPassageiroPaymentMethods(pId).then(setRealPayMethods);
    }
  }, [location.state]);

  // Use real data if available, fallback to mock
  const brandIconMap: Record<string, React.ReactElement> = { mastercard: mastercardIcon, visa: visaIcon };
  const paymentMethods = realPayMethods.length > 0
    ? realPayMethods.map((pm) => ({
        name: pm.holder_name || pm.brand || 'Cartão',
        type: pm.type === 'credit' ? 'Crédito' : 'Débito',
        lastDigits: pm.last_four || '',
        icon: brandIconMap[(pm.brand || '').toLowerCase()] || visaIcon,
      }))
    : fallbackPaymentMethods;

  // ── Add payment method modal state ────────────────────────────────────
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payType, setPayType] = useState<'credito' | 'debito'>('credito');
  const [payNome, setPayNome] = useState('');
  const [payNumero, setPayNumero] = useState('');
  const [payValidade, setPayValidade] = useState('');
  const [payCvv, setPayCvv] = useState('');

  const nome = passageiro?.nome ?? 'Carlos Silva';
  const cpf = passageiro?.cpf ?? '123.456.789-99';
  const cidade = passageiro?.cidade ?? 'São Luís';
  const estado = passageiro?.estado ?? 'Maranhão';
  const telefone = '(11) 91234-5678';

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
    React.createElement('div', { style: { display: 'flex', gap: 8 } },
      !isVerified && passageiroId ? React.createElement('button', {
        type: 'button',
        onClick: async () => {
          setVerifying(true);
          await updateProfileVerified(passageiroId, true);
          setVerifying(false);
          navigate(-1);
        },
        disabled: verifying,
        style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px', borderRadius: 999, border: 'none', background: '#22c55e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: verifying ? 'wait' : 'pointer', ...font },
      }, 'Verificar perfil') : null,
      React.createElement('button', { type: 'button', style: s.editBtn }, editSmallSvg, 'Editar dados')));

  // ── Tabs ──────────────────────────────────────────────────────────────
  const tabs = React.createElement('div', { style: s.tabsRow },
    React.createElement('button', {
      type: 'button', onClick: () => setActiveTab('dados'), style: s.tab(activeTab === 'dados'),
    }, 'Dados pessoais'),
    React.createElement('button', {
      type: 'button', onClick: () => setActiveTab('historico'), style: s.tab(activeTab === 'historico'),
    }, 'Histórico de atividades'));

  // ── Tab: Dados pessoais ───────────────────────────────────────────────
  const dadosTab = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24 } },
    React.createElement('h2', { style: s.sectionTitle }, 'Dados do Passageiro'),
    React.createElement('div', { style: s.card },
      // Dados básicos
      React.createElement('h3', { style: s.subtitle }, 'Dados básicos'),
      // Row 1: Nome + CPF
      React.createElement('div', { style: s.fieldRow },
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'Nome completo'),
          React.createElement('div', { style: s.fieldValue }, nome)),
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'CPF'),
          React.createElement('div', { style: s.fieldValue }, cpf))),
      // Row 2: Telefone + Cidade + Estado
      React.createElement('div', { style: s.fieldRow },
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'Telefone'),
          React.createElement('div', { style: s.fieldValue }, telefone)),
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'Cidade'),
          React.createElement('div', { style: s.fieldValue }, cidade)),
        React.createElement('div', { style: s.fieldGroup },
          React.createElement('label', { style: s.fieldLabel }, 'Estado'),
          React.createElement('div', { style: s.fieldValue }, estado))),
      // Separator
      React.createElement('div', { style: { width: '100%', height: 1, background: '#e2e2e2' } }),
      // Métodos de pagamento
      React.createElement('h3', { style: s.subtitle }, 'Métodos de pagamento'),
      React.createElement('div', { style: s.paymentGrid },
        ...paymentMethods.map((pm, i) =>
          React.createElement('div', { key: i, style: s.paymentCard },
            pm.icon,
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const } },
              React.createElement('span', { style: s.paymentName },
                pm.lastDigits ? `${pm.name} ${pm.type.toLowerCase()} ••••${pm.lastDigits}` : pm.name),
              pm.type && pm.lastDigits
                ? React.createElement('span', { style: s.paymentDetails }, pm.type)
                : null)))),
      // Add payment link
      React.createElement('button', { type: 'button', style: s.addPaymentBtn, onClick: () => setPayModalOpen(true) }, plusSvg, 'Adicionar método de pagamento')));

  // ── Tab: Histórico de atividades ──────────────────────────────────────
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 8px' };

  // ── Metrics section ─────────────────────────────────────────────────
  const metricsSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
    React.createElement('p', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Métricas e estatísticas'),
    React.createElement('div', { style: { display: 'flex', gap: 24, width: '100%' } },
      ...histMetrics.map((m) =>
        React.createElement('div', {
          key: m.title,
          style: {
            flex: '1 1 0', background: '#f6f6f6', borderRadius: 16, padding: '16px 24px',
            display: 'flex', flexDirection: 'column' as const, gap: 56,
          },
        },
          React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font } }, m.title),
          React.createElement('p', {
            style: { fontSize: 32, fontWeight: 700, color: '#0d0d0d', margin: 0, lineHeight: 1.5, fontFamily: "'Open Sans', Inter, sans-serif" },
          }, m.value)))));

  // ── Activity table section ──────────────────────────────────────────
  // Filter toolbar
  const histFilterBar = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 80, padding: '20px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0',
    },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.5, ...font } }, 'Lista de atividades'),
    React.createElement('button', {
      type: 'button',
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '8px 24px',
        background: '#fff', border: 'none', borderRadius: 999, cursor: 'pointer',
        fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font, minWidth: 104,
      },
    }, React.createElement('span', null, filterIconSvg), 'Filtro'));

  // Table header
  const histHeader = React.createElement('div', {
    style: {
      display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9',
      padding: '0 16px', alignItems: 'center',
    },
  },
    ...activityCols.map((c) => React.createElement('div', {
      key: c.label,
      style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 8px', display: 'flex', alignItems: 'center', height: '100%' },
    }, c.label)));

  // Table rows
  const histRows = activityRows.map((row, idx) => {
    const sc = statusConfig[row.status];
    return React.createElement('div', {
      key: idx,
      style: {
        display: 'flex', height: 64, alignItems: 'center', padding: '0 16px',
        borderBottom: '1px solid #d9d9d9', background: '#f6f6f6',
      },
    },
      // Atividade
      React.createElement('div', { style: { ...cellBase, flex: activityCols[0].flex, minWidth: activityCols[0].minWidth, fontWeight: 500 } }, row.atividade),
      // Origem
      React.createElement('div', { style: { ...cellBase, flex: activityCols[1].flex, minWidth: activityCols[1].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, row.origem),
      // Destino
      React.createElement('div', { style: { ...cellBase, flex: activityCols[2].flex, minWidth: activityCols[2].minWidth, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, row.destino),
      // Data
      React.createElement('div', { style: { ...cellBase, flex: activityCols[3].flex, minWidth: activityCols[3].minWidth, fontWeight: 400 } }, row.data),
      // Embarque
      React.createElement('div', { style: { ...cellBase, flex: activityCols[4].flex, minWidth: activityCols[4].minWidth, fontWeight: 400 } }, row.embarque),
      // Chegada
      React.createElement('div', { style: { ...cellBase, flex: activityCols[5].flex, minWidth: activityCols[5].minWidth, fontWeight: 400 } }, row.chegada),
      // Status
      React.createElement('div', { style: { ...cellBase, flex: activityCols[6].flex, minWidth: activityCols[6].minWidth } },
        React.createElement('span', {
          style: {
            display: 'inline-block', padding: '4px 12px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap' as const,
            background: sc.bg, color: sc.color, ...font,
          },
        }, sc.label)),
      // Visualizar/Editar
      React.createElement('div', { style: { flex: activityCols[7].flex, minWidth: activityCols[7].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 } },
        React.createElement('button', { type: 'button', style: { ...webStyles.viagensActionBtn }, 'aria-label': 'Visualizar' }, eyeActionSvg),
        React.createElement('button', { type: 'button', style: { ...webStyles.viagensActionBtn }, 'aria-label': 'Editar' }, pencilActionSvg)));
  });

  const activityTableSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%', borderBottom: '1px solid #e2e2e2', paddingBottom: 32 },
  },
    React.createElement('p', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: '0 0 16px 0', ...font } }, 'Histórico de atividades'),
    React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
      histFilterBar,
      React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
        histHeader,
        ...histRows)));

  const historicoTab = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 32, width: '100%' } },
    metricsSection,
    activityTableSection);

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

  // ── Input helper ──────────────────────────────────────────────────────
  const payInput = (label: string, value: string, onChange: (v: string) => void, placeholder: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, width: '100%' } },
      React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
      React.createElement('input', {
        type: 'text', value, placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        style: {
          height: 44, background: '#f1f1f1', borderRadius: 8, border: 'none', paddingLeft: 16, paddingRight: 16,
          fontSize: 16, color: '#767676', outline: 'none', width: '100%', boxSizing: 'border-box' as const, ...font,
        },
      }));

  // ── Payment option row ────────────────────────────────────────────────
  const payOptionRow = (type: 'credito' | 'debito', label: string, selected: boolean) =>
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px',
        cursor: 'pointer', width: '100%', boxSizing: 'border-box' as const,
      },
      onClick: () => setPayType(type),
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

  // ── Payment modal ─────────────────────────────────────────────────────
  const payModal = payModalOpen ? React.createElement('div', {
    style: {
      ...webStyles.modalOverlay,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    onClick: () => setPayModalOpen(false),
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
        React.createElement('span', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Cadastrar método de pagamento'),
        React.createElement('button', {
          type: 'button', onClick: () => setPayModalOpen(false),
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
          // Form fields (only visible when selected)
          payType === 'credito' ? React.createElement('div', {
            style: { display: 'flex', flexDirection: 'column' as const, gap: 8, padding: '16px 16px 8px' },
          },
            payInput('Nome do cartão', payNome, setPayNome, 'Matheus Rodrigues Silva'),
            payInput('Número do cartão', payNumero, setPayNumero, '0110 1624 2432 6472'),
            payInput('Validade', payValidade, setPayValidade, '06/28'),
            React.createElement('div', { style: { display: 'flex', gap: 8 } },
              React.createElement('div', { style: { flex: 1 } },
                payInput('Validade', payValidade, setPayValidade, '06/28')),
              React.createElement('div', { style: { flex: 1 } },
                payInput('CVV', payCvv, setPayCvv, '465')))) : null),

        // Cartão de débito option
        React.createElement('div', {
          style: {
            border: payType === 'debito' ? '1px solid #0d0d0d' : '1px solid #e2e2e2',
            borderRadius: 12, padding: '12px 0', display: 'flex', flexDirection: 'column' as const,
          },
        },
          payOptionRow('debito', 'Cartão de débito', payType === 'debito'),
          payType === 'debito' ? React.createElement('div', {
            style: { display: 'flex', flexDirection: 'column' as const, gap: 8, padding: '16px 16px 8px' },
          },
            payInput('Nome do cartão', payNome, setPayNome, 'Matheus Rodrigues Silva'),
            payInput('Número do cartão', payNumero, setPayNumero, '0110 1624 2432 6472'),
            payInput('Validade', payValidade, setPayValidade, '06/28'),
            React.createElement('div', { style: { display: 'flex', gap: 8 } },
              React.createElement('div', { style: { flex: 1 } },
                payInput('Validade', payValidade, setPayValidade, '06/28')),
              React.createElement('div', { style: { flex: 1 } },
                payInput('CVV', payCvv, setPayCvv, '465')))) : null)),

      // Buttons
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, padding: '0 23px' } },
        React.createElement('button', {
          type: 'button',
          onClick: () => setPayModalOpen(false),
          style: {
            height: 48, background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 16, fontWeight: 500, cursor: 'pointer', ...font,
          },
        }, 'Salvar'),
        React.createElement('button', {
          type: 'button',
          onClick: () => setPayModalOpen(false),
          style: {
            height: 48, background: 'transparent', color: '#0d0d0d', border: 'none', borderRadius: 8,
            fontSize: 16, fontWeight: 500, cursor: 'pointer', ...font,
          },
        }, 'Cancelar')))) : null;

  // ── Render ────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    breadcrumb,
    headerRow,
    tabs,
    activeTab === 'dados' ? dadosTab : historicoTab,
    payModal);
}
