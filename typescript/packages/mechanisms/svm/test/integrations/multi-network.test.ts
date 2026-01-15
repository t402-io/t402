/**
 * Multi-Network Integration Tests for SVM Mechanism
 *
 * These tests verify that the SVM payment scheme works correctly
 * across different Solana networks with proper token address selection
 * and network normalization.
 */

import { describe, expect, it } from "vitest";
import {
  normalizeNetwork,
  validateSvmAddress,
  getUsdcAddress,
  convertToTokenAmount,
  createRpcClient,
} from "../../src/utils";
import {
  SOLANA_MAINNET_CAIP2,
  SOLANA_DEVNET_CAIP2,
  SOLANA_TESTNET_CAIP2,
  USDC_MAINNET_ADDRESS,
  USDC_DEVNET_ADDRESS,
  USDC_TESTNET_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  V1_TO_V2_NETWORK_MAP,
  SVM_ADDRESS_REGEX,
  DEFAULT_COMPUTE_UNIT_LIMIT,
  DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
  MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
} from "../../src/constants";
import { ExactSvmScheme as ExactSvmServer } from "../../src/exact/server/scheme";
import type { Network } from "@t402/core/types";

describe("SVM Multi-Network Integration Tests", () => {
  describe("Network Identifiers", () => {
    it("should have correct CAIP-2 format for all networks", () => {
      // Verify CAIP-2 format: "solana:<genesis-hash-prefix>"
      expect(SOLANA_MAINNET_CAIP2).toMatch(/^solana:[1-9A-HJ-NP-Za-km-z]+$/);
      expect(SOLANA_DEVNET_CAIP2).toMatch(/^solana:[1-9A-HJ-NP-Za-km-z]+$/);
      expect(SOLANA_TESTNET_CAIP2).toMatch(/^solana:[1-9A-HJ-NP-Za-km-z]+$/);

      // Verify specific values
      expect(SOLANA_MAINNET_CAIP2).toBe("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
      expect(SOLANA_DEVNET_CAIP2).toBe("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1");
      expect(SOLANA_TESTNET_CAIP2).toBe("solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z");
    });

    it("should have V1 to V2 network mappings", () => {
      expect(V1_TO_V2_NETWORK_MAP).toEqual({
        solana: SOLANA_MAINNET_CAIP2,
        "solana-devnet": SOLANA_DEVNET_CAIP2,
        "solana-testnet": SOLANA_TESTNET_CAIP2,
      });
    });
  });

  describe("Network Normalization", () => {
    it("should normalize V1 network names to CAIP-2", () => {
      expect(normalizeNetwork("solana")).toBe(SOLANA_MAINNET_CAIP2);
      expect(normalizeNetwork("solana-devnet")).toBe(SOLANA_DEVNET_CAIP2);
      expect(normalizeNetwork("solana-testnet")).toBe(SOLANA_TESTNET_CAIP2);
    });

    it("should pass through valid CAIP-2 networks", () => {
      expect(normalizeNetwork(SOLANA_MAINNET_CAIP2)).toBe(SOLANA_MAINNET_CAIP2);
      expect(normalizeNetwork(SOLANA_DEVNET_CAIP2)).toBe(SOLANA_DEVNET_CAIP2);
      expect(normalizeNetwork(SOLANA_TESTNET_CAIP2)).toBe(SOLANA_TESTNET_CAIP2);
    });

    it("should throw for unsupported V1 networks", () => {
      expect(() => normalizeNetwork("solana-localnet" as Network)).toThrow(
        "Unsupported SVM network: solana-localnet",
      );
      expect(() => normalizeNetwork("ethereum" as Network)).toThrow(
        "Unsupported SVM network: ethereum",
      );
    });

    it("should throw for unsupported CAIP-2 networks", () => {
      expect(() => normalizeNetwork("solana:InvalidHash123" as Network)).toThrow(
        "Unsupported SVM network: solana:InvalidHash123",
      );
    });
  });

  describe("USDC Token Addresses", () => {
    it("should return correct USDC address for each network", () => {
      expect(getUsdcAddress(SOLANA_MAINNET_CAIP2)).toBe(USDC_MAINNET_ADDRESS);
      expect(getUsdcAddress(SOLANA_DEVNET_CAIP2)).toBe(USDC_DEVNET_ADDRESS);
      expect(getUsdcAddress(SOLANA_TESTNET_CAIP2)).toBe(USDC_TESTNET_ADDRESS);
    });

    it("should return USDC address for V1 network names", () => {
      expect(getUsdcAddress("solana")).toBe(USDC_MAINNET_ADDRESS);
      expect(getUsdcAddress("solana-devnet")).toBe(USDC_DEVNET_ADDRESS);
      expect(getUsdcAddress("solana-testnet")).toBe(USDC_TESTNET_ADDRESS);
    });

    it("should have valid Solana addresses for USDC", () => {
      expect(validateSvmAddress(USDC_MAINNET_ADDRESS)).toBe(true);
      expect(validateSvmAddress(USDC_DEVNET_ADDRESS)).toBe(true);
      expect(validateSvmAddress(USDC_TESTNET_ADDRESS)).toBe(true);
    });

    it("should note that devnet and testnet use same USDC address", () => {
      // This is intentional - devnet and testnet share the same USDC mint
      expect(USDC_DEVNET_ADDRESS).toBe(USDC_TESTNET_ADDRESS);
      expect(USDC_DEVNET_ADDRESS).toBe("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    });
  });

  describe("Address Validation", () => {
    it("should validate correct Solana addresses", () => {
      // Standard addresses
      expect(validateSvmAddress("11111111111111111111111111111111")).toBe(true);
      expect(validateSvmAddress("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")).toBe(true);
      expect(validateSvmAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
    });

    it("should reject invalid addresses", () => {
      // Too short
      expect(validateSvmAddress("abc")).toBe(false);
      // Too long
      expect(validateSvmAddress("a".repeat(50))).toBe(false);
      // Invalid characters (0, O, I, l are excluded from base58)
      expect(validateSvmAddress("0OIl" + "1".repeat(40))).toBe(false);
      // Empty
      expect(validateSvmAddress("")).toBe(false);
    });

    it("should validate program addresses", () => {
      expect(validateSvmAddress(TOKEN_PROGRAM_ADDRESS)).toBe(true);
      expect(validateSvmAddress(TOKEN_2022_PROGRAM_ADDRESS)).toBe(true);
    });
  });

  describe("Token Amount Conversion", () => {
    it("should convert decimal amounts to smallest units", () => {
      // USDC has 6 decimals
      expect(convertToTokenAmount("1.00", 6)).toBe("1000000");
      expect(convertToTokenAmount("0.50", 6)).toBe("500000");
      expect(convertToTokenAmount("100.123456", 6)).toBe("100123456");
    });

    it("should handle integer amounts", () => {
      expect(convertToTokenAmount("1", 6)).toBe("1000000");
      expect(convertToTokenAmount("100", 6)).toBe("100000000");
    });

    it("should handle different decimal places", () => {
      // SOL has 9 decimals
      expect(convertToTokenAmount("1.0", 9)).toBe("1000000000");
      // Some tokens have 8 decimals
      expect(convertToTokenAmount("1.0", 8)).toBe("100000000");
    });

    it("should floor fractional smallest units", () => {
      // If amount has more precision than decimals allow
      expect(convertToTokenAmount("1.1234567", 6)).toBe("1123456"); // Floors, not rounds
    });

    it("should throw for invalid amounts", () => {
      expect(() => convertToTokenAmount("not-a-number", 6)).toThrow("Invalid amount");
      expect(() => convertToTokenAmount("", 6)).toThrow("Invalid amount");
    });
  });

  describe("Token Programs", () => {
    it("should have correct SPL Token program address", () => {
      expect(TOKEN_PROGRAM_ADDRESS).toBe("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    });

    it("should have correct Token-2022 program address", () => {
      expect(TOKEN_2022_PROGRAM_ADDRESS).toBe("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
    });

    it("should have valid Solana addresses for programs", () => {
      expect(validateSvmAddress(TOKEN_PROGRAM_ADDRESS)).toBe(true);
      expect(validateSvmAddress(TOKEN_2022_PROGRAM_ADDRESS)).toBe(true);
    });
  });

  describe("Compute Budget Configuration", () => {
    it("should have sensible default compute limits", () => {
      expect(DEFAULT_COMPUTE_UNIT_LIMIT).toBe(6500);
      expect(DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS).toBe(1);
    });

    it("should have maximum compute price limit", () => {
      // 5 lamports = 5,000,000 microlamports
      expect(MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS).toBe(5_000_000);
    });

    it("should have price within reasonable bounds", () => {
      expect(DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS).toBeLessThanOrEqual(
        MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
      );
    });
  });

  describe("Server Price Parsing - Multi-Network", () => {
    const networks: Array<{ name: string; network: Network; usdcAddress: string }> = [
      { name: "Mainnet", network: SOLANA_MAINNET_CAIP2 as Network, usdcAddress: USDC_MAINNET_ADDRESS },
      { name: "Devnet", network: SOLANA_DEVNET_CAIP2 as Network, usdcAddress: USDC_DEVNET_ADDRESS },
      { name: "Testnet", network: SOLANA_TESTNET_CAIP2 as Network, usdcAddress: USDC_TESTNET_ADDRESS },
    ];

    for (const { name, network, usdcAddress } of networks) {
      describe(`${name} (${network})`, () => {
        it("should parse price and use correct USDC address", async () => {
          const server = new ExactSvmServer();
          const assetAmount = await server.parsePrice("$1.00", network);

          expect(assetAmount.amount).toBe("1000000"); // 1 USDC in smallest units
          expect(assetAmount.asset).toBe(usdcAddress);
        });

        it("should handle different price formats", async () => {
          const server = new ExactSvmServer();

          const testCases = [
            { input: "$10.00", expected: "10000000" },
            { input: "5.50", expected: "5500000" },
            { input: 0.01, expected: "10000" },
            { input: 100, expected: "100000000" },
          ];

          for (const testCase of testCases) {
            const result = await server.parsePrice(testCase.input, network);
            expect(result.amount).toBe(testCase.expected);
            expect(result.asset).toBe(usdcAddress);
          }
        });
      });
    }
  });

  describe("Server with V1 Network Names", () => {
    it("should parse prices with V1 network names", async () => {
      const server = new ExactSvmServer();

      // V1 names should work and map to correct USDC addresses
      const mainnetResult = await server.parsePrice("$1.00", "solana");
      expect(mainnetResult.asset).toBe(USDC_MAINNET_ADDRESS);

      const devnetResult = await server.parsePrice("$1.00", "solana-devnet");
      expect(devnetResult.asset).toBe(USDC_DEVNET_ADDRESS);

      const testnetResult = await server.parsePrice("$1.00", "solana-testnet");
      expect(testnetResult.asset).toBe(USDC_TESTNET_ADDRESS);
    });
  });

  describe("Custom Money Parser Integration", () => {
    it("should use custom parser before default USDC", async () => {
      const server = new ExactSvmServer();

      // Register parser that uses custom token for amounts > 50
      server.registerMoneyParser(async (amount) => {
        if (amount > 50) {
          return {
            amount: (amount * 1e9).toString(), // 9 decimals
            asset: "CustomToken1111111111111111111111111",
            extra: { custom: true },
          };
        }
        return null;
      });

      // Large amount uses custom parser
      const largeResult = await server.parsePrice(100, SOLANA_DEVNET_CAIP2);
      expect(largeResult.asset).toBe("CustomToken1111111111111111111111111");
      expect(largeResult.extra?.custom).toBe(true);

      // Small amount uses default USDC
      const smallResult = await server.parsePrice(25, SOLANA_DEVNET_CAIP2);
      expect(smallResult.asset).toBe(USDC_DEVNET_ADDRESS);
    });

    it("should chain multiple parsers in order", async () => {
      const server = new ExactSvmServer();

      server
        .registerMoneyParser(async (amount) => {
          if (amount > 1000) {
            return {
              amount: amount.toString(),
              asset: "VIPToken",
              extra: { tier: "vip" },
            };
          }
          return null;
        })
        .registerMoneyParser(async (amount) => {
          if (amount > 100) {
            return {
              amount: amount.toString(),
              asset: "PremiumToken",
              extra: { tier: "premium" },
            };
          }
          return null;
        });

      const vipResult = await server.parsePrice(2000, SOLANA_DEVNET_CAIP2);
      expect(vipResult.extra?.tier).toBe("vip");

      const premiumResult = await server.parsePrice(500, SOLANA_DEVNET_CAIP2);
      expect(premiumResult.extra?.tier).toBe("premium");

      const standardResult = await server.parsePrice(50, SOLANA_DEVNET_CAIP2);
      expect(standardResult.asset).toBe(USDC_DEVNET_ADDRESS);
    });
  });

  describe("Address Regex Pattern", () => {
    it("should match valid base58 patterns", () => {
      const validAddresses = [
        "11111111111111111111111111111111", // System program
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Token program
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC mainnet
        "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // USDC devnet
      ];

      for (const addr of validAddresses) {
        expect(SVM_ADDRESS_REGEX.test(addr)).toBe(true);
      }
    });

    it("should reject invalid patterns", () => {
      const invalidAddresses = [
        "", // Empty
        "abc", // Too short
        "0x1234567890abcdef", // Ethereum format
        "0".repeat(44), // Has invalid char '0'
        "O".repeat(44), // Has invalid char 'O'
        "I".repeat(44), // Has invalid char 'I'
        "l".repeat(44), // Has invalid char 'l'
      ];

      for (const addr of invalidAddresses) {
        expect(SVM_ADDRESS_REGEX.test(addr)).toBe(false);
      }
    });
  });

  describe("RPC Client Creation", () => {
    it("should create RPC client for devnet", () => {
      const client = createRpcClient(SOLANA_DEVNET_CAIP2);
      expect(client).toBeDefined();
    });

    it("should create RPC client for testnet", () => {
      const client = createRpcClient(SOLANA_TESTNET_CAIP2);
      expect(client).toBeDefined();
    });

    it("should create RPC client for mainnet", () => {
      const client = createRpcClient(SOLANA_MAINNET_CAIP2);
      expect(client).toBeDefined();
    });

    it("should create RPC client with V1 network names", () => {
      const devnetClient = createRpcClient("solana-devnet");
      expect(devnetClient).toBeDefined();

      const mainnetClient = createRpcClient("solana");
      expect(mainnetClient).toBeDefined();
    });

    it("should throw for unsupported networks", () => {
      expect(() => createRpcClient("invalid-network" as Network)).toThrow(
        "Unsupported SVM network",
      );
    });
  });
});
