import { Router } from 'express';
import { requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';
import { withTransaction } from '../../db/pool.mjs';
import { khoablack } from './khoablack.mjs';
import { id } from '../../utils/ids.mjs';
import { randomUUID } from 'node:crypto';

export const khoablackSyncRouter = Router();

khoablackSyncRouter.post('/providers/khoablack/callback', async (req, res, next) => {
  try {
    const providerOrderId = String(req.body?.order_id || '').trim();
    if (!providerOrderId || providerOrderId.length > 120) return res.status(400).json({ error: 'Mã đơn KhoaBlack không hợp lệ.' });
    const linked = await req.db.query('SELECT 1 FROM orders WHERE provider_order_id=$1',[providerOrderId]);
    if (!linked.rowCount) return res.status(404).json({ error: 'Không tìm thấy đơn ZetGaming tương ứng.' });
    const verified = await khoablack.status(providerOrderId);
    const providerStatus = String(verified.status || '').trim().toLowerCase();
    const allowed = new Set(['pending', 'processing', 'success', 'cancelled', 'failed', 'refunded']);
    if (!allowed.has(providerStatus)) return res.status(400).json({ error: 'Trạng thái KhoaBlack không hợp lệ.' });
    const orderStatus = providerStatus === 'success' ? 'completed' : ['cancelled', 'failed', 'refunded'].includes(providerStatus) ? 'failed' : 'processing';
    const result = await withTransaction(async client => {
      const order = (await client.query('SELECT id,code,customer_id,price_cents,gross_price_cents,paid_at,status FROM orders WHERE provider_order_id=$1 FOR UPDATE', [providerOrderId])).rows[0];
      if (!order) return null;
      if (order.status !== 'processing') return { code:order.code,status:order.status };
      const failed = orderStatus === 'failed';
      if (failed && order.paid_at && order.customer_id && BigInt(order.price_cents) > 0n) {
        const refund = await client.query(`INSERT INTO ledger(id,user_id,order_id,kind,amount_cents,reference,note)
          VALUES($1,$2,$3,'provider_refund',$4,$5,$6) ON CONFLICT(reference) DO NOTHING`,
          [id(), order.customer_id, order.id, order.price_cents, `provider_refund:${order.id}`, 'Hoàn tiền tự động do KhoaBlack nạp lỗi']);
        if (refund.rowCount) await client.query('UPDATE users SET wallet_cents=wallet_cents+$1 WHERE id=$2', [order.price_cents, order.customer_id]);
      }
      if (failed && order.paid_at && !order.customer_id && BigInt(order.gross_price_cents ?? order.price_cents) > 0n) {
        const code = 'ZET'+randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
        await client.query('INSERT INTO coupons(id,code,amount_cents,source_order_id) VALUES($1,$2,$3,$4) ON CONFLICT(source_order_id) DO NOTHING',
          [id(),code,order.gross_price_cents ?? order.price_cents,order.id]);
      }
      const updated = (await client.query(`UPDATE orders SET provider_status=$1,provider_payload=$2::jsonb,provider_updated_at=now(),status=CASE WHEN $3='completed' THEN 'completed' WHEN $3='failed' THEN 'failed' ELSE status END,completed_at=CASE WHEN $3='completed' THEN now() ELSE completed_at END,updated_at=now() WHERE id=$4 RETURNING code,status`, [providerStatus, JSON.stringify(req.body), orderStatus, order.id])).rows[0];
      return updated;
    });
    if (!result) return res.status(404).json({ error: 'Không tìm thấy đơn ZetGaming tương ứng.' });
    res.json({ ok: true, ...result });
  } catch (error) { next(error); }
});

khoablackSyncRouter.post('/admin/providers/khoablack/sync', requireCsrf, requireRole('admin'), async (_req, res, next) => {
  try {
    const upstreamGames = await khoablack.games();
    let gamesCount = 0; let packagesCount = 0;
    await withTransaction(async client => {
      for (const game of upstreamGames) {
        const gameCode = String(game.gamecode || '').trim();
        const name = String(game.name || gameCode).trim().slice(0, 120);
        if (!gameCode || !name) continue;
        const slug = `khoa-${gameCode.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}`;
        const mode = Array.isArray(game.input_fields) && game.input_fields.some(field => /pass(word)?|username|account/i.test(`${field?.id} ${field?.name}`)) ? 'login' : 'uid';
        const inputConfig = JSON.stringify({ provider: 'khoablack', providerGameCode: gameCode, inputFields: game.input_fields || [], servers: game.servers || [] });
        const savedGame = (await client.query(`INSERT INTO games(id,slug,name,mode,image,platform,active,provider_game_code,input_config)
          VALUES($1,$2,$3,$4,$5,'mobile',true,$6,$7::jsonb)
          ON CONFLICT(provider_game_code) DO UPDATE SET name=excluded.name,mode=excluded.mode,input_config=excluded.input_config,active=true
          RETURNING id`, [id(), slug, name, mode, String(game.thumbnail || '/zetgaming-fire-bg.png'), gameCode, inputConfig])).rows[0];
        if (!savedGame) continue;
        gamesCount += 1;
        const packages = await khoablack.packages(gameCode);
        for (const pkg of packages) {
          const providerId = String(pkg.id || '').trim();
          const packageName = String(pkg.package_name || providerId).trim().slice(0, 120);
          const price = Math.round(Number(pkg.price));
          if (!providerId || !packageName || !Number.isSafeInteger(price) || price < 0) continue;
          const packageRow = (await client.query(`INSERT INTO packages(id,game_id,name,nominal,image,badge,active,provider_package_id)
            VALUES($1,$2,$3,$4,NULL,NULL,true,$5)
            ON CONFLICT(provider_package_id) DO UPDATE SET game_id=excluded.game_id,name=excluded.name,nominal=excluded.nominal,active=true
            RETURNING id`, [id(), savedGame.id, packageName, packageName, providerId])).rows[0];
          await client.query(`INSERT INTO prices(package_id,tier,customer_cents,ctv_cents) VALUES($1,'standard',$2,0)
            ON CONFLICT(package_id,tier) DO UPDATE SET customer_cents=excluded.customer_cents`, [packageRow.id, price]);
          packagesCount += 1;
        }
      }
    });
    res.json({ ok: true, games: gamesCount, packages: packagesCount });
  } catch (error) { next(error); }
});
