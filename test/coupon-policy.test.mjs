import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCoupon } from '../shared/coupon-policy.mjs';

test('coupon smaller than the order reduces the payable amount exactly', () => {
  assert.deepEqual(applyCoupon(100000, 30000), {
    gross_cents: 100000,
    coupon_cents: 30000,
    discount_cents: 30000,
    payable_cents: 70000,
    exceeds_order: false,
    unused_cents: 0,
  });
});

test('coupon larger than the order is capped and reports non-refundable remainder', () => {
  assert.deepEqual(applyCoupon(50000, 100000), {
    gross_cents: 50000,
    coupon_cents: 100000,
    discount_cents: 50000,
    payable_cents: 0,
    exceeds_order: true,
    unused_cents: 50000,
  });
});
