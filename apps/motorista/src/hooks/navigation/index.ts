/**
 * Hooks de navegação extraídos do `ActiveTripScreen` / `ActiveShipmentScreen`.
 *
 * São o passo intermediário entre a navegação caseira (JS, hoje) e o
 * Mapbox Navigation SDK nativo (`packages/expo-mapbox-navigation`, em
 * desenvolvimento gateado por feature flag).
 *
 * Quando a feature flag `EXPO_PUBLIC_USE_NATIVE_NAVIGATION` for ligada e o
 * SDK nativo passar pela QA matrix, estes hooks podem ser removidos junto
 * com `lib/navigationCamera.ts` e `lib/routeSnap.ts`.
 */

export { useDriverFix } from './useDriverFix';
export type { DriverFixHookResult, DriverFixOptions } from './useDriverFix';

export { useNavigationCamera } from './useNavigationCamera';
export type {
  UseNavigationCameraOptions,
  UseNavigationCameraResult,
} from './useNavigationCamera';

export { useRerouteController } from './useRerouteController';
export type {
  RerouteControllerOptions,
  RerouteControllerResult,
} from './useRerouteController';

export { useTripRoute } from './useTripRoute';
export type {
  UseTripRouteOptions,
  UseTripRouteResult,
} from './useTripRoute';
