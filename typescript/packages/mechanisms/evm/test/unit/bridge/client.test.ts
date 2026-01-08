import { describe, it, expect, beforeEach, vi } from "vitest";
import { Usdt0Bridge, createUsdt0Bridge } from "../../../src/bridge/client";
import type { BridgeSigner } from "../../../src/bridge/types";

describe("Usdt0Bridge", () => {
  let mockSigner: BridgeSigner;

  beforeEach(() => {
    mockSigner = {
      address: "0x1234567890123456789012345678901234567890",
      readContract: vi.fn().mockResolvedValue({
        nativeFee: 1000000000000000n, // 0.001 ETH
        lzTokenFee: 0n,
      }),
      writeContract: vi.fn().mockResolvedValue("0xtxhash123"),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
    };
  });

  describe("constructor", () => {
    it("should create bridge for supported chain", () => {
      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");
      expect(bridge).toBeDefined();
    });

    it("should throw for unsupported chain", () => {
      expect(() => new Usdt0Bridge(mockSigner, "base")).toThrow(
        'Chain "base" does not support USDT0 bridging',
      );
    });

    it("should throw for unknown chain", () => {
      expect(() => new Usdt0Bridge(mockSigner, "unknown")).toThrow(
        'Chain "unknown" does not support USDT0 bridging',
      );
    });
  });

  describe("getSupportedDestinations", () => {
    it("should return all chains except source", () => {
      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");
      const destinations = bridge.getSupportedDestinations();

      expect(destinations).toContain("ethereum");
      expect(destinations).toContain("ink");
      expect(destinations).not.toContain("arbitrum"); // Exclude source
    });
  });

  describe("supportsDestination", () => {
    it("should return true for valid destinations", () => {
      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      expect(bridge.supportsDestination("ethereum")).toBe(true);
      expect(bridge.supportsDestination("ink")).toBe(true);
    });

    it("should return false for same chain", () => {
      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      expect(bridge.supportsDestination("arbitrum")).toBe(false);
    });

    it("should return false for non-bridgeable chains", () => {
      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      expect(bridge.supportsDestination("base")).toBe(false);
    });
  });

  describe("quote", () => {
    it("should return quote for valid bridge", async () => {
      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      const quote = await bridge.quote({
        fromChain: "arbitrum",
        toChain: "ethereum",
        amount: 100_000000n, // 100 USDT0
        recipient: "0x9999999999999999999999999999999999999999",
      });

      expect(quote.nativeFee).toBe(1000000000000000n);
      expect(quote.amountToSend).toBe(100_000000n);
      expect(quote.fromChain).toBe("arbitrum");
      expect(quote.toChain).toBe("ethereum");
      expect(quote.estimatedTime).toBeGreaterThan(0);
    });

    it("should throw if source chain doesn't match", async () => {
      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      await expect(
        bridge.quote({
          fromChain: "ethereum", // Wrong chain
          toChain: "ink",
          amount: 100_000000n,
          recipient: "0x9999999999999999999999999999999999999999",
        }),
      ).rejects.toThrow("Source chain mismatch");
    });

    it("should throw for same source and destination", async () => {
      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      await expect(
        bridge.quote({
          fromChain: "arbitrum",
          toChain: "arbitrum",
          amount: 100_000000n,
          recipient: "0x9999999999999999999999999999999999999999",
        }),
      ).rejects.toThrow("Source and destination chains must be different");
    });

    it("should throw for zero amount", async () => {
      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      await expect(
        bridge.quote({
          fromChain: "arbitrum",
          toChain: "ethereum",
          amount: 0n,
          recipient: "0x9999999999999999999999999999999999999999",
        }),
      ).rejects.toThrow("Amount must be greater than 0");
    });
  });

  describe("send", () => {
    it("should execute bridge transaction", async () => {
      // Mock allowance check - sufficient allowance
      mockSigner.readContract = vi.fn().mockImplementation(({ functionName }) => {
        if (functionName === "quoteSend") {
          return Promise.resolve({
            nativeFee: 1000000000000000n,
            lzTokenFee: 0n,
          });
        }
        if (functionName === "allowance") {
          return Promise.resolve(1000_000000n); // Sufficient allowance
        }
        return Promise.resolve(0n);
      });

      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      const result = await bridge.send({
        fromChain: "arbitrum",
        toChain: "ethereum",
        amount: 100_000000n,
        recipient: "0x9999999999999999999999999999999999999999",
      });

      expect(result.txHash).toBe("0xtxhash123");
      expect(result.amountSent).toBe(100_000000n);
      expect(result.fromChain).toBe("arbitrum");
      expect(result.toChain).toBe("ethereum");
    });

    it("should approve if allowance is insufficient", async () => {
      let approvalCalled = false;

      mockSigner.readContract = vi.fn().mockImplementation(({ functionName }) => {
        if (functionName === "quoteSend") {
          return Promise.resolve({
            nativeFee: 1000000000000000n,
            lzTokenFee: 0n,
          });
        }
        if (functionName === "allowance") {
          return Promise.resolve(0n); // No allowance
        }
        return Promise.resolve(0n);
      });

      mockSigner.writeContract = vi.fn().mockImplementation(({ functionName }) => {
        if (functionName === "approve") {
          approvalCalled = true;
          return Promise.resolve("0xapprovetx");
        }
        return Promise.resolve("0xsendtx");
      });

      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      await bridge.send({
        fromChain: "arbitrum",
        toChain: "ethereum",
        amount: 100_000000n,
        recipient: "0x9999999999999999999999999999999999999999",
      });

      expect(approvalCalled).toBe(true);
    });

    it("should throw if transaction fails", async () => {
      mockSigner.readContract = vi.fn().mockResolvedValue({
        nativeFee: 1000000000000000n,
        lzTokenFee: 0n,
      });

      mockSigner.waitForTransactionReceipt = vi
        .fn()
        .mockResolvedValue({ status: "reverted" });

      const bridge = new Usdt0Bridge(mockSigner, "arbitrum");

      await expect(
        bridge.send({
          fromChain: "arbitrum",
          toChain: "ethereum",
          amount: 100_000000n,
          recipient: "0x9999999999999999999999999999999999999999",
        }),
      ).rejects.toThrow("Bridge transaction failed");
    });
  });

  describe("createUsdt0Bridge", () => {
    it("should create bridge instance", () => {
      const bridge = createUsdt0Bridge(mockSigner, "ethereum");
      expect(bridge).toBeInstanceOf(Usdt0Bridge);
    });
  });
});
