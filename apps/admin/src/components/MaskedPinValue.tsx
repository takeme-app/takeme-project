import React, { useCallback, useEffect, useState } from 'react';

const MASK = '••••';
const REVEAL_MS = 10_000;

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

type Props = {
  /** Valor do PIN (4 dígitos ou null/vazio). */
  value: string | null | undefined;
  /** Rótulo acessível / contexto para o botão revelar. */
  label: string;
};

/**
 * PIN mascarado por defeito; "Revelar" mostra o valor por ~10 s (§10 codigos-pin-referencia).
 * Auditoria de revelações: pendente (sem `code_validation_logs`).
 */
export function MaskedPinValue({ value, label }: Props) {
  const normalized = value != null && String(value).trim() !== '' ? String(value).trim() : '';
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => setRevealed(false), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [revealed]);

  const onReveal = useCallback(() => {
    if (!normalized) return;
    setRevealed(true);
    // TODO: registar revelação em tabela de auditoria quando existir (§10.2).
  }, [normalized]);

  if (!normalized) {
    return React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, '—');
  }

  return React.createElement(
    'span',
    {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap' as const,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: revealed ? 2 : 0,
        color: '#0d0d0d',
        ...font,
      },
    },
    revealed ? normalized : MASK,
    React.createElement('button', {
      type: 'button',
      onClick: onReveal,
      disabled: revealed,
      'aria-label': `${label}: revelar PIN`,
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: revealed ? '#9a9a9a' : '#102d57',
        background: 'none',
        border: 'none',
        cursor: revealed ? 'default' : 'pointer',
        textDecoration: revealed ? 'none' : 'underline',
        padding: 0,
        ...font,
      },
    }, revealed ? 'Visível…' : 'Revelar'),
  );
}
