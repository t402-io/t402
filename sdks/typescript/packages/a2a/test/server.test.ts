import { describe, it, expect, vi, beforeEach } from "vitest";
import { A2APaymentServer } from "../src/server";
import type {
  A2ATask,
  A2AMessage,
  PaymentRequired,
  PaymentPayload,
  VerifyResponse,
  SettleResponse,
} from "@t402/core/types";
import type { FacilitatorClient } from "@t402/core/server";

describe("A2APaymentServer", () => {
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

  const mockPayload: PaymentPayload = {
    t402Version: 2,
    scheme: "exact",
    network: "eip155:8453",
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

  const createMockMessage = (withPayload: boolean): A2AMessage => ({
    kind: "message",
    role: "user",
    parts: [{ kind: "text", text: "Payment submission" }],
    metadata: withPayload
      ? {
          "t402.payment.status": "payment-submitted",
          "t402.payment.payload": mockPayload,
        }
      : {},
  });

  const createMockTask = (): A2ATask => ({
    kind: "task",
    id: "task-123",
    status: {
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
    },
  });

  const mockVerifyResponse: VerifyResponse = {
    isValid: true,
    payer: "0xTestPayer",
  };

  const mockSettleResponse: SettleResponse = {
    success: true,
    transaction: "0xMockTxHash",
    network: "eip155:8453",
    payer: "0xTestPayer",
  };

  const createMockFacilitator = (
    verifyResult: Partial<VerifyResponse> = {},
    settleResult: Partial<SettleResponse> = {},
  ): FacilitatorClient => ({
    verify: vi.fn().mockResolvedValue({ ...mockVerifyResponse, ...verifyResult }),
    settle: vi.fn().mockResolvedValue({ ...mockSettleResponse, ...settleResult }),
    getSupported: vi.fn(),
  });

  describe("createRequirements", () => {
    it("creates requirements with defaults", () => {
      const server = new A2APaymentServer({
        defaultRequirements: {
          resource: "agent://default-agent/skill",
        },
      });

      const requirements = server.createRequirements({
        accepts: mockPaymentRequired.accepts,
      });

      expect(requirements.t402Version).toBe(2);
      expect(requirements.resource).toBe("agent://default-agent/skill");
      expect(requirements.accepts).toEqual(mockPaymentRequired.accepts);
    });

    it("overrides defaults with provided values", () => {
      const server = new A2APaymentServer({
        defaultRequirements: {
          resource: "agent://default-agent/skill",
        },
      });

      const requirements = server.createRequirements({
        resource: "agent://custom-agent/skill",
        accepts: mockPaymentRequired.accepts,
      });

      expect(requirements.resource).toBe("agent://custom-agent/skill");
    });
  });

  describe("createPaymentRequiredTask", () => {
    it("creates task in input-required state", () => {
      const server = new A2APaymentServer();
      const task = server.createPaymentRequiredTask("task-456", mockPaymentRequired);

      expect(task.kind).toBe("task");
      expect(task.id).toBe("task-456");
      expect(task.status.state).toBe("input-required");
      expect(task.status.message?.metadata?.["t402.payment.status"]).toBe(
        "payment-required",
      );
      expect(task.status.message?.metadata?.["t402.payment.required"]).toEqual(
        mockPaymentRequired,
      );
    });

    it("includes custom text message", () => {
      const server = new A2APaymentServer();
      const task = server.createPaymentRequiredTask(
        "task-456",
        mockPaymentRequired,
        "Custom payment message",
      );

      expect(task.status.message?.parts[0]).toEqual({
        kind: "text",
        text: "Custom payment message",
      });
    });
  });

  describe("extractPaymentPayload", () => {
    it("extracts payload from message", () => {
      const server = new A2APaymentServer();
      const message = createMockMessage(true);

      const payload = server.extractPaymentPayload(message);

      expect(payload).toEqual(mockPayload);
    });

    it("returns undefined when no payload", () => {
      const server = new A2APaymentServer();
      const message = createMockMessage(false);

      const payload = server.extractPaymentPayload(message);

      expect(payload).toBeUndefined();
    });
  });

  describe("hasPaymentPayload", () => {
    it("returns true when message has payment", () => {
      const server = new A2APaymentServer();
      const message = createMockMessage(true);

      expect(server.hasPaymentPayload(message)).toBe(true);
    });

    it("returns false when message has no payment", () => {
      const server = new A2APaymentServer();
      const message = createMockMessage(false);

      expect(server.hasPaymentPayload(message)).toBe(false);
    });
  });

  describe("processPayment", () => {
    it("processes payment successfully with facilitator", async () => {
      const onPaymentReceived = vi.fn();
      const onPaymentVerified = vi.fn();
      const onPaymentSettled = vi.fn();
      const facilitator = createMockFacilitator();

      const server = new A2APaymentServer({
        facilitator,
        onPaymentReceived,
        onPaymentVerified,
        onPaymentSettled,
      });

      const message = createMockMessage(true);
      const result = await server.processPayment(message, mockPaymentRequired);

      expect(result.success).toBe(true);
      expect(result.receipts).toHaveLength(1);
      expect(result.receipts?.[0].success).toBe(true);
      expect(result.message.metadata?.["t402.payment.status"]).toBe(
        "payment-completed",
      );

      expect(onPaymentReceived).toHaveBeenCalledWith(mockPayload);
      expect(onPaymentVerified).toHaveBeenCalledWith(mockPayload);
      expect(onPaymentSettled).toHaveBeenCalledWith([mockSettleResponse]);
    });

    it("fails when no payload in message", async () => {
      const onPaymentFailed = vi.fn();
      const server = new A2APaymentServer({
        facilitator: createMockFacilitator(),
        onPaymentFailed,
      });

      const message = createMockMessage(false);
      const result = await server.processPayment(message, mockPaymentRequired);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No payment payload in message");
      expect(result.message.metadata?.["t402.payment.status"]).toBe(
        "payment-failed",
      );
      expect(onPaymentFailed).toHaveBeenCalled();
    });

    it("fails when no facilitator configured", async () => {
      const server = new A2APaymentServer();
      const message = createMockMessage(true);

      const result = await server.processPayment(message, mockPaymentRequired);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No facilitator or payment handler configured");
    });

    it("fails when verification fails", async () => {
      const onPaymentFailed = vi.fn();
      const facilitator = createMockFacilitator({
        isValid: false,
        invalidReason: "Invalid signature",
      });

      const server = new A2APaymentServer({
        facilitator,
        onPaymentFailed,
      });

      const message = createMockMessage(true);
      const result = await server.processPayment(message, mockPaymentRequired);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid signature");
      expect(onPaymentFailed).toHaveBeenCalled();
    });

    it("fails when settlement fails", async () => {
      const onPaymentFailed = vi.fn();
      const facilitator = createMockFacilitator({}, {
        success: false,
        errorReason: "Insufficient funds",
      });

      const server = new A2APaymentServer({
        facilitator,
        onPaymentFailed,
      });

      const message = createMockMessage(true);
      const result = await server.processPayment(message, mockPaymentRequired);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insufficient funds");
      expect(result.receipts).toHaveLength(1);
      expect(onPaymentFailed).toHaveBeenCalled();
    });

    it("uses custom payment handler when provided", async () => {
      const customResult = {
        success: true,
        receipts: [mockSettleResponse],
        message: {
          kind: "message" as const,
          role: "agent" as const,
          parts: [{ kind: "text" as const, text: "Custom success" }],
          metadata: { "t402.payment.status": "payment-completed" as const },
        },
      };

      const paymentHandler = vi.fn().mockResolvedValue(customResult);
      const server = new A2APaymentServer({ paymentHandler });

      const message = createMockMessage(true);
      const result = await server.processPayment(message, mockPaymentRequired);

      expect(result).toEqual(customResult);
      expect(paymentHandler).toHaveBeenCalledWith(mockPayload, mockPaymentRequired);
    });

    it("handles errors gracefully", async () => {
      const facilitator = {
        verify: vi.fn().mockRejectedValue(new Error("Network error")),
        settle: vi.fn(),
        getSupported: vi.fn(),
      };

      const server = new A2APaymentServer({ facilitator });
      const message = createMockMessage(true);

      const result = await server.processPayment(message, mockPaymentRequired);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  describe("handlePayment", () => {
    it("processes payment and updates task", async () => {
      const facilitator = createMockFacilitator();
      const server = new A2APaymentServer({ facilitator });
      const task = createMockTask();
      const message = createMockMessage(true);

      const updatedTask = await server.handlePayment(
        task,
        message,
        mockPaymentRequired,
      );

      expect(updatedTask.status.state).toBe("completed");
      expect(updatedTask.status.message?.metadata?.["t402.payment.status"]).toBe(
        "payment-completed",
      );
      expect(updatedTask.history).toHaveLength(1);
    });

    it("updates task with failure status on error", async () => {
      const facilitator = createMockFacilitator({ isValid: false, invalidReason: "Bad sig" });
      const server = new A2APaymentServer({ facilitator });
      const task = createMockTask();
      const message = createMockMessage(true);

      const updatedTask = await server.handlePayment(
        task,
        message,
        mockPaymentRequired,
      );

      expect(updatedTask.status.state).toBe("failed");
      expect(updatedTask.status.message?.metadata?.["t402.payment.status"]).toBe(
        "payment-failed",
      );
    });
  });

  describe("updateTaskWithPaymentResult", () => {
    it("updates task with successful result", () => {
      const server = new A2APaymentServer();
      const task = createMockTask();

      const updatedTask = server.updateTaskWithPaymentResult(task, {
        success: true,
        receipts: [mockSettleResponse],
        message: {
          kind: "message",
          role: "agent",
          parts: [{ kind: "text", text: "Success" }],
          metadata: { "t402.payment.status": "payment-completed" },
        },
      });

      expect(updatedTask.status.state).toBe("completed");
    });

    it("updates task with failed result", () => {
      const server = new A2APaymentServer();
      const task = createMockTask();

      const updatedTask = server.updateTaskWithPaymentResult(task, {
        success: false,
        error: "Payment failed",
        message: {
          kind: "message",
          role: "agent",
          parts: [{ kind: "text", text: "Failed" }],
          metadata: { "t402.payment.status": "payment-failed" },
        },
      });

      expect(updatedTask.status.state).toBe("failed");
    });
  });

  describe("dual-namespace (x402 compat)", () => {
    it("extractPaymentPayload reads x402-only metadata", () => {
      const server = new A2APaymentServer();
      const message: A2AMessage = {
        kind: "message",
        role: "user",
        parts: [{ kind: "text", text: "Payment" }],
        metadata: {
          "x402.payment.status": "payment-submitted",
          "x402.payment.payload": mockPayload,
        },
      };
      expect(server.extractPaymentPayload(message)).toEqual(mockPayload);
    });

    it("hasPaymentPayload detects x402-only metadata", () => {
      const server = new A2APaymentServer();
      const message: A2AMessage = {
        kind: "message",
        role: "user",
        parts: [{ kind: "text", text: "Payment" }],
        metadata: {
          "x402.payment.status": "payment-submitted",
          "x402.payment.payload": mockPayload,
        },
      };
      expect(server.hasPaymentPayload(message)).toBe(true);
    });

    it("hasPaymentPayload prefers t402 when both present", () => {
      const server = new A2APaymentServer();
      const message: A2AMessage = {
        kind: "message",
        role: "user",
        parts: [{ kind: "text", text: "Payment" }],
        metadata: {
          "t402.payment.status": "payment-submitted",
          "t402.payment.payload": mockPayload,
          "x402.payment.status": "payment-submitted",
          "x402.payment.payload": mockPayload,
        },
      };
      expect(server.hasPaymentPayload(message)).toBe(true);
    });

    it("processPayment works with x402-only payload", async () => {
      const facilitator = createMockFacilitator();
      const server = new A2APaymentServer({ facilitator });
      const message: A2AMessage = {
        kind: "message",
        role: "user",
        parts: [{ kind: "text", text: "Payment" }],
        metadata: {
          "x402.payment.status": "payment-submitted",
          "x402.payment.payload": mockPayload,
        },
      };

      const result = await server.processPayment(message, mockPaymentRequired);
      expect(result.success).toBe(true);
      // Result message should have both namespaces
      expect(result.message.metadata?.["t402.payment.status"]).toBe("payment-completed");
      expect(result.message.metadata?.["x402.payment.status"]).toBe("payment-completed");
    });

    it("createPaymentRequiredTask emits both t402 and x402 metadata", () => {
      const server = new A2APaymentServer();
      const task = server.createPaymentRequiredTask("task-dual", mockPaymentRequired);

      expect(task.status.message?.metadata?.["t402.payment.status"]).toBe("payment-required");
      expect(task.status.message?.metadata?.["x402.payment.status"]).toBe("payment-required");
      expect(task.status.message?.metadata?.["t402.payment.required"]).toEqual(mockPaymentRequired);
      // x402 downgraded should be present for EVM+exact
      expect(task.status.message?.metadata?.["x402.payment.required"]).toBeDefined();
    });
  });
});
