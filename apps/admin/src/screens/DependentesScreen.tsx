/**
 * DependentesScreen — Gestão de dependentes cadastrados (validação pendente/validado).
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { webStyles, filterIconSvg } from '../styles/webStyles';
import { fetchAllDependents, updateDependentStatus } from '../data/queries';
import type { DependentAdminRow } from '../data/queries';

const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } = require('recharts');

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const closeSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
  React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

const externalLinkSvg = React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('polyline', { points: '15 3 21 3 21 9', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('line', { x1: 10, y1: 14, x2: 21, y2: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' }));

const renderAvatar = (nome: string, avatarUrl?: string | null) => {
  const initial = (nome || '?')[0].toUpperCase();
  const colors = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899'];
  const bg = colors[initial.charCodeAt(0) % colors.length];
  if (avatarUrl) return React.createElement('img', { src: avatarUrl, alt: nome, style: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 } });
  return React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0, ...font } }, initial);
};

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return '—'; }
};

const genderLabel: Record<string, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro', m: 'Masc.', f: 'Fem.' };

export default function DependentesScreen() {
  const navigate = useNavigate();

  // ── Data ──────────────────────────────────────────────────────────────
  const [dependents, setDependents] = useState<DependentAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // ── Filter state ──────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pending' | 'validated'>('todos');
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [filtroPeriodIni, setFiltroPeriodIni] = useState('');
  const [filtroPeriodFim, setFiltroPeriodFim] = useState('');
  const [appliedPeriodIni, setAppliedPeriodIni] = useState('');
  const [appliedPeriodFim, setAppliedPeriodFim] = useState('');
  const [tblSearch, setTblSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchAllDependents().then((rows) => {
      if (!cancelled) { setDependents(rows); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleValidate = async (id: string) => {
    setActionLoading(id);
    const { error } = await updateDependentStatus(id, 'validated');
    setActionLoading(null);
    if (error) { showToast('Erro ao validar dependente.'); return; }
    setDependents((prev) => prev.map((d) => d.id === id ? { ...d, status: 'validated' } : d));
    showToast('Dependente validado com sucesso!');
  };

  const handlePending = async (id: string) => {
    setActionLoading(id);
    const { error } = await updateDependentStatus(id, 'pending');
    setActionLoading(null);
    if (error) { showToast('Erro ao atualizar status.'); return; }
    setDependents((prev) => prev.map((d) => d.id === id ? { ...d, status: 'pending' } : d));
    showToast('Status atualizado para Pendente.');
  };

  // ── KPIs ──────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total: dependents.length,
    pending: dependents.filter((d) => d.status === 'pending').length,
    validated: dependents.filter((d) => d.status === 'validated').length,
  }), [dependents]);

  const pieData = useMemo(() => [
    { name: 'Pendentes', value: kpis.pending, color: '#f59e0b' },
    { name: 'Validados', value: kpis.validated, color: '#0d8344' },
  ].filter((d) => d.value > 0), [kpis]);

  // ── Filtered rows ─────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return dependents.filter((d) => {
      if (statusFilter !== 'todos' && d.status !== statusFilter) return false;
      if (appliedPeriodIni && d.createdAt && d.createdAt.slice(0, 10) < appliedPeriodIni) return false;
      if (appliedPeriodFim && d.createdAt && d.createdAt.slice(0, 10) > appliedPeriodFim) return false;
      if (tblSearch) {
        const q = tblSearch.toLowerCase();
        if (!d.nome.toLowerCase().includes(q) && !d.responsavelNome.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [dependents, statusFilter, appliedPeriodIni, appliedPeriodFim, tblSearch]);

  // ── Chip helper ────────────────────────────────────────────────────────
  const chip = (label: string, active: boolean, onClick: () => void) =>
    React.createElement('button', {
      type: 'button', key: label, onClick,
      style: { padding: '6px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, ...font, background: active ? '#0d0d0d' : '#f1f1f1', color: active ? '#fff' : '#0d0d0d' },
    }, label);

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', ...font } }, 'Carregando dependentes...'));
  }

  // ── Pie tooltip ────────────────────────────────────────────────────────
  const customTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const total = kpis.total || 1;
    const pct = Math.round((d.value / total) * 100);
    return React.createElement('div', {
      style: { background: '#0d0d0d', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, ...font },
    }, `${d.name}: ${pct}% (${d.value})`);
  };

  const dot = (color: string) => ({ width: 18, height: 18, borderRadius: '50%', background: color, flexShrink: 0 });

  // ── KPI cards ──────────────────────────────────────────────────────────
  const kpiRow = React.createElement('div', { style: { display: 'flex', gap: 20, width: '100%', flexWrap: 'wrap' as const } },
    ...[
      { label: 'Total de dependentes', value: kpis.total, color: '#0d0d0d' },
      { label: 'Pendentes de validação', value: kpis.pending, color: '#92400e' },
      { label: 'Validados', value: kpis.validated, color: '#174f38' },
    ].map((k) => React.createElement('div', {
      key: k.label,
      style: { flex: '1 1 0', minWidth: 160, background: '#f6f6f6', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 20, boxSizing: 'border-box' as const },
    },
      React.createElement('p', { style: { fontSize: 14, fontWeight: 500, color: '#767676', margin: 0, ...font } }, k.label),
      React.createElement('p', { style: { fontSize: 32, fontWeight: 700, color: k.color, margin: 0, ...font } }, String(k.value)))));

  // ── Pie chart section ─────────────────────────────────────────────────
  const chartSection = React.createElement('div', { style: { background: '#f6f6f6', borderRadius: 16, padding: 24, display: 'flex', gap: 40, flexWrap: 'wrap' as const, alignItems: 'center' } },
    React.createElement('div', null,
      React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: '0 0 4px', ...font } }, 'Distribuição por status'),
      React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: '0 0 16px', ...font } }, 'Pendentes vs Validados')),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' as const } },
      React.createElement('div', { style: { width: 220, height: 220, flexShrink: 0 } },
        React.createElement(ResponsiveContainer, { width: '100%', height: '100%' },
          React.createElement(PieChart, null,
            React.createElement(Pie, {
              data: pieData.length ? pieData : [{ name: 'Sem dados', value: 1, color: '#e2e2e2' }],
              cx: '50%', cy: '50%', innerRadius: 0, outerRadius: 95,
              dataKey: 'value', stroke: '#f6f6f6', strokeWidth: 2,
              animationBegin: 0, animationDuration: 800,
            },
              ...(pieData.length ? pieData : [{ name: 'Sem dados', value: 1, color: '#e2e2e2' }]).map((_: any, idx: number) => {
                const data = pieData.length ? pieData : [{ name: 'Sem dados', value: 1, color: '#e2e2e2' }];
                return React.createElement(Cell, { key: `cell-${idx}`, fill: data[idx].color });
              })),
            React.createElement(Tooltip, { content: customTooltip })))),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 12 } },
        React.createElement('p', { style: { fontSize: 13, fontWeight: 500, color: '#767676', margin: 0, ...font } }, `Total: ${kpis.total}`),
        ...pieData.map((d) => {
          const pct = kpis.total > 0 ? Math.round((d.value / kpis.total) * 100) : 0;
          return React.createElement('div', { key: d.name, style: { display: 'flex', alignItems: 'center', gap: 8 } },
            React.createElement('div', { style: dot(d.color) }),
            React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, `${d.name}: ${pct}% (${d.value})`));
        }))));

  // ── Search / filter row ────────────────────────────────────────────────
  const searchRow = React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, width: '100%', flexWrap: 'wrap' as const } },
    React.createElement('button', {
      type: 'button', onClick: () => setFiltroOpen(true),
      style: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px', borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font },
    }, filterIconSvg, 'Filtros'));

  // ── Status filter chips ────────────────────────────────────────────────
  const statusChips = React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
    chip('Todos', statusFilter === 'todos', () => setStatusFilter('todos')),
    chip('Pendentes', statusFilter === 'pending', () => setStatusFilter('pending')),
    chip('Validados', statusFilter === 'validated', () => setStatusFilter('validated')));

  // ── Table cols ─────────────────────────────────────────────────────────
  const tableCols = [
    { label: 'Dependente', flex: '1 1 18%', minWidth: 150 },
    { label: 'Responsável', flex: '1 1 16%', minWidth: 140 },
    { label: 'Idade', flex: '0 0 70px', minWidth: 70 },
    { label: 'Gênero', flex: '0 0 100px', minWidth: 100 },
    { label: 'Documento', flex: '0 0 110px', minWidth: 110 },
    { label: 'Cadastrado', flex: '0 0 110px', minWidth: 110 },
    { label: 'Status', flex: '0 0 120px', minWidth: 120 },
    { label: 'Ações', flex: '0 0 170px', minWidth: 170 },
  ];

  const statusStyle = {
    pending:   { bg: '#fef3c7', color: '#92400e', label: 'Pendente' },
    validated: { bg: '#b0e8d1', color: '#174f38', label: 'Validado' },
  };

  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 13, color: '#0d0d0d', ...font, padding: '0 8px' };

  const tableSection = React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72, padding: '0 24px', background: '#f6f6f6', borderRadius: '16px 16px 0 0' } },
      React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, `Lista de dependentes (${filteredRows.length})`),
      React.createElement('input', {
        type: 'text', placeholder: 'Buscar dependente ou responsável...', value: tblSearch,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTblSearch(e.target.value),
        style: { height: 36, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 13, color: '#0d0d0d', outline: 'none', minWidth: 240, ...font },
      })),
    React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } },
      // Header
      React.createElement('div', { style: { display: 'flex', height: 48, background: '#e2e2e2', padding: '0 16px', alignItems: 'center' } },
        ...tableCols.map((c) => React.createElement('div', {
          key: c.label,
          style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 600, color: '#0d0d0d', ...font, padding: '0 8px' },
        }, c.label))),
      // Rows
      filteredRows.length === 0
        ? React.createElement('div', { style: { padding: '32px 24px', color: '#767676', ...font, textAlign: 'center' as const } }, 'Nenhum dependente encontrado.')
        : React.createElement(React.Fragment, null,
            ...filteredRows.map((d) => {
              const st = statusStyle[d.status];
              const isLoading = actionLoading === d.id;
              return React.createElement('div', {
                key: d.id,
                style: { display: 'flex', minHeight: 64, alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #e9e9e9', background: '#f6f6f6' },
              },
                // Dependente
                React.createElement('div', { style: { ...cellBase, flex: tableCols[0].flex, minWidth: tableCols[0].minWidth, gap: 8, overflow: 'hidden' } },
                  renderAvatar(d.nome),
                  React.createElement('span', { style: { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const } }, d.nome)),
                // Responsável
                React.createElement('div', { style: { ...cellBase, flex: tableCols[1].flex, minWidth: tableCols[1].minWidth, gap: 6, overflow: 'hidden' } },
                  renderAvatar(d.responsavelNome, d.responsavelAvatarUrl),
                  React.createElement('button', {
                    type: 'button', onClick: () => navigate(`/passageiros/${d.userId}`),
                    style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#1d4ed8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, ...font, padding: 0 },
                  }, d.responsavelNome)),
                // Idade
                React.createElement('div', { style: { ...cellBase, flex: tableCols[2].flex, minWidth: tableCols[2].minWidth } }, d.age != null ? `${d.age} anos` : '—'),
                // Gênero
                React.createElement('div', { style: { ...cellBase, flex: tableCols[3].flex, minWidth: tableCols[3].minWidth } }, d.gender ? (genderLabel[d.gender] ?? d.gender) : '—'),
                // Documento
                React.createElement('div', { style: { ...cellBase, flex: tableCols[4].flex, minWidth: tableCols[4].minWidth } },
                  d.documentUrl
                    ? React.createElement('a', { href: d.documentUrl, target: '_blank', rel: 'noopener noreferrer', style: { display: 'flex', alignItems: 'center', gap: 4, color: '#1d4ed8', textDecoration: 'none', fontSize: 12, fontWeight: 500, ...font } }, externalLinkSvg, 'Ver doc.')
                    : React.createElement('span', { style: { fontSize: 12, color: '#9ca3af', ...font } }, 'Sem doc.')),
                // Cadastrado
                React.createElement('div', { style: { ...cellBase, flex: tableCols[5].flex, minWidth: tableCols[5].minWidth, fontSize: 12, color: '#6b7280' } }, fmtDate(d.createdAt)),
                // Status
                React.createElement('div', { style: { ...cellBase, flex: tableCols[6].flex, minWidth: tableCols[6].minWidth } },
                  React.createElement('span', { style: { fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: st.bg, color: st.color, whiteSpace: 'nowrap' as const, ...font } }, st.label)),
                // Ações
                React.createElement('div', { style: { flex: tableCols[7].flex, minWidth: tableCols[7].minWidth, padding: '0 8px', display: 'flex', gap: 6, alignItems: 'center' } },
                  d.status === 'pending'
                    ? React.createElement('button', {
                        type: 'button', disabled: isLoading,
                        onClick: () => handleValidate(d.id),
                        style: { padding: '5px 14px', borderRadius: 999, border: 'none', background: '#0d8344', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: isLoading ? 0.5 : 1, ...font },
                      }, isLoading ? '...' : 'Validar')
                    : React.createElement('button', {
                        type: 'button', disabled: isLoading,
                        onClick: () => handlePending(d.id),
                        style: { padding: '5px 14px', borderRadius: 999, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: isLoading ? 0.5 : 1, ...font },
                      }, isLoading ? '...' : 'Pend. validação')));
            }))));

  // ── Filter modal ───────────────────────────────────────────────────────
  const filtroModal = filtroOpen ? React.createElement('div', {
    role: 'dialog', 'aria-modal': 'true',
    style: { position: 'fixed' as const, inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 24, background: 'rgba(0,0,0,0.18)' },
    onClick: () => setFiltroOpen(false),
  },
    React.createElement('div', {
      style: { background: '#fff', borderRadius: 20, padding: 24, width: 360, maxHeight: '90vh', overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Filtros'),
        React.createElement('button', { type: 'button', onClick: () => setFiltroOpen(false), style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, closeSvg)),
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Período'),
        React.createElement('label', { style: { fontSize: 13, color: '#767676', ...font } }, 'Data inicial'),
        React.createElement('input', { type: 'date', value: filtroPeriodIni, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFiltroPeriodIni(e.target.value), style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, outline: 'none', ...font } }),
        React.createElement('label', { style: { fontSize: 13, color: '#767676', ...font } }, 'Data final'),
        React.createElement('input', { type: 'date', value: filtroPeriodFim, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFiltroPeriodFim(e.target.value), style: { height: 40, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 12px', fontSize: 14, outline: 'none', ...font } })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Status'),
        React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
          chip('Todos', statusFilter === 'todos', () => setStatusFilter('todos')),
          chip('Pendentes', statusFilter === 'pending', () => setStatusFilter('pending')),
          chip('Validados', statusFilter === 'validated', () => setStatusFilter('validated')))),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('button', {
          type: 'button',
          onClick: () => { setAppliedPeriodIni(filtroPeriodIni); setAppliedPeriodFim(filtroPeriodFim); setFiltroOpen(false); },
          style: { flex: 1, height: 44, borderRadius: 999, border: 'none', background: '#0d0d0d', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Aplicar'),
        React.createElement('button', {
          type: 'button',
          onClick: () => { setFiltroPeriodIni(''); setFiltroPeriodFim(''); setAppliedPeriodIni(''); setAppliedPeriodFim(''); setStatusFilter('todos'); setFiltroOpen(false); },
          style: { flex: 1, height: 44, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', color: '#b53838', fontSize: 15, fontWeight: 600, cursor: 'pointer', ...font },
        }, 'Redefinir filtros')))) : null;

  // ── Toast ──────────────────────────────────────────────────────────────
  const toastEl = toastMsg ? React.createElement('div', {
    style: { position: 'fixed' as const, bottom: 32, right: 32, zIndex: 9999, background: '#0d0d0d', color: '#fff', padding: '14px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', ...font },
  }, toastMsg) : null;

  // ── Render ─────────────────────────────────────────────────────────────
  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Dependentes'),
    searchRow,
    kpiRow,
    chartSection,
    statusChips,
    tableSection,
    filtroModal,
    toastEl);
}
