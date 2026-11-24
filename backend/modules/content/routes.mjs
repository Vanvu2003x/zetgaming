import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../../middleware/auth.mjs';
import { audit } from '../../utils/audit.mjs';

export const contentRouter = Router();
const heroSchema = z.object({ eyebrow: z.string().trim().max(80), title: z.string().trim().min(1).max(120), description: z.string().trim().max(240), image: z.string().trim().max(500), active: z.boolean() });
contentRouter.use('/admin/content', requireRole('admin'));
contentRouter.get('/admin/content', async (req, res, next) => { try { const row = (await req.db.query('SELECT value FROM site_settings WHERE key=$1', ['home_hero'])).rows[0]; res.json({ hero: row?.value || null }); } catch (error) { next(error); } });
contentRouter.patch('/admin/content', async (req, res, next) => { try { const hero = heroSchema.parse(req.body?.hero); await req.db.query(`INSERT INTO site_settings(key,value,updated_at,updated_by) VALUES($1,$2::jsonb,now(),$3) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now(),updated_by=EXCLUDED.updated_by`, ['home_hero', JSON.stringify(hero), req.user.id]); await audit(req.db, req.user.id, 'site_content.updated', 'home_hero', { active: hero.active, image: hero.image }); res.json({ hero }); } catch (error) { next(error); } });
