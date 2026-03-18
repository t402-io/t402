/** Payment event types for observability */
export type PaymentEventType =
  | "payment.requested" // Client sends 402 request
  | "payment.requirements" // Server returns 402 requirements
  | "payment.signed" // Client signs payment
  | "payment.submitted" // Client submits payment
  | "payment.verified" // Facilitator verifies
  | "payment.settled" // Facilitator settles on-chain
  | "payment.completed" // Full flow complete
  | "payment.failed"; // Any step failed

export interface PaymentEvent {
  type: PaymentEventType;
  timestamp: number;
  /** Unique payment flow ID */
  paymentId: string;
  /** CAIP-2 network */
  network?: string;
  /** Payment scheme */
  scheme?: string;
  /** Amount in smallest unit */
  amount?: string;
  /** Payer address */
  payer?: string;
  /** Recipient address */
  payTo?: string;
  /** Transaction hash */
  transaction?: string;
  /** Duration from previous event in ms */
  durationMs?: number;
  /** Error details if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface PaymentMetrics {
  /** Total payments attempted */
  totalAttempted: number;
  /** Total successful payments */
  totalSuccessful: number;
  /** Total failed payments */
  totalFailed: number;
  /** Average verification latency (ms) */
  avgVerifyLatencyMs: number;
  /** Average settlement latency (ms) */
  avgSettleLatencyMs: number;
  /** Total amount paid (by network) */
  amountByNetwork: Record<string, bigint>;
  /** Payment count by network */
  countByNetwork: Record<string, number>;
  /** Failure reasons */
  failureReasons: Record<string, number>;
}

/** Filter criteria for querying events */
export interface PaymentEventFilter {
  /** Filter by event type */
  type?: PaymentEventType;
  /** Filter by payment ID */
  paymentId?: string;
  /** Filter by network */
  network?: string;
  /** Filter events after this timestamp */
  after?: number;
  /** Filter events before this timestamp */
  before?: number;
  /** Maximum number of events to return */
  limit?: number;
}
