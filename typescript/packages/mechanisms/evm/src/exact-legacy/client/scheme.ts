import { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@t402/core/types";
import { getAddress } from "viem";
import { legacyAuthorizationTypes } from "../../constants.js";
import { ClientEvmSigner } from "../../signer.js";
import { ExactLegacyPayload } from "../../types.js";
import { createNonce } from "../../utils.js";

/**
 * EVM client implementation for the exact-legacy payment scheme.
 * Used for legacy tokens (like USDT) that don't support EIP-3009.
 *
 * This scheme uses the approve + transferFrom pattern:
 * 1. Client must first approve the facilitator to spend tokens
 * 2. Client signs an authorization message
 * 3. Facilitator verifies the signature and calls transferFrom
 *
 * Note: The client must have already approved the facilitator (spender)
 * for at least the payment amount before creating a payment payload.
 */
export class ExactLegacyEvmScheme implements SchemeNetworkClient {
  readonly scheme = "exact-legacy";

  /**
   * Creates a new ExactLegacyEvmScheme instance.
   *
   * @param signer - The EVM signer for client operations
   */
  constructor(private readonly signer: ClientEvmSigner) {}

  /**
   * Creates a payment payload for the exact-legacy scheme.
   *
   * @param t402Version - The t402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    // Validate that we have the spender (facilitator) address
    if (!paymentRequirements.extra?.spender) {
      throw new Error(
        "exact-legacy scheme requires 'spender' (facilitator address) in payment requirements extra field",
      );
    }

    const spender = getAddress(paymentRequirements.extra.spender as string);
    const nonce = createNonce();
    const now = Math.floor(Date.now() / 1000);

    const authorization: ExactLegacyPayload["authorization"] = {
      from: this.signer.address,
      to: getAddress(paymentRequirements.payTo),
      value: paymentRequirements.amount,
      validAfter: (now - 600).toString(), // 10 minutes before
      validBefore: (now + paymentRequirements.maxTimeoutSeconds).toString(),
      nonce,
      spender,
    };

    // Sign the authorization
    const signature = await this.signAuthorization(authorization, paymentRequirements);

    const payload: ExactLegacyPayload = {
      authorization,
      signature,
    };

    return {
      t402Version,
      payload,
    };
  }

  /**
   * Sign the legacy transfer authorization using EIP-712
   *
   * @param authorization - The authorization to sign
   * @param requirements - The payment requirements
   * @returns Promise resolving to the signature
   */
  private async signAuthorization(
    authorization: ExactLegacyPayload["authorization"],
    requirements: PaymentRequirements,
  ): Promise<`0x${string}`> {
    const chainId = parseInt(requirements.network.split(":")[1]);

    // For legacy tokens, we use a simple domain with the token address
    // The name and version can be provided in extra, or we use defaults
    const name = (requirements.extra?.name as string) || "T402LegacyTransfer";
    const version = (requirements.extra?.version as string) || "1";

    const domain = {
      name,
      version,
      chainId,
      verifyingContract: getAddress(requirements.asset),
    };

    const message = {
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
      spender: getAddress(authorization.spender),
    };

    return await this.signer.signTypedData({
      domain,
      types: legacyAuthorizationTypes,
      primaryType: "LegacyTransferAuthorization",
      message,
    });
  }
}
