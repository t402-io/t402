/**
 * WDK Multi-sig Signature Collector
 *
 * Manages pending multi-sig transactions and collects signatures
 * from multiple owners.
 */

import type { Address, Hex } from "viem";
import type { UserOperation } from "@t402/evm";
import type {
  MultiSigTransactionRequest,
  PendingSignature,
} from "./types.js";
import { DEFAULTS } from "./constants.js";
import { MultiSigError } from "./errors.js";
import { combineSignatures, generateRequestId, getOwnerIndex } from "./utils.js";

/**
 * Configuration for SignatureCollector
 */
export interface SignatureCollectorConfig {
  /** Request expiration time in milliseconds (default: 1 hour) */
  expirationMs?: number;
}

/**
 * Signature Collector
 *
 * Manages pending multi-sig transactions and signature collection.
 * Handles request lifecycle, signature aggregation, and expiration cleanup.
 */
export class SignatureCollector {
  private readonly pendingRequests: Map<string, MultiSigTransactionRequest>;
  private readonly expirationMs: number;

  constructor(config?: SignatureCollectorConfig) {
    this.pendingRequests = new Map();
    this.expirationMs = config?.expirationMs ?? DEFAULTS.REQUEST_EXPIRATION_MS;
  }

  /**
   * Create a new signature collection request
   *
   * @param userOp - The UserOperation to sign
   * @param userOpHash - Hash of the UserOperation
   * @param owners - Array of owner addresses (sorted)
   * @param threshold - Number of signatures required
   * @returns New transaction request
   */
  createRequest(
    userOp: UserOperation,
    userOpHash: Hex,
    owners: Address[],
    threshold: number,
  ): MultiSigTransactionRequest {
    const now = Date.now();
    const id = generateRequestId();

    // Initialize pending signatures for all owners
    const signatures: PendingSignature[] = owners.map((owner, index) => ({
      owner,
      ownerIndex: index,
      signed: false,
    }));

    const request: MultiSigTransactionRequest = {
      id,
      userOp,
      userOpHash,
      signatures,
      threshold,
      collectedCount: 0,
      isReady: false,
      createdAt: now,
      expiresAt: now + this.expirationMs,
    };

    this.pendingRequests.set(id, request);
    return request;
  }

  /**
   * Add a signature from an owner
   *
   * @param requestId - Request ID
   * @param ownerAddress - Address of the signing owner
   * @param signature - The signature
   * @returns Updated request
   */
  addSignature(
    requestId: string,
    ownerAddress: Address,
    signature: Hex,
  ): MultiSigTransactionRequest {
    const request = this.pendingRequests.get(requestId);

    if (!request) {
      throw MultiSigError.requestNotFound(requestId);
    }

    // Check expiration
    if (Date.now() > request.expiresAt) {
      this.pendingRequests.delete(requestId);
      throw MultiSigError.requestExpired(requestId);
    }

    // Find the owner in the request
    const pendingSignature = request.signatures.find(
      (s) => s.owner.toLowerCase() === ownerAddress.toLowerCase(),
    );

    if (!pendingSignature) {
      throw MultiSigError.ownerNotFound(
        getOwnerIndex(
          ownerAddress,
          request.signatures.map((s) => s.owner),
        ),
      );
    }

    // Check if already signed
    if (pendingSignature.signed) {
      throw MultiSigError.alreadySigned(pendingSignature.ownerIndex);
    }

    // Add signature
    pendingSignature.signed = true;
    pendingSignature.signature = signature;

    // Update counts
    request.collectedCount = request.signatures.filter((s) => s.signed).length;
    request.isReady = request.collectedCount >= request.threshold;

    return request;
  }

  /**
   * Check if a request has enough signatures
   *
   * @param requestId - Request ID
   * @returns True if threshold is met
   */
  isComplete(requestId: string): boolean {
    const request = this.pendingRequests.get(requestId);

    if (!request) {
      throw MultiSigError.requestNotFound(requestId);
    }

    return request.isReady;
  }

  /**
   * Get the combined signature for a completed request
   *
   * @param requestId - Request ID
   * @returns Combined signature in Safe format
   */
  getCombinedSignature(requestId: string): Hex {
    const request = this.pendingRequests.get(requestId);

    if (!request) {
      throw MultiSigError.requestNotFound(requestId);
    }

    if (!request.isReady) {
      throw MultiSigError.notReady(request.threshold, request.collectedCount);
    }

    // Build map of owner index to signature
    const signatureMap = new Map<number, Hex>();

    for (const sig of request.signatures) {
      if (sig.signed && sig.signature) {
        signatureMap.set(sig.ownerIndex, sig.signature);
      }
    }

    // Combine signatures
    const owners = request.signatures.map((s) => s.owner);
    return combineSignatures(signatureMap, owners);
  }

  /**
   * Get a pending request
   *
   * @param requestId - Request ID
   * @returns Request or undefined
   */
  getRequest(requestId: string): MultiSigTransactionRequest | undefined {
    const request = this.pendingRequests.get(requestId);

    // Check expiration
    if (request && Date.now() > request.expiresAt) {
      this.pendingRequests.delete(requestId);
      return undefined;
    }

    return request;
  }

  /**
   * Get all pending requests
   *
   * @returns Array of pending requests
   */
  getPendingRequests(): MultiSigTransactionRequest[] {
    this.cleanup();
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Remove a request
   *
   * @param requestId - Request ID
   * @returns True if removed
   */
  removeRequest(requestId: string): boolean {
    return this.pendingRequests.delete(requestId);
  }

  /**
   * Clean up expired requests
   */
  cleanup(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, request] of this.pendingRequests) {
      if (now > request.expiresAt) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Get pending signature count for a request
   *
   * @param requestId - Request ID
   * @returns Number of pending signatures
   */
  getPendingCount(requestId: string): number {
    const request = this.pendingRequests.get(requestId);

    if (!request) {
      throw MultiSigError.requestNotFound(requestId);
    }

    return request.signatures.filter((s) => !s.signed).length;
  }

  /**
   * Get list of owners who haven't signed yet
   *
   * @param requestId - Request ID
   * @returns Array of pending owner addresses
   */
  getPendingOwners(requestId: string): Address[] {
    const request = this.pendingRequests.get(requestId);

    if (!request) {
      throw MultiSigError.requestNotFound(requestId);
    }

    return request.signatures.filter((s) => !s.signed).map((s) => s.owner);
  }

  /**
   * Get list of owners who have signed
   *
   * @param requestId - Request ID
   * @returns Array of signed owner addresses
   */
  getSignedOwners(requestId: string): Address[] {
    const request = this.pendingRequests.get(requestId);

    if (!request) {
      throw MultiSigError.requestNotFound(requestId);
    }

    return request.signatures.filter((s) => s.signed).map((s) => s.owner);
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }
}
