import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { getUserErrorMessage } from '../utils/errorMessage';

/**
 * Completa a sessão do Supabase a partir da URL de redirect do OAuth.
 * Usado após o usuário voltar do navegador (Google/Apple).
 */
export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
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

/**
 * Inicia o fluxo OAuth com o provedor (google | apple), abre o navegador
 * e, ao retornar, define a sessão no Supabase.
 * @returns true se o login foi concluído com sucesso
 */
export async function signInWithOAuthProvider(
  provider: 'google' | 'apple'
): Promise<{ success: boolean; error?: string }> {
  try {
    WebBrowser.maybeCompleteAuthSession();
    const redirectTo = makeRedirectUri({ scheme: 'take-me-cliente' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) return { success: false, error: getUserErrorMessage(error, 'Não foi possível concluir o login.') };
    if (!data?.url) return { success: false, error: 'URL de login não retornada.' };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (res.type === 'success' && res.url) {
      await createSessionFromUrl(res.url);
      return { success: true };
    }
    if (res.type === 'cancel') {
      return { success: false, error: 'Login cancelado.' };
    }
    return { success: false, error: 'Não foi possível concluir o login.' };
  } catch (e) {
    const message = getUserErrorMessage(e, 'Erro ao entrar com o provedor.');
    return { success: false, error: message };
  }
}
