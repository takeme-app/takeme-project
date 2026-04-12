/** Cidade a partir de endereço PT-BR comum ("..., Cidade, UF"). */
export function guessCityFromPtAddress(address: string): string {
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2] ?? parts[parts.length - 1] ?? '';
  }
  return parts[0] ?? '';
}
