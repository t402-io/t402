/**
 * @t402/wdk-ton
 *
 * Server-side TON wallet management with @ton/walletkit for T402.
 *
 * This package provides a high-level wallet API for TON operations:
 *
 * 1. Mnemonic-based wallet creation (v5r1 / v4r2)
 * 2. Balance queries (TON and Jettons)
 * 3. Transaction signing and sending
 * 4. Jetton transfers (USDT0, etc.)
 *
 * @example Basic usage
 * ```typescript
 * import { createT402TonWallet } from '@t402/wdk-ton';
 *
 * const wallet = await createT402TonWallet('word1 word2 ... word24', {
 *   walletVersion: 'v5r1',
 * });
 *
 * // Get wallet info
 * const info = await wallet.getInfo();
 * console.log('Address:', info.address);
 * console.log('Balance:', info.balance);
 *
 * // Transfer USDT0
 * const txHash = await wallet.transferJetton({
 *   jettonMaster: TON_USDT0_JETTON_MASTER,
 *   to: 'UQ...',
 *   amount: 1000000n, // 1 USDT0 (6 decimals)
 * });
 * ```
 *
 * @packageDocumentation
 */

// Main wallet class
export { T402TonWallet, createT402TonWallet } from './wallet.js'

// Storage adapters
export { InMemoryStorage, FileSystemStorage } from './storage.js'

// Types
export type {
  T402TonWalletConfig,
  T402TonWalletInfo,
  TonStorageAdapter,
  TonSendTransactionParams,
  TonTransferJettonParams,
} from './types.js'

// Constants
export {
  TON_USDT0_JETTON_MASTER,
  TON_USDT_JETTON_MASTER,
  TON_MAINNET_ENDPOINT,
  TON_TESTNET_ENDPOINT,
  TON_MAINNET_NETWORK,
  TON_TESTNET_NETWORK,
  TON_JETTON_DECIMALS,
  getDefaultEndpoint,
} from './constants.js'
