/**
 * Configuration constants derived from environment variables.
 */
import { log } from "./logger.js";

export const PORT = parseInt(process.env.PORT || "3406");
export const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:8080";
export const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "100");
export const RATE_LIMIT_MAX_ENTRIES = 10_000;
export const VERIFY_TIMEOUT_MS = 30_000;
export const SETTLE_TIMEOUT_MS = 90_000;
export const TRUST_CF_HEADER = process.env.TRUST_CF_HEADER === "true";
export const FACILITATOR_API_KEY = process.env.FACILITATOR_API_KEY || "";

// Validate FACILITATOR_URL at startup
try {
  const parsed = new URL(FACILITATOR_URL);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Invalid protocol: ${parsed.protocol}`);
  }
} catch (err) {
  log("error", "Invalid FACILITATOR_URL", { url: FACILITATOR_URL, error: err.message });
  process.exit(1);
}
