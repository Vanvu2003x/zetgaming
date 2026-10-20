import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStorefront } from '../storefront/render.mjs';

const layout = '<html><head></head><body data-page="{{page}}">{{content}}</body></html>';
const render = (path, user = null) => renderStorefront({ url: new URL(path, 'http://localhost'), user, data: {}, csrfToken: 'fixture-csrf', layout });

test('auth navigation keeps the intended destination and forms retain CSRF protection', () => {
  for (const path of ['/dang-nhap', '/dang-ky']) {
    const result = render(path + '?next=%2Fnap-game%2Fgenshin-impact');
    assert.equal(result.status, 200);
    assert.match(result.html, /auth-soul-land\.css/);
    assert.match(result.html, /name="_csrf" value="fixture-csrf"/);
    assert.match(result.html, /href="\/dang-nhap\?next=%2Fnap-game%2Fgenshin-impact"/);
    assert.match(result.html, /href="\/dang-ky\?next=%2Fnap-game%2Fgenshin-impact"/);
    assert.match(result.html, /aria-current="page"/);
    const unsafe = render(path + '?next=https%3A%2F%2Fevil.example');
    assert.doesNotMatch(unsafe.html, /evil\.example/);
  }
});

test('signed-out view shows return actions and is only displayed to guests', () => {
  const result = render('/da-dang-xuat');
  assert.equal(result.status, 200);
  assert.match(result.html, /Đã đăng xuất/);
  assert.match(result.html, /href="\/dang-nhap"/);
  assert.match(result.html, /href="\/"/);
  assert.equal(render('/da-dang-xuat', { email: 'member@example.com' }).redirect, '/tai-khoan');
});
