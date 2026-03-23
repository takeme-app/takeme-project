/**
 * WebSignupScreen — Signup screen extracted from App.tsx (lines 1055-1122).
 * Uses React.createElement() calls (NOT JSX).
 */
import { useState } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { webStyles, eyeSvg, getLogoSrc, logoArrowSvg } from '../styles/webStyles';

export default function WebSignupScreen() {
  const navigate = useNavigate();
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupHidePassword, setSignupHidePassword] = useState(true);
  const [signupHideConfirm, setSignupHideConfirm] = useState(true);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSignUp = async () => {
    const email = signupEmail.trim();
    setSignupError('');
    if (!email) { setSignupError('Digite seu e-mail.'); return; }
    if (!signupPassword) { setSignupError('Digite uma senha.'); return; }
    if (signupPassword.length < 6) { setSignupError('A senha deve ter no mínimo 6 caracteres.'); return; }
    if (signupPassword !== signupConfirmPassword) { setSignupError('As senhas não coincidem.'); return; }
    if (!isSupabaseConfigured) { setSignupError('Cadastro não configurado. Configure o Supabase no .env.'); return; }
    setSignupLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: signupPassword,
        options: signupName.trim() ? { data: { full_name: signupName.trim() } } : undefined,
      });
      if (error) throw error;
      if (data?.user && !data.session) {
        setSignupSuccess(true);
        setSignupError('');
      } else if (data?.session) {
        // AuthContext handles redirect automatically
      } else {
        setSignupSuccess(true);
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Não foi possível criar a conta. Tente novamente.';
      setSignupError(msg);
    } finally {
      setSignupLoading(false);
    }
  };

  const logoSrc = getLogoSrc();
  const logoElSignup = logoSrc
    ? React.createElement('img', { src: logoSrc, alt: 'Take Me', style: webStyles.logoImgWide })
    : React.createElement('div', { style: webStyles.logoPlaceholder },
        React.createElement('div', { style: webStyles.logoPlaceholderIcon }, logoArrowSvg),
        React.createElement('div', { style: webStyles.logoPlaceholderText },
          React.createElement('span', { style: webStyles.logoPlaceholderTake }, 'Take '),
          React.createElement('span', { style: webStyles.logoPlaceholderMe }, 'Me')));
  const signupFormContent = signupSuccess
    ? [
        React.createElement('p', { key: 'ok', style: webStyles.sentText }, 'Conta criada. Faça login com seu e-mail e senha.'),
        React.createElement('button', { key: 'back', type: 'button', style: { ...webStyles.primaryBtn, marginTop: 16 } as React.CSSProperties, onClick: () => { navigate('/login'); setSignupSuccess(false); } }, 'Ir para o login'),
      ]
    : [
        React.createElement('div', { key: 'name', style: webStyles.textField },
          React.createElement('div', { style: webStyles.inputInner },
            React.createElement('input', { type: 'text', placeholder: 'Nome (opcional)', value: signupName, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setSignupName(e.target.value); setSignupError(''); }, disabled: signupLoading, style: webStyles.input }))),
        React.createElement('div', { key: 'email', style: { ...webStyles.textField, ...(signupError && signupError.includes('e-mail') ? webStyles.inputError : {}) } },
          React.createElement('div', { style: webStyles.inputInner },
            React.createElement('input', { type: 'email', placeholder: 'E-mail', value: signupEmail, onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setSignupEmail(e.target.value); setSignupError(''); }, disabled: signupLoading, style: webStyles.input }))),
        React.createElement('div', { key: 'pw', style: webStyles.passwordRow },
          React.createElement('div', { style: webStyles.passwordInputWrap },
            React.createElement('input', {
              type: signupHidePassword ? 'password' : 'text',
              placeholder: 'Senha (mín. 6 caracteres)',
              value: signupPassword,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setSignupPassword(e.target.value); setSignupError(''); },
              disabled: signupLoading,
              style: { ...webStyles.input, paddingRight: 48 } as React.CSSProperties,
            }),
            React.createElement('div', { style: webStyles.actionContainer },
              React.createElement('button', { type: 'button', style: webStyles.iconButton, onClick: () => setSignupHidePassword((v) => !v), 'aria-label': signupHidePassword ? 'Mostrar senha' : 'Ocultar senha' }, eyeSvg(signupHidePassword))))),
        React.createElement('div', { key: 'pw2', style: webStyles.passwordRow },
          React.createElement('div', { style: webStyles.passwordInputWrap },
            React.createElement('input', {
              type: signupHideConfirm ? 'password' : 'text',
              placeholder: 'Confirmar senha',
              value: signupConfirmPassword,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setSignupConfirmPassword(e.target.value); setSignupError(''); },
              disabled: signupLoading,
              style: { ...webStyles.input, paddingRight: 48 } as React.CSSProperties,
            }),
            React.createElement('div', { style: webStyles.actionContainer },
              React.createElement('button', { type: 'button', style: webStyles.iconButton, onClick: () => setSignupHideConfirm((v) => !v), 'aria-label': signupHideConfirm ? 'Mostrar senha' : 'Ocultar senha' }, eyeSvg(signupHideConfirm))))),
        signupError ? React.createElement('p', { key: 'err', style: webStyles.errorText }, '▲ ', signupError) : null,
        React.createElement('button', { key: 'btn', type: 'button', style: webStyles.link, onClick: () => navigate('/login'), disabled: signupLoading }, 'Já tem conta? Entrar'),
        React.createElement('button', {
          key: 'submit',
          type: 'button',
          style: { ...webStyles.primaryBtn, opacity: signupLoading ? 0.7 : 1 },
          disabled: signupLoading,
          onClick: handleSignUp,
        }, signupLoading ? 'Criando conta...' : 'Criar conta'),
      ];
  const signupFrame4 = React.createElement('div', { style: webStyles.frame4 }, signupFormContent);
  return React.createElement('div', { style: webStyles._25login, className: 'figma-login' },
    React.createElement('div', { style: webStyles.login },
      React.createElement('style', { dangerouslySetInnerHTML: { __html: 'html, body, #root { margin: 0; padding: 0; width: 100%; min-height: 100vh; height: 100%; box-sizing: border-box; }.figma-login input::placeholder { color: #767676; }.figma-login .admin-cta { width: 100%; min-width: 0; max-width: 100%; align-items: center; align-self: center; }.figma-login .admin-cta button,.figma-login button { min-height: 44px; box-sizing: border-box; }.figma-login .admin-cta button { width: 100%; } @media (max-width: 480px) { .figma-login .admin-cta { max-width: none; padding: 0 4px; }.figma-login .admin-cta button,.figma-login button { padding: 14px 12px; font-size: 15px; } }' } }),
      React.createElement('div', { style: webStyles.content },
        React.createElement('div', { style: webStyles.frame427321193 },
          React.createElement('div', { style: webStyles.logo }, logoElSignup),
          React.createElement('div', { style: webStyles.frame9 },
            React.createElement('div', { style: webStyles.frame7 },
              React.createElement('div', { style: webStyles.frame5 },
                React.createElement('div', { style: webStyles.frame3 },
                  React.createElement('div', { style: webStyles.title }, 'Criar conta')),
                signupFrame4)))))));
}
