import { describe, it, expect, vi } from "vitest";
import { erc8004IdentityCheck, verifyAgentIdentityFromTask } from "../src/hooks";
import { ERC8004_EXTENSION_KEY } from "../src/constants";
import type { ERC8004ReadClient } from "../src/types";
import type { PaymentRequired, A2ATask } from "@t402/core/types";

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
