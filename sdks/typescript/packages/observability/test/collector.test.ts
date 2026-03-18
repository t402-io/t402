import { describe, it, expect, beforeEach } from "vitest";
import { PaymentEventCollector } from "../src/collector";
import type { PaymentEvent } from "../src/types";

function makeEvent(
  overrides: Partial<PaymentEvent> & { type: PaymentEvent["type"]; paymentId: string },
): PaymentEvent {
  return {
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("PaymentEventCollector", () => {
  let collector: PaymentEventCollector;

  beforeEach(() => {
    collector = new PaymentEventCollector();
  });

  describe("constructor", () => {
    it("should create with default max size", () => {
      expect(collector.size).toBe(0);
    });

    it("should accept custom max size", () => {
      const c = new PaymentEventCollector(100);
      expect(c.size).toBe(0);
    });

    it("should throw for maxSize < 1", () => {
      expect(() => new PaymentEventCollector(0)).toThrow("maxSize must be at least 1");
      expect(() => new PaymentEventCollector(-1)).toThrow("maxSize must be at least 1");
    });
  });

  describe("record", () => {
    it("should record a single event", () => {
      const event = makeEvent({ type: "payment.requested", paymentId: "p1" });
      collector.record(event);
      expect(collector.size).toBe(1);
    });

    it("should record multiple events", () => {
      collector.record(makeEvent({ type: "payment.requested", paymentId: "p1" }));
      collector.record(makeEvent({ type: "payment.signed", paymentId: "p1" }));
      collector.record(makeEvent({ type: "payment.submitted", paymentId: "p1" }));
      expect(collector.size).toBe(3);
    });
  });

  describe("ring buffer", () => {
    it("should evict oldest events when full", () => {
      const c = new PaymentEventCollector(3);
      c.record(makeEvent({ type: "payment.requested", paymentId: "p1", timestamp: 1 }));
      c.record(makeEvent({ type: "payment.signed", paymentId: "p1", timestamp: 2 }));
      c.record(makeEvent({ type: "payment.submitted", paymentId: "p1", timestamp: 3 }));
      c.record(makeEvent({ type: "payment.verified", paymentId: "p1", timestamp: 4 }));

      expect(c.size).toBe(3);
      const events = c.getEvents();
      expect(events).toHaveLength(3);
      expect(events[0].timestamp).toBe(2);
      expect(events[1].timestamp).toBe(3);
      expect(events[2].timestamp).toBe(4);
    });

    it("should maintain order after wrapping around multiple times", () => {
      const c = new PaymentEventCollector(2);
      c.record(makeEvent({ type: "payment.requested", paymentId: "p1", timestamp: 1 }));
      c.record(makeEvent({ type: "payment.signed", paymentId: "p1", timestamp: 2 }));
      c.record(makeEvent({ type: "payment.submitted", paymentId: "p1", timestamp: 3 }));
      c.record(makeEvent({ type: "payment.verified", paymentId: "p1", timestamp: 4 }));
      c.record(makeEvent({ type: "payment.settled", paymentId: "p1", timestamp: 5 }));

      const events = c.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].timestamp).toBe(4);
      expect(events[1].timestamp).toBe(5);
    });

    it("should work with maxSize of 1", () => {
      const c = new PaymentEventCollector(1);
      c.record(makeEvent({ type: "payment.requested", paymentId: "p1", timestamp: 1 }));
      c.record(makeEvent({ type: "payment.signed", paymentId: "p1", timestamp: 2 }));

      expect(c.size).toBe(1);
      expect(c.getEvents()[0].timestamp).toBe(2);
    });
  });

  describe("getEvents", () => {
    beforeEach(() => {
      collector.record(
        makeEvent({ type: "payment.requested", paymentId: "p1", network: "eip155:1", timestamp: 100 }),
      );
      collector.record(
        makeEvent({ type: "payment.signed", paymentId: "p1", network: "eip155:1", timestamp: 200 }),
      );
      collector.record(
        makeEvent({ type: "payment.requested", paymentId: "p2", network: "eip155:8453", timestamp: 300 }),
      );
      collector.record(
        makeEvent({ type: "payment.failed", paymentId: "p2", network: "eip155:8453", timestamp: 400, error: "timeout" }),
      );
    });

    it("should return all events without filter", () => {
      expect(collector.getEvents()).toHaveLength(4);
    });

    it("should filter by type", () => {
      const events = collector.getEvents({ type: "payment.requested" });
      expect(events).toHaveLength(2);
    });

    it("should filter by paymentId", () => {
      const events = collector.getEvents({ paymentId: "p2" });
      expect(events).toHaveLength(2);
    });

    it("should filter by network", () => {
      const events = collector.getEvents({ network: "eip155:8453" });
      expect(events).toHaveLength(2);
    });

    it("should filter by after timestamp", () => {
      const events = collector.getEvents({ after: 200 });
      expect(events).toHaveLength(2);
      expect(events[0].timestamp).toBe(300);
    });

    it("should filter by before timestamp", () => {
      const events = collector.getEvents({ before: 300 });
      expect(events).toHaveLength(2);
      expect(events[1].timestamp).toBe(200);
    });

    it("should filter with limit", () => {
      const events = collector.getEvents({ limit: 2 });
      expect(events).toHaveLength(2);
    });

    it("should combine multiple filters", () => {
      const events = collector.getEvents({
        type: "payment.requested",
        network: "eip155:1",
      });
      expect(events).toHaveLength(1);
      expect(events[0].paymentId).toBe("p1");
    });
  });

  describe("getMetrics", () => {
    it("should return empty metrics for no events", () => {
      const metrics = collector.getMetrics();
      expect(metrics.totalAttempted).toBe(0);
      expect(metrics.totalSuccessful).toBe(0);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.avgVerifyLatencyMs).toBe(0);
      expect(metrics.avgSettleLatencyMs).toBe(0);
    });

    it("should count attempted payments", () => {
      collector.record(makeEvent({ type: "payment.requested", paymentId: "p1" }));
      collector.record(makeEvent({ type: "payment.requested", paymentId: "p2" }));
      const metrics = collector.getMetrics();
      expect(metrics.totalAttempted).toBe(2);
    });

    it("should count successful payments", () => {
      collector.record(makeEvent({ type: "payment.requested", paymentId: "p1" }));
      collector.record(makeEvent({ type: "payment.completed", paymentId: "p1" }));
      const metrics = collector.getMetrics();
      expect(metrics.totalSuccessful).toBe(1);
    });

    it("should count failed payments", () => {
      collector.record(makeEvent({ type: "payment.requested", paymentId: "p1" }));
      collector.record(makeEvent({ type: "payment.failed", paymentId: "p1", error: "timeout" }));
      const metrics = collector.getMetrics();
      expect(metrics.totalFailed).toBe(1);
      expect(metrics.failureReasons["timeout"]).toBe(1);
    });

    it("should aggregate failure reasons", () => {
      collector.record(makeEvent({ type: "payment.failed", paymentId: "p1", error: "timeout" }));
      collector.record(makeEvent({ type: "payment.failed", paymentId: "p2", error: "timeout" }));
      collector.record(makeEvent({ type: "payment.failed", paymentId: "p3", error: "insufficient_balance" }));
      const metrics = collector.getMetrics();
      expect(metrics.failureReasons["timeout"]).toBe(2);
      expect(metrics.failureReasons["insufficient_balance"]).toBe(1);
    });

    it("should compute average verify latency", () => {
      collector.record(makeEvent({ type: "payment.submitted", paymentId: "p1", timestamp: 1000 }));
      collector.record(makeEvent({ type: "payment.verified", paymentId: "p1", timestamp: 1500 }));
      collector.record(makeEvent({ type: "payment.submitted", paymentId: "p2", timestamp: 2000 }));
      collector.record(makeEvent({ type: "payment.verified", paymentId: "p2", timestamp: 2300 }));

      const metrics = collector.getMetrics();
      expect(metrics.avgVerifyLatencyMs).toBe(400); // (500 + 300) / 2
    });

    it("should compute average settle latency", () => {
      collector.record(makeEvent({ type: "payment.verified", paymentId: "p1", timestamp: 1000 }));
      collector.record(makeEvent({ type: "payment.settled", paymentId: "p1", timestamp: 3000 }));

      const metrics = collector.getMetrics();
      expect(metrics.avgSettleLatencyMs).toBe(2000);
    });

    it("should track amounts by network", () => {
      collector.record(
        makeEvent({
          type: "payment.completed",
          paymentId: "p1",
          network: "eip155:1",
          amount: "1000000",
        }),
      );
      collector.record(
        makeEvent({
          type: "payment.completed",
          paymentId: "p2",
          network: "eip155:1",
          amount: "2000000",
        }),
      );
      collector.record(
        makeEvent({
          type: "payment.completed",
          paymentId: "p3",
          network: "eip155:8453",
          amount: "500000",
        }),
      );

      const metrics = collector.getMetrics();
      expect(metrics.amountByNetwork["eip155:1"]).toBe(3000000n);
      expect(metrics.amountByNetwork["eip155:8453"]).toBe(500000n);
    });

    it("should track counts by network", () => {
      collector.record(makeEvent({ type: "payment.completed", paymentId: "p1", network: "eip155:1" }));
      collector.record(makeEvent({ type: "payment.completed", paymentId: "p2", network: "eip155:1" }));
      collector.record(makeEvent({ type: "payment.completed", paymentId: "p3", network: "eip155:8453" }));

      const metrics = collector.getMetrics();
      expect(metrics.countByNetwork["eip155:1"]).toBe(2);
      expect(metrics.countByNetwork["eip155:8453"]).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all events", () => {
      collector.record(makeEvent({ type: "payment.requested", paymentId: "p1" }));
      collector.record(makeEvent({ type: "payment.signed", paymentId: "p1" }));
      collector.clear();
      expect(collector.size).toBe(0);
      expect(collector.getEvents()).toHaveLength(0);
    });

    it("should allow recording after clear", () => {
      collector.record(makeEvent({ type: "payment.requested", paymentId: "p1" }));
      collector.clear();
      collector.record(makeEvent({ type: "payment.requested", paymentId: "p2" }));
      expect(collector.size).toBe(1);
      expect(collector.getEvents()[0].paymentId).toBe("p2");
    });
  });
});
