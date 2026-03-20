/** Divide "Marcos Wagner" em primeiro nome e sobrenome (restante). */
export function splitFullName(full: string): { first: string; last: string } {
  const t = full.trim();
  if (!t) return { first: '', last: '' };
  const i = t.indexOf(' ');
  if (i === -1) return { first: t, last: '' };
  return { first: t.slice(0, i), last: t.slice(i + 1).trim() };
}

export function joinFullName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(' ');
}
