import type { VerifyResponse, SettleResponse, PaymentPayload, PaymentRequirements } from "@t402/core/types";

/**
 * Handler for a specific payment scheme, responsible for verifying and settling payments.
 */
export interface SchemeHandler {
  /**
   * Verify a payment payload against requirements.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements to verify against
   * @returns Promise resolving to the verification response
   */
  verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;

  /**
   * Settle a payment based on payload and requirements.
   *
   * @param payload - The payment payload to settle
   * @param requirements - The payment requirements for settlement
   * @returns Promise resolving to the settlement response
   */
  settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
}

/**
 * Configuration for creating an EmbeddedFacilitator instance.
 */
export interface EmbeddedFacilitatorConfig {
  /**
   * Registered scheme handlers, keyed by pattern string.
   * Patterns can be:
   * - Exact: "exact:eip155:8453" (scheme:network)
   * - Wildcard: "exact:eip155:*" (scheme:family:*)
   */
  schemes: Map<string, SchemeHandler>;

  /**
   * Optional API key for authentication when exposing /verify /settle externally.
   */
  apiKey?: string;
}

/**
 * Payment lifecycle event types emitted during payment processing.
 */
export type PaymentLifecycleEventType =
  | "payment.received"
  | "payment.verifying"
  | "payment.verified"
  | "payment.settling"
  | "payment.settled"
  | "payment.failed";

/**
 * Base interface for all payment lifecycle events.
 */
export interface PaymentLifecycleEvent {
  /**
   * The type of lifecycle event.
   */
  type: PaymentLifecycleEventType;

  /**
   * ISO 8601 timestamp when the event occurred.
   */
  timestamp: string;

  /**
   * The payment payload associated with this event.
   */
  payload: PaymentPayload;

  /**
   * The payment requirements associated with this event.
   */
  requirements: PaymentRequirements;
}

/**
 * Event emitted when a payment has been received.
 */
export interface PaymentReceivedEvent extends PaymentLifecycleEvent {
  /**
   * Event type discriminator.
   */
  type: "payment.received";
}

/**
 * Event emitted when payment verification begins.
 */
export interface PaymentVerifyingEvent extends PaymentLifecycleEvent {
  /**
   * Event type discriminator.
   */
  type: "payment.verifying";
}

/**
 * Event emitted after successful verification.
 */
export interface PaymentVerifiedEvent extends PaymentLifecycleEvent {
  /**
   * Event type discriminator.
   */
  type: "payment.verified";

  /**
   * The verification result.
   */
  result: VerifyResponse;
}

/**
 * Event emitted when settlement begins.
 */
export interface PaymentSettlingEvent extends PaymentLifecycleEvent {
  /**
   * Event type discriminator.
   */
  type: "payment.settling";
}

/**
 * Event emitted after successful settlement.
 */
export interface PaymentSettledEvent extends PaymentLifecycleEvent {
  /**
   * Event type discriminator.
   */
  type: "payment.settled";

  /**
   * The settlement result.
   */
  result: SettleResponse;
}

/**
 * Event emitted when payment processing fails at any stage.
 */
export interface PaymentFailedEvent extends PaymentLifecycleEvent {
  /**
   * Event type discriminator.
   */
  type: "payment.failed";

  /**
   * The error that caused the failure.
   */
  error: string;

  /**
   * The phase during which the failure occurred.
   */
  phase: "verification" | "settlement";
}

/**
 * Union type of all concrete lifecycle event types.
 */
export type PaymentLifecycleEventUnion =
  | PaymentReceivedEvent
  | PaymentVerifyingEvent
  | PaymentVerifiedEvent
  | PaymentSettlingEvent
  | PaymentSettledEvent
  | PaymentFailedEvent;

/**
 * Listener function for payment lifecycle events.
 */
export type PaymentLifecycleListener = (event: PaymentLifecycleEventUnion) => void;

/**
 * Options for the embedded payment middleware.
 */
export interface EmbeddedMiddlewareOptions {
  /**
   * Function to extract payment payload from the request.
   * Receives the request object and returns the parsed payment payload, or null if no payment is present.
   */
  extractPayload: (req: GenericRequest) => PaymentPayload | null;

  /**
   * Function to determine the payment requirements for a request.
   * Returns null if the route does not require payment.
   */
  getRequirements: (req: GenericRequest) => PaymentRequirements | null;

  /**
   * Optional lifecycle emitter for observing payment events.
   */
  lifecycle?: PaymentLifecycleEmitterInterface;

  /**
   * Whether to settle payments automatically after verification (default: true).
   */
  autoSettle?: boolean;
}

/**
 * Generic HTTP request interface for framework-agnostic middleware.
 */
export interface GenericRequest {
  /**
   * The request path.
   */
  path: string;

  /**
   * The HTTP method.
   */
  method: string;

  /**
   * Function to retrieve a header value by name.
   *
   * @param name - The header name
   * @returns The header value or undefined
   */
  header(name: string): string | undefined;

  /**
   * The parsed request body, if available.
   */
  body?: unknown;
}

/**
 * Generic HTTP response interface for framework-agnostic middleware.
 */
export interface GenericResponse {
  /**
   * Set the HTTP status code.
   *
   * @param code - The status code
   * @returns The response object for chaining
   */
  status(code: number): GenericResponse;

  /**
   * Send a JSON response body.
   *
   * @param body - The JSON body to send
   * @returns The response object for chaining
   */
  json(body: unknown): GenericResponse;

  /**
   * Set a response header.
   *
   * @param name - The header name
   * @param value - The header value
   * @returns The response object for chaining
   */
  setHeader(name: string, value: string): GenericResponse;
}

/**
 * Next function to pass control to the next middleware.
 */
export type NextFunction = () => void;

/**
 * Interface for the PaymentLifecycleEmitter to allow dependency injection.
 */
export interface PaymentLifecycleEmitterInterface {
  /**
   * Emit a payment lifecycle event to all registered listeners.
   *
   * @param event - The lifecycle event to emit
   */
  emit(event: PaymentLifecycleEventUnion): void;

  /**
   * Register a listener for a specific event type.
   *
   * @param type - The event type to listen for
   * @param listener - The listener function
   */
  on(type: PaymentLifecycleEventType, listener: PaymentLifecycleListener): void;

  /**
   * Remove a listener for a specific event type.
   *
   * @param type - The event type
   * @param listener - The listener function to remove
   */
  off(type: PaymentLifecycleEventType, listener: PaymentLifecycleListener): void;
}
