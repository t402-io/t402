/**
 * WDK TON Wallet Types
 *
 * Type definitions for server-side TON wallet management.
 */

/**
 * Configuration for T402TonWallet
 */
export interface T402TonWalletConfig {
  /** TON API endpoint (default: mainnet) */
  endpoint?: string
  /** Wallet version to use */
  walletVersion?: 'v5r1' | 'v4r2'
  /** Storage adapter for wallet state */
  storage?: TonStorageAdapter
  /** Network type */
  network?: 'mainnet' | 'testnet'
  /** API key for TON Center */
  apiKey?: string
}

/**
 * Storage adapter interface for wallet persistence
 */
export interface TonStorageAdapter {
  /** Get a value by key */
  get(key: string): Promise<string | null>
  /** Set a value by key */
  set(key: string, value: string): Promise<void>
  /** Delete a value by key */
  delete(key: string): Promise<void>
}

/**
 * Wallet information
 */
export interface T402TonWalletInfo {
  /** Wallet address (friendly format) */
  address: string
  /** TON balance in nanoTON */
  balance: bigint
  /** Whether the wallet contract is deployed on-chain */
  isDeployed: boolean
  /** Wallet version */
  walletVersion: 'v5r1' | 'v4r2'
}

/**
 * Parameters for sending a transaction
 */
export interface TonSendTransactionParams {
  /** Destination address */
  to: string
  /** Amount in nanoTON */
  value: bigint
  /** Message body (BOC base64) */
  body?: string
  /** Whether to bounce on failure */
  bounce?: boolean
}

/**
 * Parameters for transferring Jettons
 */
export interface TonTransferJettonParams {
  /** Jetton master contract address */
  jettonMaster: string
  /** Recipient address */
  to: string
  /** Amount in Jetton units */
  amount: bigint
  /** Optional forward payload (BOC base64) */
  forwardPayload?: string
}
