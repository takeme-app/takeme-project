import React, { useEffect, useRef, useState } from 'react';
import { getMapboxAccessToken } from '../lib/expoExtra';

// ── Types ────────────────────────────────────────────────────────────
export interface MapCoord {
  lat: number;
  lng: number;
}

/** Perfil da [Directions API](https://docs.mapbox.com/api/navigation/directions/) v5. */
export type MapboxDirectionsProfile = 'driving' | 'driving-traffic' | 'walking' | 'cycling';

export interface MapWaypoint extends MapCoord {
  label?: string;
  color?: string;
  /** Tipo da parada (para icone customizado) */
  type?: 'driver_origin' | 'passenger_pickup' | 'shipment_pickup' | 'base_dropoff' | 'trip_destination' | string;
}

export interface MapViewProps {
  origin?: MapCoord;
  destination?: MapCoord;
  /** Pontos intermediarios (passageiros, encomendas, bases) — renderizados na ordem */
  waypoints?: MapWaypoint[];
  /** Ponto atual (tracking em tempo real) */
  currentPosition?: MapCoord;
  /** Altura do container (default 300) */
  height?: number;
  /**
   * true = só imagem estática (rápido, sem interação).
   * false = Mapbox GL real (pan/zoom, marcadores, rota).
   */
  staticMode?: boolean;
  /**
   * Desenhar trajeto entre origem e destino no GL (Directions API; fallback linha reta).
   */
  connectPoints?: boolean;
  /**
   * `driving-traffic` usa dados de trânsito onde a Mapbox disponibiliza.
   * Requer o mesmo token usado no mapa (scopes de Directions).
   */
  directionsProfile?: MapboxDirectionsProfile;
  /**
   * Overlays do Figma (792:1593 + 792:1595). Default off para mapa limpo como referência de produto.
   */
  showFigmaMapChrome?: boolean;
  style?: React.CSSProperties;
}

const LINE_SOURCE_ID = 'takeme-trip-line';
const LINE_LAYER_ID = 'takeme-trip-line-layer';

/** Estilo claro minimal (referência de produto). */
const MAPBOX_STYLE_LIGHT = 'mapbox://styles/mapbox/light-v11';
const MAPBOX_STATIC_STYLE_LIGHT = 'mapbox/light-v11';

/** Padding na Static API: mais margem interna ajuda a não colar atribuição Mapbox na borda do PNG. */
const STATIC_MAP_API_PADDING = 96;

/** Fundo do container estático (próximo ao light-v11) para barras do `object-fit: contain` discretas. */
const STATIC_MAP_LETTERBOX_BG = '#f4f3ef';

/** SVG do carro (branco) para marcador de origem no GL. */
const TRIP_ORIGIN_CAR_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" fill="#ffffff"/>' +
  '</svg>';

function createTripOriginMarkerElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = '40px';
  el.style.height = '40px';
  el.style.borderRadius = '50%';
  el.style.background = '#0d0d0d';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.boxShadow = '0 2px 10px rgba(0,0,0,0.22)';
  el.innerHTML = TRIP_ORIGIN_CAR_SVG;
  return el;
}

function createTripDestinationMarkerElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = '36px';
  el.style.height = '36px';
  el.style.borderRadius = '50%';
  el.style.background = '#2563eb';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.boxShadow = '0 2px 10px rgba(37,99,235,0.35)';
  const dot = document.createElement('div');
  dot.style.width = '8px';
  dot.style.height = '8px';
  dot.style.borderRadius = '50%';
  dot.style.background = '#ffffff';
  el.appendChild(dot);
  return el;
}

// ── Directions API ─────────────────────────────────────────────────────
async function fetchDirectionsPolyline(
  origin: MapCoord,
  destination: MapCoord,
  token: string,
  profile: MapboxDirectionsProfile,
  signal?: AbortSignal,
): Promise<string | null> {
  const coordPath = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordPath}` +
    `?geometries=polyline&overview=full&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{ geometry?: unknown }>;
  };
  if (data.code !== 'Ok' || !data.routes?.[0]) return null;
  const g = data.routes[0].geometry;
  return typeof g === 'string' && g.length > 0 ? g : null;
}

async function fetchDirectionsLineString(
  origin: MapCoord,
  destination: MapCoord,
  token: string,
  profile: MapboxDirectionsProfile,
  signal?: AbortSignal,
  intermediatePoints?: MapCoord[],
): Promise<{ type: 'LineString'; coordinates: number[][] } | null> {
  // Multi-waypoint: origin ; wp1 ; wp2 ; ... ; destination
  const allPoints = [origin, ...(intermediatePoints || []), destination];
  const coordPath = allPoints.map(p => `${p.lng},${p.lat}`).join(';');
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordPath}` +
    `?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    code?: string;
    routes?: Array<{ geometry?: { type?: string; coordinates?: number[][] } }>;
  };
  if (data.code !== 'Ok' || !data.routes?.[0]?.geometry) return null;
  const g = data.routes[0].geometry;
  if (g.type !== 'LineString' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) return null;
  return { type: 'LineString', coordinates: g.coordinates };
}

function fitMapToCoordinates(map: any, mapboxgl: any, coordinates: number[][]) {
  if (coordinates.length === 0) return;
  const bounds = new mapboxgl.LngLatBounds();
  for (const c of coordinates) {
    if (Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      bounds.extend(c as [number, number]);
    }
  }
  map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 });
}

// ── Helpers ──────────────────────────────────────────────────────────
/** Evita lixo de float na URL; coords já validadas como números finitos. */
function r6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Largura pedida à Static API: mais nítida em containers largos/altos, com teto seguro para URL. */
function staticSnapshotWidthPx(forHeight: number): number {
  return Math.max(600, Math.min(1280, Math.round(forHeight * 2)));
}

/**
 * Static Images API: overlays `pin-s-*` devem ir **literais** no path (ex.: `pin-s-a+22c55e(lon,lat)`).
 * `encodeURIComponent` no overlay transforma `+` em `%2B` e a API responde 422.
 * @see https://docs.mapbox.com/api/maps/static-images/#overlay-options
 */
function buildStaticUrl(origin?: MapCoord, destination?: MapCoord, width = 600, height = 300): string {
  const token = getMapboxAccessToken();
  if (!token) return '';
  const markers: string[] = [];
  if (origin) markers.push(`pin-s-a+000000(${r6(origin.lng)},${r6(origin.lat)})`);
  if (destination) markers.push(`pin-s-b+2563eb(${r6(destination.lng)},${r6(destination.lat)})`);

  if (origin && destination) {
    // `auto` ajusta zoom/ângulo aos overlays (recomendado na doc). Bbox manual com
    // trechos muito longos (ex. vários estados) costuma falhar com 422.
    // @see https://docs.mapbox.com/api/maps/static-images/#example-request-static-map-with-a-polyline-overlay
    const overlay = markers.join(',');
    // `STATIC_MAP_API_PADDING`: afasta o enquadramento da borda do tile e dá folga à atribuição no PNG.
    return `https://api.mapbox.com/styles/v1/${MAPBOX_STATIC_STYLE_LIGHT}/static/${overlay}/auto/${width}x${height}@2x` +
      `?access_token=${encodeURIComponent(token)}&padding=${STATIC_MAP_API_PADDING}`;
  }

  const center = origin || destination;
  if (center) {
    return `https://api.mapbox.com/styles/v1/${MAPBOX_STATIC_STYLE_LIGHT}/static/${markers.join(',')}/${r6(center.lng)},${r6(center.lat)},11/` +
      `${width}x${height}@2x?access_token=${encodeURIComponent(token)}`;
  }
  return '';
}

/**
 * Static Images com rota ao longo das vias (polyline Directions) + pins alinhados ao tema claro.
 * Retorna '' se a URL exceder limite seguro ou token ausente.
 */
function buildStaticUrlWithRoutePolyline(
  origin: MapCoord,
  destination: MapCoord,
  polyline: string,
  width = 600,
  height = 300,
): string {
  const token = getMapboxAccessToken();
  if (!token) return '';
  const enc = encodeURIComponent(polyline);
  const pins =
    `pin-s-a+000000(${r6(origin.lng)},${r6(origin.lat)}),` +
    `pin-s-b+2563eb(${r6(destination.lng)},${r6(destination.lat)})`;
  const pathOverlay = `path-3+000-1(${enc})`;
  const overlay = `${pathOverlay},${pins}`;
  const u =
    `https://api.mapbox.com/styles/v1/${MAPBOX_STATIC_STYLE_LIGHT}/static/${overlay}/auto/${width}x${height}@2x` +
    `?access_token=${encodeURIComponent(token)}&padding=${STATIC_MAP_API_PADDING}`;
  if (u.length > 7200) return '';
  return u;
}

// ── Placeholder ──────────────────────────────────────────────────────
function MapPlaceholder(props: { height: number; style?: React.CSSProperties; subMessage?: string }) {
  return React.createElement('div', {
    style: {
      width: '100%',
      minHeight: props.height,
      height: props.height,
      background: '#f1f1f1',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      color: '#767676',
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      padding: 16,
      boxSizing: 'border-box' as const,
      textAlign: 'center' as const,
      ...props.style,
    },
  },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: props.subMessage ? 8 : 0 } },
      React.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', style: { flexShrink: 0 } },
        React.createElement('path', {
          d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z',
          stroke: '#767676', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        }),
        React.createElement('circle', { cx: 12, cy: 10, r: 3, stroke: '#767676', strokeWidth: 2 }),
      ),
      React.createElement('span', null, 'Mapa do trajeto'),
    ),
    props.subMessage
      ? React.createElement('span', { style: { fontSize: 12, lineHeight: 1.4, maxWidth: 320 } }, props.subMessage)
      : null,
  );
}

function removeTripLineLayer(map: any) {
  try {
    if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
    if (map.getSource(LINE_SOURCE_ID)) map.removeSource(LINE_SOURCE_ID);
  } catch { /* ignore */ }
}

function setTripRouteLayer(map: any, geometry: { type: 'LineString'; coordinates: number[][] }) {
  const geojson = {
    type: 'Feature' as const,
    properties: {},
    geometry,
  };

  if (map.getSource(LINE_SOURCE_ID)) {
    (map.getSource(LINE_SOURCE_ID) as any).setData(geojson);
    return;
  }

  map.addSource(LINE_SOURCE_ID, { type: 'geojson', data: geojson });
  map.addLayer({
    id: LINE_LAYER_ID,
    type: 'line',
    source: LINE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#0d0d0d',
      'line-width': 3,
      'line-opacity': 1,
    },
  });
}

function addStraightFallbackLine(map: any, origin: MapCoord, destination: MapCoord) {
  setTripRouteLayer(map, {
    type: 'LineString',
    coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
  });
}

/** Ícone drive_eta (Figma 792:1595) — carro branco, alinhado ao componente action container. */
function figmaDriveEtaIcon() {
  return React.createElement('svg', {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    style: { display: 'block' },
  },
    React.createElement('path', {
      d: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
      fill: '#ffffff',
    }));
}

/**
 * Chrome do mapa — Figma Frame 792:1593 (circle_2) + action container 792:1595.
 */
function mapFigmaChromeElements(): React.ReactNode[] {
  const markerFrame = React.createElement('div', {
    key: 'figma-marker',
    'aria-hidden': true,
    style: {
      position: 'absolute' as const,
      bottom: 14,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 129,
      height: 27,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none' as const,
      zIndex: 4,
    },
  },
    React.createElement('div', {
      style: {
        width: 27,
        height: 27,
        borderRadius: '50%',
        background: '#2563eb',
        boxShadow: '0 2px 10px rgba(37, 99, 235, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      },
    },
      React.createElement('div', {
        style: {
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#ffffff',
        },
      })));

  const actionBtn = React.createElement('button', {
    key: 'figma-drive',
    type: 'button',
    title: 'Trajeto por estrada',
    'aria-label': 'Trajeto por estrada',
    style: {
      position: 'absolute' as const,
      bottom: 14,
      right: 14,
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: 'none',
      background: '#0d0d0d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      pointerEvents: 'auto' as const,
      zIndex: 4,
      boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      padding: 0,
    },
  },
    React.createElement('div', {
      style: {
        transform: 'rotate(-90deg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    }, figmaDriveEtaIcon()));

  return [markerFrame, actionBtn];
}

// ── Componente Principal ───────────────────────────────────────────────
export default function MapView(props: MapViewProps) {
  const {
    origin,
    destination,
    currentPosition,
    height = 300,
    waypoints,
    staticMode = false,
    connectPoints = true,
    directionsProfile = 'driving-traffic',
    showFigmaMapChrome = false,
    style,
  } = props;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);
  const [glFailed, setGlFailed] = useState(false);
  const token = getMapboxAccessToken();
  const useStatic = staticMode || !token || glFailed;
  const [staticRouteUrl, setStaticRouteUrl] = useState<string | null>(null);

  useEffect(() => {
    setGlFailed(false);
  }, [staticMode, token, origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  useEffect(() => {
    if (!useStatic || !origin || !destination || !token) {
      setStaticRouteUrl(null);
      return;
    }
    setStaticRouteUrl(null);
    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      let poly = await fetchDirectionsPolyline(origin, destination, token, directionsProfile, ac.signal);
      if (cancelled) return;
      if (!poly && directionsProfile === 'driving-traffic') {
        poly = await fetchDirectionsPolyline(origin, destination, token, 'driving', ac.signal);
      }
      if (cancelled || !poly) return;
      const u = buildStaticUrlWithRoutePolyline(origin, destination, poly, staticSnapshotWidthPx(height), height);
      if (!cancelled && u) setStaticRouteUrl(u);
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [
    useStatic,
    token,
    origin?.lat,
    origin?.lng,
    destination?.lat,
    destination?.lng,
    directionsProfile,
    height,
  ]);

  useEffect(() => {
    if (staticMode || !token || glFailed) return;

    let cancelled = false;
    const ac = new AbortController();
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      try {
        await import('mapbox-gl/dist/mapbox-gl.css');
        const mapboxgl = await import('mapbox-gl');
        if (cancelled) return;
        setMapboxLoaded(true);

        if (!mapContainerRef.current) return;

        (mapboxgl as any).accessToken = token;
        const map = new (mapboxgl as any).Map({
          container: mapContainerRef.current,
          style: MAPBOX_STYLE_LIGHT,
          center: origin ? [origin.lng, origin.lat] : [-46.6333, -23.5505],
          zoom: 11,
          interactive: true,
        });

        mapRef.current = map;
        markersRef.current = [];

        const resizeMap = () => {
          if (cancelled || !mapRef.current) return;
          try {
            mapRef.current.resize();
          } catch { /* ignore */ }
        };
        const parentEl = mapContainerRef.current.parentElement;
        if (typeof ResizeObserver !== 'undefined' && parentEl) {
          resizeObserver = new ResizeObserver(() => {
            resizeMap();
          });
          resizeObserver.observe(parentEl);
        }

        const placeMarkersAndRoute = async () => {
          if (cancelled || !mapRef.current) return;
          const m = mapRef.current;
          markersRef.current.forEach((mk) => mk.remove());
          markersRef.current = [];

          if (origin) {
            markersRef.current.push(
              new (mapboxgl as any).Marker({ element: createTripOriginMarkerElement(), anchor: 'center' })
                .setLngLat([origin.lng, origin.lat])
                .addTo(m),
            );
          }
          if (destination) {
            markersRef.current.push(
              new (mapboxgl as any).Marker({ element: createTripDestinationMarkerElement(), anchor: 'center' })
                .setLngLat([destination.lng, destination.lat])
                .addTo(m),
            );
          }

          // Waypoint markers (passageiros, encomendas, bases)
          if (waypoints && waypoints.length > 0) {
            waypoints.forEach((wp, idx) => {
              const colors: Record<string, string> = {
                passenger_pickup: '#3b82f6',
                shipment_pickup: '#f59e0b',
                base_dropoff: '#22c55e',
              };
              const bg = wp.color || colors[wp.type || ''] || '#767676';
              const el = document.createElement('div');
              el.style.width = '28px';
              el.style.height = '28px';
              el.style.borderRadius = '50%';
              el.style.background = bg;
              el.style.border = '3px solid #fff';
              el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
              el.style.display = 'flex';
              el.style.alignItems = 'center';
              el.style.justifyContent = 'center';
              el.style.color = '#fff';
              el.style.fontSize = '11px';
              el.style.fontWeight = '700';
              el.style.fontFamily = 'Inter, sans-serif';
              el.textContent = String(idx + 1);
              if (wp.label) el.title = wp.label;
              markersRef.current.push(
                new (mapboxgl as any).Marker({ element: el, anchor: 'center' })
                  .setLngLat([wp.lng, wp.lat])
                  .addTo(m),
              );
            });
          }

          if (connectPoints && origin && destination) {
            try {
              removeTripLineLayer(m);
              const intermediateCoords = (waypoints || []).filter(wp => wp.lat && wp.lng);
              let line = await fetchDirectionsLineString(origin, destination, token, directionsProfile, ac.signal, intermediateCoords);
              if (cancelled || !mapRef.current) return;
              if (!line && directionsProfile === 'driving-traffic') {
                line = await fetchDirectionsLineString(origin, destination, token, 'driving', ac.signal, intermediateCoords);
              }
              if (cancelled || !mapRef.current) return;
              if (line) {
                setTripRouteLayer(m, line);
                fitMapToCoordinates(m, mapboxgl, line.coordinates);
              } else {
                addStraightFallbackLine(m, origin, destination);
                const bounds = new (mapboxgl as any).LngLatBounds();
                bounds.extend([origin.lng, origin.lat]);
                bounds.extend([destination.lng, destination.lat]);
                m.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
              }
            } catch {
              if (cancelled || ac.signal.aborted || !mapRef.current) return;
              try {
                removeTripLineLayer(m);
                addStraightFallbackLine(m, origin, destination);
                const bounds = new (mapboxgl as any).LngLatBounds();
                bounds.extend([origin.lng, origin.lat]);
                bounds.extend([destination.lng, destination.lat]);
                m.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
              } catch { /* ignore */ }
            }
          } else {
            removeTripLineLayer(m);
            if (origin && destination) {
              const bounds = new (mapboxgl as any).LngLatBounds();
              bounds.extend([origin.lng, origin.lat]);
              bounds.extend([destination.lng, destination.lat]);
              m.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
            } else if (origin) {
              m.setCenter([origin.lng, origin.lat]);
              m.setZoom(12);
            } else if (destination) {
              m.setCenter([destination.lng, destination.lat]);
              m.setZoom(12);
            }
          }
        };

        const onReady = () => {
          resizeMap();
          void placeMarkersAndRoute();
        };

        if (map.isStyleLoaded && map.isStyleLoaded()) {
          resizeMap();
          void placeMarkersAndRoute();
        } else {
          map.once('load', onReady);
        }
      } catch {
        if (!cancelled) setGlFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
      resizeObserver?.disconnect();
      resizeObserver = null;
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [
    staticMode,
    token,
    glFailed,
    connectPoints,
    directionsProfile,
    origin?.lat,
    origin?.lng,
    destination?.lat,
    destination?.lng,
  ]);

  useEffect(() => {
    if (!mapRef.current || !currentPosition || !mapboxLoaded || !token) return;

    const el = document.createElement('div');
    el.style.width = '14px';
    el.style.height = '14px';
    el.style.borderRadius = '50%';
    el.style.background = '#3b82f6';
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 0 6px rgba(59,130,246,0.5)';

    (async () => {
      try {
        const mapboxgl = await import('mapbox-gl');
        new (mapboxgl as any).Marker({ element: el })
          .setLngLat([currentPosition.lng, currentPosition.lat])
          .addTo(mapRef.current);
      } catch { /* ignore */ }
    })();
  }, [currentPosition?.lat, currentPosition?.lng, mapboxLoaded, token]);

  const noCoords = !origin && !destination;
  if (noCoords) {
    return React.createElement(MapPlaceholder, {
      height,
      style,
      subMessage: 'Sem coordenadas de origem/destino. Defina endereços com a busca do Google ou salve após geocodificação.',
    });
  }

  if (useStatic) {
    const baseStatic = buildStaticUrl(origin, destination, staticSnapshotWidthPx(height), height);
    const url = staticRouteUrl || baseStatic;
    if (!url) {
      return React.createElement(MapPlaceholder, {
        height,
        style,
        subMessage: token
          ? 'Não foi possível montar a imagem do mapa.'
          : 'Configure EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (e reinicie o build) para exibir o mapa Mapbox.',
      });
    }

    // `contain` + flex centra o PNG inteiro: atribuição Mapbox no rodapé da imagem não é cortada (vs `cover`).
    return React.createElement('div', {
      style: {
        position: 'relative' as const,
        width: '100%',
        minHeight: height,
        height,
        background: STATIC_MAP_LETTERBOX_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box' as const,
        borderRadius: 12,
        overflow: 'hidden' as const,
        ...style,
      },
    },
      React.createElement('img', {
        src: url,
        alt: 'Mapa do trajeto',
        style: {
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain' as const,
          objectPosition: 'center',
          display: 'block',
        },
      }),
      ...(showFigmaMapChrome ? mapFigmaChromeElements() : []));
  }

  return React.createElement('div', {
    style: {
      position: 'relative' as const,
      width: '100%',
      minHeight: height,
      height,
      borderRadius: 12,
      overflow: 'hidden',
      ...style,
    },
  },
    React.createElement('div', {
      ref: mapContainerRef,
      style: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      },
    }),
    ...(showFigmaMapChrome ? mapFigmaChromeElements() : []));
}
