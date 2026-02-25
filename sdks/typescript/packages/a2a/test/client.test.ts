import { describe, it, expect, vi } from "vitest";
import { A2APaymentClient } from "../src/client";
import type {
  A2ATask,
  PaymentRequired,
  PaymentPayload,
  SchemeNetworkClient,
} from "@t402/core/types";
import {
  isPaymentRequired,
  isPaymentCompleted,
  isPaymentFailed,
  getPaymentRequired,
  getPaymentReceipts,
  createPaymentRequiredMessage,
  createPaymentSubmissionMessage,
  createPaymentCompletedMessage,
  createPaymentFailedMessage,
  createT402Extension,
  createX402Extension,
  mapT402ErrorToX402,
  downgradeRequirementsToX402,
  isStandaloneFlow,
  isEmbeddedFlow,
  T402_A2A_EXTENSION_URI,
  X402_A2A_EXTENSION_URI,
  CAIP2_TO_FLAT_NAME,
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

// ============================================================================
// Dual-Namespace (t402/x402) Tests
// ============================================================================

describe("Dual-Namespace A2A Support", () => {
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
    ],
  };

  const mockSettleResponse = {
    success: true,
    transaction: "0xMockTxHash",
    network: "eip155:8453",
    payer: "0xTestPayer",
  };

  describe("x402-only metadata reading", () => {
    it("isPaymentRequired reads x402-only metadata", () => {
      const task: A2ATask = {
        kind: "task",
        id: "task-x402",
        status: {
          state: "input-required",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Pay" }],
            metadata: {
              "x402.payment.status": "payment-required",
              "x402.payment.required": mockPaymentRequired,
            },
          },
        },
      };
      expect(isPaymentRequired(task)).toBe(true);
    });

    it("isPaymentCompleted reads x402-only metadata", () => {
      const task: A2ATask = {
        kind: "task",
        id: "task-x402",
        status: {
          state: "completed",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Done" }],
            metadata: {
              "x402.payment.status": "payment-completed",
              "x402.payment.receipts": [mockSettleResponse],
            },
          },
        },
      };
      expect(isPaymentCompleted(task)).toBe(true);
    });

    it("isPaymentFailed reads x402-only metadata", () => {
      const task: A2ATask = {
        kind: "task",
        id: "task-x402",
        status: {
          state: "failed",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Failed" }],
            metadata: {
              "x402.payment.status": "payment-failed",
              "x402.payment.error": "SETTLEMENT_FAILED",
            },
          },
        },
      };
      expect(isPaymentFailed(task)).toBe(true);
    });

    it("getPaymentRequired reads x402-only metadata", () => {
      const task: A2ATask = {
        kind: "task",
        id: "task-x402",
        status: {
          state: "input-required",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Pay" }],
            metadata: {
              "x402.payment.status": "payment-required",
              "x402.payment.required": mockPaymentRequired,
            },
          },
        },
      };
      expect(getPaymentRequired(task)).toEqual(mockPaymentRequired);
    });

    it("getPaymentReceipts reads x402-only metadata", () => {
      const task: A2ATask = {
        kind: "task",
        id: "task-x402",
        status: {
          state: "completed",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Done" }],
            metadata: {
              "x402.payment.status": "payment-completed",
              "x402.payment.receipts": [mockSettleResponse],
            },
          },
        },
      };
      expect(getPaymentReceipts(task)).toEqual([mockSettleResponse]);
    });

    it("t402 preferred over x402 when both present", () => {
      const t402Reqs = { ...mockPaymentRequired, resource: "t402-resource" };
      const x402Reqs = { ...mockPaymentRequired, resource: "x402-resource" };
      const task: A2ATask = {
        kind: "task",
        id: "task-both",
        status: {
          state: "input-required",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Pay" }],
            metadata: {
              "t402.payment.status": "payment-required",
              "t402.payment.required": t402Reqs,
              "x402.payment.status": "payment-required",
              "x402.payment.required": x402Reqs,
            },
          },
        },
      };
      expect(getPaymentRequired(task)).toEqual(t402Reqs);
    });
  });

  describe("dual-namespace writing", () => {
    it("createPaymentRequiredMessage emits both t402 and x402 keys", () => {
      const msg = createPaymentRequiredMessage(mockPaymentRequired);
      expect(msg.metadata?.["t402.payment.status"]).toBe("payment-required");
      expect(msg.metadata?.["x402.payment.status"]).toBe("payment-required");
      expect(msg.metadata?.["t402.payment.required"]).toEqual(mockPaymentRequired);
      // x402 should have downgraded version (EVM+exact = present)
      expect(msg.metadata?.["x402.payment.required"]).toBeDefined();
    });

    it("createPaymentSubmissionMessage emits both t402 and x402 keys", () => {
      const payload = {
        t402Version: 2,
        payload: { signature: "0xSig" },
        resource: { url: "agent://test" },
        accepted: mockPaymentRequired.accepts[0],
      } as any;
      const msg = createPaymentSubmissionMessage(payload);
      expect(msg.metadata?.["t402.payment.status"]).toBe("payment-submitted");
      expect(msg.metadata?.["x402.payment.status"]).toBe("payment-submitted");
      expect(msg.metadata?.["t402.payment.payload"]).toEqual(payload);
      expect(msg.metadata?.["x402.payment.payload"]).toEqual(payload);
    });

    it("createPaymentCompletedMessage emits both t402 and x402 keys", () => {
      const msg = createPaymentCompletedMessage([mockSettleResponse]);
      expect(msg.metadata?.["t402.payment.status"]).toBe("payment-completed");
      expect(msg.metadata?.["x402.payment.status"]).toBe("payment-completed");
      expect(msg.metadata?.["t402.payment.receipts"]).toEqual([mockSettleResponse]);
      expect(msg.metadata?.["x402.payment.receipts"]).toEqual([mockSettleResponse]);
    });

    it("createPaymentFailedMessage emits both t402 and x402 error codes", () => {
      const msg = createPaymentFailedMessage([], "T402-2001", "Sig invalid");
      expect(msg.metadata?.["t402.payment.error"]).toBe("T402-2001");
      expect(msg.metadata?.["x402.payment.error"]).toBe("INVALID_SIGNATURE");
      expect(msg.metadata?.["t402.payment.status"]).toBe("payment-failed");
      expect(msg.metadata?.["x402.payment.status"]).toBe("payment-failed");
    });
  });

  describe("mapT402ErrorToX402", () => {
    it("maps known error codes", () => {
      expect(mapT402ErrorToX402("T402-1001")).toBe("INVALID_AMOUNT");
      expect(mapT402ErrorToX402("T402-2001")).toBe("INVALID_SIGNATURE");
      expect(mapT402ErrorToX402("T402-3001")).toBe("SETTLEMENT_FAILED");
      expect(mapT402ErrorToX402("T402-5001")).toBe("SETTLEMENT_FAILED");
      expect(mapT402ErrorToX402("T402-5002")).toBe("SETTLEMENT_FAILED");
    });

    it("defaults to SETTLEMENT_FAILED for unknown codes", () => {
      expect(mapT402ErrorToX402("T402-9999")).toBe("SETTLEMENT_FAILED");
      expect(mapT402ErrorToX402("UNKNOWN")).toBe("SETTLEMENT_FAILED");
    });
  });

  describe("downgradeRequirementsToX402", () => {
    it("downgrades EVM+exact to x402 V1 format", () => {
      const result = downgradeRequirementsToX402(mockPaymentRequired);
      expect(result).toBeDefined();
      expect(result!.x402Version).toBe(1);
      expect((result!.accepts as any[])[0].network).toBe("base");
      expect((result!.accepts as any[])[0].maxAmountRequired).toBe("1000000");
    });

    it("returns undefined for non-EVM requirements", () => {
      const solanaReqs: PaymentRequired = {
        t402Version: 2,
        resource: "agent://test",
        accepts: [
          {
            scheme: "exact",
            network: "solana:mainnet",
            amount: "1000000",
            asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            payTo: "SolAddr",
            maxTimeoutSeconds: 3600,
          },
        ],
      };
      expect(downgradeRequirementsToX402(solanaReqs)).toBeUndefined();
    });

    it("returns undefined for upto scheme on EVM", () => {
      const uptoReqs: PaymentRequired = {
        t402Version: 2,
        resource: "agent://test",
        accepts: [
          {
            scheme: "upto",
            network: "eip155:8453",
            amount: "1000000",
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            payTo: "0xTestPayTo",
            maxTimeoutSeconds: 3600,
          },
        ],
      };
      expect(downgradeRequirementsToX402(uptoReqs)).toBeUndefined();
    });

    it("returns undefined for empty accepts", () => {
      expect(
        downgradeRequirementsToX402({ t402Version: 2, resource: "x", accepts: [] }),
      ).toBeUndefined();
    });
  });

  describe("isStandaloneFlow / isEmbeddedFlow", () => {
    it("detects standalone flow (x402 status + required present)", () => {
      const task: A2ATask = {
        kind: "task",
        id: "task-standalone",
        status: {
          state: "input-required",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Pay" }],
            metadata: {
              "x402.payment.status": "payment-required",
              "x402.payment.required": mockPaymentRequired,
            },
          },
        },
      };
      expect(isStandaloneFlow(task)).toBe(true);
      expect(isEmbeddedFlow(task)).toBe(false);
    });

    it("detects embedded flow (x402 status but no required)", () => {
      const task: A2ATask = {
        kind: "task",
        id: "task-embedded",
        status: {
          state: "input-required",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Pay" }],
            metadata: {
              "x402.payment.status": "payment-required",
            },
          },
        },
      };
      expect(isEmbeddedFlow(task)).toBe(true);
      expect(isStandaloneFlow(task)).toBe(false);
    });

    it("returns false for non-payment task", () => {
      const task: A2ATask = {
        kind: "task",
        id: "task-normal",
        status: { state: "working" },
      };
      expect(isStandaloneFlow(task)).toBe(false);
      expect(isEmbeddedFlow(task)).toBe(false);
    });
  });

  describe("createX402Extension / createT402Extension", () => {
    it("creates x402 extension with correct URI", () => {
      const ext = createX402Extension();
      expect(ext.uri).toBe(X402_A2A_EXTENSION_URI);
      expect(ext.required).toBe(false);
    });

    it("creates x402 extension with required=true", () => {
      const ext = createX402Extension(true);
      expect(ext.required).toBe(true);
    });

    it("creates t402 extension with correct URI", () => {
      const ext = createT402Extension();
      expect(ext.uri).toBe(T402_A2A_EXTENSION_URI);
    });
  });

  describe("constants", () => {
    it("X402_A2A_EXTENSION_URI is correct", () => {
      expect(X402_A2A_EXTENSION_URI).toBe(
        "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2",
      );
    });

    it("CAIP2_TO_FLAT_NAME maps correctly", () => {
      expect(CAIP2_TO_FLAT_NAME["eip155:8453"]).toBe("base");
      expect(CAIP2_TO_FLAT_NAME["eip155:1"]).toBe("ethereum");
      expect(CAIP2_TO_FLAT_NAME["eip155:42161"]).toBe("arbitrum");
      expect(CAIP2_TO_FLAT_NAME["eip155:10"]).toBe("optimism");
    });
  });

  describe("A2APaymentClient with x402-only task", () => {
    it("requiresPayment works with x402-only metadata", () => {
      const client = new A2APaymentClient();
      const task: A2ATask = {
        kind: "task",
        id: "task-x402",
        status: {
          state: "input-required",
          message: {
            kind: "message",
            role: "agent",
            parts: [{ kind: "text", text: "Pay" }],
            metadata: {
              "x402.payment.status": "payment-required",
              "x402.payment.required": mockPaymentRequired,
            },
          },
        },
      };
      expect(client.requiresPayment(task)).toBe(true);
      expect(client.getRequirements(task)).toEqual(mockPaymentRequired);
    });
  });
});
