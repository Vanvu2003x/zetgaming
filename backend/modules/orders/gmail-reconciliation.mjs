import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { withTransaction } from '../../db/pool.mjs';
import { env } from '../../config/env.mjs';
import { audit } from '../../utils/audit.mjs';
import { id } from '../../utils/ids.mjs';
import { completeTopup } from '../wallet/routes.mjs';
import { parseAcbEmail } from './gmail-acb-parser.mjs';

export const gmailReconciliationRouter = Router();
const provider = 'gmail_acb';

const configured = () => env.gmail.enabled && env.gmail.userEmail && env.gmail.clientId && env.gmail.clientSecret && env.gmail.refreshToken && env.gmail.pubsubTopic && env.gmail.pubsubAudience && env.gmail.sender;
const bearer = request => String(request.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

async function verifyPubSubRequest(req) {
  const token = bearer(req);
  if (!token || !env.gmail.pubsubAudience) return false;
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: token, audience: env.gmail.pubsubAudience });
    const payload = ticket.getPayload();
    return Boolean(payload?.email && (!env.gmail.pubsubServiceAccount || payload.email === env.gmail.pubsubServiceAccount));
  } catch { return false; }
}

async function gmailAccessToken() {
  const auth = new OAuth2Client(env.gmail.clientId, env.gmail.clientSecret);
  auth.setCredentials({ refresh_token: env.gmail.refreshToken });
  const token = await auth.getAccessToken();
  if (!token.token) throw new Error('Không lấy được Gmail access token');
  return token.token;
}

async function gmailRequest(path, options = {}) {
  const token = await gmailAccessToken();
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(env.gmail.userEmail)}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error?.message || 'Gmail API request failed'); error.statusCode = response.status; throw error; }
  return data;
}

export async function renewGmailWatch() {
  if (!configured()) return { enabled: false, reason: 'Gmail reconciliation chưa đủ cấu hình' };
  const result = await gmailRequest('/watch', { method: 'POST', body: JSON.stringify({ topicName: env.gmail.pubsubTopic, labelIds: [env.gmail.watchLabel], labelFilterBehavior: 'include' }) });
  await withTransaction(async client => {
    await client.query(`INSERT INTO gmail_watch_state(mailbox,history_id,expiration) VALUES($1,$2,to_timestamp($3 / 1000.0)) ON CONFLICT(mailbox) DO UPDATE SET history_id=EXCLUDED.history_id,expiration=EXCLUDED.expiration,updated_at=now()`, [env.gmail.userEmail, String(result.historyId), Number(result.expiration)]);
  });
  return { enabled: true, history_id: String(result.historyId), expiration: result.expiration };
}

async function getHistory(startHistoryId) {
  const changes = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ startHistoryId: String(startHistoryId), historyTypes: 'messageAdded', ...(pageToken ? { pageToken } : {}) });
    const page = await gmailRequest(`/history?${query}`);
    changes.push(...(page.history || []).flatMap(item => item.messagesAdded || []).map(item => item.message).filter(Boolean));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return [...new Map(changes.map(item => [item.id, item])).values()];
}

async function reconcileMessage(client, message) {
  const parsed = parseAcbEmail(message, { sender: env.gmail.sender });
  const eventId = parsed.provider_event_id || `pubsub-${message.id}`;
  const duplicate = (await client.query('SELECT status,matched_order_id,matched_wallet_topup_id FROM payment_events WHERE provider=$1 AND provider_event_id=$2', [provider, eventId])).rows[0];
  if (duplicate) return { duplicate: true, matched: duplicate.status === 'matched' };
  const order = parsed.ok ? (await client.query(`SELECT id,code,price_cents,status FROM orders WHERE payment_method='direct' AND status='awaiting_payment' AND price_cents=$1 AND code=$2 FOR UPDATE`, [parsed.amount_cents, parsed.order_code])).rows[0] : null;
  const topup = parsed.ok && !order ? (await client.query(`SELECT id,code,amount_cents,status FROM wallet_topups WHERE status='awaiting_payment' AND amount_cents=$1 AND code=$2 FOR UPDATE`, [parsed.amount_cents, parsed.order_code])).rows[0] : null;
  const matched = Boolean(order || topup);
  await client.query(`INSERT INTO payment_events(id,provider,provider_event_id,amount_cents,transaction_ref,content,raw_payload,matched_order_id,matched_wallet_topup_id,status,occurred_at)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`, [id(), provider, eventId, parsed.amount_cents || 0, eventId, parsed.content || '', JSON.stringify({ gmail_message_id: message.id, from: parsed.from, subject: parsed.subject }), order?.id || null, topup?.id || null, parsed.ok ? (matched ? 'matched' : 'ignored') : 'rejected', parsed.occurred_at]);
  if (topup) return { matched: true, ...(await completeTopup(client, topup.code, null, eventId)) };
  if (order) {
    await client.query("UPDATE orders SET status='pending_admin',paid_at=now(),updated_at=now() WHERE id=$1", [order.id]);
    await audit(client, null, 'order.payment_confirmed', order.id, { amount_cents: String(parsed.amount_cents), method: provider, transaction_ref: eventId });
  }
  return { matched, order_id: order?.id || null, code: parsed.order_code || null };
}

export async function processGmailNotification(notification) {
  const historyId = String(notification?.historyId || '');
  if (!historyId) throw new Error('Gmail Pub/Sub notification thiếu historyId');
  const state = (await withTransaction(async client => (await client.query('SELECT history_id FROM gmail_watch_state WHERE mailbox=$1', [env.gmail.userEmail])).rows[0] || null));
  if (!state) { await renewGmailWatch(); return { initialized: true, processed: 0 }; }
  const messages = await getHistory(state.history_id);
  const results = [];
  for (const message of messages) {
    const full = await gmailRequest(`/messages/${encodeURIComponent(message.id)}?format=full`);
    results.push(await withTransaction(client => reconcileMessage(client, full)));
  }
  await withTransaction(async client => { await client.query('UPDATE gmail_watch_state SET history_id=$1,updated_at=now() WHERE mailbox=$2', [historyId, env.gmail.userEmail]); });
  return { initialized: false, processed: results.length, matched: results.filter(result => result.matched).length };
}

gmailReconciliationRouter.post('/payment/gmail/pubsub', async (req, res, next) => {
  try {
    if (!configured()) return res.status(503).json({ error: 'Gmail đối soát chưa được cấu hình.' });
    if (!(await verifyPubSubRequest(req))) return res.status(401).json({ error: 'Pub/Sub identity không hợp lệ.' });
    const encoded = req.body?.message?.data;
    const notification = encoded ? JSON.parse(Buffer.from(String(encoded), 'base64').toString('utf8')) : null;
    const result = await processGmailNotification(notification);
    res.status(204).end();
  } catch (error) { next(error); }
});
