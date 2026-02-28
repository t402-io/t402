import { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@t402/core/types";
import { getAddress } from "viem";
import { ClientEvmSigner } from "../../signer";
import { Permit2ProxyPayloadV2, T402Witness } from "../types";
import { PERMIT2_ADDRESS, SCHEME_PERMIT2_PROXY, permit2WitnessTypes } from "../constants";

/**
 * EVM client implementation for the Permit2 Proxy payment scheme.
 *
 * Uses Uniswap Permit2 PermitWitnessTransferFrom with a Witness struct
 * that binds the payment to a specific facilitator and destination.
 */
export class Permit2ProxyEvmScheme implements SchemeNetworkClient {
  readonly scheme = SCHEME_PERMIT2_PROXY;

  /**
   * Creates a new Permit2ProxyEvmScheme instance.
   *
   * @param signer - The EVM signer for client operations
   */
  constructor(private readonly signer: ClientEvmSigner) {}

  /**
   * Creates a payment payload for the Permit2 Proxy scheme.
   *
   * @param t402Version - The t402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    const now = Math.floor(Date.now() / 1000);
    const deadline = now + paymentRequirements.maxTimeoutSeconds;

    // Use a random nonce (Permit2 nonces are bitmap-based, not sequential)
    const nonce = BigInt(
      "0x" +
        Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, "0"))
          .join(""),
    ).toString();

    // Get proxy address from requirements extra (set by server's enhancePaymentRequirements)
    const proxyAddress = (paymentRequirements.extra?.exactProxyAddress ||
      paymentRequirements.extra?.uptoProxyAddress) as `0x${string}` | undefined;

    if (!proxyAddress) {
      throw new Error(
        "Missing proxy address in payment requirements extra (exactProxyAddress or uptoProxyAddress)",
      );
    }

    // Get facilitator address from requirements extra
    const facilitatorAddress = paymentRequirements.extra?.facilitator as `0x${string}` | undefined;

    if (!facilitatorAddress) {
      throw new Error("Missing facilitator address in payment requirements extra");
    }

    const permit = {
      permitted: {
        token: getAddress(paymentRequirements.asset) as `0x${string}`,
        amount: paymentRequirements.amount,
      },
      nonce,
      deadline: deadline.toString(),
    };

    // Build witness: binds the payment to a destination, facilitator, and time constraint
    const witness: T402Witness = {
      to: getAddress(paymentRequirements.payTo) as `0x${string}`,
      facilitator: getAddress(facilitatorAddress) as `0x${string}`,
      validAfter: "0", // Immediate validity
    };

    // Sign the PermitWitnessTransferFrom with Witness
    const signature = await this.signPermit2Witness(
      permit,
      witness,
      proxyAddress,
      paymentRequirements,
    );

    const payload: Permit2ProxyPayloadV2 = {
      permit,
      witness,
      signature,
      owner: this.signer.address,
    };

    return {
      t402Version,
      payload,
    };
  }

  /**
   * Sign the Permit2 PermitWitnessTransferFrom using EIP-712.
   *
   * @param permit - The permit transfer data
   * @param witness - The witness data
   * @param spender - The proxy contract address (spender in Permit2)
   * @param requirements - The payment requirements
   * @returns Signed typed data hex string
   */
  private async signPermit2Witness(
    permit: Permit2ProxyPayloadV2["permit"],
    witness: T402Witness,
    spender: `0x${string}`,
    requirements: PaymentRequirements,
  ): Promise<`0x${string}`> {
    const chainId = parseInt(requirements.network.split(":")[1]);

    const domain = {
      name: "Permit2",
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    };

    const message = {
      permitted: {
        token: permit.permitted.token,
        amount: BigInt(permit.permitted.amount),
      },
      spender: getAddress(spender),
      nonce: BigInt(permit.nonce),
      deadline: BigInt(permit.deadline),
      witness: {
        to: witness.to,
        facilitator: witness.facilitator,
        validAfter: BigInt(witness.validAfter),
      },
    };

    return await this.signer.signTypedData({
      domain,
      types: permit2WitnessTypes,
      primaryType: "PermitWitnessTransferFrom",
      message,
    });
  }
}
