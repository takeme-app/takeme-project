import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { webStyles } from '../styles/webStyles';

export default function PublicRoute() {
  const { session, loading } = useAuth();
  if (loading) {
    return React.createElement('div', { style: webStyles.loading },
      React.createElement('span', { style: webStyles.loadingText }, 'Carregando...'));
  }
  if (session) {
    return React.createElement(Navigate, { to: '/', replace: true });
  }
  return React.createElement(Outlet);
}
