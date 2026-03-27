import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { RegistrationType } from '../navigation/types';

/**
 * Mantém e-mail, senha e tipo de cadastro até "Enviar cadastro".
 * Usado por motoristas e preparadores (todos os 4 tipos).
 */
type DeferredState = {
  verificationToken: string | null;
  email: string | null;
  password: string | null;
  driverType: RegistrationType | null;
};

const initial: DeferredState = {
  verificationToken: null,
  email: null,
  password: null,
  driverType: null,
};

type ContextValue = DeferredState & {
  setDeferred: (p: {
    email: string;
    password: string;
    driverType: RegistrationType;
    verificationToken?: string | null;
  }) => void;
  clearDeferred: () => void;
  isReady: boolean;
};

const DeferredDriverSignupContext = createContext<ContextValue | null>(null);

export function DeferredDriverSignupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeferredState>(initial);

  const setDeferred = useCallback((p: {
    email: string;
    password: string;
    driverType: RegistrationType;
    verificationToken?: string | null;
  }) => {
    setState({
      verificationToken: p.verificationToken ?? null,
      email: p.email.trim().toLowerCase(),
      password: p.password,
      driverType: p.driverType,
    });
  }, []);

  const clearDeferred = useCallback(() => {
    setState(initial);
  }, []);

  const isReady = Boolean(state.email && state.password && state.driverType);

  const value: ContextValue = {
    ...state,
    setDeferred,
    clearDeferred,
    isReady,
  };

  return (
    <DeferredDriverSignupContext.Provider value={value}>
      {children}
    </DeferredDriverSignupContext.Provider>
  );
}

export function useDeferredDriverSignup() {
  const ctx = useContext(DeferredDriverSignupContext);
  if (!ctx) throw new Error('useDeferredDriverSignup must be used within DeferredDriverSignupProvider');
  return ctx;
}
