/**
 * Type definitions for T402 WDK integration
 */

import type { Address } from 'viem'

/**
 * EVM chain configuration
 */
export interface EvmChainConfig {
  /** RPC endpoint URL */
  provider: string
  /** Chain ID */
  chainId: number
  /** CAIP-2 network identifier */
  network: string
}

/**
 * T402 WDK configuration options
 */
export interface T402WDKConfig {
  /** Ethereum mainnet configuration */
  ethereum?: EvmChainConfig | string
  /** Arbitrum One configuration */
  arbitrum?: EvmChainConfig | string
  /** Base mainnet configuration */
  base?: EvmChainConfig | string
  /** Ink mainnet configuration */
  ink?: EvmChainConfig | string
  /** Berachain mainnet configuration */
  berachain?: EvmChainConfig | string
  /** Unichain mainnet configuration */
  unichain?: EvmChainConfig | string
  /** Polygon mainnet configuration */
  polygon?: EvmChainConfig | string
  /** Custom chains */
  [key: string]: EvmChainConfig | string | undefined
}

/**
 * Normalized chain configuration
 */
export interface NormalizedChainConfig {
  provider: string
  chainId: number
  network: string
  name: string
}

/**
 * Token balance information
 */
export interface TokenBalance {
  /** Token contract address */
  token: Address
  /** Token symbol */
  symbol: string
  /** Balance in smallest units */
  balance: bigint
  /** Formatted balance (human-readable) */
  formatted: string
  /** Decimals */
  decimals: number
}

/**
 * Chain balance information
 */
export interface ChainBalance {
  /** Chain name (e.g., "arbitrum") */
  chain: string
  /** CAIP-2 network identifier */
  network: string
  /** Native token balance */
  native: bigint
  /** Token balances */
  tokens: TokenBalance[]
}

/**
 * Aggregated balance across all chains
 */
export interface AggregatedBalance {
  /** Total USDT0 balance across all chains */
  totalUsdt0: bigint
  /** Total USDC balance across all chains */
  totalUsdc: bigint
  /** Per-chain balances */
  chains: ChainBalance[]
}

/**
 * Bridge parameters for cross-chain transfers
 */
export interface BridgeParams {
  /** Source chain name */
  fromChain: string
  /** Destination chain name */
  toChain: string
  /** Amount to bridge in smallest units */
  amount: bigint
  /** Recipient address (optional, defaults to same wallet on target chain) */
  recipient?: Address
}

/**
 * Bridge result
 */
export interface BridgeResult {
  /** Transaction hash on source chain */
  txHash: string
  /** Estimated time for bridge completion in seconds */
  estimatedTime: number
}

/**
 * EIP-712 typed data domain
 */
export interface TypedDataDomain {
  name: string
  version: string
  chainId: number
  verifyingContract: Address
}

/**
 * EIP-712 typed data types
 */
export type TypedDataTypes = Record<string, Array<{ name: string; type: string }>>

/**
 * T402 Signer interface for WDK
 * Compatible with @t402/core signer requirements
 */
export interface T402WDKSigner {
  /** Get wallet address */
  readonly address: Address

  /** Sign EIP-712 typed data */
  signTypedData(params: {
    domain: TypedDataDomain
    types: TypedDataTypes
    primaryType: string
    message: Record<string, unknown>
  }): Promise<`0x${string}`>

  /** Sign a message */
  signMessage?(message: string | Uint8Array): Promise<`0x${string}`>

  /** Get token balance */
  getTokenBalance?(tokenAddress: Address): Promise<bigint>
}

/**
 * WDK Account interface (matches @tetherto/wdk account structure)
 *
 * This is the canonical definition used across all @t402/wdk-* packages.
 * Implementors (Tether WDK) provide these methods; T402 code consumes them.
 */
export interface WDKAccount {
  /** Get the account's address */
  getAddress(): Promise<string>
  /** Get the account's native balance */
  getBalance(): Promise<bigint>
  /** Get the account's token balance */
  getTokenBalance(tokenAddress: string): Promise<bigint>
  /** Sign a message */
  signMessage(message: string): Promise<string>
  /** Sign typed data (EIP-712) */
  signTypedData(params: {
    domain: Record<string, unknown>
    types: Record<string, unknown>
    primaryType: string
    message: Record<string, unknown>
  }): Promise<string>
  /** Send a transaction */
  sendTransaction(params: { to: string; value?: bigint; data?: string }): Promise<string>
  /** Estimate gas for a transaction (optional — not all implementations support this) */
  estimateGas?(params: { to: string; value?: bigint; data?: string }): Promise<bigint>
}

/**
 * Alias for WDKAccount — preferred naming for use in @t402/wdk-* packages.
 */
export type WdkAccount = WDKAccount

/**
 * WDK instance interface (matches @tetherto/wdk structure)
 */
export interface WDKInstance {
  registerWallet<T>(name: string, manager: T, config: Record<string, unknown>): WDKInstance
  registerProtocol<T>(name: string, protocol: T): WDKInstance
  getAccount(chain: string, index: number): Promise<WDKAccount>
  executeProtocol(name: string, params: Record<string, unknown>): Promise<{ txHash: string }>
}

/**
 * WDK constructor type
 */
export interface WDKConstructor {
  new (seedPhrase: string): WDKInstance
  getRandomSeedPhrase(): string
}

/**
 * Balance cache configuration for T402WDK
 */
export interface T402BalanceCacheConfig {
  /** Whether caching is enabled (default: true) */
  enabled?: boolean
  /** TTL for native balance in milliseconds (default: 15000 = 15 seconds) */
  nativeBalanceTTL?: number
  /** TTL for token balance in milliseconds (default: 30000 = 30 seconds) */
  tokenBalanceTTL?: number
  /** TTL for aggregated balances in milliseconds (default: 60000 = 60 seconds) */
  aggregatedBalanceTTL?: number
  /** Maximum cache entries (default: 500) */
  maxSize?: number
}

/**
 * Extended T402 WDK configuration with cache options
 */
export interface T402WDKOptions {
  /** Balance cache configuration */
  cache?: T402BalanceCacheConfig
}

// ============================================================
// Multi-Chain Support Types
// ============================================================

/**
 * Supported blockchain families
 */
export type ChainFamily = 'evm' | 'svm' | 'ton' | 'tron'

/**
 * Solana chain configuration
 */
export interface SvmChainConfig {
  /** RPC endpoint URL */
  rpcUrl: string
  /** Commitment level */
  commitment?: 'processed' | 'confirmed' | 'finalized'
  /** Network type */
  network?: 'mainnet' | 'testnet' | 'devnet'
}

/**
 * TON chain configuration
 */
export interface TonChainConfig {
  /** API endpoint URL */
  endpoint: string
  /** Network type */
  network?: 'mainnet' | 'testnet'
  /** API key for TON Center */
  apiKey?: string
}

/**
 * TRON chain configuration
 */
export interface TronChainConfig {
  /** Full host URL (e.g., https://api.trongrid.io) */
  fullHost: string
  /** Network type */
  network?: 'mainnet' | 'shasta' | 'nile'
  /** API key for TronGrid */
  apiKey?: string
}

/**
 * Multi-chain configuration
 */
export interface MultiChainConfig {
  /** EVM chains configuration */
  evm?: Record<string, EvmChainConfig | string>
  /** Solana configuration */
  svm?: SvmChainConfig
  /** TON configuration */
  ton?: TonChainConfig
  /** TRON configuration */
  tron?: TronChainConfig
}

/**
 * WDK wallet modules registry
 * All modules are optional - only register what you need
 */
export interface WDKWalletModules {
  /** EVM wallet manager (@tetherto/wdk-wallet-evm) */
  evm?: unknown
  /** EVM ERC-4337 wallet manager (@tetherto/wdk-wallet-evm-erc4337) */
  evmErc4337?: unknown
  /** Solana wallet manager (@tetherto/wdk-wallet-solana) */
  solana?: unknown
  /** TON wallet manager (@tetherto/wdk-wallet-ton) */
  ton?: unknown
  /** TON gasless wallet manager (@tetherto/wdk-wallet-ton-gasless) */
  tonGasless?: unknown
  /** TRON wallet manager (@tetherto/wdk-wallet-tron) */
  tron?: unknown
  /** Bitcoin wallet manager (@tetherto/wdk-wallet-btc) */
  btc?: unknown
}

/**
 * WDK protocol modules registry
 * All modules are optional - only register what you need
 */
export interface WDKProtocolModules {
  /** USDT0 bridge for EVM (@tetherto/wdk-protocol-bridge-usdt0-evm) */
  bridgeUsdt0Evm?: unknown
  /** USDT0 bridge for TON (@tetherto/wdk-protocol-bridge-usdt0-ton) */
  bridgeUsdt0Ton?: unknown
  /** Velora swap for EVM (@tetherto/wdk-protocol-swap-velora-evm) */
  swapVeloraEvm?: unknown
  /** Aave lending for EVM (@tetherto/wdk-protocol-lending-aave-evm) */
  lendingAaveEvm?: unknown
}

/**
 * Unified WDK modules registration
 */
export interface WDKModulesConfig {
  /** Wallet modules */
  wallets?: WDKWalletModules
  /** Protocol modules */
  protocols?: WDKProtocolModules
}

/**
 * WDK TON account interface (compatible with @tetherto/wdk-wallet-ton)
 */
export interface WDKTonAccount {
  /** Get wallet address */
  getAddress(): Promise<string>
  /** Get TON balance */
  getBalance(): Promise<bigint>
  /** Get Jetton balance */
  getJettonBalance(jettonMaster: string): Promise<bigint>
  /** Sign a message */
  signMessage(message: Uint8Array): Promise<Uint8Array>
  /** Send TON transaction */
  sendTransaction(params: {
    to: string
    value: bigint
    body?: string // BOC base64
    bounce?: boolean
  }): Promise<string>
  /** Get current sequence number */
  getSeqno(): Promise<number>
  /** Transfer Jettons */
  transferJetton?(params: {
    jettonMaster: string
    to: string
    amount: bigint
    forwardPayload?: string
  }): Promise<string>
}

/**
 * WDK Solana account interface (compatible with @tetherto/wdk-wallet-solana)
 */
export interface WDKSolanaAccount {
  /** Get wallet address (base58) */
  getAddress(): Promise<string>
  /** Get SOL balance */
  getBalance(): Promise<bigint>
  /** Get SPL token balance */
  getTokenBalance(mint: string): Promise<bigint>
  /** Sign a message */
  sign(message: Uint8Array): Promise<Uint8Array>
  /** Sign a transaction */
  signTransaction(transaction: Uint8Array): Promise<Uint8Array>
  /** Send SOL */
  sendTransaction(params: { recipient: string; value: bigint }): Promise<string>
  /** Transfer SPL token */
  transfer(params: { token: string; recipient: string; amount: bigint }): Promise<string>
}

/**
 * WDK TRON account interface (compatible with @tetherto/wdk-wallet-tron)
 */
export interface WDKTronAccount {
  /** Get wallet address (base58) */
  getAddress(): Promise<string>
  /** Get TRX balance */
  getBalance(): Promise<bigint>
  /** Get TRC20 token balance */
  getTrc20Balance(contractAddress: string): Promise<bigint>
  /** Sign a transaction */
  signTransaction(transaction: unknown): Promise<unknown>
  /** Send signed transaction */
  sendTransaction(signedTx: unknown): Promise<string>
  /** Transfer TRC20 token */
  transferTrc20?(params: { contractAddress: string; to: string; amount: bigint }): Promise<string>
}

/**
 * Extended WDK instance interface with multi-chain support
 */
export interface WDKInstanceMultiChain extends WDKInstance {
  /** Get TON account */
  getTonAccount?(index: number): Promise<WDKTonAccount>
  /** Get Solana account */
  getSolanaAccount?(index: number): Promise<WDKSolanaAccount>
  /** Get TRON account */
  getTronAccount?(index: number): Promise<WDKTronAccount>
}

// ============================================================
// Factory Method Types
// ============================================================

/**
 * Configuration for T402WDK.create() factory method
 */
export interface T402WDKCreateConfig {
  /** BIP-39 mnemonic seed phrase */
  seedPhrase: string
  /** Chain name → RPC URL mapping for EVM chains */
  chains: Record<string, string>
  /** WDK modules to register */
  modules: WDKModulesConfig
  /** Additional options */
  options?: T402WDKOptions
}

/**
 * A signer entry for use with T402 HTTP clients
 */
export interface SignerEntry {
  /** Payment scheme (e.g., "exact") */
  scheme: string
  /** CAIP-2 network identifier (e.g., "eip155:42161") */
  network: string
  /** The signer instance */
  signer: unknown
  /** Chain family (evm, ton, svm, tron) */
  family: ChainFamily
}

/**
 * Options for getAllSigners()
 */
export interface GetAllSignersOptions {
  /** HD wallet account index (default: 0) */
  accountIndex?: number
  /** Filter by payment schemes (default: ["exact"]) */
  schemes?: string[]
  /** Include non-EVM chain signers (default: true) */
  includeNonEvm?: boolean
}

/**
 * Options for T402WDK.fromWDK()
 */
export interface FromWDKOptions {
  /** HD wallet account index for auto-discovery (default: 0) */
  defaultAccountIndex?: number
}

/**
 * Swap quote result
 */
export interface SwapQuote {
  /** Input token address */
  inputToken: string
  /** Output token address */
  outputToken: string
  /** Input amount in smallest units */
  inputAmount: bigint
  /** Expected output amount in smallest units */
  outputAmount: bigint
  /** Price impact percentage */
  priceImpact: number
  /** Swap route (token addresses) */
  route: string[]
}

/**
 * Swap execution result
 */
export interface SwapResult {
  /** Transaction hash */
  txHash: string
  /** Actual input amount */
  inputAmount: bigint
  /** Actual output amount */
  outputAmount: bigint
}

/**
 * Parameters for swap operations
 */
export interface SwapParams {
  /** Chain name (e.g., "ethereum", "arbitrum") */
  chain: string
  /** Input token address */
  fromToken: string
  /** Amount to swap in smallest units */
  amount: bigint
  /** Maximum slippage tolerance (0-1, default: 0.005 = 0.5%) */
  maxSlippage?: number
}
