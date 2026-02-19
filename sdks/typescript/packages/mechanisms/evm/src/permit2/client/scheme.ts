import { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@t402/core/types";
import { getAddress } from "viem";
import { ClientEvmSigner } from "../../signer";
import { Permit2PayloadV2 } from "../types";
import { PERMIT2_ADDRESS, permit2Types } from "../constants";

/**
 * EVM client implementation for the Permit2 payment scheme.
 *
 * Uses Uniswap Permit2 SignatureTransfer for gasless token approvals.
 */
export class Permit2EvmScheme implements SchemeNetworkClient {
  readonly scheme = "permit2";

  /**
   * Creates a new Permit2EvmScheme instance.
   *
   * @param signer - The EVM signer for client operations
   */
  constructor(private readonly signer: ClientEvmSigner) {}

  /**
   * Creates a payment payload for the Permit2 scheme.
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

    // Use a random nonce (Permit2 nonces are not sequential for SignatureTransfer)
    const nonce = BigInt(
      "0x" +
        Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, "0"))
          .join(""),
    ).toString();

    const permit = {
      permitted: {
        token: getAddress(paymentRequirements.asset) as `0x${string}`,
        amount: paymentRequirements.amount,
      },
      nonce,
      deadline: deadline.toString(),
    };

    const transferDetails = {
      to: getAddress(paymentRequirements.payTo) as `0x${string}`,
      requestedAmount: paymentRequirements.amount,
    };

    // Sign the Permit2 typed data
    const signature = await this.signPermit2(permit, transferDetails.to, paymentRequirements);

    const payload: Permit2PayloadV2 = {
      permit,
      transferDetails,
      signature,
      owner: this.signer.address,
    };

    return {
      t402Version,
      payload,
    };
  }

  /**
   * Sign the Permit2 SignatureTransfer using EIP-712
   *
   * @param permit - The permit transfer data
   * @param spender - The spender address
   * @param requirements - The payment requirements
   * @returns Signed typed data hex string
   */
  private async signPermit2(
    permit: Permit2PayloadV2["permit"],
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
      spender,
      nonce: BigInt(permit.nonce),
      deadline: BigInt(permit.deadline),
    };

    return await this.signer.signTypedData({
      domain,
      types: permit2Types,
      primaryType: "PermitTransferFrom",
      message,
    });
  }
}
