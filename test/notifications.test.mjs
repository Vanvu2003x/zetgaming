import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../backend/config/env.mjs';
import { notificationText, notificationEmail, queueOrderNotification } from '../backend/modules/notifications/service.mjs';

test('order notifications queue configured channels without exposing target data', async () => {
  const original = { emailDelivery: env.emailDelivery, emailEvents: env.notificationEmailEvents, adminEvents: env.notificationAdminEvents, token: env.telegramBotToken, chat: env.telegramChatId, zalo: env.zalo };
  const queries = [];
  const client = { async query(sql, params) { queries.push({ sql, params }); if (sql.includes('SELECT o.code')) return { rows: [{ code: 'GPTEST123', price_cents: '2000000', status: 'completed', customer_id: 'u1', email: 'user@example.com', game_name: 'Genshin Impact', package_name: '60 Genesis Crystals', payment_method: 'bank' }] }; return { rows: [] }; } };
  try {
    env.emailDelivery = 'local-outbox'; env.notificationEmailEvents = new Set(['order.payment_confirmed']); env.notificationAdminEvents = new Set(['order.payment_confirmed']); env.telegramBotToken = 'bot-token'; env.telegramChatId = '12345'; env.zalo = { enabled: true, webhookUrl: 'https://example.invalid/zalo', accessToken: 'token', groupId: 'group-1' };
    await queueOrderNotification(client, 'order.payment_confirmed', 'order-1');
    assert.equal(queries.filter(query => query.sql.includes('INSERT INTO order_notifications')).length, 3);
    const text = notificationText({ code: 'GPTEST123', status: 'paid', event: 'order.payment_confirmed', game_name: 'Genshin Impact', package_name: '60 Genesis Crystals', price_cents: 2000000 });
    assert.match(text, /GPTEST123/); assert.match(text, /Genshin Impact/); assert.match(text, /2\.000\.000/); assert.match(text, /\/orders\?query=GPTEST123/); assert.doesNotMatch(text, /password|target_encrypted/i);
    const email = notificationEmail({ code: 'GPTEST123', status: 'completed', event: 'order.admin_completed', game_name: 'Genshin Impact', package_name: '60 Genesis Crystals', price_cents: 2000000 });
    assert.match(email.html, /Đơn nạp đã hoàn tất/); assert.match(email.html, /Genshin Impact/); assert.match(email.html, /GPTEST123/);
  } finally { env.emailDelivery = original.emailDelivery; env.notificationEmailEvents = original.emailEvents; env.notificationAdminEvents = original.adminEvents; env.telegramBotToken = original.token; env.telegramChatId = original.chat; env.zalo = original.zalo; }
});

test('admin channels do not notify before payment confirmation', async () => {
  const original = { adminEvents: env.notificationAdminEvents, token: env.telegramBotToken, chat: env.telegramChatId, zalo: env.zalo };
  const queries = [];
  const client = { async query(sql) { queries.push(sql); if (sql.includes('SELECT o.code')) return { rows: [{ code: 'GPTEST124', price_cents: '100000', status: 'pending', customer_id: null, email: null, game_name: 'Roblox', package_name: '400 Robux', payment_method: 'bank' }] }; return { rows: [] }; } };
  try { env.notificationAdminEvents = new Set(['order.payment_confirmed']); env.telegramBotToken = 'bot-token'; env.telegramChatId = '12345'; env.zalo = { enabled: true, webhookUrl: 'https://example.invalid/zalo', accessToken: 'token', groupId: 'group-1' }; await queueOrderNotification(client, 'order.created', 'order-2'); assert.equal(queries.filter(sql => sql.includes('INSERT INTO order_notifications')).length, 0); }
  finally { env.notificationAdminEvents = original.adminEvents; env.telegramBotToken = original.token; env.telegramChatId = original.chat; env.zalo = original.zalo; }
});
