import {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import { getAddress } from "viem";
import { FacilitatorEvmSigner } from "../../signer";
import { Permit2ProxyPayloadV2 } from "../types";
import {
  PERMIT2_ADDRESS,
  SCHEME_PERMIT2_PROXY,
  T402_EXACT_PERMIT2_PROXY,
  T402_UPTO_PERMIT2_PROXY,
  erc20BalanceABI,
  permit2ProxyExactABI,
} from "../constants";

/**
 * Configuration for Permit2 Proxy EVM facilitator
 */
export interface Permit2ProxyEvmSchemeConfig {
  [key: string]: unknown;
  /** Override exact proxy contract address */
  exactProxyAddress?: `0x${string}`;
  /** Override upto proxy contract address */
  uptoProxyAddress?: `0x${string}`;
}

/**
 * EVM facilitator implementation for the Permit2 Proxy payment scheme.
 *
 * Verifies Permit2 witness-based signatures and settles payments by calling
 * settle() on the T402 proxy contracts.
 */
export class Permit2ProxyEvmScheme implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_PERMIT2_PROXY;
  readonly caipFamily = "eip155:*";
  private exactProxyAddress: `0x${string}`;
  private uptoProxyAddress: `0x${string}`;

  /**
   * Creates a new Permit2 Proxy facilitator instance.
   *
   * @param signer - The facilitator EVM signer
   * @param config - Optional configuration
   */
  constructor(
    private readonly signer: FacilitatorEvmSigner,
    config: Permit2ProxyEvmSchemeConfig = {},
  ) {
    this.exactProxyAddress = config.exactProxyAddress || T402_EXACT_PERMIT2_PROXY;
    this.uptoProxyAddress = config.uptoProxyAddress || T402_UPTO_PERMIT2_PROXY;
  }

  /**
   * Get mechanism-specific extra data for supported kinds.
   *
   * @param _ - The network identifier
   * @returns Extra data including proxy contract addresses
   */
  getExtra(_: string): Record<string, unknown> | undefined {
    return {
      permit2Address: PERMIT2_ADDRESS,
      exactProxyAddress: this.exactProxyAddress,
      uptoProxyAddress: this.uptoProxyAddress,
    };
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
   * Verify a Permit2 Proxy payment payload.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Verification result
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const proxyPayload = payload.payload as Permit2ProxyPayloadV2 | undefined;

    // Validate payload structure
    if (!proxyPayload?.permit?.permitted?.token || !proxyPayload?.owner || !proxyPayload?.witness) {
      return {
        isValid: false,
        invalidReason: "invalid_payload_structure",
        payer: undefined,
      };
    }

    // Verify scheme matches
    if (
      payload.accepted.scheme !== SCHEME_PERMIT2_PROXY ||
      requirements.scheme !== SCHEME_PERMIT2_PROXY
    ) {
      return {
        isValid: false,
        invalidReason: "unsupported_scheme",
        payer: proxyPayload.owner,
      };
    }

    // Verify network matches
    if (payload.accepted.network !== requirements.network) {
      return {
        isValid: false,
        invalidReason: "network_mismatch",
        payer: proxyPayload.owner,
      };
    }

    // Verify token matches
    if (getAddress(proxyPayload.permit.permitted.token) !== getAddress(requirements.asset)) {
      return {
        isValid: false,
        invalidReason: "token_mismatch",
        payer: proxyPayload.owner,
      };
    }

    // Verify witness.to matches payTo
    if (getAddress(proxyPayload.witness.to) !== getAddress(requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: "recipient_mismatch",
        payer: proxyPayload.owner,
      };
    }

    // Verify witness.facilitator is one of our signer addresses
    const signerAddresses = this.signer.getAddresses().map(a => getAddress(a));
    if (!signerAddresses.includes(getAddress(proxyPayload.witness.facilitator))) {
      return {
        isValid: false,
        invalidReason: "facilitator_mismatch",
        payer: proxyPayload.owner,
      };
    }

    // Verify deadline is in the future
    const now = Math.floor(Date.now() / 1000);
    if (BigInt(proxyPayload.permit.deadline) < BigInt(now + 6)) {
      return {
        isValid: false,
        invalidReason: "permit_expired",
        payer: proxyPayload.owner,
      };
    }

    // Verify validAfter is not in the future
    if (BigInt(proxyPayload.witness.validAfter) > BigInt(now)) {
      return {
        isValid: false,
        invalidReason: "payment_too_early",
        payer: proxyPayload.owner,
      };
    }

    // Verify amount is sufficient
    if (BigInt(proxyPayload.permit.permitted.amount) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "insufficient_permitted_amount",
        payer: proxyPayload.owner,
      };
    }

    // Check balance
    try {
      const balance = (await this.signer.readContract({
        address: getAddress(requirements.asset),
        abi: erc20BalanceABI,
        functionName: "balanceOf",
        args: [getAddress(proxyPayload.owner)],
      })) as bigint;

      if (BigInt(balance) < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_funds",
          payer: proxyPayload.owner,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        invalidReason: `balance_check_failed: ${errorMessage}`,
        payer: proxyPayload.owner,
      };
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: proxyPayload.owner,
    };
  }

  /**
   * Settle a Permit2 Proxy payment by calling settle() on the proxy contract.
   *
   * @param payload - The payment payload
   * @param requirements - The payment requirements
   * @returns Settlement result
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const proxyPayload = payload.payload as Permit2ProxyPayloadV2 | undefined;

    if (!proxyPayload?.permit?.permitted?.token || !proxyPayload?.owner || !proxyPayload?.witness) {
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
        payer: proxyPayload.owner,
      };
    }

    try {
      // Call settle on the exact proxy contract
      const proxyAddress =
        (requirements.extra?.exactProxyAddress as `0x${string}`) || this.exactProxyAddress;

      const tx = await this.signer.writeContract({
        address: proxyAddress,
        abi: permit2ProxyExactABI,
        functionName: "settle",
        args: [
          {
            permitted: {
              token: getAddress(proxyPayload.permit.permitted.token),
              amount: BigInt(proxyPayload.permit.permitted.amount),
            },
            nonce: BigInt(proxyPayload.permit.nonce),
            deadline: BigInt(proxyPayload.permit.deadline),
          },
          getAddress(proxyPayload.owner),
          {
            to: getAddress(proxyPayload.witness.to),
            facilitator: getAddress(proxyPayload.witness.facilitator),
            validAfter: BigInt(proxyPayload.witness.validAfter),
          },
          proxyPayload.signature,
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
          payer: proxyPayload.owner,
        };
      }

      return {
        success: true,
        transaction: tx,
        network: payload.accepted.network,
        payer: proxyPayload.owner,
      };
    } catch (error) {
      console.error("Failed to settle Permit2 Proxy transaction:", error);
      return {
        success: false,
        errorReason: "transaction_failed",
        transaction: "",
        network: payload.accepted.network,
        payer: proxyPayload.owner,
      };
    }
  }
}
