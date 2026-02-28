/**
 * EIP-2612 Gas Sponsoring Extension Client-Side Implementation
 *
 * Provides functions for clients to create EIP-2612 permit signatures
 * and encode gas sponsor payloads for transmission.
 */

import type { Eip2612GasSponsorPayload, CreatePermitParams } from "./types.js";

/**
 * Extension key for EIP-2612 gas sponsoring in payment requirements.
 */
export const EIP2612_GAS_SPONSOR_EXTENSION_KEY = "eip2612GasSponsoring";

/**
 * HTTP header name for EIP-2612 gas sponsor payload.
 */
export const EIP2612_GAS_SPONSOR_HEADER_NAME = "X-T402-EIP2612-Gas-Sponsoring";

/**
 * Creates an EIP-2612 permit signature using EIP-712 typed data signing.
 *
 * @param params - Permit signing parameters
 * @returns Permit data including the signature components
 *
 * @example
 * ```typescript
 * const permit = await createPermitSignature({
 *   signer: wallet,
 *   tokenAddress: "0xUSDT...",
 *   tokenName: "Tether USD",
 *   chainId: 8453,
 *   spender: facilitatorAddress,
 *   value: "1000000",
 *   deadline: Math.floor(Date.now() / 1000) + 300,
 * });
 * ```
 */
export async function createPermitSignature(params: CreatePermitParams): Promise<{
  owner: string;
  spender: string;
  value: string;
  deadline: number;
  v: number;
  r: string;
  s: string;
  permitSignature: string;
}> {
  const { signer, tokenAddress, tokenName, chainId, spender, value, deadline, nonce = 0 } = params;

  const domain = {
    name: tokenName,
    version: "1",
    chainId,
    verifyingContract: tokenAddress,
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const message = {
    owner: signer.address,
    spender,
    value,
    nonce,
    deadline,
  };

  const signature = await signer.signTypedData({
    domain,
    types,
    primaryType: "Permit",
    message,
  });

  // Parse signature into components
  const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature;

  if (sigHex.length !== 130) {
    throw new Error(`Invalid signature length: expected 130 hex chars, got ${sigHex.length}`);
  }

  const r = "0x" + sigHex.slice(0, 64);
  const s = "0x" + sigHex.slice(64, 128);
  let v = parseInt(sigHex.slice(128, 130), 16);

  // Normalize v to 27 or 28
  if (v < 27) {
    v += 27;
  }

  return {
    owner: signer.address,
    spender,
    value,
    deadline,
    v,
    r,
    s,
    permitSignature: signature.startsWith("0x") ? signature : "0x" + signature,
  };
}

/**
 * Creates a gas sponsor payload from permit data and network.
 *
 * @param permit - Permit signature data from createPermitSignature
 * @param permit.owner - Token owner address
 * @param permit.spender - Approved spender address
 * @param permit.value - Token amount in base units
 * @param permit.deadline - Unix timestamp for permit expiry
 * @param permit.v - Recovery parameter from signature
 * @param permit.r - Signature r component (32 bytes hex)
 * @param permit.s - Signature s component (32 bytes hex)
 * @param permit.permitSignature - Full hex-encoded permit signature
 * @param network - CAIP-2 network identifier (e.g., "eip155:8453")
 * @returns Gas sponsor payload ready for header encoding
 *
 * @example
 * ```typescript
 * const payload = createEip2612GasSponsorPayload(permit, "eip155:8453");
 * ```
 */
export function createEip2612GasSponsorPayload(
  permit: {
    owner: string;
    spender: string;
    value: string;
    deadline: number;
    v: number;
    r: string;
    s: string;
    permitSignature: string;
  },
  network: string,
): Eip2612GasSponsorPayload {
  return {
    network,
    permitSignature: permit.permitSignature,
    owner: permit.owner,
    spender: permit.spender,
    value: permit.value,
    deadline: permit.deadline,
    v: permit.v,
    r: permit.r,
    s: permit.s,
  };
}

/**
 * Encodes a gas sponsor payload for transmission in HTTP header.
 *
 * @param payload - The gas sponsor payload to encode
 * @returns Base64-encoded JSON string
 *
 * @example
 * ```typescript
 * const header = encodeEip2612GasSponsorHeader(payload);
 * fetch(url, {
 *   headers: { [EIP2612_GAS_SPONSOR_HEADER_NAME]: header }
 * });
 * ```
 */
export function encodeEip2612GasSponsorHeader(payload: Eip2612GasSponsorPayload): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64");
  }
  return btoa(json);
}
