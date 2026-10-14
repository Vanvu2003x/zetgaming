import { Router } from 'express';
export const healthRouter = Router();
healthRouter.get('/health', async (req, res, next) => {
  try { await req.db.query('SELECT 1'); res.json({ ok: true, service: 'topup-api', time: new Date().toISOString() }); }
  catch (error) { next(error); }
});
