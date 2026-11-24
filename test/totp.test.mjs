import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTotpSecret, totpCode, verifyTotp, otpauthUrl } from '../backend/modules/auth/totp.mjs';

test('TOTP uses six-digit rotating codes and accepts only a narrow clock window', () => {
  const secret = generateTotpSecret();
  const timestamp = 1_735_689_600_000;
  const code = totpCode(secret, timestamp);
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotp(secret, code, timestamp), true);
  assert.equal(verifyTotp(secret, code, timestamp + 120_000), false);
  assert.match(otpauthUrl(secret, 'admin@example.com'), /^otpauth:\/\/totp\/ZetGaming:/);
});
