import { describe, it, expect } from "vitest";
import {
  TESTNET_CONFIGS,
  MAINNET_CONFIGS,
  CHAIN_FAMILIES,
  getConfigByNetwork,
  getDefaultConfigForFamily,
  getDefaultNetwork,
  getMainnetConfigsForFamily,
  buildAccepts,
  buildRequirements,
  familyFromNetwork,
  getExplorerUrlByNetwork,
} from "../../app/lib/chain-registry";

describe("chain-registry", () => {
  describe("TESTNET_CONFIGS", () => {
    it("has 10 testnet chain families", () => {
      expect(CHAIN_FAMILIES).toHaveLength(10);
      for (const family of CHAIN_FAMILIES) {
        expect(TESTNET_CONFIGS[family]).toBeDefined();
        expect(TESTNET_CONFIGS[family].network).toBeTruthy();
        expect(TESTNET_CONFIGS[family].asset).toBeTruthy();
        expect(TESTNET_CONFIGS[family].payTo).toBeTruthy();
      }
    });

    it("EVM testnet uses USDC with correct EIP-712 name", () => {
      const evm = TESTNET_CONFIGS.evm;
      expect(evm.network).toBe("eip155:84532");
      expect(evm.tokenSymbol).toBe("USDC");
      expect(evm.tokenContractName).toBe("USDC");
      expect(evm.tokenContractVersion).toBe("2");
    });

    it("NEAR testnet uses USDT", () => {
      expect(TESTNET_CONFIGS.near.tokenSymbol).toBe("USDT");
      expect(TESTNET_CONFIGS.near.asset).toBe("usdt.fakes.testnet");
    });

    it("Solana devnet uses correct USDC address", () => {
      expect(TESTNET_CONFIGS.solana.asset).toBe("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    });

    it("Stacks testnet uses sUSDC with correct contract", () => {
      expect(TESTNET_CONFIGS.stacks.tokenSymbol).toBe("sUSDC");
      expect(TESTNET_CONFIGS.stacks.asset).toContain(".token-susdc");
    });
  });

  describe("MAINNET_CONFIGS", () => {
    it("has 34 mainnet chains (25 EVM + 9 non-EVM)", () => {
      const networks = Object.keys(MAINNET_CONFIGS);
      expect(networks.length).toBe(34);

      const evmChains = networks.filter((n) => n.startsWith("eip155:"));
      expect(evmChains.length).toBe(25);

      const nonEvmChains = networks.filter((n) => !n.startsWith("eip155:"));
      expect(nonEvmChains.length).toBe(9);
    });

    it("every mainnet chain has required fields", () => {
      for (const [network, config] of Object.entries(MAINNET_CONFIGS)) {
        expect(config.network).toBe(network);
        expect(config.asset).toBeTruthy();
        expect(config.payTo).toBeTruthy();
        expect(config.explorer).toBeTruthy();
        expect(config.decimals).toBeGreaterThan(0);
        expect(config.tokenSymbol).toBeTruthy();
      }
    });

    it("EVM USDT0 chains use exact scheme with correct EIP-712 name", () => {
      const usdt0Chains = ["eip155:42161", "eip155:10", "eip155:57073"];
      for (const network of usdt0Chains) {
        const config = MAINNET_CONFIGS[network];
        expect(config.scheme).toBe("exact");
        // EIP-712 domain name is either "USD₮0" or "USDT0" depending on deployment
        expect(config.tokenContractName).toMatch(/^USD[₮T]0$|^USDT0$/);
      }
    });

    it("EVM legacy USDT chains use exact-legacy scheme", () => {
      const legacyChains = ["eip155:56", "eip155:43114", "eip155:250", "eip155:42220", "eip155:8217"];
      for (const network of legacyChains) {
        const config = MAINNET_CONFIGS[network];
        expect(config.scheme).toBe("exact-legacy");
      }
    });

    it("Base uses USDC with USD Coin EIP-712 name", () => {
      const base = MAINNET_CONFIGS["eip155:8453"];
      expect(base.tokenSymbol).toBe("USDC");
      expect(base.tokenContractName).toBe("USD Coin");
      expect(base.tokenContractVersion).toBe("2");
    });

    it("BSC USDT has 18 decimals", () => {
      expect(MAINNET_CONFIGS["eip155:56"].decimals).toBe(18);
    });

    it("all non-EVM mainnet chains have correct schemes", () => {
      expect(MAINNET_CONFIGS["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"].scheme).toBe("exact");
      expect(MAINNET_CONFIGS["ton:mainnet"].scheme).toBe("exact");
      expect(MAINNET_CONFIGS["tron:mainnet"].scheme).toBe("exact");
      expect(MAINNET_CONFIGS["near:mainnet"].scheme).toBe("exact-direct");
      expect(MAINNET_CONFIGS["aptos:1"].scheme).toBe("exact-direct");
      expect(MAINNET_CONFIGS["stacks:1"].scheme).toBe("exact-direct");
      expect(MAINNET_CONFIGS["cosmos:noble-1"].scheme).toBe("exact-direct");
    });

    it("TRON mainnet uses correct USDT address", () => {
      expect(MAINNET_CONFIGS["tron:mainnet"].asset).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
    });
  });

  describe("getConfigByNetwork", () => {
    it("finds mainnet config by CAIP-2 ID", () => {
      const config = getConfigByNetwork("eip155:8453");
      expect(config).toBeDefined();
      expect(config!.name).toBe("Base");
    });

    it("finds testnet config by CAIP-2 ID", () => {
      const config = getConfigByNetwork("eip155:84532");
      expect(config).toBeDefined();
      expect(config!.name).toBe("Base Sepolia");
    });

    it("returns undefined for unknown network", () => {
      expect(getConfigByNetwork("eip155:99999")).toBeUndefined();
    });
  });

  describe("getDefaultConfigForFamily", () => {
    it("returns testnet config in testnet mode", () => {
      const config = getDefaultConfigForFamily("evm", true);
      expect(config.network).toBe("eip155:84532");
    });

    it("returns mainnet config in mainnet mode", () => {
      const config = getDefaultConfigForFamily("evm", false);
      expect(config.network).toBe("eip155:42161"); // Arbitrum USDT0
    });
  });

  describe("getMainnetConfigsForFamily", () => {
    it("returns 25 EVM mainnet chains", () => {
      const evmChains = getMainnetConfigsForFamily("evm");
      expect(evmChains.length).toBe(25);
    });

    it("returns 1 chain for non-EVM families", () => {
      for (const family of ["ton", "tron", "solana", "near", "aptos", "tezos", "polkadot", "stacks", "cosmos"] as const) {
        const chains = getMainnetConfigsForFamily(family);
        expect(chains.length).toBe(1);
      }
    });
  });

  describe("buildAccepts", () => {
    it("returns 10 entries in testnet mode", () => {
      const accepts = buildAccepts("1000", true);
      expect(accepts).toHaveLength(10);
      expect(accepts[0].network).toBe("eip155:84532");
    });

    it("returns 10 entries in mainnet mode", () => {
      const accepts = buildAccepts("1000", false);
      expect(accepts).toHaveLength(10);
      expect(accepts[0].network).toBe("eip155:42161"); // Arbitrum USDT0
    });

    it("uses preferred network for EVM in mainnet mode", () => {
      const accepts = buildAccepts("1000", false, "eip155:42161");
      expect(accepts[0].network).toBe("eip155:42161"); // Arbitrum first
      expect(accepts[0].asset).toBe("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
    });

    it("sets correct EIP-712 extra fields", () => {
      const accepts = buildAccepts("1000", false, "eip155:8453");
      const base = accepts.find((a) => a.network === "eip155:8453");
      expect(base?.extra?.name).toBe("USD Coin");
      expect(base?.extra?.version).toBe("2");
    });

    it("exact-direct for non-EVM families", () => {
      const accepts = buildAccepts("1000", false);
      const near = accepts.find((a) => a.network === "near:mainnet");
      expect(near?.scheme).toBe("exact-direct");
    });
  });

  describe("buildRequirements", () => {
    it("builds correct requirements from mainnet payload", () => {
      const req = buildRequirements({ network: "eip155:8453" }, "1000");
      expect(req.network).toBe("eip155:8453");
      expect(req.asset).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
      expect(req.scheme).toBe("exact");
    });

    it("builds correct requirements from testnet payload", () => {
      const req = buildRequirements({ network: "eip155:84532" }, "1000");
      expect(req.network).toBe("eip155:84532");
    });

    it("builds correct requirements for TRON mainnet", () => {
      const req = buildRequirements({ network: "tron:mainnet" }, "1000");
      expect(req.network).toBe("tron:mainnet");
      expect(req.asset).toBe("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
      expect(req.scheme).toBe("exact");
    });

    it("builds correct requirements for Stacks mainnet", () => {
      const req = buildRequirements({ network: "stacks:1" }, "1000");
      expect(req.network).toBe("stacks:1");
      expect(req.asset).toContain(".token-susdc");
      expect(req.scheme).toBe("exact-direct");
    });

    it("falls back to EVM defaults for unknown network", () => {
      const req = buildRequirements({ network: "unknown:123" }, "1000");
      expect(req.network).toBe("eip155:84532"); // fallback
    });
  });

  describe("familyFromNetwork", () => {
    it("correctly identifies all families", () => {
      expect(familyFromNetwork("eip155:1")).toBe("evm");
      expect(familyFromNetwork("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")).toBe("solana");
      expect(familyFromNetwork("ton:mainnet")).toBe("ton");
      expect(familyFromNetwork("tron:mainnet")).toBe("tron");
      expect(familyFromNetwork("stacks:1")).toBe("stacks");
      expect(familyFromNetwork("near:mainnet")).toBe("near");
      expect(familyFromNetwork("aptos:1")).toBe("aptos");
      expect(familyFromNetwork("tezos:NetXdQprcVkpaWU")).toBe("tezos");
      expect(familyFromNetwork("polkadot:68d56f15f85d3136970ec16946040bc1")).toBe("polkadot");
      expect(familyFromNetwork("cosmos:noble-1")).toBe("cosmos");
    });
  });

  describe("getExplorerUrlByNetwork", () => {
    it("generates correct mainnet explorer URLs", () => {
      expect(getExplorerUrlByNetwork("eip155:8453", "0xabc")).toBe("https://basescan.org/tx/0xabc");
      expect(getExplorerUrlByNetwork("tron:mainnet", "abc")).toBe("https://tronscan.org/#/transaction/abc");
    });
  });
});
