import { escapeHtml as e, money, date, imageUrl } from './data.mjs';
import { orderManagement, bindOrderManagement } from './order-management.mjs?v=order-management-1';

const dialog = () => document.querySelector('#editor');
let dialogGeneration = 0;
const input = (name, label, value, { type = 'text', full = false, required = false, readonly = false, help = '', max = '120' } = {}) => `<label class="${full ? 'full' : ''}">${label}<input name="${name}" value="${e(value)}" type="${type}" ${required ? 'required' : ''} ${readonly ? 'readonly' : ''} ${type === 'number' ? 'min="0" step="0.01"' : `maxlength="${max}"`}>${help ? `<small>${help}</small>` : ''}</label>`;
const select = (name, label, current, options) => `<label>${label}<select name="${name}">${options.map(([value, text]) => `<option value="${e(value)}" ${value === current ? 'selected' : ''}>${e(text)}</option>`).join('')}</select></label>`;
const safeImage = url => /^(https:\/\/|\/(?!\/))/.test(url || '');
const imagePicker = (field, label, value, help, square = field === 'thumbnail') => `<div class="image-picker"><label>${label}<span class="image-picker-preview ${square ? 'square' : ''}"><img ${safeImage(value) ? `src="${e(imageUrl(value))}"` : 'hidden'} alt="Xem trước ${label.toLowerCase()}"><span class="image-picker-placeholder" ${safeImage(value) ? 'hidden' : ''}>${square ? 'Ảnh vuông' : 'Ảnh ngang'}</span></span><input type="file" data-upload-field="${field}" accept="image/png,image/jpeg,image/webp" aria-label="Chọn ${label.toLowerCase()}"></label><input type="hidden" name="${field}" value="${e(value || '')}"><small>${help} · PNG, JPG, WebP ≤ 5 MB</small></div>`;
function mount(title, description, body, context, submit = '', hideFooterClose = false) {
  const target = dialog();
  target.dataset.generation = String(++dialogGeneration);
  target.innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">${e(title)}</h2><p>${e(description)}</p></div><button class="icon-button" data-close aria-label="Đóng">${context.symbol('close')}</button></div>${submit ? '<form id="resource-form">' : ''}<div class="dialog-body"><div class="inline-error" id="form-error" role="alert" hidden></div>${body}</div><div class="dialog-footer">${hideFooterClose ? '' : `<button class="button" type="button" data-close>${submit ? 'Hủy' : 'Đóng'}</button>`}${submit ? `<button class="button primary" type="submit">${context.symbol('check')} ${submit}</button>` : ''}</div>${submit ? '</form>' : ''}`;
  target.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { if (target.dataset.saving !== 'true' && target.querySelector('form')?.dataset.saving !== 'true') target.close(); }));
  if (!target.open) target.showModal();
  target.querySelector('[data-close]').focus();
  target.querySelectorAll('.image-picker-preview img').forEach(image => image.addEventListener('error', () => { image.hidden = true; image.removeAttribute('src'); image.closest('.image-picker-preview').querySelector('.image-picker-placeholder').hidden = false; }, { once: true }));
  return target;
}
function showError(error) {
  const target = dialog().querySelector('#form-error');
  target.textContent = error.message; target.hidden = false;
  target.scrollIntoView({ block: 'nearest' });
}
function editor(type, item, fields, context) {
  const creating = !item.id;
  const target = mount(type === 'games' ? (creating ? 'Tạo game mới' : 'Chỉnh sửa game') : creating ? 'Tạo gói nạp mới' : 'Chỉnh sửa gói nạp', type === 'games' ? 'Quản lý ảnh và thông tin hiển thị trên cửa hàng.' : creating ? 'Chọn game, nhập giá theo VNĐ và tải ảnh từ máy.' : item.game_name + ' · Giá nhập theo đồng Việt Nam', `<div class="field-grid">${fields}</div>`, context, creating ? (type === 'games' ? 'Tạo game' : 'Tạo gói nạp') : 'Lưu thay đổi');
  const form = target.querySelector('form');
  const preventBusyClose = event => { if (form.dataset.saving === 'true') event.preventDefault(); };
  target.addEventListener('cancel', preventBusyClose);
  const objectUrls = new Map();
  const cleanup = () => { for (const url of objectUrls.values()) URL.revokeObjectURL(url); target.removeEventListener('cancel', preventBusyClose); };
  target.addEventListener('close', cleanup, { once: true });
  form.querySelectorAll('[data-upload-field]').forEach(input => input.addEventListener('change', () => {
    const file = input.files[0];
    const field = input.dataset.uploadField;
    const image = input.closest('.image-picker').querySelector('img');
    if (objectUrls.has(field)) { URL.revokeObjectURL(objectUrls.get(field)); objectUrls.delete(field); }
    const restorePreview = () => { const original = imageUrl(form.elements[field].value); image.hidden = !original; image.closest('.image-picker-preview').querySelector('.image-picker-placeholder').hidden = Boolean(original); if (original) image.src = original; else image.removeAttribute('src'); };
    if (!file) { restorePreview(); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      input.value = ''; restorePreview(); showError(new Error('Chọn ảnh PNG, JPG hoặc WebP không quá 5 MB.')); return;
    }
    const url = URL.createObjectURL(file); objectUrls.set(field, url);
    image.src = url; image.hidden = false; image.closest('.image-picker-preview').querySelector('.image-picker-placeholder').hidden = true;
    target.querySelector('#form-error').hidden = true;
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (form.dataset.saving === 'true') return;
    const button = form.querySelector('[type="submit"]');
    form.dataset.saving = 'true'; form.setAttribute('aria-busy', 'true');
    form.querySelectorAll('[data-upload-field]').forEach(input => { input.disabled = true; });
    button.disabled = true; target.querySelector('#form-error').hidden = true;
    try {
      for (const input of form.querySelectorAll('[data-upload-field]')) {
        const file = input.files[0];
        if (!file) continue;
        button.textContent = 'Đang tải ảnh…';
        const result = await context.api('/api/admin/uploads', file, 'POST');
        form.elements[input.dataset.uploadField].value = result.url;
        input.value = '';
      }
      button.textContent = 'Đang lưu…';
      const values = Object.fromEntries(new FormData(form));
      values.active = form.elements.active.checked;
      if (type === 'packages') {
        values.customer_cents = context.toCents(values.customer_price);
        values.ctv_cents = context.toCents(values.ctv_price);
        delete values.customer_price; delete values.ctv_price;
      }
      if (type === 'games') {
        const list = name => form.elements[name]?.value.split('\n').map(value => value.trim()).filter(Boolean) || [];
        const mode = values.mode;
        const blocked = new Set(mode === 'login' ? ['tài khoản game', 'tên tài khoản', 'mật khẩu', 'mật khẩu game'] : ['uid', 'uid người chơi']);
        values.input_config = { guide: values.input_guide || '', custom_fields: list('custom_fields').filter(value => !blocked.has(value.toLowerCase())), server_options: [], region_options: [], server_required: false, region_required: false, password_required: mode === 'login' ? true : Boolean(form.elements.password_required?.checked) };
        delete values.input_guide; delete values.custom_fields;
      }
      if (values.image && !safeImage(values.image.trim())) throw new Error('Ảnh cần là đường dẫn /… hoặc URL https://…');
      if (type === 'games' && !values.image?.trim()) throw new Error('Chưa chọn ảnh nền / banner cho game.');
      if (values.thumbnail && !safeImage(values.thumbnail.trim())) throw new Error('Đường dẫn thumbnail không hợp lệ.');
      if (type === 'games' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug || '')) throw new Error('Đường dẫn chỉ dùng chữ thường, số và dấu gạch ngang.');
      await context.api(`/api/admin/${type}${creating ? '' : '/' + encodeURIComponent(item.id)}`, values, creating ? 'POST' : 'PATCH');
      target.close(); context.toast(creating ? (type === 'games' ? 'Đã tạo game mới.' : 'Đã tạo gói nạp mới.') : 'Đã lưu thay đổi.'); await context.refresh();
    } catch (error) { showError(error); }
    finally {
      form.dataset.saving = 'false'; form.setAttribute('aria-busy', 'false');
      form.querySelectorAll('[data-upload-field]').forEach(input => { input.disabled = false; });
      button.disabled = false; button.innerHTML = `${context.symbol('check')} ${creating ? (type === 'games' ? 'Tạo game' : 'Tạo gói nạp') : 'Lưu thay đổi'}`;
    }
  });
}
export function openGameEditor(game, context) {
  game ||= { name: '', slug: '', mode: 'uid', image: '', thumbnail: '', platform: 'mobile', category_id: '', active: true, input_config: {} };
  const creating = !game.id;
  const config = game.input_config || {};
  editor('games', game, [
    input('name', 'Tên game', game.name, { full: true, required: true }),
    creating ? input('slug', 'Đường dẫn', game.slug, { required: true, max: '100', help: 'Chỉ dùng chữ thường, số và dấu gạch ngang. Ví dụ: genshin-impact' }) : `<input type="hidden" name="slug" value="${e(game.slug)}">`,
    `<div class="full game-image-pickers">${imagePicker('image', 'Ảnh nền / banner', game.image, 'Nền ngang của card và trang game')}${imagePicker('thumbnail', 'Ảnh đại diện / thumbnail', game.thumbnail, 'Avatar vuông cạnh tên game')}</div>`,
    select('mode', 'Kiểu nạp', game.mode, [['uid', 'Nạp UID'], ['login', 'Nạp login']]),
    select('category_id', 'Phân loại', game.category_id || '', [['', 'Chưa phân loại'], ...context.getCategories().map(category => [category.id, category.name])]),
    '<small class="full muted">Thêm hoặc đổi tên loại trong menu Phân loại.</small>',
    ...(game.mode === 'login' ? [] : [`<label class="check-field full"><input name="password_required" type="checkbox" ${config.password_required ? 'checked' : ''}> Yêu cầu mật khẩu game</label>`]),
    `<label class="check-field full"><input name="active" type="checkbox" ${game.active ? 'checked' : ''}> Hiển thị game trên cửa hàng</label>`,
  ].join(''), context);
}
export function openCategoryEditor(category, context) {
  const target = mount(category ? 'Sửa phân loại' : 'Thêm phân loại', 'Tên sẽ được cập nhật cho mọi game thuộc phân loại này.', `<div class="field-grid">${input('name', 'Tên phân loại', category?.name || '', { full: true, required: true, max: '80', help: 'Ví dụ: Nạp UID, Nạp login, Game quốc tế…' })}</div>`, context, category ? 'Lưu phân loại' : 'Tạo phân loại');
  const form = target.querySelector('form');
  form.querySelector('[name="name"]').focus();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'); button.disabled = true; form.dataset.saving = 'true';
    try {
      await context.api('/api/admin/categories' + (category ? '/' + encodeURIComponent(category.id) : ''), { name: form.elements.name.value }, category ? 'PATCH' : 'POST');
      target.close(); context.toast(category ? 'Đã cập nhật phân loại.' : 'Đã tạo phân loại.'); await context.refresh();
    } catch (error) { showError(error); }
    finally { button.disabled = false; form.dataset.saving = 'false'; }
  });
}

export function openTierEditor(tier, context) {
  const target = mount('Chỉnh hạng khách', `${tier.name || tier.tier} · giá tự động theo phần trăm giảm`, `<div class="field-grid">${input('name', 'Tên hạng', tier.name || tier.tier, { full: true, required: true, max: '80' })}${input('discount_percent', 'Giảm giá (%)', Number(tier.discount_percent || 0), { type: 'number', required: true, help: 'Áp dụng cho đơn mới của user thuộc hạng này.' })}<label class="check-field full"><input name="active" type="checkbox" ${tier.active !== false ? 'checked' : ''}> Cho phép gán hạng này</label><div class="full detail-note">Giá sau giảm được làm tròn đến đồng. Các đơn đã tạo không thay đổi.</div></div>`, context, 'Lưu hạng');
  const form = target.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    try {
      await context.api('/api/admin/tiers/' + encodeURIComponent(tier.tier), { name: form.elements.name.value, discount_percent: Number(form.elements.discount_percent.value), active: form.elements.active.checked }, 'PATCH');
      target.close(); context.toast('Đã cập nhật hạng khách.'); await context.refresh();
    } catch (error) { showError(error); } finally { button.disabled = false; }
  });
}

export async function openCustomerHistory(customer, context) {
  const target = mount('Lịch sử hoạt động', customer.email,
    '<section class="customer-history" aria-live="polite"><p>Đang tải lịch sử…</p></section>', context);
  const history = target.querySelector('.customer-history');
  try {
    const data = await context.api('/api/admin/customers/' + encodeURIComponent(customer.id) + '/history');
    const topupLink = code => '/payment?topup=' + encodeURIComponent(code);
    const orderLink = code => '/orders?order=' + encodeURIComponent(code);
    const topupCodes = new Set(data.topups.map(item => item.code));
    const activity = [
      ...data.orders.map(order => ({ type: 'orders', category: order.payment_method === 'wallet' ? 'Đơn trả bằng ví' : 'Đơn chuyển khoản', label: order.game_name + ' · ' + order.package_name, code: order.code, href: orderLink(order.code), amount: money(order.price_cents), status: context.statusBadge(order.status), time: order.created_at })),
      ...data.topups.map(item => ({ type: 'wallet', category: 'Nạp số dư', label: item.status === 'completed' ? 'Đã cộng vào ví' : item.status === 'cancelled' ? 'Đã hủy nạp ví' : 'Chờ nhận tiền nạp ví', code: item.code, href: topupLink(item.code), amount: (item.status === 'completed' ? '+' : '') + money(item.amount_cents), time: item.created_at })),
      ...data.ledger.filter(item => !topupCodes.has(item.topup_code)).map(item => ({
        type: 'wallet',
        category: ({ deposit: 'Cộng tiền vào ví', purchase: 'Trừ ví để trả đơn', refund: 'Hoàn tiền về ví' })[item.kind] || 'Biến động ví',
        label: item.note || (item.order_code ? 'Giao dịch liên quan đến đơn' : 'Giao dịch ví'),
        code: item.order_code || item.topup_code || item.reference,
        href: item.order_code ? orderLink(item.order_code) : item.topup_code ? topupLink(item.topup_code) : '',
        amount: (item.amount_cents > 0 ? '+' : '') + money(item.amount_cents), time: item.created_at,
      })),
    ].sort((a, b) => new Date(b.time) - new Date(a.time));
    history.innerHTML = `<div class="history-summary"><span>Số dư ví <strong>${money(data.customer.wallet_cents)}</strong></span><label>Hiển thị <select><option value="">Tất cả</option><option value="orders">Đơn nạp</option><option value="wallet">Ví</option></select></label></div><ol class="customer-activity"></ol>`;
    const totals = document.createElement('dl');
    totals.className = 'customer-activity-totals';
    totals.innerHTML = [
      ['Tổng nạp số dư', data.totals.wallet_topup_cents],
      ['Tổng đơn chuyển khoản đã trả', data.totals.direct_paid_cents],
      ['Tổng đã trừ ví', data.totals.wallet_spent_cents],
    ].map(([label, amount]) => `<div><dt>${label}</dt><dd>${money(amount)}</dd></div>`).join('');
    history.prepend(totals);
    const filter = history.querySelector('select');
    const list = history.querySelector('ol');
    function render() {
      list.innerHTML = activity.filter(item => !filter.value || item.type === filter.value).map(item =>
        `<li><div><strong>${e(item.category)}</strong><span>${e(item.label)}</span><small>${date(item.time)}</small>${item.href ? `<a href="${e(item.href)}">${e(item.code)} ↗</a>` : `<span>${e(item.code)}</span>`}</div><div><strong class="${item.amount.startsWith('+') ? 'ledger-positive' : item.amount.startsWith('-') ? 'ledger-negative' : ''}">${e(item.amount)}</strong>${item.status || ''}</div></li>`).join('') || '<li>Chưa có giao dịch.</li>';
    }
    filter.addEventListener('change', render);
    render();
  } catch (error) {
    history.textContent = error.message;
  }
}

export function openCustomerEditor(customer, context) {
  const tiers = context.getTiers?.() || [{ tier: 'standard', name: 'Standard', discount_percent: 0 }];
  const tierOptions = tiers.map(tier => [tier.tier, `${tier.name || tier.tier} · giảm ${Number(tier.discount_percent || 0)}%`]);
  const target = mount('Quản lý khách hàng', customer.email, `<div class="field-grid">${select('role', 'Vai trò', customer.role, [['customer', 'Khách hàng'], ['ctv', 'CTV'], ['admin', 'Admin']])}${select('tier', 'Hạng khách', customer.tier || 'standard', tierOptions)}<label class="check-field full"><input name="active" type="checkbox" ${customer.active ? 'checked' : ''}> Tài khoản đang hoạt động</label><div class="full detail-note">Giá gói sẽ tự giảm theo hạng khi khách tạo đơn mới. Đơn cũ không thay đổi.</div></div>`, context, 'Lưu tài khoản');
  const form = target.querySelector('form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'); if (form.dataset.saving === 'true') return;
    form.dataset.saving = 'true'; button.disabled = true;
    try {
      await context.api('/api/admin/customers/' + encodeURIComponent(customer.id), { role: form.elements.role.value, tier: form.elements.tier.value, active: form.elements.active.checked }, 'PATCH');
      target.close(); context.toast('Đã cập nhật tài khoản.'); await context.refresh();
    } catch (error) { showError(error); } finally { form.dataset.saving = 'false'; button.disabled = false; }
  });
}
export function openPackageEditor(pkg, context) {
  const games = context.getGames();
  if (!pkg && !games.length) return context.toast('Cần có game trước khi tạo gói nạp.', true);
  pkg ||= { name: '', nominal: '', badge: '', image: '', game_id: context.getSelectedGame() || games[0].id, active: true, ctv_cents: 0, tier: 'standard' };
  editor('packages', pkg, [
    ...(!pkg.id ? [`<div class="full">${select('game_id', 'Game', pkg.game_id, games.map(game => [game.id, game.name]))}</div>`] : []),
    input('name', 'Tên gói nạp', pkg.name, { full: true, required: true }),
    input('nominal', 'Số lượng (tùy chọn)', pkg.nominal || '', { required: Boolean(pkg.id), max: '80' }),
    input('badge', 'Nhãn nổi bật', pkg.badge || '', { max: '40' }),
    input('customer_price', 'Giá khách (₫)', pkg.id ? Number(pkg.customer_cents || 0) / 100 : '', { type: 'number', required: true }),
    input('ctv_price', 'Giá CTV (₫)', Number(pkg.ctv_cents || 0) / 100, { type: 'number', required: true }),
    `<div class="full">${imagePicker('image', 'Ảnh gói nạp', pkg.image, 'Ảnh sản phẩm hiển thị tại bước chọn gói', true)}</div>`,
    `<label class="check-field full"><input name="active" type="checkbox" ${pkg.active ? 'checked' : ''}> Đang bán trên cửa hàng</label>`,
  ].join(''), context);
}

export async function openOrder(code, context) {
  const target = mount('Chi tiết đơn hàng', code, '<div class="skeleton"></div><p class="muted">Đang tải thông tin đơn…</p>', context);
  const generation = target.dataset.generation;
  try {
    const order = await context.api('/api/admin/orders/' + encodeURIComponent(code));
    if (!target.open || target.dataset.generation !== generation) return;
    const info = [['Mã đơn', `<span class="mono">${e(order.code)}</span>`], ['Trạng thái', context.statusBadge(order.status)], ['Khách hàng', e(order.customer)], ['Game', e(order.game_name)], ['Gói nạp', e(order.package_name)], ['Tổng tiền', money(order.price_cents)], ['Thanh toán', order.payment_method === 'wallet' ? 'Ví tài khoản' : 'Chuyển khoản ngân hàng'], ['Ngày tạo', date(order.created_at)]];
    if (order.processing_admin) info.push(['Admin xử lý', e(order.processing_admin)]);
    if (order.processing_started_at) info.push(['Bắt đầu nạp', date(order.processing_started_at)]);
    if (order.completed_at) info.push(['Hoàn thành lúc', date(order.completed_at)]);
    const labels = {uid:'UID người chơi',login:'Tài khoản game',password:'Mật khẩu game',server:'Máy chủ',region:'Khu vực',character:'Nhân vật',note:'Ghi chú của khách'};
    const fields = Object.entries(order.target || {}).filter(([key]) => labels[key]).map(([key,value]) => `<div class="fulfillment-field"><dt>${labels[key]}</dt><dd>${key === 'password' ? `<details><summary>Hiện mật khẩu game</summary><span class="fulfillment-value">${e(value)}</span></details>` : `<span class="fulfillment-value">${e(value)}</span>`}<button class="button subtle" type="button" data-copy-target="${e(key)}">Sao chép</button></dd></div>`).join('');
    const credentials = ['cancelled','refunded'].includes(order.status) ? '' : `<details class="fulfillment-target" ${['pending_admin','processing'].includes(order.status) ? 'open' : ''}><summary>Thông tin nạp game <span class="muted">· chỉ admin xem</span></summary><p class="muted">Lượt xem thông tin được ghi nhận trong nhật ký.</p>${fields ? `<dl>${fields}</dl>` : '<p>Đơn này chưa có thông tin nạp. Cần kiểm tra với khách trước khi xử lý.</p>'}</details>`;
    let action = '', submit = '', endpoint = '';
    if (order.status === 'awaiting_payment') {
      action = '<div class="detail-note">Đối chiếu đúng số tiền và nội dung ZET + mã đơn trước khi xác nhận.</div>';
      submit = 'Xác nhận đã nhận tiền'; endpoint = 'confirm-payment';
    } else if (order.status === 'pending_admin') {
      action = '<div class="detail-note">Đơn đã thanh toán. Bấm nhận xử lý trước khi thực hiện nạp để tránh hai người cùng nạp.</div>';
      submit = ''; endpoint = '';
    } else if (order.status === 'processing') {
      action = order.can_complete ? '<div class="detail-note">Kiểm tra đúng game, UID/tài khoản và gói nạp trước khi hoàn tất.</div>' : `<div class="detail-note">Đơn đang được ${e(order.processing_admin || 'admin khác')} xử lý.</div>`;
      if (order.can_complete) { submit = ''; endpoint = ''; }
    } else if (order.status === 'completed') {
      action = '<div class="detail-note">Đơn đã hoàn thành. Không thực hiện nạp lại.</div>';
    } else if (order.status === 'cancelled') {
      action = '<div class="detail-note">Đơn đã hủy.</div>';
    } else if (order.status === 'needs_review') {
      action = '<div class="detail-note">Chưa rõ kết quả nạp. Đối soát trước khi thử lại, hủy hoặc hoàn tiền.</div>';
    } else if (order.status === 'failed') {
      action = '<div class="detail-note">Đã xác nhận chưa giao vật phẩm. Có thể đưa về chờ xử lý hoặc hủy đơn.</div>';
    } else if (order.status === 'refund_pending') {
      action = '<div class="detail-note">Đang chờ hoàn chuyển khoản. Chuyển tiền ngoài web rồi ghi nhận mã giao dịch thực tế.</div>';
    } else if (order.status === 'refunded') {
      action = '<div class="detail-note">Đơn đã hoàn tiền. Không thực hiện nạp hoặc hoàn thêm lần nữa.</div>';
    } else {
      action = '<div class="detail-note">Đơn thuộc luồng xử lý cũ. Giữ nguyên để kiểm tra, tránh nạp trùng.</div>';
    }
    mount('Chi tiết đơn hàng', order.code, `<dl class="detail-grid">${info.map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>${credentials}${action}${orderManagement(order)}`, context, submit, true);
    bindOrderManagement(target,order,context,openOrder,showError);
    target.querySelectorAll('[data-copy-target]').forEach(button => button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(order.target[button.dataset.copyTarget]); context.toast('Đã sao chép thông tin nạp.'); }
      catch { context.toast('Không thể sao chép. Hãy chọn thông tin và sao chép thủ công.', true); }
    }));
    const clearPrivate = () => { if (!target.open) target.innerHTML = ''; };
    target.addEventListener('close', clearPrivate, {once:true});
    const form = target.querySelector('form');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (form.dataset.saving === 'true' || target.dataset.saving === 'true') return;
      form.dataset.saving = 'true'; target.dataset.saving = 'true'; button.disabled = true;
      const preventClose = event => event.preventDefault();
      target.addEventListener('cancel', preventClose);
      try {
        const confirmed = endpoint === 'complete' ? true : form.elements.confirmed?.checked === true;
        await context.api(`/api/admin/orders/${encodeURIComponent(code)}/${endpoint}`, {confirmed}, 'POST');
        await context.refresh();
        context.toast(endpoint === 'complete' ? 'Đã hoàn thành đơn nạp.' : endpoint === 'start' ? 'Bạn đã nhận xử lý đơn.' : 'Đã xác nhận nhận tiền.');
        form.dataset.saving = 'false'; target.dataset.saving = 'false';
        target.close();
        if (endpoint !== 'complete') await openOrder(code, context);
      } catch (error) { showError(error); }
      finally { form.dataset.saving = 'false'; target.dataset.saving = 'false'; button.disabled = false; target.removeEventListener('cancel', preventClose); }
    });
  } catch (error) {
    if (target.open && target.dataset.generation === generation) mount('Không tải được đơn hàng', code, `<div class="inline-error" role="alert">${e(error.message)}</div>`, context);
  }
}
