/**
 * MotoristaEditScreen — Editar motorista conforme Figma 830-10503.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { webStyles, arrowBackSvg } from '../styles/webStyles';
import { supabase } from '../lib/supabase';
import { updateWorkerStatus, updateVehicleStatus } from '../data/queries';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

// Read-only field helper
const roField = (label: string, value: string) =>
  React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex: '1 1 0', minWidth: 200 } },
    React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: '#767676', ...font } }, label),
    React.createElement('div', {
      style: { height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font },
    }, value || '—'));

const docRow = (name: string) =>
  React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f1f1' },
  },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('path', { d: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', stroke: '#767676', strokeWidth: 2 }),
        React.createElement('path', { d: 'M14 2v6h6', stroke: '#767676', strokeWidth: 2 })),
      React.createElement('span', { style: { fontSize: 13, color: '#0d0d0d', ...font } }, name)),
    React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { cursor: 'pointer' } },
      React.createElement('path', { d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3', stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })));

export default function MotoristaEditScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [worker, setWorker] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const db = supabase as any;
    Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      db.from('worker_profiles').select('*').eq('id', id).single(),
      db.from('vehicles').select('*').eq('worker_id', id).order('created_at', { ascending: false }),
      db.from('worker_routes').select('*').eq('worker_id', id).order('created_at', { ascending: false }),
      supabase.from('scheduled_trips').select('*').eq('driver_id', id).order('departure_at', { ascending: false }).limit(20),
    ]).then(([pRes, wRes, vRes, rRes, tRes]) => {
      if (cancelled) return;
      setProfile(pRes.data);
      setWorker(wRes.data);
      setVehicles(vRes.data || []);
      setRoutes(rRes.data || []);
      setTrips(tRes.data || []);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return React.createElement('div', { style: { display: 'flex', justifyContent: 'center', padding: 64 } },
      React.createElement('span', { style: { fontSize: 16, color: '#767676', ...font } }, 'Carregando motorista...'));
  }

  const nome = profile?.full_name || 'Sem nome';
  const cpf = worker?.cpf || '—';
  const idade = worker?.age ? `${worker.age} anos` : '—';
  const cidade = worker?.city || profile?.city || '—';
  const experiencia = worker?.experience_years ? `${worker.experience_years} anos` : '—';
  const banco = worker?.bank_code || '—';
  const agencia = worker?.bank_agency || '—';
  const conta = worker?.bank_account || '—';
  const pix = worker?.pix_key || '—';
  const possuiVeiculo = worker?.has_own_vehicle;
  const workerStatus = worker?.status || 'pending';

  const [actionLoading, setActionLoading] = useState(false);
  const handleApprove = useCallback(async () => {
    if (!worker?.id) return;
    setActionLoading(true);
    await updateWorkerStatus(worker.id, 'approved');
    setActionLoading(false);
    navigate(-1);
  }, [worker, navigate]);
  const handleReject = useCallback(async () => {
    if (!worker?.id) return;
    setActionLoading(true);
    await updateWorkerStatus(worker.id, 'rejected');
    setActionLoading(false);
    navigate(-1);
  }, [worker, navigate]);
  const handleSuspend = useCallback(async () => {
    if (!worker?.id) return;
    setActionLoading(true);
    await updateWorkerStatus(worker.id, 'suspended');
    setActionLoading(false);
    navigate(-1);
  }, [worker, navigate]);

  // ── Breadcrumb ────────────────────────────────────────────────────────
  const breadcrumb = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#767676', ...font },
  },
    React.createElement('span', null, 'Motoristas'),
    React.createElement('span', null, '>'),
    React.createElement('span', { style: { color: '#0d0d0d', fontWeight: 500 } }, 'Editar viagem'));

  // ── Header ────────────────────────────────────────────────────────────
  const header = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 },
  },
    React.createElement('button', {
      type: 'button', onClick: () => navigate(-1),
      style: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font, padding: 0 },
    }, arrowBackSvg, 'Voltar'),
    React.createElement('div', { style: { display: 'flex', gap: 12 } },
      React.createElement('button', {
        type: 'button', onClick: () => navigate(-1),
        style: {
          display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px',
          borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff',
          color: '#b53838', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
        },
      },
        React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#b53838', strokeWidth: 2, strokeLinecap: 'round' })),
        'Cancelar'),
      React.createElement('button', {
        type: 'button', onClick: () => navigate(-1),
        style: {
          display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px',
          borderRadius: 999, border: 'none', background: '#0d0d0d',
          color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
        },
      },
        React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
        'Salvar alteração')));

  // ── Status action bar ─────────────────────────────────────────────────
  const statusBadgeColor = workerStatus === 'approved' ? '#b0e8d1' : workerStatus === 'rejected' ? '#eeafaa' : workerStatus === 'suspended' ? '#eeafaa' : '#fee59a';
  const statusBadgeText = workerStatus === 'approved' ? '#174f38' : workerStatus === 'rejected' ? '#551611' : workerStatus === 'suspended' ? '#551611' : '#654c01';
  const statusLabel = workerStatus === 'approved' ? 'Aprovado' : workerStatus === 'rejected' ? 'Rejeitado' : workerStatus === 'suspended' ? 'Suspenso' : workerStatus === 'pending' ? 'Pendente' : workerStatus;
  const actionBtnStyle = (bg: string, color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px',
    borderRadius: 999, border: 'none', background: bg, color, fontSize: 14, fontWeight: 600,
    cursor: actionLoading ? 'wait' : 'pointer', opacity: actionLoading ? 0.6 : 1, ...font,
  });

  const statusActions = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#fff', borderRadius: 16, border: '1px solid #e2e2e2', flexWrap: 'wrap' as const, gap: 12 },
  },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } }, 'Status do motorista:'),
      React.createElement('span', { style: { fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999, background: statusBadgeColor, color: statusBadgeText, ...font } }, statusLabel)),
    React.createElement('div', { style: { display: 'flex', gap: 8 } },
      workerStatus !== 'approved' ? React.createElement('button', { type: 'button', onClick: handleApprove, disabled: actionLoading, style: actionBtnStyle('#22c55e', '#fff') }, 'Aprovar') : null,
      workerStatus !== 'rejected' ? React.createElement('button', { type: 'button', onClick: handleReject, disabled: actionLoading, style: actionBtnStyle('#fff', '#b53838') }, 'Rejeitar') : null,
      workerStatus === 'approved' ? React.createElement('button', { type: 'button', onClick: handleSuspend, disabled: actionLoading, style: actionBtnStyle('#f1f1f1', '#b53838') }, 'Suspender') : null));

  // ── Toast warning ─────────────────────────────────────────────────────
  const toast = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      background: '#fff8e1', border: '1px solid #f5d679', borderRadius: 12,
    },
  },
    React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' },
      React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#cba04b', strokeWidth: 2 }),
      React.createElement('path', { d: 'M12 8v4M12 16h.01', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round' })),
    React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, 'Você está editando os dados do motorista'));

  // ── Dados do Motorista ────────────────────────────────────────────────
  const dadosSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 16, padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #e2e2e2' },
  },
    React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Dados do Motorista'),
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#cba04b', margin: 0, ...font } }, 'Dados básicos'),
    roField('Nome completo', nome),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      roField('CPF', cpf),
      roField('Idade', idade)),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      roField('Cidade', cidade),
      roField('Anos de experiência', experiencia)),

    // Dados bancários
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: '8px 0 0', ...font } }, 'Dados bancários'),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      roField('Banco', banco),
      roField('Agência', agencia)),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      roField('Conta', conta),
      roField('Chave Pix', pix)),

    // Veículo
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: '8px 0 0', ...font } }, 'Veículo de transporte'),
    React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, 'Possui veículo próprio?'),
    React.createElement('div', { style: { display: 'flex', gap: 24 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          possuiVeiculo ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null),
        React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, 'Sim')),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          !possuiVeiculo ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null),
        React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, 'Não'))),

    // Documentos
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: '8px 0 0', ...font } }, 'Documentos'),
    React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'CNH (frente e verso)'),
    docRow(worker?.cnh_document_url ? 'documento_cnh.pdf' : 'Nenhum documento'),
    React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font, marginTop: 8 } }, 'Antecedentes Criminais'),
    docRow(worker?.background_check_url ? 'antecedentes_criminais.pdf' : 'Nenhum documento'));

  // ── Fotos do veículo (placeholder cards) ─────────────────────────────
  const vehiclePhotos = vehicles.length > 0 && vehicles[0].vehicle_photos_urls?.length > 0
    ? vehicles[0].vehicle_photos_urls
    : null;

  const photosSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: '8px 0 0', ...font } }, 'Fotos do veículo principal'),
    React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Máx. 4 fotos. 2MB'),
    vehiclePhotos
      ? React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 } },
          ...vehiclePhotos.map((url: string, i: number) =>
            React.createElement('div', {
              key: i,
              style: { width: '100%', height: 130, borderRadius: 12, background: '#f1f1f1', overflow: 'hidden' },
            }, React.createElement('img', { src: url, alt: `Foto ${i + 1}`, style: { width: '100%', height: '100%', objectFit: 'cover' } }))))
      : React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 } },
          ...[1, 2, 3, 4].map((n) =>
            React.createElement('div', {
              key: n,
              style: { width: '100%', height: 130, borderRadius: 12, background: '#f1f1f1', display: 'flex', alignItems: 'center', justifyContent: 'center' },
            }, React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Sem foto')))));

  // ── Rotas e valores ───────────────────────────────────────────────────
  const fmtBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

  const routeCard = (r: any, i: number) =>
    React.createElement('div', {
      key: i,
      style: { padding: '12px 16px', border: '1px solid #e2e2e2', borderRadius: 12, display: 'flex', flexDirection: 'column' as const, gap: 4 },
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } },
          `${r.origin_address || '?'}`),
        React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, '→'),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } },
          `${r.destination_address || '?'}`)),
      React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } },
        r.price_per_person_cents ? `${fmtBRL(r.price_per_person_cents)} por pessoa` : '—'));

  const routesSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 12, padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #e2e2e2' },
  },
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Rotas e valores'),
    React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Defina seus trechos e valores.'),
    ...routes.map((r: any, i: number) => routeCard(r, i)),
    routes.length === 0 ? React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, 'Nenhuma rota cadastrada') : null,
    React.createElement('button', {
      type: 'button',
      style: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font, marginTop: 4 },
    },
      React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
        React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })),
      'Adicionar nova rota'));

  // ── Veículos cadastrados ──────────────────────────────────────────────
  const vehiclesSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 12, padding: 24, background: '#fff', borderRadius: 16, border: '1px solid #e2e2e2' },
  },
    React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Veículos cadastrados'),
    ...vehicles.map((v: any, i: number) =>
      React.createElement('div', {
        key: i,
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: '1px solid #e2e2e2', borderRadius: 12 },
      },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('span', { style: { fontSize: 16, fontWeight: 700, color: '#0d0d0d', ...font } }, `${v.model} ${v.year || ''}`),
          React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, v.plate || '—'),
          React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, `${v.passenger_capacity || 4} passageiros`)),
        React.createElement('span', {
          style: {
            padding: '4px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
            background: v.status === 'approved' ? '#b0e8d1' : v.status === 'rejected' ? '#eeafaa' : '#fee59a',
            color: v.status === 'approved' ? '#174f38' : v.status === 'rejected' ? '#551611' : '#654c01', ...font,
          },
        }, v.status === 'approved' ? 'Aprovado' : v.status === 'pending' ? 'Pendente' : v.status === 'rejected' ? 'Rejeitado' : v.status))),
    vehicles.length === 0 ? React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, 'Nenhum veículo cadastrado') : null,
    React.createElement('button', {
      type: 'button',
      style: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 500, color: '#767676', ...font, marginTop: 4 },
    }, 'Adicionar novo veículo'));

  // ── Métricas ──────────────────────────────────────────────────────────
  const completedTrips = trips.filter((t: any) => t.status === 'completed').length;
  const metricsSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  },
    React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Métricas e histórico'),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      ...[
        { title: 'Viagens realizadas', value: String(completedTrips) },
        { title: 'Média de km percorridos', value: '—' },
        { title: 'Encomendas realizadas', value: '—' },
      ].map((m) =>
        React.createElement('div', {
          key: m.title,
          style: { flex: '1 1 0', minWidth: 150, background: '#f6f6f6', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 12 },
        },
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, m.title),
          React.createElement('span', { style: { fontSize: 28, fontWeight: 700, color: '#0d0d0d', ...font } }, m.value)))));

  // ── Salvar dados button ───────────────────────────────────────────────
  const salvarBtn = React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
    React.createElement('button', {
      type: 'button', onClick: () => navigate(-1),
      style: {
        height: 44, padding: '0 28px', borderRadius: 999, border: '1px solid #e2e2e2',
        background: '#fff', fontSize: 14, fontWeight: 600, color: '#0d0d0d', cursor: 'pointer', ...font,
      },
    }, 'Salvar dados'));

  // ── Histórico de alterações ───────────────────────────────────────────
  const histIcon = (pathD: string) =>
    React.createElement('div', {
      style: { width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    }, React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' },
      React.createElement('path', { d: pathD, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })));

  const timelineItems = [
    { iconPath: 'M2 12c0 0 4-8 10-8s10 8 10 8-4 8-10 8S2 12 2 12z', label: 'Rota alterada', person: 'João Henrique', date: '14 Out, 14:30' },
    { iconPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z', label: 'Motorista substituído', person: 'Pedro Silva', date: '14 Out, 14:35' },
    { iconPath: 'M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12.5 7.5a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6', label: 'Passageiro adicionado', person: 'Ana Costa', date: '14 Out, 14:55' },
    { iconPath: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', label: 'Encomenda adicionada', person: 'Tech Store', date: '14 Out, 14:55' },
  ];

  const historicoSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  },
    React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Histórico de alterações'),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
      ...timelineItems.map((item, i) =>
        React.createElement('div', {
          key: i,
          style: {
            display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
            background: '#f6f6f6', borderRadius: 12,
          },
        },
          histIcon(item.iconPath),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2, flex: 1 } },
            React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } },
              `${item.label} • `, React.createElement('span', { style: { color: '#cba04b' } }, item.person)),
            React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, item.date))))));

  return React.createElement(React.Fragment, null,
    breadcrumb, header, statusActions, toast,
    dadosSection, photosSection, salvarBtn,
    routesSection, vehiclesSection, metricsSection, historicoSection);
}
