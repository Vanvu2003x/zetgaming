import test from 'node:test';
import assert from 'node:assert/strict';
import { convertLegacyMoney } from '../scripts/legacy-money.mjs';
test('legacy VND conversion preserves displayed prices, balances and negative ledger entries',()=>{
  assert.equal(convertLegacyMoney(20000,'vnd'),2000000);
  assert.equal(convertLegacyMoney(496000,'vnd')/100,496000);
  assert.equal(convertLegacyMoney(-4000,'vnd'),-400000);
  assert.equal(convertLegacyMoney(2000000,'cents'),2000000);
  assert.throws(()=>convertLegacyMoney(20000,undefined));
  assert.throws(()=>convertLegacyMoney(1.5,'vnd'));
  assert.throws(()=>convertLegacyMoney(Number.MAX_SAFE_INTEGER,'vnd'));
});
