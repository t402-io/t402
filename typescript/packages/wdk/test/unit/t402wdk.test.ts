import { describe, it, expect, beforeEach, vi } from "vitest";
import { T402WDK } from "../../src/t402wdk";
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

describe("T402WDK", () => {
  beforeEach(() => {
    // Reset WDK registration before each test
    // @ts-expect-error - accessing private static for testing
    T402WDK._WDK = null;
    // @ts-expect-error - accessing private static for testing
    T402WDK._WalletManagerEvm = null;
  });

  describe("Static methods", () => {
    it("should report WDK not registered initially", () => {
      expect(T402WDK.isWDKRegistered()).toBe(false);
    });

    it("should register WDK modules", () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      expect(T402WDK.isWDKRegistered()).toBe(true);
    });

    it("should generate seed phrase after registration", () => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      const seedPhrase = T402WDK.generateSeedPhrase();
      expect(seedPhrase).toBeDefined();
      expect(seedPhrase.split(" ").length).toBeGreaterThanOrEqual(12);
    });

    it("should throw when generating seed phrase without WDK", () => {
      expect(() => T402WDK.generateSeedPhrase()).toThrow("WDK not registered");
    });
  });

  describe("Constructor", () => {
    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
    });

    it("should create instance with config", () => {
      const wdk = new T402WDK("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", {
        arbitrum: "https://arb1.arbitrum.io/rpc",
      });
      expect(wdk).toBeDefined();
    });

    it("should normalize string config to chain config", () => {
      const wdk = new T402WDK("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", {
        arbitrum: "https://custom-rpc.io",
      });
      const config = wdk.getChainConfig("arbitrum");
      expect(config?.provider).toBe("https://custom-rpc.io");
      expect(config?.chainId).toBe(42161);
    });

    it("should add default chain if none configured", () => {
      const wdk = new T402WDK("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", {});
      const chains = wdk.getConfiguredChains();
      expect(chains.length).toBeGreaterThan(0);
    });
  });

  describe("Chain management", () => {
    let wdk: T402WDK;

    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      wdk = new T402WDK("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", {
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
      wdk = new T402WDK("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", {
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
      await expect(wdk.getSigner("polygon")).rejects.toThrow('Chain "polygon" not configured');
    });

    it("should get address for chain", async () => {
      const address = await wdk.getAddress("arbitrum");
      expect(address).toBe("0x1234567890123456789012345678901234567890");
    });
  });

  describe("Balance operations", () => {
    let wdk: T402WDK;

    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      wdk = new T402WDK("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", {
        arbitrum: "https://arb1.arbitrum.io/rpc",
      });
    });

    it("should get USDT0 balance", async () => {
      const balance = await wdk.getUsdt0Balance("arbitrum");
      expect(balance).toBe(1000000n);
    });

    it("should return 0 for chain without USDT0", async () => {
      const wdkBase = new T402WDK("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", {
        base: "https://mainnet.base.org",
      });
      const balance = await wdkBase.getUsdt0Balance("base");
      expect(balance).toBe(0n);
    });

    it("should get chain balances", async () => {
      const balances = await wdk.getChainBalances("arbitrum");
      expect(balances.chain).toBe("arbitrum");
      expect(balances.network).toBe("eip155:42161");
      expect(balances.tokens.length).toBeGreaterThan(0);
    });

    it("should get aggregated balances", async () => {
      const balances = await wdk.getAggregatedBalances();
      expect(balances.chains.length).toBeGreaterThan(0);
      expect(balances.totalUsdt0).toBeGreaterThanOrEqual(0n);
    });
  });

  describe("Payment chain selection", () => {
    let wdk: T402WDK;

    beforeEach(() => {
      T402WDK.registerWDK(MockWDKConstructor, MockWalletManagerEvm);
      wdk = new T402WDK("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about", {
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
  });
});
