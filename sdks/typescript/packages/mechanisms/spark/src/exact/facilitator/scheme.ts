/**
 * Spark exact payment facilitator scheme.
 *
 * - SPARK: Verify by transfer_id lookup
 * - LIGHTNING: Verify by SHA256(preimage) === paymentHash
 * - Settlement is a no-op (instant finality)
 */

import { createHash } from "crypto";
import type {
  SparkPayload,
  SparkSigner,
  TransferInfo,
} from "../../types";
import { TransferStatus, PAYMENT_TYPE_SPARK, PAYMENT_TYPE_LIGHTNING } from "../../types";

export interface VerifyResponse {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
}

export interface SettleResponse {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string;
}

export class SparkFacilitatorScheme {
  readonly scheme = "exact";
  readonly caipFamily = "spark:*";

  private signer: SparkSigner;
  private verified = new Set<string>();

  constructor(signer: SparkSigner) {
    this.signer = signer;
  }

  async verify(
    payload: { payload: Record<string, unknown> },
    requirements: { network: string; amount: string },
  ): Promise<VerifyResponse> {
    const sparkPayload = payload.payload as unknown as SparkPayload;

    switch (sparkPayload.paymentType) {
      case PAYMENT_TYPE_SPARK:
        return this.verifySpark(sparkPayload, requirements);
      case PAYMENT_TYPE_LIGHTNING:
        return this.verifyLightning(sparkPayload);
      default:
        return { isValid: false, invalidReason: `unsupported payment type: ${sparkPayload.paymentType}` };
    }
  }

  async settle(
    payload: { payload: Record<string, unknown> },
    requirements: { network: string; amount: string },
  ): Promise<SettleResponse> {
    const result = await this.verify(payload, requirements);
    if (!result.isValid) {
      return { success: false, errorReason: result.invalidReason };
    }

    const sparkPayload = payload.payload as unknown as SparkPayload;
    return {
      success: true,
      transaction: sparkPayload.transferId || sparkPayload.paymentHash || "",
      network: requirements.network,
      payer: result.payer,
    };
  }

  private async verifySpark(
    payload: SparkPayload,
    requirements: { amount: string },
  ): Promise<VerifyResponse> {
    if (!payload.transferId) {
      return { isValid: false, invalidReason: "missing_transfer_id" };
    }

    // Replay protection
    if (this.verified.has(payload.transferId)) {
      return { isValid: false, invalidReason: "replay_detected" };
    }
    this.verified.add(payload.transferId);

    let transfer: TransferInfo;
    try {
      transfer = await this.signer.getTransfer(payload.transferId);
    } catch {
      return { isValid: false, invalidReason: "transfer_not_found" };
    }

    if (transfer.status !== TransferStatus.Completed) {
      return { isValid: false, invalidReason: "transfer_not_completed" };
    }

    const requiredAmount = parseInt(requirements.amount, 10);
    if (transfer.amount < requiredAmount) {
      return { isValid: false, invalidReason: "insufficient_amount" };
    }

    if (transfer.receiver.toLowerCase() !== this.signer.getAddress().toLowerCase()) {
      return { isValid: false, invalidReason: "wrong_recipient" };
    }

    return { isValid: true, payer: transfer.sender };
  }

  private verifyLightning(payload: SparkPayload): VerifyResponse {
    if (!payload.preimage || !payload.paymentHash) {
      return { isValid: false, invalidReason: "missing_lightning_proof" };
    }

    const preimageBytes = Buffer.from(payload.preimage, "hex");
    const computedHash = createHash("sha256").update(preimageBytes).digest("hex");

    if (computedHash !== payload.paymentHash) {
      return { isValid: false, invalidReason: "preimage_mismatch" };
    }

    return { isValid: true, payer: `lightning:${payload.paymentHash.slice(0, 16)}` };
  }
}
