import { describe, it, expect, vi } from "vitest";
import {
  erc8004IdentityCheck,
  verifyAgentIdentityFromTask,
  erc8004ReputationCheck,
  erc8004ServerIdentityCheck,
  erc8004SubmitFeedback,
} from "../src/hooks";
import { ERC8004_EXTENSION_KEY } from "../src/constants";
import type { ERC8004ReadClient, ERC8004WriteClient } from "../src/types";
import type { PaymentRequired, PaymentPayload, PaymentRequirements, SettleResponse, A2ATask } from "@t402/core/types";

const makePaymentRequired = (
  withExtension: boolean,
  payTo = "0xabcdef1234567890abcdef1234567890abcdef12",
): PaymentRequired => ({
  t402Version: 2,
  resource: { url: "https://api.example.com/data" },
  accepts: [
    {
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDT",
      amount: "1000000",
      payTo,
      maxTimeoutSeconds: 300,
      extra: {},
    },
  ],
  ...(withExtension && {
    extensions: {
      [ERC8004_EXTENSION_KEY]: {
        agentId: 42,
        agentRegistry: "eip155:8453:0xRegistry",
      },
    },
  }),
});

const makeContext = (paymentRequired: PaymentRequired) => ({
  paymentRequired,
  selectedRequirements: paymentRequired.accepts[0],
});

const makeA2ATask = (paymentRequired?: PaymentRequired): A2ATask => ({
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
            "t402.payment.required": paymentRequired,
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

describe("erc8004IdentityCheck", () => {
  it("aborts when identity verification fails", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0x1111111111111111111111111111111111111111"),
    };

    const hook = erc8004IdentityCheck(mockClient);
    const pr = makePaymentRequired(true, "0x2222222222222222222222222222222222222222");
    const result = await hook(makeContext(pr));

    expect(result).toEqual({
      abort: true,
      reason: expect.stringContaining("identity verification failed"),
    });
  });

  it("passes through on successful verification", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"),
    };

    const hook = erc8004IdentityCheck(mockClient);
    const pr = makePaymentRequired(true);
    const result = await hook(makeContext(pr));

    expect(result).toBeUndefined();
  });

  it("skips silently when no extension (default)", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn(),
    };

    const hook = erc8004IdentityCheck(mockClient);
    const pr = makePaymentRequired(false);
    const result = await hook(makeContext(pr));

    expect(result).toBeUndefined();
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });

  it("aborts when no extension and abortOnMissing is true", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn(),
    };

    const hook = erc8004IdentityCheck(mockClient, { abortOnMissing: true });
    const pr = makePaymentRequired(false);
    const result = await hook(makeContext(pr));

    expect(result).toEqual({
      abort: true,
      reason: expect.stringContaining("not present"),
    });
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });

  it("passes through failed verification when abortOnFailure is false", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0x1111111111111111111111111111111111111111"),
    };

    const hook = erc8004IdentityCheck(mockClient, { abortOnFailure: false });
    const pr = makePaymentRequired(true, "0x2222222222222222222222222222222222222222");
    const result = await hook(makeContext(pr));

    expect(result).toBeUndefined();
  });
});

describe("verifyAgentIdentityFromTask", () => {
  it("verifies identity from A2A task", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"),
    };

    const pr = makePaymentRequired(true);
    const task = makeA2ATask(pr);
    const result = await verifyAgentIdentityFromTask(mockClient, task);

    expect(result).toBe(true);
    expect(mockClient.readContract).toHaveBeenCalled();
  });

  it("returns false when task has no payment requirements", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn(),
    };

    const task = makeA2ATask();
    const result = await verifyAgentIdentityFromTask(mockClient, task);

    expect(result).toBe(false);
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });

  it("returns false when task has no ERC-8004 extension", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn(),
    };

    const pr = makePaymentRequired(false);
    const task = makeA2ATask(pr);
    const result = await verifyAgentIdentityFromTask(mockClient, task);

    expect(result).toBe(false);
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Server-Side Hooks
// ============================================================================

const makeVerifyContext = (
  withExtension: boolean,
  payTo = "0xabcdef1234567890abcdef1234567890abcdef12",
) => ({
  paymentPayload: {
    t402Version: 2,
    payload: { signature: "0x" },
    accepted: {
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDT",
      amount: "1000000",
      payTo,
      maxTimeoutSeconds: 300,
    },
    ...(withExtension && {
      extensions: {
        [ERC8004_EXTENSION_KEY]: {
          agentId: 42,
          agentRegistry: "eip155:8453:0xRegistry",
        },
      },
    }),
  } as PaymentPayload,
  requirements: {
    scheme: "exact",
    network: "eip155:8453",
    asset: "USDT",
    amount: "1000000",
    payTo,
    maxTimeoutSeconds: 300,
  } as PaymentRequirements,
});

describe("erc8004ReputationCheck", () => {
  it("aborts when reputation is below threshold", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([3n, 40n, 0]),
    };

    const hook = erc8004ReputationCheck(mockClient, "0xReputationRegistry", {
      minScore: 70,
      trustedReviewers: ["0xReviewer1"],
      onBelowThreshold: "reject",
    });

    const result = await hook(makeVerifyContext(true));

    expect(result).toEqual({
      abort: true,
      reason: expect.stringContaining("below minimum 70"),
    });
  });

  it("passes when reputation meets threshold", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([5n, 85n, 0]),
    };

    const hook = erc8004ReputationCheck(mockClient, "0xReputationRegistry", {
      minScore: 70,
      trustedReviewers: ["0xReviewer1"],
    });

    const result = await hook(makeVerifyContext(true));

    expect(result).toBeUndefined();
  });

  it("warns instead of aborting when onBelowThreshold is warn", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([2n, 30n, 0]),
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const hook = erc8004ReputationCheck(mockClient, "0xReputationRegistry", {
      minScore: 70,
      trustedReviewers: ["0xReviewer1"],
      onBelowThreshold: "warn",
    });

    const result = await hook(makeVerifyContext(true));

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("below minimum 70"),
    );

    warnSpy.mockRestore();
  });

  it("skips when no ERC-8004 extension", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn(),
    };

    const hook = erc8004ReputationCheck(mockClient, "0xReputationRegistry", {
      minScore: 70,
      trustedReviewers: ["0xReviewer1"],
    });

    const result = await hook(makeVerifyContext(false));

    expect(result).toBeUndefined();
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });
});

describe("erc8004ServerIdentityCheck", () => {
  it("passes when payTo matches agentWallet", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"),
    };

    const hook = erc8004ServerIdentityCheck(mockClient);
    const result = await hook(makeVerifyContext(true));

    expect(result).toBeUndefined();
  });

  it("aborts when payTo does not match agentWallet", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0x1111111111111111111111111111111111111111"),
    };

    const hook = erc8004ServerIdentityCheck(mockClient);
    const result = await hook(
      makeVerifyContext(true, "0x2222222222222222222222222222222222222222"),
    );

    expect(result).toEqual({
      abort: true,
      reason: expect.stringContaining("does not match"),
    });
  });

  it("skips when no ERC-8004 extension", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn(),
    };

    const hook = erc8004ServerIdentityCheck(mockClient);
    const result = await hook(makeVerifyContext(false));

    expect(result).toBeUndefined();
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });
});

// ============================================================================
// AfterSettle Hook
// ============================================================================

const makeSettleContext = (
  withExtension: boolean,
  success: boolean,
  payTo = "0xabcdef1234567890abcdef1234567890abcdef12",
) => ({
  paymentPayload: {
    t402Version: 2,
    payload: { signature: "0x" },
    resource: { url: "https://api.example.com/data" },
    accepted: {
      scheme: "exact",
      network: "eip155:8453",
      asset: "USDT",
      amount: "1000000",
      payTo,
      maxTimeoutSeconds: 300,
    },
    ...(withExtension && {
      extensions: {
        [ERC8004_EXTENSION_KEY]: {
          agentId: 42,
          agentRegistry: "eip155:8453:0xRegistry",
        },
      },
    }),
  } as PaymentPayload,
  requirements: {
    scheme: "exact",
    network: "eip155:8453",
    asset: "USDT",
    amount: "1000000",
    payTo,
    maxTimeoutSeconds: 300,
  } as PaymentRequirements,
  result: {
    success,
    transaction: "0xSettleTxHash",
    network: "eip155:8453",
    payer: "0xPayer",
  } as SettleResponse,
});

describe("erc8004SubmitFeedback", () => {
  it("submits feedback after successful settlement", async () => {
    const mockClient: ERC8004WriteClient = {
      readContract: vi.fn(),
      writeContract: vi.fn().mockResolvedValue("0xFeedbackTxHash"),
      waitForTransactionReceipt: vi.fn(),
    };

    const hook = erc8004SubmitFeedback(mockClient, "0xReputationRegistry");
    await hook(makeSettleContext(true, true));

    // Give fire-and-forget promise time to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(mockClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "0xReputationRegistry",
        functionName: "giveFeedback",
      }),
    );
  });

  it("skips when no ERC-8004 extension", async () => {
    const mockClient: ERC8004WriteClient = {
      readContract: vi.fn(),
      writeContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
    };

    const hook = erc8004SubmitFeedback(mockClient, "0xReputationRegistry");
    await hook(makeSettleContext(false, true));

    await new Promise((r) => setTimeout(r, 10));

    expect(mockClient.writeContract).not.toHaveBeenCalled();
  });

  it("skips when settlement was not successful", async () => {
    const mockClient: ERC8004WriteClient = {
      readContract: vi.fn(),
      writeContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
    };

    const hook = erc8004SubmitFeedback(mockClient, "0xReputationRegistry");
    await hook(makeSettleContext(true, false));

    await new Promise((r) => setTimeout(r, 10));

    expect(mockClient.writeContract).not.toHaveBeenCalled();
  });

  it("logs warning on feedback submission failure", async () => {
    const mockClient: ERC8004WriteClient = {
      readContract: vi.fn(),
      writeContract: vi.fn().mockRejectedValue(new Error("tx reverted")),
      waitForTransactionReceipt: vi.fn(),
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const hook = erc8004SubmitFeedback(mockClient, "0xReputationRegistry");
    await hook(makeSettleContext(true, true));

    // Give fire-and-forget promise time to reject and log
    await new Promise((r) => setTimeout(r, 50));

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to submit feedback"),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });

  it("builds feedback URI when config includes proof of payment", async () => {
    const mockClient: ERC8004WriteClient = {
      readContract: vi.fn(),
      writeContract: vi.fn().mockResolvedValue("0xTxHash"),
      waitForTransactionReceipt: vi.fn(),
    };

    const hook = erc8004SubmitFeedback(mockClient, "0xReputationRegistry", {
      includeProofOfPayment: true,
      feedbackBaseURI: "https://feedback.example.com",
      tag1: "paymentSuccess",
    });
    await hook(makeSettleContext(true, true));

    await new Promise((r) => setTimeout(r, 10));

    const call = (mockClient.writeContract as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.args[6]).toBe("https://feedback.example.com/0xSettleTxHash.json");
  });
});
