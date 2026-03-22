/**
 * POST Content-Type validation (415).
 */
export function contentTypeMiddleware(req, res, next) {
  if (req.method === "POST" && !req.is("application/json")) {
    return res.status(415).json({ error: "Content-Type must be application/json", sandbox: true });
  }
  next();
}
