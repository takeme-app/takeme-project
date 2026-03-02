/**
 * Utilitários para uso com @rnmapbox/maps.
 * Mapbox usa [longitude, latitude] (GeoJSON); react-native-maps usa { latitude, longitude }.
 */

export type LatLng = { latitude: number; longitude: number };

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

/** Converte { lat, lng } para [lng, lat] (Mapbox). */
export function toMapboxCoord(point: LatLng): [number, number] {
  return [point.longitude, point.latitude];
}

/** Converte região (react-native-maps) para zoomLevel aproximado. */
export function regionToZoomLevel(region: MapRegion): number {
  const { latitudeDelta } = region;
  // 0.008 -> ~14, 0.02 -> ~12, 0.05 -> ~10
  const zoom = 14 - Math.log2(latitudeDelta / 0.008);
  return Math.round(Math.max(8, Math.min(20, zoom)));
}
