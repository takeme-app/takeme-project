/**
 * Último e-mail para o qual enviamos link de recuperação.
 * Usado como fallback na tela de reenvio quando os params da navegação não vêm preenchidos.
 */
let lastRecoveryEmail = '';

export function setLastRecoveryEmail(email: string): void {
  lastRecoveryEmail = email.trim();
}

export function getLastRecoveryEmail(): string {
  return lastRecoveryEmail;
}
