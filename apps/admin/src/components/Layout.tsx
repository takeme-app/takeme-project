import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { webStyles } from '../styles/webStyles';
import { Logo } from './Logo';
import { chevronDownSvg } from './icons';
import { useAuth } from '../contexts/AuthContext';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const navTabsList = [
  { label: 'Início', path: '/' },
  { label: 'Viagens', path: '/viagens' },
  { label: 'Passageiros', path: '/passageiros' },
  { label: 'Motoristas', path: '/motoristas' },
  { label: 'Destinos', path: '/destinos' },
  { label: 'Encomendas', path: '/encomendas' },
  { label: 'Preparadores', path: '/preparadores' },
  { label: 'Promoções', path: '/promocoes' },
  { label: 'Pagamentos', path: '/pagamentos' },
];

// Chevron down SVG for "Mais" button
const moreChevronSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M6 9l6 6 6-6', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

function getVisibleCount(width: number): number {
  if (width >= 1340) return 9; // all items fit with logo + user block
  if (width >= 1200) return 7;
  if (width >= 1050) return 6;
  if (width >= 900) return 5;
  if (width >= 750) return 4;
  return 3;
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();

  const [visibleCount, setVisibleCount] = useState(() => getVisibleCount(typeof window !== 'undefined' ? window.innerWidth : 1280));
  const [moreOpen, setMoreOpen] = useState(false);

  const handleResize = useCallback(() => {
    setVisibleCount(getVisibleCount(window.innerWidth));
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!moreOpen) return;
    const handleClick = () => setMoreOpen(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [moreOpen]);

  // Close dropdown on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const activeNavIndex = navTabsList.findIndex((tab) => {
    if (tab.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(tab.path);
  });

  const userName = session?.user?.user_metadata?.full_name || 'Pedro Henrique';
  const userEmail = session?.user?.email || 'pedro.henriq@gmail.com';
  const avatarLetter = userName.charAt(0).toUpperCase();

  const needsMore = visibleCount < navTabsList.length;
  const visibleTabs = needsMore ? navTabsList.slice(0, visibleCount) : navTabsList;
  const overflowTabs = needsMore ? navTabsList.slice(visibleCount) : [];

  // Check if the active tab is in the overflow
  const activeInOverflow = activeNavIndex >= visibleCount;

  const navButtons = visibleTabs.map((tab, i) =>
    React.createElement('button', {
      key: tab.label,
      type: 'button',
      style: { ...webStyles.navTab, ...(i === activeNavIndex ? webStyles.navTabActive : {}) } as React.CSSProperties,
      onClick: () => navigate(tab.path),
    }, tab.label));

  // "Mais" button with dropdown
  const moreButton = needsMore ? React.createElement('div', {
    key: '_more',
    style: { position: 'relative' as const, display: 'inline-flex' },
  },
    React.createElement('button', {
      type: 'button',
      style: {
        ...webStyles.navTab,
        ...(activeInOverflow ? webStyles.navTabActive : {}),
        flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center', gap: 4,
      } as React.CSSProperties,
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); setMoreOpen((v) => !v); },
    }, 'Mais', moreChevronSvg),
    // Dropdown
    moreOpen ? React.createElement('div', {
      style: {
        position: 'absolute' as const, top: '100%', right: 0, marginTop: 4,
        background: '#fff', borderRadius: 12, border: '1px solid #e2e2e2',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 1000,
        minWidth: 180, padding: '8px 0', display: 'flex', flexDirection: 'column' as const,
      },
    },
      ...overflowTabs.map((tab) => {
        const idx = navTabsList.indexOf(tab);
        const isActive = idx === activeNavIndex;
        return React.createElement('button', {
          key: tab.label,
          type: 'button',
          style: {
            display: 'flex', alignItems: 'center', height: 40, padding: '0 16px',
            background: isActive ? '#f1f1f1' : 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: isActive ? 600 : 400,
            color: isActive ? '#a37e38' : '#0d0d0d', ...font,
            whiteSpace: 'nowrap' as const,
          },
          onClick: () => { navigate(tab.path); setMoreOpen(false); },
        }, tab.label);
      })) : null) : null;

  const header = React.createElement('header', { style: webStyles.navbar },
    React.createElement('div', { style: webStyles.navbarInner },
      React.createElement('div', { style: webStyles.navLogo, onClick: () => navigate('/'), role: 'button' as const },
        React.createElement(Logo, { variant: 'navbar' })),
      React.createElement('nav', { style: webStyles.navTabs },
        React.createElement('div', {
          style: { ...webStyles.navTabGroup, flexWrap: 'nowrap' as const },
        },
          ...navButtons,
          moreButton)),
      React.createElement('div', { style: webStyles.userBlock },
        React.createElement('button', { type: 'button', style: webStyles.userButton, 'aria-label': 'Menu do usuário' },
          React.createElement('div', { style: webStyles.avatar },
            React.createElement('span', { style: webStyles.avatarLetter }, avatarLetter)),
          React.createElement('div', { style: webStyles.userDetails },
            React.createElement('span', { style: webStyles.userName }, userName),
            React.createElement('span', { style: webStyles.userEmail }, userEmail)),
          React.createElement('span', { style: webStyles.chevronDown }, chevronDownSvg)))));

  return React.createElement('div', { style: webStyles.homePage },
    header,
    React.createElement('main', { style: webStyles.homeContent },
      React.createElement(Outlet)));
}
