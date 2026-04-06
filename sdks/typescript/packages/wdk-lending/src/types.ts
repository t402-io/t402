/**
 * DeFi Lending Protocol Types
 *
 * Protocol-agnostic abstractions for lending operations.
 * Implementations can target Aave V3, Compound, or other protocols.
 */

/** Supported lending operations */
export type LendingOperation = "supply" | "withdraw" | "borrow" | "repay";

/** Quote for a lending operation (read-only, no tx) */
export interface LendingQuote {
  protocol: string;
  chain: string;
  operation: LendingOperation;
  token: string;
  amount: string;
  fee: string;
  apy?: string;
  healthFactor?: string;
}

/** Result of a lending operation */
export interface LendingResult {
  success: boolean;
  protocol: string;
  hash: string;
  operation: LendingOperation;
  token: string;
  amount: string;
  fee: string;
}

/** User's lending position */
export interface LendingPosition {
  protocol: string;
  chain: string;
  supplied: TokenPosition[];
  borrowed: TokenPosition[];
  healthFactor: string;
  netApy: string;
}

export interface TokenPosition {
  token: string;
  symbol: string;
  amount: string;
  valueUsd: string;
  apy: string;
}

/** Configuration for a lending protocol */
export interface LendingConfig {
  /** Protocol name (e.g., "aave-v3") */
  protocol: string;
  /** Chain identifier */
  chain: string;
  /** RPC URL */
  rpcUrl: string;
  /** Protocol-specific configuration */
  protocolConfig?: Record<string, unknown>;
  /** Referral code for protocol revenue sharing (e.g., Aave referral program) */
  referralCode?: number;
}

/**
 * Lending protocol interface — implement for each DeFi protocol.
 */
export interface LendingProtocol {
  readonly name: string;

  /** Quote a supply operation */
  quoteSupply(token: string, amount: string): Promise<LendingQuote>;

  /** Execute supply */
  supply(token: string, amount: string): Promise<LendingResult>;

  /** Quote a withdrawal */
  quoteWithdraw(token: string, amount: string): Promise<LendingQuote>;

  /** Execute withdrawal */
  withdraw(token: string, amount: string): Promise<LendingResult>;

  /** Quote a borrow */
  quoteBorrow(token: string, amount: string): Promise<LendingQuote>;

  /** Execute borrow */
  borrow(token: string, amount: string): Promise<LendingResult>;

  /** Quote a repayment */
  quoteRepay(token: string, amount: string): Promise<LendingQuote>;

  /** Execute repay */
  repay(token: string, amount: string): Promise<LendingResult>;

  /** Get user's current lending position */
  getPosition(address: string): Promise<LendingPosition>;
}
