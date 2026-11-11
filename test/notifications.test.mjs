import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../backend/config/env.mjs';
import { notificationText, queueOrderNotification } from '../backend/modules/notifications/service.mjs';

test('order notifications queue configured channels without exposing target data', async () => {
  const original = { emailDelivery: env.emailDelivery, emailEvents: env.notificationEmailEvents, token: env.telegramBotToken, chat: env.telegramChatId, zalo: env.zalo };
  const queries = [];
  const client = { async query(sql, params) { queries.push({ sql, params }); if (sql.includes('SELECT o.code')) return { rows: [{ code: 'GPTEST123', price_cents: '2000000', status: 'completed', customer_id: 'u1', email: 'user@example.com', game_name: 'Genshin Impact', package_name: '60 Genesis Crystals', payment_method: 'bank' }] }; return { rows: [] }; } };
  try {
    env.emailDelivery = 'local-outbox'; env.notificationEmailEvents = new Set(['order.admin_completed']); env.telegramBotToken = 'bot-token'; env.telegramChatId = '12345'; env.zalo = { enabled: true, webhookUrl: 'https://example.invalid/zalo', accessToken: 'token', groupId: 'group-1' };
    await queueOrderNotification(client, 'order.admin_completed', 'order-1', { from_status: 'processing' });
    assert.equal(queries.filter(query => query.sql.includes('INSERT INTO order_notifications')).length, 3);
    const text = notificationText({ code: 'GPTEST123', status: 'completed', event: 'order.admin_completed', game_name: 'Genshin Impact', package_name: '60 Genesis Crystals', price_cents: 2000000 });
    assert.match(text, /GPTEST123/); assert.match(text, /Genshin Impact/); assert.match(text, /2\.000\.000/); assert.doesNotMatch(text, /password|target_encrypted/i);
  } finally { env.emailDelivery = original.emailDelivery; env.notificationEmailEvents = original.emailEvents; env.telegramBotToken = original.token; env.telegramChatId = original.chat; env.zalo = original.zalo; }
});
