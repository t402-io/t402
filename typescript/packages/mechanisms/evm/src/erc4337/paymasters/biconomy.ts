/**
 * Biconomy Paymaster Client
 *
 * Paymaster integration with Biconomy's sponsorship service.
 * Supports:
 * - Sponsorship mode with spending limits
 * - ERC-20 token mode with configurable tokens
 * - Webhook-based policy validation
 *
 * @see https://docs.biconomy.io/paymaster
 */

import type { Address, Hex } from "viem";
import type {
  UserOperation,
  PaymasterData,
} from "../types.js";
import { ENTRYPOINT_V07_ADDRESS, DEFAULT_GAS_LIMITS, packAccountGasLimits, packGasFees } from "../constants.js";

/**
 * Biconomy paymaster mode
 */
export type BiconomyPaymasterMode = "SPONSORED" | "ERC20";

/**
 * Biconomy spending limit
 */
export interface BiconomySpendingLimit {
  /** Maximum gas cost per operation (in wei) */
  maxGasLimit?: bigint;
  /** Maximum gas cost per user per day (in wei) */
  dailyLimit?: bigint;
  /** Maximum number of operations per user per day */
  dailyOperationLimit?: number;
}

/**
 * Biconomy ERC-20 configuration
 */
export interface BiconomyErc20Config {
  /** Token address to pay with */
  tokenAddress: Address;
  /** Preferred token (for multi-token support) */
  preferredToken?: Address;
  /** Tokens whitelist */
  tokenWhitelist?: Address[];
}

/**
 * Biconomy paymaster configuration
 */
export interface BiconomyPaymasterConfig {
  /** Biconomy API key */
  apiKey: string;
  /** Chain ID */
  chainId: number;
  /** Paymaster mode */
  mode: BiconomyPaymasterMode;
  /** Paymaster contract address */
  paymasterAddress?: Address;
  /** Spending limits (for sponsored mode) */
  spendingLimit?: BiconomySpendingLimit;
  /** ERC-20 configuration (for token mode) */
  erc20Config?: BiconomyErc20Config;
  /** Custom paymaster URL */
  paymasterUrl?: string;
}

/**
 * Biconomy sponsor result
 */
export interface BiconomySponsorResult {
  /** Paymaster address */
  paymaster: Address;
  /** Packed paymaster data for UserOp */
  paymasterAndData: Hex;
  /** Gas estimates */
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  paymasterVerificationGasLimit: bigint;
  paymasterPostOpGasLimit: bigint;
}

/**
 * Biconomy paymaster client
 */
export class BiconomyPaymaster {
  private readonly apiKey: string;
  private readonly paymasterUrl: string;
  private readonly mode: BiconomyPaymasterMode;
  private readonly paymasterAddress?: Address;
  private readonly erc20Config?: BiconomyErc20Config;

  constructor(config: BiconomyPaymasterConfig) {
    this.apiKey = config.apiKey;
    this.mode = config.mode;
    this.paymasterAddress = config.paymasterAddress;
    this.erc20Config = config.erc20Config;
    this.paymasterUrl = config.paymasterUrl ??
      `https://paymaster.biconomy.io/api/v1/${config.chainId}`;
  }

  /**
   * Sponsor a UserOperation
   */
  async sponsorUserOperation(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
    options?: {
      /** Webhook data for policy validation */
      webhookData?: Record<string, unknown>;
    },
  ): Promise<BiconomySponsorResult> {
    const packed = this.packUserOpForSponsorship(userOp);

    const requestBody: Record<string, unknown> = {
      method: "pm_sponsorUserOperation",
      params: [
        packed,
        ENTRYPOINT_V07_ADDRESS,
        {
          mode: this.mode,
          calculateGasLimits: true,
        },
      ],
    };

    if (this.mode === "ERC20" && this.erc20Config) {
      (requestBody.params as Record<string, unknown>[])[2] = {
        ...((requestBody.params as Record<string, unknown>[])[2] as Record<string, unknown>),
        tokenInfo: {
          feeTokenAddress: this.erc20Config.tokenAddress,
          preferredToken: this.erc20Config.preferredToken,
        },
      };
    }

    if (options?.webhookData) {
      (requestBody.params as Record<string, unknown>[])[2] = {
        ...((requestBody.params as Record<string, unknown>[])[2] as Record<string, unknown>),
        webhookData: options.webhookData,
      };
    }

    const result = await this.rpcCall<{
      paymasterAndData: Hex;
      callGasLimit: Hex;
      verificationGasLimit: Hex;
      preVerificationGas: Hex;
    }>(requestBody);

    // Parse paymaster data
    const paymaster = this.paymasterAddress ??
      (`0x${result.paymasterAndData.slice(2, 42)}` as Address);
    const paymasterVerificationGasLimit = result.paymasterAndData.length >= 74
      ? BigInt(`0x${result.paymasterAndData.slice(42, 74)}`)
      : DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit;
    const paymasterPostOpGasLimit = result.paymasterAndData.length >= 106
      ? BigInt(`0x${result.paymasterAndData.slice(74, 106)}`)
      : DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit;

    return {
      paymaster,
      paymasterAndData: result.paymasterAndData,
      callGasLimit: BigInt(result.callGasLimit),
      verificationGasLimit: BigInt(result.verificationGasLimit),
      preVerificationGas: BigInt(result.preVerificationGas),
      paymasterVerificationGasLimit,
      paymasterPostOpGasLimit,
    };
  }

  /**
   * Get paymaster data without gas estimation
   */
  async getPaymasterData(
    userOp: UserOperation,
  ): Promise<PaymasterData> {
    const result = await this.sponsorUserOperation(userOp);

    return {
      paymaster: result.paymaster,
      paymasterVerificationGasLimit: result.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: result.paymasterPostOpGasLimit,
      paymasterData: result.paymasterAndData.length > 106
        ? (`0x${result.paymasterAndData.slice(106)}` as Hex)
        : "0x" as Hex,
    };
  }

  /**
   * Get supported tokens for ERC-20 mode
   */
  async getSupportedTokens(): Promise<Array<{
    address: Address;
    symbol: string;
    decimals: number;
    exchangeRate: bigint;
  }>> {
    const result = await this.rpcCall<{
      tokens: Array<{
        address: Address;
        symbol: string;
        decimals: number;
        exchangeRate: Hex;
      }>;
    }>({
      method: "pm_getSupportedTokens",
      params: [ENTRYPOINT_V07_ADDRESS],
    });

    return result.tokens.map((token) => ({
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      exchangeRate: BigInt(token.exchangeRate),
    }));
  }

  /**
   * Get fee quotes for a UserOperation
   */
  async getFeeQuotes(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
  ): Promise<Array<{
    symbol: string;
    tokenAddress: Address;
    maxGasFee: bigint;
    maxGasFeeUSD: string;
    decimals: number;
  }>> {
    const packed = this.packUserOpForSponsorship(userOp);

    const result = await this.rpcCall<{
      feeQuotes: Array<{
        symbol: string;
        tokenAddress: Address;
        maxGasFee: Hex;
        maxGasFeeUSD: string;
        decimals: number;
      }>;
    }>({
      method: "pm_getFeeQuotes",
      params: [packed, ENTRYPOINT_V07_ADDRESS],
    });

    return result.feeQuotes.map((quote) => ({
      symbol: quote.symbol,
      tokenAddress: quote.tokenAddress,
      maxGasFee: BigInt(quote.maxGasFee),
      maxGasFeeUSD: quote.maxGasFeeUSD,
      decimals: quote.decimals,
    }));
  }

  /**
   * Check sponsorship eligibility
   */
  async checkSponsorship(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
  ): Promise<{
    eligible: boolean;
    reason?: string;
    remainingDailyLimit?: bigint;
    remainingDailyOps?: number;
  }> {
    try {
      const packed = this.packUserOpForSponsorship(userOp);

      const result = await this.rpcCall<{
        eligible: boolean;
        reason?: string;
        remainingDailyLimit?: Hex;
        remainingDailyOps?: number;
      }>({
        method: "pm_checkSponsorship",
        params: [packed, ENTRYPOINT_V07_ADDRESS],
      });

      return {
        eligible: result.eligible,
        reason: result.reason,
        remainingDailyLimit: result.remainingDailyLimit
          ? BigInt(result.remainingDailyLimit)
          : undefined,
        remainingDailyOps: result.remainingDailyOps,
      };
    } catch (error) {
      return {
        eligible: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Pack UserOp for sponsorship request
   */
  private packUserOpForSponsorship(
    userOp: Partial<UserOperation> & { sender: Address; callData: Hex },
  ): Record<string, unknown> {
    return {
      sender: userOp.sender,
      nonce: this.toHex(userOp.nonce ?? 0n),
      initCode: userOp.initCode ?? "0x",
      callData: userOp.callData,
      accountGasLimits: userOp.verificationGasLimit && userOp.callGasLimit
        ? packAccountGasLimits(userOp.verificationGasLimit, userOp.callGasLimit)
        : packAccountGasLimits(DEFAULT_GAS_LIMITS.verificationGasLimit, DEFAULT_GAS_LIMITS.callGasLimit),
      preVerificationGas: this.toHex(userOp.preVerificationGas ?? DEFAULT_GAS_LIMITS.preVerificationGas),
      gasFees: userOp.maxPriorityFeePerGas && userOp.maxFeePerGas
        ? packGasFees(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas)
        : packGasFees(1000000000n, 10000000000n),
      paymasterAndData: "0x",
      signature: userOp.signature ?? getDummySignature(),
    };
  }

  /**
   * Convert bigint to hex
   */
  private toHex(value: bigint): Hex {
    return `0x${value.toString(16)}` as Hex;
  }

  /**
   * Make RPC call to Biconomy
   */
  private async rpcCall<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.paymasterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        ...body,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as {
      result?: T;
      error?: { code: number; message: string; data?: unknown };
    };

    if (json.error) {
      throw new Error(json.error.message);
    }

    return json.result as T;
  }
}

/**
 * Get dummy signature for sponsorship requests
 */
function getDummySignature(): Hex {
  return "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex;
}

/**
 * Create a Biconomy paymaster client
 */
export function createBiconomyPaymaster(config: BiconomyPaymasterConfig): BiconomyPaymaster {
  return new BiconomyPaymaster(config);
}
