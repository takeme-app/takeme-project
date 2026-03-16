import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { supabase } from '../lib/supabase';

function getCurrentUrl(): string | null {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }
  return null;
}

function parseAuthParamsFromUrl(url: string): { access_token?: string; refresh_token?: string; type?: string } {
  try {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
    const query = queryIndex >= 0 ? url.slice(queryIndex + 1).split('#')[0] : '';
    const combined = fragment || query;
    if (!combined) return {};
    const params = new URLSearchParams(combined);
    return {
      access_token: params.get('access_token') ?? undefined,
      refresh_token: params.get('refresh_token') ?? undefined,
      type: params.get('type') ?? undefined,
    };
  } catch {
    return {};
  }
}

function clearAuthParamsFromUrl(): void {
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    window.history.replaceState(null, '', window.location.pathname || '/');
  }
}

const RESET_PASSWORD_PATH = 'reset-password';

function isResetPasswordDeepLink(url: string): boolean {
  return url.includes(RESET_PASSWORD_PATH) || url.includes('reset-password');
}

function waitForNavigatorReady(
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>,
  maxMs: number = 3000
): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const nav = navigationRef.current;
      if (nav && typeof (nav as any).isReady === 'function' && (nav as any).isReady()) {
        resolve();
        return;
      }
      if (Date.now() - start >= maxMs) {
        resolve();
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

async function handleRecoveryUrl(
  url: string,
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>
): Promise<boolean> {
  const { access_token, refresh_token, type } = parseAuthParamsFromUrl(url);
  const hasTokens = Boolean(access_token);

  if (hasTokens) {
    try {
      await supabase.auth.setSession({ access_token, refresh_token: refresh_token ?? '' });
      clearAuthParamsFromUrl();
    } catch {
      return false;
    }
  }

  if (type !== 'recovery') {
    return hasTokens;
  }

  await waitForNavigatorReady(navigationRef);
  const nav = navigationRef.current;
  if (!nav) return hasTokens;

  nav.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'ResetPassword' }],
    })
  );
  return true;
}

type Props = {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
};

const SAME_LINK_DEBOUNCE_MS = 2000;

export function AuthRecoveryHandler({ navigationRef }: Props) {
  const lastHandledUrl = useRef<string | null>(null);
  const lastHandledTime = useRef<number>(0);

  useEffect(() => {
    const run = async (url: string | null) => {
      if (!url) return;
      const isRecovery = url.includes('access_token') || isResetPasswordDeepLink(url);
      if (!isRecovery) return;
      const now = Date.now();
      if (
        lastHandledUrl.current === url &&
        now - lastHandledTime.current < SAME_LINK_DEBOUNCE_MS
      ) {
        return;
      }
      const didHandle = await handleRecoveryUrl(url, navigationRef);
      if (didHandle) {
        lastHandledUrl.current = url;
        lastHandledTime.current = now;
      }
    };

    if (Platform.OS === 'web') {
      const url = getCurrentUrl();
      run(url);
      return;
    }

    Linking.getInitialURL().then(run);
    const sub = Linking.addEventListener('url', ({ url }) => run(url));
    return () => sub.remove();
  }, [navigationRef]);

  return null;
}
