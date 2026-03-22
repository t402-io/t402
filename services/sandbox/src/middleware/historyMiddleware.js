/**
 * Session-based request history recording middleware.
 */
import { requestHistory, MAX_HISTORY_PER_SESSION, MAX_SESSIONS } from "../lib/history.js";

export function historyMiddleware(req, res, next) {
  const sessionId = req.headers["x-sandbox-session"];
  if (sessionId && typeof sessionId === "string" && sessionId.length <= 64) {
    const start = Date.now();

    // Capture response body
    const originalJson = res.json.bind(res);
    let responseBody;
    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    res.on("finish", () => {
      let session = requestHistory.get(sessionId);
      if (!session) {
        // Enforce max sessions
        if (requestHistory.size >= MAX_SESSIONS) {
          // Evict oldest session
          const oldest = requestHistory.keys().next().value;
          requestHistory.delete(oldest);
        }
        session = { entries: [], lastAccess: Date.now() };
        requestHistory.set(sessionId, session);
      }
      session.lastAccess = Date.now();

      const entry = {
        id: req.requestId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Date.now() - start,
        requestBody: req.method === "POST" ? req.body : undefined,
        responseBody: responseBody,
        headers: {
          "x-request-id": req.requestId,
          "x-ratelimit-remaining": res.getHeader("x-ratelimit-remaining"),
        },
      };

      session.entries.push(entry);
      // Trim to max
      if (session.entries.length > MAX_HISTORY_PER_SESSION) {
        session.entries.shift();
      }
    });
  }
  next();
}
