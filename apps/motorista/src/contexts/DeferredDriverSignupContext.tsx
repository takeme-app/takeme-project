import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { DriverType } from '../navigation/types';

/**
 * Mantém e-mail, senha e tipo de motorista até "Enviar cadastro".
 * Token HMAC (pós-OTP) é opcional — legado / futuro.
 * A conta no Auth é criada na FinalizeRegistration (signUp), sem Edge Function.
 */
type DeferredState = {
  /** Opcional: só se no futuro voltar OTP ou outro pré-registro. */
  verificationToken: string | null;
  email: string | null;
  password: string | null;
  driverType: DriverType | null;
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
    driverType: DriverType;
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
    driverType: DriverType;
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
