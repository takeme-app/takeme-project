export type LatLng = { latitude: number; longitude: number };

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export function toMapboxCoord(point: LatLng): [number, number] {
  return [point.longitude, point.latitude];
}

export function regionToZoomLevel(region: MapRegion): number {
  const { latitudeDelta } = region;
  const zoom = 14 - Math.log2(latitudeDelta / 0.008);
  return Math.round(Math.max(8, Math.min(20, zoom)));
}
