/**
 * Configurações > Perfil (Figma 1435-22732). Conteúdo abaixo do Layout; dados do usuário logado.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { webStyles } from '../styles/webStyles';
import { useAuth } from '../contexts/AuthContext';

const font: React.CSSProperties = { fontFamily: 'Inter, sans-serif' };

const editPencilWhiteSvg = React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
  React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
  React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

function mapNivelAcesso(role: string | undefined): string {
  if (role === 'admin') return 'Administrador';
  if (!role) return '—';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function requiredRow(label: string) {
  return React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, width: '100%' },
  },
    React.createElement('span', { style: { color: '#cba04b', fontSize: 10, lineHeight: 1, width: 10, textAlign: 'center' as const } }, '*'),
    React.createElement('span', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, label));
}

function readOnlyField(label: string, value: string) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, alignItems: 'stretch', width: '100%' } },
    requiredRow(label),
    React.createElement('div', {
      style: {
        background: '#f1f1f1', borderRadius: 8, height: 44, display: 'flex', alignItems: 'center',
        paddingLeft: 16, paddingRight: 4, boxSizing: 'border-box' as const, width: '100%',
      },
    },
      React.createElement('span', {
        style: {
          fontSize: 16, fontWeight: 400, color: '#3a3a3a', ...font,
          overflow: 'hidden', textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const, lineHeight: 1.5,
        },
      }, value)));
}

export default function ConfiguracoesScreen() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [aba, setAba] = useState<'perfil' | 'usuarios'>('perfil');
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false);
  const [nuNome, setNuNome] = useState('');
  const [nuEmail, setNuEmail] = useState('');
  const [nuPermissoes, setNuPermissoes] = useState<Record<string, boolean>>({ 'Início': true, 'Viagens': true });

  const nome = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || '—';
  const email = session?.user?.email || '—';
  const avatarLetter = (nome === '—' ? '?' : nome).charAt(0).toUpperCase();
  const nivel = mapNivelAcesso(session?.user?.app_metadata?.role as string | undefined);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: '1 1 0',
    minWidth: 0,
    height: 48,
    padding: '14px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    fontSize: 16,
    lineHeight: 1.5,
    ...font,
    fontWeight: active ? 600 : 400,
    color: active ? '#0d0d0d' : '#767676',
  });

  const tabsRow = React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, width: '100%' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'stretch', width: '100%' } },
      React.createElement('button', {
        type: 'button',
        style: tabStyle(aba === 'perfil'),
        onClick: () => setAba('perfil'),
      },
        'Perfil',
        aba === 'perfil' ? React.createElement('span', {
          style: {
            position: 'absolute' as const, left: 0, right: 0, bottom: 0, height: 2,
            background: '#0d0d0d', borderRadius: 100,
          },
        }) : null),
      React.createElement('button', {
        type: 'button',
        style: tabStyle(aba === 'usuarios'),
        onClick: () => setAba('usuarios'),
      }, 'Usuários e Permissões')),
    React.createElement('div', { style: { height: 1, width: '100%', background: '#e2e2e2', marginTop: 0 } }));

  const alterarSenhaBtn = React.createElement('button', {
    type: 'button',
    onClick: () => navigate('/forgot-password'),
    style: {
      height: 44, minWidth: 104, width: 180, padding: '8px 24px', borderRadius: 999,
      border: 'none', cursor: 'pointer', background: '#f1f1f1', ...font,
      fontSize: 14, fontWeight: 500, color: '#0d0d0d', flexShrink: 0,
    },
  }, 'Alterar senha');

  const avatarBlock = React.createElement('div', {
    style: { position: 'relative' as const, width: 120, height: 120, flexShrink: 0 },
  },
    React.createElement('div', {
      style: {
        width: 120, height: 120, borderRadius: '50%', backgroundColor: '#e2e2e2',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' as const,
      },
    },
      React.createElement('span', { style: { fontSize: 48, fontWeight: 600, color: '#0d0d0d', ...font } }, avatarLetter)),
    React.createElement('button', {
      type: 'button',
      'aria-label': 'Editar foto de perfil',
      onClick: () => {},
      style: {
        position: 'absolute' as const, right: 0, bottom: 0, width: 40, height: 40, borderRadius: '50%',
        background: '#050505', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 12, boxSizing: 'border-box' as const,
      },
    }, editPencilWhiteSvg));

  const perfilContent = React.createElement('div', {
    style: { display: 'flex', gap: 24, alignItems: 'flex-start', width: '100%', flexWrap: 'wrap' as const },
  },
    avatarBlock,
    React.createElement('div', {
      style: {
        flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column' as const, gap: 16, alignItems: 'stretch',
      },
    },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, width: '100%', flexWrap: 'wrap' as const },
      },
        React.createElement('h2', {
          style: {
            margin: 0, fontSize: 24, fontWeight: 600, color: '#0d0d0d', ...font, lineHeight: 'normal' as const, whiteSpace: 'nowrap' as const,
          },
        }, nome),
        alterarSenhaBtn),
      readOnlyField('E-mail', email),
      readOnlyField('Senha', '*********'),
      readOnlyField('Nível de acesso', nivel)));

  // ── Usuários e Permissões ───────────────────────────────────────────────
  const userRows = [
    { nome: 'Carlos Silva', email: 'joaosilva@takeme.com', permissao: 'Administrador', data: '10/10/2025', status: 'Ativo' as const },
    { nome: 'João Porto', email: 'joaosilva@takeme.com', permissao: 'Administrador', data: '10/10/2025', status: 'Ativo' as const },
    { nome: 'Jorge Silva', email: 'joaosilva@takeme.com', permissao: 'Financeiro', data: '10/10/2025', status: 'Ativo' as const },
    { nome: 'Carlos Silva', email: 'joaosilva@takeme.com', permissao: 'Atendente', data: '10/10/2025', status: 'Ativo' as const },
    { nome: 'Danilo Santos', email: 'joaosilva@takeme.com', permissao: 'Atendente', data: '10/10/2025', status: 'Inativo' as const },
  ];
  const userCols = [
    { label: 'Usuário', flex: '1 1 20%', minWidth: 160 },
    { label: 'E-mail', flex: '1 1 22%', minWidth: 180 },
    { label: 'Permissão', flex: '0 0 130px', minWidth: 130 },
    { label: 'Data de criação', flex: '0 0 120px', minWidth: 120 },
    { label: 'Status', flex: '0 0 90px', minWidth: 90 },
    { label: 'Visualizar/Editar', flex: '0 0 110px', minWidth: 110 },
  ];
  const avatarColors: Record<string, string> = { C: '#4A90D9', J: '#7B61FF', D: '#9B59B6' };
  const eyeSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    React.createElement('circle', { cx: 12, cy: 12, r: 3, stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const pencilSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
    React.createElement('path', { d: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    React.createElement('path', { d: 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  const cellBase: React.CSSProperties = { display: 'flex', alignItems: 'center', fontSize: 14, color: '#0d0d0d', ...font, padding: '0 6px' };

  const userToolbar = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, padding: '16px 28px', background: '#f6f6f6', borderRadius: '16px 16px 0 0' },
  },
    React.createElement('p', { style: { fontSize: 16, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Lista de administradores'),
    React.createElement('button', {
      type: 'button',
      onClick: () => setNovoUsuarioOpen(true),
      style: {
        display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px',
        background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 999,
        fontSize: 14, fontWeight: 600, cursor: 'pointer', ...font,
      },
    },
      React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } },
        React.createElement('path', { d: 'M12 5v14M5 12h14', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' })),
      'Novo usuário'));

  const userHeader = React.createElement('div', {
    style: { display: 'flex', height: 53, background: '#e2e2e2', borderBottom: '1px solid #d9d9d9', padding: '0 16px', alignItems: 'center' },
  }, ...userCols.map((c) => React.createElement('div', {
    key: c.label, style: { flex: c.flex, minWidth: c.minWidth, fontSize: 12, fontWeight: 400, color: '#0d0d0d', ...font, padding: '0 6px', display: 'flex', alignItems: 'center', height: '100%' },
  }, c.label)));

  const userRowEls = userRows.map((row, idx) => {
    const initial = row.nome.charAt(0);
    const bg = avatarColors[initial] || '#999';
    const stBg = row.status === 'Ativo' ? '#b0e8d1' : '#eeafaa';
    const stColor = row.status === 'Ativo' ? '#174f38' : '#551611';
    return React.createElement('div', {
      key: idx, style: { display: 'flex', minHeight: 64, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #d9d9d9', background: '#f6f6f6' },
    },
      React.createElement('div', { style: { ...cellBase, flex: userCols[0].flex, minWidth: userCols[0].minWidth, gap: 10 } },
        React.createElement('div', { style: { width: 36, height: 36, borderRadius: '50%', background: bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          React.createElement('span', { style: { color: '#fff', fontSize: 14, fontWeight: 600, ...font } }, initial)),
        React.createElement('span', { style: { fontWeight: 500 } }, row.nome)),
      React.createElement('div', { style: { ...cellBase, flex: userCols[1].flex, minWidth: userCols[1].minWidth } }, row.email),
      React.createElement('div', { style: { ...cellBase, flex: userCols[2].flex, minWidth: userCols[2].minWidth } }, row.permissao),
      React.createElement('div', { style: { ...cellBase, flex: userCols[3].flex, minWidth: userCols[3].minWidth } }, row.data),
      React.createElement('div', { style: { ...cellBase, flex: userCols[4].flex, minWidth: userCols[4].minWidth } },
        React.createElement('span', { style: { display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: stBg, color: stColor, ...font } }, row.status)),
      React.createElement('div', { style: { flex: userCols[5].flex, minWidth: userCols[5].minWidth, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 } },
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Visualizar' }, eyeSvg),
        React.createElement('button', { type: 'button', style: webStyles.viagensActionBtn, 'aria-label': 'Editar' }, pencilSvg)));
  });

  const usuariosContent = React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column' as const, gap: 0, width: '100%' },
  }, React.createElement('div', { style: { background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%' } },
    userToolbar,
    React.createElement('div', { style: { width: '100%', overflowX: 'auto' as const } }, userHeader, ...userRowEls)));

  // ── Novo Usuário Modal ──────────────────────────────────────────────────
  const permModulos = ['Início', 'Viagens', 'Passageiros', 'Motoristas', 'Destinos', 'Encomendas', 'Preparadores', 'Promoções', 'Pagamentos', 'Atendimento'];
  const togglePerm = (mod: string) => setNuPermissoes((prev) => ({ ...prev, [mod]: !prev[mod] }));

  const checkboxSvg = (checked: boolean) => React.createElement('div', {
    style: {
      width: 22, height: 22, borderRadius: 4, border: checked ? 'none' : '2px solid #d9d9d9',
      background: checked ? '#0d0d0d' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxSizing: 'border-box' as const,
    },
  }, checked ? React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none' },
    React.createElement('path', { d: 'M20 6L9 17l-5-5', stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' })) : null);

  const novoUsuarioModal = novoUsuarioOpen ? React.createElement('div', {
    style: {
      position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    onClick: () => setNovoUsuarioOpen(false),
  },
    React.createElement('div', {
      style: {
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, padding: '28px 32px',
        display: 'flex', flexDirection: 'column' as const, gap: 24, boxShadow: '0 20px 60px rgba(0,0,0,.15)',
        maxHeight: '90vh', overflowY: 'auto' as const,
      },
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
    },
      // Header
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('h2', { style: { fontSize: 20, fontWeight: 700, color: '#0d0d0d', margin: 0, ...font } }, 'Novo usuário'),
        React.createElement('button', {
          type: 'button', onClick: () => setNovoUsuarioOpen(false),
          style: { width: 36, height: 36, borderRadius: '50%', background: '#f1f1f1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
        }, React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' },
          React.createElement('path', { d: 'M18 6L6 18M6 6l12 12', stroke: '#0d0d0d', strokeWidth: 2, strokeLinecap: 'round' })))),
      // Separator
      React.createElement('div', { style: { height: 1, background: '#e2e2e2' } }),
      // Dados básicos
      React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#cba04b', margin: 0, ...font } }, 'Dados básicos'),
      // Nome
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6 } },
        React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'Nome do usuário'),
        React.createElement('input', {
          type: 'text', value: nuNome, placeholder: 'Insira o nome do usuário',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNuNome(e.target.value),
          style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px', fontSize: 16, color: '#0d0d0d', outline: 'none', ...font },
        })),
      // Email
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 6 } },
        React.createElement('label', { style: { fontSize: 14, fontWeight: 500, color: '#0d0d0d', ...font } }, 'E-mail do usuário'),
        React.createElement('input', {
          type: 'email', value: nuEmail, placeholder: 'Insira o e-mail do usuário',
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNuEmail(e.target.value),
          style: { height: 44, borderRadius: 8, border: '1px solid #e2e2e2', padding: '0 16px', fontSize: 16, color: '#0d0d0d', outline: 'none', ...font },
        })),
      // Permissões
      React.createElement('p', { style: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', margin: 0, ...font } }, 'Permissões por módulo'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' } },
        ...permModulos.map((mod) =>
          React.createElement('button', {
            key: mod, type: 'button',
            onClick: () => togglePerm(mod),
            style: { display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
          },
            checkboxSvg(!!nuPermissoes[mod]),
            React.createElement('span', { style: { fontSize: 14, color: '#0d0d0d', ...font } }, mod)))),
      // Buttons
      React.createElement('div', { style: { display: 'flex', gap: 16, marginTop: 8 } },
        React.createElement('button', {
          type: 'button', onClick: () => setNovoUsuarioOpen(false),
          style: { flex: 1, height: 48, borderRadius: 999, border: '1px solid #e2e2e2', background: '#fff', fontSize: 16, fontWeight: 600, color: '#0d0d0d', cursor: 'pointer', ...font },
        }, 'Cancelar'),
        React.createElement('button', {
          type: 'button', onClick: () => setNovoUsuarioOpen(false),
          style: { flex: 1, height: 48, borderRadius: 999, border: 'none', background: '#0d0d0d', fontSize: 16, fontWeight: 600, color: '#fff', cursor: 'pointer', ...font },
        }, 'Salvar')))) : null;

  return React.createElement(React.Fragment, null,
    React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 40, width: '100%', maxWidth: 1044, alignSelf: 'stretch' } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' as const, gap: 24, width: '100%' } },
        React.createElement('h1', { style: { ...webStyles.homeTitle, margin: 0, width: '100%' } }, 'Configurações'),
        tabsRow),
      aba === 'perfil' ? perfilContent : usuariosContent),
    novoUsuarioModal);
}
