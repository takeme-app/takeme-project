import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import { webStyles } from '../styles/webStyles';

/** JWT usa base64url; `atob` puro quebra e o catch devolvia sempre "sem acesso". */
function parseJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const part = accessToken.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(pad);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isAdminSession(session: Session | null): boolean {
  if (!session?.user) return false;
  if (session.user.app_metadata?.role === 'admin') return true;
  const payload = parseJwtPayload(session.access_token);
  const meta = payload?.app_metadata as { role?: string } | undefined;
  return meta?.role === 'admin';
}

export default function ProtectedRoute() {
  const { session, loading } = useAuth();
  if (loading) {
    return React.createElement('div', { style: webStyles.loading },
      React.createElement('span', { style: webStyles.loadingText }, 'Carregando...'));
  }
  if (!session) {
    return React.createElement(Navigate, { to: '/login', replace: true });
  }
  if (!isAdminSession(session)) {
    return React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: 32 },
    },
      React.createElement('span', { style: { fontSize: 20, fontWeight: 600, color: '#0d0d0d', fontFamily: 'Inter, sans-serif' } }, 'Acesso restrito'),
      React.createElement('span', { style: { fontSize: 14, color: '#767676', fontFamily: 'Inter, sans-serif', textAlign: 'center' as const, maxWidth: 400 } },
        'Sua conta não tem permissão de administrador. Solicite o acesso ao responsável pelo sistema.'));
  }
  return React.createElement(Outlet);
}
