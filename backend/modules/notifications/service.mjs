import { env } from '../../config/env.mjs';
import { id } from '../../utils/ids.mjs';

const events = new Set(['order.created','order.payment_confirmed','order.admin_started','order.admin_completed','order.cancelled','order.refund_requested','order.refund_paid']);
export async function queueOrderNotification(client, event, orderId, metadata = {}) {
  if (!events.has(event)) return;
  const row = (await client.query(`SELECT o.code,o.price_cents,o.status,o.customer_id,o.payment_method,u.email,p.name package_name,g.name game_name FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id LEFT JOIN users u ON u.id=o.customer_id WHERE o.id=$1`, [orderId])).rows[0];
  if (!row) return;
  const payload = JSON.stringify({ code: row.code, price_cents: Number(row.price_cents), status: row.status, game_name: row.game_name, package_name: row.package_name, payment_method: row.payment_method, customer: row.email || 'Khách vãng lai', event, ...metadata });
  if (env.notificationEmailEvents && row.email && env.emailDelivery !== 'disabled' && env.notificationEmailEvents.has(event)) {
    await client.query(`INSERT INTO order_notifications(id,order_id,user_id,channel,recipient,event,payload) VALUES($1,$2,$3,'email',$4,$5,$6::jsonb) ON CONFLICT DO NOTHING`, [id(), orderId, row.customer_id, row.email, event, payload]);
  }
  if (env.notificationAdminEvents?.has(event) && env.telegramBotToken && env.telegramChatId) {
    await client.query(`INSERT INTO order_notifications(id,order_id,user_id,channel,recipient,event,payload) VALUES($1,$2,NULL,'telegram',$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`, [id(), orderId, env.telegramChatId, event, payload]);
  }
  if (env.notificationAdminEvents?.has(event) && env.zalo.enabled && env.zalo.webhookUrl && env.zalo.groupId) {
    await client.query(`INSERT INTO order_notifications(id,order_id,user_id,channel,recipient,event,payload) VALUES($1,$2,NULL,'zalo',$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`, [id(), orderId, env.zalo.groupId, event, payload]);
  }
}

export const notificationText = (item) => {
  const label = { 'order.created':'Đơn mới tạo', 'order.payment_confirmed':'Đã xác nhận thanh toán', 'order.admin_started':'Admin bắt đầu xử lý', 'order.admin_completed':'Đã hoàn tất nạp', 'order.cancelled':'Đơn đã hủy', 'order.refund_requested':'Đang chờ hoàn tiền', 'order.refund_paid':'Đã hoàn tiền' }[item.event] || item.event;
  const amount = Number(item.price_cents || 0).toLocaleString('vi-VN') + ' đ';
  return `ZetGaming · ${label}\nMã đơn: ${item.code}\nGame: ${item.game_name || '—'}\nGói: ${item.package_name || '—'}\nSố tiền: ${amount}\nThanh toán: ${item.payment_method || '—'}\nKhách: ${item.customer || 'Khách vãng lai'}\nTrạng thái: ${item.status}`;
};
