/**
 * Sticky notification "Motorista está a X minutos" — atualizada pelo próprio app
 * do cliente enquanto observa a posição do motorista em tempo real.
 *
 * Funciona apenas em Android, onde o Notifee cria uma notificação ongoing
 * (sticky) no canal `cliente-live` (IMPORTANCE LOW para não fazer heads-up
 * em cada update). Em iOS, por decisão de produto (sem Live Activity nesta
 * fase), o push inicial do FCM já basta — este módulo vira um no-op.
 *
 * Fluxo:
 *   - Cliente abre `DriverOnTheWayScreen`.
 *   - `startDriverEtaSticky` é chamado com bookingId e origem (pickup).
 *   - Internamente, ele recebe updates de posição via callback e
 *     agenda `displayNotification` com o mesmo notificationId, substituindo
 *     a anterior a cada ~45s OU quando os minutos de ETA mudam.
 *   - Ao desmontar a tela (ou quando o motorista chega), chamamos
 *     `stopDriverEtaSticky` para cancelar.
 *
 * Isolado aqui (sem hooks/React) para permitir uso em foreground/background
 * e facilitar futura migração para um foreground service dedicado.
 */

import { Platform } from 'react-native';
import { ANDROID_LIVE_CHANNEL_ID } from './foregroundNotificationHandler';

type DisplayConfig = Record<string, unknown>;

type NotifeeModule = {
  default: {
    displayNotification: (config: DisplayConfig) => Promise<unknown>;
    cancelNotification: (id: string) => Promise<unknown>;
  };
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

/** Intervalo mínimo entre updates da notificação sticky (ms). */
const MIN_UPDATE_INTERVAL_MS = 45_000;

export type DriverEtaStickyOptions = {
  /** Usado para formar um id estável: evita múltiplas notificações por reserva. */
  bookingId: string;
  /** Mensagem do push (passada no `data.route`) quando o usuário tocar. */
  deeplink?: { route: string; params?: Record<string, unknown> | null };
};

export type DriverEtaStickyState = {
  update: (args: { etaMinutes: number | null }) => Promise<void>;
  stop: () => Promise<void>;
};

function notificationId(bookingId: string): string {
  return `driver-eta-${bookingId}`;
}

function formatMinutesLine(etaMinutes: number | null): string {
  if (etaMinutes == null || !Number.isFinite(etaMinutes) || etaMinutes <= 0) {
    return 'Motorista a caminho. Acompanhe no app.';
  }
  const mins = Math.max(1, Math.round(etaMinutes));
  const suffix = mins === 1 ? 'minuto' : 'minutos';
  return `Motorista está a ${mins} ${suffix}.`;
}

/**
 * Inicia a notificação sticky. Em iOS retorna stubs que apenas marcam estado,
 * sem exibir nada — o push inicial do FCM "Motorista a caminho" já cumpre o
 * papel até o cliente abrir o app.
 */
export function startDriverEtaSticky(
  options: DriverEtaStickyOptions,
): DriverEtaStickyState {
  const id = notificationId(options.bookingId);
  if (Platform.OS !== 'android') {
    return {
      update: async () => {},
      stop: async () => {},
    };
  }

  const nf = loadNotifee();
  if (!nf) {
    return {
      update: async () => {},
      stop: async () => {},
    };
  }

  let lastDisplayTs = 0;
  let lastMinutes: number | null = null;
  let stopped = false;

  const display = async (etaMinutes: number | null): Promise<void> => {
    if (stopped) return;
    try {
      await nf.default.displayNotification({
        id,
        title: 'Motorista a caminho',
        body: formatMinutesLine(etaMinutes),
        data: options.deeplink
          ? {
              route: options.deeplink.route,
              params: JSON.stringify(options.deeplink.params ?? {}),
            }
          : undefined,
        android: {
          channelId: ANDROID_LIVE_CHANNEL_ID,
          ongoing: true,
          onlyAlertOnce: true,
          pressAction: { id: 'default' },
          showTimestamp: false,
        },
      });
      lastDisplayTs = Date.now();
      lastMinutes = etaMinutes;
    } catch {
      /* Notifee indisponível momentaneamente; ignora este tick. */
    }
  };

  // Primeiro render: "Motorista a caminho" sem ETA ainda resolvido.
  void display(null);

  return {
    update: async ({ etaMinutes }) => {
      if (stopped) return;
      const minutesChanged =
        lastMinutes == null ||
        etaMinutes == null ||
        Math.round(lastMinutes) !== Math.round(etaMinutes);
      const tooSoon = Date.now() - lastDisplayTs < MIN_UPDATE_INTERVAL_MS;
      if (!minutesChanged && tooSoon) return;
      await display(etaMinutes);
    },
    stop: async () => {
      if (stopped) return;
      stopped = true;
      try {
        await nf.default.cancelNotification(id);
      } catch {
        /* ignora erros ao cancelar (notificação já ausente). */
      }
    },
  };
}
