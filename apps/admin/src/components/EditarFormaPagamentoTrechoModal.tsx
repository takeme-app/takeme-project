/**
 * Modal «Editar forma de pagamento e trecho» — Figma 905-23064.
 * Uses React.createElement() (no JSX).
 */
import React, { useState, useEffect, useCallback } from 'react';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const closeModalSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

const tituloSecao18: React.CSSProperties = { fontSize: 18, fontWeight: 600, color: '#0d0d0d', lineHeight: 1.5, ...font };

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  zIndex: 2100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  boxSizing: 'border-box',
};

export type EditarFormaPagamentoTrechoModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function EditarFormaPagamentoTrechoModal({ open, onClose }: EditarFormaPagamentoTrechoModalProps) {
  const [payPix, setPayPix] = useState(false);
  const [payCartao, setPayCartao] = useState(false);
  const [payDebito, setPayDebito] = useState(false);
  const [trechoTipoPag, setTrechoTipoPag] = useState<'todos' | 'selecionar'>('selecionar');
  const [chkOrigem, setChkOrigem] = useState(false);
  const [chkDestino, setChkDestino] = useState(false);
  const [chkDistancia, setChkDistancia] = useState(false);
  const [chkDuracao, setChkDuracao] = useState(false);
  const [valOrigem, setValOrigem] = useState('');
  const [valDestino, setValDestino] = useState('');
  const [valDistancia, setValDistancia] = useState('');
  const [valDuracao, setValDuracao] = useState('');

  const fechar = useCallback(() => onClose(), [onClose]);

  const salvar = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, fechar]);

  const payCheckboxRow = (key: string, label: string, checked: boolean, setChecked: (v: boolean) => void) =>
    React.createElement('label', {
      key,
      style: { display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%', paddingRight: 12, boxSizing: 'border-box' as const },
    },
      React.createElement('input', {
        type: 'checkbox',
        checked,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setChecked(e.target.checked),
        style: { width: 20, height: 20, margin: '10px 8px 10px 0', accentColor: '#0d0d0d', flexShrink: 0 },
      }),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label));

  const trechoRadioRow = (value: 'todos' | 'selecionar', label: string) =>
    React.createElement('button', {
      type: 'button',
      onClick: () => setTrechoTipoPag(value),
      style: {
        display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        padding: '6px 0', borderRadius: 6, textAlign: 'left' as const,
      },
    },
      React.createElement('span', {
        style: {
          width: 20, height: 20, marginRight: 8, borderRadius: '50%', border: '2px solid #0d0d0d',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' as const,
        },
      }, trechoTipoPag === value
        ? React.createElement('span', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } })
        : null),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label));

  const trechoFieldCol = (
    key: string,
    label: string,
    checked: boolean,
    setChecked: (v: boolean) => void,
    val: string,
    setVal: (v: string) => void,
    placeholder: string,
  ) =>
    React.createElement('div', {
      key,
      style: { flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 8 },
    },
      payCheckboxRow(`chk-${key}`, label, checked, setChecked),
      React.createElement('input', {
        type: 'text',
        value: val,
        placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value),
        style: {
          width: '100%', height: 44, borderRadius: 8, border: 'none', background: '#f1f1f1',
          padding: '0 16px', fontSize: 16, color: val ? '#0d0d0d' : '#767676', outline: 'none', boxSizing: 'border-box' as const, ...font,
        },
      }));

  if (!open) return null;

  return React.createElement('div', {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': 'edit-pagamento-trecho-titulo',
    style: overlayStyle,
    onClick: fechar,
  },
    React.createElement('div', {
      style: {
        background: '#fff',
        borderRadius: 16,
        boxShadow: '6px 6px 12px 0 rgba(0,0,0,0.15)',
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflowY: 'auto' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 24,
        padding: '24px 0',
        boxSizing: 'border-box' as const,
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { borderBottom: '1px solid #e2e2e2', paddingBottom: 24, width: '100%' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingLeft: 16, paddingRight: 16, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('div', { style: { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 8 } },
            React.createElement('h2', { id: 'edit-pagamento-trecho-titulo', style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, lineHeight: 1.25, ...font } }, 'Editar forma de pagamento e trecho'),
            React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, lineHeight: 1.45, ...font } }, 'Configure as formas de pagamento aceitas pelos motoristas.')),
          React.createElement('button', {
            type: 'button',
            onClick: fechar,
            'aria-label': 'Fechar',
            style: {
              width: 48, height: 48, borderRadius: '50%', border: 'none', background: '#f1f1f1', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, marginTop: -2,
            },
          }, closeModalSvg))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, paddingLeft: 16, paddingRight: 16, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecao18 }, 'Formas de pagamento aceitas'),
          payCheckboxRow('pay-pix', 'Pix', payPix, setPayPix),
          payCheckboxRow('pay-cartao', 'Cartão de crédito', payCartao, setPayCartao),
          payCheckboxRow('pay-debito', 'Débito', payDebito, setPayDebito)),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, paddingLeft: 16, paddingRight: 16, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('span', { style: tituloSecao18 }, 'Tipo de trechos'),
          trechoRadioRow('todos', 'Todos os trechos'),
          trechoRadioRow('selecionar', 'Selecionar trechos desejados')),
        trechoTipoPag === 'selecionar'
          ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
            React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 12, width: '100%' } },
              trechoFieldCol('origem', 'Origem', chkOrigem, setChkOrigem, valOrigem, setValOrigem, 'Ex: São Paulo'),
              trechoFieldCol('destino', 'Destino', chkDestino, setChkDestino, valDestino, setValDestino, 'Ex: Campinas - SP')),
            React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 12, width: '100%' } },
              trechoFieldCol('dist', 'Distância', chkDistancia, setChkDistancia, valDistancia, setValDistancia, 'Ex: 95 km'),
              trechoFieldCol('dur', 'Duração', chkDuracao, setChkDuracao, valDuracao, setValDuracao, 'Ex: 1h10min')))
          : null,
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 10, paddingLeft: 24, paddingRight: 24, width: '100%', boxSizing: 'border-box' as const } },
          React.createElement('button', {
            type: 'button',
            onClick: salvar,
            style: {
              width: '100%', height: 48, borderRadius: 8, border: 'none', background: '#0d0d0d', color: '#fff',
              fontSize: 16, fontWeight: 500, lineHeight: 1.5, cursor: 'pointer', ...font,
            },
          }, 'Salvar alterações'),
          React.createElement('button', {
            type: 'button',
            onClick: fechar,
            style: {
              width: '100%', height: 48, borderRadius: 8, border: 'none', background: '#f1f1f1', color: '#b53838',
              fontSize: 16, fontWeight: 500, lineHeight: 1.5, cursor: 'pointer', ...font,
            },
          }, 'Cancelar')))));
}
