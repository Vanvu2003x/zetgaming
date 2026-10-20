export const normalizeGameName = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi');
export function matchesCatalog(game, query = '', category = '') {
  return normalizeGameName(game.name).includes(normalizeGameName(query.trim())) && (!category || game.category_id === category);
}
export function compareGameNames(a, b, sort = 'a-z') {
  return new Intl.Collator('vi', { sensitivity: 'base', numeric: true }).compare(a.name, b.name) * (sort === 'z-a' ? -1 : 1);
}
