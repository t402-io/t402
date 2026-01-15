import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatAddress,
  formatAmount,
  parseAmount,
  getNetworkInfo,
  getNetworkName,
  getAvailableNetworks,
  isValidSeedPhrase,
  isValidUrl,
  encryptSeed,
  decryptSeed,
  formatBalanceResult,
  formatPaymentResult,
  createSpinner,
  printTable,
  printSuccess,
  printError,
  printWarning,
  printInfo,
  printHeader,
} from "./index.js";

describe("formatAddress", () => {
  it("truncates long addresses", () => {
    const address = "0x1234567890abcdef1234567890abcdef12345678";
    expect(formatAddress(address)).toBe("0x1234...5678");
  });

  it("returns short addresses unchanged", () => {
    expect(formatAddress("0x1234")).toBe("0x1234");
  });

  it("supports custom truncation lengths", () => {
    const address = "0x1234567890abcdef1234567890abcdef12345678";
    expect(formatAddress(address, 8, 6)).toBe("0x123456...345678");
  });
});

describe("formatAmount", () => {
  it("formats whole numbers", () => {
    expect(formatAmount("1000000")).toBe("1");
    expect(formatAmount("5000000")).toBe("5");
  });

  it("formats decimal amounts", () => {
    expect(formatAmount("1500000")).toBe("1.5");
    expect(formatAmount("1234567")).toBe("1.234567");
  });

  it("removes trailing zeros", () => {
    expect(formatAmount("1100000")).toBe("1.1");
    expect(formatAmount("1010000")).toBe("1.01");
  });

  it("handles zero", () => {
    expect(formatAmount("0")).toBe("0");
  });

  it("handles large amounts", () => {
    expect(formatAmount("1000000000000")).toBe("1000000");
  });
});

describe("parseAmount", () => {
  it("parses whole numbers", () => {
    expect(parseAmount("1")).toBe("1000000");
    expect(parseAmount("10")).toBe("10000000");
  });

  it("parses decimal amounts", () => {
    expect(parseAmount("1.5")).toBe("1500000");
    expect(parseAmount("1.234567")).toBe("1234567");
  });

  it("handles more decimals than supported", () => {
    expect(parseAmount("1.1234567890")).toBe("1123456");
  });

  it("handles fewer decimals", () => {
    expect(parseAmount("1.1")).toBe("1100000");
  });
});

describe("getNetworkInfo", () => {
  it("returns info for known networks", () => {
    const base = getNetworkInfo("eip155:8453");
    expect(base).toBeDefined();
    expect(base?.name).toBe("Base");
    expect(base?.type).toBe("evm");
    expect(base?.testnet).toBe(false);
  });

  it("returns undefined for unknown networks", () => {
    expect(getNetworkInfo("unknown:999")).toBeUndefined();
  });
});

describe("getNetworkName", () => {
  it("returns display name for known networks", () => {
    expect(getNetworkName("eip155:8453")).toBe("Base");
    expect(getNetworkName("eip155:42161")).toBe("Arbitrum");
    expect(getNetworkName("ton:-239")).toBe("TON");
  });

  it("returns ID for unknown networks", () => {
    expect(getNetworkName("unknown:999")).toBe("unknown:999");
  });
});

describe("getAvailableNetworks", () => {
  it("returns mainnet networks when testnet is false", () => {
    const networks = getAvailableNetworks(false);
    expect(networks.every((n) => !n.testnet)).toBe(true);
    expect(networks.some((n) => n.name === "Base")).toBe(true);
  });

  it("returns testnet networks when testnet is true", () => {
    const networks = getAvailableNetworks(true);
    expect(networks.every((n) => n.testnet)).toBe(true);
    expect(networks.some((n) => n.name === "Base Sepolia")).toBe(true);
  });
});

describe("isValidSeedPhrase", () => {
  it("accepts 12 word phrases", () => {
    const phrase = "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12";
    expect(isValidSeedPhrase(phrase)).toBe(true);
  });

  it("accepts 24 word phrases", () => {
    const phrase = Array(24).fill("word").join(" ");
    expect(isValidSeedPhrase(phrase)).toBe(true);
  });

  it("rejects invalid word counts", () => {
    expect(isValidSeedPhrase("word1 word2 word3")).toBe(false);
    expect(isValidSeedPhrase(Array(15).fill("word").join(" "))).toBe(false);
  });

  it("handles extra whitespace", () => {
    const phrase = "  word1  word2  word3  word4  word5  word6  word7  word8  word9  word10  word11  word12  ";
    expect(isValidSeedPhrase(phrase)).toBe(true);
  });
});

describe("isValidUrl", () => {
  it("accepts valid URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
    expect(isValidUrl("https://api.t402.io/verify")).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("example.com")).toBe(false);
  });
});

describe("encryptSeed/decryptSeed", () => {
  const testSeed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const testKey = "test-encryption-key";

  it("encrypts and decrypts seed correctly", () => {
    const encrypted = encryptSeed(testSeed, testKey);
    expect(encrypted).not.toBe(testSeed);

    const decrypted = decryptSeed(encrypted, testKey);
    expect(decrypted).toBe(testSeed);
  });

  it("produces different output with different keys", () => {
    const encrypted1 = encryptSeed(testSeed, "key1");
    const encrypted2 = encryptSeed(testSeed, "key2");
    expect(encrypted1).not.toBe(encrypted2);
  });
});

describe("formatBalanceResult", () => {
  it("formats balance with known network", () => {
    const result = formatBalanceResult({
      network: "eip155:8453",
      asset: "usdt",
      balance: "1000000",
      formatted: "1.00",
    });
    expect(result).toContain("Base");
    expect(result).toContain("1.00");
    expect(result).toContain("USDT");
  });

  it("formats balance with unknown network", () => {
    const result = formatBalanceResult({
      network: "unknown:999",
      asset: "usdc",
      balance: "5000000",
      formatted: "5.00",
    });
    expect(result).toContain("unknown:999");
    expect(result).toContain("5.00");
    expect(result).toContain("USDC");
  });
});

describe("formatPaymentResult", () => {
  it("formats successful payment with all details", () => {
    const result = formatPaymentResult({
      success: true,
      txHash: "0x1234567890abcdef",
      network: "eip155:8453",
      amount: "10.00 USDT",
    });
    expect(result).toContain("Payment successful");
    expect(result).toContain("0x1234567890abcdef");
    expect(result).toContain("Base");
    expect(result).toContain("10.00 USDT");
  });

  it("formats successful payment without optional fields", () => {
    const result = formatPaymentResult({
      success: true,
    });
    expect(result).toContain("Payment successful");
  });

  it("formats failed payment with error", () => {
    const result = formatPaymentResult({
      success: false,
      error: "Insufficient balance",
    });
    expect(result).toContain("Payment failed");
    expect(result).toContain("Insufficient balance");
  });

  it("formats failed payment without error message", () => {
    const result = formatPaymentResult({
      success: false,
    });
    expect(result).toContain("Payment failed");
    expect(result).toContain("Unknown error");
  });

  it("formats successful payment with unknown network", () => {
    const result = formatPaymentResult({
      success: true,
      network: "unknown:999",
    });
    expect(result).toContain("unknown:999");
  });
});

describe("createSpinner", () => {
  it("creates a spinner with text", () => {
    const spinner = createSpinner("Loading...");
    expect(spinner).toBeDefined();
    expect(spinner.text).toBe("Loading...");
  });
});

describe("Console output functions", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("printTable", () => {
    it("prints key-value pairs", () => {
      printTable({ Name: "Test", Value: "123" });
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it("handles empty object", () => {
      printTable({});
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("pads keys for alignment", () => {
      printTable({ Short: "a", LongerKey: "b" });
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("printSuccess", () => {
    it("prints success message with checkmark", () => {
      printSuccess("Operation completed");
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("Operation completed");
    });
  });

  describe("printError", () => {
    it("prints error message to stderr", () => {
      printError("Something went wrong");
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain("Something went wrong");
    });
  });

  describe("printWarning", () => {
    it("prints warning message", () => {
      printWarning("Be careful");
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("Be careful");
    });
  });

  describe("printInfo", () => {
    it("prints info message", () => {
      printInfo("FYI");
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("FYI");
    });
  });

  describe("printHeader", () => {
    it("prints header with title", () => {
      printHeader("My Header");
      expect(consoleLogSpy).toHaveBeenCalled();
      // Should print empty line, title, empty line
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    });
  });
});
