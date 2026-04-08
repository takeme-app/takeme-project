import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { DriverType } from '../navigation/types';

export type RouteFormEntry = {
  id: string;
  origin: string;
  destination: string;
  /** Valor mascarado pt-BR (ex.: "50,00") sem prefixo R$. */
  suggestedPrice: string;
  originResolved?: boolean;
  destinationResolved?: boolean;
};

export type RegistrationFormData = {
  driverType: DriverType;
  fullName: string;
  cpf: string;
  age: string;
  city: string;
  preferenceArea: string;
  experienceYears: string;
  bankCode: string;
  agencyNumber: string;
  accountNumber: string;
  pixKey: string;
  ownsVehicle: boolean;
  vehicleYear: string;
  vehicleModel: string;
  licensePlate: string;
  vehiclePhone: string;
  passengerCapacity: string;
  routes: RouteFormEntry[];
  acceptedTerms: boolean;
  acceptedNotifications: boolean;
  willPresentCriminalRecord: boolean;
  cnhFrontUri: string | null;
  cnhBackUri: string | null;
  criminalRecordUri: string | null;
  vehicleDocUri: string | null;
  vehiclePhotosUris: string[];
};

function newRoute(): RouteFormEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    origin: '',
    destination: '',
    suggestedPrice: '',
  };
}

const defaultFormData: RegistrationFormData = {
  driverType: 'take_me',
  fullName: '',
  cpf: '',
  age: '',
  city: '',
  preferenceArea: '',
  experienceYears: '',
  bankCode: '',
  agencyNumber: '',
  accountNumber: '',
  pixKey: '',
  ownsVehicle: true,
  vehicleYear: '',
  vehicleModel: '',
  licensePlate: '',
  vehiclePhone: '',
  passengerCapacity: '',
  routes: [newRoute()],
  acceptedTerms: false,
  acceptedNotifications: false,
  willPresentCriminalRecord: false,
  cnhFrontUri: null,
  cnhBackUri: null,
  criminalRecordUri: null,
  vehicleDocUri: null,
  vehiclePhotosUris: [],
};

type ContextValue = {
  formData: RegistrationFormData | null;
  setFormData: (data: RegistrationFormData) => void;
  clearFormData: () => void;
};

const RegistrationFormContext = createContext<ContextValue | null>(null);

export function RegistrationFormProvider({ children }: { children: ReactNode }) {
  const [formData, setFormDataState] = useState<RegistrationFormData | null>(null);
  const setFormData = useCallback((data: RegistrationFormData) => {
    setFormDataState(data);
  }, []);
  const clearFormData = useCallback(() => {
    setFormDataState(null);
  }, []);
  return (
    <RegistrationFormContext.Provider value={{ formData, setFormData, clearFormData }}>
      {children}
    </RegistrationFormContext.Provider>
  );
}

export function useRegistrationForm() {
  const ctx = useContext(RegistrationFormContext);
  if (!ctx) throw new Error('useRegistrationForm must be used within RegistrationFormProvider');
  return ctx;
}

export { defaultFormData, newRoute };
