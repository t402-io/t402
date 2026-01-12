/**
 * WDK Multi-sig Gasless Client
 *
 * High-level client for executing gasless multi-sig payments using
 * Tether WDK accounts and ERC-4337 Account Abstraction.
 */

import type { Address, Hex, PublicClient } from "viem";
import { encodeFunctionData, formatUnits } from "viem";
import {
  BundlerClient,
  PaymasterClient,
  UserOpBuilder,
  ENTRYPOINT_V07_ADDRESS,
} from "@t402/evm";
import type {
  BundlerConfig,
  PaymasterConfig,
  TransactionIntent,
  GasEstimate,
  PaymasterData,
  UserOperation,
} from "@t402/evm";
import type { WDKSigner } from "@t402/wdk";
import type {
  MultiSigGaslessClientConfig,
  MultiSigSmartAccountSigner,
  MultiSigPaymentResult,
  MultiSigSubmitResult,
  GaslessPaymentParams,
  BatchPaymentParams,
  GaslessPaymentReceipt,
  PendingSignature,
} from "./types.js";
import { MultiSigWdkSmartAccount } from "./account.js";
import { SignatureCollector } from "./collector.js";
import { MultiSigError } from "./errors.js";

/**
 * Token addresses by chain
 */
const TOKEN_ADDRESSES: Record<string, Record<string, Address>> = {
  USDT0: {
    ethereum: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    ink: "0x0200C29006150606B650577BBE7B6248F58470c1",
    berachain: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    unichain: "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
    base: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    optimism: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  },
  USDC: {
    ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },
};

/**
 * Chain IDs
 */
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
  polygon: 137,
  ink: 57073,
  berachain: 80084,
  unichain: 130,
};

/**
 * ERC20 ABI fragments
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

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function getChainName(chainId: number): string {
  const entry = Object.entries(CHAIN_IDS).find(([, id]) => id === chainId);
  if (!entry) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return entry[0];
}

function getTokenAddress(
  token: "USDT0" | "USDC" | Address,
  chainName: string,
): Address {
  if (token.startsWith("0x")) {
    return token as Address;
  }

  const addresses = TOKEN_ADDRESSES[token];
  if (!addresses) {
    throw new Error(`Unknown token: ${token}`);
  }

  const address = addresses[chainName.toLowerCase()];
  if (!address) {
    throw new Error(`Token ${token} not available on ${chainName}`);
  }

  return address;
}

/**
 * Multi-sig WDK Gasless Client
 *
 * Provides a simple API for executing gasless multi-sig payments using
 * WDK accounts and ERC-4337 smart accounts.
 */
export class MultiSigWdkGaslessClient {
  private readonly signer: MultiSigSmartAccountSigner;
  private readonly builder: UserOpBuilder;
  private readonly bundler: BundlerClient;
  private readonly paymaster?: PaymasterClient;
  private readonly chainId: number;
  private readonly publicClient: PublicClient;
  private readonly chainName: string;
  private readonly collector: SignatureCollector;

  constructor(config: MultiSigGaslessClientConfig) {
    this.signer = config.signer;
    this.builder = new UserOpBuilder();
    this.bundler = new BundlerClient(config.bundler);
    this.paymaster = config.paymaster
      ? new PaymasterClient(config.paymaster)
      : undefined;
    this.chainId = config.chainId;
    this.publicClient = config.publicClient;
    this.chainName = getChainName(config.chainId);
    this.collector = new SignatureCollector();
  }

  /**
   * Initiate a multi-sig payment
   *
   * Creates a transaction request that needs to be signed by threshold owners.
   * Returns a MultiSigPaymentResult with methods to add signatures and submit.
   */
  async initiatePayment(params: GaslessPaymentParams): Promise<MultiSigPaymentResult> {
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

    return this.initiateTransaction(intent);
  }

  /**
   * Initiate a batch payment request
   */
  async initiateBatchPayment(params: BatchPaymentParams): Promise<MultiSigPaymentResult> {
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

    return this.initiateTransaction(intents);
  }

  /**
   * Internal: Create transaction request from intent(s)
   */
  private async initiateTransaction(
    intentsOrIntent: TransactionIntent | TransactionIntent[],
  ): Promise<MultiSigPaymentResult> {
    const intents = Array.isArray(intentsOrIntent) ? intentsOrIntent : [intentsOrIntent];
    const isBatch = intents.length > 1;

    // Estimate gas
    const firstIntent = intents[0]!;
    const gasEstimate = isBatch
      ? await this.estimateBatchGas(intents)
      : await this.estimateGas(firstIntent);

    // Get paymaster data if configured
    const paymasterData = await this.getPaymasterData(gasEstimate);
    const sponsored = paymasterData !== undefined;

    // Build the UserOperation (unsigned)
    let userOp: UserOperation;
    if (isBatch) {
      userOp = await this.builder.buildBatchUserOp(
        this.signer,
        intents,
        this.publicClient,
        gasEstimate,
        paymasterData,
      );
    } else {
      userOp = await this.builder.buildUserOp(
        this.signer,
        firstIntent,
        this.publicClient,
        gasEstimate,
        paymasterData,
      );
    }

    // Get the UserOperation hash
    const userOpHash = await this.builder.getUserOpHash(
      userOp,
      this.publicClient,
      this.chainId,
    );

    // Create signature collection request
    const owners = this.signer.getOwners();
    const threshold = this.signer.getThreshold();
    const request = this.collector.createRequest(userOp, userOpHash, owners, threshold);
    const sender = await this.signer.getAddress();

    // Return result with methods for adding signatures and submitting
    return {
      requestId: request.id,
      sender,
      userOpHash,
      sponsored,
      signatures: request.signatures,
      threshold,
      collectedCount: 0,
      isReady: false,
      addSignature: async (ownerIndex: number, signer: WDKSigner) => {
        await this.signWithOwner(request.id, ownerIndex, signer);
      },
      submit: async () => {
        return this.submitRequest(request.id);
      },
    };
  }

  /**
   * Add a signature from a specific owner
   */
  async signWithOwner(
    requestId: string,
    ownerIndex: number,
    signer: WDKSigner,
  ): Promise<void> {
    const request = this.collector.getRequest(requestId);
    if (!request) {
      throw MultiSigError.requestNotFound(requestId);
    }

    // Sign the UserOperation hash
    if (!signer.isInitialized) {
      await signer.initialize();
    }

    const signature = await this.signer.signWithOwner(request.userOpHash, ownerIndex);

    // Add to collector
    const owners = this.signer.getOwners();
    const ownerAddress = owners[ownerIndex];
    if (!ownerAddress) {
      throw MultiSigError.ownerNotFound(ownerIndex);
    }
    this.collector.addSignature(requestId, ownerAddress, signature);
  }

  /**
   * Submit a request when threshold signatures are collected
   */
  async submitRequest(requestId: string): Promise<MultiSigSubmitResult> {
    const request = this.collector.getRequest(requestId);
    if (!request) {
      throw MultiSigError.requestNotFound(requestId);
    }

    if (!request.isReady) {
      throw MultiSigError.notReady(request.threshold, request.collectedCount);
    }

    // Get combined signature
    const combinedSignature = this.collector.getCombinedSignature(requestId);

    // Create signed UserOperation
    const signedUserOp = {
      ...request.userOp,
      signature: combinedSignature,
    };

    // Submit to bundler
    const result = await this.bundler.sendUserOperation(signedUserOp);
    const sender = await this.signer.getAddress();

    // Clean up the request
    this.collector.removeRequest(requestId);

    return {
      userOpHash: result.userOpHash,
      sender,
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
   * Execute a payment with all available signers
   *
   * Convenience method that collects signatures from all provided signers
   * and submits in one operation. Useful when all signers are available locally.
   */
  async payWithAllSigners(
    params: GaslessPaymentParams,
    signers: WDKSigner[],
  ): Promise<MultiSigSubmitResult> {
    // Initiate the payment
    const result = await this.initiatePayment(params);

    // Sign with each provided signer
    const owners = this.signer.getOwners();
    let signaturesCollected = 0;

    for (const signer of signers) {
      if (!signer.isInitialized) {
        await signer.initialize();
      }

      // Find owner index for this signer
      const ownerIndex = owners.findIndex(
        (o) => o.toLowerCase() === signer.address.toLowerCase(),
      );

      if (ownerIndex >= 0) {
        await this.signWithOwner(result.requestId, ownerIndex, signer);
        signaturesCollected++;

        // Stop if we have enough signatures
        if (signaturesCollected >= result.threshold) {
          break;
        }
      }
    }

    // Check if we collected enough
    const request = this.collector.getRequest(result.requestId);
    if (!request?.isReady) {
      throw MultiSigError.thresholdNotMet(result.threshold, signaturesCollected);
    }

    // Submit
    return this.submitRequest(result.requestId);
  }

  /**
   * Execute a batch payment with all available signers
   */
  async payBatchWithAllSigners(
    params: BatchPaymentParams,
    signers: WDKSigner[],
  ): Promise<MultiSigSubmitResult> {
    // Initiate the batch payment
    const result = await this.initiateBatchPayment(params);

    // Sign with each provided signer
    const owners = this.signer.getOwners();
    let signaturesCollected = 0;

    for (const signer of signers) {
      if (!signer.isInitialized) {
        await signer.initialize();
      }

      // Find owner index for this signer
      const ownerIndex = owners.findIndex(
        (o) => o.toLowerCase() === signer.address.toLowerCase(),
      );

      if (ownerIndex >= 0) {
        await this.signWithOwner(result.requestId, ownerIndex, signer);
        signaturesCollected++;

        // Stop if we have enough signatures
        if (signaturesCollected >= result.threshold) {
          break;
        }
      }
    }

    // Check if we collected enough
    const request = this.collector.getRequest(result.requestId);
    if (!request?.isReady) {
      throw MultiSigError.thresholdNotMet(result.threshold, signaturesCollected);
    }

    // Submit
    return this.submitRequest(result.requestId);
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
   * Get all pending signature requests
   */
  getPendingRequests() {
    return this.collector.getPendingRequests();
  }

  /**
   * Get owners who haven't signed a specific request
   */
  getPendingOwners(requestId: string): Address[] {
    return this.collector.getPendingOwners(requestId);
  }

  /**
   * Get owners who have signed a specific request
   */
  getSignedOwners(requestId: string): Address[] {
    return this.collector.getSignedOwners(requestId);
  }

  /**
   * Get all owner addresses
   */
  getOwners(): Address[] {
    return this.signer.getOwners();
  }

  /**
   * Get the threshold
   */
  getThreshold(): number {
    return this.signer.getThreshold();
  }

  /**
   * Clean up expired requests
   */
  cleanup(): void {
    this.collector.cleanup();
  }

  /**
   * Estimate gas for a single transaction
   */
  private async estimateGas(intent: TransactionIntent): Promise<GasEstimate> {
    const sender = await this.signer.getAddress();
    const callData = this.signer.encodeExecute(
      intent.to,
      intent.value ?? 0n,
      intent.data ?? ("0x" as Hex),
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
  private async estimateBatchGas(intents: TransactionIntent[]): Promise<GasEstimate> {
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
