/** Slug para rotas de detalhe do preparador (ex.: lista de trechos de encomendas). */
export function preparadorEncomendaSlug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
