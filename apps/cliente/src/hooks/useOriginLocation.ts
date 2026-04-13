import { useState, useEffect, useCallback } from 'react';
import { useCurrentLocation } from '../contexts/CurrentLocationContext';
import { resolveCurrentPlace, type AddressSuggestion } from '../lib/location';
import { useAppAlert } from '../contexts/AppAlertContext';
import { guessCityFromPtAddress } from '../lib/shipmentOriginCity';

const DEFAULT_COORDS = { latitude: -7.3289, longitude: -35.3328 };

type Options = {
  /** Quando true, extrai originCityTag da origem via guessCityFromPtAddress. */
  extractCity?: boolean;
};

export function useOriginLocation(options: Options = {}) {
  const { extractCity = false } = options;
  const { currentPlace, refreshLocation } = useCurrentLocation();
  const { showAlert } = useAppAlert();

  const [originAddress, setOriginAddress] = useState('Obtendo sua localização...');
  const [originLat, setOriginLat] = useState(DEFAULT_COORDS.latitude);
  const [originLng, setOriginLng] = useState(DEFAULT_COORDS.longitude);
  const [originCityTag, setOriginCityTag] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  const applyPlace = useCallback(
    (address: string, lat: number, lng: number) => {
      setOriginAddress(address);
      setOriginLat(lat);
      setOriginLng(lng);
      if (extractCity) setOriginCityTag(guessCityFromPtAddress(address));
    },
    [extractCity],
  );

  useEffect(() => {
    if (currentPlace) {
      applyPlace(currentPlace.address, currentPlace.latitude, currentPlace.longitude);
      return;
    }
    let cancelled = false;
    resolveCurrentPlace().then((r) => {
      if (cancelled) return;
      if (r.kind === 'place') {
        applyPlace(r.address, r.latitude, r.longitude);
      } else if (r.kind === 'permission_denied') {
        setOriginAddress('Permita acesso à localização');
      } else {
        setOriginAddress('GPS indisponível — toque em "Minha localização"');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentPlace?.latitude, currentPlace?.longitude, currentPlace?.address, applyPlace]);

  const useMyLocationForOrigin = useCallback(async () => {
    setLocationLoading(true);
    try {
      const place = await refreshLocation();
      if (place) {
        applyPlace(place.address, place.latitude, place.longitude);
      } else {
        showAlert('Localização', 'Não foi possível usar sua localização. Verifique as permissões.');
      }
    } catch {
      showAlert('Localização', 'Não foi possível obter seu endereço. Tente novamente.');
    } finally {
      setLocationLoading(false);
    }
  }, [refreshLocation, showAlert, applyPlace]);

  const setOriginFromAutocomplete = useCallback(
    (place: AddressSuggestion) => {
      applyPlace(place.address, place.latitude, place.longitude);
      if (extractCity && place.city) setOriginCityTag(place.city);
    },
    [applyPlace, extractCity],
  );

  return {
    originAddress,
    originLat,
    originLng,
    originCityTag,
    locationLoading,
    useMyLocationForOrigin,
    setOriginFromAutocomplete,
  };
}
