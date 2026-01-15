import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerInfoCommand } from "./info.js";

// Mock config module
vi.mock("../config/index.js", () => ({
  getConfig: vi.fn((key: string) => {
    if (key === "testnet") return false;
    if (key === "facilitatorUrl") return "https://facilitator.t402.io";
    return undefined;
  }),
}));

// Mock utils
vi.mock("../utils/index.js", () => ({
  printHeader: vi.fn(),
}));

describe("Info Command", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride();
    registerInfoCommand(program);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe("info command", () => {
    it("registers info command", () => {
      const infoCommand = program.commands.find((cmd) => cmd.name() === "info");
      expect(infoCommand).toBeDefined();
      expect(infoCommand?.description()).toBe("Show supported networks and assets");
    });

    it("executes info command and outputs network information", async () => {
      await program.parseAsync(["node", "test", "info"]);
      expect(consoleLogSpy).toHaveBeenCalled();

      // Check for key output sections
      const calls = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(calls).toContain("Supported Networks:");
      expect(calls).toContain("Supported Assets:");
      expect(calls).toContain("Payment Schemes:");
      expect(calls).toContain("Features:");
    });

    it("shows mainnet networks by default", async () => {
      await program.parseAsync(["node", "test", "info"]);

      const calls = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(calls).toContain("EVM (Mainnet):");
    });

    it("shows testnet networks with --testnet flag", async () => {
      await program.parseAsync(["node", "test", "info", "--testnet"]);

      const calls = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(calls).toContain("EVM (Testnet):");
    });

    it("shows all networks with --all flag", async () => {
      await program.parseAsync(["node", "test", "info", "--all"]);

      const calls = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(calls).toContain("EVM (Mainnet):");
      expect(calls).toContain("EVM (Testnet):");
    });

    it("has short flag aliases", () => {
      const infoCommand = program.commands.find((cmd) => cmd.name() === "info");
      const allOption = infoCommand?.options.find((opt) => opt.long === "--all");
      const testnetOption = infoCommand?.options.find((opt) => opt.long === "--testnet");

      expect(allOption?.short).toBe("-a");
      expect(testnetOption?.short).toBe("-t");
    });
  });

  describe("version command", () => {
    it("registers version command", () => {
      const versionCommand = program.commands.find((cmd) => cmd.name() === "version");
      expect(versionCommand).toBeDefined();
      expect(versionCommand?.description()).toBe("Show CLI version");
    });

    it("executes version command and outputs version", async () => {
      await program.parseAsync(["node", "test", "version"]);
      expect(consoleLogSpy).toHaveBeenCalled();

      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toMatch(/t402 CLI v\d+\.\d+\.\d+/);
    });
  });
});
