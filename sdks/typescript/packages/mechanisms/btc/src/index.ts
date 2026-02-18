/**
 * @module @t402/btc - t402 Payment Protocol Bitcoin & Lightning Network Implementation
 *
 * This module provides the Bitcoin-specific implementation of the t402 payment protocol.
 * Supports on-chain BTC payments (via PSBT) and Lightning Network payments (via BOLT11).
 *
 * Schemes:
 * - exact (on-chain): PSBT-based Bitcoin payments
 * - exact (lightning): BOLT11 invoice-based Lightning payments
 */

// Export BTC exact scheme (client)
export { ExactBtcScheme } from './exact/index.js'

// Export Lightning scheme (client)
export { LightningScheme } from './lightning/index.js'

// Export register functions for easy integration
export { registerExactBtcScheme as registerExactBtcClientScheme } from './exact/client/index.js'
export type { BtcClientConfig } from './exact/client/index.js'
export { registerExactBtcScheme as registerExactBtcServerScheme } from './exact/server/index.js'
export type { BtcResourceServerConfig } from './exact/server/index.js'
export { registerExactBtcScheme as registerExactBtcFacilitatorScheme } from './exact/facilitator/index.js'
export type { BtcFacilitatorConfig } from './exact/facilitator/index.js'

export { registerLightningScheme as registerLightningClientScheme } from './lightning/client/index.js'
export type { LightningClientConfig } from './lightning/client/index.js'
export { registerLightningScheme as registerLightningServerScheme } from './lightning/server/index.js'
export type { LightningResourceServerConfig } from './lightning/server/index.js'
export { registerLightningScheme as registerLightningFacilitatorScheme } from './lightning/facilitator/index.js'
export type { LightningFacilitatorConfig } from './lightning/facilitator/index.js'

// Export signer interfaces
export type { ClientBtcSigner, ClientLightningSigner } from './signer.js'

// Export facilitator signer interfaces
export type { FacilitatorBtcSigner } from './exact/facilitator/scheme.js'
export type { FacilitatorLightningSigner } from './lightning/facilitator/scheme.js'

// Export payload types
export type { BtcOnchainPayload, LightningPayload } from './types.js'

// Export constants
export {
  BTC_MAINNET,
  BTC_TESTNET,
  LIGHTNING_MAINNET,
  LIGHTNING_TESTNET,
  BTC_NETWORKS,
  LIGHTNING_NETWORKS,
  ALL_NETWORKS,
  DUST_LIMIT,
  MIN_RELAY_FEE,
  SATS_PER_BTC,
  SCHEME_EXACT,
  DEFAULT_VALIDITY_DURATION,
  MAINNET_ADDRESS_PREFIXES,
  TESTNET_ADDRESS_PREFIXES,
} from './constants.js'

export type { BtcNetwork, LightningNetwork } from './constants.js'

// Export utility functions
export {
  satoshisToBtc,
  btcToSatoshis,
  validateBitcoinAddress,
  isMainnetAddress,
  isTestnetAddress,
  validateBolt11Invoice,
  isValidHex,
} from './utils.js'

// Export server scheme types
export type { ExactBtcSchemeConfig } from './exact/server/scheme.js'
export type { LightningSchemeConfig, InvoiceGenerator } from './lightning/server/scheme.js'
