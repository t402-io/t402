/**
 * Types for the Jupiter DEX swap module.
 */

/** Swap mode */
export type SwapMode = "ExactIn" | "ExactOut";

/** Jupiter quote request */
export interface QuoteRequest {
  /** Input token mint address */
  inputMint: string;
  /** Output token mint address */
  outputMint: string;
  /** Amount in smallest unit (lamports/token units) */
  amount: string;
  /** Swap mode */
  swapMode?: SwapMode;
  /** Slippage tolerance in basis points (default: 50 = 0.5%) */
  slippageBps?: number;
  /** Max fee in lamports (optional cap) */
  maxFee?: string;
}

/** Jupiter quote response */
export interface QuoteResponse {
  /** Input amount */
  inputAmount: string;
  /** Output amount */
  outputAmount: string;
  /** Other amount threshold (minimum out for ExactIn, maximum in for ExactOut) */
  otherAmountThreshold: string;
  /** Swap mode used */
  swapMode: SwapMode;
  /** Slippage in basis points */
  slippageBps: number;
  /** Price impact percentage */
  priceImpactPct: string;
  /** Route plan */
  routePlan: RoutePlanStep[];
  /** Raw quote for swap execution */
  rawQuote: unknown;
}

/** A step in the swap route */
export interface RoutePlanStep {
  /** DEX/AMM used */
  ammKey: string;
  /** Label (e.g., "Raydium", "Orca") */
  label: string;
  /** Input mint */
  inputMint: string;
  /** Output mint */
  outputMint: string;
  /** Percentage of total amount */
  percent: number;
}

/** Swap result */
export interface SwapResult {
  /** Transaction signature */
  signature: string;
  /** Input amount actually used */
  inputAmount: string;
  /** Output amount received */
  outputAmount: string;
  /** Fee paid in lamports */
  fee: string;
}

/** Jupiter API configuration */
export interface JupiterConfig {
  /** Jupiter API base URL (default: https://lite-api.jup.ag/v6) */
  apiUrl?: string;
  /** API key for pro tier (optional) */
  apiKey?: string;
  /** Default slippage in basis points (default: 50) */
  defaultSlippageBps?: number;
}

/** Solana wallet interface for executing swaps */
export interface SolanaWallet {
  /** Wallet public key (base58) */
  address: string;
  /** Sign and send a transaction */
  signAndSendTransaction(serializedTransaction: Uint8Array): Promise<string>;
}

/** Well-known Solana token mints */
export const TOKEN_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
} as const;
