import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { supabase } from '../lib/supabase';

function getCurrentUrl(): string | null {
  if (typeof window !== 'undefined' && window.location?.href) return window.location.href;
  return null;
}

function parseAuthParamsFromUrl(url: string): { access_token?: string; refresh_token?: string; type?: string } {
  try {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');
    const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
    const query = queryIndex >= 0 ? url.slice(queryIndex + 1).split('#')[0] : '';
    const params = new URLSearchParams(fragment || query);
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
  if (typeof window !== 'undefined' && window.history?.replaceState)
    window.history.replaceState(null, '', window.location.pathname || '/');
}

async function handleRecoveryUrl(
  url: string,
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>
): Promise<boolean> {
  const { access_token, refresh_token, type } = parseAuthParamsFromUrl(url);
  if (access_token) {
    try {
      await supabase.auth.setSession({ access_token, refresh_token: refresh_token ?? '' });
      clearAuthParamsFromUrl();
    } catch {
      return false;
    }
  }
  if (type !== 'recovery') return Boolean(access_token);
  const nav = navigationRef.current;
  if (nav) nav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'ResetPassword' }] }));
  return true;
}

const SAME_LINK_DEBOUNCE_MS = 2000;

export function AuthRecoveryHandler({
  navigationRef,
}: {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
}) {
  const lastHandledUrl = useRef<string | null>(null);
  const lastHandledTime = useRef<number>(0);

  useEffect(() => {
    const run = async (url: string | null) => {
      if (!url || !url.includes('access_token')) return;
      const now = Date.now();
      if (lastHandledUrl.current === url && now - lastHandledTime.current < SAME_LINK_DEBOUNCE_MS) return;
      const didHandle = await handleRecoveryUrl(url, navigationRef);
      if (didHandle) {
        lastHandledUrl.current = url;
        lastHandledTime.current = now;
      }
    };
    if (Platform.OS === 'web') run(getCurrentUrl());
    else {
      Linking.getInitialURL().then(run);
      const sub = Linking.addEventListener('url', ({ url }) => run(url));
      return () => sub.remove();
    }
  }, [navigationRef]);

  return null;
}
