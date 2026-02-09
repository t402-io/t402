import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerPayCommands } from "./pay.js";

// Mock state
let mockEncryptedSeed: string | undefined;

// Mock config module
vi.mock("../config/index.js", () => ({
  getEncryptedSeed: vi.fn(() => mockEncryptedSeed),
  getConfig: vi.fn((key: string) => {
    if (key === "testnet") return false;
    if (key === "defaultNetwork") return "eip155:8453";
    return undefined;
  }),
}));

// Mock utils
vi.mock("../utils/index.js", () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    text: "",
  })),
  formatAddress: vi.fn((addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`),
  formatAmount: vi.fn((amount: string) => {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** 6);
    return (value / divisor).toString();
  }),
  parseAmount: vi.fn((amount: string) => {
    const parts = amount.split(".");
    const whole = parts[0] || "0";
    const fraction = (parts[1] || "").padEnd(6, "0").slice(0, 6);
    return (BigInt(whole) * BigInt(10 ** 6) + BigInt(fraction)).toString();
  }),
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printHeader: vi.fn(),
  printTable: vi.fn(),
  decryptSeed: vi.fn((encrypted: string, _key: string) => encrypted.replace("encrypted:", "")),
  getNetworkName: vi.fn((id: string) => {
    const names: Record<string, string> = {
      "eip155:8453": "Base",
      "eip155:84532": "Base Sepolia",
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

describe("Pay Commands", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride();
    registerPayCommands(program);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockEncryptedSeed = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("pay command", () => {
    it("registers pay command", () => {
      const payCmd = program.commands.find((cmd) => cmd.name() === "pay");
      expect(payCmd).toBeDefined();
      expect(payCmd?.description()).toBe("Send a payment to an address");
    });

    it("has correct options", () => {
      const payCmd = program.commands.find((cmd) => cmd.name() === "pay");
      const options = payCmd?.options.map((o) => o.long);
      expect(options).toContain("--network");
      expect(options).toContain("--asset");
      expect(options).toContain("--gasless");
    });

    it("shows error when no wallet configured", async () => {
      mockEncryptedSeed = undefined;
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "pay", "0x1234", "1.0"]);

      expect(printError).toHaveBeenCalledWith(
        "No wallet configured. Run 'wallet create' or 'wallet import' first.",
      );
    });

    it("validates network matches testnet mode", async () => {
      mockEncryptedSeed = "encrypted:test-seed";
      const { printError } = await import("../utils/index.js");

      // Default testnet=false, but using testnet network (ton:-3 is detected as testnet)
      await program.parseAsync([
        "node",
        "test",
        "pay",
        "0x1234",
        "1.0",
        "--network",
        "ton:-3",
      ]);

      expect(printError).toHaveBeenCalledWith(
        expect.stringContaining("doesn't match testnet mode"),
      );
    });

    it("shows payment details with correct formatting", async () => {
      mockEncryptedSeed = "encrypted:test-seed";
      const { printHeader, printTable } = await import("../utils/index.js");

      // This will fail on the dynamic import of @t402/wdk but we can verify the UI output
      await program.parseAsync(["node", "test", "pay", "0x1234", "1.0"]);

      expect(printHeader).toHaveBeenCalledWith("Payment Details");
      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({
          Network: "Base",
          Mode: "Standard",
        }),
      );
    });

    it("shows gasless mode in payment details", async () => {
      mockEncryptedSeed = "encrypted:test-seed";
      const { printTable } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "pay", "0x1234", "1.0", "--gasless"]);

      expect(printTable).toHaveBeenCalledWith(
        expect.objectContaining({
          Mode: "Gasless (ERC-4337)",
        }),
      );
    });
  });

  describe("pay-invoice command", () => {
    it("registers pay-invoice command", () => {
      const payInvoiceCmd = program.commands.find((cmd) => cmd.name() === "pay-invoice");
      expect(payInvoiceCmd).toBeDefined();
      expect(payInvoiceCmd?.description()).toBe("Pay a 402 Payment Required response");
    });

    it("has correct options", () => {
      const payInvoiceCmd = program.commands.find((cmd) => cmd.name() === "pay-invoice");
      const options = payInvoiceCmd?.options.map((o) => o.long);
      expect(options).toContain("--gasless");
      expect(options).toContain("--index");
    });

    it("validates URL format", async () => {
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "pay-invoice", "not-a-url"]);

      expect(printError).toHaveBeenCalledWith("Invalid URL format");
    });

    it("shows error when no wallet configured", async () => {
      mockEncryptedSeed = undefined;
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "pay-invoice", "https://example.com/api"]);

      expect(printError).toHaveBeenCalledWith(
        "No wallet configured. Run 'wallet create' or 'wallet import' first.",
      );
    });
  });
});
