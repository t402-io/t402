import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerWalletCommands } from "./wallet.js";

// Mock state
let mockHasSeed = false;
let mockEncryptedSeed: string | undefined;
let mockReadlineAnswer = "";

// Mock node:readline for interactive import
vi.mock("node:readline", () => ({
  createInterface: vi.fn(() => ({
    question: (_prompt: string, cb: (answer: string) => void) => cb(mockReadlineAnswer),
    close: vi.fn(),
  })),
}));

// Mock config module
vi.mock("../config/index.js", () => ({
  hasSeedConfigured: vi.fn(() => mockHasSeed),
  storeSeed: vi.fn((seed: string) => {
    mockEncryptedSeed = seed;
    mockHasSeed = true;
  }),
  getEncryptedSeed: vi.fn(() => mockEncryptedSeed),
  clearSeed: vi.fn(() => {
    mockEncryptedSeed = undefined;
    mockHasSeed = false;
  }),
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
    text: "",
  })),
  formatAmount: vi.fn((amount: string) => {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** 6);
    const whole = value / divisor;
    return whole.toString();
  }),
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printWarning: vi.fn(),
  printHeader: vi.fn(),
  printTable: vi.fn(),
  isValidSeedPhrase: vi.fn((phrase: string) => {
    const words = phrase.trim().split(/\s+/);
    return words.length === 12 || words.length === 24;
  }),
  encryptSeed: vi.fn((seed: string, _key: string) => `encrypted:${seed}`),
  decryptSeed: vi.fn((encrypted: string, _key: string) => encrypted.replace("encrypted:", "")),
  getNetworkName: vi.fn((id: string) => {
    const names: Record<string, string> = {
      "eip155:8453": "Base",
      "eip155:42161": "Arbitrum",
    };
    return names[id] || id;
  }),
}));

// Mock viem/accounts
vi.mock("viem/accounts", () => ({
  generateMnemonic: vi.fn(
    () => "test word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11",
  ),
  english: [],
  mnemonicToAccount: vi.fn(() => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
  })),
}));

describe("Wallet Commands", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride();
    registerWalletCommands(program);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Reset state
    mockHasSeed = false;
    mockEncryptedSeed = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("wallet create", () => {
    it("registers wallet create command", () => {
      const walletCmd = program.commands.find((cmd) => cmd.name() === "wallet");
      const createCmd = walletCmd?.commands.find((cmd) => cmd.name() === "create");
      expect(createCmd).toBeDefined();
      expect(createCmd?.description()).toBe("Create a new wallet with a generated seed phrase");
    });

    it("creates a new wallet when none exists", async () => {
      const { printSuccess } = await import("../utils/index.js");
      const { storeSeed } = await import("../config/index.js");

      await program.parseAsync(["node", "test", "wallet", "create"]);

      expect(storeSeed).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Wallet created and saved to config");
    });

    it("warns if wallet already exists", async () => {
      mockHasSeed = true;
      const { printWarning } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "create"]);

      expect(printWarning).toHaveBeenCalledWith(
        "A wallet is already configured. Use 'wallet clear' first to remove it.",
      );
    });
  });

  describe("wallet import", () => {
    it("registers wallet import command", () => {
      const walletCmd = program.commands.find((cmd) => cmd.name() === "wallet");
      const importCmd = walletCmd?.commands.find((cmd) => cmd.name() === "import");
      expect(importCmd).toBeDefined();
      expect(importCmd?.description()).toBe("Import an existing wallet from a seed phrase (interactive prompt)");
    });

    it("imports a valid 12-word seed phrase", async () => {
      const { printSuccess } = await import("../utils/index.js");
      const { storeSeed } = await import("../config/index.js");
      mockReadlineAnswer = "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12";

      await program.parseAsync(["node", "test", "wallet", "import"]);

      expect(storeSeed).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Wallet imported successfully");
    });

    it("rejects invalid seed phrase", async () => {
      const { printError } = await import("../utils/index.js");
      mockReadlineAnswer = "too few words";

      await program.parseAsync(["node", "test", "wallet", "import"]);

      expect(printError).toHaveBeenCalledWith("Invalid seed phrase. Must be 12 or 24 words.");
    });

    it("warns if wallet already exists", async () => {
      mockHasSeed = true;
      const { printWarning } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "import"]);

      expect(printWarning).toHaveBeenCalledWith(
        "A wallet is already configured. Use 'wallet clear' first to remove it.",
      );
    });
  });

  describe("wallet show", () => {
    it("registers wallet show command", () => {
      const walletCmd = program.commands.find((cmd) => cmd.name() === "wallet");
      const showCmd = walletCmd?.commands.find((cmd) => cmd.name() === "show");
      expect(showCmd).toBeDefined();
      expect(showCmd?.description()).toBe("Show wallet addresses");
    });

    it("shows wallet addresses when configured", async () => {
      mockEncryptedSeed = "encrypted:test-seed";
      const { printHeader, printTable } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "show"]);

      expect(printHeader).toHaveBeenCalledWith("Wallet Addresses");
      expect(printTable).toHaveBeenCalled();
    });

    it("shows error when no wallet configured", async () => {
      mockEncryptedSeed = undefined;
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "show"]);

      expect(printError).toHaveBeenCalledWith(
        "No wallet configured. Run 'wallet create' or 'wallet import' first.",
      );
    });
  });

  describe("wallet clear", () => {
    it("registers wallet clear command", () => {
      const walletCmd = program.commands.find((cmd) => cmd.name() === "wallet");
      const clearCmd = walletCmd?.commands.find((cmd) => cmd.name() === "clear");
      expect(clearCmd).toBeDefined();
      expect(clearCmd?.description()).toBe("Remove wallet from this device");
    });

    it("requires --force to clear wallet", async () => {
      mockHasSeed = true;
      const { clearSeed } = await import("../config/index.js");

      await program.parseAsync(["node", "test", "wallet", "clear"]);

      expect(clearSeed).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("clears wallet with --force flag", async () => {
      mockHasSeed = true;
      const { clearSeed } = await import("../config/index.js");
      const { printSuccess } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "clear", "--force"]);

      expect(clearSeed).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Wallet removed from this device");
    });

    it("warns when no wallet to clear", async () => {
      mockHasSeed = false;
      const { printWarning } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "clear"]);

      expect(printWarning).toHaveBeenCalledWith("No wallet configured.");
    });
  });

  describe("wallet export", () => {
    it("registers wallet export command", () => {
      const walletCmd = program.commands.find((cmd) => cmd.name() === "wallet");
      const exportCmd = walletCmd?.commands.find((cmd) => cmd.name() === "export");
      expect(exportCmd).toBeDefined();
      expect(exportCmd?.description()).toBe("Export seed phrase (use with caution!)");
    });

    it("requires --force to export", async () => {
      mockEncryptedSeed = "encrypted:test-seed";
      const { decryptSeed } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "export"]);

      expect(decryptSeed).not.toHaveBeenCalled();
    });

    it("exports seed with --force flag", async () => {
      mockEncryptedSeed = "encrypted:test-seed";
      const { decryptSeed } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "export", "--force"]);

      expect(decryptSeed).toHaveBeenCalled();
    });

    it("shows error when no wallet configured", async () => {
      mockEncryptedSeed = undefined;
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "export"]);

      expect(printError).toHaveBeenCalledWith("No wallet configured.");
    });
  });

  describe("wallet balance", () => {
    it("registers wallet balance command", () => {
      const walletCmd = program.commands.find((cmd) => cmd.name() === "wallet");
      const balanceCmd = walletCmd?.commands.find((cmd) => cmd.name() === "balance");
      expect(balanceCmd).toBeDefined();
      expect(balanceCmd?.description()).toBe("Check wallet balances");
    });

    it("shows error when no wallet configured", async () => {
      mockEncryptedSeed = undefined;
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "wallet", "balance"]);

      expect(printError).toHaveBeenCalledWith(
        "No wallet configured. Run 'wallet create' or 'wallet import' first.",
      );
    });
  });
});
