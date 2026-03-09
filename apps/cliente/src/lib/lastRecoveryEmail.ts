import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@take_me_last_recovery_email';

/**
 * Último e-mail para o qual enviamos link de recuperação.
 * Persistido em AsyncStorage para não perder ao reabrir o app ou quando os params da navegação se perdem.
 */
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

/** Carrega o e-mail persistido do AsyncStorage (para uso na tela de reenvio quando params estão vazios). */
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
