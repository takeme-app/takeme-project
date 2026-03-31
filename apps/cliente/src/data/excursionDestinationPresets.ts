/**
 * Destinos frequentes para excursão: coordenadas fixas evitam erro de digitação e garantem rota no mapa.
 * Ajuste a lista conforme as cidades que o Take Me atende.
 */
export type ExcursionDestinationPreset = {
  id: string;
  /** Rótulo no chip */
  label: string;
  /** Valor salvo em excursion_requests.destination */
  destinationText: string;
  lat: number;
  lng: number;
};

export const EXCURSION_DESTINATION_PRESETS: ExcursionDestinationPreset[] = [
  { id: 'viana-ma', label: 'Viana, MA', destinationText: 'Viana, MA', lat: -3.2203, lng: -42.9961 },
  { id: 'sao-luis-ma', label: 'São Luís, MA', destinationText: 'São Luís, MA', lat: -2.5387, lng: -44.2825 },
  { id: 'fortaleza-ce', label: 'Fortaleza, CE', destinationText: 'Fortaleza, CE', lat: -3.7319, lng: -38.5267 },
  { id: 'teresina-pi', label: 'Teresina, PI', destinationText: 'Teresina, PI', lat: -5.0892, lng: -42.8019 },
];

export const EXCURSION_PRESET_OTHER_ID = 'outro';
