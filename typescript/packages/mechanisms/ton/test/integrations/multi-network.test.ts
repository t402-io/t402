/**
 * Multi-Network Integration Tests for TON Mechanism
 *
 * These tests verify that the TON payment scheme works correctly
 * across different TON networks with proper Jetton address selection
 * and network normalization.
 */

import { describe, expect, it } from "vitest";
import { Address } from "@ton/core";
import {
  normalizeNetwork,
  validateTonAddress,
  isTonNetwork,
  getEndpoint,
  convertToJettonAmount,
  convertFromJettonAmount,
  addressesEqual,
  formatAddress,
  generateQueryId,
  buildJettonTransferBody,
  parseJettonTransferBody,
} from "../../src/utils";
import {
  TON_MAINNET_CAIP2,
  TON_TESTNET_CAIP2,
  TON_NETWORKS,
  TON_MAINNET_ENDPOINT,
  TON_TESTNET_ENDPOINT,
  NETWORK_ENDPOINTS,
  NETWORK_V4_ENDPOINTS,
  JETTON_TRANSFER_OP,
  DEFAULT_JETTON_TRANSFER_TON,
  DEFAULT_FORWARD_TON,
  MIN_JETTON_TRANSFER_TON,
  MAX_JETTON_TRANSFER_TON,
  DEFAULT_VALIDITY_DURATION,
} from "../../src/constants";
import {
  USDT_ADDRESSES,
  JETTON_REGISTRY,
  getJettonConfig,
  getNetworkJettons,
  getDefaultJetton,
  getJettonByAddress,
  getNetworksForJetton,
  isNetworkSupported,
  getSupportedNetworks,
} from "../../src/tokens";
import { ExactTonScheme as ExactTonServer } from "../../src/exact/server/scheme";
import type { Network } from "@t402/core/types";

describe("TON Multi-Network Integration Tests", () => {
  describe("Network Identifiers", () => {
    it("should have correct CAIP-2 format for all networks", () => {
      // Verify CAIP-2 format: "ton:<network>"
      expect(TON_MAINNET_CAIP2).toBe("ton:mainnet");
      expect(TON_TESTNET_CAIP2).toBe("ton:testnet");
    });

    it("should have all networks in TON_NETWORKS array", () => {
      expect(TON_NETWORKS).toContain(TON_MAINNET_CAIP2);
      expect(TON_NETWORKS).toContain(TON_TESTNET_CAIP2);
      expect(TON_NETWORKS).toHaveLength(2);
    });
  });

  describe("Network Normalization", () => {
    it("should normalize legacy network names to CAIP-2", () => {
      expect(normalizeNetwork("ton")).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork("ton-mainnet")).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork("mainnet")).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork("ton-testnet")).toBe(TON_TESTNET_CAIP2);
      expect(normalizeNetwork("testnet")).toBe(TON_TESTNET_CAIP2);
    });

    it("should pass through valid CAIP-2 networks", () => {
      expect(normalizeNetwork(TON_MAINNET_CAIP2)).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork(TON_TESTNET_CAIP2)).toBe(TON_TESTNET_CAIP2);
    });

    it("should be case-insensitive for legacy names", () => {
      expect(normalizeNetwork("TON")).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork("MAINNET")).toBe(TON_MAINNET_CAIP2);
      expect(normalizeNetwork("Testnet")).toBe(TON_TESTNET_CAIP2);
    });

    it("should throw for unsupported networks", () => {
      expect(() => normalizeNetwork("solana" as Network)).toThrow(
        "Unsupported TON network: solana",
      );
      expect(() => normalizeNetwork("ton:localnet" as Network)).toThrow(
        "Unsupported TON network: ton:localnet",
      );
      expect(() => normalizeNetwork("ethereum" as Network)).toThrow(
        "Unsupported TON network: ethereum",
      );
    });
  });

  describe("Network Detection", () => {
    it("should correctly identify TON networks", () => {
      expect(isTonNetwork(TON_MAINNET_CAIP2)).toBe(true);
      expect(isTonNetwork(TON_TESTNET_CAIP2)).toBe(true);
      expect(isTonNetwork("ton")).toBe(true);
      expect(isTonNetwork("ton-testnet")).toBe(true);
    });

    it("should reject non-TON networks", () => {
      expect(isTonNetwork("solana")).toBe(false);
      expect(isTonNetwork("ethereum")).toBe(false);
      expect(isTonNetwork("eip155:1")).toBe(false);
    });
  });

  describe("RPC Endpoints", () => {
    it("should have correct v2 endpoints for all networks", () => {
      expect(NETWORK_ENDPOINTS[TON_MAINNET_CAIP2]).toBe(TON_MAINNET_ENDPOINT);
      expect(NETWORK_ENDPOINTS[TON_TESTNET_CAIP2]).toBe(TON_TESTNET_ENDPOINT);
    });

    it("should have correct v4 endpoints for all networks", () => {
      expect(NETWORK_V4_ENDPOINTS[TON_MAINNET_CAIP2]).toBe("https://mainnet-v4.tonhubapi.com");
      expect(NETWORK_V4_ENDPOINTS[TON_TESTNET_CAIP2]).toBe("https://testnet-v4.tonhubapi.com");
    });

    it("should return endpoint via getEndpoint function", () => {
      expect(getEndpoint(TON_MAINNET_CAIP2)).toBe(TON_MAINNET_ENDPOINT);
      expect(getEndpoint(TON_TESTNET_CAIP2)).toBe(TON_TESTNET_ENDPOINT);
      // Also works with legacy names
      expect(getEndpoint("ton" as Network)).toBe(TON_MAINNET_ENDPOINT);
    });
  });

  describe("USDT Jetton Addresses", () => {
    it("should have USDT address for each network", () => {
      expect(USDT_ADDRESSES[TON_MAINNET_CAIP2]).toBeDefined();
      expect(USDT_ADDRESSES[TON_TESTNET_CAIP2]).toBeDefined();
    });

    it("should have valid TON addresses for USDT", () => {
      expect(validateTonAddress(USDT_ADDRESSES[TON_MAINNET_CAIP2])).toBe(true);
      // Testnet address may use different format - just check it's defined
      expect(USDT_ADDRESSES[TON_TESTNET_CAIP2]).toBeDefined();
      expect(USDT_ADDRESSES[TON_TESTNET_CAIP2].length).toBeGreaterThan(0);
    });

    it("should have mainnet USDT at official address", () => {
      expect(USDT_ADDRESSES[TON_MAINNET_CAIP2]).toBe(
        "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
      );
    });
  });

  describe("Jetton Registry", () => {
    it("should have USDT configured for all networks", () => {
      expect(JETTON_REGISTRY[TON_MAINNET_CAIP2]?.USDT).toBeDefined();
      expect(JETTON_REGISTRY[TON_TESTNET_CAIP2]?.USDT).toBeDefined();
    });

    it("should have correct USDT decimals (6)", () => {
      expect(JETTON_REGISTRY[TON_MAINNET_CAIP2]?.USDT?.decimals).toBe(6);
      expect(JETTON_REGISTRY[TON_TESTNET_CAIP2]?.USDT?.decimals).toBe(6);
    });

    it("should have USDT as highest priority token", () => {
      expect(JETTON_REGISTRY[TON_MAINNET_CAIP2]?.USDT?.priority).toBe(1);
    });

    it("should return Jetton config via getJettonConfig", () => {
      const mainnetUsdt = getJettonConfig(TON_MAINNET_CAIP2, "USDT");
      expect(mainnetUsdt).toBeDefined();
      expect(mainnetUsdt!.symbol).toBe("USDT");
      expect(mainnetUsdt!.decimals).toBe(6);
    });

    it("should return undefined for unknown tokens", () => {
      const unknown = getJettonConfig(TON_MAINNET_CAIP2, "UNKNOWN_TOKEN");
      expect(unknown).toBeUndefined();
    });

    it("should be case-insensitive for token symbols", () => {
      const lower = getJettonConfig(TON_MAINNET_CAIP2, "usdt");
      const upper = getJettonConfig(TON_MAINNET_CAIP2, "USDT");
      expect(lower).toEqual(upper);
    });
  });

  describe("Jetton Helper Functions", () => {
    it("should get network Jettons sorted by priority", () => {
      const jettons = getNetworkJettons(TON_MAINNET_CAIP2);
      expect(jettons.length).toBeGreaterThan(0);
      expect(jettons[0].symbol).toBe("USDT"); // Highest priority
    });

    it("should get default Jetton for network", () => {
      const defaultJetton = getDefaultJetton(TON_MAINNET_CAIP2);
      expect(defaultJetton).toBeDefined();
      expect(defaultJetton!.symbol).toBe("USDT");
    });

    it("should find Jetton by address", () => {
      const usdtMainnet = getJettonByAddress(
        TON_MAINNET_CAIP2,
        USDT_ADDRESSES[TON_MAINNET_CAIP2],
      );
      expect(usdtMainnet).toBeDefined();
      expect(usdtMainnet!.symbol).toBe("USDT");
    });

    it("should get networks for a Jetton", () => {
      const networks = getNetworksForJetton("USDT");
      expect(networks).toContain(TON_MAINNET_CAIP2);
      expect(networks).toContain(TON_TESTNET_CAIP2);
    });

    it("should check network support", () => {
      expect(isNetworkSupported(TON_MAINNET_CAIP2)).toBe(true);
      expect(isNetworkSupported(TON_TESTNET_CAIP2)).toBe(true);
      expect(isNetworkSupported("unknown")).toBe(false);
    });

    it("should get all supported networks", () => {
      const networks = getSupportedNetworks();
      expect(networks).toContain(TON_MAINNET_CAIP2);
      expect(networks).toContain(TON_TESTNET_CAIP2);
    });
  });

  describe("Address Validation", () => {
    it("should validate correct TON addresses", () => {
      // Friendly format addresses (mainnet and testnet formats)
      expect(validateTonAddress("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs")).toBe(true);
      // Raw format address
      expect(validateTonAddress("0:b113a994b5024a1671df69139328eb759596c38a25f590a8b146fecdc3621dfe")).toBe(true);
    });

    it("should reject invalid addresses", () => {
      expect(validateTonAddress("invalid")).toBe(false);
      expect(validateTonAddress("")).toBe(false);
      expect(validateTonAddress("0x1234567890abcdef")).toBe(false); // EVM format
    });

    it("should compare addresses correctly", () => {
      const addr1 = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
      const addr2 = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
      expect(addressesEqual(addr1, addr2)).toBe(true);
    });

    it("should return false for different addresses", () => {
      const addr1 = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
      const addr2 = "kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx";
      expect(addressesEqual(addr1, addr2)).toBe(false);
    });

    it("should format address to friendly format", () => {
      const addr = Address.parse("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs");
      const formatted = formatAddress(addr);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe("string");
    });
  });

  describe("Jetton Amount Conversion", () => {
    it("should convert decimal amounts to smallest units", () => {
      // USDT has 6 decimals
      expect(convertToJettonAmount("1.00", 6)).toBe("1000000");
      expect(convertToJettonAmount("0.50", 6)).toBe("500000");
      expect(convertToJettonAmount("100.123456", 6)).toBe("100123456");
    });

    it("should handle integer amounts", () => {
      expect(convertToJettonAmount("1", 6)).toBe("1000000");
      expect(convertToJettonAmount("100", 6)).toBe("100000000");
    });

    it("should handle different decimal places", () => {
      // Some tokens might have 9 decimals
      expect(convertToJettonAmount("1.0", 9)).toBe("1000000000");
    });

    it("should floor fractional smallest units", () => {
      // If amount has more precision than decimals allow
      expect(convertToJettonAmount("1.1234567", 6)).toBe("1123456");
    });

    it("should throw for invalid amounts", () => {
      expect(() => convertToJettonAmount("not-a-number", 6)).toThrow("Invalid amount");
    });

    it("should convert smallest units back to decimal", () => {
      expect(convertFromJettonAmount("1000000", 6)).toBe("1");
      expect(convertFromJettonAmount("500000", 6)).toBe("0.5");
      expect(convertFromJettonAmount("1234567", 6)).toBe("1.234567");
    });

    it("should handle bigint input for conversion", () => {
      expect(convertFromJettonAmount(1000000n, 6)).toBe("1");
      expect(convertFromJettonAmount(1500000n, 6)).toBe("1.5");
    });
  });

  describe("Gas Constants", () => {
    it("should have sensible default gas values", () => {
      // 0.1 TON default for Jetton transfers
      expect(DEFAULT_JETTON_TRANSFER_TON).toBe(100_000_000n);
      // Minimal forward amount
      expect(DEFAULT_FORWARD_TON).toBe(1n);
    });

    it("should have minimum and maximum gas bounds", () => {
      // 0.05 TON minimum
      expect(MIN_JETTON_TRANSFER_TON).toBe(50_000_000n);
      // 0.5 TON maximum
      expect(MAX_JETTON_TRANSFER_TON).toBe(500_000_000n);
    });

    it("should have default within bounds", () => {
      expect(DEFAULT_JETTON_TRANSFER_TON).toBeGreaterThanOrEqual(MIN_JETTON_TRANSFER_TON);
      expect(DEFAULT_JETTON_TRANSFER_TON).toBeLessThanOrEqual(MAX_JETTON_TRANSFER_TON);
    });
  });

  describe("Jetton Transfer Operations", () => {
    it("should have correct TEP-74 operation codes", () => {
      expect(JETTON_TRANSFER_OP).toBe(0x0f8a7ea5);
    });

    it("should generate unique query IDs", () => {
      const ids = new Set<bigint>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateQueryId());
      }
      // All IDs should be unique
      expect(ids.size).toBe(100);
    });

    it("should build and parse Jetton transfer body", () => {
      const destination = Address.parse("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs");
      // Use raw format for second address
      const responseDestination = Address.parse("0:b113a994b5024a1671df69139328eb759596c38a25f590a8b146fecdc3621dfe");

      const body = buildJettonTransferBody({
        queryId: 12345n,
        amount: 1000000n,
        destination,
        responseDestination,
        forwardAmount: 1n,
      });

      const parsed = parseJettonTransferBody(body);

      expect(parsed.op).toBe(JETTON_TRANSFER_OP);
      expect(parsed.queryId).toBe(12345n);
      expect(parsed.amount).toBe(1000000n);
      expect(parsed.destination.equals(destination)).toBe(true);
      expect(parsed.responseDestination.equals(responseDestination)).toBe(true);
      expect(parsed.forwardAmount).toBe(1n);
    });
  });

  describe("Validity Duration", () => {
    it("should have sensible default validity duration", () => {
      // 1 hour default
      expect(DEFAULT_VALIDITY_DURATION).toBe(3600);
    });
  });

  describe("Server Price Parsing - Multi-Network", () => {
    const networks: Array<{ name: string; network: Network; usdtAddress: string }> = [
      { name: "Mainnet", network: TON_MAINNET_CAIP2 as Network, usdtAddress: USDT_ADDRESSES[TON_MAINNET_CAIP2] },
      { name: "Testnet", network: TON_TESTNET_CAIP2 as Network, usdtAddress: USDT_ADDRESSES[TON_TESTNET_CAIP2] },
    ];

    for (const { name, network, usdtAddress } of networks) {
      describe(`${name} (${network})`, () => {
        it("should parse price and use correct USDT address", async () => {
          const server = new ExactTonServer();
          const assetAmount = await server.parsePrice("$1.00", network);

          expect(assetAmount.amount).toBe("1000000"); // 1 USDT in smallest units
          expect(assetAmount.asset).toBe(usdtAddress);
        });

        it("should handle different price formats", async () => {
          const server = new ExactTonServer();

          const testCases = [
            { input: "$10.00", expected: "10000000" },
            { input: "5.50", expected: "5500000" },
            { input: 0.01, expected: "10000" },
            { input: 100, expected: "100000000" },
          ];

          for (const testCase of testCases) {
            const result = await server.parsePrice(testCase.input, network);
            expect(result.amount).toBe(testCase.expected);
            expect(result.asset).toBe(usdtAddress);
          }
        });
      });
    }
  });

  describe("Server with Legacy Network Names", () => {
    it("should parse prices with legacy network names", async () => {
      const server = new ExactTonServer();

      // Legacy names should work and map to correct USDT addresses
      const mainnetResult = await server.parsePrice("$1.00", "ton" as Network);
      expect(mainnetResult.asset).toBe(USDT_ADDRESSES[TON_MAINNET_CAIP2]);

      const testnetResult = await server.parsePrice("$1.00", "ton-testnet" as Network);
      expect(testnetResult.asset).toBe(USDT_ADDRESSES[TON_TESTNET_CAIP2]);
    });
  });

  describe("Custom Money Parser Integration", () => {
    it("should use custom parser before default USDT", async () => {
      const server = new ExactTonServer();

      // Register parser that uses custom Jetton for amounts > 50
      server.registerMoneyParser(async (amount) => {
        if (amount > 50) {
          return {
            amount: (amount * 1e9).toString(), // 9 decimals
            asset: "EQCustomJettonAddress11111111111111111111",
            extra: { custom: true },
          };
        }
        return null;
      });

      // Large amount uses custom parser
      const largeResult = await server.parsePrice(100, TON_MAINNET_CAIP2);
      expect(largeResult.asset).toBe("EQCustomJettonAddress11111111111111111111");
      expect(largeResult.extra?.custom).toBe(true);

      // Small amount uses default USDT
      const smallResult = await server.parsePrice(25, TON_MAINNET_CAIP2);
      expect(smallResult.asset).toBe(USDT_ADDRESSES[TON_MAINNET_CAIP2]);
    });

    it("should chain multiple parsers in order", async () => {
      const server = new ExactTonServer();

      server
        .registerMoneyParser(async (amount) => {
          if (amount > 1000) {
            return {
              amount: amount.toString(),
              asset: "VIPJetton",
              extra: { tier: "vip" },
            };
          }
          return null;
        })
        .registerMoneyParser(async (amount) => {
          if (amount > 100) {
            return {
              amount: amount.toString(),
              asset: "PremiumJetton",
              extra: { tier: "premium" },
            };
          }
          return null;
        });

      const vipResult = await server.parsePrice(2000, TON_MAINNET_CAIP2);
      expect(vipResult.extra?.tier).toBe("vip");

      const premiumResult = await server.parsePrice(500, TON_MAINNET_CAIP2);
      expect(premiumResult.extra?.tier).toBe("premium");

      const standardResult = await server.parsePrice(50, TON_MAINNET_CAIP2);
      expect(standardResult.asset).toBe(USDT_ADDRESSES[TON_MAINNET_CAIP2]);
    });
  });

  describe("Server with PreferredJetton Config", () => {
    it("should use preferred Jetton when configured", async () => {
      // Note: Currently only USDT is configured, but this tests the mechanism
      const server = new ExactTonServer({ preferredJetton: "USDT" });
      const result = await server.parsePrice("$1.00", TON_MAINNET_CAIP2);

      expect(result.asset).toBe(USDT_ADDRESSES[TON_MAINNET_CAIP2]);
      expect(result.extra?.symbol).toBe("USDT");
    });
  });

  describe("Server AssetAmount Passthrough", () => {
    it("should pass through AssetAmount directly", async () => {
      const server = new ExactTonServer();

      const assetAmount = {
        amount: "5000000",
        asset: "EQCustomAssetAddress1111111111111111111111",
        extra: { custom: true },
      };

      const result = await server.parsePrice(assetAmount, TON_MAINNET_CAIP2);

      expect(result.amount).toBe("5000000");
      expect(result.asset).toBe("EQCustomAssetAddress1111111111111111111111");
      expect(result.extra?.custom).toBe(true);
    });

    it("should throw if AssetAmount missing asset", async () => {
      const server = new ExactTonServer();

      const invalidAssetAmount = {
        amount: "5000000",
        // missing asset
      };

      await expect(
        server.parsePrice(invalidAssetAmount as any, TON_MAINNET_CAIP2),
      ).rejects.toThrow("Asset address must be specified");
    });
  });

  describe("Server Static Methods", () => {
    it("should return supported networks", () => {
      const networks = ExactTonServer.getSupportedNetworks();
      expect(networks).toContain(TON_MAINNET_CAIP2);
      expect(networks).toContain(TON_TESTNET_CAIP2);
    });

    it("should check network support", () => {
      expect(ExactTonServer.isNetworkSupported(TON_MAINNET_CAIP2)).toBe(true);
      expect(ExactTonServer.isNetworkSupported("unknown")).toBe(false);
    });
  });
});
