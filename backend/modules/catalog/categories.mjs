import { Router } from 'express';
import { z } from 'zod';
import { id } from '../../utils/ids.mjs';
import { parse } from '../../utils/validation.mjs';
import { audit } from '../../utils/audit.mjs';
import { requireRole } from '../../middleware/auth.mjs';
import { requireCsrf } from '../../middleware/csrf.mjs';

const schema = z.object({ name: z.string().trim().min(1).max(80) });
export const categoriesRouter = Router();
categoriesRouter.get('/admin/categories', requireRole('admin'), async (req, res, next) => {
  try {
    const result = await req.db.query(`SELECT c.id,c.name,COUNT(g.id)::int game_count,false AS system FROM game_categories c LEFT JOIN games g ON g.category_id=c.id GROUP BY c.id
      UNION ALL
      SELECT 'uncategorized' AS id,'Chưa phân loại' AS name,COUNT(*)::int AS game_count,true AS system FROM games WHERE category_id IS NULL HAVING COUNT(*) > 0
      ORDER BY system,name`);
    res.set('Cache-Control', 'no-store').json(result.rows);
  } catch (error) { next(error); }
});
const save = create => async (req, res, next) => {
  try {
    const { name } = parse(schema, req.body);
    const categoryId = create ? id() : req.params.id;
    const result = await req.db.query(create ? 'INSERT INTO game_categories(id,name) VALUES($1,$2) RETURNING id,name' : 'UPDATE game_categories SET name=$2 WHERE id=$1 RETURNING id,name', [categoryId, name]);
    if (!result.rowCount) return res.status(404).json({ error: 'Không tìm thấy phân loại' });
    await audit(req.db, req.user.id, create ? 'category.created' : 'category.updated', categoryId);
    res.status(create ? 201 : 200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Tên phân loại đã tồn tại.' });
    next(error);
  }
};
categoriesRouter.post('/admin/categories', requireCsrf, requireRole('admin'), save(true));
categoriesRouter.patch('/admin/categories/:id', requireCsrf, requireRole('admin'), save(false));
categoriesRouter.delete('/admin/categories/:id', requireCsrf, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await req.db.query(`DELETE FROM game_categories c WHERE c.id=$1 AND NOT EXISTS (SELECT 1 FROM games g WHERE g.category_id=c.id) RETURNING c.id,c.name`, [req.params.id]);
    if (!result.rowCount) {
      const current = (await req.db.query('SELECT c.name,COUNT(g.id)::int game_count FROM game_categories c LEFT JOIN games g ON g.category_id=c.id WHERE c.id=$1 GROUP BY c.id,c.name', [req.params.id])).rows[0];
      if (!current) return res.status(404).json({ error: 'Không tìm thấy phân loại' });
      return res.status(409).json({ error: `Không thể xóa “${current.name}” vì đang có ${current.game_count} game sử dụng. Hãy chuyển game sang loại khác trước.` });
    }
    await audit(req.db, req.user.id, 'category.deleted', result.rows[0].id, { name: result.rows[0].name });
    res.json({ deleted: result.rows[0] });
  } catch (error) { next(error); }
});
