import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { once } from 'node:events';

test('SSR routes and native forms support a complete customer journey', { timeout: 30000 }, async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'zet-ssr-'));
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0', DB_PATH: join(tempDir, 'test.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', data => { errors += data; });
  try {
    const base = await new Promise((resolveBase, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server did not start: ' + errors)), 10000);
      child.stdout.on('data', data => {
        const match = String(data).match(/http:\/\/localhost:\d+/);
        if (match) { clearTimeout(timeout); resolveBase(match[0]); }
      });
      child.once('exit', () => { clearTimeout(timeout); reject(new Error('Server exited: ' + errors)); });
    });
    const get = (path, cookie = '') => fetch(base + path, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
    const form = (path, fields, cookie = '') => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) }, body: new URLSearchParams(fields), redirect: 'manual' });
    let cookie;
    let orderLocation;
    await t.test('HTML already contains game content and real navigation before JavaScript', async () => {
      const response = await get('/');
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      assert.match(html, /class="catalog-card"[^>]*href="\/nap-game\/genshin-impact"/);
      assert.match(html, /Game bán chạy/);
      assert.match(html, /Danh mục game/);
      assert.match(html, /class="game-category" href="\/nap-game\/genshin-impact"/);
      assert.doesNotMatch(html, /20\.000/);
      assert.match(html, /href="\/lich-su"/);
      assert.match(html, /href="\/tin-tuc"/);
      assert.doesNotMatch(html, /Đang tải danh sách|{{\w+}}/);
      assert.equal((html.match(/<h1\b/g) || []).length, 1);
      const filtered = await (await get('/nap-game?q=genshin')).text();
      assert.match(filtered, /Chọn game\.<br><em>Nạp ngay\./);
      assert.match(filtered, /class="topup-game-card" href="\/nap-game\/genshin-impact"/);
      assert.doesNotMatch(filtered, /20\.000/);
      assert.match(filtered, /honkai-star-rail" hidden data-catalog-card/);
      assert.match(filtered, /id="catalogCount">1</);
    });
    await t.test('game, editorial and not-found routes render independent documents', async () => {
      const game = await (await get('/nap-game/genshin-impact')).text();
      assert.match(game, /name="package_id"/);
      assert.match(game, /name="idempotency_key"/);
      assert.match(game, /action="\/dat-don"/);
      assert.match(game, /60 Genesis Crystals/);
      assert.match(game, /20\.000/);
      const article = await (await get('/tin-tuc/kiem-tra-uid-truoc-khi-nap')).text();
      assert.match(article, /Tìm UID trong trò chơi/);
      assert.doesNotMatch(article, /class="catalog-grid"/);
      assert.equal((await get('/nap-game/does-not-exist')).status, 404);
      assert.equal((await get('/unknown')).status, 404);
      assert.equal((await get('/api/unknown')).headers.get('content-type'), 'application/json; charset=utf-8');
      assert.equal((await get('/nap-game/')).status, 308);
      assert.equal((await get('/fonts/signika-negative-variable.ttf')).headers.get('content-type'), 'font/ttf');
      assert.equal((await get('/navigation.js')).status, 200);
    });
    await t.test('guest history is gated and native login rejects unsafe return locations', async () => {
      const history = await (await get('/lich-su')).text();
      assert.match(history, /Đăng nhập để tiếp tục/);
      assert.doesNotMatch(history, /customer@example.com/);
      const invalid = await form('/dang-nhap', { email: 'customer@example.com', password: 'incorrect', next: '//evil.test' });
      assert.equal(invalid.status, 303);
      assert.match(invalid.headers.get('location'), /^\/dang-nhap\?error=1&next=%2Ftai-khoan$/);
      const login = await form('/dang-nhap', { email: 'customer@example.com', password: 'customer123', next: '/nap-game/genshin-impact' });
      assert.equal(login.status, 303);
      assert.equal(login.headers.get('location'), '/nap-game/genshin-impact');
      cookie = login.headers.get('set-cookie').split(';')[0];
      const account = await get('/tai-khoan', cookie);
      assert.equal(account.headers.get('cache-control'), 'private, no-store');
      assert.match(await account.text(), /customer@example.com/);
    });
    await t.test('native checkout uses server prices and one idempotency key per order', async () => {
      const html = await (await get('/nap-game/genshin-impact', cookie)).text();
      const packageId = html.match(/name="package_id" value="([^"]+)"/)[1];
      const key = html.match(/name="idempotency_key" value="([^"]+)"/)[1];
      const fields = { package_id: packageId, idempotency_key: key, uid: 'test-fixture-uid', payment_method: 'direct', return_to: '/nap-game/genshin-impact', price_cents: '1' };
      const created = await form('/dat-don', fields, cookie);
      assert.equal(created.status, 303);
      orderLocation = created.headers.get('location');
      assert.match(orderLocation, /^\/lich-su\/GP/);
      const duplicate = await form('/dat-don', fields, cookie);
      assert.equal(duplicate.headers.get('location'), orderLocation);
      const detail = await (await get(orderLocation, cookie)).text();
      assert.match(detail, /20\.000/);
      assert.match(detail, /Chờ thanh toán/);
      const invalid = await form('/dat-don', { ...fields, idempotency_key: '' }, cookie);
      assert.equal(new URL(invalid.headers.get('location'), base).searchParams.get('error'), 'Thiếu khóa chống gửi trùng');
      const rows = await (await get('/api/orders', cookie)).json();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].price_cents, 20000);
    });
    await t.test('another account cannot read the order and JSON API still works', async () => {
      const response = await form('/dang-nhap', { email: 'ctv@example.com', password: 'ctv12345', next: '/tai-khoan' });
      const otherCookie = response.headers.get('set-cookie').split(';')[0];
      assert.equal((await get(orderLocation, otherCookie)).status, 404);
      const gameRows = await (await get('/api/games')).json();
      const packageId = gameRows.find(row => row.slug === 'genshin-impact').package_id;
      const missingKey = await fetch(base + '/api/orders', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ package_id: packageId, target: { uid: 'fixture' } }) });
      assert.equal(missingKey.status, 400);
      const walletOrder = await fetch(base + '/api/orders', { method: 'POST', headers: { cookie, 'content-type': 'application/json', 'idempotency-key': 'wallet-fixture' }, body: JSON.stringify({ package_id: packageId, target: { uid: 'fixture' }, payment_method: 'wallet' }) });
      assert.equal(walletOrder.status, 201);
      const me = await (await get('/api/me', cookie)).json();
      assert.equal(me.wallet_cents, 480000);
      const logout = await form('/dang-xuat', {}, cookie);
      assert.equal(logout.headers.get('location'), '/');
      assert.equal((await get('/api/me', cookie)).status, 401);
    });
  } finally {
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
    assert.equal(dirname(resolve(tempDir)), resolve(tmpdir()));
    assert.ok(basename(tempDir).startsWith('zet-ssr-'));
    await rm(tempDir, { recursive: true, force: true });
  }
});
