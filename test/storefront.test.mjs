import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, safeNext } from '../storefront/shared.mjs';

test('SSR escapes user-controlled content in text and attributes', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('login return URLs stay on supported local pages', () => {
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/dang-nhap', '/%2f%2fevil.test']) assert.equal(safeNext(value), '/tai-khoan');
  assert.equal(safeNext('/nap-game/genshin-impact'), '/nap-game/genshin-impact');
  assert.equal(safeNext('/'), '/');
});
