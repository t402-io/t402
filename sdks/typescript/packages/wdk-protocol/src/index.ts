/**
 * @module @t402/wdk-protocol
 *
 * T402 payment protocol for Tether WDK wallet apps.
 *
 * Enables any WDK-based wallet to handle HTTP 402 payments:
 *
 * @example
 * ```typescript
 * import { T402Protocol } from '@t402/wdk-protocol';
 * import { T402WDK } from '@t402/wdk';
 *
 * const wdk = new T402WDK(seedPhrase, { arbitrum: rpcUrl });
 * const t402 = await T402Protocol.create(wdk, {
 *   chains: ['ethereum', 'arbitrum'],
 * });
 *
 * // Auto-pay for 402 resources
 * const { response, receipt } = await t402.fetch('https://api.example.com/premium');
 * ```
 */

// Main class
export { T402Protocol } from './protocol.js'

// Chain detection utilities
export {
  detectChainFamily,
  isEvmNetwork,
  getEvmChainName,
  EVM_CHAIN_MAP,
  type ChainFamily,
} from './signer-factory.js'

// HTTP client utilities
export { extractPaymentRequired } from './http-client.js'

// Types
export type { T402ProtocolConfig, PaymentReceipt, T402FetchResult } from './types.js'
