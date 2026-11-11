import { escapeHtml as e, statuses, statusColor, money, toCents, date, search, paginate, revenueSeries, imageUrl } from './data.mjs';
import { openGameEditor, openPackageEditor, openOrder, openCategoryEditor, openCustomerEditor, openTierEditor } from './editors.mjs?v=admin-image-preview-1';

const page = document.body.dataset.page;
const content = document.querySelector('#page-content');
const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
const state = { games: [], packages: [], categories: [], orders: [], customers: [], tiers: [], ctvs: [], coupons: [], query: '', status: '', game: '', category: '', page: 1 };
let toastTimer;
export function toast(message, error = false) {
  const target = document.querySelector('#toast');
  target.textContent = message; target.classList.toggle('error', error); target.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { target.hidden = true; }, 5000);
}
export async function api(path, body, method = 'PATCH') {
  const upload = body instanceof File;
  const response = await fetch(path, { credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': upload ? body.type : 'application/json', 'X-CSRF-Token': csrf }, ...(body === undefined ? {} : { method, body: upload ? body : JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) { location.assign('/login?error=' + encodeURIComponent('Phiên đăng nhập đã hết hạn.')); throw new Error('Vui lòng đăng nhập lại.'); }
  if (!response.ok) throw new Error(data.error || 'Không thể kết nối hệ thống. Vui lòng thử lại.');
  return data;
}
export const badge = (text, color) => `<span class="badge ${e(color)}">${e(text)}</span>`;
export const statusBadge = status => badge(statuses[status] || status, statusColor(status));
export const symbol = name => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${{
  wallet: '<path d="M20 8V4H4v16h17V8H4m17 4h-6v4h6"/>',
  bank: '<path d="m3 10 9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>',
  qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-2zM14 18h2v2h-2z"/>',
  user: '<circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  sync: '<path d="M20 7a8 8 0 1 0 1 7M20 3v4h-4"/>',
  trash: '<path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3"/>',
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

const image = (src, name, avatar = false) => imageUrl(src) ? `<img class="resource-image ${avatar ? 'avatar-image' : ''}" src="${e(imageUrl(src))}" alt="Ảnh ${e(name || 'game')}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="resource-image resource-fallback" title="Chưa có ảnh">${e((name || 'Z').slice(0, 1))}</span>`;
const resource = (item, subtitle = '', avatar = false) => `<div class="row-resource">${image(item.image, item.name, avatar)}<div><strong>${e(item.name)}</strong><span class="secondary">${e(subtitle)}</span></div></div>`;
const mediaCell = (src, name, label) => `<div class="media-cell">${image(src, name)}<span>${e(label)}</span></div>`;
const bindImageFallbacks = () => document.querySelectorAll('img.resource-image:not([data-fallback-bound])').forEach(img => { img.dataset.fallbackBound = 'true'; img.addEventListener('error', () => { const fallback = document.createElement('span'); fallback.className = img.className.replace(/\bresource-image\b/, 'resource-image resource-fallback'); fallback.title = 'Ảnh không tải được'; fallback.textContent = (img.alt.replace(/^Ảnh\s+/, '') || 'Z').slice(0, 1); img.replaceWith(fallback); }, { once: true }); });
const editButton = (type, id, name) => `<button class="icon-button" data-edit="${type}" data-id="${e(id)}" aria-label="Chỉnh sửa ${e(name)}" title="Chỉnh sửa">${symbol('edit')}</button>`;
const openButton = code => `<button class="button subtle" data-order="${e(code)}" aria-label="Xem đơn ${e(code)}">Chi tiết ${symbol('chevron')}</button>`;
const empty = (title = 'Không tìm thấy kết quả', text = 'Thử đổi từ khóa hoặc bộ lọc để xem thêm dữ liệu.') => `<div class="empty">${symbol('search')}<strong>${e(title)}</strong><span>${e(text)}</span></div>`;
const table = (headings, rows) => rows.length ? `<div class="table-scroll"><table><thead><tr>${headings.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : empty();
const orderRow = order => `<tr class="order-row order-row-${e(order.status)}"><td><strong class="mono">${e(order.code)}</strong><span class="secondary">${date(order.created_at)}</span></td><td>${e(order.customer || 'Khách vãng lai')}</td><td><strong>${e(order.package_name || '—')}</strong><span class="secondary">${order.payment_method === 'wallet' ? 'Ví tài khoản' : 'Chuyển khoản trực tiếp'}</span></td><td><div class="order-status-stack">${statusBadge(order.status)}<span class="payment-state ${order.status === 'awaiting_payment' ? 'is-waiting' : order.status === 'completed' ? 'is-paid' : ''}">${order.status === 'awaiting_payment' ? 'Chưa nhận tiền' : order.status === 'completed' ? 'Đã giao' : 'Theo dõi'}</span></div></td><td class="amount">${money(order.price_cents)}</td><td>${openButton(order.code)}</td></tr>`;
const orderHeaders = ['Mã đơn', 'Khách hàng', 'Gói nạp', 'Trạng thái', 'Tổng tiền', ''];

function dashboard() {
  const orders = state.orders;
  const completed = orders.filter(order => order.status === 'completed');
  const pending = orders.filter(order => order.status === 'pending_admin').length;
  const processing = orders.filter(order => order.status === 'processing').length;
  const review = orders.filter(order => order.status === 'review').length;
  const issues = orders.filter(order => ['failed','needs_review','refund_pending'].includes(order.status)).length;
  const metrics = [
    ['Doanh thu hoàn thành', money(completed.reduce((sum, order) => sum + Number(order.price_cents), 0)), `${completed.length} đơn đã hoàn tất`, 'wallet', 'orange'],
    ['Đơn cần xử lý', pending + processing + review + issues, `<a href="/orders?status=pending_admin"><span class="status-dot"></span>${pending} chờ xử lý</a> · <a href="/orders?status=processing">${processing} đang nạp</a> · <span>${issues} lỗi / cần đối soát</span> · <a href="/orders?status=review">${review} chờ quyết toán</a>`, 'clock', 'blue'],
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
    ['pending_admin', 'Đơn chờ xử lý', 'Nhận đơn đã thanh toán để bắt đầu nạp', pending],
    ['processing', 'Đang nạp', 'Tiếp tục xử lý và xác nhận hoàn thành', processing],
    ['needs_review', 'Cần kiểm tra', 'Đối soát kết quả nạp trước khi thử lại hoặc hoàn', orders.filter(o => o.status === 'needs_review').length],
    ['failed', 'Nạp lỗi', 'Kiểm tra để thử lại hoặc hủy đơn', orders.filter(o => o.status === 'failed').length],
    ['refund_pending', 'Chờ hoàn tiền', 'Chuyển hoàn và ghi nhận mã giao dịch', orders.filter(o => o.status === 'refund_pending').length],
    ['awaiting_payment', 'Chờ thanh toán', 'Theo dõi thanh toán từ khách', orders.filter(o => o.status === 'awaiting_payment').length],
  ].map(([status, title, description, number]) => `<a class="workflow" href="/orders?status=${status}"><span class="workflow-icon">${symbol(status === 'review' ? 'check' : 'clock')}</span><div><strong>${title}</strong><small>${description}</small></div><span class="number">${number}</span>${symbol('chevron')}</a>`).join('')}</div><div class="helper-line">${symbol('check')} Số liệu được lấy từ hệ thống đơn hàng</div></section></div>
  <section class="panel table-panel"><div class="panel-heading"><div><h2>Đơn hàng gần đây</h2><p>Các giao dịch mới nhất trên cửa hàng</p></div><a class="button subtle" href="/orders">Tất cả đơn hàng ${symbol('arrow')}</a></div>${orders.length ? table(orderHeaders, orders.slice(0, 5).map(orderRow)) : empty('Chưa có đơn hàng', 'Đơn mới sẽ xuất hiện ở đây khi khách đặt nạp.')}</section>
  <div class="quick-links"><a class="quick-link" href="/games">${symbol('game')} Quản lý kho game ${symbol('arrow')}</a><a class="quick-link" href="/packages">${symbol('box')} Cập nhật gói nạp ${symbol('arrow')}</a><a class="quick-link" href="/ctvs">${symbol('check')} Danh sách cộng tác viên ${symbol('arrow')}</a></div>`;
}

function toolbar() {
  const type = page.slice(1);
  const placeholders = { orders: 'Tìm mã đơn, khách hàng, gói nạp…', customers: 'Tìm email khách hàng…', games: 'Tìm tên game hoặc phân loại…', categories: 'Tìm tên phân loại…', packages: 'Tìm tên gói nạp hoặc game…', ctvs: 'Tìm email cộng tác viên…' };
  let filters = '';
  if (type === 'orders') filters = `<div class="priority-filters" role="group" aria-label="Lọc nhanh đơn hàng"><button type="button" class="priority-filter ${state.status === 'pending_admin' ? 'is-active' : ''}" data-status-shortcut="pending_admin">Cần xử lý</button><button type="button" class="priority-filter ${state.status === 'needs_review' ? 'is-active' : ''}" data-status-shortcut="needs_review">Cần kiểm tra</button><button type="button" class="priority-filter ${state.status === 'refund_pending' ? 'is-active' : ''}" data-status-shortcut="refund_pending">Chờ hoàn</button></div><select id="status-filter" aria-label="Lọc trạng thái đơn"><option value="">Tất cả trạng thái</option>${Object.entries(statuses).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select>`;
  if (type === 'games' || type === 'packages' || type === 'customers') filters = `<select id="status-filter" aria-label="Lọc trạng thái hiển thị"><option value="">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="hidden">Đang khóa</option></select>`;
  if (type === 'packages') filters += `<select id="game-filter" aria-label="Lọc theo game"><option value="">Tất cả game</option>${state.games.map(g => `<option value="${e(g.id)}">${e(g.name)}</option>`).join('')}</select>`;
  if (type === 'packages') filters += `<button type="button" class="button primary" data-new-package ${state.games.length ? '' : 'disabled'}>+ Tạo gói nạp</button>`;
  if (type === 'games') filters += `<select id="category-filter" aria-label="Lọc phân loại"><option value="">Tất cả phân loại</option>${state.categories.map(c => `<option value="${e(c.id)}">${e(c.name)}</option>`).join('')}<option value="uncategorized">Chưa phân loại</option></select>`;
  if (type === 'games') filters += '<button type="button" class="button primary" data-new-game>+ Tạo game</button>';
  if (type === 'categories') filters += '<button type="button" class="button primary" data-new-category>+ Thêm phân loại</button>';
  return `<div class="toolbar"><label class="search-field">${symbol('search')}<input id="search" type="search" placeholder="${placeholders[type]}" aria-label="${placeholders[type]}"></label>${filters}<span class="toolbar-count" id="result-count"></span></div>`;
}

function collection() {
  const type = page.slice(1);
  const counts = { games: `${state.games.length} game trong kho`, categories: `${state.categories.length} phân loại`, packages: `${state.packages.length} gói nạp`, orders: `${state.orders.length} đơn hàng`, customers: `${state.customers.length} khách hàng`, ctvs: `${state.ctvs.length} cộng tác viên` };
  const tierPanel = type === 'customers' ? `<section class="panel table-panel customer-tiers-panel"><div class="panel-heading"><div><h2>Hạng khách &amp; giảm giá</h2><p>Chỉnh phần trăm giảm trực tiếp tại đây. Giá chỉ áp dụng cho đơn mới.</p></div><span class="period-tag">${state.tiers.length} hạng</span></div><div class="table-scroll"><table><thead><tr><th>Hạng khách</th><th>Giảm giá</th><th>Khách đang dùng</th><th>Trạng thái</th><th></th></tr></thead><tbody>${state.tiers.map(tier => `<tr><td><strong>${e(tier.name || tier.tier)}</strong><span class="secondary mono">${e(tier.tier)}</span></td><td><strong class="discount-value">${Number(tier.discount_percent || 0)}%</strong></td><td>${Number(tier.customer_count || 0).toLocaleString('vi-VN')}</td><td>${badge(tier.active ? 'Đang dùng' : 'Đã tắt', tier.active ? 'green' : 'red')}</td><td><button class="icon-button" data-edit-tier="${e(tier.tier)}" aria-label="Sửa ${e(tier.name || tier.tier)}" title="Chỉnh hạng">${symbol('edit')}</button></td></tr>`).join('') || '<tr><td colspan="5">Chưa có hạng khách.</td></tr>'}</tbody></table></div></section>` : '';
  content.innerHTML = `<div class="collection-summary"><span><strong>${counts[type]}</strong></span><span>${type === 'orders' ? 'Ưu tiên xử lý theo trạng thái và rủi ro thanh toán' : ['games', 'packages'].includes(type) ? 'Số đơn gồm tất cả trạng thái' : 'Thay đổi được đồng bộ với cửa hàng'}</span></div>${tierPanel}<section class="panel table-panel">${toolbar()}<div id="table-content"></div><div id="table-pagination"></div></section>`;
  document.querySelector('#search').value = state.query;
  const status = document.querySelector('#status-filter');
  if (status) status.value = state.status;
  const game = document.querySelector('#game-filter');
  if (game) game.value = state.game;
  const category = document.querySelector('#category-filter');
  if (category) category.value = state.category;
  for (const [id, key] of [['search', 'query'], ['status-filter', 'status'], ['game-filter', 'game'], ['category-filter', 'category']]) document.getElementById(id)?.addEventListener(id === 'search' ? 'input' : 'change', event => { state[key] = event.target.value; state.page = 1; updateTable(); });
  updateTable();
}

async function securityPage() {
  content.innerHTML = `<section class="panel security-panel"><div class="panel-heading"><div><h2>Bảo mật tài khoản admin</h2><p>Bật xác thực 2 lớp bằng Google Authenticator hoặc ứng dụng TOTP tương thích.</p></div>${symbol('shield')}</div><div id="security-status" class="security-status">Đang kiểm tra trạng thái…</div><div id="security-setup" hidden></div></section>`;
  const status = document.querySelector('#security-status');
  const setup = document.querySelector('#security-setup');
  const refreshSecurity = async () => {
    const data = await api('/api/admin/security/2fa');
    status.innerHTML = data.enabled ? `<strong>2FA đang bật</strong><span>Mỗi lần đăng nhập admin cần thêm mã 6 chữ số.</span><button class="button" data-2fa-disable>Tắt 2FA</button>` : `<strong>2FA đang tắt</strong><span>Nên bật 2FA để bảo vệ khu vực quản trị.</span><button class="button primary" data-2fa-enroll>Thiết lập 2FA</button>`;
  };
  content.dataset.securityRefresh = 'true';
  content.refreshSecurity = refreshSecurity;
  await refreshSecurity();
  content.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return;
    try {
      if (button.hasAttribute('data-2fa-enroll')) {
        const data = await api('/api/admin/security/2fa/enroll', undefined, 'POST');
        setup.hidden = false; setup.innerHTML = `<div class="security-setup"><h3>Quét mã hoặc nhập secret</h3><p>Dùng ứng dụng xác thực để quét QR theo đường dẫn bên dưới, sau đó nhập mã 6 số để xác nhận.</p><code>${e(data.secret)}</code><small>${e(data.otpauth_url)}</small><label>Mã xác nhận<input id="twofa-code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}"></label><button class="button primary" data-2fa-enable>Xác nhận bật 2FA</button></div>`;
      } else if (button.hasAttribute('data-2fa-enable')) {
        const code = document.querySelector('#twofa-code').value; const secret = setup.querySelector('code').textContent;
        await api('/api/admin/security/2fa/enable', { secret, code }, 'POST'); toast('Đã bật 2FA cho admin.'); setup.hidden = true; await refreshSecurity();
      } else if (button.hasAttribute('data-2fa-disable')) {
        const code = window.prompt('Nhập mã 2FA hiện tại để tắt:'); if (!code) return;
        await api('/api/admin/security/2fa/disable', { code }, 'POST'); toast('Đã tắt 2FA.'); await refreshSecurity();
      }
    } catch (error) { toast(error.message, true); }
  });
}

async function reportsPage() {
  content.innerHTML = `<section class="panel reports-panel"><div class="panel-heading"><div><h2>Báo cáo cửa hàng</h2><p>Chọn khoảng thời gian để xem nhanh hiệu quả vận hành.</p></div><span class="panel-kicker">Chỉ admin</span></div><form class="report-filters" id="report-filters"><div class="report-presets" role="group" aria-label="Khoảng thời gian"><button type="button" class="button subtle" data-report-preset="7">7 ngày</button><button type="button" class="button subtle" data-report-preset="30">30 ngày</button><button type="button" class="button subtle" data-report-preset="90">90 ngày</button></div><label>Từ ngày<input type="date" name="from"></label><label>Đến ngày<input type="date" name="to"></label><button class="button primary" type="submit">Xem báo cáo</button><button class="button" type="button" data-report-csv>Tải CSV</button></form><div id="report-output" class="report-output">Đang tải báo cáo…</div></section>`;
  const form=document.querySelector('#report-filters'), output=document.querySelector('#report-output');
  const loadReport=async(format='json')=>{ const params=new URLSearchParams(Object.fromEntries(new FormData(form))); if(format==='csv')params.set('format','csv'); if(format==='csv'){ window.location.assign('/api/admin/reports?'+params); return; } const report=await api('/api/admin/reports?'+params); const s=report.summary; output.innerHTML=`<div class="report-metrics"><div><strong>${Number(s.orders).toLocaleString('vi-VN')}</strong><span>Tổng đơn</span></div><div><strong>${money(s.gross)}</strong><span>Tiền đã ghi nhận</span></div><div><strong>${money(s.completed)}</strong><span>Doanh thu hoàn thành</span></div><div><strong>${Number(s.refunded).toLocaleString('vi-VN')}</strong><span>Đơn hoàn tiền</span></div></div><h3>Theo game</h3><div class="table-scroll"><table><thead><tr><th>Game</th><th>Số đơn</th><th>Doanh thu</th></tr></thead><tbody>${report.byGame.map(row=>`<tr><td>${e(row.game)}</td><td>${Number(row.orders).toLocaleString('vi-VN')}</td><td>${money(row.revenue)}</td></tr>`).join('')||'<tr><td colspan="3">Chưa có dữ liệu</td></tr>'}</tbody></table></div>`; };
  form.addEventListener('submit',event=>{event.preventDefault();loadReport().catch(error=>toast(error.message,true));});
  content.addEventListener('click',event=>{const preset=event.target.closest('[data-report-preset]'); if(preset){const days=Number(preset.dataset.reportPreset); const end=new Date(); const start=new Date(end); start.setDate(end.getDate()-days+1); const iso=value=>value.toISOString().slice(0,10); form.elements.from.value=iso(start); form.elements.to.value=iso(end); loadReport().catch(error=>toast(error.message,true)); return;} if(event.target.closest('[data-report-csv]'))loadReport('csv').catch(error=>toast(error.message,true));});
  await loadReport();
}

async function paymentPage() {
  content.innerHTML='<section class="panel payment-settings-panel"><div class="panel-heading"><div><h2>Cấu hình thanh toán</h2><p>Thông tin nhận tiền hiện đang lấy từ biến môi trường bảo mật.</p></div></div><div id="payment-settings">Đang tải…</div></section><section class="panel table-panel wallet-topup-admin-panel"><div class="panel-heading"><div><h2>Nạp số dư chờ đối soát</h2><p>Kiểm tra tiền vào tài khoản trước khi xác nhận cộng ví.</p></div></div><div id="wallet-topups">Đang tải…</div></section>';
  const data=await api('/api/admin/payment-settings'); const target=document.querySelector('#payment-settings');
  target.innerHTML=`<div class="payment-settings-grid"><div><span class="payment-card-icon qr">${symbol('qr')}</span><strong>VietQR</strong><span>${data.bank.configured?'Đã cấu hình':'Chưa cấu hình'}</span></div><div><span class="payment-card-icon bank">${symbol('bank')}</span><strong>Ngân hàng</strong><span>${e(data.bank.label||'—')}</span></div><div><span class="payment-card-icon account">${symbol('wallet')}</span><strong>Tài khoản</strong><span>${e(data.bank.account_masked||'—')}</span></div><div><span class="payment-card-icon owner">${symbol('user')}</span><strong>Chủ tài khoản</strong><span>${e(data.bank.name||'—')}</span></div><div><span class="payment-card-icon sync">${symbol('sync')}</span><strong>Đối soát</strong><span>${e(data.reconciliation.mode)}</span></div></div><div class="detail-note">${data.reconciliation.webhook_configured?'Webhook đã có URL cấu hình, cần kiểm thử riêng trước khi bật tự động.':'Chưa có webhook ngân hàng. Admin vẫn xác nhận thủ công sau khi kiểm tra tiền thực tế vào tài khoản.'}</div>`;
  const topups=await api('/api/admin/wallet-topups'); const topupTarget=document.querySelector('#wallet-topups');
  topupTarget.innerHTML=topups.length?`<div class="table-scroll"><table><thead><tr><th>Mã giao dịch</th><th>Khách hàng</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${topups.map(item=>`<tr><td><strong class="mono">${e(item.code)}</strong><span class="secondary">${date(item.created_at)}</span></td><td>${e(item.email)}</td><td class="amount">${money(item.amount_cents)}</td><td>${badge(item.status==='completed'?'Đã cộng ví':item.status==='cancelled'?'Đã hủy':'Chờ thanh toán',item.status==='completed'?'green':item.status==='awaiting_payment'?'orange':'')}</td><td>${item.status==='awaiting_payment'?`<button class="button subtle" data-wallet-complete="${e(item.code)}">Đã nhận tiền</button> <button class="button subtle" data-wallet-cancel="${e(item.code)}">Hủy</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:empty('Chưa có giao dịch nạp số dư','Giao dịch mới sẽ xuất hiện sau khi khách tạo yêu cầu.');
  topupTarget.addEventListener('click',async event=>{const complete=event.target.closest('[data-wallet-complete]');const cancel=event.target.closest('[data-wallet-cancel]');if(!complete&&!cancel)return;const code=(complete||cancel).dataset[complete?'walletComplete':'walletCancel'];try{if(complete){const reference=window.prompt('Nhập mã tham chiếu ngân hàng (nếu có):')||'';await api('/api/admin/wallet-topups/'+encodeURIComponent(code)+'/complete',{transaction_ref:reference},'POST');toast('Đã cộng số dư cho khách.');}else{if(!window.confirm('Hủy giao dịch nạp số dư này?'))return;await api('/api/admin/wallet-topups/'+encodeURIComponent(code)+'/cancel',{},'POST');toast('Đã hủy giao dịch.');}await paymentPage();}catch(error){toast(error.message,true);}});
}

async function couponsPage() {
  const statusLabel = { active: 'Chưa dùng', redeemed: 'Đã dùng', revoked: 'Đã thu hồi', expired: 'Hết hạn' };
  const statusClass = { active: 'green', redeemed: 'blue', revoked: 'red', expired: 'orange' };
  const couponCounts = { active: state.coupons.filter(item => item.status === 'active').length, redeemed: state.coupons.filter(item => item.status === 'redeemed').length, revoked: state.coupons.filter(item => item.status === 'revoked').length };
  content.innerHTML = `<div class="coupon-overview"><div><span class="overview-label">Đang dùng được</span><strong>${couponCounts.active}</strong><small>mã khả dụng</small></div><div><span class="overview-label">Đã sử dụng</span><strong>${couponCounts.redeemed}</strong><small>mã đã trừ tiền</small></div><div><span class="overview-label">Đã thu hồi</span><strong>${couponCounts.revoked}</strong><small>mã bị vô hiệu</small></div></div><section class="panel table-panel coupons-panel"><div class="panel-heading"><div><h2>Coupon hoàn tiền</h2><p>Coupon của khách vãng lai · mỗi mã chỉ dùng một lần.</p></div><span class="period-tag">${state.coupons.length} mã</span></div><div id="coupons-table"></div></section>`;
  const target = document.querySelector('#coupons-table');
  target.innerHTML = state.coupons.length ? `<div class="table-scroll"><table><thead><tr><th>Mã coupon</th><th>Giá trị</th><th>Đơn nguồn</th><th>Đơn sử dụng</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead><tbody>${state.coupons.map(item => `<tr><td><strong class="mono coupon-code">${e(item.code)}</strong><span class="secondary">${e(item.created_by_email || 'Hệ thống')}</span></td><td class="amount">${money(item.amount_cents)}</td><td><a class="mono" href="/orders?query=${encodeURIComponent(item.source_order_code)}">${e(item.source_order_code)}</a><span class="secondary">${e(item.source_order_status || '—')}</span></td><td>${item.redeemed_order_code ? `<span class="mono">${e(item.redeemed_order_code)}</span><span class="secondary">${e(item.redeemed_by_email || 'Khách')}</span>` : '—'}</td><td>${badge(statusLabel[item.status] || item.status, statusClass[item.status] || '')}</td><td>${date(item.created_at)}</td><td>${item.status === 'active' ? `<button class="button subtle" data-revoke-coupon="${e(item.code)}">Thu hồi</button>` : '—'}</td></tr>`).join('')}</tbody></table></div>` : empty('Chưa có coupon', 'Coupon sẽ xuất hiện khi admin đánh dấu đơn khách vãng lai là nạp lỗi.');
  target.addEventListener('click', async event => {
    const button = event.target.closest('[data-revoke-coupon]');
    if (!button || !window.confirm('Thu hồi coupon này? Coupon sau đó không thể sử dụng.')) return;
    try {
      await api(`/api/admin/coupons/${encodeURIComponent(button.dataset.revokeCoupon)}/revoke`, {}, 'POST');
      toast('Đã thu hồi coupon.');
      state.coupons = await api('/api/admin/coupons');
      await couponsPage();
    } catch (error) { toast(error.message, true); }
  });
}

async function contentPage() {
  content.innerHTML = `<section class="panel"><div class="panel-heading"><div><h2>Banner trang chủ</h2><p>Chỉnh nội dung hiển thị ở đầu trang cửa hàng. Nội dung được lưu an toàn trong database.</p></div></div><form id="content-form" class="content-form"><label>Eyebrow<input name="eyebrow" maxlength="80"></label><label>Tiêu đề<input name="title" maxlength="120" required></label><label>Mô tả<textarea name="description" maxlength="240" rows="3"></textarea></label><label>Ảnh nền<input name="image" maxlength="500" placeholder="/uploads/banner.webp hoặc URL ảnh"></label><label class="check-row"><input name="active" type="checkbox"> Hiển thị banner</label><div class="form-actions"><button class="button primary" type="submit">Lưu banner</button><a class="button" href="${document.querySelector('meta[name="storefront-origin"]')?.content || '/'}" target="_blank" rel="noopener">Xem cửa hàng ↗</a></div></form></section>`;
  const form = document.querySelector('#content-form');
  const imageFile = document.createElement('input'); imageFile.type = 'file'; imageFile.accept = 'image/png,image/jpeg,image/webp'; imageFile.setAttribute('aria-label', 'Chọn ảnh banner từ máy'); form.elements.image.insertAdjacentElement('afterend', imageFile);
  try {
    const data = await api('/api/admin/content');
    for (const [key, value] of Object.entries(data.hero || {})) { const field = form.elements[key]; if (!field) continue; if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = value ?? ''; }
  } catch (error) { toast(error.message, true); }
  form.addEventListener('submit', async event => { event.preventDefault(); const button = form.querySelector('[type="submit"]'); button.disabled = true; try { if (imageFile.files[0]) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(imageFile.files[0].type) || imageFile.files[0].size > 5 * 1024 * 1024) throw new Error('Chọn ảnh PNG, JPG hoặc WebP không quá 5 MB.'); const uploaded = await api('/api/admin/uploads', imageFile.files[0], 'POST'); form.elements.image.value = uploaded.url; imageFile.value = ''; } const value = Object.fromEntries(new FormData(form)); delete value.active; delete value.undefined; value.active = form.elements.active.checked; await api('/api/admin/content', { hero: value }); toast('Đã lưu banner trang chủ.'); } catch (error) { toast(error.message, true); } finally { button.disabled = false; } });
}

async function tiersPage() {
  content.innerHTML = `<section class="panel table-panel tiers-panel"><div class="panel-heading"><div><h2>Hạng khách hàng</h2><p>Giảm giá được áp dụng tự động khi user tạo đơn mới.</p></div></div><div id="tiers-table"></div></section>`;
  const rows = state.tiers.map(tier => `<tr><td><strong>${e(tier.name || tier.tier)}</strong><span class="secondary mono">${e(tier.tier)}</span></td><td><strong class="discount-value">${Number(tier.discount_percent || 0)}%</strong></td><td>${Number(tier.package_count || 0).toLocaleString('vi-VN')} gói có giá gốc</td><td>${badge(tier.active ? 'Đang dùng' : 'Đã tắt', tier.active ? 'green' : 'red')}</td><td><button class="icon-button" data-edit-tier="${e(tier.tier)}" aria-label="Sửa ${e(tier.name || tier.tier)}" title="Chỉnh hạng">${symbol('edit')}</button></td></tr>`).join('');
  document.querySelector('#tiers-table').innerHTML = `<div class="table-scroll"><table><thead><tr><th>Hạng</th><th>Giảm</th><th>Phạm vi giá</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5">Chưa có hạng khách.</td></tr>'}</tbody></table></div>`;
}

function updateTable() {
  const type = page.slice(1);
  let items = search(state[type], state.query, { games: ['name', 'slug', 'category_name'], categories: ['name'], packages: ['name', 'game_name', 'nominal'], orders: ['code', 'customer', 'package_name'], customers: ['email', 'tier', 'role'], ctvs: ['email'] }[type]);
  if (state.status) items = items.filter(item => type === 'orders' ? item.status === state.status : Boolean(item.active) === (state.status === 'active'));
  if (state.game) items = items.filter(item => item.game_id === state.game);
  if (state.category) items = items.filter(item => state.category === 'uncategorized' ? !item.category_id : item.category_id === state.category);
  const result = paginate(items, state.page);
  state.page = result.page;
  document.querySelector('#result-count').textContent = `${items.length} kết quả`;
  const headers = { orders: orderHeaders, customers: ['Khách hàng', 'Vai trò', 'Hạng', 'Số đơn', 'Đã nạp', 'Phiên', 'Trạng thái', ''], games: ['Game / thumbnail', 'Ảnh nền', 'Kiểu nạp', 'Phân loại', 'Gói nạp', 'Số đơn', 'Trạng thái', ''], categories: ['Tên phân loại', 'Số game', ''], packages: ['Gói nạp / ảnh', 'Game', 'Giá khách', 'Giá CTV', 'Số đơn', 'Trạng thái', ''], ctvs: ['Cộng tác viên', 'Vai trò', 'Số dư ví', ''] };
  const rows = result.items.map(item => {
    if (type === 'orders') return orderRow(item);
    if (type === 'customers') return `<tr><td><div class="row-resource customer-resource"><span class="avatar">${e(item.email.slice(0, 1).toUpperCase())}</span><div><strong>${e(item.email)}</strong><span class="secondary">ID ${e(item.id)}</span></div></div></td><td>${badge(item.role === 'admin' ? 'Admin' : item.role === 'ctv' ? 'CTV' : 'Khách hàng', item.role === 'admin' ? 'orange' : '')}</td><td><span class="tier-chip">${e(item.tier || 'standard')}</span></td><td class="amount"><strong>${Number(item.order_count || 0).toLocaleString('vi-VN')}</strong><span class="secondary">đơn</span></td><td class="amount"><strong>${money(item.topup_cents)}</strong><span class="secondary">đã nạp</span></td><td class="amount"><strong>${Number(item.session_count || 0).toLocaleString('vi-VN')}</strong><span class="secondary">phiên</span></td><td>${badge(item.active ? 'Đang hoạt động' : 'Đã khóa', item.active ? 'green' : '')}</td><td>${editButton('customer', item.id, item.email)}</td></tr>`;
    if (type === 'categories') return `<tr><td><strong>${e(item.name)}</strong>${item.system ? '<span class="secondary">Nhóm hệ thống</span>' : ''}</td><td>${Number(item.game_count || 0).toLocaleString('vi-VN')} game</td><td class="row-actions">${item.system ? '<span class="category-system-note">Tự động</span>' : `${editButton('category', item.id, item.name)}${Number(item.game_count || 0) === 0 ? `<button class="icon-button danger" data-delete-category="${e(item.id)}" aria-label="Xóa ${e(item.name)}" title="Xóa phân loại">${symbol('trash')}</button>` : `<button class="icon-button" disabled title="Chuyển game ra khỏi loại này trước">${symbol('trash')}</button>`}`}</td></tr>`;
    if (type === 'games') return `<tr><td>${resource({ ...item, image: item.thumbnail || item.image }, '/' + item.slug, true)}</td><td class="banner-cell">${mediaCell(item.image, item.name, 'Ảnh nền')}</td><td>${item.mode === 'uid' ? 'Nạp UID' : 'Nạp login'}</td><td>${e(item.category_name || 'Chưa phân loại')}</td><td>${item.packages.length} gói</td><td class="amount">${Number(item.order_count || 0).toLocaleString('vi-VN')}</td><td>${badge(item.active ? 'Đang hiển thị' : 'Đang ẩn', item.active ? 'green' : '')}</td><td>${editButton('game', item.id, item.name)}</td></tr>`;
    if (type === 'packages') return `<tr><td><div class="row-resource package-resource">${image(item.image, item.name, true)}<div><strong>${e(item.name)}</strong><span class="secondary">${e(item.badge || item.nominal || 'Ảnh gói nạp')}</span></div></div></td><td>${e(item.game_name)}</td><td class="amount">${money(item.customer_cents)}</td><td>${money(item.ctv_cents)}</td><td class="amount">${Number(item.order_count || 0).toLocaleString('vi-VN')}</td><td>${badge(item.active ? 'Đang bán' : 'Đang ẩn', item.active ? 'green' : '')}</td><td>${editButton('package', item.id, item.name)}</td></tr>`;
    return `<tr><td><div class="row-resource"><span class="avatar">${e(item.email.slice(0, 1).toUpperCase())}</span><strong>${e(item.email)}</strong></div></td><td>${badge('Cộng tác viên', 'blue')}</td><td class="amount">${money(item.wallet_cents)}</td><td><a class="button subtle" href="/orders?status=pending_admin">Phân đơn ${symbol('arrow')}</a></td></tr>`;
  });
  document.querySelector('#table-content').innerHTML = table(headers[type], rows);
  bindImageFallbacks();
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
    const paths = ['/security','/reports','/payment','/content'].includes(page) ? [] : page === '/' ? ['games', 'orders'] : page === '/packages' ? ['games'] : page === '/games' ? ['games', 'categories'] : page === '/customers' ? ['customers', 'tiers'] : [page.slice(1)];
    for (const [name, data] of await Promise.all(paths.map(async name => [name, await api(name === 'orders' ? '/api/orders' : '/api/admin/' + name)]))) state[name] = data;
    state.packages = state.games.flatMap(game => (game.packages || []).map(pkg => ({ ...pkg, image: pkg.image || game.image, own_image: pkg.image || '', game_id: game.id, game_name: game.name })));
    if (page === '/') dashboard(); else if (page === '/content') await contentPage(); else if (page === '/coupons') await couponsPage(); else if (page === '/tiers') await tiersPage(); else if (!['/security', '/reports', '/payment'].includes(page)) collection();
    const connection = document.querySelector('[data-connection]'); connection.textContent = 'Đã kết nối'; connection.className = 'connection online';
    if (page === '/security') await securityPage(); else if (page === '/reports') await reportsPage(); else if (page === '/payment') await paymentPage(); else if (page === '/' || page === '/orders') {
      const count = document.querySelector('[data-pending-count]');
      count.textContent = state.orders.filter(o => ['pending_admin', 'processing', 'review', 'failed', 'needs_review', 'refund_pending'].includes(o.status)).length;
      count.hidden = false;
    }
    document.querySelector('#updated-at').textContent = 'Cập nhật ' + new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(new Date());
  } catch (error) {
    content.innerHTML = `<div class="panel empty"><strong>${e(error.message)}</strong><span>Dữ liệu chưa tải được. Kiểm tra kết nối rồi thử lại.</span><div><button class="button" data-retry>Thử lại</button></div></div>`;
    const connection = document.querySelector('[data-connection]'); connection.textContent = 'Mất kết nối'; connection.className = 'connection offline';
  } finally { loading = false; refresh.disabled = false; content.setAttribute('aria-busy', 'false'); }
}

if (content) {
  document.querySelectorAll('[data-nav-toggle]').forEach(button => button.addEventListener('click', () => {
    const group = button.closest('.sidebar-nav-group');
    const open = group.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
  }));
  content.addEventListener('error', event => {
    if (!event.target.matches('img.resource-image')) return;
    const fallback = document.createElement('span');
    fallback.className = 'resource-image resource-fallback';
    fallback.textContent = event.target.closest('.row-resource')?.querySelector('strong')?.textContent?.slice(0, 1) || 'Z';
    event.target.replaceWith(fallback);
  }, true);
  const query = new URLSearchParams(location.search);
  state.query = query.get('query') || '';
  state.status = query.get('status') || '';
  document.querySelector('#refresh').addEventListener('click', load);
    const context = { api, toast, refresh: load, symbol, statusBadge, toCents, escapeHtml: e, money, date, getCategories: () => state.categories, getGames: () => state.games, getTiers: () => state.tiers, getSelectedGame: () => state.game };
  content.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-retry')) return load();
    if (button.dataset.statusShortcut) { state.status = state.status === button.dataset.statusShortcut ? '' : button.dataset.statusShortcut; state.page = 1; collection(); return; }
    if (button.dataset.pageNumber) { state.page = Number(button.dataset.pageNumber); updateTable(); }
    if (button.dataset.edit === 'game') openGameEditor(state.games.find(g => g.id === button.dataset.id), context);
    if (button.dataset.edit === 'customer') openCustomerEditor(state.customers.find(g => g.id === button.dataset.id), context);
    if (button.hasAttribute('data-new-game')) openGameEditor(null, context);
    if (button.dataset.edit === 'package') openPackageEditor(state.packages.find(p => p.id === button.dataset.id), context);
    if (button.hasAttribute('data-new-package')) openPackageEditor(null, context);
    if (button.dataset.edit === 'category') openCategoryEditor(state.categories.find(c => c.id === button.dataset.id), context);
    if (button.hasAttribute('data-new-category')) openCategoryEditor(null, context);
    if (button.dataset.editTier) openTierEditor(state.tiers.find(item => item.tier === button.dataset.editTier), context);
    if (button.dataset.deleteCategory) {
      const category = state.categories.find(item => item.id === button.dataset.deleteCategory);
      if (!category || Number(category.game_count || 0) > 0 || !window.confirm(`Xóa phân loại “${category.name}”?`)) return;
      api('/api/admin/categories/' + encodeURIComponent(category.id), undefined, 'DELETE').then(async () => { toast('Đã xóa phân loại.'); state.categories = await api('/api/admin/categories'); collection(); }).catch(error => toast(error.message, true));
    }
    if (button.dataset.order) openOrder(button.dataset.order, context);
  });
  const menu = document.querySelector('.mobile-menu');
  menu.addEventListener('click', () => { const open = document.querySelector('.sidebar').classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu'); });
  document.querySelector('main').addEventListener('click', () => { document.querySelector('.sidebar').classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { document.querySelector('.sidebar').classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); } });
  load();
}
