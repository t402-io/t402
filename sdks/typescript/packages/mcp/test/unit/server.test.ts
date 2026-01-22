import { describe, it, expect } from "vitest";
import {
  T402McpServer,
  createT402McpServer,
  loadConfigFromEnv,
} from "../../src/server/index.js";

describe("T402McpServer", () => {
  describe("createT402McpServer", () => {
    it("should create server with default config", () => {
      const server = createT402McpServer();
      expect(server).toBeInstanceOf(T402McpServer);
    });

    it("should create server with custom config", () => {
      const server = createT402McpServer({
        demoMode: true,
        privateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      });
      expect(server).toBeInstanceOf(T402McpServer);
    });

    it("should create server with custom RPC URLs", () => {
      const server = createT402McpServer({
        rpcUrls: {
          ethereum: "https://my-custom-rpc.com/eth",
          base: "https://my-custom-rpc.com/base",
        },
      });
      expect(server).toBeInstanceOf(T402McpServer);
    });
  });

  describe("loadConfigFromEnv", () => {
    it("should return empty config when no env vars set", () => {
      // Clear relevant env vars
      const originalEnv = { ...process.env };
      delete process.env.T402_PRIVATE_KEY;
      delete process.env.T402_DEMO_MODE;
      delete process.env.T402_BUNDLER_URL;
      delete process.env.T402_PAYMASTER_URL;

      const config = loadConfigFromEnv();

      // Restore env
      process.env = originalEnv;

      expect(config.privateKey).toBeUndefined();
      expect(config.demoMode).toBeUndefined();
    });

    it("should load demo mode from env", () => {
      const originalEnv = { ...process.env };
      process.env.T402_DEMO_MODE = "true";

      const config = loadConfigFromEnv();

      process.env = originalEnv;

      expect(config.demoMode).toBe(true);
    });

    it("should load private key from env", () => {
      const originalEnv = { ...process.env };
      const testKey = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      process.env.T402_PRIVATE_KEY = testKey;

      const config = loadConfigFromEnv();

      process.env = originalEnv;

      expect(config.privateKey).toBe(testKey);
    });

    it("should load bundler and paymaster URLs from env", () => {
      const originalEnv = { ...process.env };
      process.env.T402_BUNDLER_URL = "https://bundler.example.com";
      process.env.T402_PAYMASTER_URL = "https://paymaster.example.com";

      const config = loadConfigFromEnv();

      process.env = originalEnv;

      expect(config.bundlerUrl).toBe("https://bundler.example.com");
      expect(config.paymasterUrl).toBe("https://paymaster.example.com");
    });

    it("should load custom RPC URLs from env", () => {
      const originalEnv = { ...process.env };
      process.env.T402_RPC_ETHEREUM = "https://custom-eth.com";
      process.env.T402_RPC_BASE = "https://custom-base.com";

      const config = loadConfigFromEnv();

      process.env = originalEnv;

      expect(config.rpcUrls?.ethereum).toBe("https://custom-eth.com");
      expect(config.rpcUrls?.base).toBe("https://custom-base.com");
    });
  });
});

describe("MCP Server Configuration", () => {
  it("should accept all supported network RPC URLs", () => {
    const config = {
      rpcUrls: {
        ethereum: "https://eth.example.com",
        base: "https://base.example.com",
        arbitrum: "https://arb.example.com",
        optimism: "https://op.example.com",
        polygon: "https://poly.example.com",
        avalanche: "https://avax.example.com",
        ink: "https://ink.example.com",
        berachain: "https://bera.example.com",
        unichain: "https://uni.example.com",
      },
    };

    const server = createT402McpServer(config);
    expect(server).toBeInstanceOf(T402McpServer);
  });
});
