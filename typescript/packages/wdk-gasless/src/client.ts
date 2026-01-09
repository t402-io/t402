/**
 * WDK Gasless Client
 *
 * High-level client for executing gasless USDT0 payments using
 * Tether WDK accounts and ERC-4337 Account Abstraction.
 */

import type { Address, Hex, PublicClient } from "viem";
import { encodeFunctionData, parseUnits, formatUnits } from "viem";
import {
  BundlerClient,
  PaymasterClient,
  UserOpBuilder,
  ENTRYPOINT_V07_ADDRESS,
} from "@t402/evm";
import type {
  SmartAccountSigner,
  BundlerConfig,
  PaymasterConfig,
  TransactionIntent,
  GasEstimate,
  PaymasterData,
} from "@t402/evm";
import type {
  WdkGaslessClientConfig,
  GaslessPaymentParams,
  BatchPaymentParams,
  GaslessPaymentResult,
  GaslessPaymentReceipt,
  SponsorshipInfo,
  WdkAccount,
} from "./types.js";
import { WdkSmartAccount, createWdkSmartAccount } from "./account.js";
import { getTokenAddress, getChainName } from "./constants.js";

/**
 * ERC20 transfer ABI
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
 * ERC20 balanceOf ABI
 */
const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * WDK Gasless Client
 *
 * Provides a simple API for executing gasless USDT0 payments using
 * WDK accounts and ERC-4337 smart accounts.
 */
export class WdkGaslessClient {
  private readonly signer: SmartAccountSigner;
  private readonly builder: UserOpBuilder;
  private readonly bundler: BundlerClient;
  private readonly paymaster?: PaymasterClient;
  private readonly chainId: number;
  private readonly publicClient: PublicClient;
  private readonly chainName: string;

  constructor(config: WdkGaslessClientConfig) {
    this.signer = config.signer;
    this.builder = new UserOpBuilder();
    this.bundler = new BundlerClient(config.bundler);
    this.paymaster = config.paymaster
      ? new PaymasterClient(config.paymaster)
      : undefined;
    this.chainId = config.chainId;
    this.publicClient = config.publicClient;
    this.chainName = getChainName(config.chainId);
  }

  /**
   * Execute a gasless payment
   *
   * Sends USDT0 (or other tokens) without the user paying gas fees.
   * Gas is sponsored by a paymaster if configured.
   */
  async pay(params: GaslessPaymentParams): Promise<GaslessPaymentResult> {
    const token = params.token ?? "USDT0";
    const tokenAddress = getTokenAddress(token, this.chainName);

    // Build the transfer call data
    const callData = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [params.to, params.amount],
    });

    // Create the transaction intent
    const intent: TransactionIntent = {
      to: tokenAddress,
      value: 0n,
      data: callData,
    };

    // Estimate gas
    const gasEstimate = await this.estimateGas(intent);

    // Get paymaster data if configured
    const paymasterData = await this.getPaymasterData(gasEstimate);
    const sponsored = paymasterData !== undefined;

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
    const result = await this.bundler.sendUserOperation(signedUserOp);
    const sender = await this.signer.getAddress();

    return {
      userOpHash: result.userOpHash,
      sender,
      sponsored,
      wait: async (): Promise<GaslessPaymentReceipt> => {
        const receipt = await result.wait();
        return {
          userOpHash: receipt.userOpHash,
          txHash: receipt.receipt.transactionHash,
          blockNumber: receipt.receipt.blockNumber,
          success: receipt.success,
          gasUsed: receipt.actualGasUsed,
          gasCost: receipt.actualGasCost,
          reason: receipt.reason,
        };
      },
    };
  }

  /**
   * Execute multiple payments in a single transaction
   *
   * More gas efficient than individual payments.
   * All payments are executed atomically.
   */
  async payBatch(params: BatchPaymentParams): Promise<GaslessPaymentResult> {
    // Build transaction intents for all payments
    const intents: TransactionIntent[] = params.payments.map((payment) => {
      const token = payment.token ?? "USDT0";
      const tokenAddress = getTokenAddress(token, this.chainName);

      return {
        to: tokenAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [payment.to, payment.amount],
        }),
      };
    });

    // Estimate gas for batch
    const gasEstimate = await this.estimateBatchGas(intents);

    // Get paymaster data
    const paymasterData = await this.getPaymasterData(gasEstimate);
    const sponsored = paymasterData !== undefined;

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

    const result = await this.bundler.sendUserOperation(signedUserOp);
    const sender = await this.signer.getAddress();

    return {
      userOpHash: result.userOpHash,
      sender,
      sponsored,
      wait: async (): Promise<GaslessPaymentReceipt> => {
        const receipt = await result.wait();
        return {
          userOpHash: receipt.userOpHash,
          txHash: receipt.receipt.transactionHash,
          blockNumber: receipt.receipt.blockNumber,
          success: receipt.success,
          gasUsed: receipt.actualGasUsed,
          gasCost: receipt.actualGasCost,
          reason: receipt.reason,
        };
      },
    };
  }

  /**
   * Check if a payment can be sponsored (free gas)
   */
  async canSponsor(params: GaslessPaymentParams): Promise<SponsorshipInfo> {
    if (!this.paymaster) {
      return {
        canSponsor: false,
        reason: "No paymaster configured",
      };
    }

    const token = params.token ?? "USDT0";
    const tokenAddress = getTokenAddress(token, this.chainName);

    const callData = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [params.to, params.amount],
    });

    const sender = await this.signer.getAddress();
    const encodedCallData = this.signer.encodeExecute(tokenAddress, 0n, callData);

    try {
      const canSponsor = await this.paymaster.willSponsor(
        { sender, callData: encodedCallData },
        this.chainId,
        ENTRYPOINT_V07_ADDRESS,
      );

      if (canSponsor) {
        return { canSponsor: true };
      } else {
        // Estimate gas cost if not sponsored
        const intent: TransactionIntent = {
          to: tokenAddress,
          value: 0n,
          data: callData,
        };
        const gasEstimate = await this.estimateGas(intent);
        const gasPrice = await this.publicClient.getGasPrice();
        const estimatedGasCost =
          (gasEstimate.verificationGasLimit +
            gasEstimate.callGasLimit +
            gasEstimate.preVerificationGas) *
          gasPrice;

        return {
          canSponsor: false,
          reason: "Payment not eligible for sponsorship",
          estimatedGasCost,
        };
      }
    } catch (error) {
      return {
        canSponsor: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      };
    }
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
   * Get the token balance of the smart account
   */
  async getBalance(token: "USDT0" | "USDC" | Address = "USDT0"): Promise<bigint> {
    const tokenAddress = getTokenAddress(token, this.chainName);
    const accountAddress = await this.signer.getAddress();

    const balance = await this.publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [accountAddress],
    });

    return balance as bigint;
  }

  /**
   * Get the formatted token balance
   */
  async getFormattedBalance(
    token: "USDT0" | "USDC" | Address = "USDT0",
    decimals = 6,
  ): Promise<string> {
    const balance = await this.getBalance(token);
    return formatUnits(balance, decimals);
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
  ): Promise<PaymasterData | undefined> {
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
 * Configuration for creating a WDK gasless client
 */
export interface CreateWdkGaslessClientConfig {
  /** WDK account to use as the signer */
  wdkAccount: WdkAccount;
  /** Public client for chain interactions */
  publicClient: PublicClient;
  /** Chain ID */
  chainId: number;
  /** Bundler configuration */
  bundler: BundlerConfig;
  /** Optional paymaster for gas sponsorship */
  paymaster?: PaymasterConfig;
  /** Salt nonce for address generation (defaults to 0) */
  saltNonce?: bigint;
}

/**
 * Create a WDK gasless client
 *
 * This is the main entry point for using WDK with gasless payments.
 *
 * @example
 * ```typescript
 * import { createWdkGaslessClient } from '@t402/wdk-gasless';
 *
 * const client = await createWdkGaslessClient({
 *   wdkAccount: myWdkAccount,
 *   publicClient,
 *   chainId: 42161, // Arbitrum
 *   bundler: {
 *     bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=...',
 *     chainId: 42161,
 *   },
 *   paymaster: {
 *     address: '0x...',
 *     url: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=...',
 *     type: 'sponsoring',
 *   },
 * });
 *
 * // Execute gasless payment
 * const result = await client.pay({
 *   to: '0x...',
 *   amount: 1000000n, // 1 USDT0
 * });
 *
 * const receipt = await result.wait();
 * console.log('Payment confirmed:', receipt.txHash);
 * ```
 */
export async function createWdkGaslessClient(
  config: CreateWdkGaslessClientConfig,
): Promise<WdkGaslessClient> {
  // Create the WDK smart account
  const smartAccount = await createWdkSmartAccount({
    wdkAccount: config.wdkAccount,
    publicClient: config.publicClient,
    chainId: config.chainId,
    saltNonce: config.saltNonce,
  });

  // Create the gasless client
  return new WdkGaslessClient({
    signer: smartAccount,
    bundler: config.bundler,
    paymaster: config.paymaster,
    chainId: config.chainId,
    publicClient: config.publicClient,
  });
}
