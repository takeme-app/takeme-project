/**
 * Estilo Mapbox GL nativo compartilhado entre os apps cliente e motorista.
 * `streets-v12`: mapa rodoviário **colorido** (ruas, áreas verdes, água legíveis em navegação).
 * Evita `light-v11`, que é quase monocromático e parece “preto e branco” no telemóvel.
 *
 * @see https://docs.mapbox.com/api/maps/styles/
 */
export const MAPBOX_NATIVE_MAP_STYLE_URL = 'mapbox://styles/mapbox/streets-v12';

/** Trajeto no mapa — motorista (`MapPolyline`) e admin (overlay de rota). */
export const MAPBOX_ROUTE_STROKE_COLOR = '#C9A227';

/** Pin de origem — mesma cor da Home do motorista / pins estáticos do admin. */
export const MAPBOX_ORIGIN_MARKER_COLOR = '#111827';

/** Pin de destino — ouro Take Me (admin: `pin-s-b+c9a227`). */
export const MAPBOX_DESTINATION_MARKER_COLOR = '#C9A227';
