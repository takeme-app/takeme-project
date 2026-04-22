/**
 * ElaborarOrcamentoScreen — Elaborar orçamento de excursão (dados reais).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  submitExcursionBudget,
  fetchPreparadorEditDetail,
  fetchPreparadorCandidates,
  formatCurrencyBRL,
} from '../data/queries';
import type { PreparadorEditDetail, PreparadorCandidate } from '../data/types';
import { supabase } from '../lib/supabase';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const arrowLeftSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M19 12H5M12 19l-7-7 7-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const checkSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const closeSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round' }));
const plusSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const trashSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const inputStyle: React.CSSProperties = {
  height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px',
  fontSize: 14, color: '#0d0d0d', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box', ...font,
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: '#767676', marginBottom: 4, ...font };
const sectionCard: React.CSSProperties = {
  border: '1px solid #e2e2e2', borderRadius: 16, padding: 24,
  display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box',
};
const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
  cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font,
};

type BudgetTeamLine = {
  worker_id: string | null;
  role: 'driver' | 'preparer';
  value_cents: number;
};

type BudgetItemLine = {
  label: string;
  qty: number;
  value_cents: number;
};

function parseBRLInputToCents(text: string): number {
  const digits = text.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10);
}

function formatCentsBRL(cents: number): string {
  return formatCurrencyBRL(cents);
}

export default function ElaborarOrcamentoScreen() {
  const navigate = useNavigate();
  const { id: excursionId } = useParams<{ id: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<PreparadorEditDetail | null>(null);
  const [preparerCandidates, setPreparerCandidates] = useState<PreparadorCandidate[]>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; nome: string }>>([]);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Form state
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedPreparerId, setSelectedPreparerId] = useState<string>('');
  const [driverValueCents, setDriverValueCents] = useState<number>(0);
  const [preparerValueCents, setPreparerValueCents] = useState<number>(0);
  const [basicItems, setBasicItems] = useState<BudgetItemLine[]>([]);
  const [additionalServices, setAdditionalServices] = useState<BudgetItemLine[]>([]);
  const [recreationItems, setRecreationItems] = useState<BudgetItemLine[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!excursionId) { setLoading(false); return; }
      setLoading(true);
      const [d, preps, { data: driverRows }] = await Promise.all([
        fetchPreparadorEditDetail(excursionId),
        fetchPreparadorCandidates(),
        (supabase as any).from('worker_profiles')
          .select('id, status')
          .eq('role', 'driver')
          .eq('status', 'approved')
          .limit(200),
      ]);
      if (cancelled) return;
      setDetail(d);
      setPreparerCandidates(preps);
      const driverIds = (driverRows ?? []).map((r: any) => r.id as string);
      let driverList: Array<{ id: string; nome: string }> = [];
      if (driverIds.length > 0) {
        const { data: profs } = await (supabase as any).from('profiles').select('id, full_name').in('id', driverIds);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || 'Motorista']));
        driverList = driverIds.map((id: string) => ({ id, nome: (map.get(id) as string) || 'Motorista' }));
      }
      if (cancelled) return;
      setDrivers(driverList);
      if (d) {
        setSelectedDriverId(d.driverId ?? '');
        setSelectedPreparerId(d.preparerId ?? '');
        setDriverValueCents(d.driverPayoutCents ?? 0);
        setPreparerValueCents(d.preparerPayoutCents ?? 0);
        // hidratar budgetLines caso ja exista
        const lines = Array.isArray(d.budgetLines) ? d.budgetLines : [];
        const basic: BudgetItemLine[] = [];
        const additional: BudgetItemLine[] = [];
        const recreation: BudgetItemLine[] = [];
        for (const raw of lines) {
          const l = raw as any;
          if (!l) continue;
          const item: BudgetItemLine = {
            label: String(l.label ?? l.item ?? 'Item'),
            qty: Number(l.qty ?? l.quantity ?? 1) || 1,
            value_cents: Number(l.value_cents ?? l.amount_cents ?? 0) || 0,
          };
          const kind = String(l.kind ?? l.category ?? 'basic');
          if (kind === 'additional' || kind === 'additional_service') additional.push(item);
          else if (kind === 'recreation') recreation.push(item);
          else basic.push(item);
        }
        setBasicItems(basic);
        setAdditionalServices(additional);
        setRecreationItems(recreation);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [excursionId]);

  const itemsSum = (rows: BudgetItemLine[]) => rows.reduce((s, r) => s + (r.qty * r.value_cents), 0);

  const totalCents = useMemo(() => {
    return driverValueCents + preparerValueCents
      + itemsSum(basicItems) + itemsSum(additionalServices) + itemsSum(recreationItems);
  }, [driverValueCents, preparerValueCents, basicItems, additionalServices, recreationItems]);

  const handleFinalizar = useCallback(async (finalize: boolean) => {
    if (!excursionId) return;
    setBanner(null);
    if (totalCents <= 0) {
      setBanner({ type: 'err', text: 'Total deve ser maior que zero.' });
      return;
    }
    if (finalize && !selectedDriverId && !selectedPreparerId) {
      setBanner({ type: 'err', text: 'Vincule ao menos um worker (motorista ou preparador).' });
      return;
    }
    const team: BudgetTeamLine[] = [];
    if (selectedDriverId) team.push({ worker_id: selectedDriverId, role: 'driver', value_cents: driverValueCents });
    if (selectedPreparerId) team.push({ worker_id: selectedPreparerId, role: 'preparer', value_cents: preparerValueCents });
    setSubmitting(true);
    try {
      const res = await submitExcursionBudget(excursionId, {
        team,
        basic_items: basicItems,
        additional_services: additionalServices,
        recreation_items: recreationItems,
        total_cents: totalCents,
      }, finalize, {
        driver_id: selectedDriverId || null,
        preparer_id: selectedPreparerId || null,
        preparer_payout_cents: preparerValueCents,
      });
      if (res.error || (res.data && (res.data as any).error)) {
        setBanner({ type: 'err', text: res.error || (res.data as any)?.error || 'Falha ao salvar orcamento' });
        return;
      }
      setBanner({ type: 'ok', text: finalize ? 'Orcamento finalizado e enviado ao cliente.' : 'Rascunho salvo.' });
      if (finalize) navigate(-1);
    } finally {
      setSubmitting(false);
    }
  }, [excursionId, totalCents, selectedDriverId, selectedPreparerId, driverValueCents, preparerValueCents, basicItems, additionalServices, recreationItems, navigate]);

  // ── UI blocks ─────────────────────────────────────────────────────────
  const breadcrumb = React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#767676', ...font } },
    React.createElement('span', null, 'Atendimentos'),
    React.createElement('span', null, '›'),
    React.createElement('span', null, 'Detalhes do atendimento'),
    React.createElement('span', null, '›'),
    React.createElement('span', { style: { color: '#0d0d0d', fontWeight: 500 } }, 'Elaborar orçamento'));

  const header = React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 } },
    React.createElement('button', {
      type: 'button', onClick: () => navigate(-1),
      style: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font },
    }, arrowLeftSvg, 'Voltar'),
    React.createElement('div', { style: { display: 'flex', gap: 8 } },
      React.createElement('button', {
        type: 'button', onClick: () => navigate(-1),
        style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px', borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', fontSize: 14, fontWeight: 600, color: '#b53838', cursor: 'pointer', ...font },
      }, closeSvg, 'Cancelar'),
      React.createElement('button', {
        type: 'button', onClick: () => handleFinalizar(false), disabled: submitting,
        style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px', borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', fontSize: 14, fontWeight: 600, color: '#0d0d0d', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1, ...font },
      }, 'Salvar rascunho'),
      React.createElement('button', {
        type: 'button', onClick: () => handleFinalizar(true), disabled: submitting,
        style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px', borderRadius: 999, border: 'none', background: '#0d0d0d', fontSize: 14, fontWeight: 600, color: '#fff', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1, ...font },
      }, checkSvg, submitting ? 'Finalizando...' : 'Finalizar orçamento')));

  const title = React.createElement('h1', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Orçamento de Excursão');

  const bannerEl = banner
    ? React.createElement('div', {
        style: {
          padding: '10px 14px', borderRadius: 8,
          background: banner.type === 'err' ? '#fee2e2' : '#dcfce7',
          color: banner.type === 'err' ? '#991b1b' : '#166534',
          fontSize: 13, fontWeight: 600, ...font,
        },
      }, banner.text)
    : null;

  const fmtLocalDate = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
  };

  const detalhesSection = React.createElement('div', { style: sectionCard },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#767676', ...font } }, 'Detalhes da excursão'),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { flex: '1 1 0', minWidth: 140, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: labelStyle }, 'Destino'),
        React.createElement('input', { type: 'text', readOnly: true, value: detail?.destination ?? '', style: inputStyle })),
      React.createElement('div', { style: { flex: '1 1 0', minWidth: 140, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: labelStyle }, 'Data'),
        React.createElement('input', { type: 'text', readOnly: true, value: fmtLocalDate(detail?.scheduledDepartureAt || detail?.excursionDate), style: inputStyle }))),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { flex: '1 1 0', minWidth: 140, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: labelStyle }, 'Quantidade de pessoas'),
        React.createElement('input', { type: 'text', readOnly: true, value: String(detail?.peopleCount ?? 0), style: inputStyle })),
      React.createElement('div', { style: { flex: '1 1 0', minWidth: 140, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: labelStyle }, 'Tipo de frota'),
        React.createElement('input', { type: 'text', readOnly: true, value: detail?.fleetType ?? '', style: inputStyle }))));

  const equipeSection = React.createElement('div', { style: sectionCard },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#767676', ...font } }, 'Equipe vinculada'),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { flex: '2 1 0', minWidth: 160, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: labelStyle }, 'Motorista'),
        React.createElement('select', {
          value: selectedDriverId,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDriverId(e.target.value),
          style: inputStyle,
        },
          React.createElement('option', { value: '' }, '— Selecione —'),
          ...drivers.map((d) => React.createElement('option', { key: d.id, value: d.id }, d.nome)))),
      React.createElement('div', { style: { flex: '1 1 0', minWidth: 140, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: labelStyle }, 'Valor motorista'),
        React.createElement('input', {
          type: 'text', value: formatCentsBRL(driverValueCents),
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDriverValueCents(parseBRLInputToCents(e.target.value)),
          style: inputStyle,
        }))),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { flex: '2 1 0', minWidth: 160, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: labelStyle }, 'Preparador de excursões'),
        React.createElement('select', {
          value: selectedPreparerId,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPreparerId(e.target.value),
          style: inputStyle,
        },
          React.createElement('option', { value: '' }, '— Selecione —'),
          ...preparerCandidates.map((p) => React.createElement('option', { key: p.id, value: p.id }, p.nome)))),
      React.createElement('div', { style: { flex: '1 1 0', minWidth: 140, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('span', { style: labelStyle }, 'Valor preparador'),
        React.createElement('input', {
          type: 'text', value: formatCentsBRL(preparerValueCents),
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPreparerValueCents(parseBRLInputToCents(e.target.value)),
          style: inputStyle,
        }))));

  const renderItemsBlock = (
    blockLabel: string,
    rows: BudgetItemLine[],
    setRows: React.Dispatch<React.SetStateAction<BudgetItemLine[]>>,
    ctaLabel: string,
  ) =>
    React.createElement('div', { style: sectionCard },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#767676', ...font } }, blockLabel),
      React.createElement('div', { style: { display: 'flex', gap: 16 } },
        React.createElement('span', { style: { flex: '2 1 0', ...labelStyle } }, 'Item'),
        React.createElement('span', { style: { flex: '0 0 80px', ...labelStyle } }, 'Qtd.'),
        React.createElement('span', { style: { flex: '1 1 0', ...labelStyle } }, 'Valor unitário'),
        React.createElement('span', { style: { flex: '0 0 40px' } })),
      ...rows.map((row, idx) =>
        React.createElement('div', { key: idx, style: { display: 'flex', gap: 16, alignItems: 'center' } },
          React.createElement('input', {
            type: 'text', value: row.label, placeholder: 'Descrição',
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setRows((prev) => prev.map((r, i) => i === idx ? { ...r, label: e.target.value } : r)),
            style: { ...inputStyle, flex: '2 1 0' },
          }),
          React.createElement('input', {
            type: 'number', value: row.qty, min: 0,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setRows((prev) => prev.map((r, i) => i === idx ? { ...r, qty: Math.max(0, parseInt(e.target.value || '0', 10) || 0) } : r)),
            style: { ...inputStyle, flex: '0 0 80px' },
          }),
          React.createElement('input', {
            type: 'text', value: formatCentsBRL(row.value_cents),
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              setRows((prev) => prev.map((r, i) => i === idx ? { ...r, value_cents: parseBRLInputToCents(e.target.value) } : r)),
            style: { ...inputStyle, flex: '1 1 0' },
          }),
          React.createElement('button', {
            type: 'button',
            onClick: () => setRows((prev) => prev.filter((_, i) => i !== idx)),
            style: { flex: '0 0 40px', height: 40, borderRadius: 8, border: '1px solid #e2e2e2', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
            'aria-label': 'Remover item',
          }, trashSvg))),
      React.createElement('button', {
        type: 'button', style: addBtn,
        onClick: () => setRows((prev) => [...prev, { label: '', qty: 1, value_cents: 0 }]),
      }, plusSvg, ctaLabel));

  const itensSection = renderItemsBlock('Itens básicos', basicItems, setBasicItems, 'Adicionar novo item');
  const servicosSection = renderItemsBlock('Serviços adicionais', additionalServices, setAdditionalServices, 'Adicionar novo serviço');
  const recreacaoSection = renderItemsBlock('Adicionais de recreação', recreationItems, setRecreationItems, 'Adicionar novo item');

  const totalRow = React.createElement('div', {
    style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid #e2e2e2' },
  },
    React.createElement('span', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', ...font } }, 'Total'),
    React.createElement('span', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', ...font } }, formatCentsBRL(totalCents)));

  if (loading) {
    return React.createElement('div', { style: { padding: 40, textAlign: 'center' as const, color: '#767676', ...font } }, 'Carregando orçamento...');
  }

  if (!excursionId || !detail) {
    return React.createElement('div', { style: { padding: 40, textAlign: 'center' as const, color: '#b53838', ...font } }, 'Excursão não encontrada.');
  }

  return React.createElement(React.Fragment, null,
    breadcrumb, header, title, bannerEl,
    detalhesSection, equipeSection, itensSection, servicosSection, recreacaoSection,
    totalRow);
}
