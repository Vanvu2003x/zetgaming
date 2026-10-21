import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Apply only to the existing production SQLite storefront after a snapshot.
const root=process.argv[2];
if(!root)throw new Error('Pass the legacy release directory');
const renderPath=join(root,'storefront/render.mjs');
let render=await readFile(renderPath,'utf8');
if(!render.includes("from './legal-pages.mjs'")){
  if(!render.includes("  if (path === '/') set("))throw new Error('Unexpected legacy route structure');
  render="import { legalPage, legalDocuments } from './legal-pages.mjs';\n"+render;
  render=render.replace("  if (path === '/') set(","  if (Object.hasOwn(legalDocuments, path)) set('legal', '/', legalDocuments[path].title, legalPage(path), legalDocuments[path].intro);\n  else if (path === '/') set(");
  await writeFile(renderPath,render);
}
const layoutPath=join(root,'views/layout.html');
let layout=await readFile(layoutPath,'utf8');
if(!layout.includes('/legal.css'))layout=layout.replace('</head>','<link rel="stylesheet" href="/legal.css?v=1"></head>');
const anchor='<a href="/tai-khoan">Tài khoản của bạn</a>';
if(!layout.includes('href="/chinh-sach-bao-mat"')){
  if(!layout.includes(anchor))throw new Error('Unexpected legacy footer');
  layout=layout.replace(anchor,anchor+'<a href="/chinh-sach-bao-mat">Chính sách bảo mật</a><a href="/dieu-khoan-dich-vu">Điều khoản dịch vụ</a>');
}
layout=layout.replace('Chọn game. Chọn gói. Nạp dễ dàng.','ZetGaming hỗ trợ đặt gói nạp game, xem giá và theo dõi đơn trực tuyến.');
await writeFile(layoutPath,layout);
console.log('Legacy public policy routes and links patched.');
