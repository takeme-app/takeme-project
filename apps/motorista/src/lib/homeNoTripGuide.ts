import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persistência do "modal de dicas" da Home do motorista (guia exibido
 * quando não há corrida ativa). O objetivo é mostrar o guia apenas uma
 * vez por usuário — depois que ele tocar em "Entendi" não reabrimos
 * automaticamente a cada foco da Home, o que tornava o carregamento
 * perceptivelmente lento.
 */
const PREFIX = 'home_no_trip_guide_seen_v1_';

export function homeNoTripGuideStorageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

export async function hasSeenHomeNoTripGuide(userId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(homeNoTripGuideStorageKey(userId));
    return v === '1';
  } catch {
    return false;
  }
}

export async function markHomeNoTripGuideSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(homeNoTripGuideStorageKey(userId), '1');
  } catch {
    /* falha silenciosa: no pior caso mostramos o guia de novo */
  }
}
