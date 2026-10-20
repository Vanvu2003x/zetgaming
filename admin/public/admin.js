import { escapeHtml as e, statuses, statusColor, money, toCents, date, search, paginate, revenueSeries, imageUrl } from './data.mjs';
import { openGameEditor, openPackageEditor, openOrder } from './editors.mjs';

const page = document.body.dataset.page;
const content = document.querySelector('#page-content');
const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
const state = { games: [], packages: [], orders: [], ctvs: [], query: '', status: '', game: '', page: 1 };
let toastTimer;
export function toast(message, error = false) {
  const target = document.querySelector('#toast');
  target.textContent = message; target.classList.toggle('error', error); target.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { target.hidden = true; }, 5000);
}
export async function api(path, body, method = 'PATCH') {
  const response = await fetch(path, { credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, ...(body === undefined ? {} : { method, body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { location.assign('/login?error=' + encodeURIComponent('Phiên đăng nhập đã hết hạn.')); throw new Error('Vui lòng đăng nhập lại.'); }
  if (!response.ok) throw new Error(data.error || 'Không thể kết nối hệ thống. Vui lòng thử lại.');
  return data;
}
export const badge = (text, color) => `<span class="badge ${e(color)}">${e(text)}</span>`;
export const statusBadge = status => badge(statuses[status] || status, statusColor(status));
export const symbol = name => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
  wallet: '<path d="M20 8V4H4v16h17V8H4m17 4h-6v4h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  box: '<path d="m12 3 9 5-9 5-9-5zM3 8v9l9 5 9-5V8M12 13v9"/>',
  game: '<path d="M7 6h10l4 3 1 9-3 1-5-3h-4l-5 3-3-1 1-9zM7 9v5M4.5 11.5h5M17 10h.01M19 13h.01"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
}[name] || '<circle cx="12" cy="12" r="8"/>'}</svg>`;

const image = (src, name, avatar = false) => imageUrl(src) ? `<img class="resource-image ${avatar ? 'avatar-image' : ''}" src="${e(imageUrl(src))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="resource-image resource-fallback">${e((name || 'Z').slice(0, 1))}</span>`;
const resource = (item, subtitle = '', avatar = false) => `<div class="row-resource">${image(item.image, item.name, avatar)}<div><strong>${e(item.name)}</strong><span class="secondary">${e(subtitle)}</span></div></div>`;
const editButton = (type, id, name) => `<button class="icon-button" data-edit="${type}" data-id="${e(id)}" aria-label="Chỉnh sửa ${e(name)}" title="Chỉnh sửa">${symbol('edit')}</button>`;
const openButton = code => `<button class="button subtle" data-order="${e(code)}" aria-label="Xem đơn ${e(code)}">Chi tiết ${symbol('chevron')}</button>`;
const empty = (title = 'Không tìm thấy kết quả', text = 'Thử đổi từ khóa hoặc bộ lọc để xem thêm dữ liệu.') => `<div class="empty">${symbol('search')}<strong>${e(title)}</strong><span>${e(text)}</span></div>`;
const table = (headings, rows) => rows.length ? `<div class="table-scroll"><table><thead><tr>${headings.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : empty();
const orderRow = order => `<tr><td><strong class="mono">${e(order.code)}</strong><span class="secondary">${date(order.created_at)}</span></td><td>${e(order.customer || '—')}</td><td><strong>${e(order.package_name || '—')}</strong><span class="secondary">${order.payment_method === 'wallet' ? 'Ví tài khoản' : 'Thanh toán trực tiếp'}</span></td><td>${statusBadge(order.status)}</td><td class="amount">${money(order.price_cents)}</td><td>${openButton(order.code)}</td></tr>`;
const orderHeaders = ['Mã đơn', 'Khách hàng', 'Gói nạp', 'Trạng thái', 'Tổng tiền', ''];

function dashboard() {
  const orders = state.orders;
  const completed = orders.filter(order => order.status === 'completed');
  const pending = orders.filter(order => order.status === 'pending_admin').length;
  const review = orders.filter(order => order.status === 'review').length;
  const metrics = [
    ['Doanh thu hoàn thành', money(completed.reduce((sum, order) => sum + Number(order.price_cents), 0)), `${completed.length} đơn đã hoàn tất`, 'wallet', 'orange'],
    ['Đơn cần xử lý', pending + review, `<a href="/orders?status=pending_admin"><span class="status-dot"></span>${pending} chờ duyệt</a> · <a href="/orders?status=review">${review} chờ quyết toán</a>`, 'clock', 'blue'],
    ['Game đang hiển thị', state.games.filter(g => g.active).length, `<a href="/games">Trong ${state.games.length} game trong kho ↗</a>`, 'game', 'green'],
    ['Gói nạp đang bán', state.packages.filter(p => p.active).length, `<a href="/packages">Quản lý ${state.packages.length} gói nạp ↗</a>`, 'box', ''],
  ];
  const days = revenueSeries(orders);
  const max = Math.max(1, ...days.map(day => day.value));
  const points = days.map((day, i) => `${i * 100},${130 - day.value / max * 110}`).join(' ');
  const chartTotal = days.reduce((sum, day) => sum + day.value, 0);
  const chartLabel = days.map(day => `${day.label}: ${money(day.value)}`).join('; ');
  content.innerHTML = `<div class="metrics">${metrics.map(([label, value, foot, icon, color]) => `<article class="metric"><div class="metric-head">${label}<span class="metric-symbol ${color}">${symbol(icon)}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${foot}</div></article>`).join('')}</div>
  <div class="dashboard-top"><section class="panel"><div class="panel-heading"><div><h2>Doanh thu 7 ngày</h2><p>Theo ngày tạo đơn · Chỉ tính đơn hoàn thành</p></div><span class="period-tag">${days[0].label} – ${days[6].label}</span></div><div class="chart-wrap"><div class="chart-total">${money(chartTotal)}<small>trong 7 ngày</small></div><div class="chart" role="img" aria-label="${e(chartLabel)}"><svg viewBox="0 0 600 150" preserveAspectRatio="none"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ef9b63" stop-opacity=".25"/><stop offset="100%" stop-color="#ef9b63" stop-opacity=".01"/></linearGradient></defs><polygon points="0,150 ${points} 600,150" fill="url(#chart-fill)"/><polyline points="${points}" fill="none" stroke="#e88c51" stroke-width="2" vector-effect="non-scaling-stroke"/>${days.map((day, i) => `<circle cx="${i * 100}" cy="${130 - day.value / max * 110}" r="3" fill="white" stroke="#e88c51" stroke-width="1.5"><title>${day.label}: ${money(day.value)}</title></circle>`).join('')}</svg></div><div class="chart-labels">${days.map(day => `<span>${day.label}</span>`).join('')}</div><div class="chart-legend">Doanh thu thực tế · ${chartTotal ? 'VNĐ' : 'Chưa có doanh thu trong giai đoạn này'}</div></div></section>
  <section class="panel"><div class="panel-heading"><div><h2>Cần bạn xử lý</h2><p>Ưu tiên các công việc đang chờ</p></div>${symbol('clock')}</div><div class="workflow-list">${[
    ['pending_admin', 'Đơn chờ duyệt', 'Phân đơn cho cộng tác viên', pending],
    ['review', 'Chờ quyết toán', 'Kiểm tra và hoàn tất đơn', review],
    ['awaiting_payment', 'Chờ thanh toán', 'Theo dõi thanh toán từ khách', orders.filter(o => o.status === 'awaiting_payment').length],
  ].map(([status, title, description, number]) => `<a class="workflow" href="/orders?status=${status}"><span class="workflow-icon">${symbol(status === 'review' ? 'check' : 'clock')}</span><div><strong>${title}</strong><small>${description}</small></div><span class="number">${number}</span>${symbol('chevron')}</a>`).join('')}</div><div class="helper-line">${symbol('check')} Số liệu được lấy từ hệ thống đơn hàng</div></section></div>
  <section class="panel table-panel"><div class="panel-heading"><div><h2>Đơn hàng gần đây</h2><p>Các giao dịch mới nhất trên cửa hàng</p></div><a class="button subtle" href="/orders">Tất cả đơn hàng ${symbol('arrow')}</a></div>${orders.length ? table(orderHeaders, orders.slice(0, 5).map(orderRow)) : empty('Chưa có đơn hàng', 'Đơn mới sẽ xuất hiện ở đây khi khách đặt nạp.')}</section>
  <div class="quick-links"><a class="quick-link" href="/games">${symbol('game')} Quản lý kho game ${symbol('arrow')}</a><a class="quick-link" href="/packages">${symbol('box')} Cập nhật gói nạp ${symbol('arrow')}</a><a class="quick-link" href="/ctvs">${symbol('check')} Danh sách cộng tác viên ${symbol('arrow')}</a></div>`;
}

function toolbar() {
  const type = page.slice(1);
  const placeholders = { orders: 'Tìm mã đơn, khách hàng, gói nạp…', games: 'Tìm tên game hoặc đường dẫn…', packages: 'Tìm tên gói nạp hoặc game…', ctvs: 'Tìm email cộng tác viên…' };
  let filters = '';
  if (type === 'orders') filters = `<select id="status-filter" aria-label="Lọc trạng thái đơn"><option value="">Tất cả trạng thái</option>${Object.entries(statuses).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select>`;
  if (type === 'games' || type === 'packages') filters = `<select id="status-filter" aria-label="Lọc trạng thái hiển thị"><option value="">Tất cả trạng thái</option><option value="active">${type === 'games' ? 'Đang hiển thị' : 'Đang bán'}</option><option value="hidden">Đang ẩn</option></select>`;
  if (type === 'packages') filters += `<select id="game-filter" aria-label="Lọc theo game"><option value="">Tất cả game</option>${state.games.map(g => `<option value="${e(g.id)}">${e(g.name)}</option>`).join('')}</select>`;
  return `<div class="toolbar"><label class="search-field">${symbol('search')}<input id="search" type="search" placeholder="${placeholders[type]}" aria-label="${placeholders[type]}"></label>${filters}<span class="toolbar-count" id="result-count"></span></div>`;
}

function collection() {
  const type = page.slice(1);
  const counts = { games: `${state.games.length} game trong kho`, packages: `${state.packages.length} gói nạp`, orders: `${state.orders.length} đơn hàng`, ctvs: `${state.ctvs.length} cộng tác viên` };
  content.innerHTML = `<div class="collection-summary"><span><strong>${counts[type]}</strong></span><span>Thay đổi được đồng bộ với cửa hàng</span></div><section class="panel table-panel">${toolbar()}<div id="table-content"></div><div id="table-pagination"></div></section>`;
  document.querySelector('#search').value = state.query;
  const status = document.querySelector('#status-filter');
  if (status) status.value = state.status;
  const game = document.querySelector('#game-filter');
  if (game) game.value = state.game;
  for (const [id, key] of [['search', 'query'], ['status-filter', 'status'], ['game-filter', 'game']]) document.getElementById(id)?.addEventListener(id === 'search' ? 'input' : 'change', event => { state[key] = event.target.value; state.page = 1; updateTable(); });
  updateTable();
}

function updateTable() {
  const type = page.slice(1);
  let items = search(state[type], state.query, { games: ['name', 'slug'], packages: ['name', 'game_name', 'nominal'], orders: ['code', 'customer', 'package_name'], ctvs: ['email'] }[type]);
  if (state.status) items = items.filter(item => type === 'orders' ? item.status === state.status : Boolean(item.active) === (state.status === 'active'));
  if (state.game) items = items.filter(item => item.game_id === state.game);
  const result = paginate(items, state.page);
  state.page = result.page;
  document.querySelector('#result-count').textContent = `${items.length} kết quả`;
  const headers = { orders: orderHeaders, games: ['Game', 'Kiểu nạp', 'Nền tảng', 'Gói nạp', 'Trạng thái', ''], packages: ['Gói nạp', 'Game', 'Giá khách', 'Giá CTV', 'Trạng thái', ''], ctvs: ['Cộng tác viên', 'Vai trò', 'Số dư ví', ''] };
  const rows = result.items.map(item => {
    if (type === 'orders') return orderRow(item);
    if (type === 'games') return `<tr><td>${resource(item, '/' + item.slug)}</td><td>${item.mode === 'uid' ? 'Nạp UID' : 'Nạp login'}</td><td>${e({ mobile: 'Mobile', pc: 'PC', other: 'Khác' }[item.platform] || item.platform)}</td><td>${item.packages.length} gói</td><td>${badge(item.active ? 'Đang hiển thị' : 'Đang ẩn', item.active ? 'green' : '')}</td><td>${editButton('game', item.id, item.name)}</td></tr>`;
    if (type === 'packages') return `<tr><td>${resource(item, item.badge || item.nominal, true)}</td><td>${e(item.game_name)}</td><td class="amount">${money(item.customer_cents)}</td><td>${money(item.ctv_cents)}</td><td>${badge(item.active ? 'Đang bán' : 'Đang ẩn', item.active ? 'green' : '')}</td><td>${editButton('package', item.id, item.name)}</td></tr>`;
    return `<tr><td><div class="row-resource"><span class="avatar">${e(item.email.slice(0, 1).toUpperCase())}</span><strong>${e(item.email)}</strong></div></td><td>${badge('Cộng tác viên', 'blue')}</td><td class="amount">${money(item.wallet_cents)}</td><td><a class="button subtle" href="/orders?status=pending_admin">Phân đơn ${symbol('arrow')}</a></td></tr>`;
  });
  document.querySelector('#table-content').innerHTML = table(headers[type], rows);
  const pageNumbers = [...new Set([1, result.page - 1, result.page, result.page + 1, result.pages])].filter(n => n > 0 && n <= result.pages).sort((a, b) => a - b);
  document.querySelector('#table-pagination').innerHTML = `<div class="table-bottom"><span>Hiển thị ${result.from}–${result.to} trong ${result.total} kết quả</span><nav class="pagination" aria-label="Phân trang"><button data-page-number="${result.page - 1}" aria-label="Trang trước" ${result.page === 1 ? 'disabled' : ''}>‹</button>${pageNumbers.map(n => `<button data-page-number="${n}" ${n === result.page ? 'class="active" aria-current="page"' : ''} aria-label="Trang ${n}">${n}</button>`).join('')}<button data-page-number="${result.page + 1}" aria-label="Trang sau" ${result.page === result.pages ? 'disabled' : ''}>›</button></nav></div>`;
}

let loading = false;
async function load() {
  if (loading) return;
  loading = true;
  const refresh = document.querySelector('#refresh'); refresh.disabled = true;
  content.setAttribute('aria-busy', 'true');
  try {
    const paths = page === '/' ? ['games', 'orders'] : page === '/packages' ? ['games'] : [page.slice(1)];
    for (const [name, data] of await Promise.all(paths.map(async name => [name, await api(name === 'orders' ? '/api/orders' : '/api/admin/' + name)]))) state[name] = data;
    state.packages = state.games.flatMap(game => (game.packages || []).map(pkg => ({ ...pkg, image: pkg.image || game.image, own_image: pkg.image || '', game_id: game.id, game_name: game.name })));
    if (page === '/') dashboard(); else collection();
    const connection = document.querySelector('[data-connection]'); connection.textContent = 'Đã kết nối'; connection.className = 'connection online';
    if (page === '/' || page === '/orders') {
      const count = document.querySelector('[data-pending-count]');
      count.textContent = state.orders.filter(o => ['pending_admin', 'review'].includes(o.status)).length;
      count.hidden = false;
    }
    document.querySelector('#updated-at').textContent = 'Cập nhật ' + new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(new Date());
  } catch (error) {
    content.innerHTML = `<div class="panel empty"><strong>${e(error.message)}</strong><span>Dữ liệu chưa tải được. Kiểm tra kết nối rồi thử lại.</span><div><button class="button" data-retry>Thử lại</button></div></div>`;
    const connection = document.querySelector('[data-connection]'); connection.textContent = 'Mất kết nối'; connection.className = 'connection offline';
  } finally { loading = false; refresh.disabled = false; content.setAttribute('aria-busy', 'false'); }
}

if (content) {
  content.addEventListener('error', event => {
    if (!event.target.matches('img.resource-image')) return;
    const fallback = document.createElement('span');
    fallback.className = 'resource-image resource-fallback';
    fallback.textContent = event.target.closest('.row-resource')?.querySelector('strong')?.textContent?.slice(0, 1) || 'Z';
    event.target.replaceWith(fallback);
  }, true);
  const query = new URLSearchParams(location.search);
  state.status = query.get('status') || '';
  document.querySelector('#refresh').addEventListener('click', load);
  const context = { api, toast, refresh: load, symbol, statusBadge, toCents };
  content.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-retry')) return load();
    if (button.dataset.pageNumber) { state.page = Number(button.dataset.pageNumber); updateTable(); }
    if (button.dataset.edit === 'game') openGameEditor(state.games.find(g => g.id === button.dataset.id), context);
    if (button.dataset.edit === 'package') openPackageEditor(state.packages.find(p => p.id === button.dataset.id), context);
    if (button.dataset.order) openOrder(button.dataset.order, context);
  });
  const menu = document.querySelector('.mobile-menu');
  menu.addEventListener('click', () => { const open = document.querySelector('.sidebar').classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu'); });
  document.querySelector('main').addEventListener('click', () => { document.querySelector('.sidebar').classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { document.querySelector('.sidebar').classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); } });
  load();
}
