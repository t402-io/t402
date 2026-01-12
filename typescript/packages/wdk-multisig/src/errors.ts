/**
 * WDK Multi-sig Errors
 *
 * Error types for multi-sig operations.
 */

/**
 * Error codes for multi-sig operations
 */
export enum MultiSigErrorCode {
  /** Threshold not met - need more signatures */
  THRESHOLD_NOT_MET = "MULTISIG_THRESHOLD_NOT_MET",
  /** Not enough signers provided */
  INSUFFICIENT_SIGNERS = "MULTISIG_INSUFFICIENT_SIGNERS",
  /** Signature aggregation failed */
  SIGNATURE_AGGREGATION_FAILED = "MULTISIG_SIGNATURE_AGGREGATION_FAILED",
  /** Signer mismatch - wrong signer for owner */
  SIGNER_MISMATCH = "MULTISIG_SIGNER_MISMATCH",
  /** Invalid threshold configuration */
  INVALID_THRESHOLD = "MULTISIG_INVALID_THRESHOLD",
  /** Owner not found */
  OWNER_NOT_FOUND = "MULTISIG_OWNER_NOT_FOUND",
  /** Request not found */
  REQUEST_NOT_FOUND = "MULTISIG_REQUEST_NOT_FOUND",
  /** Request expired */
  REQUEST_EXPIRED = "MULTISIG_REQUEST_EXPIRED",
  /** Already signed */
  ALREADY_SIGNED = "MULTISIG_ALREADY_SIGNED",
  /** Not ready to submit */
  NOT_READY = "MULTISIG_NOT_READY",
  /** Account not initialized */
  NOT_INITIALIZED = "MULTISIG_NOT_INITIALIZED",
}

/**
 * Multi-sig error class
 */
export class MultiSigError extends Error {
  /** Error code */
  readonly code: MultiSigErrorCode;
  /** Additional context */
  readonly context?: Record<string, unknown>;

  constructor(
    code: MultiSigErrorCode,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MultiSigError";
    this.code = code;
    this.context = context;
  }

  /**
   * Create a threshold not met error
   */
  static thresholdNotMet(required: number, collected: number): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.THRESHOLD_NOT_MET,
      `Threshold not met: need ${required} signatures, have ${collected}`,
      { required, collected },
    );
  }

  /**
   * Create an insufficient signers error
   */
  static insufficientSigners(
    required: number,
    provided: number,
  ): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.INSUFFICIENT_SIGNERS,
      `Insufficient signers: need at least ${required}, provided ${provided}`,
      { required, provided },
    );
  }

  /**
   * Create an invalid threshold error
   */
  static invalidThreshold(threshold: number, ownerCount: number): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.INVALID_THRESHOLD,
      `Invalid threshold: ${threshold} exceeds owner count ${ownerCount}`,
      { threshold, ownerCount },
    );
  }

  /**
   * Create an owner not found error
   */
  static ownerNotFound(ownerIndex: number): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.OWNER_NOT_FOUND,
      `Owner not found at index ${ownerIndex}`,
      { ownerIndex },
    );
  }

  /**
   * Create a request not found error
   */
  static requestNotFound(requestId: string): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.REQUEST_NOT_FOUND,
      `Request not found: ${requestId}`,
      { requestId },
    );
  }

  /**
   * Create a request expired error
   */
  static requestExpired(requestId: string): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.REQUEST_EXPIRED,
      `Request expired: ${requestId}`,
      { requestId },
    );
  }

  /**
   * Create an already signed error
   */
  static alreadySigned(ownerIndex: number): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.ALREADY_SIGNED,
      `Owner at index ${ownerIndex} has already signed`,
      { ownerIndex },
    );
  }

  /**
   * Create a not ready error
   */
  static notReady(required: number, collected: number): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.NOT_READY,
      `Not ready to submit: need ${required} signatures, have ${collected}`,
      { required, collected },
    );
  }

  /**
   * Create a not initialized error
   */
  static notInitialized(): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.NOT_INITIALIZED,
      "Account not initialized. Call initialize() first.",
    );
  }

  /**
   * Create a signer mismatch error
   */
  static signerMismatch(
    expected: string,
    actual: string,
    ownerIndex: number,
  ): MultiSigError {
    return new MultiSigError(
      MultiSigErrorCode.SIGNER_MISMATCH,
      `Signer mismatch at index ${ownerIndex}: expected ${expected}, got ${actual}`,
      { expected, actual, ownerIndex },
    );
  }
}
