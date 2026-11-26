import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';
import { encryptJson, decryptJson } from '../../utils/crypto.mjs';
import { id } from '../../utils/ids.mjs';
import { validateGameTarget } from '../../../shared/game-inputs.mjs';

const slugSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);
const targetSchema = z.object({
  uid: z.string().max(120).optional(), login: z.string().max(120).optional(), password: z.string().max(200).optional(),
  additional_info: z.string().max(1000).optional(), zalo: z.string().max(120).optional(), note: z.string().max(1000).optional(),
  server: z.string().max(80).optional(), region: z.string().max(80).optional(), character: z.string().max(80).optional(),
  custom: z.record(z.string().max(200)).optional(),
}).strict();

export const savedInputsRouter = Router();

savedInputsRouter.get('/saved-inputs/:slug', requireAuth, async (req, res, next) => {
  try {
    const slug = slugSchema.parse(req.params.slug);
    const row = (await req.db.query(`SELECT s.target_encrypted,s.updated_at FROM saved_game_inputs s JOIN games g ON g.id=s.game_id WHERE s.user_id=$1 AND g.slug=$2`, [req.user.id, slug])).rows[0];
    if (!row) return res.status(404).json({ error: 'Chưa có thông tin được lưu cho game này.' });
    res.set('Cache-Control', 'private, no-store').json({ target: decryptJson(row.target_encrypted), updated_at: row.updated_at });
  } catch (error) { next(error); }
});

savedInputsRouter.post('/saved-inputs/:slug', requireCsrf, requireAuth, async (req, res, next) => {
  try {
    const slug = slugSchema.parse(req.params.slug);
    const body = z.object({ target: targetSchema }).strict().parse(req.body);
    const game = (await req.db.query('SELECT id,mode,input_config FROM games WHERE slug=$1 AND active=true', [slug])).rows[0];
    if (!game) return res.status(404).json({ error: 'Không tìm thấy game.' });
    const target = validateGameTarget(game.mode, game.input_config, body.target);
    await req.db.query(`INSERT INTO saved_game_inputs(id,user_id,game_id,target_encrypted) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,game_id) DO UPDATE SET target_encrypted=excluded.target_encrypted,updated_at=now()`, [id(), req.user.id, game.id, encryptJson(target)]);
    res.set('Cache-Control', 'no-store').json({ ok: true, message: 'Đã lưu thông tin nạp an toàn.' });
  } catch (error) { next(error); }
});
