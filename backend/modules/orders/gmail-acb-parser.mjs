const headerValue = (message, name) => {
  const wanted = name.toLowerCase();
  return (message?.payload?.headers || []).find(header => String(header.name || '').toLowerCase() === wanted)?.value || '';
};

const decodeBody = data => {
  if (!data) return '';
  try { return Buffer.from(String(data).replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf8'); }
  catch { return ''; }
};

const stripHtml = html => String(html || '').replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
const normalizeText = value => String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\r?\n\s*/g, '\n').trim();
const collectParts = (part, output = []) => {
  if (!part) return output;
  const mime = String(part.mimeType || '').toLowerCase();
  if (part.body?.data && (mime === 'text/plain' || mime === 'text/html' || !mime)) output.push(mime === 'text/html' ? stripHtml(decodeBody(part.body.data)) : decodeBody(part.body.data));
  for (const child of part.parts || []) collectParts(child, output);
  return output;
};
const parseVndAmount = value => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

export const extractZetCode = content => normalizeText(content).match(/\bzet\s*([a-z0-9][a-z0-9_-]{5,63})\s*zet\b/i)?.[1]?.toUpperCase() || '';

export function parseAcbEmail(message, config = {}) {
  const from = headerValue(message, 'from').trim().toLowerCase();
  const subject = normalizeText(headerValue(message, 'subject'));
  const trustedSender = !config.sender || from.includes(String(config.sender).trim().toLowerCase());
  const body = normalizeText([...collectParts(message?.payload), message?.snippet].filter(Boolean).join('\n'));
  const amountMatch = body.match(/(?:số tiền|so tien|amount|ghi có|ghi co|credit)[^\d]{0,50}([+]?\s*[\d.,]+)\s*(?:vnd|vnđ|đ|d)\b/i) || body.match(/([+]?\s*[\d.,]+)\s*(?:vnd|vnđ|đ)\b/i);
  const amountVnd = parseVndAmount(amountMatch?.[1]);
  const orderCode = extractZetCode(body);
  const providerEventId = String(message?.id || headerValue(message, 'message-id')).trim();
  const result = { ok: trustedSender && Boolean(amountVnd) && Boolean(orderCode), provider_event_id: providerEventId, message_id: String(message?.id || ''), from, subject, content: body.slice(0, 4000), amount_vnd: amountVnd, amount_cents: amountVnd * 100, order_code: orderCode, occurred_at: message?.internalDate ? new Date(Number(message.internalDate)).toISOString() : null };
  if (result.ok) return result;
  result.reason = !trustedSender ? 'sender không nằm trong allowlist' : !amountVnd ? 'không đọc được số tiền' : 'không tìm thấy mã đơn dạng ZET<Mã đơn>ZET';
  return result;
}
