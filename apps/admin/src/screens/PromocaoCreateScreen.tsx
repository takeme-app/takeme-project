/**
 * PromocaoCreateScreen — Criar promoção conforme Figma 891-43439.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPromotion } from '../data/queries';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const CITY_OPTIONS = ['São Paulo', 'Campinas', 'Curitiba', 'Belo Horizonte', 'Porto Alegre'] as const;

function toDatetimeLocalValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(15, 30, 0, 0);
  return toDatetimeLocalValue(d);
}

function defaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 10);
  d.setHours(23, 59, 0, 0);
  return toDatetimeLocalValue(d);
}

function buildTargetAudiences(a: {
  motoristas: boolean;
  preparadores: boolean;
  passageiros: boolean;
  encomendas: boolean;
}): string[] {
  const set = new Set<string>();
  if (a.motoristas) set.add('drivers');
  if (a.preparadores) {
    set.add('preparers_shipments');
    set.add('preparers_excursions');
  }
  if (a.passageiros) set.add('passengers');
  if (a.encomendas) set.add('preparers_shipments');
  return [...set];
}

function buildAppliesTo(a: {
  motoristas: boolean;
  preparadores: boolean;
  passageiros: boolean;
  encomendas: boolean;
}): string[] {
  const set = new Set<string>();
  if (a.motoristas || a.passageiros) set.add('bookings');
  if (a.preparadores || a.encomendas) {
    set.add('shipments');
    set.add('dependent_shipments');
  }
  if (a.preparadores) set.add('excursions');
  return [...set];
}

const arrowLeftSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M19 12H5M12 19l-7-7 7-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const checkSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const closeSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round' }));
const calendarSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M16 2v4M8 2v4M3 10h18', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));
const searchSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block', flexShrink: 0 } },
  React.createElement('circle', { cx: 11, cy: 11, r: 7, stroke: '#767676', strokeWidth: 2 }),
  React.createElement('path', { d: 'M20 20l-4-4', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round' }));
const chevronDownSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

const labelMd: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font };
const labelSmMuted: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: '#767676', ...font };
const inputGray: React.CSSProperties = {
  width: '100%', height: 44, borderRadius: 8, border: 'none', outline: 'none',
  background: '#f1f1f1', fontSize: 16, color: '#0d0d0d', padding: '0 16px', boxSizing: 'border-box', ...font,
};
const textAreaGray: React.CSSProperties = {
  width: '100%', minHeight: 140, borderRadius: 8, border: 'none', outline: 'none',
  background: '#f1f1f1', fontSize: 16, color: '#0d0d0d', padding: 16, resize: 'vertical' as const, boxSizing: 'border-box', ...font,
};

type AccKey = 'motoristas' | 'preparadores' | 'passageiros' | 'encomendas';

export default function PromocaoCreateScreen() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startLocal, setStartLocal] = useState(defaultStartDate);
  const [endLocal, setEndLocal] = useState(defaultEndDate);
  const [motoristas, setMotoristas] = useState(true);
  const [preparadores, setPreparadores] = useState(false);
  const [passageiros, setPassageiros] = useState(false);
  const [encomendas, setEncomendas] = useState(false);
  const [promoActive, setPromoActive] = useState(true);
  const [discountPct, setDiscountPct] = useState(15);
  const [citySearch, setCitySearch] = useState('');
  const [cityChecked, setCityChecked] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    CITY_OPTIONS.forEach((c) => { o[c] = ['São Paulo', 'Campinas', 'Curitiba'].includes(c); });
    return o;
  });
  const [obsMotoristas, setObsMotoristas] = useState('');
  const [expanded, setExpanded] = useState<Record<AccKey, boolean>>({
    motoristas: true,
    preparadores: false,
    passageiros: false,
    encomendas: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audiences = useMemo(() => ({ motoristas, preparadores, passageiros, encomendas }), [motoristas, preparadores, passageiros, encomendas]);

  const toggleAcc = useCallback((key: AccKey) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setAudience = useCallback((key: 'motoristas' | 'preparadores' | 'passageiros' | 'encomendas', v: boolean) => {
    if (key === 'motoristas') setMotoristas(v);
    if (key === 'preparadores') setPreparadores(v);
    if (key === 'passageiros') setPassageiros(v);
    if (key === 'encomendas') setEncomendas(v);
    if (v) setExpanded((e) => ({ ...e, [key]: true }));
  }, []);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return [...CITY_OPTIONS];
    return CITY_OPTIONS.filter((c) => c.toLowerCase().includes(q));
  }, [citySearch]);

  const clearCities = useCallback(() => {
    const o: Record<string, boolean> = {};
    CITY_OPTIONS.forEach((c) => { o[c] = false; });
    setCityChecked(o);
  }, []);

  const selectAllCities = useCallback(() => {
    const o: Record<string, boolean> = {};
    CITY_OPTIONS.forEach((c) => { o[c] = true; });
    setCityChecked(o);
  }, []);

  const cancel = useCallback(() => navigate('/promocoes'), [navigate]);

  const salvar = useCallback(async () => {
    setError(null);
    const ta = buildTargetAudiences(audiences);
    const ap = buildAppliesTo(audiences);
    if (!title.trim()) {
      setError('Informe o título da promoção.');
      return;
    }
    if (ta.length === 0) {
      setError('Selecione ao menos um tipo de público-alvo.');
      return;
    }
    if (ap.length === 0) {
      setError('Combinação de público inválida para aplicar a promoção.');
      return;
    }
    const dv = Math.round(discountPct);
    if (!Number.isFinite(dv) || dv <= 0 || dv > 100) {
      setError('Informe um percentual de desconto entre 1 e 100.');
      return;
    }
    const start = new Date(startLocal);
    const end = new Date(endLocal);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('Datas inválidas.');
      return;
    }
    if (end <= start) {
      setError('A data de término deve ser posterior à de início.');
      return;
    }

    setSaving(true);
    const descParts = [description.trim()];
    if (obsMotoristas.trim()) descParts.push(`[Motoristas] ${obsMotoristas.trim()}`);
    const fullDesc = descParts.filter(Boolean).join('\n\n') || undefined;

    const { error: err } = await createPromotion({
      title: title.trim(),
      description: fullDesc,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      target_audiences: ta,
      discount_type: 'percentage',
      discount_value: dv,
      applies_to: ap,
      is_active: promoActive,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    navigate('/promocoes');
  }, [title, description, startLocal, endLocal, audiences, discountPct, promoActive, obsMotoristas, navigate]);

  const audienceCheckbox = (
    key: 'motoristas' | 'preparadores' | 'passageiros' | 'encomendas',
    label: string,
    checked: boolean,
  ) =>
    React.createElement('label', {
      key,
      style: { display: 'flex', alignItems: 'center', cursor: 'pointer', paddingRight: 12, flex: '0 0 auto' },
    },
      React.createElement('input', {
        type: 'checkbox',
        checked,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAudience(key, e.target.checked),
        style: { width: 20, height: 20, margin: '10px 8px 10px 0', accentColor: '#0d0d0d', cursor: 'pointer', flexShrink: 0 },
      }),
      React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label));

  const toggleSwitch = () =>
    React.createElement('button', {
      type: 'button',
      role: 'switch',
      'aria-checked': promoActive,
      onClick: () => setPromoActive(!promoActive),
      style: {
        width: 48, height: 28, borderRadius: 100, border: 'none', padding: 0, cursor: 'pointer',
        background: promoActive ? '#0d0d0d' : '#c4c4c4', position: 'relative', flexShrink: 0,
      },
    },
      React.createElement('span', {
        style: {
          position: 'absolute', top: -4, width: 36, height: 36, borderRadius: '50%',
          background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          left: promoActive ? 15 : 2, transition: 'left 0.15s ease',
        },
      }));

  const actionButtons = (compact: boolean) =>
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: compact ? 'wrap' as const : 'nowrap', alignItems: 'center' } },
      React.createElement('button', {
        type: 'button', onClick: cancel, disabled: saving,
        style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px',
          borderRadius: 999, border: 'none', background: '#f1f1f1', cursor: saving ? 'not-allowed' : 'pointer',
          fontSize: 14, fontWeight: 600, color: '#b53838', ...font,
        },
      }, closeSvg, 'Cancelar promoção'),
      React.createElement('button', {
        type: 'button', onClick: salvar, disabled: saving,
        style: {
          display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px',
          borderRadius: 999, border: 'none', background: '#0d0d0d', cursor: saving ? 'not-allowed' : 'pointer',
          fontSize: 14, fontWeight: 600, color: '#fff', ...font, opacity: saving ? 0.7 : 1,
        },
      }, checkSvg, saving ? 'Salvando…' : 'Salvar promoção'));

  const dateRow = (label: string, value: string, onChange: (v: string) => void) =>
    React.createElement('div', { style: { flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('span', { style: { ...labelMd, minHeight: 40, display: 'flex', alignItems: 'center' } }, label),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, background: '#f1f1f1', borderRadius: 8, paddingLeft: 16, height: 44, boxSizing: 'border-box' } },
        calendarSvg,
        React.createElement('input', {
          type: 'datetime-local',
          value,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
          style: { flex: 1, minWidth: 0, height: 44, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: '#0d0d0d', ...font },
        })));

  const accordionShell = (
    key: AccKey,
    titleText: string,
    activeBorder: boolean,
    inner: React.ReactNode | null,
  ) => {
    const isOpen = expanded[key];
    return React.createElement('div', {
      key,
      style: {
        width: '100%', border: `${activeBorder ? 1.5 : 1}px solid ${activeBorder ? '#0d0d0d' : '#e2e2e2'}`,
        borderRadius: 12, padding: 24, boxSizing: 'border-box' as const,
      },
    },
      React.createElement('button', {
        type: 'button',
        onClick: () => toggleAcc(key),
        style: {
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' as const,
        },
      },
        React.createElement('span', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', ...font } }, titleText),
        React.createElement('span', { style: { transform: isOpen ? 'none' : 'rotate(180deg)', display: 'flex', transition: 'transform 0.15s ease' } }, chevronDownSvg)),
      isOpen && inner ? React.createElement('div', { style: { marginTop: 16 } }, inner) : null);
  };

  const motoristasInner = motoristas
    ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: labelMd }, 'Porcentagem de ganho adicional (%)'),
        React.createElement('input', {
          type: 'number',
          min: 1,
          max: 100,
          value: discountPct,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDiscountPct(Number(e.target.value)),
          style: inputGray,
        })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: labelMd }, 'Digite o nome da cidade para adicionar'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, background: '#f1f1f1', borderRadius: 8, paddingLeft: 16, height: 44 } },
          searchSvg,
          React.createElement('input', {
            type: 'text',
            value: citySearch,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCitySearch(e.target.value),
            placeholder: 'Ex: Recife',
            style: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: citySearch ? '#0d0d0d' : '#767676', ...font },
          }))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        ...filteredCities.map((c) =>
          React.createElement('label', {
            key: c,
            style: { display: 'flex', alignItems: 'center', cursor: 'pointer' },
          },
            React.createElement('input', {
              type: 'checkbox',
              checked: !!cityChecked[c],
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setCityChecked((prev) => ({ ...prev, [c]: e.target.checked })),
              style: { width: 20, height: 20, margin: '10px 8px 10px 0', accentColor: '#0d0d0d' },
            }),
            React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, c)))),
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, maxWidth: 510 } },
        React.createElement('button', {
          type: 'button',
          onClick: clearCities,
          style: {
            flex: '1 1 160px', height: 44, borderRadius: 8, border: 'none', background: '#f1f1f1',
            fontSize: 14, fontWeight: 600, color: '#b53838', cursor: 'pointer', ...font,
          },
        }, 'Limpar cidades'),
        React.createElement('button', {
          type: 'button',
          onClick: selectAllCities,
          style: {
            flex: '1 1 160px', height: 44, borderRadius: 8, border: '1px solid #0d0d0d', background: '#fff',
            fontSize: 14, fontWeight: 600, color: '#0d0d0d', cursor: 'pointer', ...font,
          },
        }, 'Selecionar tudo')),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
          React.createElement('span', { style: labelMd }, 'Observações'),
          React.createElement('span', { style: labelSmMuted }, 'Opcional')),
        React.createElement('textarea', {
          value: obsMotoristas,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setObsMotoristas(e.target.value),
          placeholder: 'Notas internas sobre esta promoção',
          style: textAreaGray,
        })),
      React.createElement('div', {
        style: {
          background: '#fff8e6', borderRadius: 8, padding: '16px 16px 12px', boxShadow: '0px 4px 20px rgba(13,13,13,0.04)',
          display: 'flex', flexDirection: 'column' as const, gap: 16,
        },
      },
        React.createElement('span', { style: { ...labelMd, fontSize: 14 } }, 'Margem de ganho'),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 24, width: '100%' } },
          React.createElement('input', {
            type: 'range',
            min: 1,
            max: 100,
            value: discountPct,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDiscountPct(Number(e.target.value)),
            style: { flex: 1, accentColor: '#cba04b', height: 8 },
          }),
          React.createElement('span', { style: { fontSize: 16, fontWeight: 700, color: '#a37e38', ...font, flexShrink: 0 } }, `${Math.round(discountPct)}%`))))
    : React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Marque «Motoristas» em Tipo de público-alvo para configurar esta seção.');

  const simpleAccPlaceholder = (label: string) =>
    React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } },
      `Opções específicas para ${label} usam o mesmo percentual global acima. Ajuste o valor em «Porcentagem de ganho adicional» na secção Motoristas ou pelo controlo deslizante.`);

  const breadcrumb = React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' as const } },
    React.createElement('button', {
      type: 'button',
      onClick: () => navigate('/promocoes'),
      style: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#767676', ...font },
    }, 'Promoções'),
    React.createElement('span', { style: { fontSize: 12, color: '#767676' } }, '›'),
    React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Criar promoção'));

  const topRow = React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const, width: '100%' } },
    React.createElement('button', {
      type: 'button',
      onClick: cancel,
      style: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font },
    }, arrowLeftSvg, 'Voltar'),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, actionButtons(true)));

  const mainCard = React.createElement('div', {
    style: {
      width: '100%', maxWidth: 1044, border: '1px solid #e2e2e2', borderRadius: 12, padding: 24,
      boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column' as const, gap: 16,
    },
  },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('h1', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Criar nova promoção'),
      React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, lineHeight: 1.5, ...font } },
        'Preencha os dados da nova promoção. Após salvar, ela ficará disponível imediatamente se estiver marcada como ativa.')),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('span', { style: { ...labelMd, minHeight: 40, display: 'flex', alignItems: 'center' } }, 'Título da promoção'),
      React.createElement('input', {
        type: 'text',
        value: title,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value),
        placeholder: 'Digite o nome da promoção',
        style: inputGray,
      })),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const } },
        React.createElement('span', { style: { ...labelMd, minHeight: 40, display: 'flex', alignItems: 'center' } }, 'Observações'),
        React.createElement('span', { style: labelSmMuted }, 'Opcional')),
      React.createElement('textarea', {
        value: description,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value),
        placeholder: 'Explique brevemente o objetivo desta promoção',
        style: textAreaGray,
      })),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const, width: '100%' } },
      dateRow('Data e hora de início', startLocal, setStartLocal),
      dateRow('Data e hora de término', endLocal, setEndLocal)),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      React.createElement('span', { style: { ...labelMd, minHeight: 32 } }, 'Tipo de público-alvo'),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 4, alignItems: 'center' } },
        audienceCheckbox('motoristas', 'Motoristas', motoristas),
        audienceCheckbox('preparadores', 'Preparadores', preparadores),
        audienceCheckbox('passageiros', 'Passageiros', passageiros),
        audienceCheckbox('encomendas', 'Encomendas', encomendas))),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 8, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { flex: '1 1 200px', minWidth: 0 } },
        React.createElement('div', { style: { ...labelMd, marginBottom: 4 } }, 'Status da promoção'),
        React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, lineHeight: 1.5, ...font } },
          'Ao ativar, a promoção ficará disponível imediatamente')),
      toggleSwitch()));

  const accordions = React.createElement('div', { style: { width: '100%', maxWidth: 1044, display: 'flex', flexDirection: 'column' as const, gap: 16 } },
    accordionShell('motoristas', 'Motoristas', expanded.motoristas, motoristasInner),
    accordionShell('preparadores', 'Preparadores', expanded.preparadores, preparadores ? simpleAccPlaceholder('preparadores') : React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Marque «Preparadores» para ver as opções.')),
    accordionShell('passageiros', 'Passageiros', expanded.passageiros, passageiros ? simpleAccPlaceholder('passageiros') : React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Marque «Passageiros» para ver as opções.')),
    accordionShell('encomendas', 'Encomendas', expanded.encomendas, encomendas ? simpleAccPlaceholder('encomendas') : React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, ...font } }, 'Marque «Encomendas» para ver as opções.')));

  const errEl = error
    ? React.createElement('div', {
      role: 'alert',
      style: {
        width: '100%', maxWidth: 1044, padding: 12, borderRadius: 8, background: '#fde8e6',
        color: '#551611', fontSize: 14, ...font, boxSizing: 'border-box' as const,
      },
    }, error)
    : null;

  const footerActions = React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', width: '100%', maxWidth: 1044 } }, actionButtons(false));

  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'stretch', gap: 24, width: '100%', paddingBottom: 64 } },
    breadcrumb,
    topRow,
    errEl,
    mainCard,
    accordions,
    footerActions);
}
