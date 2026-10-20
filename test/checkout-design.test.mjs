import test from 'node:test';
import assert from 'node:assert/strict';
import { gameCheckout } from '../storefront/game-checkout.mjs';

const game = { name: 'Genshin Impact', slug: 'genshin-impact', mode: 'uid', image: '/banner.png', thumbnail: '/avatar.png' };
const packages = [
  { package_id: 'p1', package_name: '60 Genesis Crystals', nominal: '60', customer_cents: 2000000 },
  { package_id: 'p2', package_name: '300 Genesis Crystals', nominal: '300', customer_cents: 8500000, badge: 'Tặng thêm' },
];
test('checkout exposes real inputs, initial selection and honest UID help without dummy tabs', () => {
  const html = gameCheckout(game, packages, null, 'test-key');
  assert.match(html, /name="idempotency_key" value="test-key"/);
  assert.match(html, /name="return_to" value="\/nap-game\/genshin-impact"/);
  assert.match(html, /for="target"/);
  assert.match(html, /id="target" name="uid"/);
  assert.match(html, /<details class="checkout-guide">/);
  assert.doesNotMatch(html, /data-verify-uid|package-tab|Asia \(AS\)|Đối soát tự động/);
  assert.equal((html.match(/class="package-choice"/g) || []).length, 2);
  assert.match(html, /name="package_id" value="p1"[^>]+checked/);
  assert.match(html, /id="selectedPackageName">60 Genesis Crystals/);
  assert.match(html, /id="orderTotal" aria-live="polite">20\.000/);
  assert.match(html, /class="package-bonus">Tặng thêm/);
  assert.match(html, /name="payment_method" value="direct"[^>]+checked/);
  assert.match(html, /name="payment_method" value="wallet"[^>]+disabled/);
});
test('login games and signed-in wallet checkout preserve submission semantics and escape product data', () => {
  const html = gameCheckout({ ...game, mode: 'login' }, [{ ...packages[0], package_name: '<script>test</script>', package_image: '/crystals.webp' }], { email: 'customer@example.com' }, 'key');
  assert.match(html, /id="target" name="login"/);
  assert.match(html, /name="payment_method" value="wallet"[^>]+checked/);
  assert.match(html, /src="\/crystals.webp"/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Không nhập mật khẩu/);
});
