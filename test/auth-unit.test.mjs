import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../backend/utils/password.mjs';
import { parse, loginSchema, registerSchema, orderSchema } from '../backend/utils/validation.mjs';
import { adminCatalogPage } from '../storefront/admin-pages.mjs';

test('backend login hashes and verifies passwords with bcrypt', async () => {
  const stored = await hashPassword('correct-horse-battery');
  assert.match(stored, /^\$2[aby]\$/);
  assert.equal(await verifyPassword('correct-horse-battery', stored), true);
  assert.equal(await verifyPassword('wrong-password', stored), false);
});

test('backend login and order input validation reject invalid data', () => {
  assert.throws(() => parse(loginSchema, { email: 'bad', password: 'short' }), /Dữ liệu đầu vào/);
  assert.equal(parse(registerSchema, { email: 'new@example.com', password: 'long-enough-password' }).email, 'new@example.com');
  assert.throws(() => parse(orderSchema, { package_id: 'pkg', target: {} }), /Dữ liệu đầu vào/);
  assert.deepEqual(parse(orderSchema, { package_id: 'pkg', target: { uid: 'player-1' } }).payment_method, 'direct');
});

test('admin catalog page exposes game, package, and order management sections', () => {
  const html = adminCatalogPage([{ id: 'game-1', slug: 'genshin-impact', name: 'Genshin Impact', mode: 'uid', platform: 'mobile', image: '/game.webp', active: true, packages: [{ id: 'package-1', name: '60 Genesis', nominal: '60', image: '', badge: '', active: true, customer_cents: 20000, ctv_cents: 16000 }] }], 'csrf-token');
  assert.match(html, /id="games"/);
  assert.match(html, /data-game-id="game-1"/);
  assert.match(html, /data-game-field="image"/);
  assert.match(html, /data-package-id="package-1"/);
  assert.match(html, /id="orders"/);
});
