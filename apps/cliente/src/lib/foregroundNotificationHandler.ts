import { Platform } from 'react-native';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/**
 * Exibe notificações do sistema quando o app cliente está em foreground.
 *
 * Problema: o FCM SDK só auto-exibe o payload `notification: { title, body }`
 * quando o app está em background/killed. Em foreground, `onMessage` é
 * chamado mas nada é mostrado — cabe ao app renderizar.
 *
 * Solução: replicar o payload via Notifee (react-native-notify-kit), que
 * cria uma notificação local idêntica à do system tray (heads-up no
 * Android via channel HIGH, banner no iOS).
 *
 * Os módulos nativos `react-native-notify-kit` e `@react-native-firebase/messaging`
 * são carregados de forma defensiva para o app bootar mesmo quando o iOS/Android
 * ainda não rodou `pod install` / rebuild nativo após a adição destes pacotes.
 */

const ANDROID_CHANNEL_ID = 'cliente-default';
const ANDROID_CHANNEL_NAME = 'Notificações Take Me';

type TapHandler = (
  data: Record<string, string | object> | undefined,
) => void;

type NotifeeModule = {
  default: {
    createChannel: (config: Record<string, unknown>) => Promise<unknown>;
    displayNotification: (config: Record<string, unknown>) => Promise<unknown>;
    onForegroundEvent: (
      cb: (event: { type: number; detail: { notification?: { data?: Record<string, string | object> } } }) => void,
    ) => () => void;
  };
  AndroidImportance: { HIGH: number };
  EventType: { PRESS: number };
};

function loadNotifee(): NotifeeModule | null {
  try {
    const mod = require('react-native-notify-kit') as NotifeeModule;
    if (!mod?.default) return null;
    return mod;
  } catch {
    return null;
  }
}

async function ensureAndroidChannel(nf: NotifeeModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await nf.default.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: ANDROID_CHANNEL_NAME,
    importance: nf.AndroidImportance.HIGH,
    sound: 'default',
  });
}

async function displayFromRemote(
  nf: NotifeeModule,
  msg: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const d = (msg.data ?? {}) as Record<string, string>;
  let title = msg.notification?.title ?? '';
  let body = msg.notification?.body ?? '';

  if ((!title || !body) && d.display_title) {
    title = String(d.display_title);
    body = String(d.display_body ?? '');
  }

  if (!title && !body) return;

  const tag = typeof d.fcm_android_tag === 'string' ? d.fcm_android_tag : undefined;
  /** Mesmo id/tag substituem a notificação anterior (ETA atualizável alinhada ao PDF). */
  const stableId = tag;

  await nf.default.displayNotification({
    ...(stableId ? { id: stableId } : {}),
    title,
    body,
    data: msg.data as Record<string, string>,
    android: {
      channelId: ANDROID_CHANNEL_ID,
      ...(tag ? { tag } : {}),
      pressAction: { id: 'default' },
      sound: 'default',
    },
    ios: { sound: 'default' },
  });
}

/**
 * Registra `messaging().onMessage` para exibir pushes em foreground e
 * `notifee.onForegroundEvent` para propagar o toque (PRESS) ao callback
 * opcional. Retorna unsubscribe que deve ser chamado no cleanup do
 * useEffect. Sem o módulo nativo do Notifee, o app segue rodando sem
 * foreground push (em vez de travar no `TurboModuleRegistry.getEnforcing`).
 */
export async function registerClienteForegroundNotifications(
  onTap?: TapHandler,
): Promise<() => void> {
  const nf = loadNotifee();
  if (nf) {
    try {
      await ensureAndroidChannel(nf);
    } catch {
      /* canal já existente ou módulo indisponível. */
    }
  }

  let unsubMessaging: (() => void) | null = null;
  try {
    const { default: messaging } = await import(
      '@react-native-firebase/messaging'
    );
    unsubMessaging = messaging().onMessage((msg) => {
      if (nf) void displayFromRemote(nf, msg);
    });
  } catch {
    /* Web ou bundle sem módulo nativo. */
  }

  let unsubForeground: (() => void) | null = null;
  if (nf && onTap) {
    try {
      unsubForeground = nf.default.onForegroundEvent(({ type, detail }) => {
        if (type === nf.EventType.PRESS) {
          onTap(detail.notification?.data);
        }
      });
    } catch {
      unsubForeground = null;
    }
  }

  return () => {
    unsubMessaging?.();
    unsubForeground?.();
  };
}

/**
 * Data-only / segundo plano: exibe no tray com o mesmo `id`/`tag` que o FCM
 * (substitui ETA). Usado pelo `setBackgroundMessageHandler` em `index.ts`.
 */
export async function displayClienteRemoteMessage(
  msg: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const nf = loadNotifee();
  if (!nf) return;
  try {
    await ensureAndroidChannel(nf);
  } catch {
    /* canal indisponível */
  }
  await displayFromRemote(nf, msg);
}
