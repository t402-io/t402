/**
 * CORS headers and OPTIONS preflight handling.
 */
export function corsMiddleware(req, res, next) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Request-Id, X-Sandbox-Session");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}
