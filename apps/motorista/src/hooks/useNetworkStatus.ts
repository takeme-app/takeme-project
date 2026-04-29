import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * `expo-network` é nativo: import defensivo para evitar quebrar Jest/web e
 * builds sem rebuild ainda (módulo ausente). Cai para "online assumido" quando
 * indisponível.
 */
let Network: { getNetworkStateAsync: () => Promise<{ isInternetReachable?: boolean | null; isConnected?: boolean | null }> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Network = require('expo-network');
} catch {
  Network = null;
}

const DEFAULT_POLL_MS = 15_000;

export type NetworkStatus = {
  online: boolean;
  /** true até a primeira leitura concluir (para evitar flash de "offline"). */
  loading: boolean;
};

/**
 * Hook simples e barato: faz polling do `expo-network` e revalida quando o app
 * volta para foreground. Não usa NetInfo para não puxar nova dependência.
 *
 * `online = isInternetReachable !== false && isConnected !== false`
 *  - `isInternetReachable` em iOS pode vir `null` por algum tempo; tratamos
 *    `null/undefined` como "não bloqueia" (assume online se há conexão).
 */
export function useNetworkStatus(pollMs: number = DEFAULT_POLL_MS): NetworkStatus {
  const [online, setOnline] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      if (!Network) {
        if (isMounted.current) {
          setOnline(true);
          setLoading(false);
        }
        return;
      }
      try {
        const state = await Network.getNetworkStateAsync();
        const reachable = state?.isInternetReachable;
        const connected = state?.isConnected;
        const next = reachable !== false && connected !== false;
        if (isMounted.current) {
          setOnline(next);
          setLoading(false);
        }
      } catch {
        if (isMounted.current) {
          setOnline(true);
          setLoading(false);
        }
      }
    };

    check();
    if (pollMs > 0) {
      timer = setInterval(check, pollMs);
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      isMounted.current = false;
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [pollMs]);

  return { online, loading };
}
