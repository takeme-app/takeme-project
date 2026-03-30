/**
 * AtendimentoDetalheScreen — Tela de atendimento individual conforme Figma 1425-21190 / 1429-33119 / 1430-34188.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ChatPanel from '../components/ChatPanel';
import { invokeEdgeFunction } from '../data/queries';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// ── Arrow left SVG ──────────────────────────────────────────────────────
const arrowLeftSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M19 12H5M12 19l-7-7 7-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// ── Pencil SVG ──────────────────────────────────────────────────────────
const pencilSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// ── Refresh SVG ─────────────────────────────────────────────────────────
const refreshSvg = React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M23 4v6h-6M1 20v-6h6', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// ── Close SVG ───────────────────────────────────────────────────────────
const closeSvg = React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round' }));

// ── Histórico data ──────────────────────────────────────────────────────
const historicoItems = [
  { titulo: 'Denúncia - Carro sujo • Ana Júlia', atendente: 'Ana Carolina', data: '15/07/2025', desc: 'Cliente teve problema com limpeza do veículo.', desc2: 'Reset realizado com sucesso.' },
  { titulo: 'Denúncia - Carro sujo • Anônimo', atendente: 'Ana Carolina', data: '15/01/2025', desc: 'Cliente teve problema com limpeza do veículo.', desc2: '' },
  { titulo: 'Denúncia - Carro sujo • Anônimo', atendente: 'Ana Carolina', data: '15/01/2025', desc: 'Cliente teve problema com limpeza do veículo.', desc2: '' },
];

// ── Action chip labels ──────────────────────────────────────────────────
const actionChips = ['Dados cadastrais', 'Documentos', 'Encomendas', 'Viagens', 'Pagamentos', 'Solicitação', 'Reembolso', 'Veículo', 'Menores'];

export default function AtendimentoDetalheScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: conversationId } = useParams<{ id: string }>();
  const ticket = (location.state as any)?.ticket || {};
  const [orcamentoCriado, setOrcamentoCriado] = useState(false);
  const [orcamentoValor] = useState('R$ 5.000,00');

  // ── Fetch real messages from Supabase ────────────────────────────────
  const [realMessages, setRealMessages] = useState<{ sender: string; content: string; time: string }[]>([]);
  const [convStatus, setConvStatus] = useState<'active' | 'closed'>('active');
  useEffect(() => {
    if (!isSupabaseConfigured || !conversationId) return;
    let cancelled = false;
    // Fetch conversation
    (supabase as any).from('conversations').select('status, participant_name').eq('id', conversationId).single()
      .then(({ data }: { data: { status: 'active' | 'closed' } | null }) => { if (!cancelled && data) setConvStatus(data.status); });
    // Fetch messages
    (supabase as any).from('messages').select('id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }: { data: any[] | null }) => {
        if (cancelled || !data) return;
        setRealMessages(data.map((m: any) => ({
          sender: m.sender_id?.slice(0, 8) || 'User',
          content: m.content,
          time: new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        })));
      });
    return () => { cancelled = true; };
  }, [conversationId]);

  const handleCloseConversation = useCallback(async () => {
    if (!isSupabaseConfigured || !conversationId) return;
    await (supabase as any).from('conversations').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', conversationId);
    setConvStatus('closed');
  }, [conversationId]);

  const { session } = useAuth();
  const currentUserId = session?.user?.id || '';

  // ── Specialized form states ──────────────────────────────────────────
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundEntityType, setRefundEntityType] = useState('booking');
  const [refundEntityId, setRefundEntityId] = useState('');
  const [refundProcessing, setRefundProcessing] = useState(false);

  const [vehicleAuthOpen, setVehicleAuthOpen] = useState(false);
  const [vehicleData, setVehicleData] = useState<any>(null);

  const [minorAuthOpen, setMinorAuthOpen] = useState(false);
  const [minorData, setMinorData] = useState<any>(null);

  const nome = ticket.nome || 'Maria Silva';
  const email = ticket.email || 'maria.silva@gmail.com';
  const categoria = ticket.categoria || 'Cadastro de motorista';
  const status = ticket.status || 'nao_atendida';
  const isExcursao = categoria.toLowerCase().includes('excursão') || categoria.toLowerCase().includes('excursao');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [editStatusOpen, setEditStatusOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [finalizarOpen, setFinalizarOpen] = useState(false);
  const [reprovarOpen, setReprovarOpen] = useState(false);
  const [autorizarOpen, setAutorizarOpen] = useState(false);
  const [dadosCadastraisOpen, setDadosCadastraisOpen] = useState(false);
  const [documentosOpen, setDocumentosOpen] = useState(false);
  const [encomendaOpen, setEncomendaOpen] = useState(false);
  const [viagemOpen, setViagemOpen] = useState(false);
  const [pagamentoOpen, setPagamentoOpen] = useState(false);
  const [solicitacaoOpen, setSolicitacaoOpen] = useState(false);
  const [cadastrarPagOpen, setCadastrarPagOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => setToastMsg(msg), []);
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(null), 3000); return () => clearTimeout(t); }, [toastMsg]);
  const [tempStatus, setTempStatus] = useState(status);

  const statusOpts = [
    { key: 'nao_atendida', label: 'Não atendida', dot: '#b53838', bg: '#eeafaa', color: '#551611' },
    { key: 'em_atendimento', label: 'Em atendimento', dot: '#cba04b', bg: '#fee59a', color: '#654c01' },
    { key: 'atrasada', label: 'Atrasada', dot: '#b53838', bg: '#eeafaa', color: '#551611' },
    { key: 'finalizada', label: 'Finalizada', dot: '#22c55e', bg: '#b0e8d1', color: '#174f38' },
  ];
  const curOpt = statusOpts.find((o) => o.key === currentStatus) || statusOpts[0];
  const statusLabel = curOpt.label;
  const statusDot = curOpt.dot;
  const statusBg = curOpt.bg;
  const statusColor = curOpt.color;

  // ── Left panel ────────────────────────────────────────────────────────
  const leftPanel = React.createElement('div', {
    style: { flex: '1 1 50%', minWidth: 320, display: 'flex', flexDirection: 'column' as const, gap: 20 },
  },
    // Header row: ← Atendimento + Finalizar
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('button', {
            type: 'button', onClick: () => navigate(-1),
            style: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' },
          }, arrowLeftSvg),
          React.createElement('h1', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Atendimento')),
        React.createElement('span', { style: { fontSize: 13, color: '#767676', marginLeft: 28, ...font } }, 'Solicitação #10285')),
      React.createElement('button', {
        type: 'button',
        onClick: () => setFinalizarOpen(true),
        style: {
          height: 40, padding: '0 20px', borderRadius: 999, border: 'none',
          background: '#cba04b', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
        },
      }, 'Finalizar atendimento')),

    // Status badge + Editar status
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' as const } },
      React.createElement('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
          background: statusBg, color: statusColor, fontSize: 13, fontWeight: 600, ...font,
        },
      },
        React.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: statusDot } }),
        statusLabel),
      React.createElement('button', {
        type: 'button',
        onClick: () => setEditStatusOpen(true),
        style: {
          display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px',
          borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff',
          fontSize: 13, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
        },
      }, pencilSvg, 'Editar status')),

    // User info
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      React.createElement('div', {
        style: {
          width: 48, height: 48, borderRadius: '50%', background: '#E8725C', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        },
      }, React.createElement('span', { style: { color: '#fff', fontSize: 20, fontWeight: 600, ...font } }, nome.charAt(0))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
        React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', ...font } }, nome),
        React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, email))),

    // Separator
    React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),

    // Categoria + Atendente
    React.createElement('div', { style: { display: 'flex', gap: 40 } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Categoria'),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, isExcursao ? 'Solicitação de excursão' : categoria)),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Atendente responsável'),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Não atribuído'))),

    // Separator
    React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),

    // Trecho + Período
    React.createElement('div', { style: { display: 'flex', gap: 40 } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Trecho principal'),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, isExcursao ? 'São Luís → Viana' : 'São Paulo → Santos')),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, isExcursao ? 'Período da excursão' : 'Período da viagem'),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, '15/03/2025 - 20/03/2025'))),

    // Separator
    React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),

    // Viagem/Excursão + Status
    React.createElement('div', { style: { display: 'flex', gap: 40 } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, isExcursao ? 'Excursão' : 'Viagem'),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, isExcursao ? '03584' : '01258')),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Status'),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Solicitado'))),

    // Orçamento (only for excursão after elaborar)
    orcamentoCriado && isExcursao ? React.createElement(React.Fragment, null,
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Orçamento'),
          React.createElement('span', { style: { fontSize: 16, fontWeight: 700, color: '#0d0d0d', ...font } }, orcamentoValor)),
        React.createElement('button', {
          type: 'button',
          style: {
            display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px',
            borderRadius: 999, background: '#767676', color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', ...font,
          },
        }, pencilSvg, 'Editar orçamento'))) : null,

    // Action chips
    React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 4 } },
      ...actionChips.map((label) =>
        React.createElement('button', {
          key: label, type: 'button',
          onClick: label === 'Dados cadastrais' ? () => setDadosCadastraisOpen(true) : label === 'Documentos' ? () => setDocumentosOpen(true) : label === 'Encomendas' ? () => setEncomendaOpen(true) : label === 'Viagens' ? () => setViagemOpen(true) : label === 'Pagamentos' ? () => setPagamentoOpen(true) : label === 'Solicitação' ? () => setSolicitacaoOpen(true) : label === 'Reembolso' ? () => setRefundOpen(true) : label === 'Veículo' ? () => { (supabase as any).from('vehicles').select('*').eq('status', 'pending').limit(1).single().then(({ data }: any) => { setVehicleData(data); setVehicleAuthOpen(true); }); } : label === 'Menores' ? () => { (supabase as any).from('dependents').select('*').eq('status', 'pending').limit(1).single().then(({ data }: any) => { setMinorData(data); setMinorAuthOpen(true); }); } : undefined,
          style: {
            height: 40, padding: '0 20px', borderRadius: 999, border: '1px solid #e2e2e2',
            background: '#fff', fontSize: 14, fontWeight: 500, color: '#0d0d0d', cursor: 'pointer', ...font,
          },
        }, label))),

    // Bottom action buttons
    React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 8 } },
      // Reprovar button
      React.createElement('button', {
        type: 'button',
        onClick: () => setReprovarOpen(true),
        style: {
          flex: '0 0 auto', height: 48, padding: '0 28px', borderRadius: 999, border: 'none',
          background: '#eeafaa', color: '#551611', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
        },
      }, isExcursao ? 'Reprovar excursão' : 'Reprovar cadastro'),
      // Main action button
      React.createElement('button', {
        type: 'button',
        onClick: () => { if (isExcursao && !orcamentoCriado) navigate('/atendimentos/0/orcamento'); else if (isExcursao && orcamentoCriado) { /* enviar */ } else setAutorizarOpen(true); },
        style: {
          flex: 1, height: 48, padding: '0 28px', borderRadius: 999, border: 'none',
          background: '#22c55e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
        },
      }, isExcursao ? (orcamentoCriado ? 'Enviar orçamento' : 'Elaborar orçamento') : 'Autorizar cadastro')));

  // ── Right panel: Histórico ────────────────────────────────────────────
  const rightPanel = React.createElement('div', {
    style: {
      flex: '1 1 45%', minWidth: 300, display: 'flex', flexDirection: 'column' as const, gap: 0,
    },
  },
    React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: '0 0 16px 0', ...font } }, 'Histórico de atendimentos'),
    React.createElement('div', {
      style: {
        background: '#f6f6f6', borderRadius: 16, padding: 24, display: 'flex',
        flexDirection: 'column' as const, gap: 0,
      },
    },
      React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: '0 0 16px 0', ...font } }, 'Histórico de atendimentos'),
      ...historicoItems.map((item, idx) =>
        React.createElement('div', {
          key: idx,
          style: {
            padding: '16px 0', borderTop: idx > 0 ? '1px solid #e2e2e2' : 'none',
            display: 'flex', flexDirection: 'column' as const, gap: 6,
          },
        },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
            React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, item.titulo),
            React.createElement('span', { style: { fontSize: 12, color: '#767676', flexShrink: 0, marginLeft: 12, ...font } }, item.data)),
          React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, `Atendente: ${item.atendente}`),
          React.createElement('p', { style: { fontSize: 13, color: '#767676', margin: 0, lineHeight: 1.5, ...font } }, item.desc),
          item.desc2 ? React.createElement('p', { style: { fontSize: 13, color: '#767676', margin: 0, lineHeight: 1.5, ...font } }, item.desc2) : null))),

    // Conversa floating bar (toggles chat)
    React.createElement('div', {
      style: {
        position: 'fixed' as const, bottom: 24, right: 24,
        display: 'flex', alignItems: 'center', gap: 12,
        background: '#0d0d0d', borderRadius: 999, padding: '12px 20px', zIndex: 100,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)', cursor: 'pointer',
      },
      onClick: () => setChatOpen(!chatOpen),
    },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#fff', ...font } }, 'Conversa'),
      React.createElement('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: '50%', background: '#b53838',
          fontSize: 12, fontWeight: 700, color: '#fff', ...font,
        },
      }, '5'),
      React.createElement('button', {
        type: 'button',
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
        style: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginLeft: 8 },
      }, refreshSvg),
      React.createElement('button', {
        type: 'button',
        onClick: (e: React.MouseEvent) => { e.stopPropagation(); setChatOpen(false); },
        style: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' },
      }, closeSvg)));

  // ── Chat panel ────────────────────────────────────────────────────────
  const chatMessages = [
    { from: 'client', text: 'Preciso organizar uma viagem para 15 pessoas de São Paulo para Santos para um evento empresarial. Vocês conseguem me ajudar com isso?', time: '15h25' },
    { from: 'agent', text: 'Claro! Podemos sim te ajudar com isso. Você poderia confirmar as datas e se o grupo precisará\nde transporte de volta também?', time: '15h35' },
    { from: 'client', text: 'A viagem seria no dia 20, com retorno no dia 22.\nÉ possível incluir paradas no caminho?', time: '15h38' },
  ];

  // Send icon
  const sendSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  // Camera icon
  const cameraSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    React.createElement('circle', { cx: 12, cy: 13, r: 4, stroke: '#767676', strokeWidth: 2 }));
  // Plus icon
  const plusSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  // Minimize icon
  const minimizeSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M5 12h14', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));
  // Check icon
  const checkSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

  // ChatPanel com Supabase Realtime (substitui chat manual)
  const chatPanel = chatOpen ? React.createElement(ChatPanel, {
    conversationId: conversationId || null,
    currentUserId,
    participantName: nome,
    onClose: () => setChatOpen(false),
    floating: true,
  }) : null;

  // ── Reembolso modal ───────────────────────────────────────────────────
  const refundModal = refundOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setRefundOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Processar Reembolso'),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Tipo de entidade'),
        React.createElement('select', {
          value: refundEntityType,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setRefundEntityType(e.target.value),
          style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, ...font },
        },
          React.createElement('option', { value: 'booking' }, 'Viagem (booking)'),
          React.createElement('option', { value: 'shipment' }, 'Encomenda (shipment)'),
          React.createElement('option', { value: 'excursion' }, 'Excursão')),
        React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'ID da entidade'),
        React.createElement('input', {
          type: 'text', value: refundEntityId, placeholder: 'UUID da reserva/encomenda',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRefundEntityId(e.target.value),
          style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, ...font },
        })),
      React.createElement('div', { style: { display: 'flex', gap: 12 } },
        React.createElement('button', {
          type: 'button',
          disabled: refundProcessing || !refundEntityId.trim(),
          onClick: async () => {
            setRefundProcessing(true);
            try {
              await invokeEdgeFunction('process-refund', 'POST', undefined, {
                entity_type: refundEntityType, entity_id: refundEntityId.trim(), reason: 'admin_refund',
              });
              showToast('Reembolso processado com sucesso');
              setRefundOpen(false);
            } catch (err: any) { showToast(`Erro: ${err.message || 'falha no reembolso'}`); }
            setRefundProcessing(false);
          },
          style: { flex: 1, height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: refundProcessing ? 0.6 : 1, ...font },
        }, refundProcessing ? 'Processando...' : 'Processar Reembolso'),
        React.createElement('button', {
          type: 'button', onClick: () => setRefundOpen(false),
          style: { flex: 1, height: 48, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Cancelar')))) : null;

  // ── Autorização de veículo modal ──────────────────────────────────────
  const vehicleAuthModal = vehicleAuthOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setVehicleAuthOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Autorizar Cadastro de Veículo'),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      vehicleData
        ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
            React.createElement('div', { style: { fontSize: 14, ...font } }, `Modelo: ${vehicleData.model || '—'}`),
            React.createElement('div', { style: { fontSize: 14, ...font } }, `Placa: ${vehicleData.plate || '—'}`),
            React.createElement('div', { style: { fontSize: 14, ...font } }, `Ano: ${vehicleData.year || '—'}`))
        : React.createElement('p', { style: { fontSize: 14, color: '#767676', ...font } }, 'Nenhum veículo pendente.'),
      React.createElement('div', { style: { display: 'flex', gap: 12 } },
        React.createElement('button', {
          type: 'button',
          onClick: async () => {
            if (vehicleData?.id) {
              await (supabase as any).from('vehicles').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', vehicleData.id);
              showToast('Veículo aprovado');
              setVehicleAuthOpen(false);
            }
          },
          style: { flex: 1, height: 48, borderRadius: 999, border: 'none', background: '#22c55e', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Aprovar'),
        React.createElement('button', {
          type: 'button',
          onClick: async () => {
            if (vehicleData?.id) {
              await (supabase as any).from('vehicles').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', vehicleData.id);
              showToast('Veículo rejeitado');
              setVehicleAuthOpen(false);
            }
          },
          style: { flex: 1, height: 48, borderRadius: 999, border: '1px solid #b53838', background: '#fff', color: '#b53838', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Rejeitar')))) : null;

  // ── Autorização de menores modal ──────────────────────────────────────
  const minorAuthModal = minorAuthOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setMinorAuthOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Autorizar Menor'),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      minorData
        ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
            React.createElement('div', { style: { fontSize: 14, ...font } }, `Nome: ${minorData.full_name || '—'}`),
            React.createElement('div', { style: { fontSize: 14, ...font } }, `Idade: ${minorData.age || '—'}`),
            minorData.document_url ? React.createElement('a', { href: minorData.document_url, target: '_blank', rel: 'noopener noreferrer', style: { fontSize: 14, color: '#3b82f6', ...font } }, 'Ver documento') : null)
        : React.createElement('p', { style: { fontSize: 14, color: '#767676', ...font } }, 'Nenhum menor pendente.'),
      React.createElement('div', { style: { display: 'flex', gap: 12 } },
        React.createElement('button', {
          type: 'button',
          onClick: async () => {
            if (minorData?.id) {
              await (supabase as any).from('dependents').update({ status: 'validated' }).eq('id', minorData.id);
              showToast('Menor autorizado');
              setMinorAuthOpen(false);
            }
          },
          style: { flex: 1, height: 48, borderRadius: 999, border: 'none', background: '#22c55e', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Autorizar'),
        React.createElement('button', {
          type: 'button', onClick: () => setMinorAuthOpen(false),
          style: { flex: 1, height: 48, borderRadius: 999, border: '1px solid #b53838', background: '#fff', color: '#b53838', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Negar')))) : null;

  // ── Dados cadastrais modal ─────────────────────────────────────────────
  const readField = (label: string, value: string, flex = '1 1 0') =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex, minWidth: 140 } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, label),
      React.createElement('div', {
        style: { height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font },
      }, value));

  const dadosCadastraisModal = dadosCadastraisOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setDadosCadastraisOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Dados cadastrais'),
        React.createElement('button', {
          type: 'button', onClick: () => setDadosCadastraisOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      // Separator
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Fields
      readField('Nome completo', nome),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        readField('CPF', '123.456.789-99'),
        readField('Telefone', '(11) 91234-5678')),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        readField('Cidade', 'São Luís'),
        readField('Estado', 'Maranhão')),
      // Ver perfil completo button
      React.createElement('button', {
        type: 'button', onClick: () => { setDadosCadastraisOpen(false); navigate('/passageiros/0'); },
        style: {
          width: '100%', height: 48, borderRadius: 999, border: 'none',
          background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
        },
      }, 'Ver perfil completo'))) : null;

  // ── Documentos modal ───────────────────────────────────────────────────
  const docFileIcon = React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
    React.createElement('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    React.createElement('path', { d: 'M14 2v6h6', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const downloadIcon = React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
    React.createElement('path', { d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const infoIcon = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
    React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#cba04b', strokeWidth: 2 }),
    React.createElement('path', { d: 'M12 8v4M12 16h.01', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round' }));

  const docItems = [
    { section: 'CNH (frente e verso)', file: 'documento_do_carro.pdf', hasWarning: false },
    { section: 'Antecedentes Criminais', file: 'atencedentes_criminais.pdf', hasWarning: true },
    { section: 'Documento do veículo', file: 'documentos_do_veiculo.pdf', hasWarning: false },
  ];

  const documentosModal = documentosOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setDocumentosOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 0,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Documentos'),
        React.createElement('button', {
          type: 'button', onClick: () => setDocumentosOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2', marginBottom: 16 } }),
      // Doc items
      ...docItems.map((doc, idx) =>
        React.createElement('div', { key: idx, style: { display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            doc.hasWarning ? infoIcon : null,
            React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, doc.section)),
          React.createElement('div', {
            style: {
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 0', borderBottom: '1px solid #f1f1f1',
            },
          },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              docFileIcon,
              React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, doc.file)),
            React.createElement('button', {
              type: 'button',
              style: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' },
            }, downloadIcon)))),
      // Ver perfil completo
      React.createElement('button', {
        type: 'button', onClick: () => { setDocumentosOpen(false); navigate('/passageiros/0'); },
        style: {
          width: '100%', height: 48, borderRadius: 999, border: 'none', marginTop: 8,
          background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
        },
      }, 'Ver perfil completo'))) : null;

  // ── Viagem modal ───────────────────────────────────────────────────────
  const viagemIconField = (iconPath: string, label: string, value: string) =>
    React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 10, flex: '1 1 45%', minWidth: 180 } },
      React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0, marginTop: 2 } },
        React.createElement('path', { d: iconPath, stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, label),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, value)));

  const viagemModal = viagemOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setViagemOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Viagem'),
        React.createElement('button', {
          type: 'button', onClick: () => setViagemOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Fields grid
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: '20px 16px' } },
        viagemIconField('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', 'ID da viagem', '#123456'),
        viagemIconField('M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3', 'Preço total', 'R$ 154,30'),
        viagemIconField('M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2', 'Duração', '50 minutos'),
        viagemIconField('M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3', 'Valor unitário', 'R$ 80,00'),
        viagemIconField('M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14', 'Despesas', 'R$ 80,00'),
        viagemIconField('M22 11.08V12a10 10 0 11-5.93-9.14', 'Km da viagem', '120km'),
        viagemIconField('M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18', 'Data', '22/10/2025'),
        viagemIconField('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z', 'Total de passageiros', '4 pessoas'),
        viagemIconField('M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3', 'Status da viagem', 'Concluída'),
        viagemIconField('M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z', 'Motorista', 'Antônio José da Silva Pereira')),
      // Buttons
      React.createElement('div', { style: { display: 'flex', gap: 12 } },
        React.createElement('button', {
          type: 'button', onClick: () => { setViagemOpen(false); navigate('/motoristas'); },
          style: {
            flex: 1, height: 48, borderRadius: 999, border: '1px solid #e2e2e2',
            background: '#fff', color: '#0d0d0d', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Ver detalhes do motorista'),
        React.createElement('button', {
          type: 'button', onClick: () => { setViagemOpen(false); navigate('/viagens/0'); },
          style: {
            flex: 1, height: 48, borderRadius: 999, border: 'none',
            background: '#0d0d0d', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Ver detalhes completos')))) : null;

  // ── Encomenda modal ────────────────────────────────────────────────────
  const encomendaField = (label: string, value: string) =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
      React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, label),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, value));

  const encomendaModal = encomendaOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setEncomendaOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Encomenda'),
        React.createElement('button', {
          type: 'button', onClick: () => setEncomendaOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Package info row (image placeholder + Tamanho/Valor)
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
        React.createElement('div', {
          style: { width: 56, height: 56, borderRadius: 8, background: '#f5e6d0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('span', { style: { fontSize: 24 } }, '\uD83D\uDCE6')),
        React.createElement('div', { style: { display: 'flex', gap: 32 } },
          encomendaField('Tamanho:', 'Médio'),
          encomendaField('Valor:', 'R$ 80,00'))),
      // Remetente
      encomendaField('Remetente:', 'Fernanda Lima'),
      // Destinatário
      encomendaField('Destinatário:', 'Ana Silva'),
      // Recolha
      encomendaField('Recolha:', 'Rua das Acácias, 45'),
      // Entrega
      encomendaField('Entrega', 'Av. Central, 890'),
      // Observações
      encomendaField('Observações:', 'Frágil - manusear com cuidado'),
      // Buttons
      React.createElement('div', { style: { display: 'flex', gap: 12 } },
        React.createElement('button', {
          type: 'button', onClick: () => { setEncomendaOpen(false); navigate('/encomendas'); },
          style: {
            flex: 1, height: 48, borderRadius: 999, border: '1px solid #e2e2e2',
            background: '#fff', color: '#0d0d0d', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Ver todas as encomendas'),
        React.createElement('button', {
          type: 'button', onClick: () => setEncomendaOpen(false),
          style: {
            flex: 1, height: 48, borderRadius: 999, border: 'none',
            background: '#0d0d0d', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Ver detalhes completos')))) : null;

  // ── Solicitação modal (dynamic based on category) ──────────────────────
  const solRF = (label: string, value: string, flex = '1 1 0') =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex, minWidth: 120 } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, label),
      React.createElement('div', { style: { height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font } }, value));

  const solCheckbox = (checked: boolean, label: string) =>
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 } },
      React.createElement('div', {
        style: { width: 22, height: 22, borderRadius: 4, border: checked ? 'none' : '2px solid #d9d9d9', background: checked ? '#0d0d0d' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' as const },
      }, checked ? React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' })) : null),
      React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, label));

  const solRadio = (selected: boolean, label: string) =>
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        selected ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null),
      React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, label));

  const solDocRow = (section: string, file: string, hasWarning = false) =>
    React.createElement(React.Fragment, null,
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 } },
        hasWarning ? React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
          React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#cba04b', strokeWidth: 2 }),
          React.createElement('path', { d: 'M12 8v4M12 16h.01', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round' })) : null,
        React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, section)),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f1f1' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
            React.createElement('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', stroke: '#767676', strokeWidth: 2 }),
            React.createElement('path', { d: 'M14 2v6h6', stroke: '#767676', strokeWidth: 2 })),
          React.createElement('span', { style: { fontSize: 13, color: '#0d0d0d', ...font } }, file)),
        React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', cursor: 'pointer' } },
          React.createElement('path', { d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }))));

  const isPreparadorEncomendas = categoria.toLowerCase().includes('cadastro de transporte') || categoria.toLowerCase().includes('preparador de encomendas');
  const isPreparadorExcursoes = categoria.toLowerCase().includes('preparador de excursões');

  // Build modal body based on type
  const solicitacaoBody = (() => {
    if (isPreparadorEncomendas) {
      // Cadastro de preparador de encomendas
      return [
        solRF('Tipo da solicitação', 'Cadastro de preparador de encomendas', '1 1 100%'),
        solRF('Nome completo', 'Digite seu nome completo', '1 1 100%'),
        React.createElement('div', { key: 'cpf-idade', style: { display: 'flex', gap: 16 } }, solRF('CPF', 'Ex: 123.456.789-99'), solRF('Idade', 'Ex: 25 anos')),
        React.createElement('div', { key: 'cid-exp', style: { display: 'flex', gap: 16 } }, solRF('Cidade', 'Digite sua cidade'), solRF('Anos de experiência', 'Ex: 5 anos')),
        React.createElement('span', { key: 'db', style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Dados bancários'),
        React.createElement('div', { key: 'bank', style: { display: 'flex', gap: 16 } }, solRF('Banco', 'Ex: 0001'), solRF('Agência', 'Ex: 0240')),
        React.createElement('div', { key: 'conta', style: { display: 'flex', gap: 16 } }, solRF('Conta', 'Ex: 12345678-9'), solRF('Chave Pix', 'Ex: mario@gmail.com')),
        React.createElement('span', { key: 'vt', style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Veículo de transporte'),
        React.createElement('span', { key: 'vp', style: { fontSize: 13, color: '#767676', ...font } }, 'Possui veículo próprio?'),
        React.createElement('div', { key: 'radio-v', style: { display: 'flex', gap: 24 } }, solRadio(true, 'Sim'), solRadio(false, 'Não')),
        React.createElement('div', { key: 'ano-mod', style: { display: 'flex', gap: 16 } }, solRF('Ano do veículo', 'Ex: 2018'), solRF('Modelo', 'Ex: Honda CG 160 Start')),
        solRF('Chassi', 'Ex: 9 BR BLWHEXG0 1 07721', '1 1 100%'),
        React.createElement('div', { key: 'docs', style: { display: 'flex', flexDirection: 'column' as const } },
          solDocRow('CNH (frente e verso)', 'documento_do_carro.pdf'),
          solDocRow('Antecedentes Criminais', 'atencedentes_criminais.pdf', true),
          solDocRow('Documento do veículo', 'documentos_do_veiculo.pdf')),
        React.createElement('span', { key: 'val', style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Valores e precificação'),
        React.createElement('span', { key: 'vs', style: { fontSize: 12, color: '#767676', ...font } }, 'Valores de serviço'),
        solRF('Valor por entrega (R$)', 'R$ 15,00', '1 1 100%'),
        React.createElement('span', { key: 'vs2', style: { fontSize: 11, color: '#767676', ...font } }, 'Valor padrão por entrega concluída.'),
        solRF('Valor por km (R$)', 'R$ 2,50', '1 1 100%'),
        React.createElement('span', { key: 'vs3', style: { fontSize: 11, color: '#767676', ...font } }, 'Cobra de acordo com a distância percorrida.'),
      ];
    } else if (isPreparadorExcursoes) {
      // Cadastro de preparador de excursões
      return [
        solRF('Tipo da solicitação', 'Cadastro de preparador de excursões', '1 1 100%'),
        React.createElement('div', { key: 'docs', style: { display: 'flex', flexDirection: 'column' as const } },
          solDocRow('CNH (frente e verso)', 'documento_do_carro.pdf'),
          solDocRow('Antecedentes Criminais', 'atencedentes_criminais.pdf', true),
          solDocRow('Documento do veículo', 'documentos_do_veiculo.pdf')),
        React.createElement('span', { key: 'val', style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Valores e precificação'),
        React.createElement('div', { key: 'radio-p', style: { display: 'flex', gap: 24 } }, solRadio(false, 'Valor por hora'), solRadio(true, 'Valor por diária')),
        solRF('Preço por diária', 'Ex: R$ 250,00', '1 1 100%'),
        React.createElement('span', { key: 'pd', style: { fontSize: 11, color: '#767676', ...font } }, 'Valor padrão por período de trabalho.'),
        solRF('Preço noturno (18h–4:59h)', 'Ex: R$ 280,00', '1 1 100%'),
        React.createElement('span', { key: 'pn', style: { fontSize: 11, color: '#767676', ...font } }, 'Serviços realizados no período noturno.'),
        solRF('Domingos e feriados', 'Ex: R$ 300,00', '1 1 100%'),
        React.createElement('span', { key: 'df', style: { fontSize: 11, color: '#767676', ...font } }, 'Valor para dias de alta demanda.'),
      ];
    } else {
      // Solicitação de excursão (default)
      const solServicos = [
        { label: 'Equipe de primeiros socorros', checked: true },
        { label: 'Equipe de recreação', checked: true },
        { label: 'Equipe especializada em crianças', checked: false },
        { label: 'Equipe para pessoas com necessidades especiais', checked: false },
      ];
      const solItens = [{ obj: 'Bolas de futebol', qty: '8' }, { obj: 'Bóias', qty: '5' }, { obj: 'Bolas de basquete', qty: '3' }];
      return [
        solRF('Tipo da solicitação', 'Solicitação de excursão', '1 1 100%'),
        React.createElement('div', { key: 'dest', style: { display: 'flex', gap: 16 } }, solRF('Destino da excursão', 'Viana - MA'), solRF('Data da excursão', '10/11/2025')),
        React.createElement('div', { key: 'qty', style: { display: 'flex', gap: 16 } }, solRF('Quantidade de pessoas', '25'), solRF('Tipo de frota', 'Micro-ônibus')),
        React.createElement('span', { key: 'sa', style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Serviços adicionais'),
        React.createElement('div', { key: 'sac' }, ...solServicos.map((s) => solCheckbox(s.checked, s.label))),
        React.createElement('span', { key: 'ir', style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Itens de Recreação'),
        React.createElement('div', { key: 'irt', style: { border: '1px solid #e2e2e2', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 8 } },
          React.createElement('div', { style: { display: 'flex', gap: 16 } },
            React.createElement('span', { style: { flex: 1, fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Objetos de recreação'),
            React.createElement('span', { style: { flex: '0 0 80px', fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Quantidade')),
          ...solItens.map((item, i) =>
            React.createElement('div', { key: i, style: { display: 'flex', gap: 16 } },
              React.createElement('div', { style: { flex: 1, height: 40, borderRadius: 8, background: '#f1f1f1', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font } }, item.obj),
              React.createElement('div', { style: { flex: '0 0 80px', height: 40, borderRadius: 8, background: '#f1f1f1', padding: '0 12px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font } }, item.qty)))),
        React.createElement('span', { key: 'da', style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Detalhes adicionais'),
        React.createElement('div', { key: 'obs', style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Observações'),
          React.createElement('textarea', {
            readOnly: true, defaultValue: 'Inclua detalhes adicionais sobre a excursão.',
            style: { width: '100%', minHeight: 80, borderRadius: 8, border: '1px solid #e2e2e2', padding: 12, fontSize: 14, color: '#767676', resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const, ...font },
          })),
      ];
    }
  })();

  const solicitacaoModal = solicitacaoOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setSolicitacaoOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)', maxHeight: '90vh', overflowY: 'auto' as const,
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Solicitação'),
        React.createElement('button', {
          type: 'button', onClick: () => setSolicitacaoOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      ...solicitacaoBody)) : null;

  // ── Pagamento modal ────────────────────────────────────────────────────
  const pagField = (label: string, value: string, flex = '1 1 0') =>
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex, minWidth: 140 } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, label),
      React.createElement('div', {
        style: { height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font },
      }, value));

  const pagamentoModal = pagamentoOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setPagamentoOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Pagamento'),
        React.createElement('button', {
          type: 'button', onClick: () => setPagamentoOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Fields
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        pagField('Valor total', 'R$ 154,00'),
        pagField('Método de pagamento', 'Cartão de crédito')),
      pagField('Nome do cartão', 'Matheus Rodrigues Silva', '1 1 100%'),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        pagField('Número do cartão', '0110 1624 2432 6472'),
        pagField('Validade', '06/28')),
      React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
        pagField('Validade', '06/28'),
        pagField('CVV', '465')),
      // Buttons
      React.createElement('div', { style: { display: 'flex', gap: 12 } },
        React.createElement('button', {
          type: 'button', onClick: () => { setPagamentoOpen(false); setCadastrarPagOpen(true); },
          style: {
            flex: 1, height: 48, borderRadius: 999, border: '1px solid #e2e2e2',
            background: '#fff', color: '#0d0d0d', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Cadastrar pagamento'),
        React.createElement('button', {
          type: 'button', onClick: () => { setPagamentoOpen(false); navigate('/pagamentos'); },
          style: {
            flex: 1, height: 48, borderRadius: 999, border: 'none',
            background: '#0d0d0d', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Ver detalhes completos')))) : null;

  // ── Cadastrar Pagamento modal ──────────────────────────────────────────
  const cadastrarPagModal = cadastrarPagOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setCadastrarPagOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Cadastrar pagamento'),
        React.createElement('button', {
          type: 'button', onClick: () => setCadastrarPagOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Valor total + Método
      React.createElement('div', { style: { display: 'flex', gap: 16 } },
        React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Valor total'),
          React.createElement('input', { type: 'text', placeholder: 'Insira o valor total', style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', background: '#f1f1f1', ...font } })),
        React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Método de pagamento'),
          React.createElement('input', { type: 'text', placeholder: 'Selecione o método', style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', background: '#f1f1f1', ...font } }))),
      // Nome do cartão
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Nome do cartão'),
        React.createElement('input', { type: 'text', defaultValue: 'Matheus Rodrigues Silva', style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', width: '100%', boxSizing: 'border-box' as const, ...font } })),
      // Número do cartão
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Número do cartão'),
        React.createElement('input', { type: 'text', defaultValue: '0110 1624 2432 6472', style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', width: '100%', boxSizing: 'border-box' as const, ...font } })),
      // Validade full width
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Validade'),
        React.createElement('input', { type: 'text', defaultValue: '06/28', style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', width: '100%', boxSizing: 'border-box' as const, ...font } })),
      // Validade + CVV
      React.createElement('div', { style: { display: 'flex', gap: 16 } },
        React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'Validade'),
          React.createElement('input', { type: 'text', defaultValue: '06/28', style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font } })),
        React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, 'CVV'),
          React.createElement('input', { type: 'text', defaultValue: '465', style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px', fontSize: 14, color: '#0d0d0d', outline: 'none', ...font } }))),
      // Buttons
      React.createElement('button', {
        type: 'button', onClick: () => { setCadastrarPagOpen(false); showToast('Pagamento cadastrado'); },
        style: {
          width: '100%', height: 48, borderRadius: 999, border: 'none',
          background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
        },
      }, 'Salvar'),
      React.createElement('button', {
        type: 'button', onClick: () => setCadastrarPagOpen(false),
        style: {
          width: '100%', height: 48, borderRadius: 999, border: 'none',
          background: 'transparent', color: '#b53838', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font, textAlign: 'center' as const,
        },
      }, 'Cancelar'))) : null;

  // ── Alterar status modal ───────────────────────────────────────────────
  const statusChipOpts = [
    { key: 'todos', label: 'Todos' },
    { key: 'nao_atendida', label: 'Não atendida' },
    { key: 'em_atendimento', label: 'Em atendimento' },
    { key: 'atrasada', label: 'Atrasada' },
  ];

  const editStatusModal = editStatusOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setEditStatusOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Alterar status'),
        React.createElement('button', {
          type: 'button', onClick: () => setEditStatusOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      // Separator
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Status label + chips
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Status'),
        React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
          ...statusChipOpts.map((opt) =>
            React.createElement('button', {
              key: opt.key, type: 'button',
              onClick: () => setTempStatus(opt.key),
              style: {
                height: 36, padding: '0 16px', borderRadius: 999,
                border: tempStatus === opt.key ? 'none' : '1px solid #e2e2e2',
                background: tempStatus === opt.key ? '#0d0d0d' : '#fff',
                color: tempStatus === opt.key ? '#fff' : '#0d0d0d',
                fontSize: 14, fontWeight: 500, cursor: 'pointer', ...font,
              },
            }, opt.label)))),
      // Buttons
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        React.createElement('button', {
          type: 'button',
          onClick: () => { if (tempStatus !== 'todos') setCurrentStatus(tempStatus); setEditStatusOpen(false); },
          style: {
            width: '100%', height: 48, borderRadius: 999, border: 'none',
            background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Salvar alterações'),
        React.createElement('button', {
          type: 'button', onClick: () => setEditStatusOpen(false),
          style: {
            width: '100%', height: 48, borderRadius: 999, border: '1px solid #e2e2e2',
            background: '#fff', color: '#b53838', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Cancelar')))) : null;

  // ── Reprovar modal ─────────────────────────────────────────────────────
  const reprovarTitle = isExcursao ? 'Deseja realmente reprovar esta excursão?' : 'Deseja realmente reprovar este cadastro?';
  const reprovarModal = reprovarOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setReprovarOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, reprovarTitle),
        React.createElement('button', {
          type: 'button', onClick: () => setReprovarOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      // Separator
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Buttons
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        React.createElement('button', {
          type: 'button',
          onClick: () => { setReprovarOpen(false); showToast('Cadastro reprovado'); setTimeout(() => navigate('/atendimentos'), 1500); },
          style: {
            width: '100%', height: 48, borderRadius: 999, border: 'none',
            background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Sim, reprovar'),
        React.createElement('button', {
          type: 'button', onClick: () => setReprovarOpen(false),
          style: {
            width: '100%', height: 48, borderRadius: 999, border: '1px solid #e2e2e2',
            background: '#fff', color: '#b53838', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Cancelar')))) : null;

  // ── Autorizar modal ────────────────────────────────────────────────────
  const autorizarModal = autorizarOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setAutorizarOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Deseja realmente aprovar este cadastro?'),
        React.createElement('button', {
          type: 'button', onClick: () => setAutorizarOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        React.createElement('button', {
          type: 'button',
          onClick: () => { setAutorizarOpen(false); showToast('Cadastro aprovado'); setTimeout(() => navigate('/atendimentos'), 1500); },
          style: {
            width: '100%', height: 48, borderRadius: 999, border: 'none',
            background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Sim, aprovar'),
        React.createElement('button', {
          type: 'button', onClick: () => setAutorizarOpen(false),
          style: {
            width: '100%', height: 48, borderRadius: 999, border: '1px solid #e2e2e2',
            background: '#fff', color: '#b53838', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Cancelar')))) : null;

  // ── Finalizar modal ────────────────────────────────────────────────────
  const finalizarModal = finalizarOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setFinalizarOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,.15)',
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Deseja finalizar este atendimento?'),
        React.createElement('button', {
          type: 'button', onClick: () => setFinalizarOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      // Separator
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Buttons
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        React.createElement('button', {
          type: 'button',
          onClick: () => { setCurrentStatus('finalizada'); setFinalizarOpen(false); showToast('Atendimento finalizado'); setTimeout(() => navigate('/atendimentos'), 1500); },
          style: {
            width: '100%', height: 48, borderRadius: 999, border: 'none',
            background: '#0d0d0d', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Finalizar'),
        React.createElement('button', {
          type: 'button', onClick: () => setFinalizarOpen(false),
          style: {
            width: '100%', height: 48, borderRadius: 999, border: '1px solid #e2e2e2',
            background: '#fff', color: '#b53838', fontSize: 16, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Cancelar')))) : null;

  // ── Main layout ───────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('div', {
      style: { display: 'flex', gap: 40, width: '100%', flexWrap: 'wrap' as const, alignItems: 'flex-start' },
    }, leftPanel, rightPanel),
    chatPanel,
    refundModal,
    vehicleAuthModal,
    minorAuthModal,
    dadosCadastraisModal,
    documentosModal,
    encomendaModal,
    viagemModal,
    pagamentoModal,
    solicitacaoModal,
    cadastrarPagModal,
    editStatusModal,
    reprovarModal,
    autorizarModal,
    finalizarModal,
    // Toast
    toastMsg ? React.createElement('div', {
      style: {
        position: 'fixed' as const, bottom: 80, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px',
        background: '#1a1a1a', borderRadius: 12, zIndex: 1100,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 280,
      },
    },
      React.createElement('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
        React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#fff', strokeWidth: 2 }),
        React.createElement('path', { d: 'M9 12l2 2 4-4', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#fff', ...font } }, toastMsg)) : null);
}
