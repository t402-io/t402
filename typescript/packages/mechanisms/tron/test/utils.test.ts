import { describe, expect, it } from "vitest";
import {
  normalizeNetwork,
  getEndpoint,
  isTronNetwork,
  validateTronAddress,
  addressesEqual,
  formatAddress,
  convertToSmallestUnits,
  convertFromSmallestUnits,
  isValidHex,
  estimateTransactionFee,
} from "../src/utils.js";
import {
  TRON_MAINNET_CAIP2,
  TRON_NILE_CAIP2,
  TRON_SHASTA_CAIP2,
  USDT_ADDRESSES,
} from "../src/constants.js";

describe("normalizeNetwork", () => {
  it("should return mainnet CAIP-2 identifier", () => {
    expect(normalizeNetwork(TRON_MAINNET_CAIP2)).toBe(TRON_MAINNET_CAIP2);
  });

  it("should return nile CAIP-2 identifier", () => {
    expect(normalizeNetwork(TRON_NILE_CAIP2)).toBe(TRON_NILE_CAIP2);
  });

  it("should return shasta CAIP-2 identifier", () => {
    expect(normalizeNetwork(TRON_SHASTA_CAIP2)).toBe(TRON_SHASTA_CAIP2);
  });

  it("should normalize shorthand 'mainnet'", () => {
    expect(normalizeNetwork("mainnet")).toBe(TRON_MAINNET_CAIP2);
  });

  it("should normalize shorthand 'tron'", () => {
    expect(normalizeNetwork("tron")).toBe(TRON_MAINNET_CAIP2);
  });

  it("should normalize shorthand 'nile'", () => {
    expect(normalizeNetwork("nile")).toBe(TRON_NILE_CAIP2);
  });

  it("should normalize shorthand 'shasta'", () => {
    expect(normalizeNetwork("shasta")).toBe(TRON_SHASTA_CAIP2);
  });

  it("should throw for unsupported network", () => {
    expect(() => normalizeNetwork("tron:unsupported")).toThrow();
  });

  it("should throw for empty network", () => {
    expect(() => normalizeNetwork("")).toThrow();
  });
});

describe("getEndpoint", () => {
  it("should return mainnet endpoint", () => {
    expect(getEndpoint(TRON_MAINNET_CAIP2)).toBe("https://api.trongrid.io");
  });

  it("should return nile endpoint", () => {
    expect(getEndpoint(TRON_NILE_CAIP2)).toBe("https://api.nileex.io");
  });

  it("should return shasta endpoint", () => {
    expect(getEndpoint(TRON_SHASTA_CAIP2)).toBe("https://api.shasta.trongrid.io");
  });

  it("should throw for unsupported network", () => {
    expect(() => getEndpoint("tron:unsupported")).toThrow();
  });
});

describe("isTronNetwork", () => {
  it("should return true for mainnet", () => {
    expect(isTronNetwork(TRON_MAINNET_CAIP2)).toBe(true);
  });

  it("should return true for nile", () => {
    expect(isTronNetwork(TRON_NILE_CAIP2)).toBe(true);
  });

  it("should return true for shasta", () => {
    expect(isTronNetwork(TRON_SHASTA_CAIP2)).toBe(true);
  });

  it("should return false for non-TRON network", () => {
    expect(isTronNetwork("eip155:1")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isTronNetwork("")).toBe(false);
  });
});

describe("validateTronAddress", () => {
  it("should validate mainnet USDT address", () => {
    expect(validateTronAddress(USDT_ADDRESSES[TRON_MAINNET_CAIP2])).toBe(true);
  });

  it("should validate nile USDT address", () => {
    expect(validateTronAddress(USDT_ADDRESSES[TRON_NILE_CAIP2])).toBe(true);
  });

  it("should validate shasta USDT address", () => {
    expect(validateTronAddress(USDT_ADDRESSES[TRON_SHASTA_CAIP2])).toBe(true);
  });

  it("should validate another valid address", () => {
    expect(validateTronAddress("TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY")).toBe(true);
  });

  it("should reject too short address", () => {
    expect(validateTronAddress("TR7NHqjeKQxGTCi")).toBe(false);
  });

  it("should reject too long address", () => {
    expect(validateTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6tXXXXX")).toBe(false);
  });

  it("should reject empty address", () => {
    expect(validateTronAddress("")).toBe(false);
  });

  it("should reject wrong prefix", () => {
    expect(validateTronAddress("0R7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
  });

  it("should reject invalid base58 char (0)", () => {
    expect(validateTronAddress("T07NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
  });

  it("should reject invalid base58 char (O)", () => {
    expect(validateTronAddress("TOONHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
  });

  it("should reject invalid base58 char (I)", () => {
    expect(validateTronAddress("TI7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
  });

  it("should reject invalid base58 char (l)", () => {
    expect(validateTronAddress("Tl7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
  });
});

describe("addressesEqual", () => {
  it("should return true for same address", () => {
    const addr = USDT_ADDRESSES[TRON_MAINNET_CAIP2];
    expect(addressesEqual(addr, addr)).toBe(true);
  });

  it("should return false for different addresses", () => {
    expect(
      addressesEqual(USDT_ADDRESSES[TRON_MAINNET_CAIP2], USDT_ADDRESSES[TRON_NILE_CAIP2]),
    ).toBe(false);
  });

  it("should return false for empty first address", () => {
    expect(addressesEqual("", USDT_ADDRESSES[TRON_MAINNET_CAIP2])).toBe(false);
  });

  it("should return false for empty second address", () => {
    expect(addressesEqual(USDT_ADDRESSES[TRON_MAINNET_CAIP2], "")).toBe(false);
  });

  it("should return false for both empty", () => {
    expect(addressesEqual("", "")).toBe(false);
  });
});

describe("formatAddress", () => {
  it("should return full address without truncation", () => {
    const addr = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    expect(formatAddress(addr)).toBe(addr);
  });

  it("should truncate address", () => {
    const addr = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    expect(formatAddress(addr, { truncate: 6 })).toBe("TR7NHq...gjLj6t");
  });

  it("should return empty string for empty address", () => {
    expect(formatAddress("")).toBe("");
  });

  it("should not truncate if address is short enough", () => {
    const addr = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    expect(formatAddress(addr, { truncate: 20 })).toBe(addr);
  });
});

describe("convertToSmallestUnits", () => {
  it("should convert integer amount", () => {
    expect(convertToSmallestUnits("100")).toBe("100000000");
  });

  it("should convert decimal amount", () => {
    expect(convertToSmallestUnits("1.5")).toBe("1500000");
  });

  it("should convert small decimal", () => {
    expect(convertToSmallestUnits("0.000001")).toBe("1");
  });

  it("should convert zero", () => {
    expect(convertToSmallestUnits("0")).toBe("0");
  });

  it("should truncate extra decimal places", () => {
    expect(convertToSmallestUnits("1.1234567")).toBe("1123456");
  });

  it("should handle large amounts", () => {
    expect(convertToSmallestUnits("1000000")).toBe("1000000000000");
  });
});

describe("convertFromSmallestUnits", () => {
  it("should convert to integer result", () => {
    expect(convertFromSmallestUnits("1000000")).toBe("1");
  });

  it("should convert to decimal result", () => {
    expect(convertFromSmallestUnits("1500000")).toBe("1.5");
  });

  it("should convert small amount", () => {
    expect(convertFromSmallestUnits("1")).toBe("0.000001");
  });

  it("should convert zero", () => {
    expect(convertFromSmallestUnits("0")).toBe("0");
  });

  it("should remove trailing zeros", () => {
    expect(convertFromSmallestUnits("1100000")).toBe("1.1");
  });

  it("should handle large amounts", () => {
    expect(convertFromSmallestUnits("1000000000000")).toBe("1000000");
  });
});

describe("isValidHex", () => {
  it("should validate hex string", () => {
    expect(isValidHex("a9059cbb")).toBe(true);
  });

  it("should validate hex with 0x prefix", () => {
    expect(isValidHex("0xa9059cbb")).toBe(true);
  });

  it("should validate uppercase hex", () => {
    expect(isValidHex("A9059CBB")).toBe(true);
  });

  it("should reject empty string", () => {
    expect(isValidHex("")).toBe(false);
  });

  it("should reject invalid characters", () => {
    expect(isValidHex("xyz123")).toBe(false);
  });
});

describe("estimateTransactionFee", () => {
  it("should return base fee for activated account", () => {
    expect(estimateTransactionFee(true)).toBe(30_000_000);
  });

  it("should return higher fee for non-activated account", () => {
    expect(estimateTransactionFee(false)).toBe(31_000_000);
  });

  it("should default to activated account", () => {
    expect(estimateTransactionFee()).toBe(30_000_000);
  });
});
