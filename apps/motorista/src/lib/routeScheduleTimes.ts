import { latLngFromDbColumns, DEFAULT_MAP_REGION_BR } from '../components/googleMaps';

/**
 * Coordenadas para `scheduled_trips` (colunas NOT NULL): copia de `worker_routes` quando válidas;
 * senão fallback no Brasil (nunca 0,0 — evita mapa no Atlântico).
 */
export function coordsForScheduledTripFromRoute(row: {
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
}): {
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
} {
  const o = latLngFromDbColumns(row.origin_lat, row.origin_lng);
  const d = latLngFromDbColumns(row.destination_lat, row.destination_lng);
  if (o && d) {
    return {
      origin_lat: o.latitude,
      origin_lng: o.longitude,
      destination_lat: d.latitude,
      destination_lng: d.longitude,
    };
  }
  if (o && !d) {
    return {
      origin_lat: o.latitude,
      origin_lng: o.longitude,
      destination_lat: o.latitude + 0.04,
      destination_lng: o.longitude + 0.04,
    };
  }
  if (!o && d) {
    return {
      origin_lat: d.latitude - 0.04,
      origin_lng: d.longitude - 0.04,
      destination_lat: d.latitude,
      destination_lng: d.longitude,
    };
  }
  const c = DEFAULT_MAP_REGION_BR;
  return {
    origin_lat: c.latitude,
    origin_lng: c.longitude,
    destination_lat: c.latitude + 0.05,
    destination_lng: c.longitude + 0.05,
  };
}

/** Aceita "HH:MM", "H:MM", "HH:MM:SS" (Postgres `time` em texto). */
export function normalizeRouteTimeForSchedule(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${h}:${String(min).padStart(2, '0')}`;
}

/**
 * Próxima data/hora de partida > agora (calendário local), para o weekday e horários fixos da rota.
 * dayNum: 0=Dom … 6=Sáb (igual Date.getDay()).
 */
export function computeNextDepartureArrivalFromWeekday(
  dayNum: number,
  departureTimeHHMM: string,
  arrivalTimeHHMM: string,
): { departureAt: Date; arrivalAt: Date } {
  if (!Number.isInteger(dayNum) || dayNum < 0 || dayNum > 6) {
    throw new Error('Dia da semana inválido.');
  }
  const depNorm = normalizeRouteTimeForSchedule(departureTimeHHMM);
  const arrNorm = normalizeRouteTimeForSchedule(arrivalTimeHHMM);
  if (!depNorm || !arrNorm) {
    throw new Error('Horário inválido.');
  }
  const depMatch = depNorm.match(/^(\d{1,2}):(\d{2})$/);
  const arrMatch = arrNorm.match(/^(\d{1,2}):(\d{2})$/);
  if (!depMatch || !arrMatch) {
    throw new Error('Horário inválido.');
  }
  const depH = parseInt(depMatch[1], 10);
  const depMin = parseInt(depMatch[2], 10);
  const arrH = parseInt(arrMatch[1], 10);
  const arrMin = parseInt(arrMatch[2], 10);

  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const dow = now.getDay();
  let addDays = (dayNum - dow + 7) % 7;
  let departureAt = new Date(todayMid);
  departureAt.setDate(departureAt.getDate() + addDays);
  departureAt.setHours(depH, depMin, 0, 0);
  if (departureAt.getTime() <= now.getTime()) {
    departureAt.setDate(departureAt.getDate() + 7);
  }

  const baseCal = new Date(
    departureAt.getFullYear(),
    departureAt.getMonth(),
    departureAt.getDate(),
    0,
    0,
    0,
    0,
  );
  const arrivalAt = new Date(baseCal);
  arrivalAt.setHours(arrH, arrMin, 0, 0);
  if (arrivalAt.getTime() <= departureAt.getTime()) {
    arrivalAt.setDate(arrivalAt.getDate() + 1);
  }
  return { departureAt, arrivalAt };
}
