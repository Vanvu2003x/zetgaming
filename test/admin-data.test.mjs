import test from 'node:test';
import assert from 'node:assert/strict';
import { toCents, search, paginate, revenueSeries } from '../admin/public/data.mjs';

test('admin price fields convert VND to integer cents without silently accepting bad input', () => {
  assert.equal(toCents('25000'), 2500000);
  assert.equal(toCents('100.25'), 10025);
  assert.equal(toCents('0'), 0);
  for (const value of ['', '-1', '1.001', 'NaN', '25000abc', '9007199254740991']) assert.throws(() => toCents(value));
});
test('Vietnamese search and pagination keep filters usable with empty or shrinking results', () => {
  const items = [{ name: 'Đấu trường' }, { name: 'Genshin Impact' }];
  assert.deepEqual(search(items, 'dau', ['name']), [items[0]]);
  assert.equal(paginate(items, 50).page, 1);
  assert.equal(paginate([], 3).from, 0);
  assert.equal(paginate(Array.from({ length: 18 }), 2, 8).items.length, 8);
});
test('dashboard revenue uses completed orders and Vietnam calendar boundaries', () => {
  const orders = [
    { status: 'completed', price_cents: 10000, created_at: '2026-10-20T18:00:00Z' },
    { status: 'pending_admin', price_cents: 99000, created_at: '2026-10-20T18:00:00Z' },
    { status: 'completed', price_cents: 40000, created_at: '2026-10-01T00:00:00Z' },
  ];
  const days = revenueSeries(orders, new Date('2026-10-20T20:00:00Z'));
  assert.equal(days.length, 7);
  assert.equal(days.at(-1).key, '2026-10-21');
  assert.equal(days.at(-1).value, 10000);
  assert.equal(days.reduce((total, day) => total + day.value, 0), 10000);
});
