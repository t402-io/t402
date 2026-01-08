/**
 * @module @t402/paywall - t402 Payment Protocol Paywall Extension
 * This module provides paywall functionality for the t402 payment protocol.
 */

export { createPaywall, PaywallBuilder } from "./builder";
export type {
  PaywallProvider,
  PaywallConfig,
  PaymentRequired,
  PaywallNetworkHandler,
  PaymentRequirements,
} from "./types";

// Re-export network handlers for convenience
export { evmPaywall } from "./evm";
export { svmPaywall } from "./svm";
