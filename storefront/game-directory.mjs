import { escapeHtml as e, gameImage } from './shared.mjs';
import { matchesCatalog, compareGameNames } from '../public/catalog-model.mjs';

const initials = name => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toLocaleUpperCase('vi');
export function gameDirectory(games, query = '', { category = '', sort = 'a-z' } = {}) {
  sort = sort === 'z-a' ? 'z-a' : 'a-z';
  const categories = new Map();
  for (const game of games) {
    if (!game.category_id || !game.category_name) continue;
    const item = categories.get(game.category_id) || { id: game.category_id, name: game.category_name, count: 0 };
    item.count++; categories.set(item.id, item);
  }
  const href = id => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (id) params.set('category', id);
    if (sort !== 'a-z') params.set('sort', sort);
    return '/nap-game' + (params.size ? '?' + params : '');
  };
  const filter = (id, name, count) => `<a class="directory-filter ${category === id ? 'is-active' : ''}" href="${e(href(id))}" data-category-filter="${e(id)}" ${category === id ? 'aria-current="true"' : ''}>${e(name)}<span>${count}</span></a>`;
  const visible = games.filter(game => matchesCatalog(game, query, category)).length;
  const cards = [...games].sort((a, b) => compareGameNames(a, b, sort)).map(game => `<a class="topup-game-card directory-card" href="/nap-game/${e(game.slug)}" title="${e(game.name)}" data-catalog-card data-search="${e(game.name.toLocaleLowerCase('vi'))}" data-name="${e(game.name)}" data-category="${e(game.category_id || '')}" ${matchesCatalog(game, query, category) ? '' : 'hidden'}>
    <span class="directory-image-fallback" aria-hidden="true">${e(initials(game.name))}</span><img src="${e(gameImage(game))}" alt="" loading="lazy" data-home-image>
    <div class="directory-card-body"><span class="directory-avatar" aria-hidden="true"><span>${e(initials(game.name))}</span><img class="directory-card-icon" src="${e(gameImage(game, 'thumbnail'))}" alt="" loading="lazy" data-home-image></span><span class="directory-card-copy"><strong>${e(game.name)}</strong><small>${e(game.category_name || (game.mode === 'login' ? 'Nạp login' : 'Nạp UID'))}</small></span><span class="topup-game-arrow" aria-hidden="true">↗</span></div>
  </a>`).join('');
  return `<div class="wrap topup-page game-directory">
    <nav class="breadcrumbs" aria-label="Đường dẫn"><a href="/">Trang chủ</a><span aria-hidden="true">/</span><span aria-current="page">Nạp game</span></nav>
    <section class="directory-head" aria-labelledby="catalogTitle"><div><h1 id="catalogTitle">Nạp game</h1><p>Chọn game bạn muốn nạp.</p></div></section>
    <section class="directory-content" aria-label="Kho game"><div class="directory-toolbar"><form action="/nap-game" method="get" class="directory-tools"><label class="directory-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="catalogSearch" name="q" type="search" value="${e(query)}" placeholder="Tìm tên game…" aria-label="Tìm tên game" maxlength="100"></label><input type="hidden" name="category" value="${e(category)}"><label class="directory-sort"><span class="directory-sr-only">Sắp xếp game</span><select id="catalogSort" name="sort" aria-label="Sắp xếp game"><option value="a-z" ${sort === 'a-z' ? 'selected' : ''}>Tên A–Z</option><option value="z-a" ${sort === 'z-a' ? 'selected' : ''}>Tên Z–A</option></select></label><button class="directory-sr-only" type="submit">Tìm game</button></form></div><div class="directory-browser-bar"><nav class="directory-filters" aria-label="Phân loại game">${filter('', 'Tất cả', games.length)}${[...categories.values()].sort((a,b) => compareGameNames(a,b)).map(item => filter(item.id, item.name, item.count)).join('')}</nav><p class="directory-result-count" role="status"><span id="catalogCount">${visible}</span> game</p></div>
    <div class="topup-game-grid directory-grid">${cards}</div><div id="catalogEmpty" class="directory-empty" ${visible ? 'hidden' : ''}><span aria-hidden="true">⌕</span><h2>${games.length ? 'Không tìm thấy game' : 'Kho game đang được cập nhật'}</h2><p>${games.length ? 'Thử tên khác hoặc chọn lại phân loại.' : 'Bạn quay lại sau nhé.'}</p><a href="/nap-game">Xóa bộ lọc ↗</a></div></section>
  </div>`;
}
