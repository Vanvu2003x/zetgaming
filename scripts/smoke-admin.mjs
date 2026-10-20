import 'dotenv/config';
import assert from 'node:assert/strict';

// Explicit local smoke check: never run against a remote deployment.
const base = `http://localhost:${process.env.ADMIN_PORT || 4174}`;
let cookies = new Map();
function absorb(response) {
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';')[0]; const offset = pair.indexOf('=');
    cookies.set(pair.slice(0, offset), pair.slice(offset + 1));
  }
}
const request = async (path, options = {}) => {
  const response = await fetch(base + path, { redirect: 'manual', ...options, headers: { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers } });
  absorb(response); return response;
};
const login = await request('/login');
assert.equal(login.status, 200);
let token = (await login.text()).match(/name="_csrf" value="([^"]+)"/)[1];
const signedIn = await request('/login', { method: 'POST', headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: process.env.ADMIN_EMAIL || 'admin@example.com', password: process.env.ADMIN_PASSWORD || '', _csrf: token }) });
assert.equal(signedIn.status, 303);
assert.equal(signedIn.headers.get('location'), '/');
for (const path of ['/', '/games', '/packages', '/orders', '/ctvs']) {
  const response = await request(path); const html = await response.text();
  assert.equal(response.status, 200); assert.match(html, /admin-shell/);
  token = html.match(/name="csrf-token" content="([^"]+)"/)[1];
}
const games = await (await request('/api/admin/games')).json();
const game = games.find(item => item.image);
assert.ok(game);
// Submit unchanged values: exercise authorization/CSRF/persistence without changing catalog content.
const patch = (path, body, csrf = token) => request(path, { method: 'PATCH', headers: { origin: base, 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify(body) });
const gameFields = Object.fromEntries(['name', 'image', 'mode', 'platform', 'active'].map(key => [key, game[key]]));
assert.equal((await patch('/api/admin/games/' + game.id, gameFields, 'invalid')).status, 403);
assert.equal((await patch('/api/admin/games/' + game.id, gameFields)).status, 200);
const pkg = game.packages[0];
const packageFields = Object.fromEntries(['name', 'nominal', 'image', 'badge', 'active', 'customer_cents', 'ctv_cents'].map(key => [key, pkg[key]]));
assert.equal((await patch('/api/admin/packages/' + pkg.id, packageFields)).status, 200);
const refreshed = await (await request('/api/admin/games')).json();
assert.equal(refreshed.find(item => item.id === game.id).name, game.name);
assert.equal(refreshed.find(item => item.id === game.id).packages.find(item => item.id === pkg.id).customer_cents, pkg.customer_cents);
assert.equal((await request('/api/orders')).status, 200);
assert.equal((await request('/api/admin/ctvs')).status, 200);
assert.equal((await request('/logout', { method: 'POST', headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ _csrf: token }) })).status, 303);
assert.equal((await request('/')).headers.get('location'), '/login');
console.log('Admin smoke passed: login, five pages, role-protected API, CSRF rejection, game/package save, orders, CTVs, logout.');
