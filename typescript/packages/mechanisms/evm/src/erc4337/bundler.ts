/**
 * ERC-4337 Bundler Client
 *
 * Client for interacting with ERC-4337 bundlers via JSON-RPC.
 * Handles UserOperation submission, gas estimation, and receipt polling.
 */

import type { Address, Hex } from "viem";
import type {
  UserOperation,
  PackedUserOperation,
  GasEstimate,
  UserOperationReceipt,
  UserOperationResult,
  BundlerConfig,
} from "./types.js";
import {
  ENTRYPOINT_V07_ADDRESS,
  BUNDLER_METHODS,
  packAccountGasLimits,
  packGasFees,
} from "./constants.js";

/**
 * JSON-RPC request structure
 */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
}

/**
 * JSON-RPC response structure
 */
interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Bundler error class
 */
export class BundlerError extends Error {
  constructor(
    message: string,
    public code?: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = "BundlerError";
  }
}

/**
 * Bundler client for submitting UserOperations
 */
export class BundlerClient {
  private readonly bundlerUrl: string;
  private readonly entryPoint: Address;
  private requestId: number = 0;

  constructor(config: BundlerConfig) {
    this.bundlerUrl = config.bundlerUrl;
    this.entryPoint = config.entryPoint ?? ENTRYPOINT_V07_ADDRESS;
    // Note: chainId from config is available for future use but not currently needed
    void config.chainId;
  }

  /**
   * Send a UserOperation to the bundler
   */
  async sendUserOperation(userOp: UserOperation): Promise<UserOperationResult> {
    const packed = this.packForRpc(userOp);

    const userOpHash = await this.rpcCall<Hex>(
      BUNDLER_METHODS.sendUserOperation,
      [packed, this.entryPoint],
    );

    return {
      userOpHash,
      wait: () => this.waitForReceipt(userOpHash),
    };
  }

  /**
   * Estimate gas for a UserOperation
   */
  async estimateUserOperationGas(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
  ): Promise<GasEstimate> {
    // Fill in defaults for estimation
    const estimationOp = {
      sender: userOp.sender,
      nonce: userOp.nonce ?? 0n,
      initCode: userOp.initCode ?? "0x",
      callData: userOp.callData,
      verificationGasLimit: userOp.verificationGasLimit ?? 1000000n,
      callGasLimit: userOp.callGasLimit ?? 1000000n,
      preVerificationGas: userOp.preVerificationGas ?? 100000n,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas ?? 1000000000n,
      maxFeePerGas: userOp.maxFeePerGas ?? 10000000000n,
      paymasterAndData: userOp.paymasterAndData ?? "0x",
      signature:
        userOp.signature ??
        // Dummy signature for estimation
        "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c",
    };

    const packed = this.packForRpc(estimationOp as UserOperation);

    const result = await this.rpcCall<{
      verificationGasLimit: Hex;
      callGasLimit: Hex;
      preVerificationGas: Hex;
      paymasterVerificationGasLimit?: Hex;
      paymasterPostOpGasLimit?: Hex;
    }>(BUNDLER_METHODS.estimateUserOperationGas, [packed, this.entryPoint]);

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
   * Get UserOperation by hash
   */
  async getUserOperationByHash(
    userOpHash: Hex,
  ): Promise<{ userOperation: PackedUserOperation; entryPoint: Address } | null> {
    const result = await this.rpcCall<{
      userOperation: PackedUserOperation;
      entryPoint: Address;
    } | null>(BUNDLER_METHODS.getUserOperationByHash, [userOpHash]);

    return result;
  }

  /**
   * Get UserOperation receipt
   */
  async getUserOperationReceipt(
    userOpHash: Hex,
  ): Promise<UserOperationReceipt | null> {
    const result = await this.rpcCall<{
      userOpHash: Hex;
      sender: Address;
      nonce: Hex;
      paymaster?: Address;
      actualGasCost: Hex;
      actualGasUsed: Hex;
      success: boolean;
      reason?: string;
      receipt: {
        transactionHash: Hex;
        blockNumber: Hex;
        blockHash: Hex;
      };
    } | null>(BUNDLER_METHODS.getUserOperationReceipt, [userOpHash]);

    if (!result) return null;

    return {
      userOpHash: result.userOpHash,
      sender: result.sender,
      nonce: BigInt(result.nonce),
      paymaster: result.paymaster,
      actualGasCost: BigInt(result.actualGasCost),
      actualGasUsed: BigInt(result.actualGasUsed),
      success: result.success,
      reason: result.reason,
      receipt: {
        transactionHash: result.receipt.transactionHash,
        blockNumber: BigInt(result.receipt.blockNumber),
        blockHash: result.receipt.blockHash,
      },
    };
  }

  /**
   * Get supported EntryPoints
   */
  async getSupportedEntryPoints(): Promise<Address[]> {
    return this.rpcCall<Address[]>(BUNDLER_METHODS.supportedEntryPoints, []);
  }

  /**
   * Get chain ID from bundler
   */
  async getChainId(): Promise<number> {
    const result = await this.rpcCall<Hex>(BUNDLER_METHODS.chainId, []);
    return Number(result);
  }

  /**
   * Wait for UserOperation receipt with polling
   */
  async waitForReceipt(
    userOpHash: Hex,
    options: { timeout?: number; pollingInterval?: number } = {},
  ): Promise<UserOperationReceipt> {
    const timeout = options.timeout ?? 60000; // 60 seconds default
    const pollingInterval = options.pollingInterval ?? 2000; // 2 seconds default

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const receipt = await this.getUserOperationReceipt(userOpHash);

      if (receipt) {
        return receipt;
      }

      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }

    throw new BundlerError(
      `Timeout waiting for UserOperation receipt: ${userOpHash}`,
    );
  }

  /**
   * Pack UserOperation for RPC (convert bigints to hex strings)
   */
  private packForRpc(userOp: UserOperation): Record<string, unknown> {
    return {
      sender: userOp.sender,
      nonce: this.toHex(userOp.nonce),
      initCode: userOp.initCode,
      callData: userOp.callData,
      accountGasLimits: packAccountGasLimits(
        userOp.verificationGasLimit,
        userOp.callGasLimit,
      ),
      preVerificationGas: this.toHex(userOp.preVerificationGas),
      gasFees: packGasFees(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas),
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }

  /**
   * Convert bigint to hex string
   */
  private toHex(value: bigint): Hex {
    return `0x${value.toString(16)}` as Hex;
  }

  /**
   * Make a JSON-RPC call to the bundler
   */
  private async rpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: ++this.requestId,
      method,
      params,
    };

    const response = await fetch(this.bundlerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new BundlerError(
        `HTTP error: ${response.status} ${response.statusText}`,
      );
    }

    const json = (await response.json()) as JsonRpcResponse<T>;

    if (json.error) {
      throw new BundlerError(json.error.message, json.error.code, json.error.data);
    }

    return json.result as T;
  }
}

/**
 * Create a BundlerClient instance
 */
export function createBundlerClient(config: BundlerConfig): BundlerClient {
  return new BundlerClient(config);
}
