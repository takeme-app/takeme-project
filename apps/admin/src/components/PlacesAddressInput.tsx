import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getGoogleMapsApiKey } from '../lib/expoExtra';

export type PlaceResolved = { formattedAddress: string; lat: number; lng: number };

export interface PlacesAddressInputProps {
  value: string;
  onChange: (v: string) => void;
  /** Chamado ao escolher uma sugestão (endereço oficial + coordenadas). */
  onPlaceResolved: (p: PlaceResolved) => void;
  inputStyle: React.CSSProperties;
  placeholder?: string;
}

let scriptPromise: Promise<void> | null = null;

function loadGooglePlacesScript(): Promise<void> {
  const key = getGoogleMapsApiKey();
  if (!key) return Promise.reject(new Error('Google Maps API key ausente'));
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as Window & { google?: { maps?: { places?: unknown } } };
  if (w.google?.maps?.places) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[data-takeme-admin-google-places]')) {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const ww = window as Window & { google?: { maps?: { places?: unknown } } };
        if (ww.google?.maps?.places) {
          clearInterval(iv);
          resolve();
        } else if (Date.now() - t0 > 12000) {
          clearInterval(iv);
          reject(new Error('timeout Google Maps'));
        }
      }, 40);
      return;
    }
    const s = document.createElement('script');
    s.setAttribute('data-takeme-admin-google-places', '1');
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async`;
    s.onload = () => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const ww = window as Window & { google?: { maps?: { places?: unknown } } };
        if (ww.google?.maps?.places) {
          clearInterval(iv);
          resolve();
        } else if (Date.now() - t0 > 12000) {
          clearInterval(iv);
          reject(new Error('timeout Google Places'));
        }
      }, 40);
    };
    s.onerror = () => reject(new Error('Falha ao carregar Google Maps'));
    document.head.appendChild(s);
  });

  return scriptPromise;
}

/**
 * Campo de endereço com sugestões Google Places (ou input simples se não houver chave).
 */
export default function PlacesAddressInput(props: PlacesAddressInputProps) {
  const { value, onChange, onPlaceResolved, inputStyle, placeholder } = props;
  const [open, setOpen] = useState(false);
  const [preds, setPreds] = useState<Array<{ description: string; place_id: string }>>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<any>(null);

  const hasKey = Boolean(getGoogleMapsApiKey());

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const runPredictions = useCallback((input: string) => {
    if (!hasKey || input.trim().length < 3) {
      setPreds([]);
      return;
    }
    loadGooglePlacesScript()
      .then(() => {
        const g = (window as any).google;
        if (!g?.maps?.places) return;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
        }
        const svc = new g.maps.places.AutocompleteService();
        svc.getPlacePredictions(
          {
            input: input.trim(),
            componentRestrictions: { country: 'br' },
            sessionToken: sessionTokenRef.current,
          },
          (list: Array<{ description: string; place_id: string }> | null, status: string) => {
            if (status !== g.maps.places.PlacesServiceStatus.OK || !list?.length) {
              setPreds([]);
              return;
            }
            setPreds(list.map((p) => ({ description: p.description, place_id: p.place_id })));
            setOpen(true);
          },
        );
      })
      .catch(() => setLoadErr('Não foi possível carregar o Google Places.'));
  }, [hasKey]);

  const onInputChange = useCallback((v: string) => {
    onChange(v);
    setLoadErr(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runPredictions(v), 320);
  }, [onChange, runPredictions]);

  const pickPrediction = useCallback((placeId: string, description: string) => {
    const g = (window as any).google;
    if (!g?.maps?.places) return;
    const div = document.createElement('div');
    const svc = new g.maps.places.PlacesService(div);
    svc.getDetails(
      {
        placeId,
        fields: ['geometry', 'formatted_address'],
        sessionToken: sessionTokenRef.current,
      },
      (place: { geometry?: { location?: { lat(): number; lng(): number } }; formatted_address?: string } | null, status: string) => {
        sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
        if (status !== g.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const addr = place.formatted_address || description;
        onChange(addr);
        onPlaceResolved({ formattedAddress: addr, lat, lng });
        setOpen(false);
        setPreds([]);
      },
    );
  }, [onChange, onPlaceResolved]);

  if (!hasKey) {
    return React.createElement('input', {
      type: 'text',
      value,
      placeholder: placeholder || 'Endereço (configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY para sugestões)',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
      style: inputStyle,
    });
  }

  return React.createElement('div', { ref: wrapRef, style: { position: 'relative' as const, width: '100%' } },
    React.createElement('input', {
      type: 'text',
      value,
      placeholder: placeholder || 'Buscar endereço…',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onInputChange(e.target.value),
      onFocus: () => { if (preds.length) setOpen(true); },
      style: inputStyle,
      autoComplete: 'off',
    }),
    loadErr
      ? React.createElement('div', { style: { fontSize: 12, color: '#b53838', marginTop: 4, fontFamily: 'Inter, sans-serif' } }, loadErr)
      : null,
    open && preds.length > 0
      ? React.createElement('div', {
          style: {
            position: 'absolute' as const,
            left: 0,
            right: 0,
            top: '100%',
            marginTop: 4,
            maxHeight: 220,
            overflowY: 'auto' as const,
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            border: '1px solid #e2e2e2',
            zIndex: 50,
          },
        },
          ...preds.map((p) =>
            React.createElement('button', {
              key: p.place_id,
              type: 'button',
              onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
              onClick: () => pickPrediction(p.place_id, p.description),
              style: {
                display: 'block',
                width: '100%',
                textAlign: 'left' as const,
                padding: '10px 14px',
                border: 'none',
                borderBottom: '1px solid #f1f1f1',
                background: '#fff',
                cursor: 'pointer',
                fontSize: 14,
                color: '#0d0d0d',
                fontFamily: 'Inter, sans-serif',
              },
            }, p.description)))
      : null,
  );
}
