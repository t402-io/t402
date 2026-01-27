import { describe, it, expect } from "vitest";
import { createMockSettleResponse } from "../../app/lib/mock-responses";
import type { ChainFamily } from "../../app/lib/testnet-config";

describe("createMockSettleResponse", () => {
  const chainFamilies: ChainFamily[] = [
    "evm",
    "ton",
    "tron",
    "solana",
    "stacks",
    "near",
    "aptos",
    "tezos",
    "polkadot",
  ];

  it("returns success: true for all chains", () => {
    for (const chain of chainFamilies) {
      const response = createMockSettleResponse(chain);
      expect(response.success).toBe(true);
    }
  });

  it("generates correct txHash format for EVM", () => {
    const response = createMockSettleResponse("evm");
    expect(response.transaction).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("generates correct txHash format for Solana (base58, 88 chars)", () => {
    const response = createMockSettleResponse("solana");
    expect(response.transaction).toHaveLength(88);
    // Base58 alphabet check
    expect(response.transaction).toMatch(/^[A-HJ-NP-Za-km-z1-9]+$/);
  });

  it("generates correct txHash format for TON (base64, 44 chars)", () => {
    const response = createMockSettleResponse("ton");
    expect(response.transaction).toHaveLength(44);
  });

  it("generates correct txHash format for Tezos (starts with 'o')", () => {
    const response = createMockSettleResponse("tezos");
    expect(response.transaction).toMatch(/^o[A-HJ-NP-Za-km-z1-9]+$/);
  });

  it("generates correct txHash format for Aptos (0x prefix, 64 hex)", () => {
    const response = createMockSettleResponse("aptos");
    expect(response.transaction).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("generates correct txHash format for Polkadot (0x prefix, 64 hex)", () => {
    const response = createMockSettleResponse("polkadot");
    expect(response.transaction).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("includes correct network identifier", () => {
    const response = createMockSettleResponse("evm");
    expect(response.network).toBe("eip155:84532");
  });

  it("includes payer address", () => {
    for (const chain of chainFamilies) {
      const response = createMockSettleResponse(chain);
      expect(response.payer).toBeTruthy();
    }
  });

  it("generates different txHash each time", () => {
    const responses = Array.from({ length: 10 }, () => createMockSettleResponse("evm"));
    const txHashes = new Set(responses.map((r) => r.transaction));
    expect(txHashes.size).toBe(10);
  });
});
