import { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@t402/core/types";
import { getAddress } from "viem";
import { permitTypes, UptoEIP2612Payload, UptoEvmExtra } from "../../types";
import { ClientEvmSigner } from "../../signer";
import { createNonce } from "../../utils";

/**
 * EVM client implementation for the Up-To payment scheme.
 *
 * Uses EIP-2612 Permit to authorize up to a maximum amount,
 * enabling usage-based billing where the actual settlement
 * amount is determined by the server based on usage.
 *
 * @example
 * ```typescript
 * import { UptoEvmScheme } from "@t402/evm/upto/client";
 * import { privateKeyToAccount } from "viem/accounts";
 *
 * const signer = privateKeyToAccount(privateKey);
 * const scheme = new UptoEvmScheme(signer);
 *
 * // Client will register this with the t402 client
 * client.registerScheme("eip155:8453", scheme);
 * ```
 */
export class UptoEvmScheme implements SchemeNetworkClient {
  readonly scheme = "upto";

  /**
   * Creates a new UptoEvmScheme instance.
   *
   * @param signer - The EVM signer for client operations
   */
  constructor(private readonly signer: ClientEvmSigner) {}

  /**
   * Creates a payment payload for the Up-To scheme.
   *
   * The payload contains an EIP-2612 permit signature authorizing
   * the router contract (or facilitator) to transfer up to the
   * specified maximum amount.
   *
   * @param t402Version - The t402 protocol version
   * @param paymentRequirements - The payment requirements (must include maxAmount)
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    // Validate that this is an upto requirement
    if (paymentRequirements.scheme !== "upto") {
      throw new Error(`Expected upto scheme, got ${paymentRequirements.scheme}`);
    }

    const extra = paymentRequirements.extra as UptoEvmExtra;
    if (!extra?.name || !extra?.version) {
      throw new Error(
        "EIP-712 domain parameters (name, version) are required for upto scheme",
      );
    }

    // Get maxAmount from the requirements
    const maxAmount = (paymentRequirements as unknown as { maxAmount: string }).maxAmount;
    if (!maxAmount) {
      throw new Error("maxAmount is required for upto scheme");
    }

    // Determine the spender (router contract or payTo address)
    const spender = extra.routerAddress
      ? getAddress(extra.routerAddress)
      : getAddress(paymentRequirements.payTo);

    // Calculate deadline
    const now = Math.floor(Date.now() / 1000);
    const deadline = now + paymentRequirements.maxTimeoutSeconds;

    // Get the permit nonce from the token contract
    // Note: In a real implementation, this would query the token contract
    // For now, we'll use 0 and expect the caller to provide it via extra
    const permitNonce = (extra as { permitNonce?: number }).permitNonce ?? 0;

    // Create the permit authorization
    const authorization: UptoEIP2612Payload["authorization"] = {
      owner: this.signer.address,
      spender,
      value: maxAmount,
      deadline: deadline.toString(),
      nonce: permitNonce,
    };

    // Sign the permit
    const signature = await this.signPermit(authorization, paymentRequirements);

    // Create unique payment nonce
    const paymentNonce = createNonce();

    const payload: UptoEIP2612Payload = {
      signature,
      authorization,
      paymentNonce,
    };

    return {
      t402Version,
      payload,
    };
  }

  /**
   * Sign the EIP-2612 permit using EIP-712
   *
   * @param authorization - The permit authorization to sign
   * @param requirements - The payment requirements
   * @returns Promise resolving to the signature components
   */
  private async signPermit(
    authorization: UptoEIP2612Payload["authorization"],
    requirements: PaymentRequirements,
  ): Promise<UptoEIP2612Payload["signature"]> {
    const chainId = parseInt(requirements.network.split(":")[1]);
    const extra = requirements.extra as UptoEvmExtra;

    const domain = {
      name: extra.name,
      version: extra.version,
      chainId,
      verifyingContract: getAddress(requirements.asset),
    };

    const message = {
      owner: getAddress(authorization.owner),
      spender: getAddress(authorization.spender),
      value: BigInt(authorization.value),
      nonce: BigInt(authorization.nonce),
      deadline: BigInt(authorization.deadline),
    };

    // Sign with EIP-712
    const signature = await this.signer.signTypedData({
      domain,
      types: permitTypes,
      primaryType: "Permit",
      message,
    });

    // Parse signature into v, r, s components
    const r = `0x${signature.slice(2, 66)}` as `0x${string}`;
    const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
    const v = parseInt(signature.slice(130, 132), 16);

    return { v, r, s };
  }
}

/**
 * Factory function to create an UptoEvmScheme.
 *
 * @param signer - The EVM signer
 * @returns A new UptoEvmScheme instance
 */
export function createUptoEvmScheme(signer: ClientEvmSigner): UptoEvmScheme {
  return new UptoEvmScheme(signer);
}
