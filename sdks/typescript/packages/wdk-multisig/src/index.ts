/**
 * @t402/wdk-multisig
 *
 * Multi-sig Safe Smart Account support for Tether WDK.
 * Enables M-of-N threshold wallets with WDK-derived addresses as owners.
 *
 * @example Single Seed (3 accounts from one seed phrase)
 * ```typescript
 * import { createMultiSigFromSingleSeed } from '@t402/wdk-multisig';
 *
 * const client = await createMultiSigFromSingleSeed({
 *   seedPhrase: 'word1 word2 ... word24',
 *   accountIndices: [0, 1, 2],
 *   threshold: 2, // 2-of-3
 *   chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
 *   chain: 'arbitrum',
 *   bundler: { bundlerUrl: '...', chainId: 42161 },
 * });
 *
 * // All signers available locally - direct payment
 * const result = await client.payWithAllSigners(
 *   { to: '0xrecipient', amount: 1000000n },
 *   client.getSigners()
 * );
 *
 * const receipt = await result.wait();
 * console.log('Payment confirmed:', receipt.txHash);
 * ```
 *
 * @example Multiple Seeds (Multi-party)
 * ```typescript
 * import { createMultiSigFromMultipleSeeds } from '@t402/wdk-multisig';
 *
 * const client = await createMultiSigFromMultipleSeeds({
 *   seedPhrases: [partyASeed, partyBSeed, partyCSeed],
 *   threshold: 2, // 2-of-3
 *   chainConfig: { arbitrum: 'https://arb1.arbitrum.io/rpc' },
 *   chain: 'arbitrum',
 *   bundler: { bundlerUrl: '...', chainId: 42161 },
 * });
 *
 * // Initiate payment
 * const request = await client.initiatePayment({
 *   to: '0xrecipient',
 *   amount: 1000000n,
 * });
 *
 * // Party A signs
 * await request.addSignature(0, partyASigner);
 *
 * // Party B signs
 * await request.addSignature(1, partyBSigner);
 *
 * // Threshold met - submit
 * const result = await request.submit();
 * ```
 *
 * @packageDocumentation
 */

// Main classes
export { MultiSigWdkSmartAccount, createMultiSigWdkSmartAccount } from "./account.js";
export { MultiSigWdkGaslessClient } from "./client.js";
export { SignatureCollector } from "./collector.js";

// Factory functions
export {
  createMultiSigFromSingleSeed,
  createMultiSigFromMultipleSeeds,
  createMultiSigFromSigners,
} from "./factory.js";

// Types
export type {
  MultiSigWDKConfig,
  SingleSeedConfig,
  MultiSeedConfig,
  PendingSignature,
  MultiSigTransactionRequest,
  MultiSigPaymentResult,
  MultiSigSubmitResult,
  MultiSigGaslessClientConfig,
  MultiSigSmartAccountSigner,
  GaslessPaymentParams,
  BatchPaymentParams,
  GaslessPaymentReceipt,
} from "./types.js";

// Errors
export { MultiSigError, MultiSigErrorCode } from "./errors.js";

// Constants
export { SAFE_4337_ADDRESSES, SIGNATURE_TYPES, DEFAULTS, ENTRYPOINT_V07_ADDRESS } from "./constants.js";

// Utilities
export {
  combineSignatures,
  formatSignatureForSafe,
  generateRequestId,
  isValidThreshold,
  sortAddresses,
  getOwnerIndex,
  areAddressesUnique,
} from "./utils.js";
