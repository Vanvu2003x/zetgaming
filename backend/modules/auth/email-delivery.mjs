import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { id } from '../../utils/ids.mjs';
import { env } from '../../config/env.mjs';

export async function deliverEmail({ to, subject, text, html }) {
  if (env.emailDelivery === 'disabled') return { delivered: false, reason: 'disabled' };
  if (env.emailDelivery === 'local-outbox') {
    const outbox = join(process.cwd(), 'data', 'mail-outbox');
    await mkdir(outbox, { recursive: true });
    await writeFile(join(outbox, id() + '.json'), JSON.stringify({ to, subject, text, html: html || null, created_at: new Date().toISOString() }), { mode: 0o600, flag: 'wx' });
    return { delivered: true, mode: 'local-outbox' };
  }
  if (env.emailDelivery === 'webhook' && env.emailWebhookUrl) {
    const response = await fetch(env.emailWebhookUrl, { method: 'POST', headers: { 'content-type': 'application/json', ...(env.emailWebhookToken ? { authorization: `Bearer ${env.emailWebhookToken}` } : {}) }, body: JSON.stringify({ to, from: env.emailFrom, subject, text, html: html || undefined }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw Object.assign(new Error('Dịch vụ email từ chối yêu cầu.'), { statusCode: 503 });
    return { delivered: true, mode: 'webhook' };
  }
  throw Object.assign(new Error('Email delivery chưa được cấu hình.'), { statusCode: 503 });
}
