import { describe, it, expect, vi } from "vitest";
import { getReputationSummary, buildFeedbackFile, submitFeedback } from "../src/reputation";
import type { ERC8004ReadClient, ERC8004WriteClient } from "../src/types";

describe("getReputationSummary", () => {
  it("returns normalized score from contract", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue([5n, 425n, 1]),
    };

    const summary = await getReputationSummary(
      mockClient,
      "0xReputationRegistry",
      42n,
      ["0xReviewer1", "0xReviewer2"],
    );

    expect(summary.agentId).toBe(42n);
    expect(summary.count).toBe(5n);
    expect(summary.summaryValue).toBe(425n);
    expect(summary.summaryValueDecimals).toBe(1);
    expect(summary.normalizedScore).toBe(42.5);
    expect(mockClient.readContract).toHaveBeenCalledWith({
      address: "0xReputationRegistry",
      abi: expect.any(Array),
      functionName: "getSummary",
      args: [42n, ["0xReviewer1", "0xReviewer2"], "", ""],
    });
  });

  it("returns zero score when no feedback", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([0n, 0n, 0]),
    };

    const summary = await getReputationSummary(
      mockClient,
      "0xReputationRegistry",
      42n,
      ["0xReviewer1"],
    );

    expect(summary.normalizedScore).toBe(0);
    expect(summary.count).toBe(0n);
  });

  it("caps score at 100", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([3n, 150n, 0]),
    };

    const summary = await getReputationSummary(
      mockClient,
      "0xReputationRegistry",
      42n,
      ["0xReviewer1"],
    );

    expect(summary.normalizedScore).toBe(100);
  });

  it("floors score at 0", async () => {
    // Negative summaryValue (encoded as bigint)
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([2n, -50n, 0]),
    };

    const summary = await getReputationSummary(
      mockClient,
      "0xReputationRegistry",
      42n,
      ["0xReviewer1"],
    );

    expect(summary.normalizedScore).toBe(0);
  });

  it("passes tag filters to contract", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([1n, 95n, 0]),
    };

    await getReputationSummary(
      mockClient,
      "0xReputationRegistry",
      42n,
      ["0xReviewer1"],
      "paymentSuccess",
      "responseTime",
    );

    expect(mockClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [42n, ["0xReviewer1"], "paymentSuccess", "responseTime"],
      }),
    );
  });
});

describe("buildFeedbackFile", () => {
  it("creates feedback file without proof of payment", () => {
    const file = buildFeedbackFile(
      42,
      "eip155:8453:0xRegistry",
      "0xClient",
      100,
      0,
      "paymentSuccess",
      "",
    );

    expect(file.agentId).toBe(42);
    expect(file.agentRegistry).toBe("eip155:8453:0xRegistry");
    expect(file.clientAddress).toBe("0xClient");
    expect(file.value).toBe(100);
    expect(file.valueDecimals).toBe(0);
    expect(file.tag1).toBe("paymentSuccess");
    expect(file.tag2).toBe("");
    expect(file.createdAt).toBeDefined();
    expect(file.proofOfPayment).toBeUndefined();
  });

  it("includes proof of payment when provided", () => {
    const proof = {
      fromAddress: "0xPayer",
      toAddress: "0xPayee",
      chainId: "eip155:8453",
      txHash: "0xabc123",
    };

    const file = buildFeedbackFile(
      42,
      "eip155:8453:0xRegistry",
      "0xClient",
      100,
      0,
      "paymentSuccess",
      "responseTime",
      proof,
    );

    expect(file.proofOfPayment).toEqual(proof);
    expect(file.tag2).toBe("responseTime");
  });

  it("produces valid ISO timestamp", () => {
    const file = buildFeedbackFile(
      1,
      "eip155:1:0xRegistry",
      "0xClient",
      50,
      1,
      "starred",
      "",
    );

    expect(() => new Date(file.createdAt)).not.toThrow();
    expect(new Date(file.createdAt).toISOString()).toBe(file.createdAt);
  });
});

describe("submitFeedback", () => {
  it("calls writeContract with correct args", async () => {
    const mockClient: ERC8004WriteClient = {
      readContract: vi.fn(),
      writeContract: vi.fn().mockResolvedValue("0xTxHash"),
      waitForTransactionReceipt: vi.fn(),
    };

    const result = await submitFeedback(mockClient, "0xReputationRegistry", {
      agentId: 42n,
      value: 100n,
      valueDecimals: 0,
      tag1: "paymentSuccess",
      tag2: "responseTime",
      endpoint: "https://api.example.com/data",
      feedbackURI: "https://feedback.example.com/42.json",
      feedbackHash: "0xabcdef",
    });

    expect(result).toBe("0xTxHash");
    expect(mockClient.writeContract).toHaveBeenCalledWith({
      address: "0xReputationRegistry",
      abi: expect.any(Array),
      functionName: "giveFeedback",
      args: [
        42n,
        100n,
        0,
        "paymentSuccess",
        "responseTime",
        "https://api.example.com/data",
        "https://feedback.example.com/42.json",
        "0xabcdef",
      ],
    });
  });

  it("uses defaults for optional params", async () => {
    const mockClient: ERC8004WriteClient = {
      readContract: vi.fn(),
      writeContract: vi.fn().mockResolvedValue("0xTxHash"),
      waitForTransactionReceipt: vi.fn(),
    };

    await submitFeedback(mockClient, "0xReputationRegistry", {
      agentId: 1n,
      value: 50n,
      valueDecimals: 1,
      tag1: "starred",
      tag2: "",
    });

    const call = (mockClient.writeContract as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.args[5]).toBe(""); // endpoint default
    expect(call.args[6]).toBe(""); // feedbackURI default
    expect(call.args[7]).toBe("0x" + "0".repeat(64)); // feedbackHash default
  });
});
