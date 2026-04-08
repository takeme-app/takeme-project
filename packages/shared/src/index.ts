/**
 * @take-me/shared
 * Tipos, cliente Supabase e utilitários compartilhados entre os apps Take Me.
 */

export { createSupabaseClient } from './supabase';
export type { Database } from './types';
export { mapboxForwardGeocode, mapboxGeocodeSuggest } from './mapboxForwardGeocode';
export type { MapboxGeocodeResult } from './mapboxForwardGeocode';
export { googleForwardGeocode, googleGeocodeSuggest } from './googleMapsGeocode';
export type { GoogleGeocodeResult } from './googleMapsGeocode';
