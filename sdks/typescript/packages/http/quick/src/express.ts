/**
 * @t402/quick/express — Express middleware in 3 lines
 *
 * ```typescript
 * import { t402 } from "@t402/quick/express";
 *
 * app.use("/api/premium", t402({
 *   price: "1.00",
 *   payTo: "0xYourWalletAddress",
 * }));
 * ```
 *
 * That's it. Requests to /api/premium will return 402 Payment Required
 * until the client provides a valid USDT payment signature.
 */

import type { QuickConfig } from "./config";
import { resolveQuickConfig, toRoutesConfig, createFacilitatorClient } from "./config";
import { paymentMiddlewareFromConfig } from "@t402/express";

/**
 * Creates an Express payment middleware from a simplified config.
 *
 * @param config - Simplified payment configuration
 * @returns Express middleware that gates the route behind USDT payment
 *
 * @example
 * ```typescript
 * import express from "express";
 * import { t402 } from "@t402/quick/express";
 *
 * const app = express();
 *
 * // Protect a route — clients must pay 1 USDT to access
 * app.use("/api/premium", t402({
 *   price: "1.00",
 *   payTo: "0xYourWalletAddress",
 * }));
 *
 * app.get("/api/premium", (req, res) => {
 *   res.json({ data: "premium content" });
 * });
 *
 * app.listen(3000);
 * ```
 */
export function t402(config: QuickConfig) {
  const resolved = resolveQuickConfig(config);
  const routes = toRoutesConfig(resolved);
  const facilitator = createFacilitatorClient(resolved.facilitator);

  return paymentMiddlewareFromConfig(routes, facilitator);
}

export type { QuickConfig } from "./config";
export { resolveQuickConfig, DEFAULT_NETWORK, DEFAULT_FACILITATOR_URL } from "./config";
