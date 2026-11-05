export function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
