/**
 * Multi-Network Integration Tests for TRON Mechanism
 *
 * These tests verify the TRON mechanism works correctly across
 * different networks (mainnet, nile, shasta) and handles various
 * input formats properly.
 */

import { describe, expect, it } from "vitest";
import {
  TRON_MAINNET_CAIP2,
  TRON_NILE_CAIP2,
  TRON_SHASTA_CAIP2,
  TRON_NETWORKS,
  USDT_ADDRESSES,
  DEFAULT_USDT_DECIMALS,
  TRON_ADDRESS_PREFIX,
  TRON_ADDRESS_LENGTH,
  NETWORK_ENDPOINTS,
  TRON_MAINNET_ENDPOINT,
  TRON_NILE_ENDPOINT,
  TRON_SHASTA_ENDPOINT,
  DEFAULT_FEE_LIMIT,
  MIN_FEE_LIMIT,
  MAX_FEE_LIMIT,
  SUN_PER_TRX,
  MIN_VALIDITY_BUFFER,
} from "../../src/constants";
import {
  normalizeNetwork,
  getEndpoint,
  isTronNetwork,
  validateTronAddress,
  addressesEqual,
  formatAddress,
  convertToSmallestUnits,
  convertFromSmallestUnits,
  isValidHex,
  estimateTransactionFee,
  calculateExpiration,
} from "../../src/utils";
import {
  TRC20_REGISTRY,
  getTRC20Config,
  getNetworkTokens,
  getDefaultToken,
  getTokenByAddress,
  getNetworksForToken,
  getUsdtNetworks,
  isNetworkSupported,
  getSupportedNetworks,
} from "../../src/tokens";
import { ExactTronScheme as ExactTronServer } from "../../src/exact/server/scheme";
import type { AssetAmount } from "@t402/core/types";

describe("TRON Multi-Network Integration Tests", () => {
  describe("Network Identifiers", () => {
    it("should have correct CAIP-2 format for all networks", () => {
      expect(TRON_MAINNET_CAIP2).toBe("tron:mainnet");
      expect(TRON_NILE_CAIP2).toBe("tron:nile");
      expect(TRON_SHASTA_CAIP2).toBe("tron:shasta");
    });

    it("should include all networks in TRON_NETWORKS array", () => {
      expect(TRON_NETWORKS).toContain(TRON_MAINNET_CAIP2);
      expect(TRON_NETWORKS).toContain(TRON_NILE_CAIP2);
      expect(TRON_NETWORKS).toContain(TRON_SHASTA_CAIP2);
      expect(TRON_NETWORKS).toHaveLength(3);
    });
  });

  describe("Network Normalization", () => {
    it("should normalize mainnet variants", () => {
      expect(normalizeNetwork("tron:mainnet")).toBe(TRON_MAINNET_CAIP2);
      expect(normalizeNetwork("mainnet")).toBe(TRON_MAINNET_CAIP2);
      expect(normalizeNetwork("tron")).toBe(TRON_MAINNET_CAIP2);
      expect(normalizeNetwork("MAINNET")).toBe(TRON_MAINNET_CAIP2);
    });

    it("should normalize nile testnet variants", () => {
      expect(normalizeNetwork("tron:nile")).toBe(TRON_NILE_CAIP2);
      expect(normalizeNetwork("nile")).toBe(TRON_NILE_CAIP2);
      expect(normalizeNetwork("tron-nile")).toBe(TRON_NILE_CAIP2);
      expect(normalizeNetwork("NILE")).toBe(TRON_NILE_CAIP2);
    });

    it("should normalize shasta testnet variants", () => {
      expect(normalizeNetwork("tron:shasta")).toBe(TRON_SHASTA_CAIP2);
      expect(normalizeNetwork("shasta")).toBe(TRON_SHASTA_CAIP2);
      expect(normalizeNetwork("tron-shasta")).toBe(TRON_SHASTA_CAIP2);
      expect(normalizeNetwork("SHASTA")).toBe(TRON_SHASTA_CAIP2);
    });

    it("should throw for unsupported networks", () => {
      expect(() => normalizeNetwork("unsupported")).toThrow("Unsupported TRON network");
      expect(() => normalizeNetwork("ethereum")).toThrow("Unsupported TRON network");
      expect(() => normalizeNetwork("solana:mainnet")).toThrow("Unsupported TRON network");
    });

    it("should detect TRON networks correctly", () => {
      expect(isTronNetwork("tron:mainnet")).toBe(true);
      expect(isTronNetwork("tron:nile")).toBe(true);
      expect(isTronNetwork("mainnet")).toBe(true);
      expect(isTronNetwork("nile")).toBe(true);
      expect(isTronNetwork("ethereum")).toBe(false);
      expect(isTronNetwork("solana:mainnet")).toBe(false);
    });
  });

  describe("USDT Token Addresses", () => {
    it("should have USDT address for mainnet", () => {
      const address = USDT_ADDRESSES[TRON_MAINNET_CAIP2];
      expect(address).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
      expect(validateTronAddress(address)).toBe(true);
    });

    it("should have USDT address for nile", () => {
      const address = USDT_ADDRESSES[TRON_NILE_CAIP2];
      expect(address).toBe("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf");
      expect(validateTronAddress(address)).toBe(true);
    });

    it("should have USDT address for shasta", () => {
      const address = USDT_ADDRESSES[TRON_SHASTA_CAIP2];
      expect(address).toBe("TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs");
      expect(validateTronAddress(address)).toBe(true);
    });

    it("should have USDT addresses for all supported networks", () => {
      for (const network of TRON_NETWORKS) {
        const address = USDT_ADDRESSES[network];
        expect(address).toBeDefined();
        expect(address.length).toBe(TRON_ADDRESS_LENGTH);
        expect(address.startsWith(TRON_ADDRESS_PREFIX)).toBe(true);
      }
    });
  });

  describe("TRC20 Registry", () => {
    it("should have registry entries for all networks", () => {
      for (const network of TRON_NETWORKS) {
        const registry = TRC20_REGISTRY[network];
        expect(registry).toBeDefined();
        expect(registry.network).toBe(network);
        expect(registry.defaultToken).toBeDefined();
        expect(registry.tokens.USDT).toBeDefined();
      }
    });

    it("should get TRC20 config by symbol", () => {
      const config = getTRC20Config(TRON_MAINNET_CAIP2, "USDT");
      expect(config).toBeDefined();
      expect(config?.symbol).toBe("USDT");
      expect(config?.name).toBe("Tether USD");
      expect(config?.decimals).toBe(DEFAULT_USDT_DECIMALS);
      expect(config?.contractAddress).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
    });

    it("should get network tokens", () => {
      const tokens = getNetworkTokens(TRON_MAINNET_CAIP2);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].symbol).toBe("USDT");
    });

    it("should get default token", () => {
      for (const network of TRON_NETWORKS) {
        const token = getDefaultToken(network);
        expect(token).toBeDefined();
        expect(token?.symbol).toBe("USDT");
      }
    });

    it("should get token by address", () => {
      const address = USDT_ADDRESSES[TRON_MAINNET_CAIP2];
      const token = getTokenByAddress(TRON_MAINNET_CAIP2, address);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDT");
    });

    it("should get token by address case-insensitively", () => {
      const address = USDT_ADDRESSES[TRON_MAINNET_CAIP2];
      const token = getTokenByAddress(TRON_MAINNET_CAIP2, address.toUpperCase());
      expect(token).toBeDefined();
    });

    it("should get networks for token", () => {
      const networks = getNetworksForToken("USDT");
      expect(networks).toContain(TRON_MAINNET_CAIP2);
      expect(networks).toContain(TRON_NILE_CAIP2);
      expect(networks).toContain(TRON_SHASTA_CAIP2);
    });

    it("should get USDT networks", () => {
      const networks = getUsdtNetworks();
      expect(networks).toHaveLength(3);
    });

    it("should check network support", () => {
      expect(isNetworkSupported(TRON_MAINNET_CAIP2)).toBe(true);
      expect(isNetworkSupported("invalid")).toBe(false);
    });

    it("should get supported networks", () => {
      const networks = getSupportedNetworks();
      expect(networks).toHaveLength(3);
    });
  });

  describe("Address Validation", () => {
    it("should validate correct TRON addresses", () => {
      expect(validateTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(true);
      expect(validateTronAddress("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf")).toBe(true);
      expect(validateTronAddress("TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs")).toBe(true);
    });

    it("should reject addresses without T prefix", () => {
      expect(validateTronAddress("AR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
    });

    it("should reject addresses with wrong length", () => {
      expect(validateTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6")).toBe(false); // 33 chars
      expect(validateTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6ta")).toBe(false); // 35 chars
    });

    it("should reject addresses with invalid characters", () => {
      expect(validateTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjL0OI")).toBe(false); // 0, O, I are not base58
    });

    it("should reject empty and null addresses", () => {
      expect(validateTronAddress("")).toBe(false);
      expect(validateTronAddress(null as unknown as string)).toBe(false);
      expect(validateTronAddress(undefined as unknown as string)).toBe(false);
    });
  });

  describe("Address Comparison", () => {
    it("should compare equal addresses", () => {
      expect(addressesEqual(
        "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      )).toBe(true);
    });

    it("should reject different addresses", () => {
      expect(addressesEqual(
        "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
      )).toBe(false);
    });

    it("should handle empty addresses", () => {
      expect(addressesEqual("", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
      expect(addressesEqual("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", "")).toBe(false);
      expect(addressesEqual("", "")).toBe(false);
    });
  });

  describe("Address Formatting", () => {
    it("should format full address", () => {
      const address = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
      expect(formatAddress(address)).toBe(address);
    });

    it("should truncate address", () => {
      const address = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
      const truncated = formatAddress(address, { truncate: 6 });
      expect(truncated).toBe("TR7NHq...gjLj6t");
    });

    it("should handle empty address", () => {
      expect(formatAddress("")).toBe("");
    });
  });

  describe("Amount Conversion", () => {
    it("should convert decimal to smallest units", () => {
      expect(convertToSmallestUnits("1", 6)).toBe("1000000");
      expect(convertToSmallestUnits("1.5", 6)).toBe("1500000");
      expect(convertToSmallestUnits("0.000001", 6)).toBe("1");
      expect(convertToSmallestUnits("100", 6)).toBe("100000000");
    });

    it("should handle extra decimal places", () => {
      expect(convertToSmallestUnits("1.1234567", 6)).toBe("1123456"); // Truncated
    });

    it("should handle fewer decimal places", () => {
      expect(convertToSmallestUnits("1.5", 6)).toBe("1500000");
      expect(convertToSmallestUnits("1", 6)).toBe("1000000");
    });

    it("should convert smallest units to decimal", () => {
      expect(convertFromSmallestUnits("1000000", 6)).toBe("1");
      expect(convertFromSmallestUnits("1500000", 6)).toBe("1.5");
      expect(convertFromSmallestUnits("1", 6)).toBe("0.000001");
      expect(convertFromSmallestUnits("100000000", 6)).toBe("100");
    });

    it("should handle large amounts", () => {
      expect(convertToSmallestUnits("1000000", 6)).toBe("1000000000000");
      expect(convertFromSmallestUnits("1000000000000", 6)).toBe("1000000");
    });

    it("should handle zero", () => {
      expect(convertToSmallestUnits("0", 6)).toBe("0");
      expect(convertFromSmallestUnits("0", 6)).toBe("0");
    });
  });

  describe("RPC Endpoints", () => {
    it("should have correct endpoints for all networks", () => {
      expect(NETWORK_ENDPOINTS[TRON_MAINNET_CAIP2]).toBe(TRON_MAINNET_ENDPOINT);
      expect(NETWORK_ENDPOINTS[TRON_NILE_CAIP2]).toBe(TRON_NILE_ENDPOINT);
      expect(NETWORK_ENDPOINTS[TRON_SHASTA_CAIP2]).toBe(TRON_SHASTA_ENDPOINT);
    });

    it("should get endpoint for network", () => {
      expect(getEndpoint(TRON_MAINNET_CAIP2)).toBe(TRON_MAINNET_ENDPOINT);
      expect(getEndpoint("mainnet")).toBe(TRON_MAINNET_ENDPOINT);
      expect(getEndpoint(TRON_NILE_CAIP2)).toBe(TRON_NILE_ENDPOINT);
      expect(getEndpoint(TRON_SHASTA_CAIP2)).toBe(TRON_SHASTA_ENDPOINT);
    });

    it("should have HTTPS endpoints", () => {
      expect(TRON_MAINNET_ENDPOINT).toMatch(/^https:\/\//);
      expect(TRON_NILE_ENDPOINT).toMatch(/^https:\/\//);
      expect(TRON_SHASTA_ENDPOINT).toMatch(/^https:\/\//);
    });
  });

  describe("Gas and Fee Constants", () => {
    it("should have expected fee limit values", () => {
      expect(DEFAULT_FEE_LIMIT).toBe(100_000_000); // 100 TRX
      expect(MIN_FEE_LIMIT).toBe(10_000_000); // 10 TRX
      expect(MAX_FEE_LIMIT).toBe(1_000_000_000); // 1000 TRX
    });

    it("should have correct SUN to TRX ratio", () => {
      expect(SUN_PER_TRX).toBe(1_000_000);
    });

    it("should have validity buffer", () => {
      expect(MIN_VALIDITY_BUFFER).toBe(30); // 30 seconds
    });

    it("should estimate transaction fee", () => {
      const activatedFee = estimateTransactionFee(true);
      const unactivatedFee = estimateTransactionFee(false);

      expect(activatedFee).toBe(30_000_000); // 30 TRX
      expect(unactivatedFee).toBe(31_000_000); // 31 TRX (includes activation)
    });
  });

  describe("Hex Validation", () => {
    it("should validate hex strings", () => {
      expect(isValidHex("a9059cbb")).toBe(true);
      expect(isValidHex("0xa9059cbb")).toBe(true);
      expect(isValidHex("ABC123")).toBe(true);
    });

    it("should reject invalid hex", () => {
      expect(isValidHex("")).toBe(false);
      expect(isValidHex("0xGHIJKL")).toBe(false);
      expect(isValidHex("hello")).toBe(false);
    });
  });

  describe("Expiration Calculation", () => {
    it("should calculate expiration correctly", () => {
      const validitySeconds = 3600; // 1 hour
      const now = Date.now();
      const expiration = calculateExpiration(validitySeconds);

      expect(expiration).toBeGreaterThan(now);
      expect(expiration).toBeLessThanOrEqual(now + validitySeconds * 1000 + 100);
    });
  });

  describe("Server Price Parsing", () => {
    describe("Multi-Network Price Parsing", () => {
      it("should parse price for mainnet", async () => {
        const server = new ExactTronServer();
        const result = await server.parsePrice(10, TRON_MAINNET_CAIP2);

        expect(result.amount).toBe("10000000"); // 10 USDT = 10,000,000 smallest units
        expect(result.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
      });

      it("should parse price for nile testnet", async () => {
        const server = new ExactTronServer();
        const result = await server.parsePrice(10, TRON_NILE_CAIP2);

        expect(result.amount).toBe("10000000");
        expect(result.asset).toBe(USDT_ADDRESSES[TRON_NILE_CAIP2]);
      });

      it("should parse price for shasta testnet", async () => {
        const server = new ExactTronServer();
        const result = await server.parsePrice(10, TRON_SHASTA_CAIP2);

        expect(result.amount).toBe("10000000");
        expect(result.asset).toBe(USDT_ADDRESSES[TRON_SHASTA_CAIP2]);
      });

      it("should parse price with legacy network names", async () => {
        const server = new ExactTronServer();

        // mainnet
        const mainnetResult = await server.parsePrice(5, "mainnet");
        expect(mainnetResult.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);

        // nile
        const nileResult = await server.parsePrice(5, "nile");
        expect(nileResult.asset).toBe(USDT_ADDRESSES[TRON_NILE_CAIP2]);

        // shasta
        const shastaResult = await server.parsePrice(5, "shasta");
        expect(shastaResult.asset).toBe(USDT_ADDRESSES[TRON_SHASTA_CAIP2]);
      });
    });

    describe("String Price Formats", () => {
      it("should parse numeric string", async () => {
        const server = new ExactTronServer();
        const result = await server.parsePrice("10.50", TRON_MAINNET_CAIP2);

        expect(result.amount).toBe("10500000"); // 10.50 USDT
      });

      it("should parse dollar format", async () => {
        const server = new ExactTronServer();
        const result = await server.parsePrice("$10.50", TRON_MAINNET_CAIP2);

        expect(result.amount).toBe("10500000");
      });

      it("should parse price with whitespace", async () => {
        const server = new ExactTronServer();
        const result = await server.parsePrice("  10.50  ", TRON_MAINNET_CAIP2);

        expect(result.amount).toBe("10500000");
      });

      it("should throw for invalid price format", async () => {
        const server = new ExactTronServer();

        await expect(server.parsePrice("invalid", TRON_MAINNET_CAIP2)).rejects.toThrow();
      });

      it("should throw for unsupported network", async () => {
        const server = new ExactTronServer();

        await expect(server.parsePrice(10, "unsupported:network")).rejects.toThrow();
      });
    });

    describe("AssetAmount Passthrough", () => {
      it("should pass through AssetAmount with existing asset", async () => {
        const server = new ExactTronServer();
        const input: AssetAmount = {
          amount: "5000000",
          asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
          extra: { custom: "data" },
        };

        const result = await server.parsePrice(input, TRON_MAINNET_CAIP2);

        expect(result.amount).toBe("5000000");
        expect(result.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
        expect(result.extra?.custom).toBe("data");
      });

      it("should add default asset if not specified", async () => {
        const server = new ExactTronServer();
        const input: AssetAmount = {
          amount: "5000000",
        };

        const result = await server.parsePrice(input, TRON_MAINNET_CAIP2);

        expect(result.amount).toBe("5000000");
        expect(result.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
      });
    });

    describe("Custom MoneyParser", () => {
      it("should use custom parser", async () => {
        const server = new ExactTronServer();

        server.registerMoneyParser(async (decimalAmount, network) => {
          if (decimalAmount === 100) {
            return {
              amount: "99000000", // Discounted price
              asset: USDT_ADDRESSES[String(network)],
            };
          }
          return null;
        });

        const result = await server.parsePrice(100, TRON_MAINNET_CAIP2);
        expect(result.amount).toBe("99000000"); // Custom discount applied
      });

      it("should fall back to default parser", async () => {
        const server = new ExactTronServer();

        server.registerMoneyParser(async () => null); // Always returns null

        const result = await server.parsePrice(10, TRON_MAINNET_CAIP2);
        expect(result.amount).toBe("10000000"); // Default conversion used
      });

      it("should chain multiple parsers", async () => {
        const server = new ExactTronServer();

        // First parser: handles amounts > 100
        server.registerMoneyParser(async (decimalAmount, network) => {
          if (decimalAmount > 100) {
            return {
              amount: String(Math.floor(decimalAmount * 0.9 * 1000000)), // 10% discount
              asset: USDT_ADDRESSES[String(network)],
            };
          }
          return null;
        });

        // Second parser: handles amounts > 50
        server.registerMoneyParser(async (decimalAmount, network) => {
          if (decimalAmount > 50) {
            return {
              amount: String(Math.floor(decimalAmount * 0.95 * 1000000)), // 5% discount
              asset: USDT_ADDRESSES[String(network)],
            };
          }
          return null;
        });

        // Should use first parser (10% discount)
        const result1 = await server.parsePrice(200, TRON_MAINNET_CAIP2);
        expect(result1.amount).toBe("180000000"); // 200 * 0.9 = 180

        // Should use second parser (5% discount)
        const result2 = await server.parsePrice(75, TRON_MAINNET_CAIP2);
        expect(result2.amount).toBe("71250000"); // 75 * 0.95 = 71.25

        // Should use default (no discount)
        const result3 = await server.parsePrice(25, TRON_MAINNET_CAIP2);
        expect(result3.amount).toBe("25000000");
      });
    });

    describe("Decimal Precision", () => {
      it("should handle 6 decimal places correctly", async () => {
        const server = new ExactTronServer();

        const result = await server.parsePrice(0.000001, TRON_MAINNET_CAIP2);
        expect(result.amount).toBe("1");
      });

      it("should handle large amounts", async () => {
        const server = new ExactTronServer();

        const result = await server.parsePrice(1000000, TRON_MAINNET_CAIP2);
        expect(result.amount).toBe("1000000000000"); // 1M USDT
      });

      it("should handle precise decimal values", async () => {
        const server = new ExactTronServer();

        const result = await server.parsePrice(1.123456, TRON_MAINNET_CAIP2);
        expect(result.amount).toBe("1123456");
      });
    });

    describe("Requirements Enhancement", () => {
      it("should enhance requirements with token metadata", async () => {
        const server = new ExactTronServer();

        const baseRequirements = {
          scheme: "exact",
          network: TRON_MAINNET_CAIP2,
          amount: "10000000",
          asset: "USDT",
          payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          maxTimeoutSeconds: 3600,
        };

        const enhanced = await server.enhancePaymentRequirements(
          baseRequirements,
          {
            t402Version: 2,
            scheme: "exact",
            network: TRON_MAINNET_CAIP2,
          },
          [],
        );

        expect(enhanced.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
        expect(enhanced.extra?.symbol).toBe("USDT");
        expect(enhanced.extra?.name).toBe("Tether USD");
        expect(enhanced.extra?.decimals).toBe(6);
      });

      it("should preserve existing extra fields", async () => {
        const server = new ExactTronServer();

        const baseRequirements = {
          scheme: "exact",
          network: TRON_MAINNET_CAIP2,
          amount: "10000000",
          asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
          payTo: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
          maxTimeoutSeconds: 3600,
          extra: {
            customField: "customValue",
          },
        };

        const enhanced = await server.enhancePaymentRequirements(
          baseRequirements,
          {
            t402Version: 2,
            scheme: "exact",
            network: TRON_MAINNET_CAIP2,
          },
          [],
        );

        expect(enhanced.extra?.customField).toBe("customValue");
        expect(enhanced.extra?.symbol).toBe("USDT");
      });
    });
  });

  describe("Address Regex Pattern", () => {
    const tronAddressRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

    it("should match valid TRON addresses", () => {
      expect(tronAddressRegex.test("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(true);
      expect(tronAddressRegex.test("TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf")).toBe(true);
    });

    it("should reject invalid addresses", () => {
      expect(tronAddressRegex.test("0x1234567890abcdef")).toBe(false);
      expect(tronAddressRegex.test("bitcoin_address")).toBe(false);
    });
  });
});
