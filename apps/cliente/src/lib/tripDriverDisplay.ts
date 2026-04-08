/** Texto para linha de veículo (checkout / acompanhamento). */
export function formatVehicleDescription(
  model?: string | null,
  year?: number | null,
  plate?: string | null
): string {
  const modelClean = model?.trim() ?? '';
  const yearPart = year != null && year > 0 ? String(year) : '';
  const modelPart = [modelClean, yearPart].filter(Boolean).join(' ').trim();
  const plateClean = plate?.trim() ?? '';
  if (modelPart && plateClean) return `${modelPart} • Placa ${plateClean}`;
  if (plateClean) return `Placa ${plateClean}`;
  if (modelPart) return modelPart;
  return 'Veículo a confirmar';
}

/** Exibição da nota (profiles.rating pode ser null ou 0). */
export function formatDriverRatingLabel(rating: number): string {
  if (rating > 0 && rating <= 5) return rating.toFixed(1);
  return '—';
}
