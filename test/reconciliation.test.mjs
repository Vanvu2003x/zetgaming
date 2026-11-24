import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { env } from '../backend/config/env.mjs';
import { pool } from '../backend/db/pool.mjs';
import { createApp } from '../backend/app.mjs';

test('Web2M webhook matches exact order code and amount, then stays idempotent', { timeout: 30000 }, async () => {
  const schema = 'reconcile_' + randomUUID().replaceAll('-', '');
  const management = new pg.Pool({ connectionString: env.databaseUrl });
  await management.query(`CREATE SCHEMA ${schema}`); pool.options.options = '-c search_path=' + schema;
  const original = { provider: env.reconciliationProvider, token: env.web2mWebhookToken, bank: { ...env.bank } };
  let server;
  try {
    for (const file of (await readdir(new URL('../backend/db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) await pool.query(await readFile(new URL('../backend/db/migrations/' + file, import.meta.url), 'utf8'));
    await pool.query("INSERT INTO games(id,slug,name,mode,image) VALUES('g','reconcile-game','Reconcile Game','uid','/fixture.png')");
    await pool.query("INSERT INTO packages(id,game_id,name,nominal) VALUES('p','g','Reconcile Package','60')");
    await pool.query("INSERT INTO prices(package_id,tier,customer_cents,ctv_cents) VALUES('p','standard',2000000,1800000)");
    Object.assign(env.bank, { bin: '970422', label: 'MB Bank', account: '0966335561', name: 'NGUYEN THANH DUNG' }); env.reconciliationProvider = 'web2m'; env.web2mWebhookToken = 'secret-token';
    server = await new Promise(resolve => { const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const csrfResponse = await fetch(base + '/api/csrf'); const csrf = await csrfResponse.json(); const cookie = csrfResponse.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const created = await fetch(base + '/api/orders', { method: 'POST', headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrf.csrf_token, 'idempotency-key': 'reconcile-order' }, body: JSON.stringify({ package_id: 'p', target: { uid: 'fixture-uid' }, payment_method: 'direct' }) });
    assert.equal(created.status, 201); const order = await created.json();
    const payload = { id: 'web2m-event-1', amount: 20000, content: `ghi chú bất kỳ zet${order.code}zet thêm ký tự`, reference: 'BANK-REF-1' };
    const webhook = () => fetch(base + '/api/payment/web2m/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-web2m-token': 'secret-token' }, body: JSON.stringify(payload) });
    assert.equal((await webhook()).status, 201); assert.equal((await webhook()).status, 200);
    const stored = (await pool.query('SELECT status FROM orders WHERE code=$1', [order.code])).rows[0]; assert.equal(stored.status, 'pending_admin');
    assert.equal(Number((await pool.query("SELECT count(*) FROM payment_events WHERE provider='web2m'")).rows[0].count), 1);
    assert.equal((await fetch(base + '/api/payment/web2m/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-web2m-token': 'wrong' }, body: JSON.stringify(payload) })).status, 401);
  } finally { env.reconciliationProvider = original.provider; env.web2mWebhookToken = original.token; Object.assign(env.bank, original.bank); if (server) await new Promise(resolve => server.close(resolve)); await pool.end(); await management.query(`DROP SCHEMA ${schema} CASCADE`); await management.end(); }
});
