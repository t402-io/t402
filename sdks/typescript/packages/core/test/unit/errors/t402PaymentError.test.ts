import { describe, it, expect } from "vitest";
import { T402PaymentError } from "../../../src/errors";

describe("T402PaymentError", () => {
  it("should create with message only", () => {
    const err = new T402PaymentError("something failed");
    expect(err.message).toBe("something failed");
    expect(err.name).toBe("T402PaymentError");
    expect(err.phase).toBe("unknown");
    expect(err.retryable).toBe(false);
    expect(err.code).toBeUndefined();
    expect(err.cause).toBeUndefined();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(T402PaymentError);
  });

  it("should preserve cause, phase, retryable, and code", () => {
    const cause = new Error("upstream");
    const err = new T402PaymentError("verify failed", {
      cause,
      phase: "verification",
      retryable: true,
      code: 502,
    });
    expect(err.cause).toBe(cause);
    expect(err.phase).toBe("verification");
    expect(err.retryable).toBe(true);
    expect(err.code).toBe(502);
  });

  it("should support all phases", () => {
    const phases = ["signing", "submission", "verification", "settlement", "unknown"] as const;
    for (const phase of phases) {
      const err = new T402PaymentError("test", { phase });
      expect(err.phase).toBe(phase);
    }
  });

  it("isRetryable should return retryable flag", () => {
    expect(new T402PaymentError("a", { retryable: true }).isRetryable()).toBe(true);
    expect(new T402PaymentError("b", { retryable: false }).isRetryable()).toBe(false);
    expect(new T402PaymentError("c").isRetryable()).toBe(false);
  });

  it("toJSON should return structured object", () => {
    const cause = new Error("network error");
    const err = new T402PaymentError("settle failed", {
      cause,
      phase: "settlement",
      retryable: true,
      code: 500,
    });
    const json = err.toJSON();
    expect(json).toEqual({
      name: "T402PaymentError",
      message: "settle failed",
      phase: "settlement",
      retryable: true,
      code: 500,
      cause: "network error",
    });
  });

  it("toJSON should handle missing cause", () => {
    const err = new T402PaymentError("no cause");
    const json = err.toJSON();
    expect(json.cause).toBeUndefined();
  });

  it("should have a stack trace", () => {
    const err = new T402PaymentError("test");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("T402PaymentError");
  });
});
