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
    const opposite = path === '/dang-nhap' ? '/dang-ky' : '/dang-nhap';
    assert.ok(result.html.includes(`href="${opposite}?next=%2Fnap-game%2Fgenshin-impact"`));
    assert.doesNotMatch(result.html, /class="auth-tabs"/);
    assert.match(result.html, /class="google-signin"/);
    assert.match(result.html, /Tiếp tục với Google/);
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

test('configured Google login is a native authorization link on login and registration',()=>{
  for(const path of ['/dang-nhap','/dang-ky']){
    const page=renderStorefront({url:new URL(path+'?next=%2Fnap-game%2Fgenshin-impact','http://localhost'),user:null,data:{oauth:['google']},layout});
    assert.match(page.html,/<a class="google-signin" href="\/api\/auth\/oauth\/google\?next=%2Fnap-game%2Fgenshin-impact"/);
    assert.doesNotMatch(page.html,/<button class="google-signin"/);
  }
  const error=render('/dang-nhap?oauth_error=invalid_state');
  assert.match(error.html,/Phiên đăng nhập Google đã hết hạn/);
  assert.doesNotMatch(render('/dang-nhap?oauth_error=%3Cscript%3E').html,/<script>/);
});
