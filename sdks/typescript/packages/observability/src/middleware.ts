import type { PaymentEvent, PaymentEventType } from "./types";
import type { PaymentEventCollector } from "./collector";

/**
 * A generic T402 client interface that the observability middleware wraps.
 *
 * This loosely typed interface avoids a hard dependency on specific client
 * implementations while enabling auto-instrumentation of payment flows.
 */
export interface ObservableClient {
  /** Send a payment request and receive requirements */
  request?: (...args: unknown[]) => Promise<unknown>;
  /** Sign a payment */
  sign?: (...args: unknown[]) => Promise<unknown>;
  /** Submit a signed payment */
  submit?: (...args: unknown[]) => Promise<unknown>;
  /** Verify a payment */
  verify?: (...args: unknown[]) => Promise<unknown>;
  /** Settle a payment */
  settle?: (...args: unknown[]) => Promise<unknown>;
  [key: string]: unknown;
}

/**
 * Options for the observability middleware.
 */
export interface ObservabilityOptions {
  /** Function to extract a payment ID from method arguments */
  extractPaymentId?: (...args: unknown[]) => string;
  /** Function to extract network from method arguments or results */
  extractNetwork?: (result: unknown) => string | undefined;
  /** Function to extract amount from method arguments or results */
  extractAmount?: (result: unknown) => string | undefined;
  /** Additional metadata to include on every event */
  defaultMetadata?: Record<string, unknown>;
}

/** Maps client methods to payment event types */
const METHOD_EVENT_MAP: Record<string, [PaymentEventType, PaymentEventType?]> = {
  request: ["payment.requested", "payment.requirements"],
  sign: ["payment.signed"],
  submit: ["payment.submitted"],
  verify: ["payment.verified"],
  settle: ["payment.settled"],
};

let idCounter = 0;

/**
 * Generate a simple unique payment ID.
 */
function generatePaymentId(): string {
  return `pay_${Date.now()}_${++idCounter}`;
}

/**
 * Wraps a T402 client to automatically record payment events.
 *
 * Intercepts known payment methods (request, sign, submit, verify, settle)
 * and records corresponding events to the provided collector. Failed
 * method calls automatically record a `payment.failed` event.
 *
 * @param client - The T402 client to wrap
 * @param collector - The event collector to record events to
 * @param options - Optional configuration
 * @returns A proxied client that auto-records payment events
 */
export function withObservability<T extends ObservableClient>(
  client: T,
  collector: PaymentEventCollector,
  options?: ObservabilityOptions,
): T {
  const flowTimestamps = new Map<string, number>();

  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      const methodName = typeof prop === "string" ? prop : undefined;

      if (!methodName || typeof value !== "function" || !METHOD_EVENT_MAP[methodName]) {
        return value;
      }

      const [startEvent, successEvent] = METHOD_EVENT_MAP[methodName];

      return async (...args: unknown[]) => {
        const paymentId = options?.extractPaymentId?.(...args) ?? generatePaymentId();
        const now = Date.now();
        const lastTimestamp = flowTimestamps.get(paymentId);
        const durationMs = lastTimestamp ? now - lastTimestamp : undefined;

        // Record the start event
        const event: PaymentEvent = {
          type: startEvent,
          timestamp: now,
          paymentId,
          durationMs,
          metadata: options?.defaultMetadata,
        };
        collector.record(event);
        flowTimestamps.set(paymentId, now);

        try {
          const result = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);

          // Record the success event if there is one (e.g., request -> requirements)
          if (successEvent) {
            const successNow = Date.now();
            const successEvt: PaymentEvent = {
              type: successEvent,
              timestamp: successNow,
              paymentId,
              durationMs: successNow - now,
              network: options?.extractNetwork?.(result),
              amount: options?.extractAmount?.(result),
              metadata: options?.defaultMetadata,
            };
            collector.record(successEvt);
            flowTimestamps.set(paymentId, successNow);
          }

          // If this is the settle step, also record completed
          if (methodName === "settle") {
            const completeNow = Date.now();
            const completedEvt: PaymentEvent = {
              type: "payment.completed",
              timestamp: completeNow,
              paymentId,
              durationMs: completeNow - now,
              network: options?.extractNetwork?.(result),
              amount: options?.extractAmount?.(result),
              metadata: options?.defaultMetadata,
            };
            collector.record(completedEvt);
            flowTimestamps.delete(paymentId);
          }

          return result;
        } catch (err) {
          const failNow = Date.now();
          const errorMessage = err instanceof Error ? err.message : String(err);
          const failedEvt: PaymentEvent = {
            type: "payment.failed",
            timestamp: failNow,
            paymentId,
            durationMs: failNow - now,
            error: errorMessage,
            metadata: options?.defaultMetadata,
          };
          collector.record(failedEvt);
          flowTimestamps.delete(paymentId);
          throw err;
        }
      };
    },
  });
}
