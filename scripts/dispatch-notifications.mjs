import 'dotenv/config';
import { pool } from '../backend/db/pool.mjs';
import { env } from '../backend/config/env.mjs';
import { deliverEmail } from '../backend/modules/auth/email-delivery.mjs';
import { notificationText, notificationEmail } from '../backend/modules/notifications/service.mjs';
import { pathToFileURL } from 'node:url';
import https from 'node:https';

const telegram = (chatId, text) => new Promise((resolve, reject) => {
  const body = JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true });
  const request = https.request(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, { method: 'POST', family: 4, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, response => {
    response.resume();
    response.on('end', () => response.statusCode >= 200 && response.statusCode < 300 ? resolve() : reject(new Error('Telegram từ chối gửi thông báo.')));
  });
  request.setTimeout(8000, () => request.destroy(new Error('Telegram hết thời gian kết nối.')));
  request.on('error', reject);
  request.end(body);
});
const zalo = async (groupId, text) => {
  const headers = { 'content-type': 'application/json' };
  if (env.zalo.accessToken) headers.authorization = `Bearer ${env.zalo.accessToken}`;
  const response = await fetch(env.zalo.webhookUrl, { method: 'POST', headers, body: JSON.stringify({ group_id: groupId, message: text }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('Zalo từ chối gửi thông báo.');
};
export async function dispatchNotifications() {
  const rows = (await pool.query(`SELECT n.id,n.channel,n.recipient,n.event,n.payload,o.code,o.status FROM order_notifications n JOIN orders o ON o.id=n.order_id WHERE n.status='pending' AND n.attempts<5 ORDER BY n.created_at LIMIT 50`)).rows;
  for (const item of rows) {
    try { const data = { ...item, ...item.payload }; const text = notificationText(data); if (item.channel === 'email') { const email = notificationEmail(data); await deliverEmail({ to: item.recipient, subject: email.subject, text: email.text, html: email.html }); } else if (item.channel === 'telegram') await telegram(item.recipient, text); else if (item.channel === 'zalo') await zalo(item.recipient, text); else throw new Error(`Kênh thông báo không hỗ trợ: ${item.channel}`); await pool.query(`UPDATE order_notifications SET status='sent',attempts=attempts+1,sent_at=now(),last_error=NULL WHERE id=$1`, [item.id]); }
    catch (error) { await pool.query(`UPDATE order_notifications SET status=CASE WHEN attempts+1>=5 THEN 'failed' ELSE 'pending' END,attempts=attempts+1,last_error=$2 WHERE id=$1`, [item.id, String(error.message).slice(0, 500)]); }
  }
  return rows.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(`Processed ${await dispatchNotifications()} notification(s).`); }
  finally { await pool.end(); }
}
