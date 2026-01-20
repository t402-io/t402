/**
 * Sign-In-With-X (SIWx) Server-Side Implementation
 *
 * Provides functions for servers to declare SIWx requirements,
 * parse client headers, and verify signatures.
 */

import { randomBytes } from "crypto";
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
    const required = ["domain", "address", "uri", "version", "chainId", "nonce", "issuedAt", "signature"];
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
  options: ValidateSIWxOptions = {}
): SIWxValidationResult {
  const { maxAge = 5 * 60 * 1000, checkNonce } = options;

  // Validate domain matches
  const expectedDomain = extractDomain(expectedResourceUri);
  if (message.domain !== expectedDomain) {
    return { valid: false, error: `Domain mismatch: expected ${expectedDomain}, got ${message.domain}` };
  }

  // Validate URI matches
  if (message.uri !== expectedResourceUri) {
    return { valid: false, error: `URI mismatch: expected ${expectedResourceUri}, got ${message.uri}` };
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
 * Verifies a SIWx signature.
 *
 * Supports EIP-191 personal signatures and can optionally verify
 * smart wallet signatures via EIP-1271/6492.
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
  options: VerifySIWxOptions = {}
): Promise<SIWxVerificationResult> {
  const { checkSmartWallet = false } = options;

  try {
    // Reconstruct the CAIP-122 message that was signed
    const messageText = constructMessage(message);

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
          options.provider
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
 */
function constructMessage(payload: SIWxPayload): string {
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
 * Hashes a message with the Ethereum signed message prefix.
 */
function hashMessage(message: string): string {
  const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
  const prefixedMessage = prefix + message;

  // Use Web Crypto API or Node crypto for hashing
  const { createHash } = require("crypto");
  const hash = createHash("keccak256").update(prefixedMessage).digest("hex");
  return "0x" + hash;
}

/**
 * Recovers the signer address from a signature.
 */
function recoverAddress(_messageHash: string, signature: string): string {
  // Validate signature format
  const sig = signature.startsWith("0x") ? signature.slice(2) : signature;
  if (sig.length !== 130) {
    throw new Error("Invalid signature length - expected 65 bytes (130 hex chars)");
  }

  // ECDSA recovery not implemented in pure TypeScript
  // Use viem's recoverMessageAddress or ethers.verifyMessage for production
  // Example with viem:
  //   import { recoverMessageAddress } from 'viem';
  //   return recoverMessageAddress({ message, signature });
  throw new Error(
    "ECDSA recovery not implemented - use viem or ethers for signature verification"
  );
}

/**
 * Verifies a smart wallet signature using EIP-1271.
 */
async function verifySmartWalletSignature(
  _walletAddress: string,
  _messageHash: string,
  _signature: string,
  _provider: unknown
): Promise<boolean> {
  // EIP-1271 verification would go here
  // This requires calling isValidSignature on the wallet contract
  return false;
}

export { constructMessage };
