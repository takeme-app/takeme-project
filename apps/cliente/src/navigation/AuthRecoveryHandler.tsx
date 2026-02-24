import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
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

type Props = {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
};

export function AuthRecoveryHandler({ navigationRef }: Props) {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const url = Platform.OS === 'web' ? getCurrentUrl() : null;
    if (!url) return;

    const { access_token, refresh_token, type } = parseAuthParamsFromUrl(url);
    if (type !== 'recovery' || !access_token) return;

    handled.current = true;

    (async () => {
      try {
        await supabase.auth.setSession({ access_token, refresh_token: refresh_token ?? '' });
        clearAuthParamsFromUrl();
        navigationRef.current?.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'ResetPassword' }],
          })
        );
      } catch {
        handled.current = false;
      }
    })();
  }, [navigationRef]);

  return null;
}
