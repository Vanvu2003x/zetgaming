export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const statuses = { awaiting_payment: 'Chờ thanh toán', pending_admin: 'Chờ duyệt', ready: 'Chờ CTV nhận', claimed: 'Đang xử lý', review: 'Chờ quyết toán', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
export const statusColor = status => ({ awaiting_payment: 'orange', pending_admin: 'orange', ready: 'blue', claimed: 'blue', review: 'purple', completed: 'green', cancelled: 'red' }[status] || '');
export function imageUrl(value) {
  if (/^https:\/\//.test(value || '')) return value;
  if (/^\/(?!\/)/.test(value || '')) return new URL(value, document.querySelector('meta[name="storefront-origin"]')?.content || 'http://localhost:4173').href;
  return '';
}
export const money = cents => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(Number(cents || 0) / 100);
export function toCents(value) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) throw new Error('Giá phải là số không âm, tối đa 2 chữ số thập phân.');
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('Giá vượt giới hạn cho phép.');
  return cents;
}
export const date = value => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : '—';
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
export const search = (items, query, fields) => items.filter(item => normalize(fields.map(field => item[field]).join(' ')).includes(normalize(query.trim())));
export function paginate(items, page = 1, size = 8) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  page = Math.min(pages, Math.max(1, Number(page) || 1));
  return { items: items.slice((page - 1) * size, page * size), page, pages, total: items.length, from: items.length ? (page - 1) * size + 1 : 0, to: Math.min(page * size, items.length) };
}
const dayKey = value => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 10);
export function revenueSeries(orders, now = new Date()) {
  const today = dayKey(now);
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = new Date(new Date(today).getTime() - (6 - i) * 86400000).toISOString().slice(0, 10);
    return { key, label: key.slice(8) + '/' + key.slice(5, 7), value: 0 };
  });
  for (const order of orders) {
    if (order.status !== 'completed' || !Number.isFinite(new Date(order.created_at).getTime())) continue;
    const day = days.find(day => day.key === dayKey(order.created_at));
    if (day) day.value += Number(order.price_cents || 0);
  }
  return days;
}
