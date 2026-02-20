/**
 * Structured logging for @t402/wdk
 *
 * Provides a pluggable logger interface with console and noop implementations.
 */

/**
 * Logger interface for T402 WDK operations.
 *
 * Accepts an optional context object for structured metadata.
 */
export interface T402Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void
  info(msg: string, ctx?: Record<string, unknown>): void
  warn(msg: string, ctx?: Record<string, unknown>): void
  error(msg: string, ctx?: Record<string, unknown>): void
}

/**
 * Console-based logger that outputs structured JSON context.
 */
export const defaultLogger: T402Logger = {
  debug(msg, ctx) {
    if (ctx && Object.keys(ctx).length > 0) {
      console.debug(`[t402] ${msg}`, ctx)
    } else {
      console.debug(`[t402] ${msg}`)
    }
  },
  info(msg, ctx) {
    if (ctx && Object.keys(ctx).length > 0) {
      console.info(`[t402] ${msg}`, ctx)
    } else {
      console.info(`[t402] ${msg}`)
    }
  },
  warn(msg, ctx) {
    if (ctx && Object.keys(ctx).length > 0) {
      console.warn(`[t402] ${msg}`, ctx)
    } else {
      console.warn(`[t402] ${msg}`)
    }
  },
  error(msg, ctx) {
    if (ctx && Object.keys(ctx).length > 0) {
      console.error(`[t402] ${msg}`, ctx)
    } else {
      console.error(`[t402] ${msg}`)
    }
  },
}

/**
 * Silent logger that discards all messages.
 */
export const noopLogger: T402Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
}

/**
 * Create a correlation ID for tracing operations across calls.
 *
 * Returns a compact random hex string suitable for log correlation.
 */
export function createCorrelationId(): string {
  const bytes = new Uint8Array(8)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Metric callback signature for observability hooks.
 */
export type MetricCallback = (name: string, value: number, tags?: Record<string, string>) => void
