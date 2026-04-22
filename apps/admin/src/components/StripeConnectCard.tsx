/**
 * StripeConnectCard — bloco reutilizavel que mostra status Stripe Connect do
 * worker (motorista / preparador) e permite ao admin forcar um sync.
 *
 * Uses React.createElement() para manter consistencia com o restante do admin.
 */
import React, { useCallback, useState } from 'react';
import { runStripeConnectSync } from '../data/queries';
import type { WorkerConnectStatus } from '../data/types';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

type BadgeStatus = 'ok' | 'bad' | 'pending' | 'absent';

/** Badge compacta para cada capability (charges/payouts/details). */
function capabilityBadge(label: string, ok: boolean, accountExists: boolean) {
  const status: BadgeStatus = !accountExists ? 'absent' : ok ? 'ok' : 'bad';
  const palette: Record<BadgeStatus, { bg: string; color: string; border: string; icon: string }> = {
    ok: { bg: '#dcfce7', color: '#14532d', border: '#86efac', icon: '✓' },
    bad: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', icon: '✗' },
    pending: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: '…' },
    absent: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', icon: '–' },
  };
  const meta = palette[status];
  return React.createElement('span', {
    key: label,
    style: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999, border: `1px solid ${meta.border}`,
      background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 600, ...font,
    },
  },
    React.createElement('span', { style: { fontWeight: 700 } }, meta.icon),
    label,
  );
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export interface StripeConnectCardProps {
  workerId: string;
  connect: WorkerConnectStatus;
  /** Callback invocado apos sync com sucesso (para parent refetch). */
  onSynced?: (next: Partial<WorkerConnectStatus> & { requirementsDueCount?: number }) => void;
}

export default function StripeConnectCard({ workerId, connect, onSynced }: StripeConnectCardProps) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<'ok' | 'err' | null>(null);
  const [requirementsDue, setRequirementsDue] = useState<number | null>(null);

  const handleSync = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    setMsgType(null);
    try {
      const { data, error } = await runStripeConnectSync(workerId);
      if (error) {
        setMsg(error);
        setMsgType('err');
      } else if (data) {
        const raw = data as unknown as Record<string, unknown>;
        const next: Partial<WorkerConnectStatus> & { requirementsDueCount?: number } = {
          accountId: (raw.stripe_connect_account_id as string | null) ?? null,
          chargesEnabled: Boolean(raw.charges_enabled),
          payoutsEnabled: Boolean(raw.payouts_enabled),
          detailsSubmitted: Boolean(raw.details_submitted),
          requirementsDueCount: Number(raw.requirements_due_count) || 0,
        };
        setRequirementsDue(next.requirementsDueCount ?? 0);
        setMsg(`Sincronizado. ${next.requirementsDueCount ?? 0} requisicao(oes) em aberto na Stripe.`);
        setMsgType('ok');
        onSynced?.(next);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao sincronizar');
      setMsgType('err');
    }
    setLoading(false);
  }, [workerId, onSynced]);

  const accountExists = Boolean(connect.accountId);
  const dashUrl = connect.accountId
    ? `https://dashboard.stripe.com/connect/accounts/${connect.accountId}`
    : null;

  return React.createElement('div', {
    style: {
      display: 'flex', flexDirection: 'column' as const, gap: 12,
      padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e2e2e2',
      width: '100%', boxSizing: 'border-box' as const,
    },
  },
    // Header: titulo + botao sync
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
        React.createElement('span', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Stripe Connect'),
        React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } },
          accountExists
            ? 'Split automatico ativo — pagamentos via stripe.transfers.create.'
            : 'Nao configurado. Worker precisa abrir o app e finalizar o onboarding.')),
      React.createElement('button', {
        type: 'button', onClick: handleSync, disabled: loading || !accountExists,
        style: {
          height: 36, padding: '0 16px', borderRadius: 999, border: '1px solid #d1d5db',
          background: accountExists ? '#0d0d0d' : '#f3f4f6',
          color: accountExists ? '#fff' : '#9ca3af',
          fontSize: 13, fontWeight: 600, cursor: accountExists && !loading ? 'pointer' : 'default', ...font,
          opacity: loading ? 0.6 : 1,
        },
      }, loading ? 'Sincronizando…' : 'Sincronizar com Stripe'),
    ),
    // Account ID + link
    accountExists
      ? React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#444', ...font } },
          React.createElement('span', null, 'Conta:'),
          React.createElement('code', {
            style: { fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: '#0d0d0d' },
          }, connect.accountId),
          dashUrl
            ? React.createElement('a', {
                href: dashUrl, target: '_blank', rel: 'noopener noreferrer',
                style: { fontSize: 12, color: '#2563eb', textDecoration: 'underline', ...font },
              }, 'Abrir no dashboard Stripe ↗')
            : null,
        )
      : null,

    // Badges de capabilities
    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 } },
      capabilityBadge('charges_enabled', connect.chargesEnabled, accountExists),
      capabilityBadge('payouts_enabled', connect.payoutsEnabled, accountExists),
      capabilityBadge('details_submitted', connect.detailsSubmitted, accountExists),
    ),

    // Data de aprovacao / notificacao
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2 } },
      React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Aprovado/notificado em'),
      React.createElement('span', { style: { fontSize: 13, color: '#0d0d0d', ...font } },
        fmtDateTime(connect.notifiedApprovedAt)),
      requirementsDue != null && requirementsDue > 0
        ? React.createElement('span', {
            style: { marginTop: 4, fontSize: 12, color: '#b45309', fontWeight: 600, ...font },
          }, `${requirementsDue} requisito(s) pendente(s) na Stripe — a conta pode receber? charges_enabled indica.`)
        : null,
    ),

    // Mensagem de feedback do sync
    msg
      ? React.createElement('span', {
          style: {
            fontSize: 12, padding: '6px 10px', borderRadius: 8,
            background: msgType === 'err' ? '#fee2e2' : '#dcfce7',
            color: msgType === 'err' ? '#991b1b' : '#14532d',
            ...font,
          },
        }, msg)
      : null,
  );
}
