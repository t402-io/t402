import { describe, it, expect } from "vitest";
import { ExactTronScheme } from "../src/exact/server/scheme";
import {
  TRON_MAINNET_CAIP2,
  TRON_NILE_CAIP2,
  TRON_SHASTA_CAIP2,
  USDT_ADDRESSES,
  DEFAULT_USDT_DECIMALS,
} from "../src/constants";

describe("ExactTronScheme (Server)", () => {
  describe("constructor", () => {
    it("should create instance with default config", () => {
      const scheme = new ExactTronScheme();
      expect(scheme.scheme).toBe("exact");
    });

    it("should create instance with custom config", () => {
      const scheme = new ExactTronScheme({ preferredToken: "USDT" });
      expect(scheme.scheme).toBe("exact");
    });
  });

  describe("parsePrice", () => {
    it("should parse numeric price to USDT amount", async () => {
      const scheme = new ExactTronScheme();
      const result = await scheme.parsePrice(1.5, TRON_MAINNET_CAIP2);

      expect(result.amount).toBe("1500000"); // 1.5 * 10^6
      expect(result.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
      expect(result.extra?.symbol).toBe("USDT");
    });

    it("should parse string price with dollar sign", async () => {
      const scheme = new ExactTronScheme();
      const result = await scheme.parsePrice("$10.50", TRON_MAINNET_CAIP2);

      expect(result.amount).toBe("10500000"); // 10.50 * 10^6
      expect(result.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
    });

    it("should parse string price without dollar sign", async () => {
      const scheme = new ExactTronScheme();
      const result = await scheme.parsePrice("25.00", TRON_MAINNET_CAIP2);

      expect(result.amount).toBe("25000000"); // 25 * 10^6
    });

    it("should parse small decimal prices", async () => {
      const scheme = new ExactTronScheme();
      const result = await scheme.parsePrice("$0.001", TRON_MAINNET_CAIP2);

      expect(result.amount).toBe("1000"); // 0.001 * 10^6
    });

    it("should return AssetAmount directly if already parsed", async () => {
      const scheme = new ExactTronScheme();
      const assetAmount = {
        amount: "5000000",
        asset: "TCustomTokenAddress",
        extra: { custom: true },
      };

      const result = await scheme.parsePrice(assetAmount, TRON_MAINNET_CAIP2);

      expect(result.amount).toBe("5000000");
      expect(result.asset).toBe("TCustomTokenAddress");
      expect(result.extra?.custom).toBe(true);
    });

    it("should use default asset when AssetAmount has no asset", async () => {
      const scheme = new ExactTronScheme();
      const assetAmount = {
        amount: "5000000",
      };

      const result = await scheme.parsePrice(assetAmount as any, TRON_MAINNET_CAIP2);

      expect(result.amount).toBe("5000000");
      expect(result.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
    });

    it("should throw for invalid money format", async () => {
      const scheme = new ExactTronScheme();

      await expect(scheme.parsePrice("invalid", TRON_MAINNET_CAIP2)).rejects.toThrow(
        "Failed to parse price",
      );
    });

    it("should throw for unsupported network", async () => {
      const scheme = new ExactTronScheme();

      await expect(scheme.parsePrice(1.0, "tron:unsupported")).rejects.toThrow(
        "Unsupported TRON network",
      );
    });

    it("should work with nile testnet", async () => {
      const scheme = new ExactTronScheme();
      const result = await scheme.parsePrice(1.0, TRON_NILE_CAIP2);

      expect(result.amount).toBe("1000000");
      expect(result.asset).toBe(USDT_ADDRESSES[TRON_NILE_CAIP2]);
    });

    it("should work with shasta testnet", async () => {
      const scheme = new ExactTronScheme();
      const result = await scheme.parsePrice(1.0, TRON_SHASTA_CAIP2);

      expect(result.amount).toBe("1000000");
      expect(result.asset).toBe(USDT_ADDRESSES[TRON_SHASTA_CAIP2]);
    });

    it("should handle integer prices", async () => {
      const scheme = new ExactTronScheme();
      const result = await scheme.parsePrice(100, TRON_MAINNET_CAIP2);

      expect(result.amount).toBe("100000000"); // 100 * 10^6
    });

    it("should handle zero price", async () => {
      const scheme = new ExactTronScheme();
      const result = await scheme.parsePrice(0, TRON_MAINNET_CAIP2);

      expect(result.amount).toBe("0");
    });
  });

  describe("registerMoneyParser", () => {
    it("should allow registering custom money parsers", async () => {
      const scheme = new ExactTronScheme();

      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: (amount * 1e6).toString(),
            asset: "TCustomLargeToken",
            extra: { tier: "large" },
          };
        }
        return null;
      });

      // Large amount should use custom parser
      const largeResult = await scheme.parsePrice(150, TRON_MAINNET_CAIP2);
      expect(largeResult.asset).toBe("TCustomLargeToken");
      expect(largeResult.extra?.tier).toBe("large");

      // Small amount should fall back to default
      const smallResult = await scheme.parsePrice(50, TRON_MAINNET_CAIP2);
      expect(smallResult.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
    });

    it("should chain multiple parsers in registration order", async () => {
      const scheme = new ExactTronScheme();

      // Parser 1: Premium tier (>1000)
      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 1000) {
          return {
            amount: amount.toString(),
            asset: "TPremiumToken",
            extra: { tier: "premium" },
          };
        }
        return null;
      });

      // Parser 2: Large tier (>100)
      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: amount.toString(),
            asset: "TLargeToken",
            extra: { tier: "large" },
          };
        }
        return null;
      });

      const premium = await scheme.parsePrice(2000, TRON_MAINNET_CAIP2);
      expect(premium.extra?.tier).toBe("premium");

      const large = await scheme.parsePrice(200, TRON_MAINNET_CAIP2);
      expect(large.extra?.tier).toBe("large");

      const standard = await scheme.parsePrice(50, TRON_MAINNET_CAIP2);
      expect(standard.asset).toBe(USDT_ADDRESSES[TRON_MAINNET_CAIP2]);
    });

    it("should return self for chaining", () => {
      const scheme = new ExactTronScheme();

      const result = scheme
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null);

      expect(result).toBe(scheme);
    });

    it("should skip parser on error and try next", async () => {
      const scheme = new ExactTronScheme();

      // Parser that throws
      scheme.registerMoneyParser(async (_amount, _network) => {
        throw new Error("Parser error");
      });

      // Fallback parser
      scheme.registerMoneyParser(async (amount, _network) => {
        return {
          amount: amount.toString(),
          asset: "TFallbackToken",
          extra: { fallback: true },
        };
      });

      const result = await scheme.parsePrice(50, TRON_MAINNET_CAIP2);
      expect(result.asset).toBe("TFallbackToken");
      expect(result.extra?.fallback).toBe(true);
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should add token metadata to requirements when asset is USDT", async () => {
      const scheme = new ExactTronScheme();

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "TRecipientAddress",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        extra: {},
      };

      // The enhancePaymentRequirements uses getTRC20Config for known tokens
      // which is imported statically, only getTokenByAddress uses dynamic require
      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, []);

      expect(enhanced.extra.symbol).toBe("USDT");
      expect(enhanced.extra.name).toBe("Tether USD");
      expect(enhanced.extra.decimals).toBe(DEFAULT_USDT_DECIMALS);
    });

    it("should preserve existing extra fields", async () => {
      const scheme = new ExactTronScheme();

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "TRecipientAddress",
        maxTimeoutSeconds: 3600,
        extra: { existingField: "value", customData: 123 },
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        extra: {},
      };

      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, []);

      expect(enhanced.extra.existingField).toBe("value");
      expect(enhanced.extra.customData).toBe(123);
      expect(enhanced.extra.symbol).toBe("USDT");
    });

    it("should copy extension data from supportedKind", async () => {
      const scheme = new ExactTronScheme();

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "TRecipientAddress",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        extra: {
          customExtension: "extensionValue",
          anotherExtension: 42,
          notIncluded: "ignored",
        },
      };

      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, [
        "customExtension",
        "anotherExtension",
      ]);

      expect(enhanced.extra.customExtension).toBe("extensionValue");
      expect(enhanced.extra.anotherExtension).toBe(42);
      expect(enhanced.extra.notIncluded).toBeUndefined();
    });

    it("should use default token when asset not in registry", async () => {
      const scheme = new ExactTronScheme();

      const requirements = {
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        asset: "TUnknownTokenAddress",
        amount: "1000000",
        payTo: "TRecipientAddress",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact",
        network: TRON_MAINNET_CAIP2,
        extra: {},
      };

      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, []);

      // Should still have token metadata from default
      expect(enhanced.extra.symbol).toBe("USDT");
      expect(enhanced.extra.decimals).toBe(DEFAULT_USDT_DECIMALS);
    });

    it("should work with nile testnet", async () => {
      const scheme = new ExactTronScheme();

      const requirements = {
        scheme: "exact",
        network: TRON_NILE_CAIP2,
        asset: USDT_ADDRESSES[TRON_NILE_CAIP2],
        amount: "1000000",
        payTo: "TRecipientAddress",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact",
        network: TRON_NILE_CAIP2,
        extra: {},
      };

      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, []);

      expect(enhanced.asset).toBe(USDT_ADDRESSES[TRON_NILE_CAIP2]);
      expect(enhanced.extra.symbol).toBe("USDT");
    });

    it("should work with shasta testnet", async () => {
      const scheme = new ExactTronScheme();

      const requirements = {
        scheme: "exact",
        network: TRON_SHASTA_CAIP2,
        asset: USDT_ADDRESSES[TRON_SHASTA_CAIP2],
        amount: "1000000",
        payTo: "TRecipientAddress",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact",
        network: TRON_SHASTA_CAIP2,
        extra: {},
      };

      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, []);

      expect(enhanced.asset).toBe(USDT_ADDRESSES[TRON_SHASTA_CAIP2]);
      expect(enhanced.extra.symbol).toBe("USDT");
    });
  });
});
