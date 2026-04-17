import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { getUserErrorMessage } from '../utils/errorMessage';

/** Equivalente a `QueryParams.getQueryParams` do Expo (sem importar `expo-auth-session` → `expo-web-browser`). */
function getQueryParamsFromUrl(input: string): { errorCode: string | null; params: Record<string, string> } {
  const url = new URL(input, 'https://phony.example');
  const errorCode = url.searchParams.get('errorCode');
  url.searchParams.delete('errorCode');
  const params = Object.fromEntries(url.searchParams) as Record<string, string>;
  if (url.hash) {
    new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => {
      params[key] = value;
    });
  }
  return { errorCode, params };
}

/**
 * URL de retorno do OAuth no app (precisa bater com Redirect URLs no Supabase).
 * Não use só `Linking.createURL('', { scheme })` em dev: costuma virar `exp://…`, que não
 * casa com `take-me-cliente://**` e o Supabase cai no Site URL (ex.: admin na Vercel).
 */
function makeOAuthRedirectUri(scheme: string): string {
  return `${scheme}://auth/callback`;
}

/**
 * Completa a sessão do Supabase a partir da URL de redirect do OAuth.
 */
export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = getQueryParamsFromUrl(url);
  if (errorCode) throw new Error(errorCode);
  const access_token = params.access_token;
  const refresh_token = params.refresh_token;
  if (!access_token) return null;
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token ?? undefined,
  });
  if (error) throw error;
  return data.session;
}

function isOAuthReturnUrl(url: string, redirectTo: string): boolean {
  const scheme = redirectTo.split('://')[0];
  if (!scheme || !url.startsWith(`${scheme}://`)) return false;
  return (
    url.includes('access_token=') ||
    url.includes('code=') ||
    url.includes('error=') ||
    url.includes('error_code=')
  );
}

function waitForOAuthReturn(redirectTo: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (url: string | null) => {
      if (settled) return;
      if (!url || !isOAuthReturnUrl(url, redirectTo)) return;
      settled = true;
      clearTimeout(timer);
      sub.remove();
      resolve(url);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      sub.remove();
      resolve(null);
    }, timeoutMs);

    const sub = Linking.addEventListener('url', ({ url }) => done(url));

    void Linking.getInitialURL().then((initial) => done(initial));
  });
}

/**
 * OAuth sem `expo-auth-session` / `expo-web-browser` (o barrel do auth-session importa `expo-web-browser`).
 */
export async function signInWithOAuthProvider(
  provider: 'google' | 'apple'
): Promise<{ success: boolean; error?: string }> {
  try {
    const redirectTo = makeOAuthRedirectUri('take-me-cliente');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) return { success: false, error: getUserErrorMessage(error, 'Não foi possível concluir o login.') };
    if (!data?.url) return { success: false, error: 'URL de login não retornada.' };

    const waitPromise = waitForOAuthReturn(redirectTo, 180_000);
    try {
      await Linking.openURL(data.url);
    } catch {
      return { success: false, error: 'Não foi possível abrir o login no navegador.' };
    }

    const returnUrl = await waitPromise;
    if (!returnUrl) {
      return { success: false, error: 'Login cancelado ou tempo esgotado.' };
    }

    const session = await createSessionFromUrl(returnUrl);
    if (!session) {
      return { success: false, error: 'Não recebemos os tokens de sessão. Tente de novo.' };
    }
    return { success: true };
  } catch (e) {
    const message = getUserErrorMessage(e, 'Erro ao entrar com o provedor.');
    return { success: false, error: message };
  }
}
