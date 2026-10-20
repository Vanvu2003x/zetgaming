import test from 'node:test';
import assert from 'node:assert/strict';
import { homePage } from '../storefront/catalog-pages.mjs';
import { renderStorefront } from '../storefront/render.mjs';

const game = { id: 'g', slug: 'genshin-impact', name: 'Genshin Impact', mode: 'uid', image: '/uploads/games/banner.png', thumbnail: '/uploads/games/thumbnail.png', customer_cents: 2500000 };
test('home collections keep real navigation and separate banner/thumbnail without advertising fake sales or prices', () => {
  const html = homePage([game]);
  assert.equal((html.match(/href="\/nap-game\/genshin-impact"/g) || []).length, 2);
  assert.match(html, /class="catalog-art"[^]*src="\/uploads\/games\/banner.png"/);
  assert.match(html, /class="home-game-icon"[^]*src="\/uploads\/games\/thumbnail.png"/);
  assert.match(html, /class="home-category-icon"[^]*src="\/uploads\/games\/thumbnail.png"/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /aria-labelledby="homeFeaturedTitle"/);
  assert.match(html, /aria-labelledby="homeDirectoryTitle"/);
  assert.doesNotMatch(html, /25\.000|Đã bán|TOP 1/);
  assert.match(homePage([]), /Game đang được cập nhật/);
  assert.doesNotMatch(homePage([{ ...game, name: '<script>alert(1)</script>' }]), /<script>/);
});
test('homepage styles are also loaded on other routes for client-side navigation back home', () => {
  const layout = '<html><head></head><body><main>{{content}}</main></body></html>';
  for (const path of ['/', '/tin-tuc']) {
    const page = renderStorefront({ url: new URL(path, 'http://localhost'), data: { rows: [game] }, user: null, layout });
    assert.equal(page.status, 200);
    assert.match(page.html, /href="\/home-discovery.css\?v=1"/);
  }
});
