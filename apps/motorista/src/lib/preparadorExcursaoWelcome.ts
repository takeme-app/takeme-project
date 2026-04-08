import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'preparador_excursao_welcome_done_v1_';

export function welcomeStorageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

export async function hasSeenPreparadorExcursaoWelcome(userId: string): Promise<boolean> {
  const v = await AsyncStorage.getItem(welcomeStorageKey(userId));
  return v === '1';
}

export async function markPreparadorExcursaoWelcomeSeen(userId: string): Promise<void> {
  await AsyncStorage.setItem(welcomeStorageKey(userId), '1');
}
