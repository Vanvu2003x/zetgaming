import { Router } from 'express';
import { adminDocument, loginDocument } from './views.mjs';

const pages = new Set(['/', '/orders', '/games', '/categories', '/packages', '/ctvs']);
export function createAdminRouter(backend) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const json = async (req, res, path) => {
    const response = await backend(req, res, path);
    if (!response.ok) throw new Error(`Admin upstream ${response.status}`);
    return response.json();
  };
  router.get('/login', async (req, res, next) => {
    try {
      const data = await json(req, res, '/api/csrf');
      res.type('html').send(loginDocument(data.csrf_token, req.query.error));
    } catch (error) { next(error); }
  });
  router.post('/login', async (req, res, next) => {
    try {
      const response = await backend(req, res, '/api/auth/login', req.body);
      const data = await response.json();
      if (!response.ok) return res.redirect(303, '/login?error=' + encodeURIComponent(data.error || 'Đăng nhập không thành công.'));
      if (data.user?.role !== 'admin') return res.redirect(303, '/login?error=' + encodeURIComponent('Tài khoản này không có quyền quản trị.'));
      res.redirect(303, '/');
    } catch (error) { next(error); }
  });
  router.post('/logout', async (req, res, next) => {
    try {
      const response = await backend(req, res, '/api/auth/logout', req.body);
      if (!response.ok) return res.status(response.status).send('Không thể đăng xuất. Hãy tải lại trang và thử lại.');
      res.redirect(303, '/login');
    } catch (error) { next(error); }
  });
  router.use(async (req, res, next) => {
    try {
      if (req.path === '/admin') return res.redirect(303, '/');
      if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(404).send('Không tìm thấy trang.');
      if (!pages.has(req.path)) return res.status(404).send('Không tìm thấy trang.');
      const response = await backend(req, res, '/api/auth/me');
      if (response.status === 401) return res.redirect(303, '/login');
      if (!response.ok) throw new Error(`Admin auth ${response.status}`);
      const user = await response.json();
      if (user.role !== 'admin') return res.status(403).type('html').send(loginDocument('', 'Tài khoản này không có quyền quản trị.'));
      const csrf = await json(req, res, '/api/csrf');
      res.type('html').send(adminDocument(req.path, user, csrf.csrf_token));
    } catch (error) { next(error); }
  });
  return router;
}
