/**
 * Alchemy Bundler Client
 *
 * Extended bundler client with Alchemy-specific methods:
 * - alchemy_requestGasAndPaymasterAndData: Combined gas + paymaster estimation
 * - alchemy_simulateUserOperationAssetChanges: Simulate asset changes
 *
 * @see https://docs.alchemy.com/reference/bundler-api-endpoints
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
  PaymasterData,
} from "../types.js";
import { ENTRYPOINT_V07_ADDRESS, packAccountGasLimits, packGasFees } from "../constants.js";

/**
 * Alchemy policy ID for gas sponsorship
 */
export interface AlchemyPolicyConfig {
  /** Policy ID from Alchemy dashboard */
  policyId: string;
}

/**
 * Asset change from simulation
 */
export interface AssetChange {
  /** Asset type: native, erc20, erc721, erc1155 */
  assetType: "native" | "erc20" | "erc721" | "erc1155";
  /** Direction: from or to the account */
  changeType: "transfer_in" | "transfer_out";
  /** Account affected */
  from: Address;
  to: Address;
  /** Amount (for native/erc20) or tokenId (for erc721) */
  amount?: string;
  tokenId?: string;
  /** Contract address (for tokens) */
  contractAddress?: Address;
  /** Token symbol/name */
  symbol?: string;
  name?: string;
  decimals?: number;
}

/**
 * Simulation result
 */
export interface SimulationResult {
  /** Whether simulation succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Asset changes from the operation */
  changes: AssetChange[];
}

/**
 * Alchemy bundler configuration
 */
export interface AlchemyConfig {
  /** Bundler RPC URL (optional, auto-generated if not provided) */
  bundlerUrl?: string;
  /** Chain ID */
  chainId: number;
  /** Alchemy API key */
  apiKey: string;
  /** Optional policy configuration for gas sponsorship */
  policy?: AlchemyPolicyConfig;
}

/**
 * Alchemy bundler client with extended methods
 */
export class AlchemyBundlerClient extends BundlerClient {
  private readonly alchemyUrl: string;
  private readonly policy?: AlchemyPolicyConfig;

  constructor(config: AlchemyConfig) {
    // Construct Alchemy bundler URL
    const network = getAlchemyNetwork(config.chainId);
    const bundlerUrl = config.bundlerUrl && config.bundlerUrl.includes("alchemy")
      ? config.bundlerUrl
      : `https://${network}.g.alchemy.com/v2/${config.apiKey}`;

    super({
      ...config,
      bundlerUrl,
    });

    this.alchemyUrl = bundlerUrl;
    this.policy = config.policy;
  }

  /**
   * Request gas estimates and paymaster data in a single call
   * This is more efficient than making separate calls
   */
  async requestGasAndPaymasterAndData(
    userOp: Partial<UserOperation> & {
      sender: Address;
      callData: Hex;
    },
    overrides?: {
      maxFeePerGas?: Hex;
      maxPriorityFeePerGas?: Hex;
      callGasLimit?: Hex;
      verificationGasLimit?: Hex;
      preVerificationGas?: Hex;
    },
  ): Promise<{
    gasEstimate: GasEstimate;
    paymasterData?: PaymasterData;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    if (!this.policy) {
      throw new BundlerError("Alchemy policy required for gas sponsorship");
    }

    const packed = this.packPartialUserOp(userOp);

    const result = await this.alchemyRpcCall<{
      paymasterAndData: Hex;
      callGasLimit: Hex;
      verificationGasLimit: Hex;
      preVerificationGas: Hex;
      maxFeePerGas: Hex;
      maxPriorityFeePerGas: Hex;
    }>("alchemy_requestGasAndPaymasterAndData", [
      {
        policyId: this.policy.policyId,
        entryPoint: ENTRYPOINT_V07_ADDRESS,
        userOperation: packed,
        dummySignature: userOp.signature ?? getDummySignature(),
        overrides,
      },
    ]);

    // Parse paymasterAndData into PaymasterData
    let paymasterData: PaymasterData | undefined;
    if (result.paymasterAndData && result.paymasterAndData !== "0x") {
      paymasterData = {
        paymaster: `0x${result.paymasterAndData.slice(2, 42)}` as Address,
        paymasterVerificationGasLimit: BigInt(`0x${result.paymasterAndData.slice(42, 74)}`),
        paymasterPostOpGasLimit: BigInt(`0x${result.paymasterAndData.slice(74, 106)}`),
        paymasterData: `0x${result.paymasterAndData.slice(106)}` as Hex,
      };
    }

    return {
      gasEstimate: {
        verificationGasLimit: BigInt(result.verificationGasLimit),
        callGasLimit: BigInt(result.callGasLimit),
        preVerificationGas: BigInt(result.preVerificationGas),
        paymasterVerificationGasLimit: paymasterData?.paymasterVerificationGasLimit,
        paymasterPostOpGasLimit: paymasterData?.paymasterPostOpGasLimit,
      },
      paymasterData,
      maxFeePerGas: BigInt(result.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(result.maxPriorityFeePerGas),
    };
  }

  /**
   * Simulate asset changes from a UserOperation
   * Useful for previewing what will happen before submitting
   */
  async simulateUserOperationAssetChanges(
    userOp: UserOperation,
  ): Promise<SimulationResult> {
    const packed = this.packUserOpForRpc(userOp);

    try {
      const result = await this.alchemyRpcCall<{
        changes: AssetChange[];
      }>("alchemy_simulateUserOperationAssetChanges", [
        {
          entryPoint: ENTRYPOINT_V07_ADDRESS,
          userOperation: packed,
        },
      ]);

      return {
        success: true,
        changes: result.changes,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Simulation failed",
        changes: [],
      };
    }
  }

  /**
   * Get fee history for gas estimation
   */
  async getFeeHistory(): Promise<{
    baseFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    maxFeePerGas: bigint;
  }> {
    // Use standard Alchemy fee history
    const result = await this.alchemyRpcCall<{
      baseFeePerGas: Hex[];
      reward: Hex[][];
    }>("eth_feeHistory", ["0x5", "latest", [25, 50, 75]]);

    const latestBaseFee = BigInt(result.baseFeePerGas[result.baseFeePerGas.length - 1]);
    const medianPriorityFee = BigInt(result.reward[Math.floor(result.reward.length / 2)][1]);

    return {
      baseFeePerGas: latestBaseFee,
      maxPriorityFeePerGas: medianPriorityFee,
      maxFeePerGas: latestBaseFee * 2n + medianPriorityFee,
    };
  }

  /**
   * Send UserOperation with Alchemy optimizations
   */
  async sendUserOperationWithAlchemy(
    userOp: UserOperation,
  ): Promise<UserOperationResult> {
    const packed = this.packUserOpForRpc(userOp);

    const userOpHash = await this.alchemyRpcCall<Hex>(
      "eth_sendUserOperation",
      [packed, ENTRYPOINT_V07_ADDRESS],
    );

    return {
      userOpHash,
      wait: () => this.waitForReceipt(userOpHash),
    };
  }

  /**
   * Pack partial UserOperation for estimation
   */
  private packPartialUserOp(
    userOp: Partial<UserOperation> & { sender: Address; callData: Hex },
  ): Record<string, unknown> {
    return {
      sender: userOp.sender,
      nonce: userOp.nonce !== undefined ? this.bigintToHex(userOp.nonce) : "0x0",
      initCode: userOp.initCode ?? "0x",
      callData: userOp.callData,
      callGasLimit: userOp.callGasLimit !== undefined
        ? this.bigintToHex(userOp.callGasLimit)
        : undefined,
      verificationGasLimit: userOp.verificationGasLimit !== undefined
        ? this.bigintToHex(userOp.verificationGasLimit)
        : undefined,
      preVerificationGas: userOp.preVerificationGas !== undefined
        ? this.bigintToHex(userOp.preVerificationGas)
        : undefined,
      maxFeePerGas: userOp.maxFeePerGas !== undefined
        ? this.bigintToHex(userOp.maxFeePerGas)
        : undefined,
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas !== undefined
        ? this.bigintToHex(userOp.maxPriorityFeePerGas)
        : undefined,
      paymasterAndData: userOp.paymasterAndData ?? "0x",
      signature: userOp.signature ?? getDummySignature(),
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
   * Make Alchemy RPC call
   */
  private async alchemyRpcCall<T>(method: string, params: unknown[]): Promise<T> {
    const response = await fetch(this.alchemyUrl, {
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
 * Get Alchemy network name from chain ID
 */
function getAlchemyNetwork(chainId: number): string {
  const networks: Record<number, string> = {
    1: "eth-mainnet",
    11155111: "eth-sepolia",
    137: "polygon-mainnet",
    80001: "polygon-mumbai",
    10: "opt-mainnet",
    420: "opt-goerli",
    42161: "arb-mainnet",
    421613: "arb-goerli",
    8453: "base-mainnet",
    84532: "base-sepolia",
  };

  const network = networks[chainId];
  if (!network) {
    throw new BundlerError(`Unsupported chain ID for Alchemy: ${chainId}`);
  }

  return network;
}

/**
 * Get dummy signature for estimation
 */
function getDummySignature(): Hex {
  return "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex;
}

/**
 * Create an Alchemy bundler client
 */
export function createAlchemyBundlerClient(config: AlchemyConfig): AlchemyBundlerClient {
  return new AlchemyBundlerClient(config);
}
