import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAcbEmail } from '../backend/modules/orders/gmail-acb-parser.mjs';

const encode = value => Buffer.from(value).toString('base64url');
const message = ({ body, from = 'notify@acb.com.vn', subject = 'ACB biến động số dư', id = 'gmail-message-1' } = {}) => ({
  id,
  internalDate: '1762300000000',
  snippet: body,
  payload: {
    headers: [{ name: 'From', value: from }, { name: 'Subject', value: subject }, { name: 'Message-ID', value: `<${id}@mail.google.com>` }],
    body: { data: encode(body) },
  },
});

test('parses ACB amount, transfer content and ZET order code from a plain email', () => {
  const result = parseAcbEmail(message({ body: 'Số tiền: +20.000 VND\nNội dung: thanh toan ZETGPMABC123456ZET' }), { sender: 'notify@acb.com.vn' });
  assert.equal(result.ok, true);
  assert.equal(result.amount_vnd, 20000);
  assert.equal(result.amount_cents, 2000000);
  assert.equal(result.order_code, 'GPMABC123456');
  assert.equal(result.provider_event_id, 'gmail-message-1');
});

test('rejects an email from an untrusted sender and missing transfer code', () => {
  const result = parseAcbEmail(message({ from: 'spoof@example.com', body: 'Số tiền: 20.000 VND' }), { sender: 'notify@acb.com.vn' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /sender|mã/i);
});

test('parses HTML-only Gmail payloads and preserves the original message id', () => {
  const html = '<div>Số tiền <b>100,000 VND</b></div><div>Nội dung: ZETGPMHTML123456ZET</div>';
  const result = parseAcbEmail({ id: 'html-message', internalDate: '1762300000000', payload: { headers: [{ name: 'From', value: 'notify@acb.com.vn' }], mimeType: 'text/html', body: { data: encode(html) } } }, { sender: 'notify@acb.com.vn' });
  assert.equal(result.ok, true);
  assert.equal(result.amount_cents, 10000000);
  assert.equal(result.order_code, 'GPMHTML123456');
  assert.equal(result.provider_event_id, 'html-message');
});
