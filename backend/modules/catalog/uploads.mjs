import express, { Router } from 'express';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';

export const gameUploadDirectory = fileURLToPath(new URL('../../../public/uploads/games/', import.meta.url));
const types = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export function imageExtension(bytes, mime) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24) return null;
  if (mime === 'image/png' && bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(16) <= 16384 && bytes.readUInt32BE(20) > 0 && bytes.readUInt32BE(20) <= 16384 && bytes.toString('ascii', bytes.length - 8, bytes.length - 4) === 'IEND') return 'png';
  if (mime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217) return 'jpg';
  if (mime === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16)) && bytes.readUInt32LE(4) === bytes.length - 8) return 'webp';
  return null;
}
export function createUploadsRouter({ directory = gameUploadDirectory } = {}) {
  const router = Router();
  router.post('/admin/uploads', requireCsrf, requireRole('admin'), express.raw({ type: Object.keys(types), limit: '5mb' }), async (req, res, next) => {
    try {
      const extension = imageExtension(req.body, req.get('content-type')?.split(';')[0]);
      if (!extension) return res.status(400).json({ error: 'Chỉ nhận ảnh PNG, JPG hoặc WebP hợp lệ, tối đa 5 MB.' });
      const filename = `${randomUUID()}.${extension}`;
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, filename), req.body, { flag: 'wx', mode: 0o644 });
      res.status(201).set('Cache-Control', 'no-store').json({ url: '/uploads/games/' + filename });
    } catch (error) { next(error); }
  });
  return router;
}
