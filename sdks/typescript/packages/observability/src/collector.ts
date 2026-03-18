import type { PaymentEvent, PaymentEventFilter, PaymentMetrics } from "./types";

/**
 * Default maximum number of events retained in the ring buffer.
 */
const DEFAULT_MAX_SIZE = 10_000;

/**
 * Collects payment events and computes aggregate metrics.
 *
 * Uses an in-memory ring buffer with configurable maximum size.
 * When the buffer is full, the oldest events are discarded.
 */
export class PaymentEventCollector {
  private buffer: PaymentEvent[];
  private head: number;
  private count: number;
  private readonly maxSize: number;

  /**
   * Create a new PaymentEventCollector.
   *
   * @param maxSize - Maximum number of events to retain (default: 10000)
   */
  constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    if (maxSize < 1) {
      throw new Error("maxSize must be at least 1");
    }
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
    this.head = 0;
    this.count = 0;
  }

  /**
   * Record a payment event.
   *
   * @param event - The payment event to record
   */
  record(event: PaymentEvent): void {
    this.buffer[this.head] = event;
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) {
      this.count++;
    }
  }

  /**
   * Get all recorded events in chronological order, optionally filtered.
   *
   * @param filter - Optional filter criteria
   * @returns Array of matching events
   */
  getEvents(filter?: PaymentEventFilter): PaymentEvent[] {
    let events = this.getAllEventsOrdered();

    if (!filter) {
      return events;
    }

    if (filter.type) {
      events = events.filter((e) => e.type === filter.type);
    }
    if (filter.paymentId) {
      events = events.filter((e) => e.paymentId === filter.paymentId);
    }
    if (filter.network) {
      events = events.filter((e) => e.network === filter.network);
    }
    if (filter.after !== undefined) {
      events = events.filter((e) => e.timestamp > filter.after!);
    }
    if (filter.before !== undefined) {
      events = events.filter((e) => e.timestamp < filter.before!);
    }
    if (filter.limit !== undefined && filter.limit > 0) {
      events = events.slice(0, filter.limit);
    }

    return events;
  }

  /**
   * Compute aggregate metrics from all collected events.
   *
   * @returns Computed payment metrics
   */
  getMetrics(): PaymentMetrics {
    const events = this.getAllEventsOrdered();

    const metrics: PaymentMetrics = {
      totalAttempted: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      avgVerifyLatencyMs: 0,
      avgSettleLatencyMs: 0,
      amountByNetwork: {},
      countByNetwork: {},
      failureReasons: {},
    };

    // Group events by paymentId for latency calculations
    const flowEvents = new Map<string, PaymentEvent[]>();
    for (const event of events) {
      if (!flowEvents.has(event.paymentId)) {
        flowEvents.set(event.paymentId, []);
      }
      flowEvents.get(event.paymentId)!.push(event);
    }

    let verifyLatencySum = 0;
    let verifyLatencyCount = 0;
    let settleLatencySum = 0;
    let settleLatencyCount = 0;

    for (const [, flowEvts] of flowEvents) {
      const hasRequested = flowEvts.some((e) => e.type === "payment.requested");
      const hasCompleted = flowEvts.some((e) => e.type === "payment.completed");
      const hasFailed = flowEvts.some((e) => e.type === "payment.failed");

      if (hasRequested) {
        metrics.totalAttempted++;
      }
      if (hasCompleted) {
        metrics.totalSuccessful++;
      }
      if (hasFailed) {
        metrics.totalFailed++;
        // Collect failure reasons
        for (const evt of flowEvts) {
          if (evt.type === "payment.failed" && evt.error) {
            metrics.failureReasons[evt.error] = (metrics.failureReasons[evt.error] ?? 0) + 1;
          }
        }
      }

      // Compute verify latency: submitted -> verified
      const submitted = flowEvts.find((e) => e.type === "payment.submitted");
      const verified = flowEvts.find((e) => e.type === "payment.verified");
      if (submitted && verified) {
        verifyLatencySum += verified.timestamp - submitted.timestamp;
        verifyLatencyCount++;
      }

      // Compute settle latency: verified -> settled
      const settled = flowEvts.find((e) => e.type === "payment.settled");
      if (verified && settled) {
        settleLatencySum += settled.timestamp - verified.timestamp;
        settleLatencyCount++;
      }

      // Track amounts and counts by network
      const completedEvt = flowEvts.find((e) => e.type === "payment.completed");
      if (completedEvt?.network) {
        const network = completedEvt.network;
        metrics.countByNetwork[network] = (metrics.countByNetwork[network] ?? 0) + 1;
        if (completedEvt.amount) {
          const currentAmount = metrics.amountByNetwork[network] ?? 0n;
          metrics.amountByNetwork[network] = currentAmount + BigInt(completedEvt.amount);
        }
      }
    }

    metrics.avgVerifyLatencyMs = verifyLatencyCount > 0 ? verifyLatencySum / verifyLatencyCount : 0;
    metrics.avgSettleLatencyMs = settleLatencyCount > 0 ? settleLatencySum / settleLatencyCount : 0;

    return metrics;
  }

  /**
   * Get the number of events currently stored.
   */
  get size(): number {
    return this.count;
  }

  /**
   * Clear all recorded events.
   */
  clear(): void {
    this.buffer = new Array(this.maxSize);
    this.head = 0;
    this.count = 0;
  }

  /**
   * Get all events in chronological order from the ring buffer.
   */
  private getAllEventsOrdered(): PaymentEvent[] {
    if (this.count === 0) {
      return [];
    }

    const result: PaymentEvent[] = [];
    const start = this.count < this.maxSize ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.maxSize;
      result.push(this.buffer[idx]);
    }
    return result;
  }
}
