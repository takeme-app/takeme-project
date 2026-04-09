/**
 * MotoristaEditScreen — Editar motorista conforme Figma 830-10503.
 * Uses React.createElement() calls (NOT JSX).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { webStyles, arrowBackSvg } from '../styles/webStyles';
import { supabase } from '../lib/supabase';
import { parseVehiclePhotosUrls, resolveStorageDisplayUrl } from '../lib/storageDisplayUrl';
import {
  updateWorkerStatus,
  createWorkerRoute,
  toggleWorkerRouteActive,
  deleteWorkerRoute,
  saveProfileFields,
  saveWorkerProfileFields,
} from '../data/queries';
import PlacesAddressInput from '../components/PlacesAddressInput';
import { getGoogleMapsApiKey } from '../lib/expoExtra';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

function fmtMotoristaHistWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

// Campo estilo Figma textFieldLightMode (label 14 medium #0d0d0d, valor 16 regular #3a3a3a)
const roField = (label: string, value: string) =>
  React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex: '1 1 0', minWidth: 200 } },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
    React.createElement('div', {
      style: { height: 44, borderRadius: 8, background: '#f1f1f1', padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 16, color: '#3a3a3a', ...font },
    }, value || '—'));

const inputShell: React.CSSProperties = {
  height: 44,
  borderRadius: 8,
  background: '#f1f1f1',
  border: 'none',
  outline: 'none',
  padding: '0 16px',
  fontSize: 16,
  color: '#3a3a3a',
  width: '100%',
  boxSizing: 'border-box',
  ...font,
};

const rwField = (
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { type?: React.HTMLInputTypeAttribute; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] },
) =>
  React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4, flex: '1 1 0', minWidth: 200 } },
    React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label),
    React.createElement('input', {
      type: opts?.type ?? 'text',
      inputMode: opts?.inputMode,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
      style: inputShell,
    }));

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
  const isEditMode = /\/motoristas\/[^/]+\/editar$/.test(location.pathname);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [worker, setWorker] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [completedTripsCount, setCompletedTripsCount] = useState<number | null>(null);
  const [deliveredShipmentsCount, setDeliveredShipmentsCount] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [newRouteOpen, setNewRouteOpen] = useState(false);
  const [newRouteOrigin, setNewRouteOrigin] = useState('');
  const [newRouteDest, setNewRouteDest] = useState('');
  const [newRouteOriginCoords, setNewRouteOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newRouteDestCoords, setNewRouteDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newRoutePreco, setNewRoutePreco] = useState('');
  const [routeActionLoading, setRouteActionLoading] = useState(false);
  const [newRouteGeoError, setNewRouteGeoError] = useState<string | null>(null);
  const [vehiclePhotoDisplayUrls, setVehiclePhotoDisplayUrls] = useState<string[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editExperienceYears, setEditExperienceYears] = useState('');
  const [editBankCode, setEditBankCode] = useState('');
  const [editBankAgency, setEditBankAgency] = useState('');
  const [editBankAccount, setEditBankAccount] = useState('');
  const [editPix, setEditPix] = useState('');
  const [editHasOwnVehicle, setEditHasOwnVehicle] = useState(false);
  const [reviewerName, setReviewerName] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const db = supabase as any;

    (async () => {
      const [pRes, wRes, vRes, rRes, tripsCountRes, shipCountRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        db.from('worker_profiles').select('*').eq('id', id).single(),
        db
          .from('vehicles')
          .select('*')
          .eq('worker_id', id)
          .order('is_active', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: true }),
        db.from('worker_routes').select('*').eq('worker_id', id).order('created_at', { ascending: false }),
        supabase
          .from('scheduled_trips')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', id)
          .eq('status', 'completed'),
        db
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', id)
          .eq('status', 'delivered'),
      ]);
      if (cancelled) return;
      setProfile(pRes.data);
      setWorker(wRes.data);
      setVehicles(vRes.data || []);
      setRoutes(rRes.data || []);
      setCompletedTripsCount(
        !tripsCountRes.error && typeof tripsCountRes.count === 'number' ? tripsCountRes.count : null,
      );
      setDeliveredShipmentsCount(
        !shipCountRes.error && typeof shipCountRes.count === 'number' ? shipCountRes.count : null,
      );
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (loading || !profile) return;
    const w = worker;
    setEditFullName(profile.full_name ?? '');
    setEditCpf(w?.cpf ?? '');
    setEditAge(w?.age != null ? String(w.age) : '');
    setEditCity(w?.city ?? profile.city ?? '');
    setEditExperienceYears(w?.experience_years != null ? String(w.experience_years) : '');
    setEditBankCode(w?.bank_code ?? '');
    setEditBankAgency(w?.bank_agency ?? '');
    setEditBankAccount(w?.bank_account ?? '');
    setEditPix(w?.pix_key ?? '');
    setEditHasOwnVehicle(Boolean(w?.has_own_vehicle));
  }, [loading, profile, worker]);

  const handleSaveEdits = useCallback(async () => {
    if (!id) return;
    if (!worker?.id) {
      setSaveError('Não foi possível carregar o cadastro do motorista (worker_profiles).');
      return;
    }
    if (!editFullName.trim()) {
      setSaveError('Informe o nome completo.');
      return;
    }
    setSaveError(null);
    const ageTrim = editAge.trim();
    const expTrim = editExperienceYears.trim();
    let ageNum: number | null = null;
    let expNum: number | null = null;
    if (ageTrim !== '') {
      ageNum = parseInt(ageTrim, 10);
      if (Number.isNaN(ageNum)) {
        setSaveError('Idade deve ser um número inteiro.');
        return;
      }
    }
    if (expTrim !== '') {
      expNum = parseInt(expTrim, 10);
      if (Number.isNaN(expNum)) {
        setSaveError('Anos de experiência deve ser um número inteiro.');
        return;
      }
    }
    setSaveLoading(true);
    const cityVal = editCity.trim() || null;
    const { error: pErr } = await saveProfileFields(id, {
      full_name: editFullName.trim(),
      city: cityVal,
    });
    if (pErr) {
      setSaveLoading(false);
      setSaveError(pErr);
      return;
    }
    const { error: wErr } = await saveWorkerProfileFields(id, {
      cpf: editCpf.trim() || null,
      age: ageNum,
      experience_years: expNum,
      city: cityVal,
      has_own_vehicle: editHasOwnVehicle,
      bank_code: editBankCode.trim() || null,
      bank_agency: editBankAgency.trim() || null,
      bank_account: editBankAccount.trim() || null,
      pix_key: editPix.trim() || null,
    });
    setSaveLoading(false);
    if (wErr) {
      setSaveError(wErr);
      return;
    }
    setProfile((p: any) => (p ? { ...p, full_name: editFullName.trim() || p.full_name, city: cityVal ?? p.city } : p));
    setWorker((w: any) =>
      w
        ? {
            ...w,
            cpf: editCpf.trim() || null,
            age: ageNum,
            experience_years: expNum,
            city: cityVal,
            has_own_vehicle: editHasOwnVehicle,
            bank_code: editBankCode.trim() || null,
            bank_agency: editBankAgency.trim() || null,
            bank_account: editBankAccount.trim() || null,
            pix_key: editPix.trim() || null,
          }
        : w,
    );
    navigate(-1);
  }, [
    id,
    editFullName,
    editCpf,
    editAge,
    editCity,
    editExperienceYears,
    editBankCode,
    editBankAgency,
    editBankAccount,
    editPix,
    editHasOwnVehicle,
    navigate,
    worker?.id,
  ]);

  useEffect(() => {
    let cancelled = false;
    const paths = vehicles.length > 0 ? parseVehiclePhotosUrls(vehicles[0]?.vehicle_photos_urls) : [];
    if (paths.length === 0) {
      setVehiclePhotoDisplayUrls([]);
      return;
    }
    (async () => {
      const urls = await Promise.all(paths.map((p) => resolveStorageDisplayUrl(supabase, p)));
      if (!cancelled) setVehiclePhotoDisplayUrls(urls.filter((u): u is string => Boolean(u)));
    })();
    return () => { cancelled = true; };
  }, [vehicles]);

  useEffect(() => {
    const rid = worker?.reviewed_by as string | undefined;
    if (!rid) {
      setReviewerName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', rid).maybeSingle();
      if (!cancelled) setReviewerName((data as { full_name?: string } | null)?.full_name ?? null);
    })();
    return () => { cancelled = true; };
  }, [worker?.reviewed_by]);

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

  const historicoTimelineItems = useMemo(() => {
    type Row = { ts: number; iconPath: string; label: string; person: string; date: string; key: string };
    const rows: Row[] = [];
    const iconRoute = 'M2 12c0 0 4-8 10-8s10 8 10 8-4 8-10 8S2 12 2 12z';
    const iconUser = 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z';
    const iconVehicle = 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.4-1.7-1.1-2.2L17 8.5M5 17H3c-.6 0-1-.4-1-1v-3c0-.9.4-1.7 1.1-2.2L7 8.5M7 8.5l1.5-3h7L17 8.5M7 8.5h10M5 17v-5M19 17v-5';
    if (worker?.created_at) {
      rows.push({
        ts: new Date(worker.created_at).getTime(),
        iconPath: iconUser,
        label: 'Cadastro do motorista',
        person: profile?.full_name || '—',
        date: fmtMotoristaHistWhen(worker.created_at),
        key: `worker-created-${worker.created_at}`,
      });
    }
    if (worker?.reviewed_at) {
      const st = worker.status as string | undefined;
      const statusWord =
        st === 'approved' ? 'Aprovado' : st === 'rejected' ? 'Rejeitado' : st === 'suspended' ? 'Suspenso' : st === 'pending' ? 'Pendente' : st || 'Atualizado';
      rows.push({
        ts: new Date(worker.reviewed_at).getTime(),
        iconPath: iconUser,
        label: `Status do cadastro: ${statusWord}`,
        person: reviewerName || 'Administrador',
        date: fmtMotoristaHistWhen(worker.reviewed_at),
        key: `worker-reviewed-${worker.reviewed_at}`,
      });
    }
    for (const r of routes) {
      const ca = r.created_at as string | undefined;
      const ua = r.updated_at as string | undefined;
      const when = ua || ca;
      if (!when) continue;
      const isUpdate = Boolean(ca && ua && ua !== ca);
      rows.push({
        ts: new Date(when).getTime(),
        iconPath: iconRoute,
        label: isUpdate ? 'Rota atualizada' : 'Rota cadastrada',
        person: `${r.origin_address || '?'} → ${r.destination_address || '?'}`,
        date: fmtMotoristaHistWhen(when),
        key: `route-${r.id}-${when}`,
      });
    }
    for (const v of vehicles) {
      const ca = v.created_at as string | undefined;
      if (!ca) continue;
      const bits = [v.model, v.plate].filter(Boolean);
      rows.push({
        ts: new Date(ca).getTime(),
        iconPath: iconVehicle,
        label: 'Veículo cadastrado',
        person: bits.length ? bits.join(' · ') : 'Veículo',
        date: fmtMotoristaHistWhen(ca),
        key: `vehicle-${v.id}-${ca}`,
      });
    }
    rows.sort((a, b) => b.ts - a.ts);
    return rows.slice(0, 40);
  }, [worker, profile, routes, vehicles, reviewerName]);

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
  const primaryVehicleDocUrl = vehicles[0]?.vehicle_document_url as string | undefined;

  // ── Breadcrumb (Figma 830:10506 — 12px semibold) ───────────────────────
  const breadcrumbCurrent = isEditMode ? 'Editar dados' : 'Visualização';
  const breadcrumb = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, ...font },
  },
    React.createElement('span', { style: { color: '#767676' } }, 'Motoristas'),
    React.createElement('span', { style: { color: '#767676' } }, '›'),
    React.createElement('span', { style: { color: '#0d0d0d' } }, breadcrumbCurrent));

  // ── Header (Figma 830:10512 — Cancelar fundo #f1f1f1) ─────────────────
  const header = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 },
  },
    React.createElement('button', {
      type: 'button', onClick: () => navigate(-1),
      style: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font, padding: 0, minHeight: 44 },
    }, arrowBackSvg, 'Voltar'),
    isEditMode
      ? React.createElement('button', {
          type: 'button',
          onClick: () => void handleSaveEdits(),
          disabled: saveLoading,
          style: {
            display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px',
            borderRadius: 999, border: 'none', background: '#0d0d0d',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: saveLoading ? 'wait' : 'pointer', opacity: saveLoading ? 0.65 : 1, ...font,
          },
        },
          React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
            React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
          saveLoading ? 'Salvando…' : 'Salvar alterações')
      : React.createElement('button', {
          type: 'button', onClick: () => id && navigate(`/motoristas/${id}/editar`),
          style: {
            display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 24px',
            borderRadius: 999, border: 'none', background: '#0d0d0d',
            color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
          },
        }, 'Editar dados'));

  // ── Status action bar ─────────────────────────────────────────────────
  const statusBadgeColor = workerStatus === 'approved' ? '#b0e8d1' : workerStatus === 'rejected' ? '#eeafaa' : workerStatus === 'suspended' ? '#eeafaa' : '#fee59a';
  const statusBadgeText = workerStatus === 'approved' ? '#174f38' : workerStatus === 'rejected' ? '#551611' : workerStatus === 'suspended' ? '#551611' : '#654c01';
  const statusLabel = workerStatus === 'approved' ? 'Aprovado' : workerStatus === 'rejected' ? 'Rejeitado' : workerStatus === 'suspended' ? 'Suspenso' : workerStatus === 'pending' ? 'Pendente' : workerStatus === 'inactive' ? 'Inativo' : workerStatus;
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
    !isEditMode
      ? React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' as const } },
          workerStatus !== 'approved' ? React.createElement('button', { type: 'button', onClick: handleApprove, disabled: actionLoading, style: actionBtnStyle('#22c55e', '#fff') }, 'Aprovar') : null,
          workerStatus !== 'rejected' ? React.createElement('button', { type: 'button', onClick: handleReject, disabled: actionLoading, style: actionBtnStyle('#fff', '#b53838') }, 'Rejeitar') : null,
          workerStatus === 'approved' ? React.createElement('button', { type: 'button', onClick: handleSuspend, disabled: actionLoading, style: actionBtnStyle('#f1f1f1', '#b53838') }, 'Suspender') : null)
      : null);

  // ── Faixa informativa (Figma 830:10517 — gold-100 / gold-500) ─────────
  const toast = React.createElement('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
      background: '#fff8e6', border: '0.5px solid #cba04b', borderRadius: 8,
      boxShadow: '0 4px 20px rgba(13,13,13,0.04)', width: '100%', boxSizing: 'border-box' as const,
    },
  },
    React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { flexShrink: 0 } },
      React.createElement('circle', { cx: 12, cy: 12, r: 10, stroke: '#cba04b', strokeWidth: 2 }),
      React.createElement('path', { d: 'M12 8v4M12 16h.01', stroke: '#cba04b', strokeWidth: 2, strokeLinecap: 'round' })),
    React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font, flex: 1 } },
      isEditMode ? 'Você está editando os dados do motorista' : 'Você está visualizando os dados do motorista'));

  const saveErrorBanner = saveError
    ? React.createElement('div', {
        role: 'alert',
        style: {
          padding: '12px 16px',
          borderRadius: 8,
          background: '#fee5e5',
          border: '1px solid #eeafaa',
          fontSize: 14,
          color: '#551611',
          ...font,
        },
      }, saveError)
    : null;

  // ── Dados do Motorista (Figma 1224:21501 — título 20px + card interno 12px) ──
  const dadosBasics = isEditMode
    ? React.createElement(React.Fragment, null,
        rwField('Nome completo', editFullName, setEditFullName),
        React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
          rwField('CPF', editCpf, setEditCpf),
          rwField('Idade', editAge, setEditAge, { type: 'text', inputMode: 'numeric' })),
        React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
          rwField('Cidade', editCity, setEditCity),
          rwField('Anos de experiência', editExperienceYears, setEditExperienceYears, { type: 'text', inputMode: 'numeric' })))
    : React.createElement(React.Fragment, null,
        roField('Nome completo', nome),
        React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
          roField('CPF', cpf),
          roField('Idade', idade)),
        React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
          roField('Cidade', cidade),
          roField('Anos de experiência', experiencia)));

  const dadosBancarios = isEditMode
    ? React.createElement(React.Fragment, null,
        React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
          rwField('Banco', editBankCode, setEditBankCode),
          rwField('Agência', editBankAgency, setEditBankAgency)),
        React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
          rwField('Conta', editBankAccount, setEditBankAccount),
          rwField('Chave Pix', editPix, setEditPix)))
    : React.createElement(React.Fragment, null,
        React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
          roField('Banco', banco),
          roField('Agência', agencia)),
        React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
          roField('Conta', conta),
          roField('Chave Pix', pix)));

  const veiculoProprioRow = isEditMode
    ? React.createElement('div', { style: { display: 'flex', gap: 24 } },
        React.createElement('button', {
          type: 'button',
          onClick: () => setEditHasOwnVehicle(true),
          style: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, ...font },
        },
          React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            editHasOwnVehicle ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null),
          React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, 'Sim')),
        React.createElement('button', {
          type: 'button',
          onClick: () => setEditHasOwnVehicle(false),
          style: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, ...font },
        },
          React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            !editHasOwnVehicle ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null),
          React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, 'Não')))
    : React.createElement('div', { style: { display: 'flex', gap: 24 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            possuiVeiculo ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null),
          React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, 'Sim')),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('div', { style: { width: 20, height: 20, borderRadius: '50%', border: '2px solid #0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            !possuiVeiculo ? React.createElement('div', { style: { width: 10, height: 10, borderRadius: '50%', background: '#0d0d0d' } }) : null),
          React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, 'Não')));

  const dadosInnerCard = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 16, padding: 24, background: '#fff', borderRadius: 12, border: '1px solid #e2e2e2', width: '100%', boxSizing: 'border-box' as const },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#767676', margin: 0, ...font } }, 'Dados básicos'),
    dadosBasics,

    // Dados bancários
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: '8px 0 0', ...font } }, 'Dados bancários'),
    dadosBancarios,

    // Veículo
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: '8px 0 0', ...font } }, 'Veículo de transporte'),
    React.createElement('span', { style: { fontSize: 13, color: '#767676', ...font } }, 'Possui veículo próprio?'),
    veiculoProprioRow,

    // Documentos
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: '8px 0 0', ...font } }, 'Documentos'),
    React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font } }, 'CNH (frente)'),
    worker?.cnh_document_url
      ? React.createElement('a', { href: worker.cnh_document_url, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none', color: 'inherit' } }, docRow('documento_cnh_frente.pdf'))
      : docRow('Nenhum documento'),
    React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font, marginTop: 8 } }, 'CNH (verso)'),
    worker?.cnh_document_back_url
      ? React.createElement('a', { href: worker.cnh_document_back_url, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none', color: 'inherit' } }, docRow('documento_cnh_verso.pdf'))
      : docRow('Nenhum documento'),
    React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font, marginTop: 8 } }, 'Antecedentes criminais'),
    worker?.background_check_url
      ? React.createElement('a', { href: worker.background_check_url, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none', color: 'inherit' } }, docRow('antecedentes_criminais.pdf'))
      : docRow('Nenhum documento'),
    React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: '#0d0d0d', ...font, marginTop: 8 } }, 'Documento do veículo'),
    primaryVehicleDocUrl
      ? React.createElement('a', { href: primaryVehicleDocUrl, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none', color: 'inherit' } }, docRow('documento_de_veiculo.pdf'))
      : docRow('Nenhum documento'),
    isEditMode
      ? React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 8 } },
          React.createElement('button', {
            type: 'button',
            onClick: () => { /* OCR/extração — placeholder alinhado ao Figma */ },
            style: {
              height: 44, padding: '0 24px', borderRadius: 999, border: '1px solid #e2e2e2',
              background: '#fff', fontSize: 14, fontWeight: 600, color: '#0d0d0d', cursor: 'pointer', ...font,
            },
          }, 'Extrair dados'))
      : null);

  const dadosSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 16, paddingBottom: 32, borderBottom: '1px solid #e2e2e2', width: '100%', boxSizing: 'border-box' as const },
  },
    React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, width: '100%', ...font } }, 'Dados do Motorista'),
    dadosInnerCard);

  // ── Fotos do veículo: DB pode ter paths (FinalizeRegistration) ou URLs públicas (VehicleForm) ──
  const rawPhotoCount =
    vehicles.length > 0 ? parseVehiclePhotosUrls(vehicles[0]?.vehicle_photos_urls).length : 0;
  const vehiclePhotos = vehiclePhotoDisplayUrls.length > 0 ? vehiclePhotoDisplayUrls : null;

  const photosSection = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
    React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: '8px 0 0', ...font } }, 'Fotos do veículo principal'),
    React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Máx. 4 fotos. 2MB'),
    rawPhotoCount > 0 && !vehiclePhotos
      ? React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Carregando imagens…')
      : null,
    vehiclePhotos
      ? React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 } },
          ...vehiclePhotos.map((url: string, i: number) =>
            React.createElement('div', {
              key: i,
              style: { width: '100%', height: 130, borderRadius: 12, background: '#f1f1f1', overflow: 'hidden' },
            }, React.createElement('img', { src: url, alt: `Foto ${i + 1}`, style: { width: '100%', height: '100%', objectFit: 'cover' } }))))
      : rawPhotoCount === 0
        ? React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 } },
            ...[1, 2, 3, 4].map((n) =>
              React.createElement('div', {
                key: n,
                style: { width: '100%', height: 130, borderRadius: 12, background: '#f1f1f1', display: 'flex', alignItems: 'center', justifyContent: 'center' },
              }, React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, 'Sem foto'))))
        : React.createElement('span', { style: { fontSize: 12, color: '#b53838', ...font } }, 'Não foi possível gerar URL das fotos (confira permissões de storage para admin).'));

  // ── Rotas e valores (Figma 1271:34183) ───────────────────────────────
  const fmtBRL = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;

  const routeCard = (r: any, i: number) =>
    React.createElement('div', {
      key: r.id || i,
      style: {
        padding: 16,
        border: '1px solid #e2e2e2',
        borderRadius: 12,
        background: '#fff',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        width: '100%',
        boxSizing: 'border-box' as const,
      },
    },
      React.createElement('div', { style: { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 4 } },
        React.createElement('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const,
            fontSize: 16, lineHeight: 1.5, ...font,
          },
        },
          React.createElement('span', {
            style: { fontWeight: 600, color: '#0d0d0d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: '100%' },
          }, `${r.origin_address || '?'}`),
          React.createElement('span', { style: { fontWeight: 500, color: '#7c5f29', flexShrink: 0 } }, '→'),
          React.createElement('span', {
            style: { fontWeight: 600, color: '#0d0d0d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: '100%' },
          }, `${r.destination_address || '?'}`)),
        React.createElement('span', {
          style: { fontSize: 14, fontWeight: 400, color: '#767676', lineHeight: 1.5, ...font, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
        }, r.price_per_person_cents ? `${fmtBRL(r.price_per_person_cents)} por pessoa` : '—')),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 } },
        isEditMode
          ? React.createElement('button', {
              type: 'button',
              onClick: async () => {
                await toggleWorkerRouteActive(r.id, !r.is_active);
                setRoutes((prev: any[]) => prev.map((rt: any) => rt.id === r.id ? { ...rt, is_active: !rt.is_active } : rt));
              },
              style: {
                height: 28, padding: '0 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: r.is_active !== false ? '#b0e8d1' : '#f1f1f1',
                color: r.is_active !== false ? '#174f38' : '#767676',
                fontSize: 12, fontWeight: 600, ...font, whiteSpace: 'nowrap' as const,
              },
            }, r.is_active !== false ? 'Ativa' : 'Inativa')
          : React.createElement('span', {
              style: {
                height: 28, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, ...font, whiteSpace: 'nowrap' as const,
                background: r.is_active !== false ? '#b0e8d1' : '#f1f1f1',
                color: r.is_active !== false ? '#174f38' : '#767676', display: 'inline-flex', alignItems: 'center',
              },
            }, r.is_active !== false ? 'Ativa' : 'Inativa'),
        isEditMode
          ? React.createElement('button', {
              type: 'button',
              onClick: async () => {
                if (!confirm('Remover esta rota?')) return;
                await deleteWorkerRoute(r.id);
                setRoutes((prev: any[]) => prev.filter((rt: any) => rt.id !== r.id));
              },
              style: {
                width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: '#fee5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0,
              },
            }, React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' },
              React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#b53838', strokeWidth: 2.5, strokeLinecap: 'round' })))
          : null));

  // ── New route modal ───────────────────────────────────────────────────
  const newRoutePlaceInputStyle: React.CSSProperties = {
    height: 44,
    borderRadius: 8,
    background: '#f1f1f1',
    border: 'none',
    outline: 'none',
    padding: '0 16px',
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    ...font,
  };
  const mapsKeyConfigured = Boolean(getGoogleMapsApiKey());
  const closeNewRouteModal = () => {
    setNewRouteOpen(false);
    setNewRouteOrigin('');
    setNewRouteDest('');
    setNewRouteOriginCoords(null);
    setNewRouteDestCoords(null);
    setNewRoutePreco('');
    setNewRouteGeoError(null);
  };

  const newRouteModal = newRouteOpen
    ? React.createElement('div', {
        role: 'dialog',
        'aria-modal': true,
        style: {
          position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' as const,
        },
        onClick: closeNewRouteModal,
      },
      React.createElement('div', {
        style: {
          background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
          display: 'flex', flexDirection: 'column' as const, gap: 16, boxSizing: 'border-box' as const,
        },
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      },
        React.createElement('h2', { style: { fontSize: 18, fontWeight: 700, margin: 0, color: '#0d0d0d', ...font } }, 'Nova rota'),
        mapsKeyConfigured
          ? React.createElement('p', { style: { fontSize: 12, color: '#767676', margin: 0, lineHeight: 1.45, ...font } },
            'Escolha origem e destino na lista de sugestões do Google para gravar endereço e coordenadas.')
          : null,
        // Origem
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('label', { style: { fontSize: 13, fontWeight: 500, color: '#767676', ...font } }, 'Origem'),
          React.createElement(PlacesAddressInput, {
            value: newRouteOrigin,
            onChange: (v: string) => {
              setNewRouteOrigin(v);
              setNewRouteOriginCoords(null);
              setNewRouteGeoError(null);
            },
            onPlaceResolved: (p) => {
              setNewRouteOrigin(p.formattedAddress);
              setNewRouteOriginCoords({ lat: p.lat, lng: p.lng });
              setNewRouteGeoError(null);
            },
            inputStyle: newRoutePlaceInputStyle,
            placeholder: mapsKeyConfigured ? 'Buscar cidade ou endereço…' : 'ex: São Paulo, SP',
          })),
        // Destino
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('label', { style: { fontSize: 13, fontWeight: 500, color: '#767676', ...font } }, 'Destino'),
          React.createElement(PlacesAddressInput, {
            value: newRouteDest,
            onChange: (v: string) => {
              setNewRouteDest(v);
              setNewRouteDestCoords(null);
              setNewRouteGeoError(null);
            },
            onPlaceResolved: (p) => {
              setNewRouteDest(p.formattedAddress);
              setNewRouteDestCoords({ lat: p.lat, lng: p.lng });
              setNewRouteGeoError(null);
            },
            inputStyle: newRoutePlaceInputStyle,
            placeholder: mapsKeyConfigured ? 'Buscar cidade ou endereço…' : 'ex: Rio de Janeiro, RJ',
          })),
        // Preço por pessoa
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 4 } },
          React.createElement('label', { style: { fontSize: 13, fontWeight: 500, color: '#767676', ...font } }, 'Preço por pessoa (R$)'),
          React.createElement('input', {
            type: 'number', value: newRoutePreco,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNewRoutePreco(e.target.value),
            placeholder: '0.00', min: '0', step: '0.01',
            style: { height: 44, borderRadius: 8, background: '#f1f1f1', border: 'none', outline: 'none', padding: '0 16px', fontSize: 14, width: '100%', boxSizing: 'border-box', ...font },
          })),
        newRouteGeoError
          ? React.createElement('div', { role: 'alert', style: { fontSize: 13, color: '#b53838', ...font } }, newRouteGeoError)
          : null,
        // Buttons
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', {
            type: 'button',
            onClick: closeNewRouteModal,
            style: { flex: 1, height: 44, borderRadius: 8, border: '1px solid #e2e2e2', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', ...font },
          }, 'Cancelar'),
          React.createElement('button', {
            type: 'button',
            disabled: routeActionLoading || !newRouteOrigin.trim() || !newRouteDest.trim(),
            onClick: async () => {
              if (!id || !newRouteOrigin.trim() || !newRouteDest.trim()) return;
              if (mapsKeyConfigured && (!newRouteOriginCoords || !newRouteDestCoords)) {
                setNewRouteGeoError('Selecione origem e destino nas sugestões do Google para salvar latitude e longitude.');
                return;
              }
              setRouteActionLoading(true);
              setNewRouteGeoError(null);
              const priceCents = Math.round(parseFloat(newRoutePreco || '0') * 100);
              const { error } = await createWorkerRoute(id, {
                origin: newRouteOrigin.trim(),
                destination: newRouteDest.trim(),
                priceCents,
                ...(newRouteOriginCoords
                  ? { originLat: newRouteOriginCoords.lat, originLng: newRouteOriginCoords.lng }
                  : {}),
                ...(newRouteDestCoords
                  ? { destinationLat: newRouteDestCoords.lat, destinationLng: newRouteDestCoords.lng }
                  : {}),
              });
              if (!error) {
                const db = supabase as any;
                const { data: rData } = await db.from('worker_routes').select('*').eq('worker_id', id).order('created_at', { ascending: false });
                setRoutes(rData || []);
                closeNewRouteModal();
              } else {
                setNewRouteGeoError(error);
              }
              setRouteActionLoading(false);
            },
            style: {
              flex: 1, height: 44, borderRadius: 8, border: 'none', background: '#0d0d0d', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: routeActionLoading ? 'wait' : 'pointer',
              opacity: (routeActionLoading || !newRouteOrigin.trim() || !newRouteDest.trim()) ? 0.5 : 1, ...font,
            },
          }, routeActionLoading ? 'Salvando...' : 'Salvar'))))
    : null;

  const routesAddButton = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, width: '100%' },
  },
    React.createElement('button', {
      type: 'button',
      onClick: () => {
        setNewRouteGeoError(null);
        setNewRouteOriginCoords(null);
        setNewRouteDestCoords(null);
        setNewRouteOrigin('');
        setNewRouteDest('');
        setNewRoutePreco('');
        setNewRouteOpen(true);
      },
      style: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        color: '#0d0d0d',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        padding: '8px 12px',
        borderRadius: 999,
        ...font,
      },
    }, 'Adicionar nova rota'));

  const routesSection = React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 16,
      paddingBottom: 32,
      borderBottom: '1px solid #e2e2e2',
      width: '100%',
      boxSizing: 'border-box' as const,
    },
  },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, width: '100%' } },
      React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#767676', margin: 0, lineHeight: 'normal', ...font } }, 'Rotas e valores'),
      React.createElement('p', { style: { fontSize: 14, fontWeight: 400, color: '#767676', margin: 0, lineHeight: 1.5, ...font } }, 'Defina suas rotas e preços.')),
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 16, width: '100%' } },
      ...routes.map((r: any, i: number) => routeCard(r, i)),
      routes.length === 0
        ? React.createElement('p', { style: { fontSize: 14, color: '#767676', margin: 0, lineHeight: 1.5, ...font } }, 'Nenhuma rota cadastrada.')
        : null,
      routesAddButton));

  // ── Veículos cadastrados (Figma 1271:33917) ────────────────────────────
  const vehicleCardFigma = (v: any, i: number) =>
    React.createElement('div', {
      key: v.id ?? i,
      style: {
        background: '#f1f1f1',
        minHeight: 188,
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 8,
        width: '100%',
        boxSizing: 'border-box' as const,
      },
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', gap: 12 } },
        React.createElement('div', {
          style: {
            fontSize: 20, fontWeight: 600, color: '#0d0d0d', lineHeight: 1.5, ...font,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, minWidth: 0,
          },
        }, `${v.model || 'Veículo'}${v.year != null ? ` ${v.year}` : ''}`),
        React.createElement('span', {
          style: {
            flexShrink: 0,
            padding: '4px 8px',
            borderRadius: 90,
            fontSize: 12,
            fontWeight: 600,
            color: '#0d0d0d',
            ...font,
            background: i === 0 ? '#cba04b' : '#fff',
            boxShadow: i === 0 ? 'none' : 'inset 0 0 0 1px #e2e2e2',
          },
        }, i === 0 ? 'Principal' : 'Reserva')),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, v.plate || '—'),
        React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } },
          `${v.passenger_capacity ?? 4} passageiros`)));

  const vehiclesAddLink = isEditMode
    ? React.createElement('div', { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 48, width: '100%' } },
        React.createElement('button', {
          type: 'button',
          style: {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            color: '#0d0d0d',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            padding: '8px 12px',
            ...font,
          },
        }, 'Adicionar novo veículo'))
    : null;

  const vehiclesInnerCard = React.createElement('div', {
    style: {
      border: '1px solid #e2e2e2',
      borderRadius: 12,
      padding: 24,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 16,
      width: '100%',
      boxSizing: 'border-box' as const,
      background: '#fff',
    },
  },
    vehicles.length === 0
      ? React.createElement('span', { style: { fontSize: 14, color: '#767676', ...font } }, 'Nenhum veículo cadastrado')
      : null,
    ...vehicles.map((v: any, i: number) => vehicleCardFigma(v, i)),
    vehiclesAddLink);

  const vehiclesSection = React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 16,
      paddingBottom: 32,
      borderBottom: '1px solid #e2e2e2',
      width: '100%',
      boxSizing: 'border-box' as const,
    },
  },
    React.createElement('h2', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', margin: 0, width: '100%', ...font } }, 'Veículos cadastrados'),
    vehiclesInnerCard);

  // ── Métricas (contagens no servidor; km não há coluna no schema — placeholder) ──
  const metricsSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  },
    React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Métricas e histórico'),
    React.createElement('div', { style: { display: 'flex', gap: 16, flexWrap: 'wrap' as const } },
      ...[
        {
          title: 'Viagens realizadas',
          value: completedTripsCount != null ? String(completedTripsCount) : '—',
        },
        { title: 'Média de km percorridos', value: '—' },
        {
          title: 'Encomendas realizadas',
          value: deliveredShipmentsCount != null ? String(deliveredShipmentsCount) : '—',
        },
      ].map((m) =>
        React.createElement('div', {
          key: m.title,
          style: { flex: '1 1 0', minWidth: 150, background: '#f6f6f6', borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 12 },
        },
          React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, m.title),
          React.createElement('span', { style: { fontSize: 28, fontWeight: 700, color: '#0d0d0d', ...font } }, m.value)))));

  const salvarBtn = isEditMode
    ? React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
        React.createElement('button', {
          type: 'button',
          onClick: () => void handleSaveEdits(),
          disabled: saveLoading,
          style: {
            height: 44, padding: '0 28px', borderRadius: 999, border: '1px solid #e2e2e2',
            background: '#fff', fontSize: 14, fontWeight: 600, color: '#0d0d0d', cursor: saveLoading ? 'wait' : 'pointer', opacity: saveLoading ? 0.65 : 1, ...font,
          },
        }, saveLoading ? 'Salvando…' : 'Salvar dados'))
    : null;

  // ── Histórico de alterações (derivado de worker_profiles, worker_routes, vehicles;
  //     status_history no banco não inclui entidade «motorista».)
  const histIcon = (pathD: string) =>
    React.createElement('div', {
      style: { width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    }, React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' },
      React.createElement('path', { d: pathD, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })));

  const historicoSection = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  },
    React.createElement('h3', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Histórico de alterações'),
    historicoTimelineItems.length === 0
      ? React.createElement('p', {
          style: { fontSize: 14, color: '#767676', margin: 0, lineHeight: 1.5, ...font },
        },
          'Não há eventos rastreados para este perfil. O banco não mantém auditoria específica de motorista (apenas viagens, encomendas e excursões em status_history); rotas, veículos e revisões do cadastro aparecem aqui quando existirem.')
      : null,
    historicoTimelineItems.length > 0
      ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8 } },
          ...historicoTimelineItems.map((item) =>
            React.createElement('div', {
              key: item.key,
              style: {
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                background: '#f6f6f6', borderRadius: 12,
              },
            },
              histIcon(item.iconPath),
              React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 2, flex: 1 } },
                React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font } },
                  `${item.label} • `, React.createElement('span', { style: { color: '#cba04b' } }, item.person)),
                React.createElement('span', { style: { fontSize: 12, color: '#767676', ...font } }, item.date)))))
      : null);

  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 24, width: '100%', maxWidth: 1044, boxSizing: 'border-box' as const },
  },
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24, width: '100%' } },
      breadcrumb, header, toast, saveErrorBanner),
    statusActions,
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 32, width: '100%' } },
      dadosSection, photosSection, salvarBtn, routesSection, vehiclesSection, metricsSection, historicoSection),
    newRouteModal);
}
