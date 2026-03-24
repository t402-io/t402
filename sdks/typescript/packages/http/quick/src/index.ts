/**
 * @t402/quick — Zero-config T402 payment middleware
 *
 * Accept USDT payments in 3 lines of code:
 *
 * ```typescript
 * import { t402 } from "@t402/quick/express";
 * app.use("/api/premium", t402({ price: "1.00" }));
 * ```
 *
 * @module @t402/quick
 */

export type { QuickConfig, ResolvedQuickConfig } from "./config";
export { resolveQuickConfig, DEFAULT_NETWORK, DEFAULT_FACILITATOR_URL } from "./config";
