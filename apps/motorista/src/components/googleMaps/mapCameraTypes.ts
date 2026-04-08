import type { LatLng } from './geometry';

/** Passo de câmera aplicado no Mapbox (`@rnmapbox/maps` Camera / bounds). */
export type MapCameraStop = {
  type: 'CameraStop';
  centerCoordinate: [number, number];
  zoomLevel: number;
  animationDuration: number;
  animationMode: 'none' | 'easeTo' | 'linearTo';
  /** Se ≥2 pontos, o mapa usa fitToCoordinates em vez de zoom centrado. */
  fitCoordinates?: LatLng[];
};

export type MapCameraSetConfig =
  | MapCameraStop
  | { readonly type: 'CameraStops'; stops: MapCameraStop[] };
