import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { env } from '../backend/config/env.mjs';
import { gmailReconciliationRouter } from '../backend/modules/orders/gmail-reconciliation.mjs';

test('Gmail Pub/Sub endpoint stays unavailable while integration is disabled', async t => {
  const previous = env.gmail;
  env.gmail = { ...previous, enabled: false };
  t.after(() => { env.gmail = previous; });

  const app = express();
  app.use(express.json());
  app.use('/api', gmailReconciliationRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/payment/gmail/pubsub`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ historyId: '1' })).toString('base64') } }),
  });
  assert.equal(response.status, 503);
});
