export function dbContext(pool) {
  return async (req, _res, next) => {
    req.db = pool;
    next();
  };
}

export function validateJson(req, res, next) {
  if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.is('application/json') && !req.body) return res.status(400).json({ error: 'Body không hợp lệ' });
  next();
}
