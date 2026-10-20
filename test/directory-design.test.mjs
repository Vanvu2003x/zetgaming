import test from 'node:test';
import assert from 'node:assert/strict';
import { gameDirectory } from '../storefront/game-directory.mjs';
import { matchesCatalog, compareGameNames } from '../public/catalog-model.mjs';

const games = [
  { name: 'Đấu trường', slug: 'dau-truong', category_id: 'c1', category_name: 'Nạp UID', image: '/banner.png', thumbnail: '/avatar.png' },
  { name: 'Genshin Impact', slug: 'genshin-impact', category_id: 'c2', category_name: 'Nạp login', image: '/genshin.png' },
];
test('directory search supports accents, combined categories and actual name sorting', () => {
  assert.equal(matchesCatalog(games[0], 'dau truong', 'c1'), true);
  assert.equal(matchesCatalog(games[0], 'dau', 'c2'), false);
  assert.equal(matchesCatalog(games[0], '  ĐẤU  '), true);
  assert.deepEqual([...games].sort((a,b) => compareGameNames(a,b,'z-a')).map(g => g.slug), ['genshin-impact','dau-truong']);
});
test('SSR directory uses admin categories, functional links and distinct game images', () => {
  const html = gameDirectory(games, 'dau', { category: 'c1', sort: 'z-a' });
  assert.match(html, /data-category-filter="c1" aria-current="true"/);
  assert.match(html, /href="\/nap-game\?q=dau&amp;category=c2&amp;sort=z-a"/);
  assert.match(html, /id="catalogCount">1</);
  assert.match(html, /href="\/nap-game\/genshin-impact"[^>]+hidden/);
  assert.match(html, /class="directory-card-icon" src="\/avatar.png"/);
  assert.match(html, /<img src="\/banner.png"/);
  assert.match(html, /name="sort"/);
  assert.doesNotMatch(html, /data-platform-filter|Phổ biến|role="tablist"/);
  assert.match(gameDirectory([]), /Kho game đang được cập nhật/);
  assert.doesNotMatch(gameDirectory([{ ...games[0], category_name: '<script>bad</script>' }], '" onfocus="bad'), /<script>|value="" onfocus/);
});
