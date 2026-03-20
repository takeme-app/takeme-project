import { onlyDigits } from './formatCpf';

/**
 * Máscara monetária BRL enquanto digita (centavos).
 * Ex.: digitar 5000 -> "50,00"; exibe prefixo R$
 */
export function formatCurrencyBRLInput(value: string): string {
  const digits = onlyDigits(value);
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  if (Number.isNaN(cents)) return '';
  const reais = cents / 100;
  return reais.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte string mascarada "1.234,56" ou "1234,56" para número. */
export function parseCurrencyBRLToNumber(formatted: string): number | null {
  const trimmed = formatted.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}
