/**
 * Developer routes: GET /playground, /openapi.yaml, /openapi.json, /history.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { incrementRequests } from "../lib/metrics.js";
import { requestHistory, MAX_HISTORY_PER_SESSION, SESSION_TTL_MS } from "../lib/history.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const playgroundHtml = readFileSync(join(__dirname, "..", "playground.html"), "utf8");
const openapiSpec = readFileSync(join(__dirname, "..", "openapi.yaml"), "utf8");

export function registerDeveloperRoutes(app) {
  // Playground page
  app.get("/playground", (_req, res) => {
    incrementRequests();
    res.set("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https://static.cloudflareinsights.com; img-src 'self' data:; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    res.type("html").send(playgroundHtml);
  });

  // OpenAPI spec
  app.get("/openapi.yaml", (_req, res) => {
    res.type("text/yaml").send(openapiSpec);
  });

  app.get("/openapi.json", (_req, res) => {
    res.redirect("/openapi.yaml");
  });

  // Request history viewer
  app.get("/history", (req, res) => {
    const sessionId = req.headers["x-sandbox-session"] || req.query.session;
    if (!sessionId) {
      return res.status(400).json({
        error: "Provide X-Sandbox-Session header or ?session= query parameter",
        usage: "Include 'X-Sandbox-Session: <your-uuid>' header in all requests, then GET /history to see them",
        sandbox: true,
      });
    }
    const session = requestHistory.get(sessionId);
    if (!session) {
      return res.json({
        session: sessionId,
        entries: [],
        note: "No history found. Include 'X-Sandbox-Session: " + sessionId + "' header in your requests to start tracking.",
        sandbox: true,
      });
    }
    session.lastAccess = Date.now();
    res.json({
      session: sessionId,
      count: session.entries.length,
      maxEntries: MAX_HISTORY_PER_SESSION,
      ttlMinutes: Math.round(SESSION_TTL_MS / 60000),
      entries: session.entries,
      sandbox: true,
    });
  });
}
