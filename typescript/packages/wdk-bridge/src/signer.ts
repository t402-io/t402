/**
 * WDK Bridge Signer
 *
 * Wraps a WDK account to implement the BridgeSigner interface
 * required by the Usdt0Bridge client.
 */

import type { Address, Hex, PublicClient } from "viem";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  decodeFunctionResult,
} from "viem";
import * as chains from "viem/chains";
import type { BridgeSigner, TransactionReceipt, TransactionLog } from "@t402/evm";
import type { WdkAccount } from "./types.js";
import { getChainId } from "./constants.js";

// Import specific chain types
type ChainConfig = typeof chains.mainnet | typeof chains.arbitrum;

/**
 * Map chain names to viem chain configs
 */
const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: chains.mainnet,
  arbitrum: chains.arbitrum,
  // Add other chains as needed
};

/**
 * WDK Bridge Signer
 *
 * Adapts a WDK account to work with the Usdt0Bridge client.
 */
export class WdkBridgeSigner implements BridgeSigner {
  private readonly wdkAccount: WdkAccount;
  private readonly chainName: string;
  private readonly publicClient: PublicClient;
  private cachedAddress?: Address;

  readonly address: Address;

  constructor(
    wdkAccount: WdkAccount,
    chainName: string,
    rpcUrl?: string,
  ) {
    this.wdkAccount = wdkAccount;
    this.chainName = chainName.toLowerCase();

    // Create public client for the chain
    const chainConfig = CHAIN_CONFIGS[this.chainName];
    const chainId = getChainId(this.chainName);

    this.publicClient = createPublicClient({
      chain: chainConfig ?? {
        id: chainId ?? 1,
        name: chainName,
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: {
          default: { http: [rpcUrl ?? ""] },
        },
      },
      transport: http(rpcUrl),
    });

    // Address will be set during initialization
    this.address = "0x0000000000000000000000000000000000000000" as Address;
  }

  /**
   * Initialize the signer (fetch WDK address)
   */
  async initialize(): Promise<void> {
    if (!this.cachedAddress) {
      const address = await this.wdkAccount.getAddress();
      this.cachedAddress = address as Address;
      // Update the readonly address via type assertion
      (this as { address: Address }).address = this.cachedAddress;
    }
  }

  /**
   * Read contract state
   */
  async readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown> {
    return this.publicClient.readContract({
      address: args.address,
      abi: args.abi as readonly unknown[],
      functionName: args.functionName,
      args: args.args as readonly unknown[],
    });
  }

  /**
   * Write to contract via WDK account
   */
  async writeContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
    value?: bigint;
  }): Promise<Hex> {
    await this.initialize();

    // Encode the function call
    const data = encodeFunctionData({
      abi: args.abi as readonly unknown[],
      functionName: args.functionName,
      args: args.args as readonly unknown[],
    });

    // Send transaction via WDK
    const txHash = await this.wdkAccount.sendTransaction({
      to: args.address,
      value: args.value,
      data,
    });

    return txHash as Hex;
  }

  /**
   * Wait for transaction receipt
   */
  async waitForTransactionReceipt(args: {
    hash: Hex;
  }): Promise<TransactionReceipt> {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: args.hash,
    });

    // Convert to our TransactionReceipt type
    const logs: TransactionLog[] = receipt.logs.map((log) => ({
      address: log.address,
      topics: log.topics as readonly Hex[],
      data: log.data,
    }));

    return {
      status: receipt.status === "success" ? "success" : "reverted",
      transactionHash: receipt.transactionHash,
      logs,
    };
  }

  /**
   * Get the WDK account's address
   */
  async getAddress(): Promise<Address> {
    await this.initialize();
    return this.cachedAddress!;
  }

  /**
   * Get native balance
   */
  async getNativeBalance(): Promise<bigint> {
    return this.wdkAccount.getBalance();
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAddress: Address): Promise<bigint> {
    return this.wdkAccount.getTokenBalance(tokenAddress);
  }
}

/**
 * Create a WDK bridge signer
 */
export async function createWdkBridgeSigner(
  wdkAccount: WdkAccount,
  chainName: string,
  rpcUrl?: string,
): Promise<WdkBridgeSigner> {
  const signer = new WdkBridgeSigner(wdkAccount, chainName, rpcUrl);
  await signer.initialize();
  return signer;
}
