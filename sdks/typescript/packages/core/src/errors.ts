/**
 * T402PaymentError - Structured error class for the T402 payment protocol.
 *
 * Wraps upstream errors with payment-specific context: phase, retryability,
 * and optional HTTP status code.
 */

export type PaymentPhase = "signing" | "submission" | "verification" | "settlement" | "unknown";

export class T402PaymentError extends Error {
  readonly cause?: Error;
  readonly phase: PaymentPhase;
  readonly retryable: boolean;
  readonly code?: number;

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

  isRetryable(): boolean {
    return this.retryable;
  }

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
