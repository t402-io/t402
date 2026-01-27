/**
 * In-memory bridge state tracking for demo
 * Simulates LayerZero message delivery lifecycle
 */

export type BridgeStatus = "INFLIGHT" | "CONFIRMING" | "DELIVERED" | "FAILED";

export interface BridgeState {
  guid: string;
  sourceChain: string;
  targetChain: string;
  amount: string;
  fee: string;
  srcTxHash: string;
  dstTxHash?: string;
  status: BridgeStatus;
  createdAt: number;
  updatedAt: number;
  recipient: string;
}

// In-memory store (resets on server restart)
const bridgeStates = new Map<string, BridgeState>();

// Status transition times (in ms)
const STATUS_TRANSITIONS: Record<BridgeStatus, { next: BridgeStatus | null; delay: number }> = {
  INFLIGHT: { next: "CONFIRMING", delay: 10000 }, // 10 seconds
  CONFIRMING: { next: "DELIVERED", delay: 20000 }, // 20 seconds
  DELIVERED: { next: null, delay: 0 },
  FAILED: { next: null, delay: 0 },
};

/**
 * Generate a LayerZero-compatible message GUID
 * Format: 32 bytes hex string (0x prefix)
 */
export function generateMessageGuid(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a chain-appropriate transaction hash
 */
export function generateTxHash(chain: string): string {
  if (chain === "ton") {
    // TON uses base64
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes)).slice(0, 44);
  }
  // EVM chains use 0x + 64 hex
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a new bridge transaction
 */
export function createBridgeTransaction(params: {
  sourceChain: string;
  targetChain: string;
  amount: string;
  fee: string;
  recipient: string;
}): BridgeState {
  const guid = generateMessageGuid();
  const srcTxHash = generateTxHash(params.sourceChain);

  const state: BridgeState = {
    guid,
    sourceChain: params.sourceChain,
    targetChain: params.targetChain,
    amount: params.amount,
    fee: params.fee,
    srcTxHash,
    status: "INFLIGHT",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    recipient: params.recipient,
  };

  bridgeStates.set(guid, state);
  return state;
}

/**
 * Get bridge state and update status based on elapsed time
 */
export function getBridgeState(guid: string): BridgeState | null {
  const state = bridgeStates.get(guid);
  if (!state) return null;

  // Calculate expected status based on elapsed time
  const now = Date.now();
  const elapsed = now - state.createdAt;

  let currentStatus: BridgeStatus = "INFLIGHT";
  let accumulatedDelay = 0;

  // Walk through status transitions
  for (const status of ["INFLIGHT", "CONFIRMING", "DELIVERED"] as BridgeStatus[]) {
    const transition = STATUS_TRANSITIONS[status];
    if (elapsed >= accumulatedDelay + transition.delay && transition.next) {
      accumulatedDelay += transition.delay;
      currentStatus = transition.next;
    } else {
      currentStatus = status;
      break;
    }
  }

  // Update state if status changed
  if (state.status !== currentStatus) {
    state.status = currentStatus;
    state.updatedAt = now;

    // Generate destination tx hash when delivered
    if (currentStatus === "DELIVERED" && !state.dstTxHash) {
      state.dstTxHash = generateTxHash(state.targetChain);
    }

    bridgeStates.set(guid, state);
  }

  return state;
}

/**
 * Get all bridge states (for debugging)
 */
export function getAllBridgeStates(): BridgeState[] {
  return Array.from(bridgeStates.values());
}

/**
 * Get estimated time remaining for delivery
 */
export function getEstimatedTimeRemaining(state: BridgeState): number {
  if (state.status === "DELIVERED" || state.status === "FAILED") {
    return 0;
  }

  const totalDelay = STATUS_TRANSITIONS.INFLIGHT.delay + STATUS_TRANSITIONS.CONFIRMING.delay;
  const elapsed = Date.now() - state.createdAt;
  return Math.max(0, totalDelay - elapsed);
}

/**
 * Clean up old bridge states (older than 1 hour)
 */
export function cleanupOldStates(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [guid, state] of bridgeStates.entries()) {
    if (state.createdAt < oneHourAgo) {
      bridgeStates.delete(guid);
    }
  }
}
