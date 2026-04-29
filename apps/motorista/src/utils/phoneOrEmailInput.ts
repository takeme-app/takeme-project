/** Máscara progressiva de telefone BR: `(xx) xxxxx-xxxx` / `(xx) xxxx-xxxx`. */
export function formatPhoneBRMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Telefone vs e-mail no campo unificado: começa com dígito/+/(/espaço → telefone.
 * Contém `@` → sempre tratado como e-mail (evita máscara em `nome@`).
 */
export function detectPhoneOrEmailChannel(raw: string): 'email' | 'phone' {
  const trimmed = raw.trim();
  if (!trimmed) return 'email';
  if (trimmed.includes('@')) return 'email';
  return /^[+(\s\d]/.test(trimmed) ? 'phone' : 'email';
}
