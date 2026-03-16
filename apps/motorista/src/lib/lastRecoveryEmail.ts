import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@take_me_motorista_last_recovery_email';

let lastRecoveryEmail = '';

export function setLastRecoveryEmail(email: string): void {
  const value = email.trim();
  lastRecoveryEmail = value;
  if (value) {
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  } else {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }
}

export function getLastRecoveryEmail(): string {
  return lastRecoveryEmail;
}

export async function loadLastRecoveryEmail(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      lastRecoveryEmail = stored;
      return stored;
    }
  } catch (_) {}
  return lastRecoveryEmail;
}
