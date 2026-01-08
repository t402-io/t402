import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BundlerClient,
  BundlerError,
  createBundlerClient,
} from "../../../src/erc4337/bundler";
import type { UserOperation } from "../../../src/erc4337/types";

describe("BundlerClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should create bundler client with config", () => {
      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });
      expect(client).toBeDefined();
    });
  });

  describe("createBundlerClient", () => {
    it("should create a bundler client instance", () => {
      const client = createBundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });
      expect(client).toBeInstanceOf(BundlerClient);
    });
  });

  describe("sendUserOperation", () => {
    it("should send UserOperation and return hash", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            id: 1,
            result: "0xuserophash123",
          }),
      });

      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });

      const userOp: UserOperation = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: 0n,
        initCode: "0x",
        callData: "0x",
        verificationGasLimit: 150000n,
        callGasLimit: 100000n,
        preVerificationGas: 50000n,
        maxPriorityFeePerGas: 1500000000n,
        maxFeePerGas: 30000000000n,
        paymasterAndData: "0x",
        signature: "0xsig",
      };

      const result = await client.sendUserOperation(userOp);

      expect(result.userOpHash).toBe("0xuserophash123");
      expect(typeof result.wait).toBe("function");
    });

    it("should throw BundlerError on RPC error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            id: 1,
            error: {
              code: -32000,
              message: "AA21 didn't pay prefund",
            },
          }),
      });

      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });

      const userOp: UserOperation = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: 0n,
        initCode: "0x",
        callData: "0x",
        verificationGasLimit: 150000n,
        callGasLimit: 100000n,
        preVerificationGas: 50000n,
        maxPriorityFeePerGas: 1500000000n,
        maxFeePerGas: 30000000000n,
        paymasterAndData: "0x",
        signature: "0xsig",
      };

      await expect(client.sendUserOperation(userOp)).rejects.toThrow(
        "AA21 didn't pay prefund",
      );
    });
  });

  describe("estimateUserOperationGas", () => {
    it("should return gas estimate", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            id: 1,
            result: {
              verificationGasLimit: "0x249f0",
              callGasLimit: "0x186a0",
              preVerificationGas: "0xc350",
            },
          }),
      });

      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });

      const estimate = await client.estimateUserOperationGas({
        sender: "0x1234567890123456789012345678901234567890",
        callData: "0x",
      });

      expect(estimate.verificationGasLimit).toBe(150000n);
      expect(estimate.callGasLimit).toBe(100000n);
      expect(estimate.preVerificationGas).toBe(50000n);
    });

    it("should include paymaster gas if provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            id: 1,
            result: {
              verificationGasLimit: "0x249f0",
              callGasLimit: "0x186a0",
              preVerificationGas: "0xc350",
              paymasterVerificationGasLimit: "0xc350",
              paymasterPostOpGasLimit: "0x7530",
            },
          }),
      });

      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });

      const estimate = await client.estimateUserOperationGas({
        sender: "0x1234567890123456789012345678901234567890",
        callData: "0x",
      });

      expect(estimate.paymasterVerificationGasLimit).toBe(50000n);
      expect(estimate.paymasterPostOpGasLimit).toBe(30000n);
    });
  });

  describe("getUserOperationReceipt", () => {
    it("should return receipt when available", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            id: 1,
            result: {
              userOpHash: "0xuserophash123",
              sender: "0x1234567890123456789012345678901234567890",
              nonce: "0x5",
              actualGasCost: "0x2386f26fc10000",
              actualGasUsed: "0x30d40",
              success: true,
              receipt: {
                transactionHash: "0xtxhash",
                blockNumber: "0x1234",
                blockHash: "0xblockhash",
              },
            },
          }),
      });

      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });

      const receipt = await client.getUserOperationReceipt("0xuserophash123");

      expect(receipt).not.toBeNull();
      expect(receipt!.userOpHash).toBe("0xuserophash123");
      expect(receipt!.success).toBe(true);
      expect(receipt!.actualGasCost).toBe(10000000000000000n);
      expect(receipt!.nonce).toBe(5n);
    });

    it("should return null when not found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            id: 1,
            result: null,
          }),
      });

      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });

      const receipt = await client.getUserOperationReceipt("0xuserophash123");
      expect(receipt).toBeNull();
    });
  });

  describe("getSupportedEntryPoints", () => {
    it("should return supported entry points", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            id: 1,
            result: [
              "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
              "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
            ],
          }),
      });

      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });

      const entryPoints = await client.getSupportedEntryPoints();

      expect(entryPoints).toHaveLength(2);
      expect(entryPoints).toContain("0x0000000071727De22E5E9d8BAf0edAc6f37da032");
    });
  });

  describe("getChainId", () => {
    it("should return chain ID from bundler", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            jsonrpc: "2.0",
            id: 1,
            result: "0xa4b1",
          }),
      });

      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });

      const chainId = await client.getChainId();
      expect(chainId).toBe(42161);
    });
  });

  describe("HTTP error handling", () => {
    it("should throw on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const client = new BundlerClient({
        bundlerUrl: "https://bundler.example.com",
        chainId: 42161,
      });

      await expect(client.getSupportedEntryPoints()).rejects.toThrow(
        "HTTP error: 500 Internal Server Error",
      );
    });
  });
});

describe("BundlerError", () => {
  it("should create error with message", () => {
    const error = new BundlerError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("BundlerError");
  });

  it("should include code and data", () => {
    const error = new BundlerError("Test error", -32000, { extra: "data" });
    expect(error.code).toBe(-32000);
    expect(error.data).toEqual({ extra: "data" });
  });
});
