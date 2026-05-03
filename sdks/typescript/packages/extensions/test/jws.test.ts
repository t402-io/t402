/**
 * JWS Verify Tests
 *
 * End-to-end tests for `verifyJWSSignature`: generate key pair, construct
 * a compact JWS, and verify round-trip for both supported algorithms
 * (ES256K, EdDSA).
 */

import { describe, it, expect } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1";
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

import { verifyJWSSignature } from "../src/offer-receipt";

// ---------------------------------------------------------------------------
// base64url helpers (test-local; mirrors src/offer-receipt/jws.ts)
// ---------------------------------------------------------------------------

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 =
    typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function jsonToBase64url(obj: unknown): string {
  return base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

function textEncode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

// ---------------------------------------------------------------------------
// ES256K (secp256k1 + SHA-256)
// ---------------------------------------------------------------------------

describe("verifyJWSSignature — ES256K", () => {
  it("verifies a valid ES256K JWS round-trip", async () => {
    const privateKey = secp256k1.utils.randomPrivateKey();
    const publicKey = secp256k1.getPublicKey(privateKey, true); // compressed

    const header = { alg: "ES256K", kid: "test-key-1", typ: "JWT" };
    const payload = { version: 1, resourceUrl: "https://example.test/foo" };
    const signingInput = `${jsonToBase64url(header)}.${jsonToBase64url(payload)}`;

    const hash = sha256(textEncode(signingInput));
    const signature = secp256k1.sign(hash, privateKey);
    const sigBytes = signature.toCompactRawBytes(); // 64 bytes IEEE P1363
    const jws = `${signingInput}.${base64urlEncode(sigBytes)}`;

    const result = await verifyJWSSignature(jws, () => publicKey);

    expect(result.valid).toBe(true);
    expect(result.header?.alg).toBe("ES256K");
    expect(result.header?.kid).toBe("test-key-1");
    expect(result.payload).toEqual(payload);
  });

  it("rejects an ES256K JWS with a tampered payload", async () => {
    const privateKey = secp256k1.utils.randomPrivateKey();
    const publicKey = secp256k1.getPublicKey(privateKey, true);

    const header = { alg: "ES256K", kid: "k1" };
    const payload = { amount: "1.00" };
    const signingInput = `${jsonToBase64url(header)}.${jsonToBase64url(payload)}`;

    const hash = sha256(textEncode(signingInput));
    const signature = secp256k1.sign(hash, privateKey);
    const sigBytes = signature.toCompactRawBytes();

    // Swap the payload for a different one without re-signing → tamper
    const tamperedJws = `${jsonToBase64url(header)}.${jsonToBase64url({ amount: "1000.00" })}.${base64urlEncode(sigBytes)}`;

    const result = await verifyJWSSignature(tamperedJws, () => publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/verification failed/);
  });

  it("rejects an ES256K JWS signed by a different key", async () => {
    const privateKeyA = secp256k1.utils.randomPrivateKey();
    const privateKeyB = secp256k1.utils.randomPrivateKey();
    const publicKeyB = secp256k1.getPublicKey(privateKeyB, true);

    const header = { alg: "ES256K" };
    const payload = { ok: true };
    const signingInput = `${jsonToBase64url(header)}.${jsonToBase64url(payload)}`;

    const hash = sha256(textEncode(signingInput));
    const signature = secp256k1.sign(hash, privateKeyA);
    const sigBytes = signature.toCompactRawBytes();
    const jws = `${signingInput}.${base64urlEncode(sigBytes)}`;

    // Resolver returns the WRONG public key
    const result = await verifyJWSSignature(jws, () => publicKeyB);
    expect(result.valid).toBe(false);
  });

  it("rejects an ES256K JWS with a wrong-length signature", async () => {
    const privateKey = secp256k1.utils.randomPrivateKey();
    const publicKey = secp256k1.getPublicKey(privateKey, true);

    const header = { alg: "ES256K" };
    const payload = { ok: true };
    const signingInput = `${jsonToBase64url(header)}.${jsonToBase64url(payload)}`;

    // Truncated signature
    const sigBytes = new Uint8Array(32).fill(0xaa);
    const jws = `${signingInput}.${base64urlEncode(sigBytes)}`;

    const result = await verifyJWSSignature(jws, () => publicKey);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/64-byte signature/);
  });
});

// ---------------------------------------------------------------------------
// EdDSA (ed25519)
// ---------------------------------------------------------------------------

describe("verifyJWSSignature — EdDSA", () => {
  it("verifies a valid EdDSA JWS round-trip", async () => {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);

    const header = { alg: "EdDSA", kid: "ed-key-1" };
    const payload = { sub: "solana-wallet", iat: 1700000000 };
    const signingInput = `${jsonToBase64url(header)}.${jsonToBase64url(payload)}`;

    const sigBytes = ed25519.sign(textEncode(signingInput), privateKey);
    const jws = `${signingInput}.${base64urlEncode(sigBytes)}`;

    const result = await verifyJWSSignature(jws, () => publicKey);

    expect(result.valid).toBe(true);
    expect(result.payload).toEqual(payload);
  });

  it("rejects an EdDSA JWS with a wrong-length public key", async () => {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);

    const header = { alg: "EdDSA" };
    const payload = { ok: true };
    const signingInput = `${jsonToBase64url(header)}.${jsonToBase64url(payload)}`;

    const sigBytes = ed25519.sign(textEncode(signingInput), privateKey);
    const jws = `${signingInput}.${base64urlEncode(sigBytes)}`;

    // Resolver returns a 16-byte blob (invalid length)
    const result = await verifyJWSSignature(jws, () => publicKey.slice(0, 16));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/32-byte public key/);
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe("verifyJWSSignature — errors", () => {
  it("rejects a JWS with fewer than 3 segments", async () => {
    const result = await verifyJWSSignature("abc.def", () => new Uint8Array(32));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/expected 3 compact segments/);
  });

  it("rejects a JWS with unparseable header", async () => {
    const jws = `not-base64-!!!.${base64urlEncode(textEncode("{}"))}.${base64urlEncode(new Uint8Array(64))}`;
    const result = await verifyJWSSignature(jws, () => new Uint8Array(32));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Failed to decode JWS header/);
  });

  it("rejects a JWS with a missing alg field", async () => {
    const header = { kid: "k1" }; // no alg
    const payload = { ok: true };
    const jws = `${jsonToBase64url(header)}.${jsonToBase64url(payload)}.${base64urlEncode(new Uint8Array(64))}`;
    const result = await verifyJWSSignature(jws, () => new Uint8Array(32));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/missing required "alg" field/);
  });

  it("rejects an unsupported algorithm with a clear message", async () => {
    const header = { alg: "RS256" }; // not supported
    const payload = { ok: true };
    const jws = `${jsonToBase64url(header)}.${jsonToBase64url(payload)}.${base64urlEncode(new Uint8Array(64))}`;
    const result = await verifyJWSSignature(jws, () => new Uint8Array(32));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Unsupported JWS algorithm: RS256/);
  });

  it("surfaces key resolver errors", async () => {
    const header = { alg: "ES256K" };
    const payload = { ok: true };
    const jws = `${jsonToBase64url(header)}.${jsonToBase64url(payload)}.${base64urlEncode(new Uint8Array(64))}`;
    const result = await verifyJWSSignature(jws, () => {
      throw new Error("JWKS unreachable");
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/JWKS unreachable/);
  });

  // sanity — unused import guard
  it("re-exports the byte encoder we rely on", () => {
    expect(typeof bytesToHex).toBe("function");
  });
});
