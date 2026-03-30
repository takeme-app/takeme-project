import React, { useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────
export interface MapCoord {
  lat: number;
  lng: number;
}

export interface MapViewProps {
  origin?: MapCoord;
  destination?: MapCoord;
  /** Ponto atual (tracking em tempo real) */
  currentPosition?: MapCoord;
  /** Altura do container (default 300) */
  height?: number;
  /** Modo estático (sem interação) */
  staticMode?: boolean;
  style?: React.CSSProperties;
}

// ── Helpers ──────────────────────────────────────────────────────────
const MAPBOX_TOKEN = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN) || '';

function buildStaticUrl(origin?: MapCoord, destination?: MapCoord, width = 600, height = 300): string {
  if (!MAPBOX_TOKEN) return '';
  const markers: string[] = [];
  if (origin) markers.push(`pin-s-a+22c55e(${origin.lng},${origin.lat})`);
  if (destination) markers.push(`pin-s-b+ef4444(${destination.lng},${destination.lat})`);

  // Auto-fit bounds
  if (origin && destination) {
    const minLng = Math.min(origin.lng, destination.lng) - 0.02;
    const maxLng = Math.max(origin.lng, destination.lng) + 0.02;
    const minLat = Math.min(origin.lat, destination.lat) - 0.02;
    const maxLat = Math.max(origin.lat, destination.lat) + 0.02;
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markers.join(',')}/${[minLng, minLat, maxLng, maxLat].join(',')}/` +
      `${width}x${height}@2x?access_token=${MAPBOX_TOKEN}&padding=40`;
  }

  const center = origin || destination;
  if (center) {
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markers.join(',')}/${center.lng},${center.lat},11/` +
      `${width}x${height}@2x?access_token=${MAPBOX_TOKEN}`;
  }
  return '';
}

// ── Placeholder (sem token) ──────────────────────────────────────────
function MapPlaceholder(props: { height: number; style?: React.CSSProperties }) {
  return React.createElement('div', {
    style: {
      width: '100%',
      height: props.height,
      background: '#f1f1f1',
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#767676',
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      ...props.style,
    },
  },
    React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { marginRight: 8 } },
      React.createElement('path', {
        d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z',
        stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
      }),
      React.createElement('circle', { cx: 12, cy: 10, r: 3, stroke: '#767676', strokeWidth: 2 }),
    ),
    'Mapa do trajeto',
  );
}

// ── Componente Principal ─────────────────────────────────────────────
export default function MapView(props: MapViewProps) {
  const { origin, destination, currentPosition, height = 300, staticMode = false, style } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);
  const [useStatic, setUseStatic] = useState(staticMode || !MAPBOX_TOKEN);

  // Tenta carregar mapbox-gl dinamicamente para modo interativo
  useEffect(() => {
    if (staticMode || !MAPBOX_TOKEN) return;

    // Verifica se mapbox-gl está disponível (dynamic import)
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mapboxModule = 'mapbox-gl';
    (import(/* webpackIgnore: true */ mapboxModule) as Promise<any>)
      .then((mapboxgl: any) => {
        if (cancelled) return;
        setMapboxLoaded(true);

        if (!containerRef.current) return;

        (mapboxgl as any).accessToken = MAPBOX_TOKEN;
        const map = new (mapboxgl as any).Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: origin ? [origin.lng, origin.lat] : [-46.6333, -23.5505],
          zoom: 11,
          interactive: true,
        });

        mapRef.current = map;

        // Adicionar markers
        if (origin) {
          new (mapboxgl as any).Marker({ color: '#22c55e' })
            .setLngLat([origin.lng, origin.lat])
            .addTo(map);
        }
        if (destination) {
          new (mapboxgl as any).Marker({ color: '#ef4444' })
            .setLngLat([destination.lng, destination.lat])
            .addTo(map);
        }

        // Fit bounds
        if (origin && destination) {
          const bounds = new (mapboxgl as any).LngLatBounds();
          bounds.extend([origin.lng, origin.lat]);
          bounds.extend([destination.lng, destination.lat]);
          map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
        }
      })
      .catch(() => {
        if (!cancelled) setUseStatic(true);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [staticMode, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // Atualizar posição atual (tracking)
  useEffect(() => {
    if (!mapRef.current || !currentPosition || !mapboxLoaded) return;

    // Remove marker anterior de tracking se existir
    const el = document.createElement('div');
    el.style.width = '14px';
    el.style.height = '14px';
    el.style.borderRadius = '50%';
    el.style.background = '#3b82f6';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 0 6px rgba(59,130,246,0.5)';

    try {
      const mod = 'mapbox-gl';
      (import(/* webpackIgnore: true */ mod) as Promise<any>).then((mapboxgl: any) => {
        new (mapboxgl as any).Marker({ element: el })
          .setLngLat([currentPosition.lng, currentPosition.lat])
          .addTo(mapRef.current);
      });
    } catch (_) { /* ignore */ }
  }, [currentPosition?.lat, currentPosition?.lng, mapboxLoaded]);

  // Sem dados de coordenadas
  if (!origin && !destination) {
    return React.createElement(MapPlaceholder, { height, style });
  }

  // Modo estático (imagem)
  if (useStatic) {
    const url = buildStaticUrl(origin, destination, 600, height);
    if (!url) return React.createElement(MapPlaceholder, { height, style });

    return React.createElement('img', {
      src: url,
      alt: 'Mapa do trajeto',
      style: {
        width: '100%',
        height,
        objectFit: 'cover',
        borderRadius: 12,
        ...style,
      },
    });
  }

  // Modo interativo (container para mapbox-gl)
  return React.createElement('div', {
    ref: containerRef,
    style: {
      width: '100%',
      height,
      borderRadius: 12,
      overflow: 'hidden',
      ...style,
    },
  });
}
