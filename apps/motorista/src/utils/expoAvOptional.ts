/**
 * Carrega expo-av sob demanda para não quebrar o app se o binário nativo
 * ainda não incluir ExponentAV (dev client antigo). Falhas viram `null`.
 */
export async function loadExpoAv(): Promise<typeof import('expo-av') | null> {
  try {
    return await import('expo-av');
  } catch {
    return null;
  }
}
