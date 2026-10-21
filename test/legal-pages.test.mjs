import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStorefront } from '../storefront/render.mjs';
import { legalPage, legalDocuments } from '../storefront/legal-pages.mjs';

test('public legal documents render without authentication or a database',()=>{
  const layout='<html><head></head><body>{{content}}</body></html>';
  for(const path of Object.keys(legalDocuments)){
    const page=renderStorefront({url:new URL(path,'https://zetgaming.vanvucoder.id.vn'),user:null,data:{},layout});
    assert.equal(page.status,200);
    assert.equal((page.html.match(/<h1\b/g)||[]).length,1);
    assert.match(page.html,/21\/10\/2026/);
    assert.match(page.html,/legal\.css/);
    assert.match(page.html,/href="\/chinh-sach-bao-mat"/);
    assert.match(page.html,/href="\/dieu-khoan-dich-vu"/);
    assert.doesNotMatch(page.html,/{{\w+}}/);
  }
});
test('privacy describes actual Google scopes, deletion requests and revocation separately',()=>{
  const page=legalPage('/chinh-sach-bao-mat');
  assert.match(page,/openid/);assert.match(page,/email/);
  assert.match(page,/myaccount.google.com\/connections/);
  assert.match(page,/xóa dữ liệu/);
  assert.match(page,/mailto:zetgaming.net@gmail.com/);
  assert.match(page,/không tự động xóa/);
  assert.doesNotMatch(page,/support@|Lorem ipsum|TODO/);
});
