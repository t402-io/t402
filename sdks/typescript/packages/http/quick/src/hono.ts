/**
 * @t402/quick/hono — Hono middleware in 3 lines
 *
 * ```typescript
 * import { t402 } from "@t402/quick/hono";
 *
 * app.use("/api/premium", t402({
 *   price: "1.00",
 *   payTo: "0xYourWalletAddress",
 * }));
 * ```
 */

import type { QuickConfig } from "./config";
import { resolveQuickConfig, toRoutesConfig, createFacilitatorClient } from "./config";
import { paymentMiddlewareFromConfig } from "@t402/hono";

/**
 * Creates a Hono payment middleware from a simplified config.
 *
 * @param config - Simplified payment configuration
 * @returns Hono middleware that gates routes behind USDT payment
 */
export function t402(config: QuickConfig) {
  const resolved = resolveQuickConfig(config);
  const routes = toRoutesConfig(resolved);
  const facilitator = createFacilitatorClient(resolved.facilitator);

  return paymentMiddlewareFromConfig(routes, facilitator);
}

export type { QuickConfig } from "./config";
export { resolveQuickConfig, DEFAULT_NETWORK, DEFAULT_FACILITATOR_URL } from "./config";
