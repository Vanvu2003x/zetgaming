const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
const statusText = { awaiting_payment: 'Chờ thanh toán', pending_admin: 'Chờ duyệt', ready: 'Chờ CTV nhận', claimed: 'Đang xử lý', review: 'Chờ xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
let games = [];
let selected = null;
let requestKey = null;
let pendingLoginAction = null;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra, vui lòng thử lại.');
  return data;
}

function openLogin(afterLogin) {
  pendingLoginAction = afterLogin || null;
  $('#loginMsg').textContent = '';
  $('#loginDialog').showModal();
}

function renderGames() {
  const search = $('#search').value.trim().toLocaleLowerCase('vi');
  const unique = [...new Map(games.map((game) => [game.id, game])).values()];
  const filtered = unique.filter((game) => game.name.toLocaleLowerCase('vi').includes(search));
  $('#gameGrid').innerHTML = filtered.map((game) => {
    const prices = games.filter((row) => row.id === game.id).map((row) => row.customer_cents);
    const image = game.slug === 'mobile-legends' ? 'https://static2.pisapapeles.net/uploads/2025/11/Mobile_Legends_Bang_Bang_ML.jpg' : game.image;
    const art = /^(https:\/\/|\/)/.test(image || '') ? `<img src="${escapeHtml(image)}" alt="Ảnh game ${escapeHtml(game.name)}" loading="lazy">` : `<span aria-hidden="true">${escapeHtml(image || '✦')}</span>`;
    return `<article class="game-card"><div class="game-art">${art}</div><div class="game-content"><h3>${escapeHtml(game.name)}</h3><p>${game.mode === 'login' ? 'Nạp bằng tài khoản' : 'Nạp bằng UID'}</p><div class="game-bottom"><div><small>Giá từ</small><strong>${money(Math.min(...prices))}</strong></div><button type="button" data-game="${escapeHtml(game.id)}" aria-label="Xem gói ${escapeHtml(game.name)}">↗</button></div></div></article>`;
  }).join('') || '<div class="empty-state">Không tìm thấy game phù hợp. Thử tên khác nhé.</div>';
  $('#heroGameLogos').innerHTML = unique.slice(0, 5).map((game) => {
    const image = game.slug === 'mobile-legends' ? 'https://static2.pisapapeles.net/uploads/2025/11/Mobile_Legends_Bang_Bang_ML.jpg' : game.image;
    const art = /^(https:\/\/|\/)/.test(image || '') ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : '<span aria-hidden="true">✦</span>';
    return `<button class="hero-game-logo" type="button" data-game="${escapeHtml(game.id)}"><span>${art}</span><b>${escapeHtml(game.name)}</b></button>`;
  }).join('');
}

function selectedPackage() { return selected?.rows.find((row) => row.package_id === $('.packages button.selected')?.dataset.package); }
function updateTotal() { $('#orderTotal').textContent = selectedPackage() ? money(selectedPackage().customer_cents) : '—'; }
function openOrder(gameId) {
  const rows = games.filter((row) => row.id === gameId);
  if (!rows.length) return;
  selected = { id: gameId, rows };
  requestKey = crypto.randomUUID();
  $('#orderTitle').textContent = rows[0].name;
  $('#orderGame').textContent = 'Chọn gói và kiểm tra tổng tiền trước khi tạo đơn.';
  $('#targetLabel').textContent = rows[0].mode === 'login' ? 'Tài khoản game' : 'UID game';
  $('#target').placeholder = rows[0].mode === 'login' ? 'Nhập tài khoản game' : 'Nhập UID game';
  $('#target').value = '';
  $('#orderMsg').textContent = '';
  $('#orderMsg').classList.remove('success');
  $('#packages').innerHTML = rows.map((row, index) => `<button type="button" class="${index === 0 ? 'selected' : ''}" data-package="${escapeHtml(row.package_id)}" aria-pressed="${index === 0}"><span>${escapeHtml(row.package_name)}</span><b>${money(row.customer_cents)}</b></button>`).join('');
  updateTotal();
  $('#orderDialog').showModal();
}

async function renderOrders() {
  try {
    const rows = await api('/api/orders');
    $('#ordersList').innerHTML = rows.length ? rows.map((order) => `<div class="order-card"><div><strong>${escapeHtml(order.package_name)}</strong><div class="muted">${escapeHtml(order.code)} · ${money(order.price_cents)}</div></div><span class="status ${escapeHtml(order.status)}">${escapeHtml(statusText[order.status] || order.status)}</span></div>`).join('') : '<div class="empty-state">Bạn chưa có đơn nào. <a href="#games">Chọn game để bắt đầu →</a></div>';
  } catch { $('#ordersList').innerHTML = '<div class="empty-state">Đăng nhập để xem đơn hàng của bạn.</div>'; }
}

$('#gameGrid').addEventListener('click', (event) => { const button = event.target.closest('[data-game]'); if (button) openOrder(button.dataset.game); });
$('#heroGameLogos').addEventListener('click', (event) => { const button = event.target.closest('[data-game]'); if (button) openOrder(button.dataset.game); });
$('#gameGrid').addEventListener('error', (event) => { if (event.target.tagName === 'IMG') event.target.outerHTML = '<span aria-hidden="true">✦</span>'; }, true);
$('#packages').addEventListener('click', (event) => { const button = event.target.closest('[data-package]'); if (!button) return; $('#packages').querySelectorAll('button').forEach((item) => { item.classList.toggle('selected', item === button); item.setAttribute('aria-pressed', item === button ? 'true' : 'false'); }); updateTotal(); });
$('#search').addEventListener('input', renderGames);
$('#refresh').addEventListener('click', renderOrders);
$('#loginBtn').addEventListener('click', () => openLogin());
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $('#' + button.dataset.close).close()));

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#loginForm button[type="submit"]'); button.disabled = true;
  try {
    const result = await api('/api/auth/login', { method: 'POST', body: { email: $('#email').value, password: $('#password').value } });
    $('#loginDialog').close();
    $('#loginBtn').innerHTML = `${escapeHtml(result.user.email)} <span>↗</span>`;
    await renderOrders();
    const next = pendingLoginAction; pendingLoginAction = null; if (next) next();
  } catch (error) { $('#loginMsg').textContent = error.message; }
  finally { button.disabled = false; }
});

$('#orderForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const row = selectedPackage(); if (!row) return;
  const button = $('#createOrderBtn'); button.disabled = true;
  $('#orderMsg').classList.remove('success'); $('#orderMsg').textContent = 'Đang tạo đơn…';
  try {
    const target = row.mode === 'login' ? { login: $('#target').value.trim() } : { uid: $('#target').value.trim() };
    const result = await api('/api/orders', { method: 'POST', headers: { 'idempotency-key': requestKey }, body: { package_id: row.package_id, target, payment_method: $('#payment').value } });
    $('#orderMsg').textContent = `Đã tạo đơn ${result.code}. ${statusText[result.status] || result.status}.`;
    $('#orderMsg').classList.add('success');
    requestKey = crypto.randomUUID();
    await renderOrders();
  } catch (error) {
    if (error.message === 'Vui lòng đăng nhập') { $('#orderMsg').textContent = 'Đăng nhập để tiếp tục đặt đơn.'; openLogin(() => $('#orderDialog').showModal()); $('#orderDialog').close(); }
    else $('#orderMsg').textContent = error.message;
  } finally { button.disabled = false; }
});

api('/api/games').then((rows) => { games = rows; renderGames(); }).catch(() => { $('#gameGrid').innerHTML = '<div class="empty-state">Chưa tải được game. Vui lòng tải lại trang.</div>'; });
renderOrders();
api('/api/me').then((user) => { $('#loginBtn').innerHTML = `${escapeHtml(user.email)} <span>↗</span>`; }).catch(() => {});
