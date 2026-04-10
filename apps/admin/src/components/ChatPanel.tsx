import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRealtimeMessages, RealtimeMessage } from '../hooks/useRealtimeMessages';
import FileUpload from './FileUpload';

// ── Types ────────────────────────────────────────────────────────────
export interface ChatPanelProps {
  conversationId: string | null;
  /** ID do admin logado (para distinguir remetente) */
  currentUserId: string;
  /** Nome exibido no cabeçalho */
  participantName?: string;
  /** Avatar URL do participante */
  participantAvatar?: string;
  /** Fecha o painel */
  onClose?: () => void;
  /** Chamado após marcar mensagens como lidas (ex.: atualizar badge na tela pai). */
  onAfterMarkRead?: () => void;
  /** Modo flutuante (fixed bottom-right) ou inline */
  floating?: boolean;
  style?: React.CSSProperties;
}

// ── Styles ───────────────────────────────────────────────────────────
const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const panelStyle: React.CSSProperties = {
  ...font,
  display: 'flex',
  flexDirection: 'column',
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e2e2e2',
  overflow: 'hidden',
  width: '100%',
  height: '100%',
};

const floatingStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  width: 380,
  height: 520,
  zIndex: 1000,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 16px',
  borderBottom: '1px solid #e2e2e2',
  background: '#fafafa',
};

const messagesContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const inputBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderTop: '1px solid #e2e2e2',
  background: '#fafafa',
};

const inputStyle: React.CSSProperties = {
  ...font,
  flex: 1,
  border: '1px solid #e2e2e2',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  outline: 'none',
};

const sendBtnStyle: React.CSSProperties = {
  ...font,
  background: '#F59E0B',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

// ── SVGs ─────────────────────────────────────────────────────────────
const closeSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));

const attachSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
  React.createElement('path', {
    d: 'M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48',
    stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  }));

// ── Helpers ──────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function MessageBubble(props: { msg: RealtimeMessage; isOwn: boolean }) {
  const { msg, isOwn } = props;
  const bubbleStyle: React.CSSProperties = {
    maxWidth: '75%',
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: 14,
    lineHeight: '1.4',
    alignSelf: isOwn ? 'flex-end' : 'flex-start',
    background: isOwn ? '#F59E0B' : '#f1f1f1',
    color: isOwn ? '#fff' : '#0d0d0d',
    borderBottomRightRadius: isOwn ? 4 : 12,
    borderBottomLeftRadius: isOwn ? 12 : 4,
  };

  const children: React.ReactNode[] = [];

  // Attachment
  if (msg.attachment_url) {
    if (msg.attachment_type === 'image') {
      children.push(
        React.createElement('img', {
          key: 'img',
          src: msg.attachment_url,
          alt: 'Imagem',
          style: { maxWidth: '100%', borderRadius: 8, marginBottom: msg.content ? 6 : 0 },
        }),
      );
    } else if (msg.attachment_type === 'pdf') {
      children.push(
        React.createElement('a', {
          key: 'pdf',
          href: msg.attachment_url,
          target: '_blank',
          rel: 'noopener noreferrer',
          style: { display: 'flex', alignItems: 'center', gap: 6, color: isOwn ? '#fff' : '#3b82f6', textDecoration: 'underline', fontSize: 13, marginBottom: msg.content ? 6 : 0 },
        }, 'Arquivo PDF'),
      );
    }
  }

  // Text
  if (msg.content) {
    children.push(React.createElement('div', { key: 'text' }, msg.content));
  }

  // Time
  children.push(
    React.createElement('div', {
      key: 'time',
      style: { fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' as const },
    }, formatTime(msg.created_at)),
  );

  return React.createElement('div', { style: bubbleStyle }, ...children);
}

// ── Component ────────────────────────────────────────────────────────
export default function ChatPanel(props: ChatPanelProps) {
  const { conversationId, currentUserId, participantName, participantAvatar, onClose, onAfterMarkRead, floating = false, style } = props;
  const [inputText, setInputText] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, loading, sendMessage, markAsRead } = useRealtimeMessages({ conversationId });

  // Auto-scroll ao receber mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Marcar como lido quando abrir
  useEffect(() => {
    if (!conversationId) return undefined;
    void (async () => {
      await markAsRead();
      onAfterMarkRead?.();
    })();
    return undefined;
  }, [conversationId, markAsRead, onAfterMarkRead]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  }, [inputText, sendMessage]);

  const handleKeyDown = useCallback((e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileUploaded = useCallback((url: string, type: 'pdf' | 'image') => {
    sendMessage('', url, type);
    setShowUpload(false);
  }, [sendMessage]);

  if (!conversationId) {
    return React.createElement('div', {
      style: { ...panelStyle, ...(floating ? floatingStyle : {}), alignItems: 'center', justifyContent: 'center', color: '#767676', fontSize: 14, ...style },
    }, 'Selecione uma conversa');
  }

  return React.createElement('div', {
    style: { ...panelStyle, ...(floating ? floatingStyle : {}), ...style },
  },
    // Header
    React.createElement('div', { style: headerStyle },
      participantAvatar
        ? React.createElement('img', { src: participantAvatar, alt: '', style: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' as const } })
        : React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: '#e2e2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#767676' } },
            (participantName || '?')[0]?.toUpperCase()),
      React.createElement('div', { style: { flex: 1 } },
        React.createElement('div', { style: { fontWeight: 600, fontSize: 14, color: '#0d0d0d' } }, participantName || 'Chat'),
      ),
      onClose ? React.createElement('button', {
        onClick: onClose,
        style: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
      }, closeSvg) : null,
    ),

    // Messages
    React.createElement('div', { style: messagesContainerStyle },
      loading
        ? React.createElement('div', { style: { textAlign: 'center' as const, color: '#767676', fontSize: 13 } }, 'Carregando...')
        : messages.length === 0
          ? React.createElement('div', { style: { textAlign: 'center' as const, color: '#767676', fontSize: 13, marginTop: 40 } }, 'Nenhuma mensagem')
          : messages.map((msg) =>
              React.createElement(MessageBubble, { key: msg.id, msg, isOwn: msg.sender_id === currentUserId }),
            ),
      React.createElement('div', { ref: messagesEndRef }),
    ),

    // Upload area
    showUpload
      ? React.createElement('div', { style: { padding: '8px 16px', borderTop: '1px solid #e2e2e2' } },
          React.createElement(FileUpload, {
            bucket: 'chat-attachments',
            onUploaded: handleFileUploaded,
            onCancel: () => setShowUpload(false),
          }),
        )
      : null,

    // Input bar
    React.createElement('div', { style: inputBarStyle },
      React.createElement('button', {
        onClick: () => setShowUpload(!showUpload),
        style: { background: 'none', border: 'none', cursor: 'pointer', padding: 4 },
        title: 'Anexar arquivo',
      }, attachSvg),
      React.createElement('input', {
        type: 'text',
        value: inputText,
        onChange: (e: any) => setInputText(e.target.value),
        onKeyDown: handleKeyDown,
        placeholder: 'Digite uma mensagem...',
        style: inputStyle,
      }),
      React.createElement('button', {
        onClick: handleSend,
        disabled: !inputText.trim(),
        style: { ...sendBtnStyle, opacity: inputText.trim() ? 1 : 0.5 },
      }, 'Enviar'),
    ),
  );
}
