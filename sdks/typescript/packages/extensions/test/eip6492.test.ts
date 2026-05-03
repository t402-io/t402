/**
 * verifyEIP6492Signature Tests
 *
 * Covers the three resolution paths:
 *   1. Counterfactual (6492 suffix) with a viem-like PublicClient that
 *      exposes `verifyHash` — delegation.
 *   2. Counterfactual with a provider that has `verifyMessage` but no
 *      `verifyHash` — loud error.
 *   3. Counterfactual with a raw EIP-1193 provider — loud error.
 *   4. Non-6492 signature — falls through to EIP-1271 path on any
 *      EIP-1193 provider.
 */

import { describe, it, expect, vi } from "vitest";
import { verifyEIP6492Signature } from "../src/sign-in-with-x";

const EIP6492_SUFFIX = "6492649264926492649264926492649264926492649264926492649264926492";

const SAMPLE_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const SAMPLE_HASH = "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

function make6492Signature(): string {
  // 65-byte EOA signature + EIP-6492 magic suffix
  return "0x" + "aa".repeat(65) + EIP6492_SUFFIX;
}

function makePlainSignature(): string {
  return "0x" + "bb".repeat(65);
}

describe("verifyEIP6492Signature — counterfactual (6492 suffix)", () => {
  it("delegates to viem PublicClient.verifyHash when available", async () => {
    const verifyHash = vi.fn().mockResolvedValue(true);
    const provider = { verifyHash };

    const result = await verifyEIP6492Signature(
      SAMPLE_ADDRESS,
      SAMPLE_HASH,
      make6492Signature(),
      provider,
    );

    expect(result).toBe(true);
    expect(verifyHash).toHaveBeenCalledTimes(1);
    expect(verifyHash).toHaveBeenCalledWith({
      address: SAMPLE_ADDRESS,
      hash: SAMPLE_HASH,
      signature: make6492Signature(),
    });
  });

  it("returns false when viem verifyHash throws", async () => {
    const verifyHash = vi.fn().mockRejectedValue(new Error("boom"));
    const provider = { verifyHash };

    const result = await verifyEIP6492Signature(
      SAMPLE_ADDRESS,
      SAMPLE_HASH,
      make6492Signature(),
      provider,
    );

    expect(result).toBe(false);
  });

  it("throws when provider has verifyMessage but not verifyHash", async () => {
    const provider = {
      verifyMessage: vi.fn(),
    };

    await expect(
      verifyEIP6492Signature(SAMPLE_ADDRESS, SAMPLE_HASH, make6492Signature(), provider),
    ).rejects.toThrow(/verifyMessage but not verifyHash/);
  });

  it("throws when provider has no verify methods at all", async () => {
    const provider = {
      request: vi.fn(), // raw EIP-1193
    };

    await expect(
      verifyEIP6492Signature(SAMPLE_ADDRESS, SAMPLE_HASH, make6492Signature(), provider),
    ).rejects.toThrow(/require a viem PublicClient/);
  });
});

describe("verifyEIP6492Signature — plain 1271 fallback", () => {
  it("calls eth_call when signature is not counterfactual", async () => {
    // Standard 1271 magic value response
    const request = vi
      .fn()
      .mockResolvedValue("0x1626ba7e00000000000000000000000000000000000000000000000000000000");
    const provider = { request };

    const result = await verifyEIP6492Signature(
      SAMPLE_ADDRESS,
      SAMPLE_HASH,
      makePlainSignature(),
      provider,
    );

    expect(result).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    const call = request.mock.calls[0]![0] as {
      method: string;
      params: unknown[];
    };
    expect(call.method).toBe("eth_call");
  });

  it("returns false when eth_call response does not match the 1271 magic value", async () => {
    const request = vi
      .fn()
      .mockResolvedValue("0xffffffff00000000000000000000000000000000000000000000000000000000");
    const provider = { request };

    const result = await verifyEIP6492Signature(
      SAMPLE_ADDRESS,
      SAMPLE_HASH,
      makePlainSignature(),
      provider,
    );

    expect(result).toBe(false);
  });

  it("returns false when provider is not an EIP-1193 provider", async () => {
    const result = await verifyEIP6492Signature(
      SAMPLE_ADDRESS,
      SAMPLE_HASH,
      makePlainSignature(),
      {},
    );

    expect(result).toBe(false);
  });
});
