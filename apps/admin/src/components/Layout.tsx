import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { webStyles } from '../styles/webStyles';
import { Logo } from './Logo';
import { chevronDownSvg, lockOutlineSvg, desktopOutlineSvg, settingsOutlineSvg, exitToAppSvg } from './icons';
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
  { label: 'Notificações', path: '/notificacoes' },
  { label: 'Avaliações', path: '/avaliacoes' },
  { label: 'Analytics', path: '/analytics' },
];

/** Máximo de abas na barra; o restante fica em "Ver mais". */
const MAX_VISIBLE_NAV_TABS = 6;

// Chevron right (>) para "Ver mais"
const chevronRightSvg = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M9 18l6-6-6-6', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();

  // Scroll to top on route change
  useEffect(() => {
    const scrollContainer = document.querySelector('main')?.parentElement;
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }, [location.pathname]);

  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMenuPos, setAccountMenuPos] = useState<{ top: number; left: number } | null>(null);

  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null);
  const accountDropdownRef = useRef<HTMLDivElement | null>(null);

  const updateAccountMenuPosition = useCallback(() => {
    const el = accountTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 283;
    let left = rect.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    setAccountMenuPos({ top: rect.bottom + 8, left });
  }, []);

  useLayoutEffect(() => {
    if (!accountOpen) {
      setAccountMenuPos(null);
      return;
    }
    updateAccountMenuPosition();
    window.addEventListener('scroll', updateAccountMenuPosition, true);
    window.addEventListener('resize', updateAccountMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateAccountMenuPosition, true);
      window.removeEventListener('resize', updateAccountMenuPosition);
    };
  }, [accountOpen, updateAccountMenuPosition]);

  // Fecha ao clicar fora (capture + contains evita conflito com React 19 / mesmo clique de abrir)
  useEffect(() => {
    if (!moreOpen && !accountOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (moreOpen && moreMenuRef.current?.contains(t)) return;
      if (accountOpen) {
        if (accountTriggerRef.current?.contains(t)) return;
        if (accountDropdownRef.current?.contains(t)) return;
      }
      setMoreOpen(false);
      setAccountOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown, true);
    return () => document.removeEventListener('mousedown', onPointerDown, true);
  }, [moreOpen, accountOpen]);

  useEffect(() => {
    setMoreOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  // When navigating from another module (e.g. encomendas → viagem detail),
  // keep that module's nav tab active instead of matching /viagens
  const fromModule = (location.state as any)?.from as string | undefined;
  const fromPath = fromModule ? `/${fromModule}` : null;

  const activeNavIndex = navTabsList.findIndex((tab) => {
    if (fromPath && location.pathname.startsWith('/viagens')) {
      return tab.path === fromPath;
    }
    if (tab.path === '/') return location.pathname === '/';
    return location.pathname.startsWith(tab.path);
  });

  const userName = session?.user?.user_metadata?.full_name || 'Pedro Henrique';
  const userEmail = session?.user?.email || 'pedro.henriq@gmail.com';
  const avatarLetter = userName.charAt(0).toUpperCase();

  const needsMore = navTabsList.length > MAX_VISIBLE_NAV_TABS;
  const visibleTabs = needsMore ? navTabsList.slice(0, MAX_VISIBLE_NAV_TABS) : navTabsList;
  const overflowTabs = needsMore ? navTabsList.slice(MAX_VISIBLE_NAV_TABS) : [];

  const activeInOverflow = needsMore && activeNavIndex >= MAX_VISIBLE_NAV_TABS;

  const navButtons = visibleTabs.map((tab, i) =>
    React.createElement('button', {
      key: tab.label,
      type: 'button',
      style: { ...webStyles.navTab, ...(i === activeNavIndex ? webStyles.navTabActive : {}) } as React.CSSProperties,
      onClick: () => navigate(tab.path),
    }, tab.label));

  // "Ver mais" com dropdown
  const moreButton = needsMore ? React.createElement('div', {
    key: '_more',
    ref: moreMenuRef,
    style: { position: 'relative' as const, display: 'inline-flex' },
  },
    React.createElement('button', {
      type: 'button',
      'aria-expanded': moreOpen,
      'aria-haspopup': 'menu',
      style: {
        ...webStyles.navTab,
        ...(activeInOverflow ? webStyles.navTabActive : {}),
        flexDirection: 'row' as const, alignItems: 'center', justifyContent: 'center', gap: 4,
      } as React.CSSProperties,
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); setMoreOpen((v) => !v); },
    }, 'Ver mais', chevronRightSvg),
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
      React.createElement('div', { style: { ...webStyles.userBlock, position: 'relative' as const } },
        React.createElement('button', {
          ref: accountTriggerRef,
          type: 'button', style: webStyles.userButton, 'aria-label': 'Menu do usuário', 'aria-expanded': accountOpen,
          onClick: () => { setAccountOpen((v) => !v); },
        },
          React.createElement('div', { style: webStyles.avatar },
            React.createElement('span', { style: webStyles.avatarLetter }, avatarLetter)),
          React.createElement('div', { style: webStyles.userDetails },
            React.createElement('span', { style: webStyles.userName }, userName),
            React.createElement('span', { style: webStyles.userEmail }, userEmail)),
          React.createElement('span', { style: webStyles.chevronDown }, chevronDownSvg)))));

  const accountDropdownPanel =
    accountOpen && accountMenuPos && typeof document !== 'undefined'
      ? createPortal(
          React.createElement('div', {
            ref: accountDropdownRef,
            role: 'menu',
            style: {
              position: 'fixed' as const,
              top: accountMenuPos.top,
              left: accountMenuPos.left,
              width: 283,
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              zIndex: 10001,
              boxShadow: '6px 6px 12px 0px rgba(0,0,0,0.15)',
              boxSizing: 'border-box' as const,
            },
          },
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 8, width: '100%' } },
              ...([
                { label: 'Atualizar senha', icon: lockOutlineSvg, action: () => {} },
                { label: 'Atendimentos', icon: desktopOutlineSvg, action: () => navigate('/atendimentos') },
                {
                  label: 'Configurações',
                  icon: settingsOutlineSvg,
                  action: () => { setAccountOpen(false); navigate('/configuracoes'); },
                },
              ] as const).map((item) =>
                React.createElement('button', {
                  key: item.label, type: 'button', role: 'menuitem',
                  onClick: item.action,
                  style: {
                    display: 'flex', alignItems: 'center', gap: 8, height: 37,
                    padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    borderRadius: 8, width: '100%',
                    fontSize: 14, fontWeight: 400, color: '#0d0d0d', ...font,
                    lineHeight: 1.5, whiteSpace: 'nowrap' as const,
                  },
                  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = '#f5f5f5'; },
                  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'none'; },
                }, item.icon, item.label)),
              React.createElement('button', {
                key: 'sair', type: 'button', role: 'menuitem',
                onClick: async () => { setAccountOpen(false); await signOut(); navigate('/login'); },
                style: {
                  display: 'flex', alignItems: 'center', gap: 8, height: 37,
                  padding: '8px 16px', background: 'none', cursor: 'pointer',
                  borderRadius: '0 0 8px 8px', width: '100%',
                  borderTop: '0.5px solid #d9d9d9', borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
                  fontSize: 14, fontWeight: 600, color: '#0d0d0d', ...font,
                  lineHeight: 1.5, whiteSpace: 'nowrap' as const,
                },
                onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = '#f5f5f5'; },
                onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'none'; },
              }, exitToAppSvg, 'Sair da conta'))),
          document.body,
        )
      : null;

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: webStyles.homePage },
      header,
      React.createElement('main', { style: webStyles.homeContent },
        React.createElement(Outlet))),
    accountDropdownPanel);
}
