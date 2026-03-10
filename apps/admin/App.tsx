/**
 * Admin — tela de login como index.
 * No web usa apenas React + DOM (div/span/input/button) para evitar bug do View no react-native-web.
 */
import { useEffect, useState } from 'react';
import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase, isSupabaseConfigured } from './src/lib/supabase';

const isWeb = Platform.OS === 'web';

// Logo oficial do admin (quadrado claro + seta dourada + "Take Me")
const logoAdminAsset = require('./assets/logo-admin.png');
const logoAsset = require('./assets/logo.png');
const logoFigmaAsset = require('./assets/logo1.png');
function getLogoWebSrc(asset: unknown): string | null {
  if (typeof asset === 'string') return asset;
  if (asset && typeof asset === 'object') {
    const u = (asset as { uri?: string; default?: string }).uri ?? (asset as { default?: string }).default;
    if (typeof u === 'string') return u;
  }
  return null;
}

type Screen = 'loading' | 'login' | 'forgot' | 'home';

// Estilos extraídos do export Figma (autohtml-project): variáveis e estrutura idênticos
const webStyles = {
  _25login: { width: '100%', minHeight: '100vh', height: '100vh', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' as const },
  login: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '100%', flex: 1, boxSizing: 'border-box' as const },
  content: { display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box' as const },
  frame427321193: { display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 580, boxSizing: 'border-box' as const },
  logo: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, boxSizing: 'border-box' as const },
  logoImg: { width: 69, height: 67, objectFit: 'cover' as const, flexShrink: 0 },
  logoImgWide: { height: 56, width: 'auto', maxWidth: 200, objectFit: 'contain' as const, flexShrink: 0 },
  frame9: { display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'flex-start', alignSelf: 'stretch', width: '100%', maxWidth: 580, boxSizing: 'border-box' as const },
  frame7: { display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', justifyContent: 'flex-start', alignSelf: 'stretch', boxSizing: 'border-box' as const },
  frame5: { display: 'flex', flexDirection: 'column', gap: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', boxSizing: 'border-box' as const },
  frame3: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'flex-start', alignSelf: 'stretch', boxSizing: 'border-box' as const },
  title: { color: '#0d0d0d', textAlign: 'center' as const, fontFamily: 'Inter, "Inter-SemiBold", sans-serif', fontSize: 24, fontWeight: 600, alignSelf: 'stretch' },
  frame4: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', justifyContent: 'flex-start', width: '100%', boxSizing: 'border-box' as const },
  textField: { display: 'flex', flexDirection: 'column', alignSelf: 'stretch', height: 48, borderRadius: 8, background: '#f1f1f1', overflow: 'hidden' as const, boxSizing: 'border-box' as const },
  inputInner: { flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '2px 4px 0 16px', minHeight: 40, boxSizing: 'border-box' as const },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#333333',
    fontSize: 16,
    lineHeight: '150%',
    fontWeight: 400,
    fontFamily: 'Inter, "Inter-Regular", sans-serif',
    minWidth: 0,
  } as React.CSSProperties,
  inputPlaceholder: { color: '#767676' },
  actionContainer: { padding: '0 4px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' },
  iconButton: { padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, cursor: 'pointer', background: 'none', border: 'none' },
  link: { borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', cursor: 'pointer', background: 'none', border: 'none', color: '#0d0d0d', fontSize: 14, lineHeight: '150%', fontWeight: 500, fontFamily: 'Inter, "Inter-Medium", sans-serif' },
  cta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', maxWidth: 358, boxSizing: 'border-box' as const },
  primaryBtn: {
    width: '100%',
    background: '#0d0d0d',
    borderRadius: 8,
    padding: '12px 16px',
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    color: '#ffffff',
    fontSize: 16,
    lineHeight: '150%',
    fontWeight: 500,
    fontFamily: 'Inter, "Inter-Medium", sans-serif',
    boxSizing: 'border-box' as const,
  },
  inputError: { outline: '2px solid #DC2626', outlineOffset: -2 },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  passwordRow: { position: 'relative' as const, display: 'flex', flexDirection: 'column', alignSelf: 'stretch', height: 48, borderRadius: 8, background: '#f1f1f1', overflow: 'hidden', boxSizing: 'border-box' as const },
  passwordInputWrap: { flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '2px 4px 0 16px', minHeight: 40 },
  loading: { minHeight: '100vh', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#767676', fontSize: 16, fontFamily: 'Inter, sans-serif' },
  home: { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  homeText: { fontSize: 20, fontWeight: 600, color: '#000' },
  backBtn: { marginBottom: 20, cursor: 'pointer', background: 'none', border: 'none', padding: 0 },
  backArrow: { fontSize: 18, fontWeight: 600, color: '#000' },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 24 },
  sentText: { fontSize: 15, color: '#059669' },
  logoPlaceholder: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 } as React.CSSProperties,
  logoPlaceholderIcon: { width: 48, height: 48, borderRadius: 8, background: '#f1f1f1', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  logoPlaceholderText: { fontSize: 20, color: '#0d0d0d', lineHeight: 1.2, fontFamily: 'Inter, sans-serif' },
  logoPlaceholderTake: { fontWeight: 700 },
  logoPlaceholderMe: { fontWeight: 400 },
  outer: { minHeight: '100vh', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24, boxSizing: 'border-box' as const },
  card: { backgroundColor: '#FFFFFF', padding: 40, width: '100%', maxWidth: 400, boxSizing: 'border-box' as const },
};

// Ícone do logo (seta laranja) quando não há imagem
const logoArrowSvg = React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } }, React.createElement('path', { d: 'M7 17L17 7M17 7h-8M17 7v8', stroke: '#F59E0B', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Ícone visibility-off do Figma (fill #767676) — usado no botão de senha
const visibilityOffSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', style: { display: 'block', flex: 1 } }, React.createElement('g', { clipPath: 'url(#clip0_visibility)' }, React.createElement('path', { d: 'M9.99992 5C13.1583 5 15.9749 6.77501 17.3499 9.58334C16.8583 10.6 16.1666 11.475 15.3416 12.1833L16.5166 13.3583C17.6749 12.3333 18.5916 11.05 19.1666 9.58334C17.7249 5.92501 14.1666 3.33334 9.99992 3.33334C8.94159 3.33334 7.92492 3.50001 6.96659 3.80834L8.34159 5.18334C8.88325 5.075 9.43325 5 9.99992 5ZM9.10825 5.95L10.8333 7.67501C11.3083 7.88334 11.6916 8.26667 11.8999 8.74167L13.6249 10.4667C13.6916 10.1833 13.7416 9.88334 13.7416 9.575C13.7499 7.50834 12.0666 5.83334 9.99992 5.83334C9.69159 5.83334 9.39992 5.875 9.10825 5.95ZM1.67492 3.225L3.90825 5.45834C2.54992 6.52501 1.47492 7.94167 0.833252 9.58334C2.27492 13.2417 5.83325 15.8333 9.99992 15.8333C11.2666 15.8333 12.4833 15.5917 13.5999 15.15L16.4499 18L17.6249 16.825L2.84992 2.04167L1.67492 3.225ZM7.92492 9.475L10.0999 11.65C10.0666 11.6583 10.0333 11.6667 9.99992 11.6667C8.84992 11.6667 7.91659 10.7333 7.91659 9.58334C7.91659 9.54167 7.92492 9.51667 7.92492 9.475V9.475ZM5.09159 6.64167L6.54992 8.10001C6.35825 8.55834 6.24992 9.05834 6.24992 9.58334C6.24992 11.65 7.93325 13.3333 9.99992 13.3333C10.5249 13.3333 11.0249 13.225 11.4749 13.0333L12.2916 13.85C11.5583 14.05 10.7916 14.1667 9.99992 14.1667C6.84159 14.1667 4.02492 12.3917 2.64992 9.58334C3.23325 8.39167 4.08325 7.40834 5.09159 6.64167Z', fill: '#767676' })), React.createElement('defs', null, React.createElement('clipPath', { id: 'clip0_visibility' }, React.createElement('rect', { width: 20, height: 20, fill: 'white' }))));
const eyeOpenSvg = React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', style: { display: 'block' } }, React.createElement('path', { d: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z', fill: '#767676' }));
const eyeSvg = (hidden: boolean) => (hidden ? visibilityOffSvg : eyeOpenSvg);

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hidePassword, setHidePassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setScreen(session ? 'home' : 'login');
    }).catch(() => setScreen('login'));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setScreen(s ? 'home' : 'login');
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fonte Inter do Figma (web)
  useEffect(() => {
    if (!isWeb || typeof document === 'undefined') return;
    const existing = document.querySelector('link[data-figma-font="inter"]');
    if (existing) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    link.setAttribute('data-figma-font', 'inter');
    document.head.appendChild(link);
  }, []);

  const handleLogin = async () => {
    const input = phoneOrEmail.trim();
    setEmailError('');
    setPasswordError('');
    if (!input) { setEmailError('Digite seu e-mail ou telefone.'); return; }
    if (!password) { setPasswordError('Digite sua senha.'); return; }
    if (!isSupabaseConfigured) { setEmailError('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.'); return; }
    setLoading(true);
    try {
      if (input.includes('@')) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: input, password });
        if (error || !data?.session) { setEmailError('E-mail incorreto'); setPasswordError('Senha incorreta'); setLoading(false); return; }
      } else {
        const phone = input.replace(/\D/g, '');
        const { data, error: fnErr } = await supabase.functions.invoke('login-with-phone', { body: { phone, password } });
        if (fnErr || data?.error || !data?.session) { setEmailError('E-mail incorreto'); setPasswordError('Senha incorreta'); setLoading(false); return; }
        await supabase.auth.setSession(data.session);
      }
      setScreen('home');
    } catch {
      setEmailError('E-mail incorreto');
      setPasswordError('Senha incorreta');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    const email = forgotEmail.trim();
    setForgotError('');
    if (!email) { setForgotError('Digite seu e-mail.'); return; }
    if (!isSupabaseConfigured) { setForgotError('Supabase não configurado.'); return; }
    setForgotLoading(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin + '/' : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setForgotSent(true);
    } catch {
      setForgotError('Não foi possível enviar o e-mail. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  // —— Web: renderizar só com DOM (evita bug do View no react-native-web) ——
  if (isWeb) {
    if (screen === 'loading') {
      return React.createElement('div', { style: webStyles.loading },
        React.createElement('span', { style: webStyles.loadingText }, 'Carregando...'));
    }
    if (screen === 'home') {
      return React.createElement('div', { style: webStyles.home },
        React.createElement('span', { style: webStyles.homeText }, 'Bem-vindo ao Admin'));
    }
    if (screen === 'forgot') {
      return React.createElement('div', { style: webStyles.outer },
        React.createElement('div', { style: webStyles.card },
          React.createElement('div', { style: webStyles.backBtn, onClick: () => setScreen('login'), role: 'button' }, '← Voltar'),
          React.createElement('h2', { style: webStyles.title }, 'Recuperação de senha'),
          React.createElement('p', { style: webStyles.subtitle }, 'Digite seu e-mail e enviaremos um link para redefinir sua senha.'),
          forgotSent
            ? React.createElement('p', { style: webStyles.sentText }, 'Verifique seu e-mail.')
            : [
                React.createElement('input', {
                  key: 'email',
                  type: 'email',
                  placeholder: 'E-mail',
                  value: forgotEmail,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setForgotEmail(e.target.value); setForgotError(''); },
                  disabled: forgotLoading,
                  style: { ...webStyles.input, ...(forgotError ? webStyles.inputError : {}) },
                }),
                forgotError ? React.createElement('p', { key: 'err', style: webStyles.errorText }, forgotError) : null,
                React.createElement('button', {
                  key: 'btn',
                  type: 'button',
                  style: webStyles.primaryBtn,
                  disabled: forgotLoading,
                  onClick: handleForgotSubmit,
                }, forgotLoading ? 'Enviando...' : 'Enviar link'),
              ]));
    }
    // Login — estrutura e estilos do export Figma (autohtml-project)
    const logoSrc = getLogoWebSrc(logoAdminAsset) ?? getLogoWebSrc(logoFigmaAsset) ?? getLogoWebSrc(logoAsset);
    const logoEl = logoSrc
      ? React.createElement('img', { src: logoSrc, alt: 'Take Me', style: webStyles.logoImgWide })
      : React.createElement('div', { style: webStyles.logoPlaceholder },
          React.createElement('div', { style: webStyles.logoPlaceholderIcon }, logoArrowSvg),
          React.createElement('div', { style: webStyles.logoPlaceholderText },
            React.createElement('span', { style: webStyles.logoPlaceholderTake }, 'Take '),
            React.createElement('span', { style: webStyles.logoPlaceholderMe }, 'Me')));
    return React.createElement('div', { style: webStyles._25login, className: 'figma-login' },
      React.createElement('div', { style: webStyles.login },
        React.createElement('style', { dangerouslySetInnerHTML: { __html: 'html, body, #root { margin: 0; padding: 0; width: 100%; min-height: 100vh; height: 100%; box-sizing: border-box; }.figma-login { width: 100% !important; min-height: 100vh !important; }.figma-login input::placeholder { color: #767676; }' } }),
        React.createElement('div', { style: webStyles.content },
          React.createElement('div', { style: webStyles.frame427321193 },
            React.createElement('div', { style: webStyles.logo }, logoEl),
            React.createElement('div', { style: webStyles.frame9 },
              React.createElement('div', { style: webStyles.frame7 },
                React.createElement('div', { style: webStyles.frame5 },
                  React.createElement('div', { style: webStyles.frame3 },
                    React.createElement('div', { style: webStyles.title }, 'Digite seu número de telefone ou email')),
                  React.createElement('div', { style: webStyles.frame4 },
                    React.createElement('div', { style: { ...webStyles.textField, ...(emailError ? webStyles.inputError : {}) } },
                      React.createElement('div', { style: webStyles.inputInner },
                        React.createElement('input', {
                          type: 'text',
                          placeholder: 'Telefone ou email',
                          value: phoneOrEmail,
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setPhoneOrEmail(e.target.value); setEmailError(''); },
                          disabled: loading,
                          style: webStyles.input,
                        }))),
                    emailError ? React.createElement('p', { style: webStyles.errorText }, '▲ ', emailError) : null,
                    React.createElement('div', { style: { ...webStyles.passwordRow, ...(passwordError ? webStyles.inputError : {}) } },
                      React.createElement('div', { style: webStyles.passwordInputWrap },
                        React.createElement('input', {
                          type: hidePassword ? 'password' : 'text',
                          placeholder: 'Senha de acesso',
                          value: password,
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setPassword(e.target.value); setPasswordError(''); },
                          disabled: loading,
                          style: { ...webStyles.input, paddingRight: 48 } as React.CSSProperties,
                        }),
                        React.createElement('div', { style: webStyles.actionContainer },
                          React.createElement('button', { type: 'button', style: webStyles.iconButton, onClick: () => setHidePassword((v) => !v), 'aria-label': hidePassword ? 'Mostrar senha' : 'Ocultar senha' }, eyeSvg(hidePassword))))),
                    passwordError ? React.createElement('p', { style: webStyles.errorText }, '▲ ', passwordError) : null,
                    React.createElement('button', { type: 'button', style: webStyles.link, onClick: () => setScreen('forgot'), disabled: loading }, 'Esqueceu sua senha?')),
                React.createElement('div', { style: webStyles.cta },
                  React.createElement('button', {
                    type: 'button',
                    style: { ...webStyles.primaryBtn, opacity: loading ? 0.7 : 1 },
                    disabled: loading,
                    onClick: handleLogin,
                  }, loading ? 'Entrando...' : 'Continuar')))))))));
  }

  // —— Native: React Native View/Text/etc ——
  const s = StyleSheet.create({
    outer: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', padding: 24 },
    loading: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#6B7280', fontSize: 16 },
    home: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    homeText: { fontSize: 20, fontWeight: '600', color: '#000' },
    card: { backgroundColor: '#fff', padding: 32, width: '100%', maxWidth: 400 },
    backBtn: { marginBottom: 20 },
    backArrow: { fontSize: 18, fontWeight: '600', color: '#000' },
    logo: { width: 120, height: 64, backgroundColor: '#F3F4F6', borderRadius: 8, alignSelf: 'center', marginBottom: 24 },
    title: { fontSize: 18, fontWeight: '400', color: '#000', marginBottom: 20 },
    subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 24 },
    label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#000', backgroundColor: '#fff', marginBottom: 4 },
    inputError: { borderColor: '#DC2626' },
    inputPassword: { paddingRight: 56 },
    passwordRow: { position: 'relative', marginBottom: 4 },
    eyeBtn: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
    eyeLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
    errorText: { fontSize: 12, color: '#DC2626', marginBottom: 12 },
    link: { alignSelf: 'flex-start', marginBottom: 20 },
    linkText: { fontSize: 14, fontWeight: '500', color: '#000' },
    primaryBtn: { backgroundColor: '#0D0D0D', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    primaryBtnDisabled: { opacity: 0.7 },
    primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    sentText: { fontSize: 15, color: '#059669' },
  });

  if (screen === 'loading') {
    return (
      <View style={s.loading}>
        <StatusBar style="light" />
        <Text style={s.loadingText}>Carregando...</Text>
      </View>
    );
  }
  if (screen === 'home') {
    return (
      <View style={s.home}>
        <StatusBar style="dark" />
        <Text style={s.homeText}>Bem-vindo ao Admin</Text>
      </View>
    );
  }
  if (screen === 'forgot') {
    return (
      <KeyboardAvoidingView style={s.outer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar style="light" />
        <View style={s.card}>
          <TouchableOpacity onPress={() => setScreen('login')} style={s.backBtn}>
            <Text style={s.backArrow}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={s.title}>Recuperação de senha</Text>
          <Text style={s.subtitle}>Digite seu e-mail e enviaremos um link para redefinir sua senha.</Text>
          {forgotSent ? (
            <Text style={s.sentText}>Verifique seu e-mail.</Text>
          ) : (
            <>
              <TextInput style={[s.input, forgotError ? s.inputError : null]} placeholder="E-mail" placeholderTextColor="#9CA3AF" value={forgotEmail} onChangeText={(t) => { setForgotEmail(t); setForgotError(''); }} autoCapitalize="none" keyboardType="email-address" editable={!forgotLoading} />
              {forgotError ? <Text style={s.errorText}>{forgotError}</Text> : null}
              <TouchableOpacity style={[s.primaryBtn, forgotLoading && s.primaryBtnDisabled]} onPress={handleForgotSubmit} disabled={forgotLoading}>
                {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Enviar link</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }
  return (
    <KeyboardAvoidingView style={s.outer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <View style={s.card}>
        <View style={s.logo} />
        <Text style={s.title}>Digite seu número de telefone ou email</Text>
        <Text style={s.label}>Telefone ou email</Text>
        <TextInput style={[s.input, emailError ? s.inputError : null]} placeholder="Telefone ou email" placeholderTextColor="#9CA3AF" value={phoneOrEmail} onChangeText={(t) => { setPhoneOrEmail(t); setEmailError(''); }} autoCapitalize="none" keyboardType="email-address" editable={!loading} />
        {emailError ? <Text style={s.errorText}>{emailError}</Text> : null}
        <Text style={s.label}>Senha de acesso</Text>
        <View style={s.passwordRow}>
          <TextInput style={[s.input, s.inputPassword, passwordError ? s.inputError : null]} placeholder="Senha de acesso" placeholderTextColor="#9CA3AF" value={password} onChangeText={(t) => { setPassword(t); setPasswordError(''); }} secureTextEntry={hidePassword} editable={!loading} />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setHidePassword((v) => !v)}>
            <Text style={s.eyeLabel}>{hidePassword ? 'Ver' : 'Ocultar'}</Text>
          </TouchableOpacity>
        </View>
        {passwordError ? <Text style={s.errorText}>{passwordError}</Text> : null}
        <TouchableOpacity style={s.link} onPress={() => setScreen('forgot')} disabled={loading}>
          <Text style={s.linkText}>Esqueceu sua senha?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.primaryBtn, loading && s.primaryBtnDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Continuar</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
