/**
 * JWS (RFC 7515) verification helpers for offer-receipt payloads.
 *
 * The t402 offer-receipt extension primarily uses EIP-712 signatures for
 * EVM compatibility. JWS is supported as an alternative format for cases
 * where cross-platform signing is preferred (e.g. non-EVM issuers, mobile
 * SDKs using standard JWT libraries).
 *
 * This module implements the **verify** side of JWS compact form. Signing
 * is delegated to the caller's preferred library — t402 does not ship a
 * JWS signing primitive because key management is inherently deployment-
 * specific.
 *
 * Supported algorithms:
 *   - `ES256K` — secp256k1 with SHA-256 (EVM wallets, Bitcoin-style keys)
 *   - `EdDSA`  — ed25519 (Solana, Stellar, TON wallets)
 *
 * Key resolution is the caller's responsibility via `resolveKey`: given the
 * protected header, return the public key bytes. This keeps the verifier
 * decoupled from any key-store (JWKS endpoint, DID, hard-coded registry).
 */

import { secp256k1 } from "@noble/curves/secp256k1";
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha2";

/**
 * Supported JWS signature algorithms.
 */
export type JWSAlgorithm = "ES256K" | "EdDSA";

/**
 * JWS protected header fields we care about. Additional fields are allowed
 * (and preserved on parse) but are not interpreted by this module.
 */
export interface JWSProtectedHeader {
  /** Signature algorithm. Required per RFC 7515 §4.1.1. */
  alg: string;
  /** Key ID — caller-defined hint for `resolveKey`. Optional. */
  kid?: string;
  /** Media type of the complete JWS. Optional. */
  typ?: string;
  /** Media type of the payload. Optional. */
  cty?: string;
  /** Any other parameters. */
  [key: string]: unknown;
}

/**
 * Result of `verifyJWSSignature`. `payload` is the JSON-parsed payload if
 * decoding succeeded; callers should still validate its structure against
 * their own schema (e.g. `OfferPayload`).
 */
export interface JWSVerifyResult {
  /** Whether the signature is valid. */
  valid: boolean;
  /** Decoded protected header, if parsing succeeded. */
  header?: JWSProtectedHeader;
  /** JSON-parsed payload, if parsing succeeded. */
  payload?: unknown;
  /** Error message when `valid === false`. */
  error?: string;
}

/**
 * Resolve the public key bytes for a given protected header. Typically
 * looks up `header.kid` in a JWKS endpoint or a local registry.
 *
 * Expected return formats per algorithm:
 *   - `ES256K`: 33-byte compressed or 65-byte uncompressed secp256k1 key
 *   - `EdDSA`:  32-byte ed25519 public key
 */
export type JWSKeyResolver = (header: JWSProtectedHeader) => Promise<Uint8Array> | Uint8Array;

// ---------------------------------------------------------------------------
// base64url helpers (no external dep; RFC 4648 §5)
// ---------------------------------------------------------------------------

/**
 * Decode a base64url-encoded string to bytes per RFC 4648 §5.
 *
 * @param input
 */
function base64urlDecode(input: string): Uint8Array {
  // Convert base64url → base64
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const withPadding = pad === 0 ? padded : padded + "=".repeat(4 - pad);
  const binary =
    typeof atob === "function"
      ? atob(withPadding)
      : Buffer.from(withPadding, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode UTF-8 bytes to a string.
 *
 * @param bytes
 */
function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// JWS parse + verify
// ---------------------------------------------------------------------------

/**
 * Verify a JWS in compact serialization form (`header.payload.signature`).
 *
 * @param jws - Full compact JWS string
 * @param resolveKey - Callback that maps the protected header to public
 *   key bytes. Runs after header parse but before signature verification.
 * @returns `JWSVerifyResult` with `valid`, decoded `header`, and `payload`.
 */
export async function verifyJWSSignature(
  jws: string,
  resolveKey: JWSKeyResolver,
): Promise<JWSVerifyResult> {
  // 1. Split compact form
  const parts = jws.split(".");
  if (parts.length !== 3) {
    return {
      valid: false,
      error: `Malformed JWS: expected 3 compact segments, got ${parts.length}`,
    };
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];

  // 2. Decode header
  let header: JWSProtectedHeader;
  try {
    const headerJson = utf8Decode(base64urlDecode(encodedHeader));
    const parsed = JSON.parse(headerJson);
    if (!parsed || typeof parsed !== "object" || typeof parsed.alg !== "string") {
      return { valid: false, error: 'JWS header is missing required "alg" field' };
    }
    header = parsed as JWSProtectedHeader;
  } catch (err) {
    return {
      valid: false,
      error: `Failed to decode JWS header: ${(err as Error).message}`,
    };
  }

  // 3. Decode payload
  let payload: unknown;
  try {
    const payloadJson = utf8Decode(base64urlDecode(encodedPayload));
    payload = JSON.parse(payloadJson);
  } catch (err) {
    return {
      valid: false,
      header,
      error: `Failed to decode JWS payload: ${(err as Error).message}`,
    };
  }

  // 4. Decode signature bytes
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64urlDecode(encodedSignature);
  } catch (err) {
    return {
      valid: false,
      header,
      payload,
      error: `Failed to decode JWS signature: ${(err as Error).message}`,
    };
  }

  // 5. Build signing input (header.payload, both still base64url-encoded)
  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);

  // 6. Resolve public key
  let publicKey: Uint8Array;
  try {
    publicKey = await resolveKey(header);
  } catch (err) {
    return {
      valid: false,
      header,
      payload,
      error: `Key resolution failed: ${(err as Error).message}`,
    };
  }

  // 7. Dispatch per algorithm
  switch (header.alg) {
    case "ES256K":
      return verifyES256K(signingInput, signatureBytes, publicKey, header, payload);
    case "EdDSA":
      return verifyEdDSA(signingInput, signatureBytes, publicKey, header, payload);
    default:
      return {
        valid: false,
        header,
        payload,
        error: `Unsupported JWS algorithm: ${header.alg}. Supported: ES256K, EdDSA`,
      };
  }
}

/**
 * ES256K verification: SHA-256 hash then secp256k1 verify. Signature is
 * the 64-byte IEEE P1363 concatenation (r || s), no recovery byte.
 *
 * @param signingInput
 * @param signature
 * @param publicKey
 * @param header
 * @param payload
 */
function verifyES256K(
  signingInput: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
  header: JWSProtectedHeader,
  payload: unknown,
): JWSVerifyResult {
  if (signature.length !== 64) {
    return {
      valid: false,
      header,
      payload,
      error: `ES256K expects 64-byte signature, got ${signature.length}`,
    };
  }
  try {
    const hash = sha256(signingInput);
    const valid = secp256k1.verify(signature, hash, publicKey);
    return valid
      ? { valid: true, header, payload }
      : { valid: false, header, payload, error: "ES256K signature verification failed" };
  } catch (err) {
    return {
      valid: false,
      header,
      payload,
      error: `ES256K verification threw: ${(err as Error).message}`,
    };
  }
}

/**
 * EdDSA verification: ed25519 native verify (signs the raw message, not a hash).
 *
 * @param signingInput
 * @param signature
 * @param publicKey
 * @param header
 * @param payload
 */
function verifyEdDSA(
  signingInput: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
  header: JWSProtectedHeader,
  payload: unknown,
): JWSVerifyResult {
  if (signature.length !== 64) {
    return {
      valid: false,
      header,
      payload,
      error: `EdDSA expects 64-byte signature, got ${signature.length}`,
    };
  }
  if (publicKey.length !== 32) {
    return {
      valid: false,
      header,
      payload,
      error: `EdDSA expects 32-byte public key, got ${publicKey.length}`,
    };
  }
  try {
    const valid = ed25519.verify(signature, signingInput, publicKey);
    return valid
      ? { valid: true, header, payload }
      : { valid: false, header, payload, error: "EdDSA signature verification failed" };
  } catch (err) {
    return {
      valid: false,
      header,
      payload,
      error: `EdDSA verification threw: ${(err as Error).message}`,
    };
  }
}
