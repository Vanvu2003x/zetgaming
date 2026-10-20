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
    const result = await req.db.query('SELECT c.id,c.name,COUNT(g.id)::int game_count FROM game_categories c LEFT JOIN games g ON g.category_id=c.id GROUP BY c.id ORDER BY c.name');
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
