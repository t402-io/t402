/**
 * GET / landing page route.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const landingHtml = readFileSync(join(__dirname, "..", "landing.html"), "utf8");

export function registerPageRoutes(app) {
  app.get("/", (_req, res) => {
    res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
    res.type("html").send(landingHtml);
  });
}
