import { randomUUID } from 'node:crypto';

export function requestLogging(req, res, next) {
  const started = Date.now();
  req.requestId = req.get('X-Request-Id') || randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.on('finish', () => console.log(JSON.stringify({ request_id: req.requestId, method: req.method, path: req.path, status: res.statusCode, duration_ms: Date.now() - started, user_id: req.user?.id || null })));
  next();
}
