import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { webStyles } from '../styles/webStyles';

export default function PublicRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return React.createElement('div', { style: webStyles.loading },
      React.createElement('span', { style: webStyles.loadingText }, 'Carregando...'));
  }
  if (session && location.pathname !== '/forgot-password') {
    return React.createElement(Navigate, { to: '/', replace: true });
  }
  return React.createElement(Outlet);
}
