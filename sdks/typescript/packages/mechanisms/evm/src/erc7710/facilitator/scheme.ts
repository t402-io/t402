/**
 * ERC-7710 Delegation Facilitator Scheme
 *
 * Enables payments from smart contract accounts (ERC-4337, ERC-7579) via
 * delegation. The facilitator calls DelegationManager.redeemDelegations()
 * to execute token transfers on behalf of the delegator.
 *
 * Verification is performed entirely through simulation (eth_call).
 */

import type { Address, Hex } from "@t402/evm-core";
import type { ExactERC7710Payload } from "@t402/evm-core";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@t402/core";

/**
 * EVM signer interface for ERC-7710 facilitator operations.
 */
export interface ERC7710Signer {
  /** Simulate a contract call (eth_call) */
  simulateContract(
    address: Address,
    abi: readonly unknown[],
    functionName: string,
    args: unknown[],
  ): Promise<unknown>;

  /** Execute a contract write transaction */
  writeContract(
    address: Address,
    abi: readonly unknown[],
    functionName: string,
    args: unknown[],
  ): Promise<Hex>;

  /** Wait for transaction confirmation */
  waitForTransaction(txHash: Hex): Promise<{ status: "success" | "reverted" }>;
}

// ERC-7579 single call mode (all zeros)
const SINGLE_CALL_MODE =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

// redeemDelegations ABI
const redeemDelegationsAbi = [
  {
    inputs: [
      { name: "_permissionContexts", type: "bytes[]" },
      { name: "_modes", type: "bytes32[]" },
      { name: "_executionCallDatas", type: "bytes[]" },
    ],
    name: "redeemDelegations",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Encode an ERC-20 transfer wrapped in ERC-7579 single execution format.
 * Format: target (20 bytes) + value (32 bytes) + calldata
 */
export function encodeERC7579Execution(
  tokenAddress: Address,
  recipient: Address,
  amount: bigint,
): Hex {
  // ERC-20 transfer(address,uint256) selector
  const selector = "a9059cbb";

  // Pad recipient address to 32 bytes
  const recipientPadded = recipient.slice(2).toLowerCase().padStart(64, "0");

  // Pad amount to 32 bytes
  const amountHex = amount.toString(16).padStart(64, "0");

  // ERC-20 calldata
  const transferCallData = selector + recipientPadded + amountHex;

  // ERC-7579 execution: target (20 bytes) + value (32 bytes, zero) + calldata
  const target = tokenAddress.slice(2).toLowerCase().padStart(40, "0");
  const value = "0".repeat(64); // no ETH

  return `0x${target}${value}${transferCallData}` as Hex;
}

/**
 *
 */
export class ERC7710FacilitatorScheme {
  private signer: ERC7710Signer;

  /**
   * Construct a facilitator scheme that delegates signing to the supplied ERC-7710 signer.
   */
  constructor(signer: ERC7710Signer) {
    this.signer = signer;
  }

  /**
   * The scheme identifier in the t402 wire format.
   */
  get scheme(): string {
    return "exact";
  }

  /**
   * CAIP-2 family the scheme handles — all EVM networks under eip155.
   */
  get caipFamily(): string {
    return "eip155:*";
  }

  /**
   * Verify an ERC-7710 delegation payment by simulating redeemDelegations.
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const erc7710Payload = payload.payload as unknown as ExactERC7710Payload;

    if (
      !erc7710Payload.delegationManager ||
      !erc7710Payload.permissionContext ||
      !erc7710Payload.delegator
    ) {
      return { isValid: false };
    }

    const executionCallData = encodeERC7579Execution(
      requirements.asset as Address,
      requirements.payTo as Address,
      BigInt(requirements.amount),
    );

    try {
      await this.signer.simulateContract(
        erc7710Payload.delegationManager,
        redeemDelegationsAbi,
        "redeemDelegations",
        [[erc7710Payload.permissionContext], [SINGLE_CALL_MODE], [executionCallData]],
      );

      return { isValid: true, payer: erc7710Payload.delegator };
    } catch {
      return { isValid: false };
    }
  }

  /**
   * Settle an ERC-7710 delegation payment by calling redeemDelegations on-chain.
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const verifyResult = await this.verify(payload, requirements);
    if (!verifyResult.isValid) {
      return {
        success: false,
        network: requirements.network,
      } as SettleResponse;
    }

    const erc7710Payload = payload.payload as unknown as ExactERC7710Payload;

    const executionCallData = encodeERC7579Execution(
      requirements.asset as Address,
      requirements.payTo as Address,
      BigInt(requirements.amount),
    );

    const txHash = await this.signer.writeContract(
      erc7710Payload.delegationManager,
      redeemDelegationsAbi,
      "redeemDelegations",
      [[erc7710Payload.permissionContext], [SINGLE_CALL_MODE], [executionCallData]],
    );

    const receipt = await this.signer.waitForTransaction(txHash);

    if (receipt.status !== "success") {
      return {
        success: false,
        transaction: txHash,
        network: requirements.network,
        payer: erc7710Payload.delegator,
      } as SettleResponse;
    }

    return {
      success: true,
      transaction: txHash,
      network: requirements.network,
      payer: erc7710Payload.delegator,
    } as SettleResponse;
  }
}
