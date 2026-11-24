import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { couponPreviewRouter } from '../backend/modules/orders/coupon-preview.mjs';

test('coupon preview returns only the active coupon amount', async t => {
  const app = express();
  app.use((req, _res, next) => {
    req.db = { query: async (_sql, params) => {
      assert.deepEqual(params, ['ZETVALID', 'active']);
      return { rows: [{ amount_cents: '100000', expires_at: null }] };
    } };
    next();
  });
  app.use('/api', couponPreviewRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/coupons/preview?code=zetvalid`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { amount_cents: 100000 });
});

test('coupon preview does not query malformed coupon codes', async () => {
  let queried = false;
  const app = express();
  app.use((req, _res, next) => { req.db = { query: async () => { queried = true; return { rows: [] }; } }; next(); });
  app.use('/api', couponPreviewRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/coupons/preview?code=%3Cscript%3E`);
    assert.equal(response.status, 404);
    assert.equal(queried, false);
  } finally { server.close(); }
});
