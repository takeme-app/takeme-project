/**
 * AnalyticsScreen — Dashboard de analytics avançado.
 * Receita, performance, crescimento de usuários, motoristas, encomendas.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { webStyles } from '../styles/webStyles';
import { fetchAnalyticsData } from '../data/queries';
import type { AnalyticsData } from '../data/queries';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluído',
  scheduled: 'Agendado',
  in_progress: 'Em andamento',
  cancelled: 'Cancelado',
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  suspended: 'Suspenso',
  unknown: 'Desconhecido',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#16a34a',
  scheduled: '#2563eb',
  in_progress: '#d97706',
  cancelled: '#dc2626',
  pending: '#d97706',
  approved: '#16a34a',
  rejected: '#dc2626',
  suspended: '#6b7280',
  unknown: '#9ca3af',
};

function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function fmtCurrency(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AnalyticsScreen() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData().then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', ...font } }, 'Carregando analytics...'));
  }

  // ── KPI cards ───────────────────────────────────────────────────────
  const kpiCard = (title: string, value: string, subtitle?: string, color?: string) =>
    React.createElement('div', {
      style: { flex: '1 1 0', minWidth: 180, background: '#f6f6f6', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 8 },
    },
      React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, title),
      React.createElement('span', { style: { fontSize: 28, fontWeight: 700, color: color || '#0d0d0d', ...font } }, value),
      subtitle ? React.createElement('span', { style: { fontSize: 12, color: '#999', ...font } }, subtitle) : null);

  const kpiRow = React.createElement('div', { style: { display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap' as const } },
    kpiCard('Receita total', fmtCurrency(data.totalRevenueCents)),
    kpiCard('Viagens', String(data.tripsByStatus.reduce((s, t) => s + t.count, 0))),
    kpiCard('Usuários', String(data.totalUsers)),
    kpiCard('Motoristas', String(data.totalDrivers)),
    kpiCard('Encomendas', String(data.totalShipments)),
    kpiCard('Avaliação média', data.avgRating.toFixed(1) + ' ★', `${data.totalRatings} avaliações`, '#d97706'));

  // ── Bar chart helper ────────────────────────────────────────────────
  const barChart = (title: string, items: { label: string; value: number }[], formatValue?: (v: number) => string) => {
    const maxVal = Math.max(1, ...items.map((i) => i.value));
    return React.createElement('div', {
      style: { background: '#fff', borderRadius: 16, border: '1px solid #e2e2e2', padding: 24, flex: '1 1 0', minWidth: 340 },
    },
      React.createElement('h3', { style: { fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#0d0d0d', ...font } }, title),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        ...items.map((item) =>
          React.createElement('div', {
            key: item.label,
            style: { display: 'flex', alignItems: 'center', gap: 8 },
          },
            React.createElement('span', { style: { width: 48, fontSize: 11, color: '#767676', textAlign: 'right' as const, flexShrink: 0, ...font } }, item.label),
            React.createElement('div', { style: { flex: 1, height: 20, background: '#f1f1f1', borderRadius: 4, overflow: 'hidden' } },
              React.createElement('div', { style: { width: `${(item.value / maxVal) * 100}%`, height: '100%', background: '#0d0d0d', borderRadius: 4, minWidth: item.value > 0 ? 4 : 0 } })),
            React.createElement('span', { style: { width: 64, fontSize: 11, color: '#555', ...font } }, formatValue ? formatValue(item.value) : String(item.value))))));
  };

  // ── Pie/donut chart helper ──────────────────────────────────────────
  const donutChart = (title: string, items: { label: string; value: number; color: string }[]) => {
    const total = items.reduce((s, i) => s + i.value, 0);
    return React.createElement('div', {
      style: { background: '#fff', borderRadius: 16, border: '1px solid #e2e2e2', padding: 24, flex: '1 1 0', minWidth: 280 },
    },
      React.createElement('h3', { style: { fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#0d0d0d', ...font } }, title),
      // Stacked bar as simplified donut
      React.createElement('div', { style: { display: 'flex', height: 24, borderRadius: 12, overflow: 'hidden', background: '#f1f1f1', marginBottom: 16 } },
        ...items.filter((i) => i.value > 0).map((item) =>
          React.createElement('div', {
            key: item.label,
            title: `${item.label}: ${item.value}`,
            style: { width: `${(item.value / Math.max(1, total)) * 100}%`, height: '100%', background: item.color },
          }))),
      // Legend
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap' as const, gap: 12 } },
        ...items.map((item) =>
          React.createElement('div', {
            key: item.label,
            style: { display: 'flex', alignItems: 'center', gap: 6 },
          },
            React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 } }),
            React.createElement('span', { style: { fontSize: 12, color: '#555', ...font } }, `${item.label} (${item.value})`)))));
  };

  // ── Revenue by month chart ──────────────────────────────────────────
  const revenueChart = barChart(
    'Receita mensal',
    data.revenueByMonth.map((r) => ({ label: fmtMonth(r.month), value: r.revenue })),
    (v) => fmtCurrency(v),
  );

  // ── Trips by month chart ────────────────────────────────────────────
  const tripsChart = barChart(
    'Viagens por mês',
    data.tripsByMonth.map((t) => ({ label: fmtMonth(t.month), value: t.count })),
  );

  // ── Trips by status donut ──────────────────────────────────────────
  const tripsStatusChart = donutChart(
    'Viagens por status',
    data.tripsByStatus.map((t) => ({
      label: STATUS_LABELS[t.status] || t.status,
      value: t.count,
      color: STATUS_COLORS[t.status] || '#9ca3af',
    })),
  );

  // ── New users by month ──────────────────────────────────────────────
  const usersChart = barChart(
    'Novos usuários por mês',
    data.newUsersByMonth.map((u) => ({ label: fmtMonth(u.month), value: u.count })),
  );

  // ── Drivers by status ──────────────────────────────────────────────
  const driversStatusChart = donutChart(
    'Motoristas por status',
    data.driversByStatus.map((d) => ({
      label: STATUS_LABELS[d.status] || d.status,
      value: d.count,
      color: STATUS_COLORS[d.status] || '#9ca3af',
    })),
  );

  // ── Shipments by month ─────────────────────────────────────────────
  const shipmentsChart = barChart(
    'Encomendas por mês',
    data.shipmentsByMonth.map((s) => ({ label: fmtMonth(s.month), value: s.count })),
  );

  return React.createElement(React.Fragment, null,
    React.createElement('h1', { style: webStyles.homeTitle }, 'Analytics'),
    kpiRow,
    // Row 1: Revenue + Trips
    React.createElement('div', { style: { display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap' as const } },
      revenueChart, tripsChart),
    // Row 2: Trips status + Drivers status
    React.createElement('div', { style: { display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap' as const } },
      tripsStatusChart, driversStatusChart),
    // Row 3: Users + Shipments
    React.createElement('div', { style: { display: 'flex', gap: 16, width: '100%', flexWrap: 'wrap' as const } },
      usersChart, shipmentsChart));
}
