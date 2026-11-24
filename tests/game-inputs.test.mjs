import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGameInputs } from '../shared/game-inputs.mjs';

test('login games keep only custom fields that are not built-in credentials', () => {
  const config = normalizeGameInputs({
    custom_fields: ['Tên tài khoản', 'Tên tkhoan', 'Username', 'Mật khẩu', 'Máy chủ', 'Thông tin thêm', 'Zalo'],
  }, 'login');

  assert.deepEqual(config.custom_fields, ['Máy chủ']);
});
