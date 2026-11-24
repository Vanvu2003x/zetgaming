import test from 'node:test';
import assert from 'node:assert/strict';

test('KhoaBlack provider refuses live calls until explicitly enabled and keyed', async () => {
  const previousEnabled = process.env.KHOABLACK_ENABLED;
  const previousKey = process.env.KHOABLACK_API_KEY;
  process.env.KHOABLACK_ENABLED = 'false';
  delete process.env.KHOABLACK_API_KEY;
  try {
    const { khoablack } = await import(`../backend/modules/providers/khoablack.mjs?test=${Date.now()}`);
    await assert.rejects(() => khoablack.check(), error => error.statusCode === 503 && /chưa được bật/i.test(error.message));
  } finally {
    if (previousEnabled === undefined) delete process.env.KHOABLACK_ENABLED; else process.env.KHOABLACK_ENABLED = previousEnabled;
    if (previousKey === undefined) delete process.env.KHOABLACK_API_KEY; else process.env.KHOABLACK_API_KEY = previousKey;
  }
});
