import { createContext, useCallback, useContext } from 'react';
import { CommonActions } from '@react-navigation/native';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

type RootNavigationContextValue = {
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
  const resetToSplash = useCallback(() => {
    const nav = navigationRef.current;
    if (nav) {
      nav.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Splash' }] })
      );
    }
  }, [navigationRef]);

  return (
    <RootNavigationContext.Provider value={{ resetToSplash }}>
      {children}
    </RootNavigationContext.Provider>
  );
}
