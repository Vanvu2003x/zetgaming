import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.mjs';

const key = () => {
  if (!env.sessionSecret) throw new Error('Thiếu SESSION_SECRET');
  return createHash('sha256').update(env.sessionSecret).digest();
};

export function encryptJson(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
}

export function decryptJson(value) {
  const parts = String(value).split('.');
  if (parts.length !== 3) throw new Error('Không đọc được thông tin nạp đã mã hóa');
  const [iv, tag, body] = parts.map(part => Buffer.from(part, 'base64url'));
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Không đọc được thông tin nạp đã mã hóa');
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
}
