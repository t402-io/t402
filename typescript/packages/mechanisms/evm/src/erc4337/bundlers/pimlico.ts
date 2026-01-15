/**
 * Pimlico Bundler Client
 *
 * Extended bundler client with Pimlico-specific methods:
 * - pimlico_getUserOperationGasPrice: Get current gas prices
 * - pimlico_sendCompressedUserOperation: Submit with calldata compression
 *
 * @see https://docs.pimlico.io/bundler/reference
 */

import type { Address, Hex } from "viem";
import {
  BundlerClient,
  BundlerError,
} from "../bundler.js";
import type {
  UserOperation,
  UserOperationResult,
  GasEstimate,
} from "../types.js";
import { ENTRYPOINT_V07_ADDRESS, packAccountGasLimits, packGasFees } from "../constants.js";

/**
 * Gas price response from Pimlico
 */
export interface PimlicoGasPrice {
  slow: {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  };
  standard: {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  };
  fast: {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  };
}

/**
 * Pimlico bundler configuration
 */
export interface PimlicoConfig {
  /** Bundler RPC URL (optional, auto-generated if not provided) */
  bundlerUrl?: string;
  /** Chain ID */
  chainId: number;
  /** Pimlico API key */
  apiKey: string;
}

/**
 * Pimlico bundler client with extended methods
 */
export class PimlicoBundlerClient extends BundlerClient {
  private readonly pimlicoUrl: string;

  constructor(config: PimlicoConfig) {
    // Construct Pimlico bundler URL
    const bundlerUrl = config.bundlerUrl && config.bundlerUrl.includes("pimlico")
      ? config.bundlerUrl
      : `https://api.pimlico.io/v2/${config.chainId}/rpc?apikey=${config.apiKey}`;

    super({
      ...config,
      bundlerUrl,
    });

    this.pimlicoUrl = bundlerUrl;
  }

  /**
   * Get current gas prices from Pimlico
   * Returns slow, standard, and fast gas price estimates
   */
  async getUserOperationGasPrice(): Promise<PimlicoGasPrice> {
    const result = await this.pimlicoRpcCall<{
      slow: { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex };
      standard: { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex };
      fast: { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex };
    }>("pimlico_getUserOperationGasPrice", []);

    return {
      slow: {
        maxFeePerGas: BigInt(result.slow.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(result.slow.maxPriorityFeePerGas),
      },
      standard: {
        maxFeePerGas: BigInt(result.standard.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(result.standard.maxPriorityFeePerGas),
      },
      fast: {
        maxFeePerGas: BigInt(result.fast.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(result.fast.maxPriorityFeePerGas),
      },
    };
  }

  /**
   * Send a compressed UserOperation for lower gas costs
   * Pimlico compresses the calldata before submitting to reduce L1 costs
   */
  async sendCompressedUserOperation(
    userOp: UserOperation,
    inflatorAddress: Address,
  ): Promise<UserOperationResult> {
    const packed = this.packUserOpForRpc(userOp);

    const userOpHash = await this.pimlicoRpcCall<Hex>(
      "pimlico_sendCompressedUserOperation",
      [packed, inflatorAddress, ENTRYPOINT_V07_ADDRESS],
    );

    return {
      userOpHash,
      wait: () => this.waitForReceipt(userOpHash),
    };
  }

  /**
   * Get user operation status from Pimlico
   */
  async getUserOperationStatus(userOpHash: Hex): Promise<{
    status: "not_found" | "not_submitted" | "submitted" | "rejected" | "included" | "failed" | "reverted";
    transactionHash?: Hex;
  }> {
    const result = await this.pimlicoRpcCall<{
      status: string;
      transactionHash?: Hex;
    }>("pimlico_getUserOperationStatus", [userOpHash]);

    return {
      status: result.status as "not_found" | "not_submitted" | "submitted" | "rejected" | "included" | "failed" | "reverted",
      transactionHash: result.transactionHash,
    };
  }

  /**
   * Estimate gas with Pimlico-specific optimizations
   */
  async estimateUserOperationGasWithPimlico(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
    stateOverride?: Record<Address, { balance?: Hex; code?: Hex; nonce?: Hex }>,
  ): Promise<GasEstimate> {
    const estimationOp = {
      sender: userOp.sender,
      nonce: this.bigintToHex(userOp.nonce ?? 0n),
      initCode: userOp.initCode ?? "0x",
      callData: userOp.callData,
      accountGasLimits: packAccountGasLimits(
        userOp.verificationGasLimit ?? 1000000n,
        userOp.callGasLimit ?? 1000000n,
      ),
      preVerificationGas: this.bigintToHex(userOp.preVerificationGas ?? 100000n),
      gasFees: packGasFees(
        userOp.maxPriorityFeePerGas ?? 1000000000n,
        userOp.maxFeePerGas ?? 10000000000n,
      ),
      paymasterAndData: userOp.paymasterAndData ?? "0x",
      signature:
        userOp.signature ??
        "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
    };

    const params: unknown[] = [estimationOp, ENTRYPOINT_V07_ADDRESS];
    if (stateOverride) {
      params.push(stateOverride);
    }

    const result = await this.pimlicoRpcCall<{
      verificationGasLimit: Hex;
      callGasLimit: Hex;
      preVerificationGas: Hex;
      paymasterVerificationGasLimit?: Hex;
      paymasterPostOpGasLimit?: Hex;
    }>("eth_estimateUserOperationGas", params);

    return {
      verificationGasLimit: BigInt(result.verificationGasLimit),
      callGasLimit: BigInt(result.callGasLimit),
      preVerificationGas: BigInt(result.preVerificationGas),
      paymasterVerificationGasLimit: result.paymasterVerificationGasLimit
        ? BigInt(result.paymasterVerificationGasLimit)
        : undefined,
      paymasterPostOpGasLimit: result.paymasterPostOpGasLimit
        ? BigInt(result.paymasterPostOpGasLimit)
        : undefined,
    };
  }

  /**
   * Pack UserOperation for RPC
   */
  private packUserOpForRpc(userOp: UserOperation): Record<string, unknown> {
    return {
      sender: userOp.sender,
      nonce: this.bigintToHex(userOp.nonce),
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: packAccountGasLimits(
        userOp.verificationGasLimit,
        userOp.callGasLimit,
      ),
      preVerificationGas: this.bigintToHex(userOp.preVerificationGas),
      gasFees: packGasFees(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas),
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }

  /**
   * Convert bigint to hex
   */
  private bigintToHex(value: bigint): Hex {
    return `0x${value.toString(16)}` as Hex;
  }

  /**
   * Make Pimlico-specific RPC call
   */
  private async pimlicoRpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.pimlicoUrl, {
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
      throw new BundlerError(
        `HTTP error: ${response.status} ${response.statusText}`,
      );
    }

    const json = await response.json() as {
      result?: T;
      error?: { code: number; message: string; data?: unknown };
    };

    if (json.error) {
      throw new BundlerError(json.error.message, json.error.code, json.error.data);
    }

    return json.result as T;
  }
}

/**
 * Create a Pimlico bundler client
 */
export function createPimlicoBundlerClient(config: PimlicoConfig): PimlicoBundlerClient {
  return new PimlicoBundlerClient(config);
}
