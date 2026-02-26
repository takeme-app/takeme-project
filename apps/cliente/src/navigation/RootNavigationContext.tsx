import { createContext, useContext, useCallback } from 'react';
import { CommonActions } from '@react-navigation/native';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

type RootNavigationContextValue = {
  /** Navega para o TripStack (stack irmão de Main). Usar na Home e em qualquer tela dentro de Main. */
  navigateToTripStack: (screen: 'SearchTrip' | 'PlanRide' | 'PlanTrip', params?: object) => void;
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
  const navigateToTripStack = useCallback(
    (screen: 'SearchTrip' | 'PlanRide', params?: object) => {
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

  return (
    <RootNavigationContext.Provider value={{ navigateToTripStack }}>
      {children}
    </RootNavigationContext.Provider>
  );
}
