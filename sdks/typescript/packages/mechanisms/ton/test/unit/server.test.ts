import { describe, it, expect } from "vitest";
import { ExactTonScheme } from "../../src/exact/server/scheme";
import { TON_MAINNET_CAIP2, TON_TESTNET_CAIP2 } from "../../src/constants";
import { USDT_ADDRESSES } from "../../src/tokens";

describe("ExactTonScheme (Server)", () => {
  describe("constructor", () => {
    it("should create instance with default config", () => {
      const scheme = new ExactTonScheme();
      expect(scheme.scheme).toBe("exact");
    });

    it("should create instance with custom config", () => {
      const scheme = new ExactTonScheme({ preferredJetton: "USDT" });
      expect(scheme.scheme).toBe("exact");
    });
  });

  describe("parsePrice", () => {
    it("should parse numeric price to USDT amount", async () => {
      const scheme = new ExactTonScheme();
      const result = await scheme.parsePrice(1.5, TON_MAINNET_CAIP2);

      expect(result.amount).toBe("1500000"); // 1.5 * 10^6
      expect(result.asset).toBe(USDT_ADDRESSES[TON_MAINNET_CAIP2]);
      expect(result.extra?.symbol).toBe("USDT");
    });

    it("should parse string price with dollar sign", async () => {
      const scheme = new ExactTonScheme();
      const result = await scheme.parsePrice("$10.50", TON_MAINNET_CAIP2);

      expect(result.amount).toBe("10500000"); // 10.50 * 10^6
      expect(result.asset).toBe(USDT_ADDRESSES[TON_MAINNET_CAIP2]);
    });

    it("should parse string price without dollar sign", async () => {
      const scheme = new ExactTonScheme();
      const result = await scheme.parsePrice("25.00", TON_MAINNET_CAIP2);

      expect(result.amount).toBe("25000000"); // 25 * 10^6
    });

    it("should return AssetAmount directly if already parsed", async () => {
      const scheme = new ExactTonScheme();
      const assetAmount = {
        amount: "5000000",
        asset: "EQCustomJettonAddress",
        extra: { custom: true },
      };

      const result = await scheme.parsePrice(assetAmount, TON_MAINNET_CAIP2);

      expect(result).toEqual(assetAmount);
    });

    it("should throw for AssetAmount without asset", async () => {
      const scheme = new ExactTonScheme();
      const assetAmount = {
        amount: "5000000",
      };

      await expect(scheme.parsePrice(assetAmount as any, TON_MAINNET_CAIP2)).rejects.toThrow(
        "Asset address must be specified",
      );
    });

    it("should throw for invalid money format", async () => {
      const scheme = new ExactTonScheme();

      await expect(scheme.parsePrice("invalid", TON_MAINNET_CAIP2)).rejects.toThrow(
        "Invalid money format",
      );
    });

    it("should work with testnet", async () => {
      const scheme = new ExactTonScheme();
      const result = await scheme.parsePrice(1.0, TON_TESTNET_CAIP2);

      expect(result.amount).toBe("1000000");
      expect(result.asset).toBe(USDT_ADDRESSES[TON_TESTNET_CAIP2]);
    });
  });

  describe("registerMoneyParser", () => {
    it("should allow registering custom money parsers", async () => {
      const scheme = new ExactTonScheme();

      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: (amount * 1e9).toString(),
            asset: "EQCustomLargeToken",
            extra: { tier: "large" },
          };
        }
        return null;
      });

      // Large amount should use custom parser
      const largeResult = await scheme.parsePrice(150, TON_MAINNET_CAIP2);
      expect(largeResult.asset).toBe("EQCustomLargeToken");
      expect(largeResult.extra?.tier).toBe("large");

      // Small amount should fall back to default
      const smallResult = await scheme.parsePrice(50, TON_MAINNET_CAIP2);
      expect(smallResult.asset).toBe(USDT_ADDRESSES[TON_MAINNET_CAIP2]);
    });

    it("should chain multiple parsers", async () => {
      const scheme = new ExactTonScheme();

      // Parser 1: Premium tier
      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 1000) {
          return {
            amount: amount.toString(),
            asset: "EQPremiumToken",
            extra: { tier: "premium" },
          };
        }
        return null;
      });

      // Parser 2: Large tier
      scheme.registerMoneyParser(async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: amount.toString(),
            asset: "EQLargeToken",
            extra: { tier: "large" },
          };
        }
        return null;
      });

      const premium = await scheme.parsePrice(2000, TON_MAINNET_CAIP2);
      expect(premium.extra?.tier).toBe("premium");

      const large = await scheme.parsePrice(200, TON_MAINNET_CAIP2);
      expect(large.extra?.tier).toBe("large");

      const standard = await scheme.parsePrice(50, TON_MAINNET_CAIP2);
      expect(standard.asset).toBe(USDT_ADDRESSES[TON_MAINNET_CAIP2]);
    });

    it("should return self for chaining", () => {
      const scheme = new ExactTonScheme();

      const result = scheme
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null);

      expect(result).toBe(scheme);
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should add gas sponsor from supportedKind", async () => {
      const scheme = new ExactTonScheme();

      const requirements = {
        scheme: "exact",
        network: TON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "EQRecipientAddress",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact",
        network: TON_MAINNET_CAIP2,
        extra: { gasSponsor: "EQSponsorAddress" },
      };

      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, []);

      expect(enhanced.extra.gasSponsor).toBe("EQSponsorAddress");
    });

    it("should preserve existing extra fields", async () => {
      const scheme = new ExactTonScheme();

      const requirements = {
        scheme: "exact",
        network: TON_MAINNET_CAIP2,
        asset: USDT_ADDRESSES[TON_MAINNET_CAIP2],
        amount: "1000000",
        payTo: "EQRecipientAddress",
        maxTimeoutSeconds: 3600,
        extra: { existingField: "value" },
      };

      const supportedKind = {
        t402Version: 2,
        scheme: "exact",
        network: TON_MAINNET_CAIP2,
        extra: { gasSponsor: "EQSponsorAddress" },
      };

      const enhanced = await scheme.enhancePaymentRequirements(requirements, supportedKind, []);

      expect(enhanced.extra.existingField).toBe("value");
      expect(enhanced.extra.gasSponsor).toBe("EQSponsorAddress");
    });
  });

  describe("static methods", () => {
    it("should return supported networks", () => {
      const networks = ExactTonScheme.getSupportedNetworks();
      expect(networks).toContain(TON_MAINNET_CAIP2);
      expect(networks).toContain(TON_TESTNET_CAIP2);
    });

    it("should check network support", () => {
      expect(ExactTonScheme.isNetworkSupported(TON_MAINNET_CAIP2)).toBe(true);
      expect(ExactTonScheme.isNetworkSupported("unknown:network")).toBe(false);
    });
  });
});
