import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { env } from '../backend/config/env.mjs';
import { pool } from '../backend/db/pool.mjs';
import { createApp } from '../backend/app.mjs';
import { hash } from '../backend/utils/ids.mjs';

test('wallet topup creates VietQR and Web2M credits the wallet exactly once', { timeout: 30000 }, async () => {
  const schema = 'wallet_topup_' + randomUUID().replaceAll('-', '');
  const management = new pg.Pool({ connectionString: env.databaseUrl });
  await management.query(`CREATE SCHEMA ${schema}`);
  pool.options.options = '-c search_path=' + schema;
  const original = { provider: env.reconciliationProvider, token: env.web2mWebhookToken, bank: { ...env.bank } };
  let server;
  try {
    for (const file of (await readdir(new URL('../backend/db/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) await pool.query(await readFile(new URL('../backend/db/migrations/' + file, import.meta.url), 'utf8'));
    await pool.query("INSERT INTO users(id,email,password_hash,role) VALUES('u','wallet@fixture.invalid','unused','customer')");
    const session = randomBytes(32).toString('hex');
    await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,'u',now()+interval '1 hour')", [hash(session)]);
    Object.assign(env.bank, { bin: '970422', label: 'MB Bank', account: '0966335561', name: 'NGUYEN THANH DUNG' });
    env.reconciliationProvider = 'web2m'; env.web2mWebhookToken = 'wallet-secret';
    server = await new Promise(resolve => { const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const csrfResponse = await fetch(base + '/api/csrf', { headers: { cookie: `session=${session}` } });
    const csrf = await csrfResponse.json();
    const created = await fetch(base + '/api/wallet-topups', { method: 'POST', headers: { cookie: `session=${session}`, 'content-type': 'application/json', 'x-csrf-token': csrf.csrf_token, 'idempotency-key': 'wallet-topup-1' }, body: JSON.stringify({ amount_vnd: 25000 }) });
    assert.equal(created.status, 201);
    const topup = await created.json();
    assert.equal(topup.payment.amount_cents, 2500000);
    assert.match(topup.payment.content, new RegExp(topup.code));
    const webhook = () => fetch(base + '/api/payment/web2m/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-web2m-token': 'wallet-secret' }, body: JSON.stringify({ id: 'wallet-event-1', amount: 25000, content: `nội dung dư zet${topup.code}zet xyz`, reference: 'BANK-WALLET-1' }) });
    assert.equal((await webhook()).status, 201);
    assert.equal((await webhook()).status, 200);
    assert.equal(Number((await pool.query("SELECT wallet_cents FROM users WHERE id='u'")).rows[0].wallet_cents), 2500000);
    assert.equal(Number((await pool.query('SELECT count(*) FROM ledger')).rows[0].count), 1);
    assert.equal((await pool.query('SELECT status FROM wallet_topups WHERE code=$1', [topup.code])).rows[0].status, 'completed');
  } finally {
    Object.assign(env.bank, original.bank); env.reconciliationProvider = original.provider; env.web2mWebhookToken = original.token;
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.end(); await management.query(`DROP SCHEMA ${schema} CASCADE`); await management.end();
  }
});
