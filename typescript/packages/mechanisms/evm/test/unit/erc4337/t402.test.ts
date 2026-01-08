import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PublicClient } from "viem";
import {
  GaslessT402Client,
  createGaslessT402Client,
} from "../../../src/erc4337/t402";
import type {
  SmartAccountSigner,
  PaymasterConfig,
  BundlerConfig,
} from "../../../src/erc4337/types";

describe("GaslessT402Client", () => {
  let mockSigner: SmartAccountSigner;
  let mockPublicClient: PublicClient;
  let mockFetch: ReturnType<typeof vi.fn>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    mockSigner = {
      getAddress: vi.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
      signUserOpHash: vi
        .fn()
        .mockResolvedValue(
          "0x" + "ab".repeat(65), // 65 bytes = r(32) + s(32) + v(1)
        ),
      getInitCode: vi.fn().mockResolvedValue("0x"),
      isDeployed: vi.fn().mockResolvedValue(true),
      encodeExecute: vi.fn().mockReturnValue("0xencodedexecute"),
      encodeExecuteBatch: vi.fn().mockReturnValue("0xencodedbatch"),
    };

    mockPublicClient = {
      readContract: vi.fn().mockResolvedValue(0n),
      getBlock: vi.fn().mockResolvedValue({ baseFeePerGas: 1000000000n }),
    } as unknown as PublicClient;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("constructor", () => {
    it("should create client without paymaster", () => {
      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });
      expect(client).toBeDefined();
    });

    it("should create client with paymaster", () => {
      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        paymaster: {
          address: "0xPaymaster123456789012345678901234567890",
          type: "sponsoring",
          url: "https://paymaster.example.com",
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });
      expect(client).toBeDefined();
    });
  });

  describe("createGaslessT402Client", () => {
    it("should create a client instance", () => {
      const client = createGaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });
      expect(client).toBeInstanceOf(GaslessT402Client);
    });
  });

  describe("getAccountAddress", () => {
    it("should return smart account address", async () => {
      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const address = await client.getAccountAddress();
      expect(address).toBe("0x1234567890123456789012345678901234567890");
    });
  });

  describe("isAccountDeployed", () => {
    it("should return true for deployed account", async () => {
      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const deployed = await client.isAccountDeployed();
      expect(deployed).toBe(true);
    });

    it("should return false for undeployed account", async () => {
      mockSigner.isDeployed = vi.fn().mockResolvedValue(false);

      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const deployed = await client.isAccountDeployed();
      expect(deployed).toBe(false);
    });
  });

  describe("executePayment", () => {
    it("should execute a simple transfer payment", async () => {
      // Mock bundler responses
      mockFetch
        .mockResolvedValueOnce({
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
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: 2,
              result: "0xuserophash123",
            }),
        });

      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const result = await client.executePayment({
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amount: 1000000n,
      });

      expect(result.userOpHash).toBe("0xuserophash123");
      expect(typeof result.wait).toBe("function");
    });

    it("should encode call data for transfer", async () => {
      mockFetch
        .mockResolvedValueOnce({
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
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: 2,
              result: "0xuserophash123",
            }),
        });

      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      await client.executePayment({
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amount: 1000000n,
      });

      // Should have called encodeExecute with token address and encoded transfer
      expect(mockSigner.encodeExecute).toHaveBeenCalled();
    });
  });

  describe("executeBatchPayments", () => {
    it("should execute multiple payments in one operation", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: 1,
              result: {
                verificationGasLimit: "0x249f0",
                callGasLimit: "0x30d40", // Higher for batch
                preVerificationGas: "0xc350",
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: 2,
              result: "0xbatchuserophash",
            }),
        });

      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const result = await client.executeBatchPayments([
        {
          tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          amount: 1000000n,
        },
        {
          tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          to: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          amount: 2000000n,
        },
      ]);

      expect(result.userOpHash).toBe("0xbatchuserophash");
      expect(mockSigner.encodeExecuteBatch).toHaveBeenCalled();
    });
  });

  describe("canSponsor", () => {
    it("should return false without paymaster", async () => {
      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const canSponsor = await client.canSponsor({
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amount: 1000000n,
      });

      expect(canSponsor).toBe(false);
    });

    it("should check with paymaster service", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ willSponsor: true }),
      });

      const client = new GaslessT402Client({
        signer: mockSigner,
        bundler: {
          bundlerUrl: "https://bundler.example.com",
          chainId: 42161,
        },
        paymaster: {
          address: "0xPaymaster123456789012345678901234567890",
          type: "sponsoring",
          url: "https://paymaster.example.com",
        },
        chainId: 42161,
        publicClient: mockPublicClient,
      });

      const canSponsor = await client.canSponsor({
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        amount: 1000000n,
      });

      expect(canSponsor).toBe(true);
    });
  });
});
