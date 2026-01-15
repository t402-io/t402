/**
 * Pimlico Paymaster Client
 *
 * Paymaster integration with Pimlico's sponsorship service.
 * Supports:
 * - Verifying paymaster with off-chain signatures
 * - ERC-20 token payments
 * - Spending policies and limits
 *
 * @see https://docs.pimlico.io/paymaster
 */

import type { Address, Hex } from "viem";
import { concat, pad, toHex } from "viem";
import type {
  UserOperation,
  PaymasterData,
  GasEstimate,
} from "../types.js";
import { ENTRYPOINT_V07_ADDRESS, DEFAULT_GAS_LIMITS, packAccountGasLimits, packGasFees } from "../constants.js";

/**
 * Pimlico paymaster type
 */
export type PimlicoPaymasterType = "verifying" | "erc20";

/**
 * Pimlico sponsorship policy
 */
export interface PimlicoPolicy {
  /** Maximum gas cost per operation (in wei) */
  maxGasCost?: bigint;
  /** Maximum operations per user per day */
  maxOpsPerUser?: number;
  /** Allowed sender addresses */
  allowedSenders?: Address[];
  /** Allowed target contracts */
  allowedTargets?: Address[];
}

/**
 * Pimlico paymaster configuration
 */
export interface PimlicoPaymasterConfig {
  /** Pimlico API key */
  apiKey: string;
  /** Chain ID */
  chainId: number;
  /** Paymaster type */
  type?: PimlicoPaymasterType;
  /** Token address for ERC-20 paymaster */
  tokenAddress?: Address;
  /** Sponsorship policy */
  policy?: PimlicoPolicy;
  /** Custom paymaster URL (optional) */
  paymasterUrl?: string;
}

/**
 * Pimlico sponsor result
 */
export interface PimlicoSponsorResult {
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
 * Pimlico paymaster client
 */
export class PimlicoPaymaster {
  private readonly paymasterUrl: string;
  private readonly type: PimlicoPaymasterType;
  private readonly tokenAddress?: Address;

  constructor(config: PimlicoPaymasterConfig) {
    this.type = config.type ?? "verifying";
    this.tokenAddress = config.tokenAddress;
    this.paymasterUrl = config.paymasterUrl ??
      `https://api.pimlico.io/v2/${config.chainId}/rpc?apikey=${config.apiKey}`;
  }

  /**
   * Sponsor a UserOperation
   * Returns paymaster data to include in the UserOp
   */
  async sponsorUserOperation(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
    options?: {
      /** Override gas limits */
      gasOverrides?: Partial<GasEstimate>;
    },
  ): Promise<PimlicoSponsorResult> {
    const packed = this.packUserOpForSponsorship(userOp);

    const params: Record<string, unknown> = {
      entryPoint: ENTRYPOINT_V07_ADDRESS,
      userOperation: packed,
    };

    if (this.type === "erc20" && this.tokenAddress) {
      params.sponsorshipPolicyId = this.tokenAddress;
    }

    const result = await this.rpcCall<{
      paymasterAndData: Hex;
      callGasLimit: Hex;
      verificationGasLimit: Hex;
      preVerificationGas: Hex;
    }>("pm_sponsorUserOperation", [params]);

    // Parse paymaster address and gas limits from paymasterAndData
    const paymaster = `0x${result.paymasterAndData.slice(2, 42)}` as Address;
    const paymasterVerificationGasLimit = BigInt(`0x${result.paymasterAndData.slice(42, 74)}`);
    const paymasterPostOpGasLimit = BigInt(`0x${result.paymasterAndData.slice(74, 106)}`);

    return {
      paymaster,
      paymasterAndData: result.paymasterAndData,
      callGasLimit: options?.gasOverrides?.callGasLimit ?? BigInt(result.callGasLimit),
      verificationGasLimit: options?.gasOverrides?.verificationGasLimit ?? BigInt(result.verificationGasLimit),
      preVerificationGas: options?.gasOverrides?.preVerificationGas ?? BigInt(result.preVerificationGas),
      paymasterVerificationGasLimit,
      paymasterPostOpGasLimit,
    };
  }

  /**
   * Get paymaster data without gas estimation
   * Useful when gas is already estimated
   */
  async getPaymasterData(
    userOp: UserOperation,
  ): Promise<PaymasterData> {
    const result = await this.sponsorUserOperation(userOp);

    return {
      paymaster: result.paymaster,
      paymasterVerificationGasLimit: result.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: result.paymasterPostOpGasLimit,
      paymasterData: `0x${result.paymasterAndData.slice(106)}` as Hex,
    };
  }

  /**
   * Check if an operation would be sponsored
   */
  async willSponsor(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
  ): Promise<{ sponsored: boolean; reason?: string }> {
    try {
      await this.sponsorUserOperation(userOp);
      return { sponsored: true };
    } catch (error) {
      return {
        sponsored: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get token quotes for ERC-20 paymaster
   */
  async getTokenQuotes(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
    tokens: Address[],
  ): Promise<Array<{
    token: Address;
    maxCost: bigint;
    symbol: string;
    decimals: number;
  }>> {
    if (this.type !== "erc20") {
      throw new Error("Token quotes only available for ERC-20 paymaster");
    }

    const packed = this.packUserOpForSponsorship(userOp);

    const result = await this.rpcCall<Array<{
      token: Address;
      maxCost: Hex;
      symbol: string;
      decimals: number;
    }>>("pm_getTokenQuotes", [
      {
        entryPoint: ENTRYPOINT_V07_ADDRESS,
        userOperation: packed,
        tokens,
      },
    ]);

    return result.map((quote) => ({
      token: quote.token,
      maxCost: BigInt(quote.maxCost),
      symbol: quote.symbol,
      decimals: quote.decimals,
    }));
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
   * Make RPC call to Pimlico
   */
  private async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.paymasterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
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
 * Encode paymaster and data for UserOperation
 */
export function encodePaymasterAndData(data: PaymasterData): Hex {
  return concat([
    data.paymaster,
    pad(toHex(data.paymasterVerificationGasLimit), { size: 16 }),
    pad(toHex(data.paymasterPostOpGasLimit), { size: 16 }),
    data.paymasterData,
  ]) as Hex;
}

/**
 * Create a Pimlico paymaster client
 */
export function createPimlicoPaymaster(config: PimlicoPaymasterConfig): PimlicoPaymaster {
  return new PimlicoPaymaster(config);
}
