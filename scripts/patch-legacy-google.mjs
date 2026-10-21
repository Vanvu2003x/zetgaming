import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Run only against the deployed legacy tree, after creating a rollback snapshot.
const root = process.argv[2];
if (!root) throw new Error('Pass the legacy release directory');
const accountPath = join(root, 'storefront/account-pages.mjs');
let account = await readFile(accountPath, 'utf8');
if (!account.includes("import { googleSignin, googleErrors }")) {
  if (!account.includes('export function loginPage(next, error)')) throw new Error('Unexpected legacy login function');
  account = "import { googleSignin, googleErrors } from './google-signin.mjs';\n" + account;
  account = account.replace('export function loginPage(next, error)', 'export function loginPage(next, error, oauthError)');
  account = account.replace('<a class="auth-back" href="/nap-game">', '<div class="auth-divider"><span>Hoặc đăng nhập với</span></div>${googleSignin(next, [\'google\'])}<a class="auth-back" href="/nap-game">');
  account = account.replace("${error ? 'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.' : ''}", "${Object.hasOwn(googleErrors, oauthError) ? e(googleErrors[oauthError]) : error ? 'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.' : ''}");
  await writeFile(accountPath, account);
}
const renderPath = join(root, 'storefront/render.mjs');
const render = await readFile(renderPath, 'utf8');
await writeFile(renderPath, render.replace("loginPage(url.searchParams.get('next'), url.searchParams.get('error'))", "loginPage(url.searchParams.get('next'), url.searchParams.get('error'), url.searchParams.get('oauth_error'))"));
const layoutPath = join(root, 'views/layout.html');
const layout = await readFile(layoutPath, 'utf8');
if (!layout.includes('/google-oauth.css')) await writeFile(layoutPath, layout.replace('</head>', '<link rel="stylesheet" href="/google-oauth.css?v=1"></head>'));
console.log('Legacy Google sign-in UI patched.');
