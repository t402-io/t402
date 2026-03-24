import { describe, it, expect } from "vitest";
import {
  resolveQuickConfig,
  toRoutesConfig,
  DEFAULT_NETWORK,
  DEFAULT_FACILITATOR_URL,
} from "./config";
import type { QuickConfig } from "./config";

describe("resolveQuickConfig", () => {
  const validConfig: QuickConfig = {
    price: "1.00",
    payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  };

  it("resolves valid config with defaults", () => {
    const resolved = resolveQuickConfig(validConfig);

    expect(resolved.price).toBe("1.00");
    expect(resolved.network).toBe(DEFAULT_NETWORK);
    expect(resolved.payTo).toBe("0x209693Bc6afc0C5328bA36FaF03C514EF312287C");
    expect(resolved.facilitator).toBe(DEFAULT_FACILITATOR_URL);
    expect(resolved.scheme).toBe("exact");
    expect(resolved.maxTimeoutSeconds).toBe(120);
    expect(resolved.asset).toBeDefined();
  });

  it("resolves config with custom network", () => {
    const resolved = resolveQuickConfig({
      ...validConfig,
      network: "eip155:56",
    });

    expect(resolved.network).toBe("eip155:56");
    expect(resolved.asset).toBe("0x55d398326f99059fF775485246999027B3197955"); // BSC USDT
  });

  it("resolves config with custom facilitator", () => {
    const resolved = resolveQuickConfig({
      ...validConfig,
      facilitator: "https://my-facilitator.example.com",
    });

    expect(resolved.facilitator).toBe("https://my-facilitator.example.com");
  });

  it("resolves config with custom scheme and timeout", () => {
    const resolved = resolveQuickConfig({
      ...validConfig,
      scheme: "exact-legacy",
      maxTimeoutSeconds: 60,
    });

    expect(resolved.scheme).toBe("exact-legacy");
    expect(resolved.maxTimeoutSeconds).toBe(60);
  });

  // --- Error cases ---

  it("throws on empty price", () => {
    expect(() => resolveQuickConfig({ price: "", payTo: "0x123" }))
      .toThrow("price is required");
  });

  it("throws on zero price", () => {
    expect(() => resolveQuickConfig({ price: "0", payTo: "0x123" }))
      .toThrow("price must be a positive number");
  });

  it("throws on negative price", () => {
    expect(() => resolveQuickConfig({ price: "-5", payTo: "0x123" }))
      .toThrow("price must be a positive number");
  });

  it("throws on non-numeric price", () => {
    expect(() => resolveQuickConfig({ price: "abc", payTo: "0x123" }))
      .toThrow("price must be a positive number");
  });

  it("throws on missing payTo", () => {
    expect(() => resolveQuickConfig({ price: "1.00" } as QuickConfig))
      .toThrow("payTo (wallet address) is required");
  });

  it("throws on empty payTo", () => {
    expect(() => resolveQuickConfig({ price: "1.00", payTo: "" }))
      .toThrow("payTo (wallet address) is required");
  });

  it("throws on unsupported network", () => {
    expect(() => resolveQuickConfig({
      ...validConfig,
      network: "solana:mainnet" as `${string}:${string}`,
    })).toThrow("no known USDT asset for network");
  });
});

describe("toRoutesConfig", () => {
  it("converts resolved config to RoutesConfig with correct USDT decimals", () => {
    const resolved = resolveQuickConfig({
      price: "1.50",
      payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    });

    const routes = toRoutesConfig(resolved);
    const accepts = (routes as any).accepts;

    // 1.50 USDT = 1,500,000 smallest units (6 decimals)
    expect(accepts.price.amount).toBe("1500000");
    expect(accepts.price.asset).toBeDefined();
    expect(accepts.price.extra.name).toBe("USDT");
    expect(accepts.scheme).toBe("exact");
    expect(accepts.network).toBe(DEFAULT_NETWORK);
    expect(accepts.payTo).toBe("0x209693Bc6afc0C5328bA36FaF03C514EF312287C");
  });

  it("handles whole number price", () => {
    const resolved = resolveQuickConfig({
      price: "10",
      payTo: "0x123",
    });

    const routes = toRoutesConfig(resolved);
    expect((routes as any).accepts.price.amount).toBe("10000000");
  });

  it("handles small price (micropayments)", () => {
    const resolved = resolveQuickConfig({
      price: "0.01",
      payTo: "0x123",
    });

    const routes = toRoutesConfig(resolved);
    expect((routes as any).accepts.price.amount).toBe("10000");
  });
});
