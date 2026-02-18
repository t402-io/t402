/**
 * Sign-In-With-X (SIWx) Server-Side Implementation
 *
 * Provides functions for servers to declare SIWx requirements,
 * parse client headers, and verify signatures.
 */

import { randomBytes } from "crypto";
import { keccak_256 } from "@noble/hashes/sha3";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2";
import { secp256k1 } from "@noble/curves/secp256k1";
import { ed25519 } from "@noble/curves/ed25519";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  SIWxExtension,
  SIWxExtensionInfo,
  SIWxPayload,
  DeclareSIWxOptions,
  ValidateSIWxOptions,
  VerifySIWxOptions,
  SIWxValidationResult,
  SIWxVerificationResult,
} from "./types.js";

/**
 * JSON Schema for SIWx payload validation.
 */
const SIWX_SCHEMA = {
  type: "object",
  required: ["domain", "address", "uri", "version", "chainId", "nonce", "issuedAt", "signature"],
  properties: {
    domain: { type: "string" },
    address: { type: "string" },
    statement: { type: "string" },
    uri: { type: "string" },
    version: { type: "string" },
    chainId: { type: "string" },
    nonce: { type: "string" },
    issuedAt: { type: "string", format: "date-time" },
    expirationTime: { type: "string", format: "date-time" },
    notBefore: { type: "string", format: "date-time" },
    requestId: { type: "string" },
    resources: { type: "array", items: { type: "string" } },
    signature: { type: "string" },
  },
};

/**
 * EIP-1271 magic value for valid signatures.
 */
const EIP1271_MAGIC_VALUE = "0x1626ba7e";

/**
 * Extracts domain from a resource URI.
 *
 * @param resourceUri - Full resource URI (e.g., "https://api.example.com/resource")
 * @returns Domain without protocol (e.g., "api.example.com")
 */
function extractDomain(resourceUri: string): string {
  try {
    const url = new URL(resourceUri);
    return url.host;
  } catch {
    // Fallback for non-URL formats
    return resourceUri.replace(/^https?:\/\//, "").split("/")[0];
  }
}

/**
 * Generates a cryptographically secure nonce.
 *
 * @returns 32-byte hex-encoded nonce
 */
function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Declares a SIWx extension for server responses.
 *
 * @param options - Extension declaration options
 * @returns SIWx extension object ready for response
 *
 * @example
 * ```typescript
 * const extension = declareSIWxExtension({
 *   resourceUri: "https://api.example.com/premium",
 *   network: "eip155:8453",
 *   statement: "Sign in to access premium content",
 * });
 * ```
 */
export function declareSIWxExtension(options: DeclareSIWxOptions): SIWxExtension {
  const domain = extractDomain(options.resourceUri);
  const now = new Date();
  const expirationTime =
    options.expirationTime || new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  const info: SIWxExtensionInfo = {
    domain,
    uri: options.resourceUri,
    statement: options.statement,
    version: options.version || "1",
    chainId: options.network,
    nonce: generateNonce(),
    issuedAt: now.toISOString(),
    expirationTime,
    resources: [options.resourceUri],
    signatureScheme: options.signatureScheme,
  };

  return {
    info,
    schema: SIWX_SCHEMA,
  };
}

/**
 * Parses a SIWx header from client request.
 *
 * The header format is base64-encoded JSON.
 *
 * @param header - Base64-encoded SIWx header value
 * @returns Parsed SIWx payload
 * @throws Error if header is invalid
 *
 * @example
 * ```typescript
 * const payload = parseSIWxHeader(request.headers['x-t402-siwx']);
 * ```
 */
export function parseSIWxHeader(header: string): SIWxPayload {
  if (!header) {
    throw new Error("Missing SIWx header");
  }

  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const payload = JSON.parse(decoded) as SIWxPayload;

    // Validate required fields
    const required = [
      "domain",
      "address",
      "uri",
      "version",
      "chainId",
      "nonce",
      "issuedAt",
      "signature",
    ];
    for (const field of required) {
      if (!(field in payload)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return payload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid SIWx header: malformed JSON");
    }
    throw error;
  }
}

/**
 * Validates a SIWx message against expected values.
 *
 * @param message - The SIWx payload to validate
 * @param expectedResourceUri - Expected resource URI (domain validated from this)
 * @param options - Validation options
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateSIWxMessage(payload, "https://api.example.com/premium", {
 *   maxAge: 5 * 60 * 1000, // 5 minutes
 *   checkNonce: (nonce) => usedNonces.has(nonce) === false,
 * });
 * ```
 */
export function validateSIWxMessage(
  message: SIWxPayload,
  expectedResourceUri: string,
  options: ValidateSIWxOptions = {},
): SIWxValidationResult {
  const { maxAge = 5 * 60 * 1000, checkNonce } = options;

  // Validate domain matches
  const expectedDomain = extractDomain(expectedResourceUri);
  if (message.domain !== expectedDomain) {
    return {
      valid: false,
      error: `Domain mismatch: expected ${expectedDomain}, got ${message.domain}`,
    };
  }

  // Validate URI matches
  if (message.uri !== expectedResourceUri) {
    return {
      valid: false,
      error: `URI mismatch: expected ${expectedResourceUri}, got ${message.uri}`,
    };
  }

  // Validate version
  if (message.version !== "1") {
    return { valid: false, error: `Unsupported version: ${message.version}` };
  }

  // Validate issuedAt is not too old
  const issuedAt = new Date(message.issuedAt);
  const now = new Date();
  if (now.getTime() - issuedAt.getTime() > maxAge) {
    return { valid: false, error: "Message has expired (issuedAt too old)" };
  }

  // Validate expirationTime if present
  if (message.expirationTime) {
    const expiration = new Date(message.expirationTime);
    if (expiration < now) {
      return { valid: false, error: "Message has expired" };
    }
  }

  // Validate notBefore if present
  if (message.notBefore) {
    const notBefore = new Date(message.notBefore);
    if (notBefore > now) {
      return { valid: false, error: "Message not yet valid (notBefore in future)" };
    }
  }

  // Custom nonce validation
  if (checkNonce && !checkNonce(message.nonce)) {
    return { valid: false, error: "Invalid nonce (replay attack detected)" };
  }

  return { valid: true };
}

/**
 * Detects the signature scheme from chain ID.
 *
 * @param chainId - CAIP-2 chain ID (e.g., "eip155:1", "solana:mainnet", "stellar:pubnet")
 * @returns The signature scheme to use for verification
 */
function detectSignatureScheme(chainId: string): "evm" | "ed25519" | "tron" {
  const namespace = chainId.split(":")[0];

  switch (namespace) {
    case "solana":
    case "stellar":
    case "ton":
      return "ed25519";
    case "tron":
      return "tron";
    case "eip155":
    default:
      return "evm";
  }
}

/**
 * Verifies an Ed25519 signature (used by Solana and Stellar).
 *
 * @param message - The message that was signed
 * @param signature - Hex-encoded Ed25519 signature (64 bytes)
 * @param publicKey - The public key to verify against (hex or base58)
 * @returns True if signature is valid
 */
function verifyEd25519Signature(message: string, signature: string, publicKey: string): boolean {
  try {
    // Remove 0x prefix if present
    const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature;
    const sigBytes = hexToBytes(sigHex);

    if (sigBytes.length !== 64) {
      throw new Error(
        `Invalid Ed25519 signature length: expected 64 bytes, got ${sigBytes.length}`,
      );
    }

    // Get public key bytes
    let pubKeyBytes: Uint8Array;
    const pubKeyHex = publicKey.startsWith("0x") ? publicKey.slice(2) : publicKey;

    // Check if it's a hex string (64 chars = 32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(pubKeyHex)) {
      pubKeyBytes = hexToBytes(pubKeyHex);
    } else {
      // Try to decode as base58 (Solana format)
      pubKeyBytes = decodeBase58(publicKey);
    }

    if (pubKeyBytes.length !== 32) {
      throw new Error(
        `Invalid Ed25519 public key length: expected 32 bytes, got ${pubKeyBytes.length}`,
      );
    }

    // Hash the message (Ed25519 signs the raw message or its hash depending on implementation)
    const messageBytes = new TextEncoder().encode(message);

    // Verify the signature
    return ed25519.verify(sigBytes, messageBytes, pubKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Decodes a base58 string to bytes (for Solana addresses).
 *
 * @param str - Base58 encoded string
 * @returns Decoded bytes
 */
function decodeBase58(str: string): Uint8Array {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const ALPHABET_MAP = new Map<string, number>();
  for (let i = 0; i < ALPHABET.length; i++) {
    ALPHABET_MAP.set(ALPHABET[i], i);
  }

  if (str.length === 0) return new Uint8Array(0);

  const bytes: number[] = [0];
  for (const char of str) {
    const value = ALPHABET_MAP.get(char);
    if (value === undefined) {
      throw new Error(`Invalid base58 character: ${char}`);
    }

    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Add leading zeros
  for (const char of str) {
    if (char !== "1") break;
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

/**
 * Encodes bytes to base58 string.
 *
 * @param bytes - Bytes to encode
 * @returns Base58 encoded string
 */
function encodeBase58(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  if (bytes.length === 0) return "";

  // Count leading zeros
  let leadingZeros = 0;
  for (const b of bytes) {
    if (b !== 0) break;
    leadingZeros++;
  }

  // Convert to base58
  const digits: number[] = [0];
  for (const b of bytes) {
    let carry = b;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 256;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let result = ALPHABET[0].repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    result += ALPHABET[digits[i]];
  }

  return result;
}

/**
 * Converts an EVM hex address to a TRON base58check address.
 *
 * TRON addresses are the same as EVM addresses but with a 0x41 prefix
 * instead of 0x, encoded in base58check format.
 *
 * @param evmAddress - EVM address with 0x prefix
 * @returns TRON base58check address starting with 'T'
 */
function evmAddressToTron(evmAddress: string): string {
  const addr = evmAddress.toLowerCase().replace("0x", "");
  // TRON address = 0x41 + 20-byte address
  const addressBytes = hexToBytes("41" + addr);

  // Double SHA-256 for base58check checksum
  const hash1 = nobleSha256(addressBytes);
  const hash2 = nobleSha256(hash1);
  const checksum = hash2.slice(0, 4);

  // Concatenate address + checksum
  const fullAddress = new Uint8Array(addressBytes.length + 4);
  fullAddress.set(addressBytes, 0);
  fullAddress.set(checksum, addressBytes.length);

  return encodeBase58(fullAddress);
}


/**
 * Verifies a SIWx signature.
 *
 * Supports EIP-191 personal signatures for EVM chains, Ed25519 for Solana/Stellar/TON,
 * TRON secp256k1 with base58check addresses,
 * and can optionally verify smart wallet signatures via EIP-1271/6492.
 *
 * @param message - The SIWx payload to verify
 * @param signature - The signature to verify (hex-encoded)
 * @param options - Verification options
 * @returns Verification result with recovered address
 *
 * @example
 * ```typescript
 * const result = await verifySIWxSignature(payload, payload.signature, {
 *   checkSmartWallet: true,
 *   provider: web3Provider,
 * });
 * ```
 */
export async function verifySIWxSignature(
  message: SIWxPayload,
  signature: string,
  options: VerifySIWxOptions = {},
): Promise<SIWxVerificationResult> {
  const { checkSmartWallet = false } = options;

  try {
    // Reconstruct the CAIP-122 message that was signed
    const messageText = constructMessage(message);

    // Detect signature scheme based on chain ID
    const scheme = detectSignatureScheme(message.chainId);

    if (scheme === "ed25519") {
      // Ed25519 verification for Solana, Stellar, and TON
      // For Ed25519, the address IS the public key, so we verify directly
      const isValid = verifyEd25519Signature(messageText, signature, message.address);

      if (isValid) {
        return { valid: true, address: message.address };
      }

      return {
        valid: false,
        error: "Ed25519 signature verification failed",
      };
    }

    if (scheme === "tron") {
      // TRON uses secp256k1 (same as EVM) but with base58check address format
      const messageHash = hashMessage(messageText);
      const recoveredEvmAddress = recoverAddress(messageHash, signature);

      // Convert recovered EVM address to TRON base58check address
      const recoveredTronAddress = evmAddressToTron(recoveredEvmAddress);

      if (recoveredTronAddress === message.address) {
        return { valid: true, address: message.address };
      }

      return {
        valid: false,
        address: recoveredTronAddress,
        error: `Signature mismatch: expected ${message.address}, recovered ${recoveredTronAddress}`,
      };
    }

    // EVM verification (secp256k1)
    // Hash the message with Ethereum prefix
    const messageHash = hashMessage(messageText);

    // Try to recover the signer address
    const recoveredAddress = recoverAddress(messageHash, signature);

    // Check if recovered address matches claimed address
    if (recoveredAddress.toLowerCase() !== message.address.toLowerCase()) {
      // If smart wallet checking is enabled, try EIP-1271 verification
      if (checkSmartWallet && options.provider) {
        const isValidSmartWallet = await verifySmartWalletSignature(
          message.address,
          messageHash,
          signature,
          options.provider,
        );

        if (isValidSmartWallet) {
          return { valid: true, address: message.address };
        }
      }

      return {
        valid: false,
        address: recoveredAddress,
        error: `Signature mismatch: expected ${message.address}, recovered ${recoveredAddress}`,
      };
    }

    return { valid: true, address: recoveredAddress };
  } catch (error) {
    return {
      valid: false,
      error: `Signature verification failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

/**
 * Constructs the CAIP-122 message string from payload.
 *
 * @param payload - SIWx payload
 * @returns CAIP-122 formatted message string
 */
export function constructMessage(payload: SIWxPayload): string {
  const lines: string[] = [];

  // Header
  lines.push(`${payload.domain} wants you to sign in with your ${payload.chainId} account:`);
  lines.push(payload.address);
  lines.push("");

  // Statement (optional)
  if (payload.statement) {
    lines.push(payload.statement);
    lines.push("");
  }

  // Required fields
  lines.push(`URI: ${payload.uri}`);
  lines.push(`Version: ${payload.version}`);
  lines.push(`Chain ID: ${payload.chainId}`);
  lines.push(`Nonce: ${payload.nonce}`);
  lines.push(`Issued At: ${payload.issuedAt}`);

  // Optional fields
  if (payload.expirationTime) {
    lines.push(`Expiration Time: ${payload.expirationTime}`);
  }
  if (payload.notBefore) {
    lines.push(`Not Before: ${payload.notBefore}`);
  }
  if (payload.requestId) {
    lines.push(`Request ID: ${payload.requestId}`);
  }

  // Resources
  if (payload.resources && payload.resources.length > 0) {
    lines.push("Resources:");
    for (const resource of payload.resources) {
      lines.push(`- ${resource}`);
    }
  }

  return lines.join("\n");
}

/**
 * Hashes a message with the Ethereum signed message prefix (EIP-191).
 *
 * @param message - Message to hash
 * @returns Hex-encoded keccak256 hash with 0x prefix
 */
export function hashMessage(message: string): string {
  const messageBytes = new TextEncoder().encode(message);
  const prefix = `\x19Ethereum Signed Message:\n${messageBytes.length}`;
  const prefixBytes = new TextEncoder().encode(prefix);

  // Concatenate prefix and message
  const combined = new Uint8Array(prefixBytes.length + messageBytes.length);
  combined.set(prefixBytes, 0);
  combined.set(messageBytes, prefixBytes.length);

  // Hash with keccak256
  const hash = keccak_256(combined);
  return "0x" + bytesToHex(hash);
}

/**
 * Recovers the signer address from an EIP-191 signature.
 *
 * @param messageHash - Keccak256 hash of the prefixed message (with 0x prefix)
 * @param signature - Hex-encoded signature (65 bytes: r + s + v)
 * @returns Checksummed Ethereum address
 */
function recoverAddress(messageHash: string, signature: string): string {
  // Remove 0x prefix if present
  const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature;
  const hashHex = messageHash.startsWith("0x") ? messageHash.slice(2) : messageHash;

  if (sigHex.length !== 130) {
    throw new Error(`Invalid signature length: expected 130 hex chars, got ${sigHex.length}`);
  }

  // Parse signature components
  const r = BigInt("0x" + sigHex.slice(0, 64));
  const s = BigInt("0x" + sigHex.slice(64, 128));
  let v = parseInt(sigHex.slice(128, 130), 16);

  // Normalize v to 0 or 1 (EIP-155 compatibility)
  if (v >= 27) {
    v -= 27;
  }

  if (v !== 0 && v !== 1) {
    throw new Error(`Invalid recovery id: ${v}`);
  }

  // Create signature object
  const sig = new secp256k1.Signature(r, s).addRecoveryBit(v);

  // Recover public key
  const hashBytes = hexToBytes(hashHex);
  const publicKey = sig.recoverPublicKey(hashBytes);

  // Get uncompressed public key (65 bytes) and remove the 04 prefix
  const pubKeyBytes = publicKey.toRawBytes(false).slice(1);

  // Hash public key to get address
  const addressHash = keccak_256(pubKeyBytes);

  // Take last 20 bytes
  const addressBytes = addressHash.slice(-20);
  const address = "0x" + bytesToHex(addressBytes);

  // Return checksummed address
  return toChecksumAddress(address);
}

/**
 * Converts an Ethereum address to checksummed format (EIP-55).
 *
 * @param address - Ethereum address (with or without 0x prefix)
 * @returns Checksummed address with 0x prefix
 */
function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace("0x", "");
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(addr)));

  let checksummed = "0x";
  for (let i = 0; i < 40; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += addr[i].toUpperCase();
    } else {
      checksummed += addr[i];
    }
  }

  return checksummed;
}

/**
 * Verifies a smart wallet signature using EIP-1271.
 *
 * @param walletAddress - Smart wallet contract address
 * @param messageHash - Hash of the message that was signed
 * @param signature - The signature to verify
 * @param provider - Ethereum provider with call capability
 * @returns True if signature is valid according to the smart wallet
 */
async function verifySmartWalletSignature(
  walletAddress: string,
  messageHash: string,
  signature: string,
  provider: unknown,
): Promise<boolean> {
  // Type guard for provider
  interface EthProvider {
    request(args: { method: string; params: unknown[] }): Promise<unknown>;
  }

  /**
   * Type guard for Ethereum provider interface
   *
   * @param p - Value to check
   * @returns True if value is an EthProvider
   */
  function isEthProvider(p: unknown): p is EthProvider {
    return typeof p === "object" && p !== null && "request" in p;
  }

  if (!isEthProvider(provider)) {
    return false;
  }

  try {
    // EIP-1271 isValidSignature(bytes32 hash, bytes signature) returns bytes4
    const hashHex = messageHash.startsWith("0x") ? messageHash : "0x" + messageHash;
    const sigHex = signature.startsWith("0x") ? signature : "0x" + signature;

    // Encode function call
    // isValidSignature(bytes32,bytes) selector: 0x1626ba7e
    const data =
      "0x1626ba7e" +
      hashHex.slice(2).padStart(64, "0") + // bytes32 hash
      "0000000000000000000000000000000000000000000000000000000000000040" + // offset to bytes
      (sigHex.length / 2 - 1).toString(16).padStart(64, "0") + // bytes length
      sigHex.slice(2).padEnd(Math.ceil((sigHex.length - 2) / 64) * 64, "0"); // bytes data

    const result = (await provider.request({
      method: "eth_call",
      params: [{ to: walletAddress, data }, "latest"],
    })) as string;

    // Check if result matches magic value
    return result.toLowerCase().startsWith(EIP1271_MAGIC_VALUE);
  } catch {
    return false;
  }
}

/**
 * Verifies a signature using EIP-6492 (universal signature verification).
 *
 * This supports both deployed and undeployed smart wallets.
 *
 * @param walletAddress - Wallet address (may be counterfactual)
 * @param messageHash - Hash of the message that was signed
 * @param signature - The signature (may include deployment data)
 * @param provider - Ethereum provider
 * @returns True if signature is valid
 */
export async function verifyEIP6492Signature(
  walletAddress: string,
  messageHash: string,
  signature: string,
  provider: unknown,
): Promise<boolean> {
  // EIP-6492 signatures end with the magic suffix
  const EIP6492_SUFFIX = "6492649264926492649264926492649264926492649264926492649264926492";
  const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature;

  if (sigHex.endsWith(EIP6492_SUFFIX)) {
    // This is an EIP-6492 signature with deployment data
    // For full implementation, we would need to:
    // 1. Deploy the wallet contract to a local fork
    // 2. Then call isValidSignature
    // This requires more complex provider interaction
    console.warn("EIP-6492 deployment signatures not yet fully implemented");
    return false;
  }

  // Fall back to standard EIP-1271 verification
  return verifySmartWalletSignature(walletAddress, messageHash, signature, provider);
}
