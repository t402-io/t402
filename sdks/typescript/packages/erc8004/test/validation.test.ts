import { describe, it, expect, vi } from "vitest";
import {
  submitValidationRequest,
  getValidationStatus,
  getValidationSummary,
} from "../src/validation";
import type { ERC8004ReadClient, ERC8004WriteClient } from "../src/types";

describe("submitValidationRequest", () => {
  it("calls writeContract with correct args", async () => {
    const mockClient: ERC8004WriteClient = {
      readContract: vi.fn(),
      writeContract: vi.fn().mockResolvedValue("0xTxHash"),
      waitForTransactionReceipt: vi.fn(),
    };

    const result = await submitValidationRequest(
      mockClient,
      "0xValidationRegistry",
      {
        validatorAddress: "0xValidator",
        agentId: 42n,
        requestURI: "https://example.com/request.json",
        requestHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      },
    );

    expect(result).toBe("0xTxHash");
    expect(mockClient.writeContract).toHaveBeenCalledWith({
      address: "0xValidationRegistry",
      abi: expect.any(Array),
      functionName: "validationRequest",
      args: [
        "0xValidator",
        42n,
        "https://example.com/request.json",
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      ],
    });
  });
});

describe("getValidationStatus", () => {
  it("returns parsed validation status", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([
        "0xValidator",
        42n,
        85,
        "0xresponseHash000000000000000000000000000000000000000000000000000000",
        "quality",
        1700000000n,
      ]),
    };

    const status = await getValidationStatus(
      mockClient,
      "0xValidationRegistry",
      "0xrequestHash0000000000000000000000000000000000000000000000000000000",
    );

    expect(status.validatorAddress).toBe("0xValidator");
    expect(status.agentId).toBe(42n);
    expect(status.response).toBe(85);
    expect(status.responseHash).toBe(
      "0xresponseHash000000000000000000000000000000000000000000000000000000",
    );
    expect(status.tag).toBe("quality");
    expect(status.lastUpdate).toBe(1700000000n);

    expect(mockClient.readContract).toHaveBeenCalledWith({
      address: "0xValidationRegistry",
      abi: expect.any(Array),
      functionName: "getValidationStatus",
      args: [
        "0xrequestHash0000000000000000000000000000000000000000000000000000000",
      ],
    });
  });

  it("returns zero response for pending validation", async () => {
    const zeroHash = ("0x" + "0".repeat(64)) as `0x${string}`;
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([
        "0x0000000000000000000000000000000000000000",
        0n,
        0,
        zeroHash,
        "",
        0n,
      ]),
    };

    const status = await getValidationStatus(
      mockClient,
      "0xValidationRegistry",
      "0xrequestHash0000000000000000000000000000000000000000000000000000000",
    );

    expect(status.response).toBe(0);
    expect(status.lastUpdate).toBe(0n);
  });
});

describe("getValidationSummary", () => {
  it("returns count and average response", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([5n, 92]),
    };

    const summary = await getValidationSummary(
      mockClient,
      "0xValidationRegistry",
      42n,
      ["0xValidator1", "0xValidator2"],
    );

    expect(summary.count).toBe(5n);
    expect(summary.averageResponse).toBe(92);
    expect(mockClient.readContract).toHaveBeenCalledWith({
      address: "0xValidationRegistry",
      abi: expect.any(Array),
      functionName: "getSummary",
      args: [42n, ["0xValidator1", "0xValidator2"], ""],
    });
  });

  it("passes tag filter to contract", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([3n, 78]),
    };

    await getValidationSummary(
      mockClient,
      "0xValidationRegistry",
      42n,
      ["0xValidator1"],
      "quality",
    );

    expect(mockClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [42n, ["0xValidator1"], "quality"],
      }),
    );
  });

  it("returns zero when no validations", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([0n, 0]),
    };

    const summary = await getValidationSummary(
      mockClient,
      "0xValidationRegistry",
      42n,
      ["0xValidator1"],
    );

    expect(summary.count).toBe(0n);
    expect(summary.averageResponse).toBe(0);
  });
});
