import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerConfigCommands } from "./config.js";

// Create mock state
const mockConfigStore: Record<string, unknown> = {
  defaultNetwork: "eip155:8453",
  facilitatorUrl: "https://facilitator.t402.io",
  testnet: false,
  rpcEndpoints: {},
  encryptedSeed: undefined,
};

// Mock config module
vi.mock("../config/index.js", () => ({
  getConfig: vi.fn((key: string) => mockConfigStore[key]),
  setConfig: vi.fn((key: string, value: unknown) => {
    mockConfigStore[key] = value;
  }),
  getAllConfig: vi.fn(() => mockConfigStore),
  resetConfig: vi.fn(() => {
    mockConfigStore.defaultNetwork = "eip155:8453";
    mockConfigStore.facilitatorUrl = "https://facilitator.t402.io";
    mockConfigStore.testnet = false;
    mockConfigStore.rpcEndpoints = {};
  }),
  getConfigPath: vi.fn(() => "/mock/path/config.json"),
  setRpcEndpoint: vi.fn((network: string, url: string) => {
    (mockConfigStore.rpcEndpoints as Record<string, string>)[network] = url;
  }),
}));

// Mock utils
vi.mock("../utils/index.js", () => ({
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printWarning: vi.fn(),
  printHeader: vi.fn(),
  printTable: vi.fn(),
  getNetworkName: vi.fn((id: string) => {
    const names: Record<string, string> = {
      "eip155:8453": "Base",
      "eip155:84532": "Base Sepolia",
      "eip155:1": "Ethereum",
    };
    return names[id] || id;
  }),
  isValidUrl: vi.fn((url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }),
}));

describe("Config Commands", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride();
    registerConfigCommands(program);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Reset mock store
    mockConfigStore.defaultNetwork = "eip155:8453";
    mockConfigStore.facilitatorUrl = "https://facilitator.t402.io";
    mockConfigStore.testnet = false;
    mockConfigStore.rpcEndpoints = {};
    mockConfigStore.encryptedSeed = undefined;

    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("config show", () => {
    it("registers config show command", () => {
      const configCmd = program.commands.find((cmd) => cmd.name() === "config");
      const showCmd = configCmd?.commands.find((cmd) => cmd.name() === "show");
      expect(showCmd).toBeDefined();
      expect(showCmd?.description()).toBe("Show current configuration");
    });

    it("executes config show", async () => {
      const { printHeader, printTable } = await import("../utils/index.js");
      await program.parseAsync(["node", "test", "config", "show"]);

      expect(printHeader).toHaveBeenCalledWith("T402 CLI Configuration");
      expect(printTable).toHaveBeenCalled();
    });

    it("shows custom RPC endpoints when present", async () => {
      mockConfigStore.rpcEndpoints = { "eip155:8453": "https://custom.rpc.com" };

      await program.parseAsync(["node", "test", "config", "show"]);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("config get", () => {
    it("gets defaultNetwork value", async () => {
      await program.parseAsync(["node", "test", "config", "get", "defaultNetwork"]);
      expect(consoleLogSpy).toHaveBeenCalledWith("eip155:8453");
    });

    it("gets facilitatorUrl value", async () => {
      await program.parseAsync(["node", "test", "config", "get", "facilitatorUrl"]);
      expect(consoleLogSpy).toHaveBeenCalledWith("https://facilitator.t402.io");
    });

    it("gets testnet value", async () => {
      await program.parseAsync(["node", "test", "config", "get", "testnet"]);
      expect(consoleLogSpy).toHaveBeenCalledWith(false);
    });

    it("gets rpcEndpoints as JSON", async () => {
      mockConfigStore.rpcEndpoints = { "eip155:8453": "https://custom.rpc.com" };
      await program.parseAsync(["node", "test", "config", "get", "rpcEndpoints"]);

      const output = consoleLogSpy.mock.calls[0][0];
      expect(JSON.parse(output)).toEqual({ "eip155:8453": "https://custom.rpc.com" });
    });

    it("shows error for invalid key", async () => {
      const { printError } = await import("../utils/index.js");
      await program.parseAsync(["node", "test", "config", "get", "invalidKey"]);
      expect(printError).toHaveBeenCalled();
    });
  });

  describe("config set", () => {
    it("sets defaultNetwork", async () => {
      const { setConfig } = await import("../config/index.js");
      const { printSuccess } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "config", "set", "defaultNetwork", "eip155:1"]);

      expect(setConfig).toHaveBeenCalledWith("defaultNetwork", "eip155:1");
      expect(printSuccess).toHaveBeenCalled();
    });

    it("sets facilitatorUrl with valid URL", async () => {
      const { setConfig } = await import("../config/index.js");
      const { printSuccess } = await import("../utils/index.js");

      await program.parseAsync([
        "node",
        "test",
        "config",
        "set",
        "facilitatorUrl",
        "https://new.facilitator.io",
      ]);

      expect(setConfig).toHaveBeenCalledWith("facilitatorUrl", "https://new.facilitator.io");
      expect(printSuccess).toHaveBeenCalled();
    });

    it("rejects invalid facilitatorUrl", async () => {
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "config", "set", "facilitatorUrl", "not-a-url"]);

      expect(printError).toHaveBeenCalled();
    });

    it("sets testnet mode to true", async () => {
      const { setConfig } = await import("../config/index.js");
      const { printSuccess } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "config", "set", "testnet", "true"]);

      expect(setConfig).toHaveBeenCalledWith("testnet", true);
      expect(setConfig).toHaveBeenCalledWith("defaultNetwork", "eip155:84532");
      expect(printSuccess).toHaveBeenCalled();
    });

    it("sets testnet mode to false", async () => {
      const { setConfig } = await import("../config/index.js");

      await program.parseAsync(["node", "test", "config", "set", "testnet", "false"]);

      expect(setConfig).toHaveBeenCalledWith("testnet", false);
      expect(setConfig).toHaveBeenCalledWith("defaultNetwork", "eip155:8453");
    });

    it("shows error for unknown key", async () => {
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "config", "set", "unknownKey", "value"]);

      expect(printError).toHaveBeenCalled();
    });
  });

  describe("config rpc", () => {
    it("sets RPC endpoint for network", async () => {
      const { setRpcEndpoint } = await import("../config/index.js");
      const { printSuccess } = await import("../utils/index.js");

      await program.parseAsync([
        "node",
        "test",
        "config",
        "rpc",
        "eip155:8453",
        "https://custom.rpc.com",
      ]);

      expect(setRpcEndpoint).toHaveBeenCalledWith("eip155:8453", "https://custom.rpc.com");
      expect(printSuccess).toHaveBeenCalled();
    });

    it("rejects invalid RPC URL", async () => {
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "config", "rpc", "eip155:8453", "invalid-url"]);

      expect(printError).toHaveBeenCalled();
    });
  });

  describe("config reset", () => {
    it("shows warning without --force flag", async () => {
      const { printWarning } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "config", "reset"]);

      expect(printWarning).toHaveBeenCalled();
    });

    it("resets config with --force flag", async () => {
      const { resetConfig } = await import("../config/index.js");
      const { printSuccess } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "config", "reset", "--force"]);

      expect(resetConfig).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Configuration reset to defaults");
    });

    it("preserves wallet on reset", async () => {
      const { setConfig } = await import("../config/index.js");
      mockConfigStore.encryptedSeed = "encrypted-seed-data";

      await program.parseAsync(["node", "test", "config", "reset", "--force"]);

      expect(setConfig).toHaveBeenCalledWith("encryptedSeed", "encrypted-seed-data");
    });
  });

  describe("config path", () => {
    it("shows config file path", async () => {
      await program.parseAsync(["node", "test", "config", "path"]);
      expect(consoleLogSpy).toHaveBeenCalledWith("/mock/path/config.json");
    });
  });
});
