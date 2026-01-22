import { describe, it, expect } from "vitest";
import {
  CHAIN_IDS,
  NATIVE_SYMBOLS,
  EXPLORER_URLS,
  DEFAULT_RPC_URLS,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
  USDT0_ADDRESSES,
  BRIDGEABLE_CHAINS,
  ERC20_ABI,
  getExplorerTxUrl,
  getLayerZeroScanUrl,
  supportsToken,
  getTokenAddress,
  formatTokenAmount,
  parseTokenAmount,
} from "../../src/constants.js";
import type { SupportedNetwork } from "../../src/types.js";

describe("Chain Configuration Constants", () => {
  const allNetworks: SupportedNetwork[] = [
    "ethereum",
    "base",
    "arbitrum",
    "optimism",
    "polygon",
    "avalanche",
    "ink",
    "berachain",
    "unichain",
  ];

  describe("CHAIN_IDS", () => {
    it("should have chain IDs for all networks", () => {
      for (const network of allNetworks) {
        expect(CHAIN_IDS[network]).toBeDefined();
        expect(typeof CHAIN_IDS[network]).toBe("number");
      }
    });

    it("should have correct chain IDs for major networks", () => {
      expect(CHAIN_IDS.ethereum).toBe(1);
      expect(CHAIN_IDS.base).toBe(8453);
      expect(CHAIN_IDS.arbitrum).toBe(42161);
      expect(CHAIN_IDS.optimism).toBe(10);
      expect(CHAIN_IDS.polygon).toBe(137);
    });
  });

  describe("NATIVE_SYMBOLS", () => {
    it("should have native symbols for all networks", () => {
      for (const network of allNetworks) {
        expect(NATIVE_SYMBOLS[network]).toBeDefined();
        expect(typeof NATIVE_SYMBOLS[network]).toBe("string");
      }
    });

    it("should have correct native symbols", () => {
      expect(NATIVE_SYMBOLS.ethereum).toBe("ETH");
      expect(NATIVE_SYMBOLS.polygon).toBe("MATIC");
      expect(NATIVE_SYMBOLS.avalanche).toBe("AVAX");
      expect(NATIVE_SYMBOLS.berachain).toBe("BERA");
    });
  });

  describe("EXPLORER_URLS", () => {
    it("should have explorer URLs for all networks", () => {
      for (const network of allNetworks) {
        expect(EXPLORER_URLS[network]).toBeDefined();
        expect(EXPLORER_URLS[network]).toMatch(/^https:\/\//);
      }
    });
  });

  describe("DEFAULT_RPC_URLS", () => {
    it("should have RPC URLs for all networks", () => {
      for (const network of allNetworks) {
        expect(DEFAULT_RPC_URLS[network]).toBeDefined();
        expect(DEFAULT_RPC_URLS[network]).toMatch(/^https:\/\//);
      }
    });
  });
});

describe("Token Address Constants", () => {
  describe("USDC_ADDRESSES", () => {
    it("should have USDC addresses for major networks", () => {
      expect(USDC_ADDRESSES.ethereum).toBeDefined();
      expect(USDC_ADDRESSES.base).toBeDefined();
      expect(USDC_ADDRESSES.arbitrum).toBeDefined();
    });

    it("should have valid address format", () => {
      for (const address of Object.values(USDC_ADDRESSES)) {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      }
    });
  });

  describe("USDT_ADDRESSES", () => {
    it("should have USDT addresses for supported networks", () => {
      expect(USDT_ADDRESSES.ethereum).toBeDefined();
      expect(USDT_ADDRESSES.arbitrum).toBeDefined();
    });
  });

  describe("USDT0_ADDRESSES", () => {
    it("should have USDT0 addresses for bridgeable chains", () => {
      expect(USDT0_ADDRESSES.ethereum).toBeDefined();
      expect(USDT0_ADDRESSES.arbitrum).toBeDefined();
      expect(USDT0_ADDRESSES.ink).toBeDefined();
    });
  });

  describe("BRIDGEABLE_CHAINS", () => {
    it("should include expected chains", () => {
      expect(BRIDGEABLE_CHAINS).toContain("ethereum");
      expect(BRIDGEABLE_CHAINS).toContain("arbitrum");
      expect(BRIDGEABLE_CHAINS).toContain("ink");
    });

    it("should only include chains with USDT0 support", () => {
      for (const chain of BRIDGEABLE_CHAINS) {
        expect(USDT0_ADDRESSES[chain]).toBeDefined();
      }
    });
  });
});

describe("ERC20_ABI", () => {
  it("should include balanceOf function", () => {
    const balanceOf = ERC20_ABI.find((item) => item.name === "balanceOf");
    expect(balanceOf).toBeDefined();
    expect(balanceOf?.type).toBe("function");
    expect(balanceOf?.stateMutability).toBe("view");
  });

  it("should include transfer function", () => {
    const transfer = ERC20_ABI.find((item) => item.name === "transfer");
    expect(transfer).toBeDefined();
    expect(transfer?.type).toBe("function");
    expect(transfer?.stateMutability).toBe("nonpayable");
  });

  it("should include all required ERC20 functions", () => {
    const expectedFunctions = [
      "balanceOf",
      "decimals",
      "symbol",
      "transfer",
      "approve",
      "allowance",
    ];
    for (const funcName of expectedFunctions) {
      const func = ERC20_ABI.find((item) => item.name === funcName);
      expect(func).toBeDefined();
    }
  });
});

describe("Helper Functions", () => {
  describe("getExplorerTxUrl", () => {
    it("should generate correct explorer URLs", () => {
      const txHash = "0x1234567890abcdef";

      expect(getExplorerTxUrl("ethereum", txHash)).toBe(
        `https://etherscan.io/tx/${txHash}`
      );
      expect(getExplorerTxUrl("base", txHash)).toBe(
        `https://basescan.org/tx/${txHash}`
      );
      expect(getExplorerTxUrl("arbitrum", txHash)).toBe(
        `https://arbiscan.io/tx/${txHash}`
      );
    });
  });

  describe("getLayerZeroScanUrl", () => {
    it("should generate correct LayerZero Scan URL", () => {
      const messageGuid = "0xabcdef1234567890";
      expect(getLayerZeroScanUrl(messageGuid)).toBe(
        `https://layerzeroscan.com/tx/${messageGuid}`
      );
    });
  });

  describe("supportsToken", () => {
    it("should return true for supported token-network pairs", () => {
      expect(supportsToken("ethereum", "USDC")).toBe(true);
      expect(supportsToken("base", "USDC")).toBe(true);
      expect(supportsToken("ethereum", "USDT")).toBe(true);
      expect(supportsToken("ethereum", "USDT0")).toBe(true);
    });

    it("should return false for unsupported token-network pairs", () => {
      expect(supportsToken("ink", "USDC")).toBe(false);
      expect(supportsToken("berachain", "USDC")).toBe(false);
    });

    it("should handle invalid token gracefully", () => {
      // @ts-expect-error - testing invalid input
      expect(supportsToken("ethereum", "INVALID")).toBe(false);
    });
  });

  describe("getTokenAddress", () => {
    it("should return correct addresses for USDC", () => {
      expect(getTokenAddress("ethereum", "USDC")).toBe(USDC_ADDRESSES.ethereum);
      expect(getTokenAddress("base", "USDC")).toBe(USDC_ADDRESSES.base);
    });

    it("should return correct addresses for USDT", () => {
      expect(getTokenAddress("ethereum", "USDT")).toBe(USDT_ADDRESSES.ethereum);
    });

    it("should return correct addresses for USDT0", () => {
      expect(getTokenAddress("ethereum", "USDT0")).toBe(
        USDT0_ADDRESSES.ethereum
      );
      expect(getTokenAddress("ink", "USDT0")).toBe(USDT0_ADDRESSES.ink);
    });

    it("should return undefined for unsupported pairs", () => {
      expect(getTokenAddress("ink", "USDC")).toBeUndefined();
    });

    it("should handle invalid token gracefully", () => {
      // @ts-expect-error - testing invalid input
      expect(getTokenAddress("ethereum", "INVALID")).toBeUndefined();
    });
  });

  describe("formatTokenAmount", () => {
    it("should format whole numbers correctly", () => {
      expect(formatTokenAmount(1000000n, 6, "USDC")).toBe("1 USDC");
      expect(formatTokenAmount(100000000n, 6, "USDC")).toBe("100 USDC");
    });

    it("should format decimal numbers correctly", () => {
      expect(formatTokenAmount(1500000n, 6, "USDC")).toBe("1.5 USDC");
      expect(formatTokenAmount(1234567n, 6, "USDC")).toBe("1.234567 USDC");
    });

    it("should handle zero correctly", () => {
      expect(formatTokenAmount(0n, 6, "USDC")).toBe("0 USDC");
    });

    it("should trim trailing zeros", () => {
      expect(formatTokenAmount(1100000n, 6, "USDC")).toBe("1.1 USDC");
      expect(formatTokenAmount(1000100n, 6, "USDC")).toBe("1.0001 USDC");
    });

    it("should handle 18 decimal tokens", () => {
      expect(formatTokenAmount(1000000000000000000n, 18, "ETH")).toBe("1 ETH");
      expect(formatTokenAmount(1500000000000000000n, 18, "ETH")).toBe(
        "1.5 ETH"
      );
    });
  });

  describe("parseTokenAmount", () => {
    it("should parse whole numbers correctly", () => {
      expect(parseTokenAmount("1", 6)).toBe(1000000n);
      expect(parseTokenAmount("100", 6)).toBe(100000000n);
    });

    it("should parse decimal numbers correctly", () => {
      expect(parseTokenAmount("1.5", 6)).toBe(1500000n);
      expect(parseTokenAmount("1.234567", 6)).toBe(1234567n);
    });

    it("should handle zero correctly", () => {
      expect(parseTokenAmount("0", 6)).toBe(0n);
      expect(parseTokenAmount("0.0", 6)).toBe(0n);
    });

    it("should pad fractional part", () => {
      expect(parseTokenAmount("1.1", 6)).toBe(1100000n);
      expect(parseTokenAmount("1.01", 6)).toBe(1010000n);
    });

    it("should truncate extra decimal places", () => {
      expect(parseTokenAmount("1.1234567890", 6)).toBe(1123456n);
    });

    it("should handle 18 decimal tokens", () => {
      expect(parseTokenAmount("1", 18)).toBe(1000000000000000000n);
      expect(parseTokenAmount("1.5", 18)).toBe(1500000000000000000n);
    });
  });
});
