const csrf = document.querySelector('meta[name="admin-csrf"]')?.content || document.querySelector('meta[name="csrf-token"]')?.content || '';
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const readFields = (card, selector) => Object.fromEntries([...card.querySelectorAll(selector)].map(input => [input.dataset[selector.includes('game') ? 'gameField' : 'field'], input.type === 'checkbox' ? input.checked : input.value]));
const saveCard = async (card, kind) => {
  const isGame = kind === 'game';
  const fields = readFields(card, isGame ? '[data-game-field]' : '[data-field]');
  const status = card.querySelector(isGame ? '[data-game-save-status]' : '[data-save-status]');
  const button = card.querySelector(isGame ? '[data-save-game]' : '[data-save-package]');
  status.textContent = 'Đang lưu...'; status.dataset.state = ''; button.disabled = true;
  try {
    const response = await fetch(`/api/admin/${isGame ? 'games' : 'packages'}/${card.dataset[isGame ? 'gameId' : 'packageId']}`, { method:'PATCH', credentials:'same-origin', headers:{'Content-Type':'application/json','X-CSRF-Token':csrf}, body:JSON.stringify(fields) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Không thể lưu thay đổi');
    status.textContent = 'Đã lưu'; status.dataset.state = 'ok';
    if (isGame) { card.querySelector('[data-game-preview-status]').textContent = fields.active ? 'ĐANG HIỂN THỊ' : 'ĐANG ẨN'; card.querySelector('.admin-game-title strong').textContent = fields.name; }
  } catch (error) { status.textContent = error.message; status.dataset.state = 'error'; }
  finally { button.disabled = false; }
};
document.querySelectorAll('[data-save-game]').forEach(button => button.addEventListener('click', () => saveCard(button.closest('[data-game-id]'), 'game')));
document.querySelectorAll('[data-save-package]').forEach(button => button.addEventListener('click', () => saveCard(button.closest('[data-package-id]'), 'package')));
document.querySelectorAll('[data-game-field="image"], [data-field="image"]').forEach(input => input.addEventListener('input', () => { const card = input.closest('[data-game-id], [data-package-id]'); const image = card?.querySelector('.admin-game-preview img, .admin-package-preview img'); if (image && input.value.trim()) image.src = input.value.trim(); }));

const orderStatus = { awaiting_payment:'Chờ thanh toán', pending_admin:'Chờ duyệt', ready:'Đã phân CTV', claimed:'Đang xử lý', review:'Chờ quyết toán', completed:'Hoàn thành', cancelled:'Đã hủy' };
const formatMoney = cents => `${new Intl.NumberFormat('vi-VN').format(Number(cents || 0) / 100)} đ`;
const loadOrders = async () => {
  const target = document.querySelector('[data-admin-orders]'); if (!target) return;
  try {
    const response = await fetch('/api/orders', { credentials:'same-origin' });
    if (!response.ok) throw new Error('Không thể tải danh sách đơn');
    const orders = await response.json();
    const pending = orders.filter(order => !['completed','cancelled'].includes(order.status));
    const count = document.querySelector('#adminOrderCount'); if (count) count.textContent = pending.length;
    target.innerHTML = orders.length ? `<div class="admin-order-table"><div class="admin-order-row admin-order-head"><span>Mã đơn</span><span>Khách hàng</span><span>Gói nạp</span><span>Trạng thái</span><span>Tổng tiền</span></div>${orders.slice(0, 30).map(order => `<div class="admin-order-row"><strong>${escapeHtml(order.code)}</strong><span>${escapeHtml(order.customer || '—')}</span><span>${escapeHtml(order.package_name || '—')}</span><span class="admin-order-status">${escapeHtml(orderStatus[order.status] || order.status)}</span><strong>${formatMoney(order.price_cents)}</strong></div>`).join('')}</div>` : '<div class="admin-empty-state"><strong>Chưa có đơn hàng</strong><span>Khi có đơn mới, dữ liệu sẽ xuất hiện ở đây.</span></div>';
  } catch (error) { target.innerHTML = `<div class="admin-empty-state admin-error"><strong>${escapeHtml(error.message)}</strong><span>Thử tải lại trang để kiểm tra kết nối.</span></div>`; }
};
loadOrders();
