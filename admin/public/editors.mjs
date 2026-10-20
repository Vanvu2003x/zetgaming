import { escapeHtml as e, money, date, imageUrl } from './data.mjs';

const dialog = () => document.querySelector('#editor');
let dialogGeneration = 0;
const input = (name, label, value, { type = 'text', full = false, required = false, help = '', max = '120' } = {}) => `<label class="${full ? 'full' : ''}">${label}<input name="${name}" value="${e(value)}" type="${type}" ${required ? 'required' : ''} ${type === 'number' ? 'min="0" step="0.01"' : `maxlength="${max}"`}>${help ? `<small>${help}</small>` : ''}</label>`;
const select = (name, label, current, options) => `<label>${label}<select name="${name}">${options.map(([value, text]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
const safeImage = url => /^(https:\/\/|\/(?!\/))/.test(url || '');
const preview = (url, name) => `<div class="editor-preview"><img ${safeImage(url) ? `src="${e(imageUrl(url))}"` : 'hidden'} alt="Xem trước ảnh"><span>${e(name)}</span></div>`;
const imagePicker = (field, label, value, help) => `<div class="image-picker"><label>${label}<span class="image-picker-preview ${field === 'thumbnail' ? 'square' : ''}"><img ${safeImage(value) ? `src="${e(imageUrl(value))}"` : 'hidden'} alt="Xem trước ${label.toLowerCase()}"><span>${field === 'thumbnail' ? 'Ảnh vuông' : 'Ảnh ngang'}</span></span><input type="file" data-upload-field="${field}" accept="image/png,image/jpeg,image/webp" aria-label="Chọn ${label.toLowerCase()}"></label><input type="hidden" name="${field}" value="${e(value || '')}"><small>${help} · PNG, JPG, WebP ≤ 5 MB</small></div>`;
function mount(title, description, body, context, submit = '') {
  const target = dialog();
  target.dataset.generation = String(++dialogGeneration);
  target.innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">${e(title)}</h2><p>${e(description)}</p></div><button class="icon-button" data-close aria-label="Đóng">${context.symbol('close')}</button></div>${submit ? '<form id="resource-form">' : ''}<div class="dialog-body"><div class="inline-error" id="form-error" role="alert" hidden></div>${body}</div><div class="dialog-footer"><button class="button" type="button" data-close>${submit ? 'Hủy' : 'Đóng'}</button>${submit ? `<button class="button primary" type="submit">${context.symbol('check')} ${submit}</button>` : ''}</div>${submit ? '</form>' : ''}`;
  target.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { if (target.querySelector('form')?.dataset.saving !== 'true') target.close(); }));
  if (!target.open) target.showModal();
  target.querySelector('[data-close]').focus();
  return target;
}
function showError(error) {
  const target = dialog().querySelector('#form-error');
  target.textContent = error.message; target.hidden = false;
  target.scrollIntoView({ block: 'nearest' });
}
function editor(type, item, fields, context) {
  const target = mount(type === 'games' ? 'Chỉnh sửa game' : 'Chỉnh sửa gói nạp', type === 'games' ? 'Ảnh nền và thumbnail được quản lý riêng.' : item.game_name + ' · Giá nhập theo đồng Việt Nam', (type === 'games' ? '' : preview(item.image, item.name)) + `<div class="field-grid">${fields}</div>`, context, 'Lưu thay đổi');
  const form = target.querySelector('form');
  const preventBusyClose = event => { if (form.dataset.saving === 'true') event.preventDefault(); };
  target.addEventListener('cancel', preventBusyClose);
  form.querySelector('[name="image"]:not([type="hidden"])')?.addEventListener('input', event => {
    const url = event.target.value.trim(); const image = target.querySelector('.editor-preview img');
    if (safeImage(url)) { image.src = imageUrl(url); image.hidden = false; } else { image.removeAttribute('src'); image.hidden = true; }
  });
  const objectUrls = new Map();
  const cleanup = () => { for (const url of objectUrls.values()) URL.revokeObjectURL(url); target.removeEventListener('cancel', preventBusyClose); };
  target.addEventListener('close', cleanup, { once: true });
  form.querySelectorAll('[data-upload-field]').forEach(input => input.addEventListener('change', () => {
    const file = input.files[0];
    const field = input.dataset.uploadField;
    const image = input.closest('.image-picker').querySelector('img');
    if (objectUrls.has(field)) { URL.revokeObjectURL(objectUrls.get(field)); objectUrls.delete(field); }
    const restorePreview = () => { const original = imageUrl(form.elements[field].value); image.hidden = !original; if (original) image.src = original; else image.removeAttribute('src'); };
    if (!file) { restorePreview(); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      input.value = ''; restorePreview(); showError(new Error('Chọn ảnh PNG, JPG hoặc WebP không quá 5 MB.')); return;
    }
    const url = URL.createObjectURL(file); objectUrls.set(field, url);
    image.src = url; image.hidden = false;
    target.querySelector('#form-error').hidden = true;
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
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
      if (values.image && !safeImage(values.image.trim())) throw new Error('Ảnh cần là đường dẫn /… hoặc URL https://…');
      if (values.thumbnail && !safeImage(values.thumbnail.trim())) throw new Error('Đường dẫn thumbnail không hợp lệ.');
      await context.api(`/api/admin/${type}/${encodeURIComponent(item.id)}`, values);
      target.close(); context.toast('Đã lưu thay đổi.'); await context.refresh();
    } catch (error) { showError(error); }
    finally {
      form.dataset.saving = 'false'; form.setAttribute('aria-busy', 'false');
      form.querySelectorAll('[data-upload-field]').forEach(input => { input.disabled = false; });
      button.disabled = false; button.innerHTML = `${context.symbol('check')} Lưu thay đổi`;
    }
  });
}
export function openGameEditor(game, context) {
  if (!game) return;
  editor('games', game, [
    input('name', 'Tên game', game.name, { full: true, required: true }),
    `<div class="full game-image-pickers">${imagePicker('image', 'Ảnh nền / banner', game.image, 'Nền ngang của card và trang game')}${imagePicker('thumbnail', 'Thumbnail', game.thumbnail, 'Icon vuông cạnh tên game')}</div>`,
    select('mode', 'Kiểu nạp', game.mode, [['uid', 'Nạp UID'], ['login', 'Nạp login']]),
    select('platform', 'Nền tảng', game.platform, [['mobile', 'Mobile'], ['pc', 'PC'], ['other', 'Khác']]),
    `<label class="check-field full"><input name="active" type="checkbox" ${game.active ? 'checked' : ''}> Hiển thị game trên cửa hàng</label>`,
  ].join(''), context);
}
export function openPackageEditor(pkg, context) {
  if (!pkg) return;
  editor('packages', pkg, [
    input('name', 'Tên gói nạp', pkg.name, { full: true, required: true }),
    input('nominal', 'Mệnh giá / số lượng', pkg.nominal || '', { required: true, max: '80' }),
    input('badge', 'Nhãn nổi bật', pkg.badge || '', { max: '40' }),
    input('customer_price', 'Giá khách (₫)', Number(pkg.customer_cents || 0) / 100, { type: 'number', required: true }),
    input('ctv_price', 'Giá CTV (₫)', Number(pkg.ctv_cents || 0) / 100, { type: 'number', required: true }),
    input('image', 'Ảnh gói nạp', pkg.own_image, { full: true, max: '1000', help: 'Để trống để dùng ảnh game.' }),
    `<label class="check-field full"><input name="active" type="checkbox" ${pkg.active ? 'checked' : ''}> Đang bán trên cửa hàng</label>`,
  ].join(''), context);
}

export async function openOrder(code, context) {
  const target = mount('Chi tiết đơn hàng', code, '<div class="skeleton"></div><p class="muted">Đang tải thông tin đơn…</p>', context);
  const generation = target.dataset.generation;
  try {
    const order = await context.api('/api/orders/' + encodeURIComponent(code));
    if (!target.open || target.dataset.generation !== generation) return;
    let ctvs = [];
    if (order.status === 'pending_admin') ctvs = await context.api('/api/admin/ctvs');
    if (!target.open || target.dataset.generation !== generation) return;
    const info = [['Mã đơn', `<span class="mono">${e(order.code)}</span>`], ['Trạng thái', context.statusBadge(order.status)], ['Khách hàng', e(order.customer)], ['Game', e(order.game_name)], ['Gói nạp', e(order.package_name)], ['Tổng tiền', money(order.price_cents)], ['Thanh toán', order.payment_method === 'wallet' ? 'Ví tài khoản' : 'Thanh toán trực tiếp'], ['Ngày tạo', date(order.created_at)]];
    let action = '';
    if (order.status === 'pending_admin') action = `<div class="order-action"><h3>Phân đơn cho cộng tác viên</h3><p>Chọn ít nhất một CTV. Người nhận trước sẽ xử lý đơn này.</p><div class="ctv-options">${ctvs.length ? ctvs.map(ctv => `<label class="check-field"><input type="checkbox" name="ctv" value="${e(ctv.id)}"> ${e(ctv.email)}</label>`).join('') : '<p>Chưa có cộng tác viên để phân đơn.</p>'}</div></div>`;
    if (order.status === 'review') action = '<div class="detail-note">Quyết toán sẽ hoàn tất đơn và ghi thu nhập vào ví CTV. Chỉ thực hiện sau khi đã kiểm tra kết quả nạp.</div>';
    if (order.status === 'awaiting_payment') action = '<div class="detail-note">Đơn đang chờ thanh toán. Chỉ phân CTV sau khi hệ thống đã xác nhận thanh toán.</div>';
    mount('Chi tiết đơn hàng', order.code, `<dl class="detail-grid">${info.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>${action}`, context, order.status === 'pending_admin' && ctvs.length ? 'Duyệt & phân đơn' : order.status === 'review' ? 'Xác nhận quyết toán' : '');
    const form = target.querySelector('form');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]'); button.disabled = true;
      try {
        const ctv_ids = [...form.querySelectorAll('[name="ctv"]:checked')].map(input => input.value);
        if (order.status === 'pending_admin' && !ctv_ids.length) throw new Error('Chọn ít nhất một cộng tác viên.');
        await context.api(`/api/admin/orders/${encodeURIComponent(code)}/${order.status === 'review' ? 'settle' : 'approve'}`, order.status === 'review' ? {} : { ctv_ids }, 'POST');
        target.close(); context.toast(order.status === 'review' ? 'Đã quyết toán đơn hàng.' : 'Đã phân đơn cho cộng tác viên.'); await context.refresh();
      } catch (error) { showError(error); }
      finally { button.disabled = false; }
    });
  } catch (error) {
    if (target.open && target.dataset.generation === generation) mount('Không tải được đơn hàng', code, `<div class="inline-error" role="alert">${e(error.message)}</div>`, context);
  }
}
