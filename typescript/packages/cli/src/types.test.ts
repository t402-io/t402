import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, NETWORKS } from "./types.js";

describe("DEFAULT_CONFIG", () => {
  it("has correct default values", () => {
    expect(DEFAULT_CONFIG.defaultNetwork).toBe("eip155:8453");
    expect(DEFAULT_CONFIG.facilitatorUrl).toBe("https://facilitator.t402.io");
    expect(DEFAULT_CONFIG.testnet).toBe(false);
    expect(DEFAULT_CONFIG.rpcEndpoints).toEqual({});
  });
});

describe("NETWORKS", () => {
  it("contains EVM mainnet networks", () => {
    const evmMainnets = NETWORKS.filter((n) => n.type === "evm" && !n.testnet);
    expect(evmMainnets.length).toBeGreaterThan(0);

    const base = evmMainnets.find((n) => n.id === "eip155:8453");
    expect(base).toBeDefined();
    expect(base?.name).toBe("Base");
    expect(base?.assets).toContain("usdt0");
  });

  it("contains EVM testnet networks", () => {
    const evmTestnets = NETWORKS.filter((n) => n.type === "evm" && n.testnet);
    expect(evmTestnets.length).toBeGreaterThan(0);

    const baseSepolia = evmTestnets.find((n) => n.id === "eip155:84532");
    expect(baseSepolia).toBeDefined();
    expect(baseSepolia?.name).toBe("Base Sepolia");
  });

  it("contains Solana networks", () => {
    const solanaNetworks = NETWORKS.filter((n) => n.type === "solana");
    expect(solanaNetworks.length).toBeGreaterThan(0);

    const mainnet = solanaNetworks.find((n) => !n.testnet);
    expect(mainnet).toBeDefined();
    expect(mainnet?.assets).toContain("usdt");
  });

  it("contains TON networks", () => {
    const tonNetworks = NETWORKS.filter((n) => n.type === "ton");
    expect(tonNetworks.length).toBeGreaterThan(0);

    const mainnet = tonNetworks.find((n) => n.id === "ton:-239");
    expect(mainnet).toBeDefined();
    expect(mainnet?.name).toBe("TON");
  });

  it("contains TRON networks", () => {
    const tronNetworks = NETWORKS.filter((n) => n.type === "tron");
    expect(tronNetworks.length).toBeGreaterThan(0);

    const mainnet = tronNetworks.find((n) => n.id === "tron:mainnet");
    expect(mainnet).toBeDefined();
    expect(mainnet?.name).toBe("TRON");
  });

  it("all networks have required fields", () => {
    for (const network of NETWORKS) {
      expect(network.id).toBeDefined();
      expect(network.name).toBeDefined();
      expect(network.type).toMatch(/^(evm|solana|ton|tron)$/);
      expect(typeof network.testnet).toBe("boolean");
      expect(Array.isArray(network.assets)).toBe(true);
      expect(network.assets.length).toBeGreaterThan(0);
    }
  });
});
