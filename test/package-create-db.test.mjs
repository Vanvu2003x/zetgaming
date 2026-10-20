import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import cookieParser from 'cookie-parser';
import pg from 'pg';
import { packageCreateRouter } from '../backend/modules/catalog/package-create.mjs';
import { catalogRouter } from '../backend/modules/catalog/routes.mjs';
import { csrfToken } from '../backend/middleware/csrf.mjs';
import { gameCheckout } from '../storefront/game-checkout.mjs';

test('admin package creation stores game, image and price atomically and rejects invalid input', async t => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = await pool.connect();
  t.after(async () => { await db.query('ROLLBACK'); db.release(); await pool.end(); });
  await db.query('BEGIN');
  const actor = randomUUID(); const gameId = randomUUID();
  await db.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,'unused','admin')", [actor, actor + '@fixture.test']);
  await db.query("INSERT INTO games(id,slug,name,mode,image) VALUES($1,$1,'Fixture game','uid','/fixture.png')", [gameId]);
  const app = express();
  app.use(express.json(), cookieParser(), csrfToken, (req, _res, next) => { req.db = db; if (req.get('x-role')) req.user = { id: req.get('x-bad-actor') ? 'missing' : actor, role: req.get('x-role') }; next(); });
  app.get('/csrf', (req, res) => res.json({ token: req.csrfToken }));
  app.use('/api', packageCreateRouter, catalogRouter);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const seed = await fetch(base + '/csrf'); const { token } = await seed.json();
  const cookie = seed.headers.getSetCookie()[0].split(';')[0];
  const body = { game_id: gameId, name: '60 Crystals', customer_cents: 2500000, ctv_cents: 2000000, image: '/uploads/games/fixture.png' };
  const create = (fields = {}, role = 'admin', csrf = token, headers = {}) => fetch(base + '/api/admin/packages', { method: 'POST', headers: { cookie, 'x-csrf-token': csrf, 'content-type': 'application/json', ...(role ? { 'x-role': role } : {}), ...headers }, body: JSON.stringify({ ...body, ...fields }) });
  assert.equal((await create({}, null)).status, 401);
  assert.equal((await create({}, 'customer')).status, 403);
  assert.equal((await create({}, 'admin', 'bad')).status, 403);
  for (const fields of [{ name: '' }, { customer_cents: -1 }, { customer_cents: 1.25 }, { customer_cents: '25000' }, { image: 'javascript:alert(1)' }]) assert.equal((await create(fields)).status, 400);
  assert.equal((await create({ game_id: 'missing' })).status, 404);
  const response = await create(); assert.equal(response.status, 201);
  const pkg = await response.json();
  assert.equal(pkg.game_id, gameId); assert.equal(pkg.customer_cents, 2500000); assert.equal(pkg.image, body.image);
  const catalogResponse = await fetch(base + '/api/admin/games', { headers: { cookie, 'x-role': 'admin' } });
  const game = (await catalogResponse.json()).find(game => game.id === gameId);
  assert.equal(game.packages.find(item => item.id === pkg.id).ctv_cents, 2000000);
  assert.equal((await db.query("SELECT 1 FROM audit_events WHERE entity_id=$1 AND action='package.created'", [pkg.id])).rowCount, 1);
  // A failed audit must not leave a package or price behind.
  await db.query('SAVEPOINT failed_create');
  assert.equal((await create({ name: 'Must roll back' }, 'admin', token, { 'x-bad-actor': 'true' })).status, 500);
  await db.query('ROLLBACK TO SAVEPOINT failed_create');
  assert.equal((await db.query('SELECT id FROM packages WHERE game_id=$1', [gameId])).rowCount, 1);
});

test('price entered as 25000 VND in admin also renders as 25000 VND on checkout', () => {
  const html = gameCheckout({ slug: 'fixture', name: 'Fixture', mode: 'uid', image: '/fixture.png' }, [{ package_id: 'p', package_name: '60 Crystals', customer_cents: 2500000 }], null, 'key');
  assert.match(html, /id="orderTotal" aria-live="polite">25\.000/);
});
