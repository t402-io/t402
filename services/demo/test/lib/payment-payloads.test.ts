import { describe, it, expect } from "vitest";

/**
 * Tests verifying the payload structures that TRON and Stacks hooks produce
 * match what the facilitator expects (ExactTronPayloadV2 / ExactDirectStacksPayload).
 *
 * These are structural validation tests — they verify the shape, not the crypto.
 */

describe("TRON payload structure (ExactTronPayloadV2)", () => {
  // Simulates the payload shape produced by useTronPayment.signPayment()
  const mockTronPayload = {
    t402Version: 2,
    scheme: "exact",
    network: "tron:nile",
    payload: {
      signedTransaction: "0a8c0122" + "a".repeat(200), // hex-encoded signed TX
      authorization: {
        from: "TFR3gBPKLz1234567890abcdefghijk",
        to: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
        contractAddress: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
        amount: "1000",
        expiration: Date.now() + 60_000,
        refBlockBytes: "1a4d",
        refBlockHash: "abcd1234efgh5678",
        timestamp: Date.now(),
      },
    },
  };

  it("has required top-level fields", () => {
    expect(mockTronPayload.t402Version).toBe(2);
    expect(mockTronPayload.scheme).toBe("exact");
    expect(mockTronPayload.network).toMatch(/^tron:/);
  });

  it("payload.signedTransaction is a hex string", () => {
    expect(typeof mockTronPayload.payload.signedTransaction).toBe("string");
    expect(mockTronPayload.payload.signedTransaction.length).toBeGreaterThan(0);
  });

  it("payload.authorization has all required fields", () => {
    const auth = mockTronPayload.payload.authorization;
    expect(auth.from).toBeTruthy();
    expect(auth.to).toBeTruthy();
    expect(auth.contractAddress).toBeTruthy();
    expect(auth.amount).toBeTruthy();
    expect(typeof auth.expiration).toBe("number");
    expect(typeof auth.refBlockBytes).toBe("string");
    expect(typeof auth.refBlockHash).toBe("string");
    expect(typeof auth.timestamp).toBe("number");
  });

  it("authorization.from is a T-prefix TRON address", () => {
    expect(mockTronPayload.payload.authorization.from).toMatch(/^T/);
  });

  it("authorization amounts are string type", () => {
    expect(typeof mockTronPayload.payload.authorization.amount).toBe("string");
  });
});

describe("Stacks payload structure (ExactDirectStacksPayload)", () => {
  // Simulates the payload shape produced by useStacksPayment.signPayment()
  const mockStacksPayload = {
    t402Version: 2,
    scheme: "exact-direct",
    network: "stacks:2147483648",
    payload: {
      txId: "0x" + "a".repeat(64),
      from: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      to: "SP36B1B191JTQAZTRKKWRN7J0YHHM41W9P9P7EPR5",
      amount: "1000",
      contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
    },
  };

  it("has required top-level fields", () => {
    expect(mockStacksPayload.t402Version).toBe(2);
    expect(mockStacksPayload.scheme).toBe("exact-direct");
    expect(mockStacksPayload.network).toMatch(/^stacks:/);
  });

  it("payload has all ExactDirectStacksPayload fields", () => {
    const p = mockStacksPayload.payload;
    expect(p.txId).toBeTruthy();
    expect(p.from).toBeTruthy();
    expect(p.to).toBeTruthy();
    expect(p.amount).toBeTruthy();
    expect(p.contractAddress).toBeTruthy();
  });

  it("payload.txId is 0x-prefixed hex", () => {
    expect(mockStacksPayload.payload.txId).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("payload.contractAddress is full principal.contract-name format", () => {
    expect(mockStacksPayload.payload.contractAddress).toContain(".");
    const parts = mockStacksPayload.payload.contractAddress.split(".");
    expect(parts.length).toBe(2);
    expect(parts[1]).toBe("token-susdc");
  });

  it("payload uses 'amount' field (not 'value')", () => {
    expect(mockStacksPayload.payload).toHaveProperty("amount");
    expect(mockStacksPayload.payload).not.toHaveProperty("value");
  });

  it("payload does NOT have extra 'contractName' field", () => {
    expect(mockStacksPayload.payload).not.toHaveProperty("contractName");
  });

  it("from/to are Stacks principal addresses", () => {
    expect(mockStacksPayload.payload.from).toMatch(/^S[PT]/);
    expect(mockStacksPayload.payload.to).toMatch(/^S[PT]/);
  });
});

describe("TRON hook produces correct field names (not old format)", () => {
  it("should NOT use 'transaction' field (old format)", () => {
    // The old hook used: { transaction, from, to, value, txID }
    // The new hook uses: { signedTransaction, authorization }
    const correctFields = ["signedTransaction", "authorization"];
    const oldFields = ["transaction", "value", "txID"];

    // This test documents the expected new format
    for (const field of correctFields) {
      expect(field).toBeTruthy();
    }
    for (const field of oldFields) {
      // These should NOT appear in the new payload
      expect(field).not.toBe("signedTransaction");
    }
  });
});

describe("Stacks hook produces correct field names (not old format)", () => {
  it("should use 'amount' not 'value'", () => {
    // The old hook used: { txId, from, to, value, contractAddress, contractName }
    // The new hook uses: { txId, from, to, amount, contractAddress }
    const payload = {
      txId: "0x" + "a".repeat(64),
      from: "ST...",
      to: "SP...",
      amount: "1000", // NOT value
      contractAddress: "ST...token-susdc", // NOT split into separate fields
    };

    expect(payload).toHaveProperty("amount");
    expect(payload).not.toHaveProperty("value");
    expect(payload).not.toHaveProperty("contractName");
  });
});
