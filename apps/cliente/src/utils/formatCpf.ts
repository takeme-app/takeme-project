/** Remove tudo que não for dígito. */
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

/** Formata até 11 dígitos como CPF: 000.000.000-00 */
export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Exibe CPF para leitura: se tiver 11 dígitos, formata; senão devolve o valor limpo ou '—'. */
export function displayCpf(raw: string | null | undefined): string {
  if (raw == null || !raw.trim()) return '—';
  const d = onlyDigits(raw);
  return d.length === 11 ? formatCpf(d) : raw.trim();
}
