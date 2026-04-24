import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RegistrationType } from '../navigation/types';

/**
 * Estado leve para o fluxo de cadastro em 3 etapas.
 *
 * Desde a refatoração "Onboarding Motorista 3 Etapas", a conta no Auth é criada
 * logo após o PIN (Etapa 1), então credenciais passam a viver na sessão do Supabase.
 * Este contexto agora serve apenas para lembrar o `driverType` entre as telas
 * `SignUp → VerifyEmail → CompleteDriverRegistration → FinalizeRegistration → StripeConnectSetup`.
 */
type DeferredState = {
  driverType: RegistrationType | null;
};

const initial: DeferredState = { driverType: null };

type ContextValue = DeferredState & {
  setDriverType: (driverType: RegistrationType) => void;
  clearDeferred: () => void;
  isReady: boolean;
};

const DeferredDriverSignupContext = createContext<ContextValue | null>(null);

export function DeferredDriverSignupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeferredState>(initial);

  const setDriverType = useCallback((driverType: RegistrationType) => {
    setState({ driverType });
  }, []);

  const clearDeferred = useCallback(() => {
    setState(initial);
  }, []);

  const value = useMemo<ContextValue>(() => ({
    driverType: state.driverType,
    setDriverType,
    clearDeferred,
    isReady: Boolean(state.driverType),
  }), [state.driverType, setDriverType, clearDeferred]);

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
