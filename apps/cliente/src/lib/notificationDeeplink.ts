import { CommonActions } from '@react-navigation/native';
import type {
  NavigationContainerRef,
  NavigationProp,
} from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';

/**
 * Payload de deeplink vinculado a cada notificação (`public.notifications.data`).
 * Formato livre JSON; por convenção usamos `{ route, params }` apontando para
 * uma rota do `RootStackParamList`. Rotas dentro de tabs (ex.: `Activities →
 * TripDetail`) são aninhadas via `navigate({ name, params: { screen, params } })`.
 */
export type NotificationDeeplink = {
  route: string;
  params?: Record<string, unknown> | null;
};

type NavRef = React.RefObject<NavigationContainerRef<RootStackParamList> | null>;

/**
 * Normaliza o payload (vindo de FCM `data` string-map ou de `notifications.data`
 * JSONB) para `{ route, params }`. Retorna `null` quando não há destino válido.
 */
export function parseNotificationDeeplink(
  raw: unknown,
): NotificationDeeplink | null {
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;
  const route = typeof obj.route === 'string' ? obj.route.trim() : '';
  if (!route) return null;

  let params: Record<string, unknown> | null = null;
  if (obj.params && typeof obj.params === 'object') {
    params = obj.params as Record<string, unknown>;
  } else if (typeof obj.params === 'string') {
    try {
      const parsed = JSON.parse(obj.params);
      if (parsed && typeof parsed === 'object') {
        params = parsed as Record<string, unknown>;
      }
    } catch {
      /* params não era JSON válido; ignora. */
    }
  }

  return { route, params };
}

/** Rotas do Root Stack — navegação direta. */
const ROOT_ROUTES: ReadonlyArray<keyof RootStackParamList> = [
  'Main',
  'Welcome',
  'Splash',
  'Login',
  'SignUp',
  'TripStack',
  'ShipmentStack',
  'DependentShipmentStack',
  'ExcursionStack',
  'AddPaymentMethod',
  'AddCard',
  'TermsOfUse',
  'PrivacyPolicy',
];

/** Telas dentro da tab `Activities` (lista + detalhes + acompanhamento). */
const ACTIVITIES_ROUTES: ReadonlySet<string> = new Set([
  'ActivitiesList',
  'TravelHistory',
  'TripDetail',
  'ShipmentDetail',
  'ShipmentTip',
  'ShipmentRating',
  'ExcursionDetail',
  'ExcursionBudget',
  'ExcursionPassengerList',
  'ExcursionPassengerForm',
  'DependentShipmentDetail',
  'DriverOnTheWay',
  'TripInProgress',
]);

/** Telas dentro da tab `Profile`. */
const PROFILE_ROUTES: ReadonlySet<string> = new Set([
  'ProfileMain',
  'PersonalInfo',
  'Wallet',
  'About',
  'Notifications',
  'ConfigureNotifications',
  'Dependents',
  'DependentDetail',
  'Conversations',
]);

type Dispatcher = {
  dispatch: (
    action: Parameters<NonNullable<NavigationContainerRef<RootStackParamList>['dispatch']>>[0],
  ) => void;
};

function resolveDispatcher(
  target: NavRef | NavigationProp<RootStackParamList> | Dispatcher | null | undefined,
): Dispatcher | null {
  if (!target) return null;
  if ('current' in target) return target.current ?? null;
  if ('dispatch' in target) return target as Dispatcher;
  return null;
}

/**
 * Navega para o destino descrito pelo deeplink.
 *
 * - Root: `navigate(route, params)`.
 * - Activities/Profile: aninha via `navigate('Main', { screen: 'Activities' |
 *   'Profile', params: { screen: route, params } })`.
 * - `Chat` fica em Activities e Profile — prioriza Activities (contexto comum
 *   no push de mensagem vinda de uma reserva/envio).
 * - Falhas são silenciadas para não derrubar o app ao abrir via push.
 */
export function applyNotificationDeeplink(
  navigationTarget:
    | NavRef
    | NavigationProp<RootStackParamList>
    | Dispatcher
    | null
    | undefined,
  link: NotificationDeeplink,
): boolean {
  const nav = resolveDispatcher(navigationTarget);
  if (!nav || !link.route) return false;

  const { route, params } = link;

  try {
    if ((ROOT_ROUTES as readonly string[]).includes(route)) {
      nav.dispatch(
        CommonActions.navigate({
          name: route,
          params: params ?? undefined,
        }),
      );
      return true;
    }

    if (ACTIVITIES_ROUTES.has(route) || route === 'Chat') {
      nav.dispatch(
        CommonActions.navigate({
          name: 'Main',
          params: {
            screen: 'Activities',
            params: {
              screen: route,
              params: params ?? undefined,
            },
          },
        }),
      );
      return true;
    }

    if (PROFILE_ROUTES.has(route)) {
      nav.dispatch(
        CommonActions.navigate({
          name: 'Main',
          params: {
            screen: 'Profile',
            params: {
              screen: route,
              params: params ?? undefined,
            },
          },
        }),
      );
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
