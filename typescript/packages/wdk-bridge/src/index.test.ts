/**
 * @t402/wdk-bridge Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Address } from "viem";
import {
  BRIDGE_CHAINS,
  CHAIN_IDS,
  USDT0_ADDRESSES,
  LAYERZERO_ENDPOINT_IDS,
  supportsBridging,
  getUsdt0Address,
  getChainId,
  getChainName,
  getEstimatedBridgeTime,
  getBridgeableChains,
  getDestinationChains,
  MIN_BRIDGE_AMOUNT,
  DEFAULT_SLIPPAGE,
} from "./constants.js";
import type { WdkAccount, RouteStrategy } from "./types.js";
import { WdkBridgeClient } from "./client.js";

/**
 * Create a mock WDK account
 */
function createMockWdkAccount(overrides?: Partial<WdkAccount>): WdkAccount {
  return {
    getAddress: vi.fn().mockResolvedValue("0x1234567890123456789012345678901234567890"),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n), // 1 ETH
    getTokenBalance: vi.fn().mockResolvedValue(100_000000n), // 100 USDT0
    signMessage: vi.fn().mockResolvedValue("0xsignature"),
    signTypedData: vi.fn().mockResolvedValue("0xsignature"),
    sendTransaction: vi.fn().mockResolvedValue("0xtxhash"),
    ...overrides,
  };
}

describe("Constants", () => {
  describe("BRIDGE_CHAINS", () => {
    it("should include supported chains", () => {
      expect(BRIDGE_CHAINS).toContain("ethereum");
      expect(BRIDGE_CHAINS).toContain("arbitrum");
      expect(BRIDGE_CHAINS).toContain("ink");
      expect(BRIDGE_CHAINS).toContain("berachain");
      expect(BRIDGE_CHAINS).toContain("unichain");
      expect(BRIDGE_CHAINS).toHaveLength(5);
    });
  });

  describe("CHAIN_IDS", () => {
    it("should have correct chain IDs", () => {
      expect(CHAIN_IDS.ethereum).toBe(1);
      expect(CHAIN_IDS.arbitrum).toBe(42161);
      expect(CHAIN_IDS.ink).toBe(57073);
      expect(CHAIN_IDS.berachain).toBe(80084);
      expect(CHAIN_IDS.unichain).toBe(130);
    });
  });

  describe("USDT0_ADDRESSES", () => {
    it("should have addresses for all chains", () => {
      for (const chain of BRIDGE_CHAINS) {
        expect(USDT0_ADDRESSES[chain]).toBeDefined();
        expect(USDT0_ADDRESSES[chain]).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });
  });

  describe("LAYERZERO_ENDPOINT_IDS", () => {
    it("should have endpoint IDs for all chains", () => {
      for (const chain of BRIDGE_CHAINS) {
        expect(LAYERZERO_ENDPOINT_IDS[chain]).toBeDefined();
        expect(typeof LAYERZERO_ENDPOINT_IDS[chain]).toBe("number");
      }
    });
  });

  describe("supportsBridging", () => {
    it("should return true for supported chains", () => {
      expect(supportsBridging("ethereum")).toBe(true);
      expect(supportsBridging("arbitrum")).toBe(true);
      expect(supportsBridging("ETHEREUM")).toBe(true); // Case insensitive
    });

    it("should return false for unsupported chains", () => {
      expect(supportsBridging("solana")).toBe(false);
      expect(supportsBridging("bitcoin")).toBe(false);
      expect(supportsBridging("")).toBe(false);
    });
  });

  describe("getUsdt0Address", () => {
    it("should return address for supported chains", () => {
      expect(getUsdt0Address("ethereum")).toBe(USDT0_ADDRESSES.ethereum);
      expect(getUsdt0Address("ARBITRUM")).toBe(USDT0_ADDRESSES.arbitrum);
    });

    it("should return undefined for unsupported chains", () => {
      expect(getUsdt0Address("solana")).toBeUndefined();
    });
  });

  describe("getChainId", () => {
    it("should return chain ID for supported chains", () => {
      expect(getChainId("ethereum")).toBe(1);
      expect(getChainId("arbitrum")).toBe(42161);
    });

    it("should return undefined for unsupported chains", () => {
      expect(getChainId("solana")).toBeUndefined();
    });
  });

  describe("getChainName", () => {
    it("should return chain name for valid IDs", () => {
      expect(getChainName(1)).toBe("ethereum");
      expect(getChainName(42161)).toBe("arbitrum");
    });

    it("should return undefined for unknown IDs", () => {
      expect(getChainName(999999)).toBeUndefined();
    });
  });

  describe("getEstimatedBridgeTime", () => {
    it("should return estimated time for routes", () => {
      const time = getEstimatedBridgeTime("ethereum", "arbitrum");
      expect(typeof time).toBe("number");
      expect(time).toBeGreaterThan(0);
    });

    it("should return default time for unknown routes", () => {
      const time = getEstimatedBridgeTime("unknown", "ethereum");
      expect(time).toBe(300); // DEFAULT_BRIDGE_TIME
    });
  });

  describe("getBridgeableChains", () => {
    it("should return all bridgeable chains", () => {
      const chains = getBridgeableChains();
      expect(chains).toEqual(expect.arrayContaining(["ethereum", "arbitrum"]));
      expect(chains).toHaveLength(5);
    });
  });

  describe("getDestinationChains", () => {
    it("should return destinations excluding source", () => {
      const destinations = getDestinationChains("ethereum");
      expect(destinations).not.toContain("ethereum");
      expect(destinations).toContain("arbitrum");
      expect(destinations).toHaveLength(4);
    });

    it("should return empty for unsupported chains", () => {
      const destinations = getDestinationChains("solana");
      expect(destinations).toEqual([]);
    });
  });

  describe("MIN_BRIDGE_AMOUNT", () => {
    it("should be 1 USDT0 (1_000000)", () => {
      expect(MIN_BRIDGE_AMOUNT).toBe(1_000000n);
    });
  });

  describe("DEFAULT_SLIPPAGE", () => {
    it("should be 0.5%", () => {
      expect(DEFAULT_SLIPPAGE).toBe(0.5);
    });
  });
});

describe("WdkBridgeClient", () => {
  let mockAccount: WdkAccount;

  beforeEach(() => {
    mockAccount = createMockWdkAccount();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create client with valid accounts", () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      });

      expect(client.getConfiguredChains()).toContain("ethereum");
      expect(client.getConfiguredChains()).toContain("arbitrum");
    });

    it("should throw for unsupported chains", () => {
      expect(
        () =>
          new WdkBridgeClient({
            accounts: {
              solana: mockAccount,
            },
          }),
      ).toThrow(/does not support USDT0 bridging/);
    });

    it("should throw for empty accounts", () => {
      expect(
        () =>
          new WdkBridgeClient({
            accounts: {},
          }),
      ).toThrow(/At least one WDK account must be provided/);
    });

    it("should normalize chain names to lowercase", () => {
      const client = new WdkBridgeClient({
        accounts: {
          ETHEREUM: mockAccount,
          Arbitrum: mockAccount,
        },
      });

      expect(client.getConfiguredChains()).toContain("ethereum");
      expect(client.getConfiguredChains()).toContain("arbitrum");
    });

    it("should accept custom default strategy", () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
        defaultStrategy: "fastest",
      });

      expect(client).toBeDefined();
    });

    it("should accept custom default slippage", () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
        defaultSlippage: 1.0,
      });

      expect(client).toBeDefined();
    });
  });

  describe("hasChain", () => {
    it("should return true for configured chains", () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      });

      expect(client.hasChain("ethereum")).toBe(true);
      expect(client.hasChain("ETHEREUM")).toBe(true);
    });

    it("should return false for unconfigured chains", () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      });

      expect(client.hasChain("arbitrum")).toBe(false);
    });
  });

  describe("getConfiguredChains", () => {
    it("should return all configured chains", () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
          ink: mockAccount,
        },
      });

      const chains = client.getConfiguredChains();
      expect(chains).toHaveLength(3);
      expect(chains).toContain("ethereum");
      expect(chains).toContain("arbitrum");
      expect(chains).toContain("ink");
    });
  });

  describe("setRpcUrl", () => {
    it("should set RPC URL for chain", () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      });

      // Should not throw
      client.setRpcUrl("ethereum", "https://eth.example.com");
    });
  });

  describe("getChainBalance", () => {
    it("should return balance info", async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      });

      const balance = await client.getChainBalance("ethereum");

      expect(balance.chain).toBe("ethereum");
      expect(balance.chainId).toBe(1);
      expect(balance.usdt0Balance).toBe(100_000000n);
      expect(balance.nativeBalance).toBe(1000000000000000000n);
      expect(balance.canBridge).toBe(true);
    });

    it("should mark canBridge false when balance below minimum", async () => {
      const lowBalanceAccount = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(100n), // 0.0001 USDT0
      });

      const client = new WdkBridgeClient({
        accounts: { ethereum: lowBalanceAccount },
      });

      const balance = await client.getChainBalance("ethereum");
      expect(balance.canBridge).toBe(false);
    });

    it("should throw for unconfigured chain", async () => {
      const client = new WdkBridgeClient({
        accounts: { ethereum: mockAccount },
      });

      await expect(client.getChainBalance("arbitrum")).rejects.toThrow(
        /No WDK account configured/,
      );
    });
  });

  describe("getBalances", () => {
    it("should return balances for all chains", async () => {
      const client = new WdkBridgeClient({
        accounts: {
          ethereum: mockAccount,
          arbitrum: mockAccount,
        },
      });

      const summary = await client.getBalances();

      expect(summary.balances).toHaveLength(2);
      expect(summary.totalUsdt0).toBe(200_000000n); // 100 * 2
      expect(summary.chainsWithBalance).toHaveLength(2);
      expect(summary.bridgeableChains).toHaveLength(2);
    });

    it("should correctly calculate total across chains", async () => {
      const account1 = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(50_000000n),
      });
      const account2 = createMockWdkAccount({
        getTokenBalance: vi.fn().mockResolvedValue(150_000000n),
      });

      const client = new WdkBridgeClient({
        accounts: {
          ethereum: account1,
          arbitrum: account2,
        },
      });

      const summary = await client.getBalances();
      expect(summary.totalUsdt0).toBe(200_000000n);
    });
  });
});

describe("Types", () => {
  it("should have RouteStrategy type", () => {
    const strategies: RouteStrategy[] = ["cheapest", "fastest", "preferred"];
    expect(strategies).toHaveLength(3);
  });
});
