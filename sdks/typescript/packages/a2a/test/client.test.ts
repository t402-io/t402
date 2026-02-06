import { describe, it, expect, vi } from "vitest";
import { A2APaymentClient } from "../src/client";
import type {
  A2ATask,
  PaymentRequired,
  PaymentPayload,
  SchemeNetworkClient,
} from "@t402/core/types";

describe("A2APaymentClient", () => {
  const mockPaymentRequired: PaymentRequired = {
    t402Version: 2,
    resource: "agent://test-agent/skill",
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0xTestPayTo",
        maxTimeoutSeconds: 3600,
      },
      {
        scheme: "upto",
        network: "eip155:1",
        amount: "2000000",
        asset: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        payTo: "0xTestPayTo",
        maxTimeoutSeconds: 7200,
      },
    ],
  };

  const createMockTask = (paymentRequired: boolean): A2ATask => ({
    kind: "task",
    id: "task-123",
    status: paymentRequired
      ? {
          state: "input-required",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Payment required" }],
            metadata: {
              "t402.payment.status": "payment-required",
              "t402.payment.required": mockPaymentRequired,
            },
          },
        }
      : {
          state: "working",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Working..." }],
          },
        },
  });

  const mockBasePayload = {
    t402Version: 2,
    payload: {
      signature: "0xMockSignature",
      from: "0xTestPayer",
      to: "0xTestPayTo",
      amount: "1000000",
      validAfter: 0,
      validBefore: Math.floor(Date.now() / 1000) + 3600,
      nonce: "0x123",
    },
  };

  const mockPayload: PaymentPayload = {
    ...mockBasePayload,
    resource: { url: "agent://test-agent/skill" },
    accepted: mockPaymentRequired.accepts[0],
  };

  const createMockMechanism = (): SchemeNetworkClient => ({
    scheme: "exact",
    createPaymentPayload: vi.fn().mockResolvedValue(mockBasePayload),
  });

  describe("requiresPayment", () => {
    it("returns true for payment-required task", () => {
      const client = new A2APaymentClient();
      const task = createMockTask(true);
      expect(client.requiresPayment(task)).toBe(true);
    });

    it("returns false for non-payment task", () => {
      const client = new A2APaymentClient();
      const task = createMockTask(false);
      expect(client.requiresPayment(task)).toBe(false);
    });

    it("calls onPaymentRequired callback when payment is required", () => {
      const onPaymentRequired = vi.fn();
      const client = new A2APaymentClient({ onPaymentRequired });
      const task = createMockTask(true);

      client.requiresPayment(task);

      expect(onPaymentRequired).toHaveBeenCalledWith(mockPaymentRequired);
    });
  });

  describe("getRequirements", () => {
    it("extracts requirements from payment-required task", () => {
      const client = new A2APaymentClient();
      const task = createMockTask(true);

      const requirements = client.getRequirements(task);

      expect(requirements).toEqual(mockPaymentRequired);
    });

    it("returns undefined for non-payment task", () => {
      const client = new A2APaymentClient();
      const task = createMockTask(false);

      const requirements = client.getRequirements(task);

      expect(requirements).toBeUndefined();
    });
  });

  describe("selectPaymentOption", () => {
    it("returns first option when no preferences", () => {
      const client = new A2APaymentClient();
      const option = client.selectPaymentOption(mockPaymentRequired);

      expect(option).toEqual(mockPaymentRequired.accepts[0]);
    });

    it("selects by preferred network", () => {
      const client = new A2APaymentClient();
      const option = client.selectPaymentOption(mockPaymentRequired, "eip155:1");

      expect(option?.network).toBe("eip155:1");
    });

    it("selects by preferred scheme", () => {
      const client = new A2APaymentClient();
      const option = client.selectPaymentOption(
        mockPaymentRequired,
        undefined,
        "upto",
      );

      expect(option?.scheme).toBe("upto");
    });

    it("selects exact match for both network and scheme", () => {
      const client = new A2APaymentClient();
      const option = client.selectPaymentOption(
        mockPaymentRequired,
        "eip155:1",
        "upto",
      );

      expect(option?.network).toBe("eip155:1");
      expect(option?.scheme).toBe("upto");
    });

    it("returns undefined for empty accepts array", () => {
      const client = new A2APaymentClient();
      const option = client.selectPaymentOption({
        ...mockPaymentRequired,
        accepts: [],
      });

      expect(option).toBeUndefined();
    });
  });

  describe("createPayload", () => {
    it("creates payment payload using mechanism", async () => {
      const onPaymentSubmitted = vi.fn();
      const client = new A2APaymentClient({ onPaymentSubmitted });
      const mechanism = createMockMechanism();

      const payload = await client.createPayload(mechanism, mockPaymentRequired);

      // Check that the payload has the expected structure
      expect(payload.t402Version).toBe(2);
      expect(payload.payload).toEqual(mockBasePayload.payload);
      expect(payload.accepted).toEqual(mockPaymentRequired.accepts[0]);
      expect(payload.resource).toEqual(mockPaymentRequired.resource);
      expect(mechanism.createPaymentPayload).toHaveBeenCalledWith(
        mockPaymentRequired.t402Version,
        mockPaymentRequired.accepts[0],
      );
      expect(onPaymentSubmitted).toHaveBeenCalledWith(payload);
    });

    it("throws when no payment options available", async () => {
      const client = new A2APaymentClient();
      const mechanism = createMockMechanism();

      await expect(
        client.createPayload(mechanism, {
          ...mockPaymentRequired,
          accepts: [],
        }),
      ).rejects.toThrow("No payment options available");
    });
  });

  describe("createPaymentMessage", () => {
    it("creates A2A message with payment payload", () => {
      const client = new A2APaymentClient();
      const message = client.createPaymentMessage(mockPayload);

      expect(message.kind).toBe("message");
      expect(message.role).toBe("user");
      expect(message.metadata?.["t402.payment.status"]).toBe("payment-submitted");
      expect(message.metadata?.["t402.payment.payload"]).toEqual(mockPayload);
    });

    it("uses custom text message", () => {
      const client = new A2APaymentClient();
      const message = client.createPaymentMessage(mockPayload, "Custom payment");

      expect(message.parts[0]).toEqual({ kind: "text", text: "Custom payment" });
    });
  });

  describe("handlePayment", () => {
    it("returns undefined when task does not require payment", async () => {
      const client = new A2APaymentClient();
      const task = createMockTask(false);
      const mechanism = createMockMechanism();

      const result = await client.handlePayment(task, mechanism);

      expect(result).toBeUndefined();
    });

    it("creates payment message when task requires payment", async () => {
      const client = new A2APaymentClient();
      const task = createMockTask(true);
      const mechanism = createMockMechanism();

      const result = await client.handlePayment(task, mechanism);

      expect(result).toBeDefined();
      expect(result?.metadata?.["t402.payment.status"]).toBe("payment-submitted");
    });

    it("throws when no compatible payment option found", async () => {
      const client = new A2APaymentClient();
      const task: A2ATask = {
        ...createMockTask(true),
        status: {
          state: "input-required",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Payment required" }],
            metadata: {
              "t402.payment.status": "payment-required",
              "t402.payment.required": { ...mockPaymentRequired, accepts: [] },
            },
          },
        },
      };
      const mechanism = createMockMechanism();

      await expect(
        client.handlePayment(task, mechanism, "solana:mainnet"),
      ).rejects.toThrow("No compatible payment option found");
    });
  });
});
