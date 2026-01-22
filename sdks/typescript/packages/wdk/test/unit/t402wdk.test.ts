import { describe, it, expect, beforeEach, vi } from "vitest";
import { T402WDK } from "../../src/t402wdk";
import { WDKInitializationError, ChainError, BridgeError } from "../../src/errors";
import type { WDKConstructor, WDKInstance, WDKAccount } from "../../src/types";

// Mock WDK Account
function createMockAccount(address: string): WDKAccount {
  return {
    getAddress: vi.fn().mockResolvedValue(address),
    getBalance: vi.fn().mockResolvedValue(1000000000000000000n), // 1 ETH
    getTokenBalance: vi.fn().mockResolvedValue(1000000n), // 1 USDT0
    signMessage: vi.fn().mockResolvedValue("0xsignature"),
    signTypedData: vi.fn().mockResolvedValue("0xtypedSignature"),
    sendTransaction: vi.fn().mockResolvedValue("0xtxhash"),
    estimateGas: vi.fn().mockResolvedValue(21000n),
  };
}

// Mock WDK Instance
function createMockWDK(): WDKInstance {
  const mockAccount = createMockAccount("0x1234567890123456789012345678901234567890");

  return {
    registerWallet: vi.fn().mockReturnThis(),
    registerProtocol: vi.fn().mockReturnThis(),
    getAccount: vi.fn().mockResolvedValue(mockAccount),
    executeProtocol: vi.fn().mockResolvedValue({ txHash: "0xbridgehash" }),
  };
}

// Mock WDK Constructor
const MockWDKConstructor: WDKConstructor = class MockWDK {
  constructor(_seedPhrase: string) {
    return createMockWDK() as unknown as WDKInstance;
  }

  static getRandomSeedPhrase(): string {
    return "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about word one two three four five six seven eight nine ten eleven twelve";
  }
} as unknown as WDKConstructor;

// Mock Wallet Manager
const MockWalletManagerEvm = {};

// Mock Bridge Protocol
const MockBridgeUsdt0Evm = {};

const VALID_SEED_PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("T402WDK", () => {
  beforeEach(() => {
    // Reset WDK registration before each test
    // @ts-expect-error - accessing private static for testing
    T402WDK._WDK = null;
    // @ts-expect-error - accessing private static for testing
    T402WDK._WalletManagerEvm = null;
    // @ts-expect-error - accessing private static for testing
    T402WDK._BridgeUsdt0Evm = null;
  });

  describe("Static methods", () => {
    it("should report WDK not registered initially", () => {
      expect(T402WDK.isWDKRegistered()).toBe(false);
    });

    it("should register WDK modules", () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      expect(T402WDK.isWDKRegistered()).toBe(true);
    });

    it("should report wallet manager registered", () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      expect(T402WDK.isWalletManagerRegistered()).toBe(true);
    });

    it("should report wallet manager not registered", () => {
      T402WDK.registerWDK(MockWDKConstructor);
      expect(T402WDK.isWalletManagerRegistered()).toBe(false);
    });

    it("should report bridge registered", () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm, MockBridgeUsdt0Evm);
      expect(T402WDK.isBridgeRegistered()).toBe(true);
    });

    it("should report bridge not registered", () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      expect(T402WDK.isBridgeRegistered()).toBe(false);
    });

    it("should throw when registering null WDK", () => {
      expect(() => T402WDK.registerWDK(null as unknown as WDKConstructor)).toThrow(WDKInitializationError);
      expect(() => T402WDK.registerWDK(null as unknown as WDKConstructor)).toThrow("WDK constructor is required");
    });

    it("should throw when registering non-function WDK", () => {
      expect(() => T402WDK.registerWDK({} as unknown as WDKConstructor)).toThrow(WDKInitializationError);
      expect(() => T402WDK.registerWDK({} as unknown as WDKConstructor)).toThrow("WDK must be a constructor function");
    });

    it("should generate seed phrase after registration", () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      const seedPhrase = T402WDK.generateSeedPhrase();
      expect(seedPhrase).toBeDefined();
      expect(seedPhrase.split(" ").length).toBeGreaterThanOrEqual(12);
    });

    it("should throw when generating seed phrase without WDK", () => {
      expect(() => T402WDK.generateSeedPhrase()).toThrow(WDKInitializationError);
      expect(() => T402WDK.generateSeedPhrase()).toThrow("WDK not registered");
    });

    it("should handle generateSeedPhrase error", () => {
      const BrokenWDK = {
        getRandomSeedPhrase: () => {
          throw new Error("Generation failed");
        },
      } as unknown as WDKConstructor;
      // @ts-expect-error - directly setting for test
      T402WDK._WDK = BrokenWDK;
      expect(() => T402WDK.generateSeedPhrase()).toThrow(WDKInitializationError);
      expect(() => T402WDK.generateSeedPhrase()).toThrow("Failed to generate seed phrase");
    });
  });

  describe("Constructor validation", () => {
    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
    });

    it("should throw on empty seed phrase", () => {
      expect(() => new T402WDK("", {})).toThrow(WDKInitializationError);
      expect(() => new T402WDK("", {})).toThrow("Seed phrase is required");
    });

    it("should throw on null seed phrase", () => {
      expect(() => new T402WDK(null as unknown as string, {})).toThrow(WDKInitializationError);
    });

    it("should throw on wrong word count", () => {
      expect(() => new T402WDK("one two three", {})).toThrow(WDKInitializationError);
      expect(() => new T402WDK("one two three", {})).toThrow("expected 12, 15, 18, 21, or 24 words");
    });

    it("should accept 15-word seed phrase", () => {
      const wdk = new T402WDK("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", {});
      expect(wdk).toBeDefined();
    });

    it("should create instance with config", () => {
      const wdk = new T402WDK(VALID_SEED_PHRASE, {
        arbitrum: "https://arb1.arbitrum.io/rpc",
      });
      expect(wdk).toBeDefined();
    });

    it("should normalize string config to chain config", () => {
      const wdk = new T402WDK(VALID_SEED_PHRASE, {
        arbitrum: "https://custom-rpc.io",
      });
      const config = wdk.getChainConfig("arbitrum");
      expect(config?.provider).toBe("https://custom-rpc.io");
      expect(config?.chainId).toBe(42161);
    });

    it("should add default chain if none configured", () => {
      const wdk = new T402WDK(VALID_SEED_PHRASE, {});
      const chains = wdk.getConfiguredChains();
      expect(chains.length).toBeGreaterThan(0);
    });

    it("should create instance with cache options", () => {
      const wdk = new T402WDK(VALID_SEED_PHRASE, { arbitrum: "https://arb1.arbitrum.io/rpc" }, {
        cache: { enabled: true, tokenBalanceTTL: 60000 },
      });
      expect(wdk.isCacheEnabled).toBe(true);
    });

    it("should create instance with cache disabled", () => {
      const wdk = new T402WDK(VALID_SEED_PHRASE, { arbitrum: "https://arb1.arbitrum.io/rpc" }, {
        cache: { enabled: false },
      });
      expect(wdk.isCacheEnabled).toBe(false);
    });
  });

  describe("Initialization state", () => {
    it("should report isInitialized=true when WDK is ready", () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      const wdk = new T402WDK(VALID_SEED_PHRASE, { arbitrum: "https://arb1.arbitrum.io/rpc" });
      expect(wdk.isInitialized).toBe(true);
    });

    it("should report isInitialized=false when WDK not registered", () => {
      const wdk = new T402WDK(VALID_SEED_PHRASE, { arbitrum: "https://arb1.arbitrum.io/rpc" });
      expect(wdk.isInitialized).toBe(false);
    });

    it("should report initializationError when WalletManager not registered", () => {
      T402WDK.registerWDK(MockWDKConstructor);
      const wdk = new T402WDK(VALID_SEED_PHRASE, { arbitrum: "https://arb1.arbitrum.io/rpc" });
      expect(wdk.initializationError).toBeDefined();
      expect(wdk.initializationError?.message).toContain("WalletManagerEvm not registered");
    });

    it("should throw when accessing wdk getter without initialization", () => {
      const wdk = new T402WDK(VALID_SEED_PHRASE, { arbitrum: "https://arb1.arbitrum.io/rpc" });
      expect(() => wdk.wdk).toThrow(WDKInitializationError);
    });
  });

  describe("Chain management", () => {
    let wdk: T402WDK;

    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      wdk = new T402WDK(VALID_SEED_PHRASE, {
        arbitrum: "https://arb1.arbitrum.io/rpc",
        base: "https://mainnet.base.org",
      });
    });

    it("should return configured chains", () => {
      const chains = wdk.getConfiguredChains();
      expect(chains).toContain("arbitrum");
      expect(chains).toContain("base");
    });

    it("should return chain config", () => {
      const config = wdk.getChainConfig("arbitrum");
      expect(config).toBeDefined();
      expect(config?.chainId).toBe(42161);
      expect(config?.network).toBe("eip155:42161");
    });

    it("should return undefined for unknown chain", () => {
      const config = wdk.getChainConfig("unknown");
      expect(config).toBeUndefined();
    });

    it("should check if chain is configured", () => {
      expect(wdk.isChainConfigured("arbitrum")).toBe(true);
      expect(wdk.isChainConfigured("polygon")).toBe(false);
    });

    it("should return USDT0 chains", () => {
      const usdt0Chains = wdk.getUsdt0Chains();
      expect(usdt0Chains).toContain("arbitrum");
      // Base doesn't have USDT0
      expect(usdt0Chains).not.toContain("base");
    });
  });

  describe("Signer operations", () => {
    let wdk: T402WDK;

    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      wdk = new T402WDK(VALID_SEED_PHRASE, {
        arbitrum: "https://arb1.arbitrum.io/rpc",
      });
    });

    it("should get signer for configured chain", async () => {
      const signer = await wdk.getSigner("arbitrum");
      expect(signer).toBeDefined();
      expect(signer.address).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should cache signers", async () => {
      const signer1 = await wdk.getSigner("arbitrum");
      const signer2 = await wdk.getSigner("arbitrum");
      expect(signer1).toBe(signer2);
    });

    it("should throw for unconfigured chain", async () => {
      await expect(wdk.getSigner("polygon")).rejects.toThrow(ChainError);
      await expect(wdk.getSigner("polygon")).rejects.toThrow('Chain "polygon" not configured');
    });

    it("should throw for empty chain name", async () => {
      await expect(wdk.getSigner("")).rejects.toThrow(ChainError);
    });

    it("should throw for null chain name", async () => {
      await expect(wdk.getSigner(null as unknown as string)).rejects.toThrow(ChainError);
    });

    it("should get address for chain", async () => {
      const address = await wdk.getAddress("arbitrum");
      expect(address).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should clear signer cache", async () => {
      const signer1 = await wdk.getSigner("arbitrum");
      wdk.clearSignerCache();
      const signer2 = await wdk.getSigner("arbitrum");
      expect(signer1).not.toBe(signer2);
    });
  });

  describe("Balance operations", () => {
    let wdk: T402WDK;

    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      wdk = new T402WDK(VALID_SEED_PHRASE, {
        arbitrum: "https://arb1.arbitrum.io/rpc",
      });
    });

    it("should get USDT0 balance", async () => {
      const balance = await wdk.getUsdt0Balance("arbitrum");
      expect(balance).toBe(1000000n);
    });

    it("should return 0 for chain without USDT0", async () => {
      const wdkBase = new T402WDK(VALID_SEED_PHRASE, {
        base: "https://mainnet.base.org",
      });
      const balance = await wdkBase.getUsdt0Balance("base");
      expect(balance).toBe(0n);
    });

    it("should get USDC balance", async () => {
      const wdkBase = new T402WDK(VALID_SEED_PHRASE, {
        base: "https://mainnet.base.org",
      });
      const balance = await wdkBase.getUsdcBalance("base");
      expect(balance).toBe(1000000n);
    });

    it("should return 0 for chain without USDC", async () => {
      // Arbitrum doesn't have USDC in our config
      const wdkArb = new T402WDK(VALID_SEED_PHRASE, {
        ink: "https://rpc.ink.xyz",
      });
      const balance = await wdkArb.getUsdcBalance("ink");
      expect(balance).toBe(0n);
    });

    it("should get chain balances", async () => {
      const balances = await wdk.getChainBalances("arbitrum");
      expect(balances.chain).toBe("arbitrum");
      expect(balances.network).toBe("eip155:42161");
      expect(balances.tokens.length).toBeGreaterThan(0);
    });

    it("should throw for unconfigured chain balances", async () => {
      await expect(wdk.getChainBalances("polygon")).rejects.toThrow(ChainError);
    });

    it("should get aggregated balances", async () => {
      const balances = await wdk.getAggregatedBalances();
      expect(balances.chains.length).toBeGreaterThan(0);
      expect(balances.totalUsdt0).toBeGreaterThanOrEqual(0n);
    });

    it("should handle aggregated balance errors gracefully", async () => {
      // Even with errors, should return partial results with continueOnError=true
      const balances = await wdk.getAggregatedBalances(0, { continueOnError: true });
      expect(balances.chains).toBeDefined();
    });
  });

  describe("Payment chain selection", () => {
    let wdk: T402WDK;

    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      wdk = new T402WDK(VALID_SEED_PHRASE, {
        arbitrum: "https://arb1.arbitrum.io/rpc",
      });
    });

    it("should find best chain for payment", async () => {
      const result = await wdk.findBestChainForPayment(500000n);
      expect(result).toBeDefined();
      expect(result?.chain).toBe("arbitrum");
      expect(result?.token).toBe("USDT0");
    });

    it("should return null if no chain has sufficient balance", async () => {
      const result = await wdk.findBestChainForPayment(1000000000000n);
      expect(result).toBeNull();
    });

    it("should return null for zero amount", async () => {
      const result = await wdk.findBestChainForPayment(0n);
      expect(result).toBeNull();
    });

    it("should return null for negative amount", async () => {
      const result = await wdk.findBestChainForPayment(-100n);
      expect(result).toBeNull();
    });

    it("should prefer USDC when specified", async () => {
      const wdkBase = new T402WDK(VALID_SEED_PHRASE, {
        base: "https://mainnet.base.org",
      });
      const result = await wdkBase.findBestChainForPayment(500000n, "USDC");
      // If found, should prefer USDC
      if (result) {
        expect(result.token).toBe("USDC");
      }
    });
  });

  describe("Bridge operations", () => {
    let wdk: T402WDK;

    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm, MockBridgeUsdt0Evm);
      wdk = new T402WDK(VALID_SEED_PHRASE, {
        arbitrum: "https://arb1.arbitrum.io/rpc",
        ethereum: "https://eth.llamarpc.com",
      });
    });

    it("should get bridgeable chains", () => {
      const chains = wdk.getBridgeableChains();
      expect(chains).toContain("arbitrum");
      expect(chains).toContain("ethereum");
    });

    it("should check if can bridge between chains", () => {
      expect(wdk.canBridge("arbitrum", "ethereum")).toBe(true);
      expect(wdk.canBridge("arbitrum", "arbitrum")).toBe(false); // Same chain
      expect(wdk.canBridge("polygon", "ethereum")).toBe(false); // Polygon not configured
    });

    it("should get bridge destinations", () => {
      const destinations = wdk.getBridgeDestinations("arbitrum");
      expect(destinations).toContain("ethereum");
      expect(destinations).not.toContain("arbitrum");
    });

    it("should return empty destinations for unsupported chain", () => {
      const destinations = wdk.getBridgeDestinations("unknown");
      expect(destinations).toEqual([]);
    });

    it("should throw when bridge not available", async () => {
      // Reset bridge
      // @ts-expect-error - accessing private static for testing
      T402WDK._BridgeUsdt0Evm = null;
      const wdkNoBridge = new T402WDK(VALID_SEED_PHRASE, {
        arbitrum: "https://arb1.arbitrum.io/rpc",
      });
      await expect(wdkNoBridge.bridgeUsdt0({
        fromChain: "arbitrum",
        toChain: "ethereum",
        amount: 1000000n,
      })).rejects.toThrow(BridgeError);
      await expect(wdkNoBridge.bridgeUsdt0({
        fromChain: "arbitrum",
        toChain: "ethereum",
        amount: 1000000n,
      })).rejects.toThrow("USDT0 bridge not available");
    });

    it("should throw when fromChain missing", async () => {
      await expect(wdk.bridgeUsdt0({
        fromChain: "",
        toChain: "ethereum",
        amount: 1000000n,
      })).rejects.toThrow(BridgeError);
    });

    it("should throw when toChain missing", async () => {
      await expect(wdk.bridgeUsdt0({
        fromChain: "arbitrum",
        toChain: "",
        amount: 1000000n,
      })).rejects.toThrow(BridgeError);
    });

    it("should throw when bridging to same chain", async () => {
      await expect(wdk.bridgeUsdt0({
        fromChain: "arbitrum",
        toChain: "arbitrum",
        amount: 1000000n,
      })).rejects.toThrow(BridgeError);
      await expect(wdk.bridgeUsdt0({
        fromChain: "arbitrum",
        toChain: "arbitrum",
        amount: 1000000n,
      })).rejects.toThrow("Cannot bridge to the same chain");
    });

    it("should throw when amount is zero", async () => {
      await expect(wdk.bridgeUsdt0({
        fromChain: "arbitrum",
        toChain: "ethereum",
        amount: 0n,
      })).rejects.toThrow(BridgeError);
      await expect(wdk.bridgeUsdt0({
        fromChain: "arbitrum",
        toChain: "ethereum",
        amount: 0n,
      })).rejects.toThrow("Amount must be greater than 0");
    });

    it("should throw when bridging not supported", async () => {
      await expect(wdk.bridgeUsdt0({
        fromChain: "polygon",
        toChain: "ethereum",
        amount: 1000000n,
      })).rejects.toThrow(BridgeError);
    });

    it("should bridge USDT0 successfully", async () => {
      const result = await wdk.bridgeUsdt0({
        fromChain: "arbitrum",
        toChain: "ethereum",
        amount: 1000000n,
      });
      expect(result.txHash).toBe("0xbridgehash");
      expect(result.estimatedTime).toBe(300);
    });
  });

  describe("Cache management", () => {
    let wdk: T402WDK;

    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      wdk = new T402WDK(VALID_SEED_PHRASE, {
        arbitrum: "https://arb1.arbitrum.io/rpc",
      });
    });

    it("should report cache enabled by default", () => {
      expect(wdk.isCacheEnabled).toBe(true);
    });

    it("should get cache config", () => {
      const config = wdk.getCacheConfig();
      expect(config.enabled).toBe(true);
      expect(config.tokenBalanceTTL).toBeGreaterThan(0);
    });

    it("should get cache stats", () => {
      const stats = wdk.getCacheStats();
      expect(stats.balanceCache).toBeDefined();
      expect(stats.aggregatedCache).toBeDefined();
    });

    it("should invalidate balance cache", () => {
      wdk.invalidateBalanceCache();
      // Should not throw
      expect(true).toBe(true);
    });

    it("should invalidate chain cache", () => {
      const count = wdk.invalidateChainCache("arbitrum");
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should invalidate address cache", () => {
      const count = wdk.invalidateAddressCache("0x1234");
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("should dispose resources", () => {
      wdk.dispose();
      // Cache should be cleared
      const stats = wdk.getCacheStats();
      expect(stats.balanceCache.validSize).toBe(0);
    });
  });
});
