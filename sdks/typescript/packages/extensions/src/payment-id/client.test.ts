import { describe, it, expect } from "vitest";
import { createPaymentIdPayload, encodePaymentIdHeader } from "./client.js";
import type { PaymentIdExtension } from "./types.js";

describe("Payment ID Client", () => {
  const mockExtension: PaymentIdExtension = {
    info: {
      id: "test-payment-id-123",
      idempotencyKey: "idem-key",
      groupId: "group-1",
    },
    schema: {},
  };

  describe("createPaymentIdPayload", () => {
    it("should echo payment ID from extension", () => {
      const payload = createPaymentIdPayload(mockExtension);

      expect(payload.id).toBe("test-payment-id-123");
      expect(payload.clientId).toBeUndefined();
    });

    it("should include clientId when provided", () => {
      const payload = createPaymentIdPayload(mockExtension, "my-client-id");

      expect(payload.id).toBe("test-payment-id-123");
      expect(payload.clientId).toBe("my-client-id");
    });
  });

  describe("encodePaymentIdHeader", () => {
    it("should encode payload as base64 JSON", () => {
      const payload = { id: "test-id", clientId: "client-id" };
      const encoded = encodePaymentIdHeader(payload);

      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
      expect(decoded).toEqual(payload);
    });

    it("should encode payload without clientId", () => {
      const payload = { id: "test-id" };
      const encoded = encodePaymentIdHeader(payload);

      const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
      expect(decoded.id).toBe("test-id");
    });
  });
});
