/**
 * Validação de formato de e-mail.
 *
 * Regra prática para UX/formulários (não RFC 5322 completo): um rótulo antes do `@`,
 * domínio com ao menos um ponto e TLD de 2+ caracteres. Cobre os casos reais (`@gmail.com`,
 * `@exemplo.com.br`) e rejeita os mais comuns (`foo@`, `foo@bar`, `@bar.com`, espaços).
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmailFormat(email: string): boolean {
  const v = email.trim();
  if (v.length === 0 || v.length > 254) return false;
  return EMAIL_REGEX.test(v);
}
