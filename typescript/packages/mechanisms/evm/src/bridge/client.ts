/**
 * USDT0 Bridge Client
 *
 * Provides cross-chain USDT0 transfers using LayerZero OFT standard.
 *
 * @example
 * ```typescript
 * import { Usdt0Bridge } from '@t402/evm';
 * import { createWalletClient, http } from 'viem';
 * import { arbitrum } from 'viem/chains';
 *
 * const walletClient = createWalletClient({
 *   chain: arbitrum,
 *   transport: http(),
 *   account: privateKeyToAccount(privateKey),
 * });
 *
 * const bridge = new Usdt0Bridge(walletClient, 'arbitrum');
 *
 * // Get quote
 * const quote = await bridge.quote({
 *   fromChain: 'arbitrum',
 *   toChain: 'ethereum',
 *   amount: 100_000000n, // 100 USDT0
 *   recipient: '0x...',
 * });
 *
 * // Execute bridge
 * const result = await bridge.send({
 *   fromChain: 'arbitrum',
 *   toChain: 'ethereum',
 *   amount: 100_000000n,
 *   recipient: '0x...',
 * });
 * ```
 */

import type { Address } from "viem";
import { keccak256, toBytes } from "viem";
import {
  getEndpointId,
  getUsdt0OftAddress,
  supportsBridging,
  addressToBytes32,
  OFT_SEND_ABI,
  ERC20_APPROVE_ABI,
  DEFAULT_EXTRA_OPTIONS,
  getBridgeableChains,
} from "./constants.js";
import type {
  BridgeQuoteParams,
  BridgeQuote,
  BridgeExecuteParams,
  BridgeResult,
  BridgeSigner,
  SendParam,
  MessagingFee,
  TransactionReceipt,
} from "./types.js";

/**
 * OFTSent event signature for GUID extraction
 * Event: OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed from, uint256 amountSentLD, uint256 amountReceivedLD)
 */
const OFT_SENT_EVENT_TOPIC = keccak256(
  toBytes("OFTSent(bytes32,uint32,address,uint256,uint256)")
);

/**
 * Default slippage tolerance (0.5%)
 */
const DEFAULT_SLIPPAGE = 0.5;

/**
 * Estimated bridge completion time in seconds
 */
const ESTIMATED_BRIDGE_TIME = 300; // ~5 minutes

/**
 * USDT0 Bridge Client for LayerZero OFT transfers
 */
export class Usdt0Bridge {
  private readonly signer: BridgeSigner;
  private readonly chain: string;

  /**
   * Create a new bridge client
   *
   * @param signer - Wallet signer with read/write capabilities
   * @param chain - Source chain name (e.g., "arbitrum", "ethereum")
   */
  constructor(signer: BridgeSigner, chain: string) {
    if (!supportsBridging(chain)) {
      throw new Error(
        `Chain "${chain}" does not support USDT0 bridging. Supported chains: ${getBridgeableChains().join(", ")}`,
      );
    }

    this.signer = signer;
    this.chain = chain;
  }

  /**
   * Get a quote for bridging USDT0
   *
   * @param params - Bridge parameters
   * @returns Quote with fee and amount information
   */
  async quote(params: BridgeQuoteParams): Promise<BridgeQuote> {
    this.validateBridgeParams(params);

    const sendParam = this.buildSendParam(params);
    const oftAddress = getUsdt0OftAddress(params.fromChain)!;

    // Get quote from contract
    const fee = (await this.signer.readContract({
      address: oftAddress,
      abi: OFT_SEND_ABI,
      functionName: "quoteSend",
      args: [sendParam, false],
    })) as MessagingFee;

    return {
      nativeFee: fee.nativeFee,
      amountToSend: params.amount,
      minAmountToReceive: sendParam.minAmountLD,
      estimatedTime: ESTIMATED_BRIDGE_TIME,
      fromChain: params.fromChain,
      toChain: params.toChain,
    };
  }

  /**
   * Execute a bridge transaction
   *
   * @param params - Bridge execution parameters
   * @returns Bridge result with transaction hash
   */
  async send(params: BridgeExecuteParams): Promise<BridgeResult> {
    this.validateBridgeParams(params);

    const oftAddress = getUsdt0OftAddress(params.fromChain)!;
    const sendParam = this.buildSendParam(params);
    const refundAddress = params.refundAddress ?? this.signer.address;

    // Get fee quote
    const fee = (await this.signer.readContract({
      address: oftAddress,
      abi: OFT_SEND_ABI,
      functionName: "quoteSend",
      args: [sendParam, false],
    })) as MessagingFee;

    // Check and approve allowance if needed
    await this.ensureAllowance(oftAddress, params.amount);

    // Execute bridge transaction
    const txHash = await this.signer.writeContract({
      address: oftAddress,
      abi: OFT_SEND_ABI,
      functionName: "send",
      args: [sendParam, fee, refundAddress],
      value: fee.nativeFee,
    });

    // Wait for transaction confirmation
    const receipt = await this.signer.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      throw new Error(`Bridge transaction failed: ${txHash}`);
    }

    // Extract message GUID from OFTSent event logs
    const messageGuid = this.extractMessageGuid(receipt);

    return {
      txHash,
      messageGuid,
      amountSent: params.amount,
      amountToReceive: sendParam.minAmountLD,
      fromChain: params.fromChain,
      toChain: params.toChain,
      estimatedTime: ESTIMATED_BRIDGE_TIME,
    };
  }

  /**
   * Extract LayerZero message GUID from OFTSent event logs
   *
   * @param receipt - Transaction receipt with logs
   * @returns Message GUID as hex string
   */
  private extractMessageGuid(receipt: TransactionReceipt): `0x${string}` {
    for (const log of receipt.logs) {
      // Check if this is an OFTSent event
      if (log.topics[0] === OFT_SENT_EVENT_TOPIC && log.topics[1]) {
        // GUID is the first indexed parameter (topics[1])
        return log.topics[1];
      }
    }

    throw new Error(
      "Failed to extract message GUID from transaction logs. " +
        "The OFTSent event was not found in the transaction receipt.",
    );
  }

  /**
   * Ensure sufficient token allowance for the OFT contract
   */
  private async ensureAllowance(oftAddress: Address, amount: bigint): Promise<void> {
    // Check current allowance
    const allowance = (await this.signer.readContract({
      address: oftAddress,
      abi: ERC20_APPROVE_ABI,
      functionName: "allowance",
      args: [this.signer.address, oftAddress],
    })) as bigint;

    // Approve if needed
    if (allowance < amount) {
      const approveTx = await this.signer.writeContract({
        address: oftAddress,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [oftAddress, amount],
      });

      await this.signer.waitForTransactionReceipt({ hash: approveTx });
    }
  }

  /**
   * Build SendParam struct for LayerZero
   */
  private buildSendParam(params: BridgeQuoteParams | BridgeExecuteParams): SendParam {
    const dstEid = getEndpointId(params.toChain);
    if (!dstEid) {
      throw new Error(`Unknown destination chain: ${params.toChain}`);
    }

    const slippage = "slippageTolerance" in params
      ? (params as BridgeExecuteParams).slippageTolerance ?? DEFAULT_SLIPPAGE
      : DEFAULT_SLIPPAGE;

    // Calculate minimum amount with slippage
    const minAmount = params.amount - (params.amount * BigInt(Math.floor(slippage * 100))) / 10000n;

    return {
      dstEid,
      to: addressToBytes32(params.recipient),
      amountLD: params.amount,
      minAmountLD: minAmount,
      extraOptions: DEFAULT_EXTRA_OPTIONS,
      composeMsg: "0x" as `0x${string}`,
      oftCmd: "0x" as `0x${string}`,
    };
  }

  /**
   * Validate bridge parameters
   */
  private validateBridgeParams(params: BridgeQuoteParams): void {
    if (params.fromChain !== this.chain) {
      throw new Error(
        `Source chain mismatch: bridge initialized for "${this.chain}" but got "${params.fromChain}"`,
      );
    }

    if (!supportsBridging(params.fromChain)) {
      throw new Error(`Source chain "${params.fromChain}" does not support USDT0 bridging`);
    }

    if (!supportsBridging(params.toChain)) {
      throw new Error(`Destination chain "${params.toChain}" does not support USDT0 bridging`);
    }

    if (params.fromChain === params.toChain) {
      throw new Error("Source and destination chains must be different");
    }

    if (params.amount <= 0n) {
      throw new Error("Amount must be greater than 0");
    }
  }

  /**
   * Get all supported destination chains from current chain
   */
  getSupportedDestinations(): string[] {
    return getBridgeableChains().filter((chain) => chain !== this.chain);
  }

  /**
   * Check if a destination chain is supported
   */
  supportsDestination(toChain: string): boolean {
    return toChain !== this.chain && supportsBridging(toChain);
  }
}

/**
 * Create a bridge client for a specific chain
 */
export function createUsdt0Bridge(signer: BridgeSigner, chain: string): Usdt0Bridge {
  return new Usdt0Bridge(signer, chain);
}
