import type { LatLng } from '../components/googleMaps/geometry';
import { haversineMeters, bearingBetweenLatLng } from './navigationCamera';

export type RouteSnapResult = {
  snapped: LatLng;
  /** Índice do vértice inicial do segmento onde o snap ocorreu. */
  segmentIndex: number;
  /** Distância do GPS original ao ponto na polyline (m). */
  distanceM: number;
  /** Azimute do segmento da rota no ponto (graus). */
  segmentBearingDeg: number;
};

/** Ponto mais próximo no segmento AB (t em [0,1]). */
function closestOnSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; t: number } {
  const ax = a.longitude;
  const ay = a.latitude;
  const bx = b.longitude;
  const by = b.latitude;
  const px = p.longitude;
  const py = p.latitude;
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-18) return { point: { latitude: ay, longitude: ax }, t: 0 };
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  return {
    point: { latitude: ay + t * aby, longitude: ax + t * abx },
    t,
  };
}

/**
 * Projeta o GPS na polyline mais próxima (map matching simples).
 * Se a distância mínima for > maxSnapMeters, devolve o ponto original e distanceM alto.
 */
export function snapToRoutePolyline(
  point: LatLng,
  polyline: LatLng[],
  maxSnapMeters: number,
): RouteSnapResult {
  if (polyline.length < 2) {
    return {
      snapped: { ...point },
      segmentIndex: 0,
      distanceM: Infinity,
      segmentBearingDeg: 0,
    };
  }

  let bestDist = Infinity;
  let bestPoint = point;
  let bestSeg = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const { point: q } = closestOnSegment(point, a, b);
    const d = haversineMeters(point.latitude, point.longitude, q.latitude, q.longitude);
    if (d < bestDist) {
      bestDist = d;
      bestPoint = q;
      bestSeg = i;
    }
  }

  const a = polyline[bestSeg];
  const b = polyline[bestSeg + 1];
  const segBear = bearingBetweenLatLng(a.latitude, a.longitude, b.latitude, b.longitude);

  if (bestDist > maxSnapMeters) {
    return {
      snapped: { ...point },
      segmentIndex: bestSeg,
      distanceM: bestDist,
      segmentBearingDeg: segBear,
    };
  }

  return {
    snapped: bestPoint,
    segmentIndex: bestSeg,
    distanceM: bestDist,
    segmentBearingDeg: segBear,
  };
}

/** Polyline a partir do ponto encaixado até o fim (rota “começa” no carro). */
export function trimPolylineFromSnap(
  polyline: LatLng[],
  segmentIndex: number,
  snapped: LatLng,
): LatLng[] {
  if (polyline.length < 2) return polyline;
  const tail = polyline.slice(segmentIndex + 1);
  if (tail.length === 0) {
    return [snapped, polyline[polyline.length - 1]];
  }
  const firstTail = tail[0];
  const gap = haversineMeters(
    snapped.latitude,
    snapped.longitude,
    firstTail.latitude,
    firstTail.longitude,
  );
  if (gap < 2) {
    return [snapped, ...tail.slice(1)];
  }
  return [snapped, ...tail];
}
