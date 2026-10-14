import { createCipheriv, createHash, randomBytes } from 'node:crypto';
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
