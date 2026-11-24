import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createFrontend } from '../server.mjs';

test('separate admin origin protects pages and uses an independent layout', async t => {
  const api = express();
  api.use(express.json());
  api.get('/api/csrf', (_req, res) => res.json({ csrf_token: 'test-csrf' }));
  api.get('/api/auth/me', (req, res) => {
    if (!req.headers.cookie) return res.status(401).json({ error: 'Login' });
    res.json({ email: 'operator@example.com', role: req.headers.cookie.includes('customer') ? 'customer' : 'admin' });
  });
  api.get('/api/admin/games', (_req, res) => res.json([]));
  api.get('/api/orders', (_req, res) => res.json([]));
  api.get('/api/admin/ctvs', (_req, res) => res.json([]));
  api.post('/api/admin/uploads', express.raw({ type: 'image/png' }), (req, res) => res.json({ bytes: req.body.length, type: req.get('content-type') }));
  api.post('/api/auth/login', (req, res) => {
    if (req.body._csrf !== 'test-csrf') return res.status(403).json({ error: 'Phiên không hợp lệ' });
    if (req.body.password !== 'test-password') return res.status(401).json({ error: 'Sai thông tin' });
    res.cookie('session', 'test', { httpOnly: true }).json({ user: { role: req.body.email === 'admin@example.com' ? 'admin' : 'customer' } });
  });
  const upstream = api.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const app = createFrontend({ adminOnly: true, backendUrl: `http://127.0.0.1:${upstream.address().port}` }).listen(0, '127.0.0.1');
  t.after(() => { app.closeAllConnections(); app.close(); upstream.closeAllConnections(); upstream.close(); });
  await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  const get = (path, cookie) => fetch(base + path, { redirect: 'manual', headers: cookie ? { cookie } : {} });
  const guest = await get('/');
  assert.equal(guest.status, 303);
  assert.equal(guest.headers.get('location'), '/login');
  assert.equal((await get('/games', 'session=customer')).status, 403);
  const login = await get('/login');
  assert.equal(login.status, 200);
  assert.match(await login.text(), /name="_csrf" value="test-csrf"/);
  const signIn = fields => fetch(base + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf: 'test-csrf', password: 'test-password', ...fields }) });
  const signedIn = await signIn({ email: 'admin@example.com' });
  assert.equal(signedIn.status, 303);
  assert.equal(signedIn.headers.get('location'), '/');
  assert.match(signedIn.headers.get('set-cookie'), /HttpOnly/);
  assert.match((await signIn({ email: 'customer@example.com' })).headers.get('location'), /^\/login\?error=/);
  assert.match((await signIn({ email: 'admin@example.com', _csrf: 'invalid' })).headers.get('location'), /^\/login\?error=/);
  const screens = ['overview', 'orders', 'coupons', 'payment', 'games', 'packages', 'categories', 'content', 'customers', 'ctvs', 'tiers', 'reports', 'security'];
  for (const screen of screens) {
    const path = screen === 'overview' ? '/' : '/' + screen;
    const response = await get(path, 'session=admin');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const html = await response.text();
    assert.match(html, /admin-shell/);
    assert.ok(html.includes(`href="/assets/screen-${screen}.css"`));
    assert.doesNotMatch(html, /href="\/tiers"/);
    if (screen !== 'tiers') assert.ok(html.includes(`href="${path}" class="active" aria-current="page"`));
    const stylesheet = await get(`/assets/screen-${screen}.css`);
    assert.equal(stylesheet.status, 200, screen);
    assert.match(stylesheet.headers.get('content-type'), /text\/css/);
    await stylesheet.text();
    assert.doesNotMatch(html, /storefront.css|site-header|Barlow|<footer/);
  }
  assert.equal((await get('/missing', 'session=admin')).status, 404);
  const asset = await get('/assets/admin.js');
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.match(asset.headers.get('cache-control'), /no-store/);
  const publicImage=await get('/zetgaming-oauth-logo-120.png');
  assert.equal(publicImage.status,200);
  assert.match(publicImage.headers.get('content-type'),/image\/png/);
  const upload = await fetch(base + '/api/admin/uploads', { method: 'POST', headers: { 'content-type': 'image/png' }, body: Buffer.from([137, 80, 78, 71]) });
  assert.deepEqual(await upload.json(), { bytes: 4, type: 'image/png' });
});

test('storefront admin entry redirects to the configured separate origin', async t => {
  const app = createFrontend().listen(0, '127.0.0.1');
  await once(app, 'listening');
  t.after(() => { app.closeAllConnections(); app.close(); });
  const response = await fetch(`http://127.0.0.1:${app.address().port}/admin`, { redirect: 'manual' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), process.env.ADMIN_ORIGIN || 'http://localhost:4174');
});
