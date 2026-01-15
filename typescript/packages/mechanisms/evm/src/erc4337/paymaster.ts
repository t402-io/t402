/**
 * ERC-4337 Paymaster Client
 *
 * Handles paymaster interactions for gas sponsorship.
 * Supports verifying paymasters (off-chain signature) and
 * sponsoring paymasters (third-party gas payment).
 */

import type { Address, Hex } from "viem";
import { concat, pad, toHex } from "viem";
import type {
  UserOperation,
  PaymasterData,
  PaymasterConfig,
  GasEstimate,
} from "./types.js";
import { DEFAULT_GAS_LIMITS } from "./constants.js";

/**
 * Paymaster service response
 */
export interface PaymasterResponse {
  /** Paymaster address */
  paymaster: Address;
  /** Paymaster data to include in UserOp */
  paymasterData: Hex;
  /** Gas limits for paymaster operations */
  paymasterVerificationGasLimit: bigint;
  paymasterPostOpGasLimit: bigint;
}

/**
 * Paymaster sponsor request
 */
export interface SponsorRequest {
  /** UserOperation to sponsor (without paymaster data) */
  userOp: Partial<UserOperation>;
  /** Chain ID */
  chainId: number;
  /** EntryPoint address */
  entryPoint: Address;
  /** Optional context for the paymaster */
  context?: Record<string, unknown>;
}

/**
 * Paymaster client for gas sponsorship
 */
export class PaymasterClient {
  private readonly config: PaymasterConfig;

  constructor(config: PaymasterConfig) {
    this.config = config;
  }

  /**
   * Get paymaster data for a UserOperation
   */
  async getPaymasterData(
    userOp: Partial<UserOperation>,
    chainId: number,
    entryPoint: Address,
    context?: Record<string, unknown>,
  ): Promise<PaymasterData> {
    switch (this.config.type) {
      case "verifying":
        return this.getVerifyingPaymasterData(userOp, chainId, entryPoint);
      case "sponsoring":
        return this.getSponsoringPaymasterData(
          userOp,
          chainId,
          entryPoint,
          context,
        );
      case "token":
        return this.getTokenPaymasterData(userOp, chainId, entryPoint);
      default:
        throw new Error(`Unknown paymaster type: ${this.config.type}`);
    }
  }

  /**
   * Get gas estimates including paymaster gas
   */
  async estimatePaymasterGas(
    _userOp: Partial<UserOperation>,
    _chainId: number,
  ): Promise<GasEstimate> {
    // For most paymasters, use default gas limits
    // This can be overridden by calling the paymaster service
    return {
      verificationGasLimit: DEFAULT_GAS_LIMITS.verificationGasLimit,
      callGasLimit: DEFAULT_GAS_LIMITS.callGasLimit,
      preVerificationGas: DEFAULT_GAS_LIMITS.preVerificationGas,
      paymasterVerificationGasLimit:
        DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit,
    };
  }

  /**
   * Check if the paymaster will sponsor this operation
   */
  async willSponsor(
    userOp: Partial<UserOperation>,
    chainId: number,
    entryPoint: Address,
    context?: Record<string, unknown>,
  ): Promise<boolean> {
    if (!this.config.url) {
      // Local paymaster - always sponsors
      return true;
    }

    try {
      const response = await fetch(`${this.config.url}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userOp: this.serializeUserOp(userOp),
          chainId,
          entryPoint,
          context,
        }),
      });

      if (!response.ok) return false;

      const result = (await response.json()) as { willSponsor: boolean };
      return result.willSponsor;
    } catch {
      return false;
    }
  }

  /**
   * Get verifying paymaster data (off-chain signature)
   */
  private async getVerifyingPaymasterData(
    userOp: Partial<UserOperation>,
    chainId: number,
    entryPoint: Address,
  ): Promise<PaymasterData> {
    if (this.config.url) {
      // Call paymaster service for signature
      return this.callPaymasterService(userOp, chainId, entryPoint);
    }

    // Local verifying paymaster - return basic data
    // The signature would need to be added by the paymaster owner
    return {
      paymaster: this.config.address,
      paymasterVerificationGasLimit:
        DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit,
      paymasterData: "0x" as Hex,
    };
  }

  /**
   * Get sponsoring paymaster data (third-party pays)
   */
  private async getSponsoringPaymasterData(
    userOp: Partial<UserOperation>,
    chainId: number,
    entryPoint: Address,
    context?: Record<string, unknown>,
  ): Promise<PaymasterData> {
    if (!this.config.url) {
      throw new Error("Sponsoring paymaster requires a service URL");
    }

    // Call the sponsor API
    const response = await fetch(`${this.config.url}/sponsor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userOp: this.serializeUserOp(userOp),
        chainId,
        entryPoint,
        context,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Paymaster rejected sponsorship: ${error}`);
    }

    const result = (await response.json()) as PaymasterResponse;

    return {
      paymaster: result.paymaster,
      paymasterVerificationGasLimit: result.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: result.paymasterPostOpGasLimit,
      paymasterData: result.paymasterData,
    };
  }

  /**
   * Get token paymaster data (pay gas with ERC20)
   */
  private async getTokenPaymasterData(
    userOp: Partial<UserOperation>,
    chainId: number,
    entryPoint: Address,
  ): Promise<PaymasterData> {
    const tokenAddress = this.config.options?.tokenAddress as Address | undefined;
    if (!tokenAddress) {
      throw new Error("Token paymaster requires tokenAddress in options");
    }

    if (this.config.url) {
      // Call paymaster service for token rate and data
      return this.callPaymasterService(userOp, chainId, entryPoint, {
        tokenAddress,
      });
    }

    // Return basic token paymaster data
    // The actual rate and validation would be done on-chain
    return {
      paymaster: this.config.address,
      paymasterVerificationGasLimit:
        DEFAULT_GAS_LIMITS.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: DEFAULT_GAS_LIMITS.paymasterPostOpGasLimit,
      paymasterData: tokenAddress as Hex, // Token address as data
    };
  }

  /**
   * Call paymaster service API
   */
  private async callPaymasterService(
    userOp: Partial<UserOperation>,
    chainId: number,
    entryPoint: Address,
    context?: Record<string, unknown>,
  ): Promise<PaymasterData> {
    if (!this.config.url) {
      throw new Error("Paymaster service URL not configured");
    }

    const response = await fetch(`${this.config.url}/getPaymasterData`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userOp: this.serializeUserOp(userOp),
        chainId,
        entryPoint,
        context,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Paymaster service error: ${error}`);
    }

    const result = (await response.json()) as PaymasterResponse;

    return {
      paymaster: result.paymaster,
      paymasterVerificationGasLimit: BigInt(result.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: BigInt(result.paymasterPostOpGasLimit),
      paymasterData: result.paymasterData,
    };
  }

  /**
   * Serialize UserOperation for API calls
   */
  private serializeUserOp(
    userOp: Partial<UserOperation>,
  ): Record<string, string> {
    const result: Record<string, string> = {};

    if (userOp.sender) result.sender = userOp.sender;
    if (userOp.nonce !== undefined)
      result.nonce = `0x${userOp.nonce.toString(16)}`;
    if (userOp.initCode) result.initCode = userOp.initCode;
    if (userOp.callData) result.callData = userOp.callData;
    if (userOp.verificationGasLimit !== undefined)
      result.verificationGasLimit = `0x${userOp.verificationGasLimit.toString(16)}`;
    if (userOp.callGasLimit !== undefined)
      result.callGasLimit = `0x${userOp.callGasLimit.toString(16)}`;
    if (userOp.preVerificationGas !== undefined)
      result.preVerificationGas = `0x${userOp.preVerificationGas.toString(16)}`;
    if (userOp.maxPriorityFeePerGas !== undefined)
      result.maxPriorityFeePerGas = `0x${userOp.maxPriorityFeePerGas.toString(16)}`;
    if (userOp.maxFeePerGas !== undefined)
      result.maxFeePerGas = `0x${userOp.maxFeePerGas.toString(16)}`;
    if (userOp.paymasterAndData) result.paymasterAndData = userOp.paymasterAndData;
    if (userOp.signature) result.signature = userOp.signature;

    return result;
  }
}

/**
 * Create a PaymasterClient instance
 */
export function createPaymasterClient(config: PaymasterConfig): PaymasterClient {
  return new PaymasterClient(config);
}

/**
 * Encode paymaster data for inclusion in UserOperation
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
 * Decode paymaster and data from UserOperation
 */
export function decodePaymasterAndData(paymasterAndData: Hex): PaymasterData | null {
  if (paymasterAndData === "0x" || paymasterAndData.length < 86) {
    return null;
  }

  // 20 bytes address + 16 bytes verification gas + 16 bytes postOp gas = 52 bytes = 104 hex chars + 0x
  const paymaster = `0x${paymasterAndData.slice(2, 42)}` as Address;
  const paymasterVerificationGasLimit = BigInt(
    `0x${paymasterAndData.slice(42, 74)}`,
  );
  const paymasterPostOpGasLimit = BigInt(`0x${paymasterAndData.slice(74, 106)}`);
  const paymasterData = `0x${paymasterAndData.slice(106)}` as Hex;

  return {
    paymaster,
    paymasterVerificationGasLimit,
    paymasterPostOpGasLimit,
    paymasterData,
  };
}
