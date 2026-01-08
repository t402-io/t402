/**
 * @module @t402/wdk - T402 integration with Tether Wallet Development Kit
 *
 * This package provides seamless integration between T402 payment protocol
 * and Tether's WDK (Wallet Development Kit), enabling:
 *
 * - Multi-chain self-custodial wallets
 * - USDT0 and USDC payments with EIP-3009 support
 * - Cross-chain bridging via LayerZero
 * - T402-compatible signers for payment authorization
 *
 * @example Basic Usage
 * ```typescript
 * import WDK from '@tetherto/wdk';
 * import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
 * import { T402WDK } from '@t402/wdk';
 * import { createT402HTTPClient } from '@t402/core';
 *
 * // Register WDK modules (once at app startup)
 * T402WDK.registerWDK(WDK, WalletManagerEvm);
 *
 * // Create wallet from seed phrase
 * const seedPhrase = T402WDK.generateSeedPhrase();
 * const wallet = new T402WDK(seedPhrase, {
 *   arbitrum: 'https://arb1.arbitrum.io/rpc',
 *   base: 'https://mainnet.base.org'
 * });
 *
 * // Get signer for T402 payments
 * const signer = await wallet.getSigner('arbitrum');
 *
 * // Use with T402 HTTP client
 * const client = createT402HTTPClient({
 *   signers: [{ scheme: 'exact', signer }]
 * });
 *
 * // Make a paid request
 * const response = await client.fetch('https://api.example.com/premium');
 * ```
 *
 * @example Balance Checking
 * ```typescript
 * // Check USDT0 balance on Arbitrum
 * const balance = await wallet.getUsdt0Balance('arbitrum');
 * console.log(`USDT0 balance: ${balance}`);
 *
 * // Get aggregated balances across all chains
 * const allBalances = await wallet.getAggregatedBalances();
 * console.log(`Total USDT0: ${allBalances.totalUsdt0}`);
 *
 * // Find best chain for payment
 * const best = await wallet.findBestChainForPayment(1000000n); // 1 USDT0
 * if (best) {
 *   console.log(`Use ${best.token} on ${best.chain}`);
 * }
 * ```
 *
 * @example Cross-Chain Bridging
 * ```typescript
 * // Bridge USDT0 from Ethereum to Arbitrum
 * const result = await wallet.bridgeUsdt0({
 *   fromChain: 'ethereum',
 *   toChain: 'arbitrum',
 *   amount: 100000000n // 100 USDT0
 * });
 * console.log(`Bridge tx: ${result.txHash}`);
 * ```
 */

// Main class
export { T402WDK } from "./t402wdk.js";

// Signer
export { WDKSigner, createWDKSigner, MockWDKSigner } from "./signer.js";

// Types
export type {
  T402WDKConfig,
  EvmChainConfig,
  NormalizedChainConfig,
  TokenBalance,
  ChainBalance,
  AggregatedBalance,
  BridgeParams,
  BridgeResult,
  TypedDataDomain,
  TypedDataTypes,
  T402WDKSigner,
  WDKAccount,
  WDKInstance,
  WDKConstructor,
} from "./types.js";

// Chain configuration
export {
  DEFAULT_CHAINS,
  DEFAULT_RPC_ENDPOINTS,
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  USDT_LEGACY_ADDRESSES,
  CHAIN_TOKENS,
  normalizeChainConfig,
  getNetworkFromChain,
  getChainFromNetwork,
  getChainId,
  getUsdt0Chains,
  getPreferredToken,
} from "./chains.js";
export type { TokenInfo } from "./chains.js";

// Bridge utilities
export { WdkBridge, createDirectBridge } from "./bridge.js";
export type { BridgeQuoteResult, BridgeQuote, BridgeSigner } from "./bridge.js";

// Re-export bridge utilities from @t402/evm for convenience
export {
  supportsBridging,
  getBridgeableChains,
  LAYERZERO_ENDPOINT_IDS,
  USDT0_OFT_ADDRESSES,
  Usdt0Bridge,
} from "@t402/evm";
