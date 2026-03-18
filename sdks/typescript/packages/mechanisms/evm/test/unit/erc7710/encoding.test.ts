import { describe, it, expect } from "vitest";
import { encodeERC7579Execution } from "../../../src/erc7710/facilitator/scheme";

describe("encodeERC7579Execution", () => {
  it("should encode ERC-20 transfer in ERC-7579 single execution format", () => {
    const result = encodeERC7579Execution(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      "0x209693Bc6afc0C5328bA36FaF03C514EF312287C", // recipient
      10000n,
    );

    // Should be a hex string
    expect(result).toMatch(/^0x[0-9a-f]+$/);

    const hex = result.slice(2);

    // 20 bytes target + 32 bytes value + 4 selector + 32 addr + 32 amount = 120 bytes = 240 hex chars
    expect(hex.length).toBe(240);

    // First 40 hex chars (20 bytes) = token address
    expect(hex.slice(0, 40)).toBe("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");

    // Next 64 hex chars (32 bytes) = value (zero, no ETH)
    expect(hex.slice(40, 104)).toBe("0".repeat(64));

    // Calldata starts at char 104
    // transfer selector
    expect(hex.slice(104, 112)).toBe("a9059cbb");

    // Recipient padded to 32 bytes
    expect(hex.slice(112, 176)).toBe(
      "000000000000000000000000209693bc6afc0c5328ba36faf03c514ef312287c"
    );

    // Amount (10000 = 0x2710) padded to 32 bytes
    expect(hex.slice(176, 240)).toBe(
      "0000000000000000000000000000000000000000000000000000000000002710"
    );
  });

  it("should handle large amounts", () => {
    const result = encodeERC7579Execution(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      1000000000000n, // 1M USDC (6 decimals)
    );

    const hex = result.slice(2);
    // Amount = 1000000000000 = 0xe8d4a51000
    const amountHex = hex.slice(176, 240);
    expect(BigInt("0x" + amountHex)).toBe(1000000000000n);
  });

  it("should handle zero amount", () => {
    const result = encodeERC7579Execution(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      0n,
    );

    const hex = result.slice(2);
    const amountHex = hex.slice(176, 240);
    expect(amountHex).toBe("0".repeat(64));
  });
});
