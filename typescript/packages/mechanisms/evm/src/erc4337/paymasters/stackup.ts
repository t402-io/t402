/**
 * Stackup Paymaster Client
 *
 * Paymaster integration with Stackup's sponsorship service.
 * Supports:
 * - Verifying paymaster with custom policies
 * - Off-chain sponsorship with pm_oo methods
 *
 * @see https://docs.stackup.sh/docs/paymaster-api
 */

import type { Address, Hex } from "viem";
import type { UserOperation, PaymasterData } from "../types.js";
import {
  ENTRYPOINT_V07_ADDRESS,
  DEFAULT_GAS_LIMITS,
  packAccountGasLimits,
  packGasFees,
} from "../constants.js";

/**
 * Stackup paymaster type
 */
export type StackupPaymasterType = "payg" | "verifying";

/**
 * Stackup context for sponsorship
 */
export interface StackupContext {
  /** Type of sponsorship (defaults to paymaster's configured type) */
  type?: StackupPaymasterType;
  /** Custom data for policy validation */
  customData?: Record<string, unknown>;
}

/**
 * Stackup paymaster configuration
 */
export interface StackupPaymasterConfig {
  /** Stackup API key */
  apiKey: string;
  /** Chain ID */
  chainId: number;
  /** Paymaster type */
  type?: StackupPaymasterType;
  /** Custom paymaster URL */
  paymasterUrl?: string;
  /** Custom RPC URL (for bundler operations) */
  rpcUrl?: string;
}

/**
 * Stackup sponsor result
 */
export interface StackupSponsorResult {
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
 * Stackup paymaster client
 */
export class StackupPaymaster {
  private readonly paymasterUrl: string;

  /**
   * Creates a new Stackup paymaster client
   *
   * @param config - Stackup paymaster configuration including API key and type
   */
  constructor(config: StackupPaymasterConfig) {
    this.paymasterUrl =
      config.paymasterUrl ?? `https://api.stackup.sh/v1/paymaster/${config.apiKey}`;
  }

  /**
   * Sponsor a UserOperation using pm_oo (off-chain) method
   *
   * @param userOp - Partial UserOperation with sender and callData required
   * @param context - Optional context data for sponsorship validation
   * @returns Sponsorship result with paymaster data and gas estimates
   */
  async sponsorUserOperation(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
    context?: StackupContext,
  ): Promise<StackupSponsorResult> {
    const packed = this.packUserOpForSponsorship(userOp);

    const params: unknown[] = [packed, ENTRYPOINT_V07_ADDRESS];
    if (context) {
      params.push(context);
    }

    const result = await this.rpcCall<{
      paymasterAndData: Hex;
      callGasLimit: Hex;
      verificationGasLimit: Hex;
      preVerificationGas: Hex;
    }>("pm_sponsorUserOperation", params);

    // Parse paymaster data
    const paymaster = `0x${result.paymasterAndData.slice(2, 42)}` as Address;
    const paymasterVerificationGasLimit =
      result.paymasterAndData.length >= 74
        ? BigInt(`0x${result.paymasterAndData.slice(42, 74)}`)
        : DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit;
    const paymasterPostOpGasLimit =
      result.paymasterAndData.length >= 106
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
   * Get paymaster stub data for gas estimation
   * Returns dummy paymaster data that can be used for estimation
   *
   * @param userOp - Partial UserOperation with sender and callData required
   * @param context - Optional context data for the paymaster
   * @returns Stub paymaster data for gas estimation
   */
  async getPaymasterStubData(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
    context?: StackupContext,
  ): Promise<{
    paymasterAndData: Hex;
    paymasterVerificationGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
  }> {
    const packed = this.packUserOpForSponsorship(userOp);

    const params: unknown[] = [packed, ENTRYPOINT_V07_ADDRESS];
    if (context) {
      params.push(context);
    }

    const result = await this.rpcCall<{
      paymasterAndData: Hex;
      paymasterVerificationGasLimit?: Hex;
      paymasterPostOpGasLimit?: Hex;
    }>("pm_getPaymasterStubData", params);

    return {
      paymasterAndData: result.paymasterAndData,
      paymasterVerificationGasLimit: result.paymasterVerificationGasLimit
        ? BigInt(result.paymasterVerificationGasLimit)
        : DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: result.paymasterPostOpGasLimit
        ? BigInt(result.paymasterPostOpGasLimit)
        : DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit,
    };
  }

  /**
   * Get paymaster data after estimation
   *
   * @param userOp - The complete UserOperation to get paymaster data for
   * @param context - Optional context data for the paymaster
   * @returns Paymaster data including address and gas limits
   */
  async getPaymasterData(userOp: UserOperation, context?: StackupContext): Promise<PaymasterData> {
    const result = await this.sponsorUserOperation(userOp, context);

    return {
      paymaster: result.paymaster,
      paymasterVerificationGasLimit: result.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: result.paymasterPostOpGasLimit,
      paymasterData:
        result.paymasterAndData.length > 106
          ? (`0x${result.paymasterAndData.slice(106)}` as Hex)
          : ("0x" as Hex),
    };
  }

  /**
   * Check account balance with paymaster
   *
   * @param account - The account address to check balance for
   * @returns Balance and currency information
   */
  async getAccountBalance(account: Address): Promise<{
    balance: bigint;
    currency: string;
  }> {
    const result = await this.rpcCall<{
      balance: Hex;
      currency: string;
    }>("pm_accounts", [account]);

    return {
      balance: BigInt(result.balance),
      currency: result.currency,
    };
  }

  /**
   * Get supported entry points
   *
   * @returns Array of supported EntryPoint contract addresses
   */
  async getSupportedEntryPoints(): Promise<Address[]> {
    return this.rpcCall<Address[]>("pm_supportedEntryPoints", []);
  }

  /**
   * Validate UserOperation with paymaster
   *
   * @param userOp - The complete UserOperation to validate
   * @returns Validation result with validity status and optional time bounds
   */
  async validatePaymasterUserOp(userOp: UserOperation): Promise<{
    valid: boolean;
    validAfter?: bigint;
    validUntil?: bigint;
  }> {
    const packed = this.packForRpc(userOp);

    try {
      const result = await this.rpcCall<{
        valid: boolean;
        validAfter?: Hex;
        validUntil?: Hex;
      }>("pm_validatePaymasterUserOp", [packed, ENTRYPOINT_V07_ADDRESS]);

      return {
        valid: result.valid,
        validAfter: result.validAfter ? BigInt(result.validAfter) : undefined,
        validUntil: result.validUntil ? BigInt(result.validUntil) : undefined,
      };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Pack partial UserOp for sponsorship request
   *
   * @param userOp - Partial UserOperation with sender and callData required
   * @returns Packed UserOperation object for RPC calls
   */
  private packUserOpForSponsorship(
    userOp: Partial<UserOperation> & { sender: Address; callData: Hex },
  ): Record<string, unknown> {
    return {
      sender: userOp.sender,
      nonce: this.toHex(userOp.nonce ?? 0n),
      initCode: userOp.initCode ?? "0x",
      callData: userOp.callData,
      accountGasLimits:
        userOp.verificationGasLimit && userOp.callGasLimit
          ? packAccountGasLimits(userOp.verificationGasLimit, userOp.callGasLimit)
          : packAccountGasLimits(
              DEFAULT_GAS_LIMITS.verificationGasLimit,
              DEFAULT_GAS_LIMITS.callGasLimit,
            ),
      preVerificationGas: this.toHex(
        userOp.preVerificationGas ?? DEFAULT_GAS_LIMITS.preVerificationGas,
      ),
      gasFees:
        userOp.maxPriorityFeePerGas && userOp.maxFeePerGas
          ? packGasFees(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas)
          : packGasFees(1000000000n, 10000000000n),
      paymasterAndData: userOp.paymasterAndData ?? "0x",
      signature: userOp.signature ?? getDummySignature(),
    };
  }

  /**
   * Pack UserOp for RPC
   *
   * @param userOp - The complete UserOperation to pack
   * @returns Packed UserOperation object for RPC calls
   */
  private packForRpc(userOp: UserOperation): Record<string, unknown> {
    return {
      sender: userOp.sender,
      nonce: this.toHex(userOp.nonce),
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: packAccountGasLimits(userOp.verificationGasLimit, userOp.callGasLimit),
      preVerificationGas: this.toHex(userOp.preVerificationGas),
      gasFees: packGasFees(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas),
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }

  /**
   * Convert bigint to hex
   *
   * @param value - The bigint value to convert
   * @returns Hexadecimal string representation
   */
  private toHex(value: bigint): Hex {
    return `0x${value.toString(16)}` as Hex;
  }

  /**
   * Make RPC call to Stackup
   *
   * @param method - The RPC method name to call
   * @param params - Array of parameters for the RPC call
   * @returns The typed result from the RPC call
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

    const json = (await response.json()) as {
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
 *
 * @returns A dummy signature hex string for gas estimation
 */
function getDummySignature(): Hex {
  return "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex;
}

/**
 * Create a Stackup paymaster client
 *
 * @param config - Stackup paymaster configuration including API key and type
 * @returns A new StackupPaymaster instance
 */
export function createStackupPaymaster(config: StackupPaymasterConfig): StackupPaymaster {
  return new StackupPaymaster(config);
}
