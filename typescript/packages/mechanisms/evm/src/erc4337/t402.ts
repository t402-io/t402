/**
 * ERC-4337 T402 Integration
 *
 * Integrates ERC-4337 Account Abstraction with T402 payment protocol.
 * Enables gasless payment execution via smart accounts and paymasters.
 */

import type { Address, Hex, PublicClient } from "viem";
import { encodeFunctionData } from "viem";
import type {
  SmartAccountSigner,
  TransactionIntent,
  PaymasterConfig,
  BundlerConfig,
  UserOperationResult,
  GasEstimate,
} from "./types.js";
import { UserOpBuilder } from "./builder.js";
import { BundlerClient } from "./bundler.js";
import { PaymasterClient } from "./paymaster.js";
import { ENTRYPOINT_V07_ADDRESS } from "./constants.js";

/**
 * T402 payment parameters for ERC-4337
 */
export interface GaslessPaymentParams {
  /** Token contract address */
  tokenAddress: Address;
  /** Recipient address (resource server/facilitator) */
  to: Address;
  /** Amount to transfer */
  amount: bigint;
  /** Optional: Pre-signed authorization (for EIP-3009 tokens) */
  authorization?: {
    validAfter: bigint;
    validBefore: bigint;
    nonce: Hex;
    signature: Hex;
  };
}

/**
 * Gasless T402 client configuration
 */
export interface GaslessClientConfig {
  /** Smart account signer */
  signer: SmartAccountSigner;
  /** Bundler configuration */
  bundler: BundlerConfig;
  /** Optional paymaster for gas sponsorship */
  paymaster?: PaymasterConfig;
  /** Chain ID */
  chainId: number;
  /** Public client for chain interactions */
  publicClient: PublicClient;
}

/**
 * ERC20 transfer ABI for building call data
 */
const ERC20_TRANSFER_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * EIP-3009 transferWithAuthorization ABI
 */
const EIP3009_TRANSFER_ABI = [
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Gasless T402 client for executing payments via ERC-4337
 */
export class GaslessT402Client {
  private readonly signer: SmartAccountSigner;
  private readonly builder: UserOpBuilder;
  private readonly bundler: BundlerClient;
  private readonly paymaster?: PaymasterClient;
  private readonly chainId: number;
  private readonly publicClient: PublicClient;

  constructor(config: GaslessClientConfig) {
    this.signer = config.signer;
    this.builder = new UserOpBuilder();
    this.bundler = new BundlerClient(config.bundler);
    this.paymaster = config.paymaster
      ? new PaymasterClient(config.paymaster)
      : undefined;
    this.chainId = config.chainId;
    this.publicClient = config.publicClient;
  }

  /**
   * Execute a T402 payment via ERC-4337
   *
   * This submits the payment as a UserOperation which can be:
   * - Sponsored by a paymaster (truly gasless)
   * - Paid from the smart account's balance
   */
  async executePayment(
    params: GaslessPaymentParams,
  ): Promise<UserOperationResult> {
    // Build the call data based on whether we have an authorization
    const callData = params.authorization
      ? this.buildAuthorizedTransferCallData(params)
      : this.buildTransferCallData(params);

    // Create the transaction intent
    const intent: TransactionIntent = {
      to: params.tokenAddress,
      value: 0n,
      data: callData,
    };

    // Estimate gas
    const gasEstimate = await this.estimateGas(intent);

    // Get paymaster data if configured
    const paymasterData = await this.getPaymasterData(gasEstimate);

    // Build the UserOperation
    const userOp = await this.builder.buildUserOp(
      this.signer,
      intent,
      this.publicClient,
      gasEstimate,
      paymasterData,
    );

    // Sign the UserOperation
    const signedUserOp = await this.builder.signUserOp(
      userOp,
      this.signer,
      this.publicClient,
      this.chainId,
    );

    // Submit to bundler
    return this.bundler.sendUserOperation(signedUserOp);
  }

  /**
   * Execute multiple T402 payments in a single UserOperation
   */
  async executeBatchPayments(
    payments: GaslessPaymentParams[],
  ): Promise<UserOperationResult> {
    // Build transaction intents for all payments
    const intents: TransactionIntent[] = payments.map((params) => ({
      to: params.tokenAddress,
      value: 0n,
      data: params.authorization
        ? this.buildAuthorizedTransferCallData(params)
        : this.buildTransferCallData(params),
    }));

    // Estimate gas for batch
    const gasEstimate = await this.estimateBatchGas(intents);

    // Get paymaster data
    const paymasterData = await this.getPaymasterData(gasEstimate);

    // Build batch UserOperation
    const userOp = await this.builder.buildBatchUserOp(
      this.signer,
      intents,
      this.publicClient,
      gasEstimate,
      paymasterData,
    );

    // Sign and submit
    const signedUserOp = await this.builder.signUserOp(
      userOp,
      this.signer,
      this.publicClient,
      this.chainId,
    );

    return this.bundler.sendUserOperation(signedUserOp);
  }

  /**
   * Check if a payment can be sponsored (gasless)
   */
  async canSponsor(params: GaslessPaymentParams): Promise<boolean> {
    if (!this.paymaster) return false;

    const intent: TransactionIntent = {
      to: params.tokenAddress,
      value: 0n,
      data: this.buildTransferCallData(params),
    };

    const sender = await this.signer.getAddress();

    return this.paymaster.willSponsor(
      { sender, callData: this.signer.encodeExecute(intent.to, 0n, intent.data!) },
      this.chainId,
      ENTRYPOINT_V07_ADDRESS,
    );
  }

  /**
   * Get the smart account address
   */
  async getAccountAddress(): Promise<Address> {
    return this.signer.getAddress();
  }

  /**
   * Check if the smart account is deployed
   */
  async isAccountDeployed(): Promise<boolean> {
    return this.signer.isDeployed();
  }

  /**
   * Build call data for a simple ERC20 transfer
   */
  private buildTransferCallData(params: GaslessPaymentParams): Hex {
    return encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [params.to, params.amount],
    });
  }

  /**
   * Build call data for an authorized transfer (EIP-3009)
   */
  private buildAuthorizedTransferCallData(params: GaslessPaymentParams): Hex {
    if (!params.authorization) {
      throw new Error("Authorization required for authorized transfer");
    }

    // Parse the signature
    const sig = params.authorization.signature;
    const r = `0x${sig.slice(2, 66)}` as Hex;
    const s = `0x${sig.slice(66, 130)}` as Hex;
    const v = parseInt(sig.slice(130, 132), 16);

    return encodeFunctionData({
      abi: EIP3009_TRANSFER_ABI,
      functionName: "transferWithAuthorization",
      args: [
        params.to, // from (will be overwritten by smart account)
        params.to,
        params.amount,
        params.authorization.validAfter,
        params.authorization.validBefore,
        params.authorization.nonce,
        v,
        r,
        s,
      ],
    });
  }

  /**
   * Estimate gas for a single transaction
   */
  private async estimateGas(intent: TransactionIntent): Promise<GasEstimate> {
    const sender = await this.signer.getAddress();
    const callData = this.signer.encodeExecute(
      intent.to,
      intent.value ?? 0n,
      intent.data ?? "0x",
    );

    try {
      return await this.bundler.estimateUserOperationGas({
        sender,
        callData,
      });
    } catch {
      // Return defaults if estimation fails
      return {
        verificationGasLimit: 150000n,
        callGasLimit: 100000n,
        preVerificationGas: 50000n,
      };
    }
  }

  /**
   * Estimate gas for a batch transaction
   */
  private async estimateBatchGas(
    intents: TransactionIntent[],
  ): Promise<GasEstimate> {
    const sender = await this.signer.getAddress();
    const callData = this.signer.encodeExecuteBatch(
      intents.map((i) => i.to),
      intents.map((i) => i.value ?? 0n),
      intents.map((i) => (i.data ?? "0x") as Hex),
    );

    try {
      return await this.bundler.estimateUserOperationGas({
        sender,
        callData,
      });
    } catch {
      // Return defaults with multiplier for batch size
      return {
        verificationGasLimit: 150000n,
        callGasLimit: 100000n * BigInt(intents.length),
        preVerificationGas: 50000n,
      };
    }
  }

  /**
   * Get paymaster data if configured
   */
  private async getPaymasterData(
    _gasEstimate: GasEstimate,
  ): Promise<
    | {
        paymaster: Address;
        paymasterVerificationGasLimit: bigint;
        paymasterPostOpGasLimit: bigint;
        paymasterData: Hex;
      }
    | undefined
  > {
    if (!this.paymaster) return undefined;

    const sender = await this.signer.getAddress();

    return this.paymaster.getPaymasterData(
      { sender },
      this.chainId,
      ENTRYPOINT_V07_ADDRESS,
    );
  }
}

/**
 * Create a GaslessT402Client instance
 */
export function createGaslessT402Client(
  config: GaslessClientConfig,
): GaslessT402Client {
  return new GaslessT402Client(config);
}
