import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerRequestCommand } from "./request.js";

// Mock state
let mockEncryptedSeed: string | undefined;

// Mock config module
vi.mock("../config/index.js", () => ({
  getEncryptedSeed: vi.fn(() => mockEncryptedSeed),
  getConfig: vi.fn((key: string) => {
    if (key === "testnet") return false;
    if (key === "defaultNetwork") return "eip155:8453";
    if (key === "facilitatorUrl") return "https://facilitator.t402.io";
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
    warn: vi.fn().mockReturnThis(),
    text: "",
  })),
  formatAddress: vi.fn((addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`),
  formatAmount: vi.fn((amount: string) => {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** 6);
    return (value / divisor).toString();
  }),
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printWarning: vi.fn(),
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

describe("Request Command", () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride();
    registerRequestCommand(program);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mockEncryptedSeed = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("command registration", () => {
    it("registers request command", () => {
      const requestCmd = program.commands.find((cmd) => cmd.name() === "request");
      expect(requestCmd).toBeDefined();
      expect(requestCmd?.description()).toBe(
        "Make an HTTP request with automatic 402 payment handling",
      );
    });

    it("has correct options", () => {
      const requestCmd = program.commands.find((cmd) => cmd.name() === "request");
      const options = requestCmd?.options.map((o) => o.long);
      expect(options).toContain("--method");
      expect(options).toContain("--header");
      expect(options).toContain("--data");
      expect(options).toContain("--gasless");
      expect(options).toContain("--network");
      expect(options).toContain("--output");
      expect(options).toContain("--verbose");
      expect(options).toContain("--dry-run");
    });

    it("has short flag aliases", () => {
      const requestCmd = program.commands.find((cmd) => cmd.name() === "request");
      const methodOption = requestCmd?.options.find((opt) => opt.long === "--method");
      const headerOption = requestCmd?.options.find((opt) => opt.long === "--header");
      const dataOption = requestCmd?.options.find((opt) => opt.long === "--data");

      expect(methodOption?.short).toBe("-X");
      expect(headerOption?.short).toBe("-H");
      expect(dataOption?.short).toBe("-d");
    });

    it("defaults method to GET", () => {
      const requestCmd = program.commands.find((cmd) => cmd.name() === "request");
      const methodOption = requestCmd?.options.find((opt) => opt.long === "--method");
      expect(methodOption?.defaultValue).toBe("GET");
    });
  });

  describe("URL validation", () => {
    it("rejects invalid URLs", async () => {
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "request", "not-a-url"]);

      expect(printError).toHaveBeenCalledWith("Invalid URL format");
    });
  });

  describe("wallet requirement", () => {
    it("shows error when no wallet and not dry-run", async () => {
      mockEncryptedSeed = undefined;
      const { printError } = await import("../utils/index.js");

      await program.parseAsync(["node", "test", "request", "https://example.com/api"]);

      expect(printError).toHaveBeenCalledWith(
        "No wallet configured. Run 'wallet create' or 'wallet import' first.",
      );
    });

    it("allows dry-run without wallet", async () => {
      mockEncryptedSeed = undefined;
      const { printError } = await import("../utils/index.js");

      // This will attempt a fetch which will fail, but the wallet check should pass
      try {
        await program.parseAsync([
          "node",
          "test",
          "request",
          "https://example.com/api",
          "--dry-run",
        ]);
      } catch {
        // fetch will fail in test env, that's OK
      }

      // Should NOT show the wallet error
      const walletErrorCalls = (printError as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: string[]) => call[0]?.includes("No wallet configured"),
      );
      expect(walletErrorCalls.length).toBe(0);
    });
  });

  describe("request with 200 response", () => {
    it("handles successful JSON response", async () => {
      mockEncryptedSeed = "encrypted:test-seed";

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({ data: "test" }),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      try {
        await program.parseAsync(["node", "test", "request", "https://example.com/api"]);

        expect(globalThis.fetch).toHaveBeenCalledWith(
          "https://example.com/api",
          expect.objectContaining({
            method: "GET",
          }),
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles successful text response", async () => {
      mockEncryptedSeed = "encrypted:test-seed";

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-type": "text/plain",
        }),
        text: vi.fn().mockResolvedValue("Hello World"),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      try {
        await program.parseAsync(["node", "test", "request", "https://example.com/api"]);

        const calls = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
        expect(calls).toContain("Hello World");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles binary response", async () => {
      mockEncryptedSeed = "encrypted:test-seed";

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({
          "content-type": "application/octet-stream",
          "content-length": "1024",
        }),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      try {
        await program.parseAsync(["node", "test", "request", "https://example.com/file"]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("request with 402 response (dry-run)", () => {
    it("shows payment requirements and stops on dry-run", async () => {
      mockEncryptedSeed = "encrypted:test-seed";
      const { printHeader, printTable, printWarning } = await import("../utils/index.js");

      const mockResponse = {
        ok: false,
        status: 402,
        statusText: "Payment Required",
        headers: new Headers({
          "content-type": "application/json",
        }),
        json: vi.fn().mockResolvedValue({
          accepts: [
            {
              network: "eip155:8453",
              asset: "usdt0",
              amount: "1000000",
              payTo: "0xabcdef1234567890abcdef1234567890abcdef12",
            },
          ],
          resource: { description: "Premium API access" },
        }),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      try {
        await program.parseAsync([
          "node",
          "test",
          "request",
          "https://example.com/api",
          "--dry-run",
        ]);

        expect(printHeader).toHaveBeenCalledWith("Payment Required");
        expect(printTable).toHaveBeenCalledWith(
          expect.objectContaining({
            Resource: "Premium API access",
            Network: "Base",
          }),
        );
        expect(printWarning).toHaveBeenCalledWith("Dry run - no payment executed");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles invalid 402 response format", async () => {
      mockEncryptedSeed = "encrypted:test-seed";
      const { printError } = await import("../utils/index.js");

      const mockResponse = {
        ok: false,
        status: 402,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ invalid: "format" }),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      try {
        await program.parseAsync([
          "node",
          "test",
          "request",
          "https://example.com/api",
          "--dry-run",
        ]);

        expect(printError).toHaveBeenCalledWith("Invalid 402 response format");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("custom headers and data", () => {
    it("sends custom headers", async () => {
      mockEncryptedSeed = "encrypted:test-seed";

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({}),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      try {
        await program.parseAsync([
          "node",
          "test",
          "request",
          "https://example.com/api",
          "-H",
          "Authorization:Bearer token123",
        ]);

        expect(globalThis.fetch).toHaveBeenCalledWith(
          "https://example.com/api",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer token123",
            }),
          }),
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("sends POST with data", async () => {
      mockEncryptedSeed = "encrypted:test-seed";

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({}),
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      try {
        await program.parseAsync([
          "node",
          "test",
          "request",
          "https://example.com/api",
          "-X",
          "POST",
          "-d",
          '{"key":"value"}',
        ]);

        expect(globalThis.fetch).toHaveBeenCalledWith(
          "https://example.com/api",
          expect.objectContaining({
            method: "POST",
            body: '{"key":"value"}',
          }),
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("error handling", () => {
    it("handles network errors", async () => {
      mockEncryptedSeed = "encrypted:test-seed";
      const { printError } = await import("../utils/index.js");

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      try {
        await program.parseAsync(["node", "test", "request", "https://example.com/api"]);

        expect(printError).toHaveBeenCalledWith("Request failed: Network error");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
