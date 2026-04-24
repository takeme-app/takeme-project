/**
 * AdicionaisScreen — CRUD do catálogo de adicionais (surcharge_catalog).
 * Permite cadastrar, listar, editar e (soft-)remover adicionais em reais
 * tipificados por módulo (viagem, encomenda, preparador_encomendas,
 * preparador_excursoes) e vinculá-los a pricing_routes.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { PricingRouteRow, SurchargeCatalogRow, SurchargeType } from '../data/types';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const TYPES: Array<{ key: SurchargeType; label: string }> = [
  { key: 'viagem', label: 'Viagem' },
  { key: 'encomenda', label: 'Encomenda' },
  { key: 'preparador_encomendas', label: 'Preparador de encomendas' },
  { key: 'preparador_excursoes', label: 'Preparador de excursões' },
];

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseReais(input: string): number {
  const cleaned = input.replace(/[^0-9,.-]/g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

type FormState = {
  id: string | null;
  name: string;
  description: string;
  value: string;
  surcharge_type: SurchargeType;
  surcharge_mode: 'automatic' | 'manual';
  pricing_route_ids: Set<string>;
};

const emptyForm: FormState = {
  id: null,
  name: '',
  description: '',
  value: '',
  surcharge_type: 'viagem',
  surcharge_mode: 'manual',
  pricing_route_ids: new Set(),
};

export default function AdicionaisScreen() {
  const [rows, setRows] = useState<SurchargeCatalogRow[]>([]);
  const [routes, setRoutes] = useState<PricingRouteRow[]>([]);
  const [links, setLinks] = useState<Array<{ pricing_route_id: string; surcharge_id: string; value_cents: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<SurchargeType | 'all'>('all');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    const [{ data: cat }, { data: rts }, { data: lnks }] = await Promise.all([
      (supabase as any).from('surcharge_catalog').select('*').order('name'),
      (supabase as any).from('pricing_routes').select('id, title, role_type, origin_address, destination_address, price_cents, is_active').eq('is_active', true).order('destination_address'),
      (supabase as any).from('pricing_route_surcharges').select('pricing_route_id, surcharge_id, value_cents'),
    ]);
    setRows((cat as SurchargeCatalogRow[]) || []);
    setRoutes((rts as PricingRouteRow[]) || []);
    setLinks((lnks as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    if (filterType === 'all') return rows;
    return rows.filter((r) => r.surcharge_type === filterType);
  }, [rows, filterType]);

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setIsEditing(false);
    setError(null);
  }, []);

  const startEdit = useCallback((r: SurchargeCatalogRow) => {
    const linkedRoutes = new Set(links.filter((l) => l.surcharge_id === r.id).map((l) => l.pricing_route_id));
    setForm({
      id: r.id,
      name: r.name,
      description: r.description || '',
      value: (r.default_value_cents / 100).toString().replace('.', ','),
      surcharge_type: r.surcharge_type,
      surcharge_mode: r.surcharge_mode,
      pricing_route_ids: linkedRoutes,
    });
    setIsEditing(true);
    setError(null);
  }, [links]);

  const save = useCallback(async () => {
    setError(null);
    const name = form.name.trim();
    if (!name) { setError('Informe o nome do adicional.'); return; }
    const value_cents = parseReais(form.value);
    if (value_cents < 0) { setError('Valor inválido.'); return; }

    setSaving(true);
    const payload = {
      name,
      description: form.description.trim() || null,
      default_value_cents: value_cents,
      surcharge_type: form.surcharge_type,
      surcharge_mode: form.surcharge_mode,
      is_active: true,
    };

    let surchargeId = form.id;
    if (surchargeId) {
      const { error: upErr } = await (supabase as any)
        .from('surcharge_catalog')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', surchargeId);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
    } else {
      const { data, error: insErr } = await (supabase as any)
        .from('surcharge_catalog')
        .insert(payload)
        .select('id')
        .single();
      if (insErr || !data) { setError(insErr?.message || 'Falha ao criar adicional.'); setSaving(false); return; }
      surchargeId = data.id;
    }

    if (surchargeId) {
      // Sincroniza pricing_route_surcharges: desvincula as antigas e insere as novas.
      await (supabase as any).from('pricing_route_surcharges').delete().eq('surcharge_id', surchargeId);
      const targets = [...form.pricing_route_ids];
      if (targets.length > 0) {
        const inserts = targets.map((routeId) => ({ pricing_route_id: routeId, surcharge_id: surchargeId, value_cents: null }));
        const { error: linkErr } = await (supabase as any).from('pricing_route_surcharges').insert(inserts);
        if (linkErr) { setError(`Adicional salvo, mas vínculos falharam: ${linkErr.message}`); }
      }
    }

    setSaving(false);
    await refresh();
    resetForm();
  }, [form, refresh, resetForm]);

  const softDelete = useCallback(async (id: string) => {
    if (!confirm('Desativar este adicional? Ele não aparecerá em novas cotações.')) return;
    await (supabase as any).from('surcharge_catalog').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
    void refresh();
  }, [refresh]);

  const toggleRoute = useCallback((routeId: string) => {
    setForm((prev) => {
      const next = new Set(prev.pricing_route_ids);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return { ...prev, pricing_route_ids: next };
    });
  }, []);

  const routesGroupedByType = useMemo(() => {
    const byRole: Record<string, PricingRouteRow[]> = {};
    for (const r of routes) {
      const key = (r as any).role_type || 'outros';
      if (!byRole[key]) byRole[key] = [];
      byRole[key].push(r);
    }
    return byRole;
  }, [routes]);

  return React.createElement('div', { style: { width: '100%', paddingBottom: 64, display: 'flex', flexDirection: 'column' as const, gap: 24, ...font } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const } },
      React.createElement('div', null,
        React.createElement('h1', { style: { fontSize: 24, fontWeight: 700, margin: 0, color: '#0d0d0d' } }, 'Adicionais'),
        React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: '4px 0 0' } }, 'Catálogo de adicionais em reais por tipo de pedido. Valor é somado ao base antes do gross-up.')),
      React.createElement('button', {
        type: 'button',
        onClick: resetForm,
        style: {
          height: 44, padding: '0 24px', borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        },
      }, 'Novo adicional')),

    React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
      React.createElement('button', {
        type: 'button', onClick: () => setFilterType('all'),
        style: {
          height: 36, padding: '0 16px', borderRadius: 999, border: '1px solid #0d0d0d',
          background: filterType === 'all' ? '#0d0d0d' : 'transparent',
          color: filterType === 'all' ? '#fff' : '#0d0d0d',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        },
      }, 'Todos'),
      ...TYPES.map((t) =>
        React.createElement('button', {
          key: t.key, type: 'button', onClick: () => setFilterType(t.key),
          style: {
            height: 36, padding: '0 16px', borderRadius: 999, border: '1px solid #0d0d0d',
            background: filterType === t.key ? '#0d0d0d' : 'transparent',
            color: filterType === t.key ? '#fff' : '#0d0d0d',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          },
        }, t.label))),

    React.createElement('div', {
      style: {
        width: '100%', maxWidth: 1200, border: '1px solid #e2e2e2', borderRadius: 12, padding: 24, boxSizing: 'border-box' as const,
        display: 'flex', flexDirection: 'column' as const, gap: 16,
      },
    },
      React.createElement('h2', { style: { fontSize: 18, fontWeight: 600, margin: 0 } }, isEditing ? 'Editar adicional' : 'Cadastrar novo adicional'),
      error ? React.createElement('div', {
        role: 'alert',
        style: { padding: 12, borderRadius: 8, background: '#fde8e6', color: '#551611', fontSize: 14 },
      }, error) : null,
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 } },
        React.createElement('label', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 500 } }, 'Nome'),
          React.createElement('input', {
            type: 'text', value: form.name,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, name: e.target.value })),
            placeholder: 'Ex: Pedágio Rodovia Anchieta',
            style: { height: 44, borderRadius: 8, border: 'none', background: '#f1f1f1', padding: '0 16px', fontSize: 16 },
          })),
        React.createElement('label', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 500 } }, 'Valor (R$)'),
          React.createElement('input', {
            type: 'text', inputMode: 'decimal' as const, value: form.value,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, value: e.target.value })),
            placeholder: '0,00',
            style: { height: 44, borderRadius: 8, border: 'none', background: '#f1f1f1', padding: '0 16px', fontSize: 16 },
          })),
        React.createElement('label', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 500 } }, 'Tipo de pedido'),
          React.createElement('select', {
            value: form.surcharge_type,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setForm((p) => ({ ...p, surcharge_type: e.target.value as SurchargeType })),
            style: { height: 44, borderRadius: 8, border: 'none', background: '#f1f1f1', padding: '0 16px', fontSize: 16 },
          },
            ...TYPES.map((t) => React.createElement('option', { key: t.key, value: t.key }, t.label)))),
        React.createElement('label', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
          React.createElement('span', { style: { fontSize: 14, fontWeight: 500 } }, 'Modo'),
          React.createElement('select', {
            value: form.surcharge_mode,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setForm((p) => ({ ...p, surcharge_mode: e.target.value as 'automatic' | 'manual' })),
            style: { height: 44, borderRadius: 8, border: 'none', background: '#f1f1f1', padding: '0 16px', fontSize: 16 },
          },
            React.createElement('option', { value: 'manual' }, 'Manual'),
            React.createElement('option', { value: 'automatic' }, 'Automático')))),
      React.createElement('label', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 500 } }, 'Descrição (opcional)'),
        React.createElement('textarea', {
          value: form.description,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((p) => ({ ...p, description: e.target.value })),
          placeholder: 'Detalhes internos sobre quando aplicar este adicional',
          style: { minHeight: 80, borderRadius: 8, border: 'none', background: '#f1f1f1', padding: 12, fontSize: 14, resize: 'vertical' as const },
        })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 500 } }, 'Vincular a rotas de precificação'),
        React.createElement('span', { style: { fontSize: 12, color: '#767676' } }, 'Se nenhuma rota for marcada, o adicional fica disponível apenas como item manual.'),
        React.createElement('div', {
          style: { maxHeight: 260, overflowY: 'auto' as const, border: '1px solid #e2e2e2', borderRadius: 8, padding: 8 },
        },
          Object.keys(routesGroupedByType).length === 0
            ? React.createElement('span', { style: { fontSize: 14, color: '#767676' } }, 'Nenhuma rota ativa.')
            : Object.entries(routesGroupedByType).map(([role, list]) =>
              React.createElement('div', { key: role, style: { marginBottom: 8 } },
                React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: '#767676', margin: '8px 4px 4px' } }, role),
                ...list.map((r) =>
                  React.createElement('label', {
                    key: r.id,
                    style: { display: 'flex', alignItems: 'center', padding: '6px 4px', cursor: 'pointer' },
                  },
                    React.createElement('input', {
                      type: 'checkbox',
                      checked: form.pricing_route_ids.has(r.id),
                      onChange: () => toggleRoute(r.id),
                      style: { width: 18, height: 18, marginRight: 8, accentColor: '#0d0d0d' },
                    }),
                    React.createElement('span', { style: { fontSize: 13, color: '#0d0d0d' } },
                      `${(r as any).title || (r as any).role_type} · ${(r as any).origin_address ? (r as any).origin_address + ' → ' : ''}${(r as any).destination_address} · ${formatCents((r as any).price_cents || 0)}`))))))),
      React.createElement('div', { style: { display: 'flex', gap: 12, flexWrap: 'wrap' as const, justifyContent: 'flex-end' } },
        React.createElement('button', {
          type: 'button', onClick: resetForm, disabled: saving,
          style: {
            height: 44, padding: '0 24px', borderRadius: 999, border: '1px solid #0d0d0d', background: '#fff', color: '#0d0d0d',
            fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          },
        }, 'Cancelar'),
        React.createElement('button', {
          type: 'button', onClick: save, disabled: saving,
          style: {
            height: 44, padding: '0 24px', borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          },
        }, saving ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar adicional'))),

    React.createElement('div', {
      style: {
        width: '100%', maxWidth: 1200, border: '1px solid #e2e2e2', borderRadius: 12, overflow: 'hidden',
      },
    },
      React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' as const } },
        React.createElement('thead', { style: { background: '#f6f6f6' } },
          React.createElement('tr', null,
            ...['Nome', 'Tipo', 'Valor', 'Modo', 'Ativo', 'Rotas', 'Ações'].map((h) =>
              React.createElement('th', { key: h, style: { textAlign: 'left' as const, padding: 12, fontSize: 12, fontWeight: 600, color: '#767676' } }, h)))),
        React.createElement('tbody', null,
          loading
            ? React.createElement('tr', null, React.createElement('td', { colSpan: 7, style: { padding: 16, fontSize: 14 } }, 'Carregando…'))
            : filtered.length === 0
              ? React.createElement('tr', null, React.createElement('td', { colSpan: 7, style: { padding: 16, fontSize: 14, color: '#767676' } }, 'Nenhum adicional cadastrado.'))
              : filtered.map((r) => {
                const routeCount = links.filter((l) => l.surcharge_id === r.id).length;
                return React.createElement('tr', { key: r.id, style: { borderTop: '1px solid #e2e2e2' } },
                  React.createElement('td', { style: { padding: 12, fontSize: 14 } }, r.name),
                  React.createElement('td', { style: { padding: 12, fontSize: 13, color: '#767676' } }, TYPES.find((t) => t.key === r.surcharge_type)?.label || r.surcharge_type),
                  React.createElement('td', { style: { padding: 12, fontSize: 14 } }, formatCents(r.default_value_cents)),
                  React.createElement('td', { style: { padding: 12, fontSize: 13, color: '#767676' } }, r.surcharge_mode === 'automatic' ? 'Automático' : 'Manual'),
                  React.createElement('td', { style: { padding: 12, fontSize: 13, color: r.is_active ? '#1f7a3a' : '#767676' } }, r.is_active ? 'Sim' : 'Não'),
                  React.createElement('td', { style: { padding: 12, fontSize: 13 } }, routeCount),
                  React.createElement('td', { style: { padding: 12, display: 'flex', gap: 8 } },
                    React.createElement('button', {
                      type: 'button', onClick: () => startEdit(r),
                      style: { height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #0d0d0d', background: '#fff', color: '#0d0d0d', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
                    }, 'Editar'),
                    r.is_active
                      ? React.createElement('button', {
                        type: 'button', onClick: () => softDelete(r.id),
                        style: { height: 32, padding: '0 12px', borderRadius: 8, border: 'none', background: '#fde8e6', color: '#b53838', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
                      }, 'Desativar')
                      : null));
              })))));
}
