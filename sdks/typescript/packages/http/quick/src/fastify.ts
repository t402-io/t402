/**
 * @t402/quick/fastify — Fastify middleware in 3 lines
 *
 * ```typescript
 * import { t402 } from "@t402/quick/fastify";
 *
 * fastify.register(t402({
 *   price: "1.00",
 *   payTo: "0xYourWalletAddress",
 * }));
 * ```
 */

import type { QuickConfig } from "./config";
import { resolveQuickConfig, toRoutesConfig, createFacilitatorClient } from "./config";
import { paymentMiddlewareFromConfig } from "@t402/fastify";

/**
 * Creates a Fastify payment plugin from a simplified config.
 *
 * @param config - Simplified payment configuration
 * @returns Fastify plugin that gates routes behind USDT payment
 */
export function t402(config: QuickConfig) {
  const resolved = resolveQuickConfig(config);
  const routes = toRoutesConfig(resolved);
  const facilitator = createFacilitatorClient(resolved.facilitator);

  return paymentMiddlewareFromConfig(routes, facilitator);
}

export type { QuickConfig } from "./config";
export { resolveQuickConfig, DEFAULT_NETWORK, DEFAULT_FACILITATOR_URL } from "./config";
