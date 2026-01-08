/**
 * Error classes for T402 WDK integration
 *
 * Provides structured error handling with error codes for
 * programmatic error handling and debugging.
 */

/**
 * Error codes for WDK operations
 */
export enum WDKErrorCode {
  // Initialization errors (1xxx)
  WDK_NOT_REGISTERED = 1001,
  WDK_NOT_INITIALIZED = 1002,
  INVALID_SEED_PHRASE = 1003,
  WALLET_MANAGER_NOT_REGISTERED = 1004,

  // Chain errors (2xxx)
  CHAIN_NOT_CONFIGURED = 2001,
  CHAIN_NOT_SUPPORTED = 2002,
  INVALID_CHAIN_CONFIG = 2003,
  UNKNOWN_CHAIN_ID = 2004,

  // Signer errors (3xxx)
  SIGNER_NOT_INITIALIZED = 3001,
  ACCOUNT_FETCH_FAILED = 3002,
  ADDRESS_FETCH_FAILED = 3003,

  // Signing errors (4xxx)
  SIGN_TYPED_DATA_FAILED = 4001,
  SIGN_MESSAGE_FAILED = 4002,
  INVALID_TYPED_DATA = 4003,
  INVALID_MESSAGE = 4004,
  USER_REJECTED_SIGNATURE = 4005,

  // Balance errors (5xxx)
  BALANCE_FETCH_FAILED = 5001,
  TOKEN_BALANCE_FETCH_FAILED = 5002,
  INVALID_TOKEN_ADDRESS = 5003,

  // Transaction errors (6xxx)
  TRANSACTION_FAILED = 6001,
  GAS_ESTIMATION_FAILED = 6002,
  INSUFFICIENT_BALANCE = 6003,
  TRANSACTION_REVERTED = 6004,
  TRANSACTION_TIMEOUT = 6005,

  // Bridge errors (7xxx)
  BRIDGE_NOT_AVAILABLE = 7001,
  BRIDGE_NOT_SUPPORTED = 7002,
  BRIDGE_FAILED = 7003,
  INSUFFICIENT_BRIDGE_FEE = 7004,

  // RPC errors (8xxx)
  RPC_ERROR = 8001,
  RPC_TIMEOUT = 8002,
  RPC_RATE_LIMITED = 8003,
  RPC_CONNECTION_FAILED = 8004,

  // Unknown errors (9xxx)
  UNKNOWN_ERROR = 9999,
}

/**
 * Base error class for WDK operations
 */
export class WDKError extends Error {
  readonly code: WDKErrorCode;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;

  constructor(
    code: WDKErrorCode,
    message: string,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "WDKError";
    this.code = code;
    this.cause = options?.cause;
    this.context = options?.context;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WDKError);
    }
  }

  /**
   * Create a JSON-serializable representation
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return [
      WDKErrorCode.RPC_TIMEOUT,
      WDKErrorCode.RPC_RATE_LIMITED,
      WDKErrorCode.RPC_CONNECTION_FAILED,
      WDKErrorCode.BALANCE_FETCH_FAILED,
      WDKErrorCode.TOKEN_BALANCE_FETCH_FAILED,
      WDKErrorCode.GAS_ESTIMATION_FAILED,
    ].includes(this.code);
  }
}

/**
 * Error thrown when WDK is not properly initialized
 */
export class WDKInitializationError extends WDKError {
  constructor(
    message: string,
    options?: {
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(WDKErrorCode.WDK_NOT_INITIALIZED, message, options);
    this.name = "WDKInitializationError";
  }
}

/**
 * Error thrown for chain-related issues
 */
export class ChainError extends WDKError {
  readonly chain?: string;

  constructor(
    code: WDKErrorCode,
    message: string,
    options?: {
      chain?: string;
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(code, message, {
      cause: options?.cause,
      context: { ...options?.context, chain: options?.chain },
    });
    this.name = "ChainError";
    this.chain = options?.chain;
  }
}

/**
 * Error thrown for signer-related issues
 */
export class SignerError extends WDKError {
  readonly chain?: string;
  readonly address?: string;

  constructor(
    code: WDKErrorCode,
    message: string,
    options?: {
      chain?: string;
      address?: string;
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(code, message, {
      cause: options?.cause,
      context: { ...options?.context, chain: options?.chain, address: options?.address },
    });
    this.name = "SignerError";
    this.chain = options?.chain;
    this.address = options?.address;
  }
}

/**
 * Error thrown for signing operations
 */
export class SigningError extends WDKError {
  readonly operation: "signTypedData" | "signMessage";

  constructor(
    code: WDKErrorCode,
    message: string,
    options: {
      operation: "signTypedData" | "signMessage";
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(code, message, {
      cause: options.cause,
      context: { ...options.context, operation: options.operation },
    });
    this.name = "SigningError";
    this.operation = options.operation;
  }
}

/**
 * Error thrown for balance operations
 */
export class BalanceError extends WDKError {
  readonly chain?: string;
  readonly token?: string;

  constructor(
    code: WDKErrorCode,
    message: string,
    options?: {
      chain?: string;
      token?: string;
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(code, message, {
      cause: options?.cause,
      context: { ...options?.context, chain: options?.chain, token: options?.token },
    });
    this.name = "BalanceError";
    this.chain = options?.chain;
    this.token = options?.token;
  }
}

/**
 * Error thrown for transaction operations
 */
export class TransactionError extends WDKError {
  readonly chain?: string;
  readonly txHash?: string;

  constructor(
    code: WDKErrorCode,
    message: string,
    options?: {
      chain?: string;
      txHash?: string;
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(code, message, {
      cause: options?.cause,
      context: { ...options?.context, chain: options?.chain, txHash: options?.txHash },
    });
    this.name = "TransactionError";
    this.chain = options?.chain;
    this.txHash = options?.txHash;
  }
}

/**
 * Error thrown for bridge operations
 */
export class BridgeError extends WDKError {
  readonly fromChain?: string;
  readonly toChain?: string;

  constructor(
    code: WDKErrorCode,
    message: string,
    options?: {
      fromChain?: string;
      toChain?: string;
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(code, message, {
      cause: options?.cause,
      context: {
        ...options?.context,
        fromChain: options?.fromChain,
        toChain: options?.toChain,
      },
    });
    this.name = "BridgeError";
    this.fromChain = options?.fromChain;
    this.toChain = options?.toChain;
  }
}

/**
 * Error thrown for RPC-related issues
 */
export class RPCError extends WDKError {
  readonly endpoint?: string;
  readonly rpcCode?: number;

  constructor(
    code: WDKErrorCode,
    message: string,
    options?: {
      endpoint?: string;
      rpcCode?: number;
      cause?: Error;
      context?: Record<string, unknown>;
    },
  ) {
    super(code, message, {
      cause: options?.cause,
      context: {
        ...options?.context,
        endpoint: options?.endpoint,
        rpcCode: options?.rpcCode,
      },
    });
    this.name = "RPCError";
    this.endpoint = options?.endpoint;
    this.rpcCode = options?.rpcCode;
  }
}

/**
 * Wrap an unknown error into a WDKError
 */
export function wrapError(
  error: unknown,
  defaultCode: WDKErrorCode = WDKErrorCode.UNKNOWN_ERROR,
  defaultMessage = "An unknown error occurred",
  context?: Record<string, unknown>,
): WDKError {
  // Already a WDKError
  if (error instanceof WDKError) {
    return error;
  }

  // Standard Error
  if (error instanceof Error) {
    // Check for common RPC error patterns
    const msg = error.message.toLowerCase();

    if (msg.includes("timeout") || msg.includes("timed out")) {
      return new RPCError(WDKErrorCode.RPC_TIMEOUT, `Request timeout: ${error.message}`, {
        cause: error,
        context,
      });
    }

    if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("429")) {
      return new RPCError(
        WDKErrorCode.RPC_RATE_LIMITED,
        `Rate limited: ${error.message}`,
        { cause: error, context },
      );
    }

    if (
      msg.includes("connection") ||
      msg.includes("network") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound")
    ) {
      return new RPCError(
        WDKErrorCode.RPC_CONNECTION_FAILED,
        `Connection failed: ${error.message}`,
        { cause: error, context },
      );
    }

    if (msg.includes("insufficient funds") || msg.includes("insufficient balance")) {
      return new TransactionError(
        WDKErrorCode.INSUFFICIENT_BALANCE,
        `Insufficient balance: ${error.message}`,
        { cause: error, context },
      );
    }

    if (msg.includes("user rejected") || msg.includes("user denied")) {
      return new SigningError(
        WDKErrorCode.USER_REJECTED_SIGNATURE,
        "User rejected the signature request",
        { operation: "signTypedData", cause: error, context },
      );
    }

    if (msg.includes("reverted") || msg.includes("revert")) {
      return new TransactionError(
        WDKErrorCode.TRANSACTION_REVERTED,
        `Transaction reverted: ${error.message}`,
        { cause: error, context },
      );
    }

    return new WDKError(defaultCode, error.message || defaultMessage, {
      cause: error,
      context,
    });
  }

  // Unknown error type
  return new WDKError(defaultCode, String(error) || defaultMessage, { context });
}

/**
 * Type guard to check if an error is a WDKError
 */
export function isWDKError(error: unknown): error is WDKError {
  return error instanceof WDKError;
}

/**
 * Type guard to check if an error has a specific code
 */
export function hasErrorCode(error: unknown, code: WDKErrorCode): boolean {
  return isWDKError(error) && error.code === code;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBackoff: true,
};

/**
 * Execute an async function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, exponentialBackoff } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const wdkError = wrapError(error);
      if (!wdkError.isRetryable() || attempt >= maxRetries) {
        throw wdkError;
      }

      // Calculate delay with exponential backoff
      const delay = exponentialBackoff
        ? Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        : baseDelay;

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * delay * 0.1;
      await sleep(delay + jitter);
    }
  }

  throw lastError ?? new Error("Retry failed with unknown error");
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper for async operations
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation = "Operation",
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new RPCError(
          WDKErrorCode.RPC_TIMEOUT,
          `${operation} timed out after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}
