/**
 * Camada de mapa offline (basemap) usando o Mapbox `offlineManager` do
 * `@rnmapbox/maps`. Baixa um pack de tiles do estilo nativo cobrindo a rota
 * planejada com um buffer em km, dentro da faixa de zoom configurada.
 *
 * Limites importantes (Mapbox):
 *  - Cada pack tem teto de tiles (depende do plano). Por isso usamos
 *    `MAX_PACK_AREA_KM2`: se a bbox final for maior que isso, descartamos
 *    (provavelmente é caso patológico — rota bug ou viagem inter-estadual).
 *  - Custos contam por MAU + TLA. Auto-download só na viagem ativa, com
 *    a área mínima necessária e cache idempotente por id.
 *
 * Importação defensiva: o módulo nativo `@rnmapbox/maps` precisa de rebuild
 * (dev client). Em ambientes web/jest o `require` falha — deixamos as APIs
 * no-op em vez de quebrar a tela.
 */
import { MAPBOX_NATIVE_MAP_STYLE_URL } from '@take-me/shared';

export type LatLngPoint = { latitude: number; longitude: number };

export type EnsureOfflinePackOptions = {
  /** Identificador único e estável (ex.: `trip-<id>` / `shipment-<id>`). */
  packName: string;
  /** Polilinha (ou pontos) a cobrir. >= 2 pontos. */
  coords: LatLngPoint[];
  /** Padding em quilômetros ao redor da bbox. Default 3 km. */
  bufferKm?: number;
  /** Faixa de zoom. Default [10, 16]. */
  minZoom?: number;
  maxZoom?: number;
  /** styleURL do pack — deve casar com o `GoogleMapsMap`. */
  styleURL?: string;
};

export type OfflinePackSummary = {
  name: string;
  state: 'unknown' | 'inactive' | 'active' | 'complete' | 'invalid';
  percentage: number | null;
  completedTileCount: number | null;
  completedResourceSize: number | null;
};

const DEFAULT_BUFFER_KM = 3;
const DEFAULT_MIN_ZOOM = 10;
const DEFAULT_MAX_ZOOM = 16;
const MIN_BUFFER_KM = 0.5;

/** Salvaguarda contra packs gigantes (~bbox de 200x200km). */
const MAX_PACK_AREA_KM2 = 40_000;

let cachedOfflineManager: unknown = null;
let didTryLoad = false;

/** Tipagem mínima do `offlineManager` que usamos — evita acoplar o tipo do SDK. */
type RnmapboxOfflineManager = {
  createPack: (
    options: {
      name: string;
      styleURL: string;
      bounds: [[number, number], [number, number]];
      minZoom: number;
      maxZoom: number;
    },
    onProgress?: (pack: unknown, status: unknown) => void,
    onError?: (pack: unknown, err: unknown) => void,
  ) => Promise<unknown>;
  getPack: (name: string) => Promise<unknown>;
  getPacks?: () => Promise<unknown[]>;
  deletePack: (name: string) => Promise<unknown>;
  resetDatabase?: () => Promise<unknown>;
};

function loadOfflineManager(): RnmapboxOfflineManager | null {
  if (didTryLoad) return cachedOfflineManager as RnmapboxOfflineManager | null;
  didTryLoad = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Mapbox = require('@rnmapbox/maps');
    const mgr = Mapbox?.offlineManager ?? Mapbox?.default?.offlineManager ?? null;
    cachedOfflineManager = mgr;
    return mgr as RnmapboxOfflineManager | null;
  } catch {
    cachedOfflineManager = null;
    return null;
  }
}

/** Bbox geográfico — não é projeção real, só latitude/longitude min/max. */
type Bbox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

function bboxFromCoords(coords: LatLngPoint[]): Bbox | null {
  if (!coords || coords.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const c of coords) {
    if (
      typeof c.latitude !== 'number' ||
      typeof c.longitude !== 'number' ||
      !Number.isFinite(c.latitude) ||
      !Number.isFinite(c.longitude)
    ) {
      continue;
    }
    if (c.longitude < minLng) minLng = c.longitude;
    if (c.longitude > maxLng) maxLng = c.longitude;
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
  }
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null;
  return { minLng, minLat, maxLng, maxLat };
}

/** ~ km → graus (lat ~ 111 km/grau; lng varia com cosseno da latitude). */
function expandBboxByKm(bbox: Bbox, km: number): Bbox {
  const safeKm = Math.max(MIN_BUFFER_KM, km);
  const dLat = safeKm / 111;
  const meanLatRad = ((bbox.minLat + bbox.maxLat) / 2) * (Math.PI / 180);
  const cosLat = Math.max(0.1, Math.cos(meanLatRad));
  const dLng = safeKm / (111 * cosLat);
  return {
    minLng: bbox.minLng - dLng,
    minLat: Math.max(-85, bbox.minLat - dLat),
    maxLng: bbox.maxLng + dLng,
    maxLat: Math.min(85, bbox.maxLat + dLat),
  };
}

/** Aproximação rápida da área da bbox em km² (boa o bastante para sanidade). */
function bboxAreaKm2(bbox: Bbox): number {
  const widthKm =
    Math.abs(bbox.maxLng - bbox.minLng) *
    111 *
    Math.cos((((bbox.minLat + bbox.maxLat) / 2) * Math.PI) / 180);
  const heightKm = Math.abs(bbox.maxLat - bbox.minLat) * 111;
  return Math.max(0, widthKm) * Math.max(0, heightKm);
}

export type EnsureOfflineResult =
  | { status: 'created' }
  | { status: 'already_exists' }
  | { status: 'unsupported' }
  | { status: 'too_large'; areaKm2: number }
  | { status: 'invalid_coords' }
  | { status: 'error'; error: unknown };

/**
 * Garante que existe um pack offline cobrindo a rota informada.
 * Idempotente por `packName`: se o pack já estiver criado, não baixa de novo.
 *
 * Importante: a chamada é "fire-and-forget" no consumidor — o download corre
 * em background, e o componente do mapa renderiza com tiles online enquanto
 * houver internet, e cai automaticamente no offline quando não houver.
 */
export async function ensureOfflinePackForRoute(
  options: EnsureOfflinePackOptions,
): Promise<EnsureOfflineResult> {
  const mgr = loadOfflineManager();
  if (!mgr) return { status: 'unsupported' };

  const baseBbox = bboxFromCoords(options.coords);
  if (!baseBbox) return { status: 'invalid_coords' };

  const bufferKm = options.bufferKm ?? DEFAULT_BUFFER_KM;
  const expanded = expandBboxByKm(baseBbox, bufferKm);
  const areaKm2 = bboxAreaKm2(expanded);
  if (areaKm2 > MAX_PACK_AREA_KM2) {
    return { status: 'too_large', areaKm2 };
  }

  try {
    const existing = await mgr.getPack(options.packName).catch(() => null);
    if (existing) return { status: 'already_exists' };

    await mgr.createPack({
      name: options.packName,
      styleURL: options.styleURL ?? MAPBOX_NATIVE_MAP_STYLE_URL,
      bounds: [
        [expanded.maxLng, expanded.maxLat],
        [expanded.minLng, expanded.minLat],
      ],
      minZoom: options.minZoom ?? DEFAULT_MIN_ZOOM,
      maxZoom: options.maxZoom ?? DEFAULT_MAX_ZOOM,
    });
    return { status: 'created' };
  } catch (error) {
    return { status: 'error', error };
  }
}

export async function deleteOfflinePack(packName: string): Promise<boolean> {
  const mgr = loadOfflineManager();
  if (!mgr) return false;
  try {
    await mgr.deletePack(packName);
    return true;
  } catch {
    return false;
  }
}

/** Apaga todos os packs (botão "limpar mapas offline"). */
export async function clearAllOfflinePacks(): Promise<boolean> {
  const mgr = loadOfflineManager();
  if (!mgr) return false;
  try {
    if (typeof mgr.resetDatabase === 'function') {
      await mgr.resetDatabase();
      return true;
    }
    if (typeof mgr.getPacks === 'function') {
      const packs = (await mgr.getPacks()) ?? [];
      for (const p of packs) {
        const name = (p as { name?: string })?.name;
        if (name) {
          await mgr.deletePack(name).catch(() => undefined);
        }
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
