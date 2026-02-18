import {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import { getAddress } from "viem";
import { FacilitatorEvmSigner } from "../../signer";
import { Permit2PayloadV2 } from "../types";
import { PERMIT2_ADDRESS, permit2ABI, erc20BalanceABI } from "../constants";

/**
 * Configuration for Permit2 EVM facilitator
 */
export interface Permit2EvmSchemeConfig {
  [key: string]: unknown;
}

/**
 * EVM facilitator implementation for the Permit2 payment scheme.
 *
 * Verifies Permit2 signatures and settles payments by calling
 * permitTransferFrom on the Permit2 contract.
 */
export class Permit2EvmScheme implements SchemeNetworkFacilitator {
  readonly scheme = "permit2";
  readonly caipFamily = "eip155:*";

  /**
   * Creates a new Permit2 facilitator instance.
   *
   * @param signer - The facilitator EVM signer
   */
  constructor(private readonly signer: FacilitatorEvmSigner) {}

  /**
   * Get mechanism-specific extra data for supported kinds.
   *
   * @param _ - The network identifier
   * @returns Extra data including permit2 contract address
   */
  getExtra(_: string): Record<string, unknown> | undefined {
    return { permit2Address: PERMIT2_ADDRESS };
  }

  /**
   * Get signer addresses for this facilitator.
   *
   * @param _ - The network identifier
   * @returns Array of signer addresses
   */
  getSigners(_: string): string[] {
    return [...this.signer.getAddresses()];
  }

  /**
   * Verify a Permit2 payment payload.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Verification result
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const permit2Payload = payload.payload as Permit2PayloadV2 | undefined;

    // Validate payload structure
    if (!permit2Payload?.permit?.permitted?.token || !permit2Payload?.owner) {
      return {
        isValid: false,
        invalidReason: "invalid_payload_structure",
        payer: undefined,
      };
    }

    // Verify scheme matches
    if (payload.accepted.scheme !== "permit2" || requirements.scheme !== "permit2") {
      return {
        isValid: false,
        invalidReason: "unsupported_scheme",
        payer: permit2Payload.owner,
      };
    }

    // Verify network matches
    if (payload.accepted.network !== requirements.network) {
      return {
        isValid: false,
        invalidReason: "network_mismatch",
        payer: permit2Payload.owner,
      };
    }

    // Verify token matches
    if (getAddress(permit2Payload.permit.permitted.token) !== getAddress(requirements.asset)) {
      return {
        isValid: false,
        invalidReason: "token_mismatch",
        payer: permit2Payload.owner,
      };
    }

    // Verify recipient matches
    if (getAddress(permit2Payload.transferDetails.to) !== getAddress(requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: "recipient_mismatch",
        payer: permit2Payload.owner,
      };
    }

    // Verify deadline is in the future
    const now = Math.floor(Date.now() / 1000);
    if (BigInt(permit2Payload.permit.deadline) < BigInt(now + 6)) {
      return {
        isValid: false,
        invalidReason: "permit_expired",
        payer: permit2Payload.owner,
      };
    }

    // Verify amount is sufficient
    if (BigInt(permit2Payload.permit.permitted.amount) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "insufficient_permitted_amount",
        payer: permit2Payload.owner,
      };
    }

    if (BigInt(permit2Payload.transferDetails.requestedAmount) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "insufficient_requested_amount",
        payer: permit2Payload.owner,
      };
    }

    // Check balance
    try {
      const balance = (await this.signer.readContract({
        address: getAddress(requirements.asset),
        abi: erc20BalanceABI,
        functionName: "balanceOf",
        args: [getAddress(permit2Payload.owner)],
      })) as bigint;

      if (BigInt(balance) < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_funds",
          payer: permit2Payload.owner,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        invalidReason: `balance_check_failed: ${errorMessage}`,
        payer: permit2Payload.owner,
      };
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: permit2Payload.owner,
    };
  }

  /**
   * Settle a Permit2 payment by executing permitTransferFrom.
   *
   * @param payload - The payment payload
   * @param requirements - The payment requirements
   * @returns Settlement result
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const permit2Payload = payload.payload as Permit2PayloadV2 | undefined;

    if (!permit2Payload?.permit?.permitted?.token || !permit2Payload?.owner) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: "invalid_payload_structure",
        payer: undefined,
      };
    }

    // Re-verify before settling
    const valid = await this.verify(payload, requirements);
    if (!valid.isValid) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: valid.invalidReason ?? "invalid_scheme",
        payer: permit2Payload.owner,
      };
    }

    try {
      // Call permitTransferFrom on the Permit2 contract
      const tx = await this.signer.writeContract({
        address: PERMIT2_ADDRESS,
        abi: permit2ABI,
        functionName: "permitTransferFrom",
        args: [
          {
            permitted: {
              token: getAddress(permit2Payload.permit.permitted.token),
              amount: BigInt(permit2Payload.permit.permitted.amount),
            },
            nonce: BigInt(permit2Payload.permit.nonce),
            deadline: BigInt(permit2Payload.permit.deadline),
          },
          {
            to: getAddress(permit2Payload.transferDetails.to),
            requestedAmount: BigInt(permit2Payload.transferDetails.requestedAmount),
          },
          getAddress(permit2Payload.owner),
          permit2Payload.signature,
        ],
      });

      // Wait for transaction confirmation
      const receipt = await this.signer.waitForTransactionReceipt({ hash: tx });

      if (receipt.status !== "success") {
        return {
          success: false,
          errorReason: "invalid_transaction_state",
          transaction: tx,
          network: payload.accepted.network,
          payer: permit2Payload.owner,
        };
      }

      return {
        success: true,
        transaction: tx,
        network: payload.accepted.network,
        payer: permit2Payload.owner,
      };
    } catch (error) {
      console.error("Failed to settle Permit2 transaction:", error);
      return {
        success: false,
        errorReason: "transaction_failed",
        transaction: "",
        network: payload.accepted.network,
        payer: permit2Payload.owner,
      };
    }
  }
}
