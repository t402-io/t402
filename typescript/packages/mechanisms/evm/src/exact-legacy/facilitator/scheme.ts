import {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import { getAddress, isAddressEqual } from "viem";
import { legacyAuthorizationTypes, erc20LegacyABI } from "../../constants.js";
import { FacilitatorEvmSigner } from "../../signer.js";
import { ExactLegacyPayload } from "../../types.js";

export interface ExactLegacyEvmSchemeConfig {
  /**
   * Minimum allowance ratio required (0.0 to 1.0)
   * If the allowance is less than this ratio of the payment amount,
   * verification will fail.
   *
   * @default 1.0 (exact allowance required)
   */
  minAllowanceRatio?: number;
}

/**
 * EVM facilitator implementation for the exact-legacy payment scheme.
 * Uses the approve + transferFrom pattern for legacy tokens.
 */
export class ExactLegacyEvmScheme implements SchemeNetworkFacilitator {
  readonly scheme = "exact-legacy";
  readonly caipFamily = "eip155:*";
  private readonly config: Required<ExactLegacyEvmSchemeConfig>;

  /**
   * Creates a new ExactLegacyEvmScheme instance.
   *
   * @param signer - The EVM signer for facilitator operations
   * @param config - Optional configuration
   */
  constructor(
    private readonly signer: FacilitatorEvmSigner,
    config?: ExactLegacyEvmSchemeConfig,
  ) {
    this.config = {
      minAllowanceRatio: config?.minAllowanceRatio ?? 1.0,
    };
  }

  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   * For exact-legacy, returns the spender (facilitator) addresses.
   *
   * @param network - The network identifier
   * @returns Extra data including spender addresses
   */
  getExtra(network: string): Record<string, unknown> | undefined {
    void network;
    // Return the first facilitator address as the spender
    const addresses = this.signer.getAddresses();
    if (addresses.length > 0) {
      return {
        spender: addresses[0],
        tokenType: "legacy",
      };
    }
    return { tokenType: "legacy" };
  }

  /**
   * Get signer addresses used by this facilitator.
   */
  getSigners(network: string): string[] {
    void network;
    return [...this.signer.getAddresses()];
  }

  /**
   * Verifies a payment payload.
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const legacyPayload = payload.payload as ExactLegacyPayload;

    // Verify scheme matches
    if (payload.accepted.scheme !== "exact-legacy" || requirements.scheme !== "exact-legacy") {
      return {
        isValid: false,
        invalidReason: "unsupported_scheme",
        payer: legacyPayload.authorization.from,
      };
    }

    // Verify network matches
    if (payload.accepted.network !== requirements.network) {
      return {
        isValid: false,
        invalidReason: "network_mismatch",
        payer: legacyPayload.authorization.from,
      };
    }

    const erc20Address = getAddress(requirements.asset);

    // Verify the spender is one of our addresses
    const spender = getAddress(legacyPayload.authorization.spender);
    const facilitatorAddresses = this.signer.getAddresses();
    const isValidSpender = facilitatorAddresses.some((addr) => isAddressEqual(addr, spender));

    if (!isValidSpender) {
      return {
        isValid: false,
        invalidReason: "invalid_spender",
        payer: legacyPayload.authorization.from,
      };
    }

    // Build domain for signature verification
    const name = (requirements.extra?.name as string) || "T402LegacyTransfer";
    const version = (requirements.extra?.version as string) || "1";
    const chainId = parseInt(requirements.network.split(":")[1]);

    const domain = {
      name,
      version,
      chainId,
      verifyingContract: erc20Address,
    };

    const message = {
      from: legacyPayload.authorization.from,
      to: legacyPayload.authorization.to,
      value: BigInt(legacyPayload.authorization.value),
      validAfter: BigInt(legacyPayload.authorization.validAfter),
      validBefore: BigInt(legacyPayload.authorization.validBefore),
      nonce: legacyPayload.authorization.nonce,
      spender: legacyPayload.authorization.spender,
    };

    // Verify signature
    try {
      const isValid = await this.signer.verifyTypedData({
        address: legacyPayload.authorization.from,
        domain,
        types: legacyAuthorizationTypes,
        primaryType: "LegacyTransferAuthorization",
        message,
        signature: legacyPayload.signature!,
      });

      if (!isValid) {
        return {
          isValid: false,
          invalidReason: "invalid_signature",
          payer: legacyPayload.authorization.from,
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: "signature_verification_failed",
        payer: legacyPayload.authorization.from,
      };
    }

    // Verify payment recipient matches
    if (getAddress(legacyPayload.authorization.to) !== getAddress(requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: "recipient_mismatch",
        payer: legacyPayload.authorization.from,
      };
    }

    // Verify validBefore is in the future
    const now = Math.floor(Date.now() / 1000);
    if (BigInt(legacyPayload.authorization.validBefore) < BigInt(now + 6)) {
      return {
        isValid: false,
        invalidReason: "authorization_expired",
        payer: legacyPayload.authorization.from,
      };
    }

    // Verify validAfter is not in the future
    if (BigInt(legacyPayload.authorization.validAfter) > BigInt(now)) {
      return {
        isValid: false,
        invalidReason: "authorization_not_yet_valid",
        payer: legacyPayload.authorization.from,
      };
    }

    // Check balance
    try {
      const balance = (await this.signer.readContract({
        address: erc20Address,
        abi: erc20LegacyABI,
        functionName: "balanceOf",
        args: [legacyPayload.authorization.from],
      })) as bigint;

      if (BigInt(balance) < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_balance",
          payer: legacyPayload.authorization.from,
        };
      }
    } catch {
      // If we can't check balance, continue with other validations
    }

    // Check allowance
    try {
      const allowance = (await this.signer.readContract({
        address: erc20Address,
        abi: erc20LegacyABI,
        functionName: "allowance",
        args: [legacyPayload.authorization.from, spender],
      })) as bigint;

      const requiredAllowance = BigInt(
        Math.floor(Number(requirements.amount) * this.config.minAllowanceRatio),
      );

      if (allowance < requiredAllowance) {
        return {
          isValid: false,
          invalidReason: "insufficient_allowance",
          payer: legacyPayload.authorization.from,
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: "allowance_check_failed",
        payer: legacyPayload.authorization.from,
      };
    }

    // Verify amount is sufficient
    if (BigInt(legacyPayload.authorization.value) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "insufficient_amount",
        payer: legacyPayload.authorization.from,
      };
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: legacyPayload.authorization.from,
    };
  }

  /**
   * Settles a payment by executing transferFrom.
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const legacyPayload = payload.payload as ExactLegacyPayload;

    // Re-verify before settling
    const valid = await this.verify(payload, requirements);
    if (!valid.isValid) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: valid.invalidReason ?? "invalid_payment",
        payer: legacyPayload.authorization.from,
      };
    }

    try {
      // Execute transferFrom
      const tx = await this.signer.writeContract({
        address: getAddress(requirements.asset),
        abi: erc20LegacyABI,
        functionName: "transferFrom",
        args: [
          getAddress(legacyPayload.authorization.from),
          getAddress(legacyPayload.authorization.to),
          BigInt(legacyPayload.authorization.value),
        ],
      });

      // Wait for transaction confirmation
      const receipt = await this.signer.waitForTransactionReceipt({ hash: tx });

      if (receipt.status !== "success") {
        return {
          success: false,
          errorReason: "transaction_failed",
          transaction: tx,
          network: payload.accepted.network,
          payer: legacyPayload.authorization.from,
        };
      }

      return {
        success: true,
        transaction: tx,
        network: payload.accepted.network,
        payer: legacyPayload.authorization.from,
      };
    } catch (error) {
      console.error("Failed to settle legacy transaction:", error);
      return {
        success: false,
        errorReason: "settlement_failed",
        transaction: "",
        network: payload.accepted.network,
        payer: legacyPayload.authorization.from,
      };
    }
  }
}
