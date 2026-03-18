import { describe, it, expect, beforeEach, vi } from "vitest";
import { PaymentTracer } from "../src/tracer";

describe("PaymentTracer", () => {
  let tracer: PaymentTracer;

  beforeEach(() => {
    tracer = new PaymentTracer();
  });

  describe("startFlow", () => {
    it("should create a new flow", () => {
      const flow = tracer.startFlow("p1");
      expect(flow.paymentId).toBe("p1");
      expect(flow.events).toHaveLength(0);
      expect(flow.endTime).toBeUndefined();
      expect(flow.success).toBeUndefined();
    });

    it("should accept metadata", () => {
      const flow = tracer.startFlow("p1", { source: "api" });
      expect(flow.metadata).toEqual({ source: "api" });
    });

    it("should throw for duplicate flow ID", () => {
      tracer.startFlow("p1");
      expect(() => tracer.startFlow("p1")).toThrow("Flow already exists: p1");
    });

    it("should set start time", () => {
      const before = Date.now();
      const flow = tracer.startFlow("p1");
      const after = Date.now();
      expect(flow.startTime).toBeGreaterThanOrEqual(before);
      expect(flow.startTime).toBeLessThanOrEqual(after);
    });
  });

  describe("recordStep", () => {
    it("should record a step event", () => {
      tracer.startFlow("p1");
      const event = tracer.recordStep("p1", "payment.requested");
      expect(event.type).toBe("payment.requested");
      expect(event.paymentId).toBe("p1");
      expect(event.durationMs).toBeDefined();
    });

    it("should throw for unknown flow", () => {
      expect(() => tracer.recordStep("unknown", "payment.requested")).toThrow(
        "Flow not found: unknown",
      );
    });

    it("should compute duration from flow start for first step", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(1000);
        tracer.startFlow("p1");
        vi.setSystemTime(1050);
        const event = tracer.recordStep("p1", "payment.requested");
        expect(event.durationMs).toBe(50);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should compute duration from previous step", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(1000);
        tracer.startFlow("p1");
        vi.setSystemTime(1100);
        tracer.recordStep("p1", "payment.requested");
        vi.setSystemTime(1300);
        const event = tracer.recordStep("p1", "payment.signed");
        expect(event.durationMs).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should include additional data", () => {
      tracer.startFlow("p1");
      const event = tracer.recordStep("p1", "payment.submitted", {
        network: "eip155:1",
        amount: "1000000",
      });
      expect(event.network).toBe("eip155:1");
      expect(event.amount).toBe("1000000");
    });

    it("should accumulate events on the flow", () => {
      tracer.startFlow("p1");
      tracer.recordStep("p1", "payment.requested");
      tracer.recordStep("p1", "payment.signed");
      tracer.recordStep("p1", "payment.submitted");
      const flow = tracer.getFlow("p1");
      expect(flow?.events).toHaveLength(3);
    });
  });

  describe("endFlow", () => {
    it("should mark flow as successful", () => {
      tracer.startFlow("p1");
      tracer.recordStep("p1", "payment.requested");
      const event = tracer.endFlow("p1", true);
      expect(event.type).toBe("payment.completed");
      const flow = tracer.getFlow("p1");
      expect(flow?.success).toBe(true);
      expect(flow?.endTime).toBeDefined();
    });

    it("should mark flow as failed with error", () => {
      tracer.startFlow("p1");
      tracer.recordStep("p1", "payment.requested");
      const event = tracer.endFlow("p1", false, "insufficient_balance");
      expect(event.type).toBe("payment.failed");
      expect(event.error).toBe("insufficient_balance");
      const flow = tracer.getFlow("p1");
      expect(flow?.success).toBe(false);
    });

    it("should throw for unknown flow", () => {
      expect(() => tracer.endFlow("unknown", true)).toThrow("Flow not found: unknown");
    });

    it("should compute duration from last step", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(1000);
        tracer.startFlow("p1");
        vi.setSystemTime(1200);
        tracer.recordStep("p1", "payment.requested");
        vi.setSystemTime(1500);
        const event = tracer.endFlow("p1", true);
        expect(event.durationMs).toBe(300);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("getFlow", () => {
    it("should return undefined for unknown flow", () => {
      expect(tracer.getFlow("unknown")).toBeUndefined();
    });

    it("should return the flow", () => {
      tracer.startFlow("p1");
      const flow = tracer.getFlow("p1");
      expect(flow?.paymentId).toBe("p1");
    });
  });

  describe("getAllFlows", () => {
    it("should return all flows", () => {
      tracer.startFlow("p1");
      tracer.startFlow("p2");
      expect(tracer.getAllFlows()).toHaveLength(2);
    });

    it("should return empty array when no flows", () => {
      expect(tracer.getAllFlows()).toHaveLength(0);
    });
  });

  describe("getFlowEvents", () => {
    it("should return events for a flow", () => {
      tracer.startFlow("p1");
      tracer.recordStep("p1", "payment.requested");
      tracer.recordStep("p1", "payment.signed");
      const events = tracer.getFlowEvents("p1");
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe("payment.requested");
      expect(events[1].type).toBe("payment.signed");
    });

    it("should return empty array for unknown flow", () => {
      expect(tracer.getFlowEvents("unknown")).toHaveLength(0);
    });

    it("should return a copy of the events array", () => {
      tracer.startFlow("p1");
      tracer.recordStep("p1", "payment.requested");
      const events1 = tracer.getFlowEvents("p1");
      const events2 = tracer.getFlowEvents("p1");
      expect(events1).not.toBe(events2);
      expect(events1).toEqual(events2);
    });
  });

  describe("getFlowDuration", () => {
    it("should return undefined for unknown flow", () => {
      expect(tracer.getFlowDuration("unknown")).toBeUndefined();
    });

    it("should return undefined for unfinished flow", () => {
      tracer.startFlow("p1");
      expect(tracer.getFlowDuration("p1")).toBeUndefined();
    });

    it("should return duration for completed flow", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(1000);
        tracer.startFlow("p1");
        vi.setSystemTime(1500);
        tracer.endFlow("p1", true);
        expect(tracer.getFlowDuration("p1")).toBe(500);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("removeFlow", () => {
    it("should remove an existing flow", () => {
      tracer.startFlow("p1");
      expect(tracer.removeFlow("p1")).toBe(true);
      expect(tracer.getFlow("p1")).toBeUndefined();
    });

    it("should return false for unknown flow", () => {
      expect(tracer.removeFlow("unknown")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all flows", () => {
      tracer.startFlow("p1");
      tracer.startFlow("p2");
      tracer.clear();
      expect(tracer.size).toBe(0);
      expect(tracer.getAllFlows()).toHaveLength(0);
    });
  });

  describe("size", () => {
    it("should reflect number of flows", () => {
      expect(tracer.size).toBe(0);
      tracer.startFlow("p1");
      expect(tracer.size).toBe(1);
      tracer.startFlow("p2");
      expect(tracer.size).toBe(2);
    });
  });

  describe("multi-step flow integration", () => {
    it("should track a complete payment flow", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(1000);
        tracer.startFlow("p1", { resource: "/api/data" });

        vi.setSystemTime(1010);
        tracer.recordStep("p1", "payment.requested");

        vi.setSystemTime(1050);
        tracer.recordStep("p1", "payment.requirements", { network: "eip155:8453", scheme: "exact" });

        vi.setSystemTime(1100);
        tracer.recordStep("p1", "payment.signed", { payer: "0xabc" });

        vi.setSystemTime(1150);
        tracer.recordStep("p1", "payment.submitted");

        vi.setSystemTime(1400);
        tracer.recordStep("p1", "payment.verified");

        vi.setSystemTime(1800);
        tracer.recordStep("p1", "payment.settled", { transaction: "0xdef" });

        vi.setSystemTime(1810);
        tracer.endFlow("p1", true);

        const flow = tracer.getFlow("p1")!;
        expect(flow.events).toHaveLength(7); // 6 steps + 1 end
        expect(flow.success).toBe(true);
        expect(tracer.getFlowDuration("p1")).toBe(810);
        expect(flow.metadata).toEqual({ resource: "/api/data" });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
