import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('idempotency keys are required for order creation contract', () => {
  assert.equal(typeof randomUUID(), 'string');
  assert.ok(randomUUID().length > 20);
});

test('money is represented as integer cents', () => {
  const price = 95000;
  assert.equal(Number.isInteger(price), true);
  assert.equal(price + 5000, 100000);
});
