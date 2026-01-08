import { SchemeNetworkClient } from "../../../src/types/mechanisms";
import { PaymentPayload, PaymentRequirements } from "../../../src/types/payments";

/**
 * Mock scheme network client for testing.
 */
export class MockSchemeNetworkClient implements SchemeNetworkClient {
  public readonly scheme: string;
  private payloadResult: Pick<PaymentPayload, "t402Version" | "payload"> | Error;

  // Call tracking
  public createPaymentPayloadCalls: Array<{
    t402Version: number;
    requirements: PaymentRequirements;
  }> = [];

  /**
   *
   * @param scheme
   * @param payloadResult
   */
  constructor(
    scheme: string,
    payloadResult?: Pick<PaymentPayload, "t402Version" | "payload"> | Error,
  ) {
    this.scheme = scheme;
    this.payloadResult = payloadResult || {
      t402Version: 2,
      payload: { signature: "mock_signature", from: "mock_address" },
    };
  }

  /**
   *
   * @param t402Version
   * @param paymentRequirements
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    this.createPaymentPayloadCalls.push({ t402Version, requirements: paymentRequirements });

    if (this.payloadResult instanceof Error) {
      throw this.payloadResult;
    }
    return this.payloadResult;
  }

  // Helper methods for test configuration
  /**
   *
   * @param result
   */
  setPayloadResult(result: Pick<PaymentPayload, "t402Version" | "payload"> | Error): void {
    this.payloadResult = result;
  }

  /**
   *
   */
  reset(): void {
    this.createPaymentPayloadCalls = [];
  }
}
