import { Router } from 'express';
import { requireRole } from '../../middleware/auth.mjs';
import { parse } from '../../utils/validation.mjs';
import { z } from 'zod';

const querySchema = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), format: z.enum(['json','csv']).default('json') }).strict();
const csv = value => `"${String(value ?? '').replaceAll('"','""')}"`;
export const adminReportsRouter = Router();
adminReportsRouter.get('/admin/reports', requireRole('admin'), async (req, res, next) => {
  try {
    const input=parse(querySchema,req.query); const to=input.to || new Date().toISOString().slice(0,10); const from=input.from || new Date(Date.now()-29*86400000).toISOString().slice(0,10);
    if (from > to) return res.status(400).json({error:'Khoảng ngày không hợp lệ.'});
    const args=[from,to+' 23:59:59.999+00'];
    const summary=(await req.db.query(`SELECT COUNT(*)::int orders,COALESCE(SUM(price_cents) FILTER (WHERE status IN ('pending_admin','processing','completed')),0)::bigint gross,COALESCE(SUM(price_cents) FILTER (WHERE status='completed'),0)::bigint completed,COUNT(*) FILTER (WHERE status='cancelled')::int cancelled,COUNT(*) FILTER (WHERE status='refunded')::int refunded FROM orders WHERE created_at >= $1::date AND created_at < $2::timestamptz`,args)).rows[0];
    const byGame=(await req.db.query(`SELECT g.name game,COUNT(*)::int orders,COALESCE(SUM(o.price_cents) FILTER (WHERE o.status='completed'),0)::bigint revenue FROM orders o JOIN games g ON g.id=o.game_id WHERE o.created_at >= $1::date AND o.created_at < $2::timestamptz GROUP BY g.id,g.name ORDER BY revenue DESC,orders DESC`,args)).rows;
    const byPackage=(await req.db.query(`SELECT p.name package,g.name game,COUNT(*)::int orders,COALESCE(SUM(o.price_cents) FILTER (WHERE o.status='completed'),0)::bigint revenue FROM orders o JOIN packages p ON p.id=o.package_id JOIN games g ON g.id=o.game_id WHERE o.created_at >= $1::date AND o.created_at < $2::timestamptz GROUP BY p.id,p.name,g.name ORDER BY revenue DESC,orders DESC`,args)).rows;
    if(input.format==='csv'){ const lines=[['Game','Gói nạp','Số đơn','Doanh thu hoàn thành'],...byPackage.map(row=>[row.game,row.package,row.orders,Number(row.revenue)/100])]; res.type('text/csv').set('Content-Disposition',`attachment; filename="zetgaming-report-${from}-${to}.csv"`).send('\ufeff'+lines.map(row=>row.map(csv).join(',')).join('\r\n')); return; }
    res.set('Cache-Control','no-store').json({from,to,summary:{...summary,gross:Number(summary.gross),completed:Number(summary.completed)},byGame:byGame.map(row=>({...row,revenue:Number(row.revenue)})),byPackage:byPackage.map(row=>({...row,revenue:Number(row.revenue)}))});
  } catch(error){ next(error); }
});
