import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getCurrentPlace } from '../lib/location';

export type CurrentPlace = {
  latitude: number;
  longitude: number;
  address: string;
};

type CurrentLocationContextValue = {
  currentPlace: CurrentPlace | null;
  refreshLocation: () => Promise<CurrentPlace | null>;
};

const CurrentLocationContext = createContext<CurrentLocationContextValue | null>(null);

export function useCurrentLocation(): CurrentLocationContextValue {
  const ctx = useContext(CurrentLocationContext);
  if (!ctx) {
    throw new Error('useCurrentLocation must be used within CurrentLocationProvider');
  }
  return ctx;
}

type CurrentLocationProviderProps = {
  children: React.ReactNode;
};

export function CurrentLocationProvider({ children }: CurrentLocationProviderProps) {
  const [currentPlace, setCurrentPlace] = useState<CurrentPlace | null>(null);

  const refreshLocation = useCallback(async (): Promise<CurrentPlace | null> => {
    const place = await getCurrentPlace();
    setCurrentPlace(place);
    return place;
  }, []);

  useEffect(() => {
    getCurrentPlace().then(setCurrentPlace);
  }, []);

  const value: CurrentLocationContextValue = {
    currentPlace,
    refreshLocation,
  };

  return (
    <CurrentLocationContext.Provider value={value}>
      {children}
    </CurrentLocationContext.Provider>
  );
}
