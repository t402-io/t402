/**
 * T402PaymentError - Structured error class for the T402 payment protocol.
 *
 * Wraps upstream errors with payment-specific context: phase, retryability,
 * and optional HTTP status code.
 */

export type PaymentPhase = "signing" | "submission" | "verification" | "settlement" | "unknown";

/**
 * Structured error class for the T402 payment protocol.
 */
export class T402PaymentError extends Error {
  readonly cause?: Error;
  readonly phase: PaymentPhase;
  readonly retryable: boolean;
  readonly code?: number;

  /**
   * Create a new T402PaymentError.
   *
   * @param message - Human-readable error message
   * @param options - Optional error context
   * @param options.cause - Underlying error that triggered this one
   * @param options.phase - Payment lifecycle phase where the error occurred
   * @param options.retryable - Whether the failed operation can be retried
   * @param options.code - HTTP status code associated with the error
   */
  constructor(
    message: string,
    options?: {
      cause?: Error;
      phase?: PaymentPhase;
      retryable?: boolean;
      code?: number;
    },
  ) {
    super(message);
    this.name = "T402PaymentError";
    this.cause = options?.cause;
    this.phase = options?.phase ?? "unknown";
    this.retryable = options?.retryable ?? false;
    this.code = options?.code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, T402PaymentError);
    }
  }

  /**
   * Check whether this error represents a retryable failure.
   *
   * @returns True if the operation can be retried
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Serialize the error to a plain object for JSON output.
   *
   * @returns Plain object containing the error details
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      phase: this.phase,
      retryable: this.retryable,
      code: this.code,
      cause: this.cause?.message,
    };
  }
}
