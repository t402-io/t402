/**
 * Mock helpers for integration tests
 */

import { vi } from "vitest";
import type { Address, Hex, PublicClient } from "viem";
import type { WDKSigner } from "@t402/wdk";

/**
 * Create a mock WDK signer
 */
export function createMockWDKSigner(
  address: Address,
  signatureResponse: Hex = "0x" + "ab".repeat(65) as Hex,
): WDKSigner {
  return {
    address,
    isInitialized: true,
    initialize: vi.fn().mockResolvedValue(undefined),
    signMessage: vi.fn().mockResolvedValue(signatureResponse),
    signTypedData: vi.fn().mockResolvedValue(signatureResponse),
  } as unknown as WDKSigner;
}

/**
 * Create multiple mock WDK signers with deterministic addresses
 */
export function createMockWDKSigners(count: number): WDKSigner[] {
  const addresses: Address[] = [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333",
    "0x4444444444444444444444444444444444444444",
    "0x5555555555555555555555555555555555555555",
  ];

  return addresses.slice(0, count).map((address, index) => {
    const sig = "0x" + (index + 1).toString().repeat(130) as Hex;
    return createMockWDKSigner(address, sig);
  });
}

/**
 * Create a mock public client
 */
export function createMockPublicClient(): PublicClient {
  return {
    readContract: vi.fn().mockImplementation(async ({ functionName }) => {
      if (functionName === "proxyCreationCode") {
        // Return mock bytecode for address computation
        return "0x" + "00".repeat(100) as Hex;
      }
      if (functionName === "balanceOf") {
        return 1000000n; // 1 USDT
      }
      return 0n;
    }),
    getCode: vi.fn().mockResolvedValue("0x"),
    getBlock: vi.fn().mockResolvedValue({ baseFeePerGas: 1000000000n }),
    call: vi.fn().mockResolvedValue({ data: "0x" }),
    estimateGas: vi.fn().mockResolvedValue(100000n),
    getGasPrice: vi.fn().mockResolvedValue(1000000000n),
    getChainId: vi.fn().mockResolvedValue(42161),
    getBlockNumber: vi.fn().mockResolvedValue(1000000n),
  } as unknown as PublicClient;
}

/**
 * Create mock fetch for bundler/paymaster requests
 */
export function createMockFetch() {
  let requestCount = 0;

  return vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string);
    requestCount++;

    // Handle different JSON-RPC methods
    switch (body.method) {
      case "eth_estimateUserOperationGas":
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: body.id,
              result: {
                preVerificationGas: "0x10000",
                verificationGasLimit: "0x30000",
                callGasLimit: "0x20000",
              },
            }),
        };

      case "eth_sendUserOperation":
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: body.id,
              result: "0x" + "ab".repeat(32), // userOpHash
            }),
        };

      case "eth_getUserOperationReceipt":
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: body.id,
              result: {
                userOpHash: "0x" + "ab".repeat(32),
                sender: "0x" + "11".repeat(20),
                nonce: "0x0",
                success: true,
                actualGasUsed: "0x10000",
                actualGasCost: "0x100000000",
                logs: [],
                receipt: {
                  transactionHash: "0x" + "cd".repeat(32),
                  transactionIndex: "0x0",
                  blockHash: "0x" + "ef".repeat(32),
                  blockNumber: "0x100000",
                  from: "0x" + "22".repeat(20),
                  to: "0x" + "33".repeat(20),
                  cumulativeGasUsed: "0x10000",
                  gasUsed: "0x10000",
                  contractAddress: null,
                  logs: [],
                  logsBloom: "0x" + "00".repeat(256),
                  status: "0x1",
                  effectiveGasPrice: "0x3b9aca00",
                },
              },
            }),
        };

      case "eth_getUserOperationByHash":
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: body.id,
              result: {
                userOperation: {},
                entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
                blockNumber: "0x100000",
                blockHash: "0x" + "ef".repeat(32),
                transactionHash: "0x" + "cd".repeat(32),
              },
            }),
        };

      case "pm_getPaymasterData":
      case "pm_sponsorUserOperation":
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: body.id,
              result: {
                paymaster: "0x" + "99".repeat(20),
                paymasterData: "0x",
                paymasterVerificationGasLimit: "0x10000",
                paymasterPostOpGasLimit: "0x10000",
              },
            }),
        };

      case "eth_supportedEntryPoints":
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: body.id,
              result: ["0x0000000071727De22E5E9d8BAf0edAc6f37da032"],
            }),
        };

      default:
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              jsonrpc: "2.0",
              id: body.id,
              result: null,
            }),
        };
    }
  });
}

/**
 * Test addresses
 */
export const TEST_ADDRESSES = {
  owner1: "0x1111111111111111111111111111111111111111" as Address,
  owner2: "0x2222222222222222222222222222222222222222" as Address,
  owner3: "0x3333333333333333333333333333333333333333" as Address,
  recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address,
  safe: "0x9999999999999999999999999999999999999999" as Address,
  token: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as Address, // USDT on Arbitrum
};

/**
 * Mock bundler config
 */
export const MOCK_BUNDLER_CONFIG = {
  bundlerUrl: "https://mock-bundler.example.com/rpc",
  chainId: 42161,
};

/**
 * Mock paymaster config
 */
export const MOCK_PAYMASTER_CONFIG = {
  url: "https://mock-paymaster.example.com/rpc",
  address: "0x" + "99".repeat(20) as Address,
  type: "sponsoring" as const,
};
