import { describe, it, expect, vi } from "vitest";
import { PaymentLifecycleEmitter } from "../src/lifecycle";
import type { PaymentLifecycleEventUnion } from "../src/types";
import type { Network } from "@t402/core/types";

function makeEvent(
  type: PaymentLifecycleEventUnion["type"],
  extra: Record<string, unknown> = {},
): PaymentLifecycleEventUnion {
  return {
    type,
    timestamp: new Date().toISOString(),
    payload: {
      t402Version: 2,
      accepted: {
        scheme: "exact",
        network: "eip155:8453" as Network,
        asset: "0xUSDC",
        amount: "100000",
        payTo: "0xRecipient",
        maxTimeoutSeconds: 60,
        extra: {},
      },
      payload: { signature: "0xabc" },
    },
    requirements: {
      scheme: "exact",
      network: "eip155:8453" as Network,
      asset: "0xUSDC",
      amount: "100000",
      payTo: "0xRecipient",
      maxTimeoutSeconds: 60,
      extra: {},
    },
    ...extra,
  } as PaymentLifecycleEventUnion;
}

describe("PaymentLifecycleEmitter", () => {
  describe("emit and on", () => {
    it("should dispatch events to type-specific listeners", () => {
      const emitter = new PaymentLifecycleEmitter();
      const listener = vi.fn();

      emitter.on("payment.received", listener);
      const event = makeEvent("payment.received");
      emitter.emit(event);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(event);
    });

    it("should not dispatch events to wrong type listeners", () => {
      const emitter = new PaymentLifecycleEmitter();
      const listener = vi.fn();

      emitter.on("payment.settled", listener);
      emitter.emit(makeEvent("payment.received"));

      expect(listener).not.toHaveBeenCalled();
    });

    it("should dispatch to multiple listeners for the same type", () => {
      const emitter = new PaymentLifecycleEmitter();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.on("payment.verifying", listener1);
      emitter.on("payment.verifying", listener2);
      emitter.emit(makeEvent("payment.verifying"));

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });
  });

  describe("onAll", () => {
    it("should dispatch all events to catch-all listeners", () => {
      const emitter = new PaymentLifecycleEmitter();
      const listener = vi.fn();

      emitter.onAll(listener);
      emitter.emit(makeEvent("payment.received"));
      emitter.emit(makeEvent("payment.verified"));
      emitter.emit(makeEvent("payment.settled"));

      expect(listener).toHaveBeenCalledTimes(3);
    });

    it("should dispatch to both type-specific and catch-all listeners", () => {
      const emitter = new PaymentLifecycleEmitter();
      const typeListener = vi.fn();
      const allListener = vi.fn();

      emitter.on("payment.received", typeListener);
      emitter.onAll(allListener);
      emitter.emit(makeEvent("payment.received"));

      expect(typeListener).toHaveBeenCalledOnce();
      expect(allListener).toHaveBeenCalledOnce();
    });
  });

  describe("off", () => {
    it("should remove a type-specific listener", () => {
      const emitter = new PaymentLifecycleEmitter();
      const listener = vi.fn();

      emitter.on("payment.received", listener);
      emitter.off("payment.received", listener);
      emitter.emit(makeEvent("payment.received"));

      expect(listener).not.toHaveBeenCalled();
    });

    it("should not affect other listeners when removing one", () => {
      const emitter = new PaymentLifecycleEmitter();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter.on("payment.received", listener1);
      emitter.on("payment.received", listener2);
      emitter.off("payment.received", listener1);
      emitter.emit(makeEvent("payment.received"));

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledOnce();
    });
  });

  describe("offAll", () => {
    it("should remove a catch-all listener", () => {
      const emitter = new PaymentLifecycleEmitter();
      const listener = vi.fn();

      emitter.onAll(listener);
      emitter.offAll(listener);
      emitter.emit(makeEvent("payment.received"));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("history", () => {
    it("should record emitted events", () => {
      const emitter = new PaymentLifecycleEmitter();

      emitter.emit(makeEvent("payment.received"));
      emitter.emit(makeEvent("payment.verified"));

      const history = emitter.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe("payment.received");
      expect(history[1].type).toBe("payment.verified");
    });

    it("should respect maxHistorySize", () => {
      const emitter = new PaymentLifecycleEmitter(3);

      emitter.emit(makeEvent("payment.received"));
      emitter.emit(makeEvent("payment.verifying"));
      emitter.emit(makeEvent("payment.verified"));
      emitter.emit(makeEvent("payment.settling"));

      const history = emitter.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].type).toBe("payment.verifying");
      expect(history[2].type).toBe("payment.settling");
    });

    it("should return a copy of history", () => {
      const emitter = new PaymentLifecycleEmitter();
      emitter.emit(makeEvent("payment.received"));

      const history1 = emitter.getHistory();
      const history2 = emitter.getHistory();
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });

    it("should clear history", () => {
      const emitter = new PaymentLifecycleEmitter();
      emitter.emit(makeEvent("payment.received"));
      emitter.emit(makeEvent("payment.verified"));

      emitter.clearHistory();
      expect(emitter.getHistory()).toHaveLength(0);
    });
  });

  describe("listenerCount", () => {
    it("should count type-specific and catch-all listeners", () => {
      const emitter = new PaymentLifecycleEmitter();

      emitter.on("payment.received", vi.fn());
      emitter.on("payment.received", vi.fn());
      emitter.onAll(vi.fn());

      // Type-specific count includes catch-all listeners
      expect(emitter.listenerCount("payment.received")).toBe(3);
      // Catch-all only
      expect(emitter.listenerCount()).toBe(1);
    });
  });

  describe("removeAllListeners", () => {
    it("should remove all listeners and clear history", () => {
      const emitter = new PaymentLifecycleEmitter();
      const listener = vi.fn();

      emitter.on("payment.received", listener);
      emitter.onAll(listener);
      emitter.emit(makeEvent("payment.received"));

      // Listener called twice: once for type, once for all
      expect(listener).toHaveBeenCalledTimes(2);

      emitter.removeAllListeners();

      // History should be cleared
      expect(emitter.getHistory()).toHaveLength(0);

      // Emitting after removal should not call the listener
      listener.mockClear();
      emitter.emit(makeEvent("payment.received"));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should swallow listener errors without breaking emission", () => {
      const emitter = new PaymentLifecycleEmitter();
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error("listener error");
      });
      const goodListener = vi.fn();

      emitter.on("payment.received", errorListener);
      emitter.on("payment.received", goodListener);

      // Should not throw
      expect(() => emitter.emit(makeEvent("payment.received"))).not.toThrow();
      expect(errorListener).toHaveBeenCalledOnce();
      expect(goodListener).toHaveBeenCalledOnce();
    });
  });

  describe("formatSSE", () => {
    it("should format events as SSE strings", () => {
      const event = makeEvent("payment.received");
      const sse = PaymentLifecycleEmitter.formatSSE(event);

      expect(sse).toContain("event: payment.received\n");
      expect(sse).toContain("data: ");
      expect(sse).toContain('"type":"payment.received"');
      expect(sse.endsWith("\n\n")).toBe(true);
    });

    it("should produce valid JSON in the data field", () => {
      const event = makeEvent("payment.settled", {
        result: {
          success: true,
          transaction: "0xtx",
          network: "eip155:8453",
        },
      });
      const sse = PaymentLifecycleEmitter.formatSSE(event);
      const dataLine = sse.split("\n").find(line => line.startsWith("data: "));
      const json = dataLine!.substring(6);
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });
});
