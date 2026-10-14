export function notFound(_req, res) {
  res.status(404).json({ error: 'Không tìm thấy đường dẫn' });
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (res.headersSent) return;
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request quá lớn' });
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  res.status(status).json({ error: status === 500 ? 'Lỗi máy chủ' : error.message, ...(error.details ? { details: error.details } : {}) });
}
