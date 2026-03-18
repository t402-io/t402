/**
 * Spark client scheme — creates payment payloads with Spark transfer proof.
 */

import type { SparkPayload } from "../../types";

export interface SparkClientConfig {
  paymentType: "spark" | "lightning";
  transferId?: string;
  preimage?: string;
  paymentHash?: string;
}

export class SparkClientScheme {
  readonly scheme = "exact";
  private config: SparkClientConfig;

  constructor(config: SparkClientConfig) {
    this.config = config;
  }

  async createPaymentPayload(t402Version: number) {
    const payload: SparkPayload = {
      paymentType: this.config.paymentType,
      transferId: this.config.transferId,
      preimage: this.config.preimage,
      paymentHash: this.config.paymentHash,
    };
    return { t402Version, payload };
  }
}
