import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { resolveCurrentPlace } from '../lib/location';

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
    const r = await resolveCurrentPlace();
    if (r.kind === 'place') {
      const place = { latitude: r.latitude, longitude: r.longitude, address: r.address };
      setCurrentPlace(place);
      return place;
    }
    setCurrentPlace(null);
    return null;
  }, []);

  useEffect(() => {
    let alive = true;
    resolveCurrentPlace().then((r) => {
      if (!alive) return;
      if (r.kind === 'place') {
        setCurrentPlace({ latitude: r.latitude, longitude: r.longitude, address: r.address });
      } else {
        setCurrentPlace(null);
      }
    });
    return () => {
      alive = false;
    };
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
