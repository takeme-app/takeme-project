import { useEffect } from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import {
  applyNotificationDeeplink,
  parseNotificationDeeplink,
} from '../lib/notificationDeeplink';

type NavRef = React.RefObject<NavigationContainerRef<RootStackParamList> | null>;

/**
 * Registra listeners do Firebase Messaging e encaminha o payload para o
 * resolvedor de deeplink (`applyNotificationDeeplink`).
 *
 * - `onNotificationOpenedApp`: app em background/foreground → usuário tocou na push.
 * - `getInitialNotification`: app estava fechado e foi aberto pela push.
 * - `onMessage`: foreground — neste ponto não navegamos automaticamente (o
 *   usuário ainda está vendo outra tela); apenas deixamos a entrada cair no
 *   inbox via Realtime. Reservado para futuras UX (toast/banner).
 *
 * Sem-op em Web/bundles sem o módulo nativo.
 */
export function NotificationDeeplinkHandler({ navigationRef }: { navigationRef: NavRef }) {
  useEffect(() => {
    let unsubOpened: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { default: messaging } = await import('@react-native-firebase/messaging');

        const initial = await messaging().getInitialNotification();
        if (!cancelled && initial?.data) {
          const link = parseNotificationDeeplink(initial.data);
          if (link) {
            // Pequeno delay para aguardar NavigationContainer pronto.
            setTimeout(() => applyNotificationDeeplink(navigationRef, link), 250);
          }
        }

        unsubOpened = messaging().onNotificationOpenedApp((msg) => {
          const link = parseNotificationDeeplink(msg?.data);
          if (link) applyNotificationDeeplink(navigationRef, link);
        });
      } catch {
        /* Web ou bundle sem módulo nativo: sem-op. */
      }
    })();

    return () => {
      cancelled = true;
      unsubOpened?.();
    };
  }, [navigationRef]);

  return null;
}
