import { createContext, useContext, useCallback } from 'react';
import { CommonActions } from '@react-navigation/native';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList, ShipmentStackParamList, DependentShipmentStackParamList, ExcursionStackParamList } from './types';

type ShipmentScreenName = keyof ShipmentStackParamList;
type DependentShipmentScreenName = keyof DependentShipmentStackParamList;
type ExcursionScreenName = keyof ExcursionStackParamList;

type RootNavigationContextValue = {
  /**
   * Abas do app principal (`Main` no stack raiz). Usa `navigationRef` — funciona de dentro de qualquer stack
   * (Perfil, TripStack, DependentShipmentStack, etc.), onde `getParent()` nem sempre chega ao Tab Navigator.
   */
  navigateToMainTab: (screen: 'Home' | 'Services' | 'Activities' | 'Profile') => void;
  /** Navega para o TripStack (stack irmão de Main). Usar na Home e em qualquer tela dentro de Main. */
  navigateToTripStack: (screen: 'SearchTrip' | 'PlanRide' | 'PlanTrip', params?: object) => void;
  /** Navega para o ShipmentStack (fluxo Envios na guia Serviços). */
  navigateToShipmentStack: <K extends ShipmentScreenName>(
    screen: K,
    params?: ShipmentStackParamList[K]
  ) => void;
  /** Navega para o DependentShipmentStack (fluxo Envio de dependentes). */
  navigateToDependentShipmentStack: <K extends DependentShipmentScreenName>(
    screen: K,
    params?: DependentShipmentStackParamList[K]
  ) => void;
  /** Navega para o ExcursionStack (fluxo Excursões). */
  navigateToExcursionStack: <K extends ExcursionScreenName>(
    screen: K,
    params?: ExcursionStackParamList[K]
  ) => void;
  /** Reseta toda a navegação para a Splash (usado após exclusão de conta / logout forçado). */
  resetToSplash: () => void;
};

const RootNavigationContext = createContext<RootNavigationContextValue | null>(null);

export function useRootNavigation(): RootNavigationContextValue {
  const ctx = useContext(RootNavigationContext);
  if (!ctx) {
    throw new Error('useRootNavigation must be used inside RootNavigationProvider');
  }
  return ctx;
}

export function RootNavigationProvider({
  navigationRef,
  children,
}: {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
  children: React.ReactNode;
}) {
  const navigateToMainTab = useCallback(
    (screen: 'Home' | 'Services' | 'Activities' | 'Profile') => {
      const nav = navigationRef.current;
      if (!nav) return;
      nav.dispatch(
        CommonActions.navigate({
          name: 'Main',
          params: { screen },
        }),
      );
    },
    [navigationRef],
  );

  const navigateToTripStack = useCallback(
    (screen: 'SearchTrip' | 'PlanRide' | 'PlanTrip', params?: object) => {
      const nav = navigationRef.current;
      if (nav) {
        nav.dispatch(
          CommonActions.navigate({
            name: 'TripStack',
            params: {
              screen,
              params: params ?? undefined,
            },
          })
        );
      }
    },
    [navigationRef]
  );

  const navigateToShipmentStack = useCallback(
    <K extends ShipmentScreenName>(screen: K, params?: ShipmentStackParamList[K]) => {
      const nav = navigationRef.current;
      if (nav) {
        nav.dispatch(
          CommonActions.navigate({
            name: 'ShipmentStack',
            params: {
              screen,
              params: params ?? undefined,
            },
          })
        );
      }
    },
    [navigationRef]
  );

  const navigateToDependentShipmentStack = useCallback(
    <K extends DependentShipmentScreenName>(screen: K, params?: DependentShipmentStackParamList[K]) => {
      const nav = navigationRef.current;
      if (nav) {
        nav.dispatch(
          CommonActions.navigate({
            name: 'DependentShipmentStack',
            params: {
              screen,
              params: params ?? undefined,
            },
          })
        );
      }
    },
    [navigationRef]
  );

  const navigateToExcursionStack = useCallback(
    <K extends ExcursionScreenName>(screen: K, params?: ExcursionStackParamList[K]) => {
      const nav = navigationRef.current;
      if (nav) {
        nav.dispatch(
          CommonActions.navigate({
            name: 'ExcursionStack',
            params: {
              screen,
              params: params ?? undefined,
            },
          })
        );
      }
    },
    [navigationRef]
  );

  const resetToSplash = useCallback(() => {
    const nav = navigationRef.current;
    if (nav) {
      nav.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Splash' }] })
      );
    }
  }, [navigationRef]);

  return (
    <RootNavigationContext.Provider
      value={{
        navigateToMainTab,
        navigateToTripStack,
        navigateToShipmentStack,
        navigateToDependentShipmentStack,
        navigateToExcursionStack,
        resetToSplash,
      }}
    >
      {children}
    </RootNavigationContext.Provider>
  );
}
