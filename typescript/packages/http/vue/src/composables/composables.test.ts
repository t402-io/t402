import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { usePaymentRequired } from "./usePaymentRequired";
import { usePaymentStatus } from "./usePaymentStatus";
import { useAsyncPayment } from "./useAsyncPayment";
import type { PaymentRequired } from "@t402/core/types";

describe("usePaymentRequired", () => {
  const mockPaymentRequired: PaymentRequired = {
    t402Version: 1,
    resource: {
      url: "/api/protected",
      description: "Protected resource",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        asset: "usdt0",
        amount: "1000000",
        payTo: "0x1234567890abcdef1234567890abcdef12345678",
        maxTimeoutSeconds: 300,
        extra: {},
      },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with idle state", () => {
    const { status, paymentRequired, error } = usePaymentRequired();

    expect(status.value).toBe("idle");
    expect(paymentRequired.value).toBeNull();
    expect(error.value).toBeNull();
  });

  it("captures 402 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 402,
      ok: false,
      json: async () => mockPaymentRequired,
    } as Response);

    const { paymentRequired, status, fetchResource } = usePaymentRequired();

    await fetchResource("/api/protected");

    expect(paymentRequired.value).toEqual(mockPaymentRequired);
    expect(status.value).toBe("idle");
  });

  it("handles successful response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      ok: true,
    } as Response);

    const onSuccess = vi.fn();
    const { status, fetchResource } = usePaymentRequired({ onSuccess });

    const response = await fetchResource("/api/protected");

    expect(response).not.toBeNull();
    expect(status.value).toBe("success");
    expect(onSuccess).toHaveBeenCalled();
  });

  it("handles errors", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const onError = vi.fn();
    const { status, error, fetchResource } = usePaymentRequired({ onError });

    await fetchResource("/api/protected");

    expect(status.value).toBe("error");
    expect(error.value).toBe("Network error");
    expect(onError).toHaveBeenCalled();
  });

  it("resets state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 402,
      ok: false,
      json: async () => mockPaymentRequired,
    } as Response);

    const { paymentRequired, status, fetchResource, reset } = usePaymentRequired();

    await fetchResource("/api/protected");
    expect(paymentRequired.value).not.toBeNull();

    reset();
    expect(paymentRequired.value).toBeNull();
    expect(status.value).toBe("idle");
  });
});

describe("usePaymentStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with idle state", () => {
    const { status, message } = usePaymentStatus();

    expect(status.value).toBe("idle");
    expect(message.value).toBeNull();
  });

  it("sets status with message", () => {
    const { status, message, setStatus } = usePaymentStatus();

    setStatus("loading", "Processing...");

    expect(status.value).toBe("loading");
    expect(message.value?.text).toBe("Processing...");
    expect(message.value?.type).toBe("info");
  });

  it("sets success with auto-dismiss", () => {
    const { status, message, setSuccess } = usePaymentStatus();

    setSuccess("Payment successful!", 2000);

    expect(status.value).toBe("success");
    expect(message.value?.text).toBe("Payment successful!");

    vi.advanceTimersByTime(2000);
    expect(message.value).toBeNull();
  });

  it("sets error without auto-dismiss", () => {
    const { status, message, setError } = usePaymentStatus();

    setError("Payment failed");

    expect(status.value).toBe("error");
    expect(message.value?.text).toBe("Payment failed");

    vi.advanceTimersByTime(10000);
    expect(message.value).not.toBeNull();
  });

  it("clears message", () => {
    const { message, setError, clearMessage } = usePaymentStatus();

    setError("Error");
    expect(message.value).not.toBeNull();

    clearMessage();
    expect(message.value).toBeNull();
  });

  it("resets to idle", () => {
    const { status, message, setError, reset } = usePaymentStatus();

    setError("Error");
    reset();

    expect(status.value).toBe("idle");
    expect(message.value).toBeNull();
  });
});

describe("useAsyncPayment", () => {
  it("starts with idle state", () => {
    const paymentFn = vi.fn();
    const { status, isLoading, isSuccess, isError } = useAsyncPayment({ paymentFn });

    expect(status.value).toBe("idle");
    expect(isLoading.value).toBe(false);
    expect(isSuccess.value).toBe(false);
    expect(isError.value).toBe(false);
  });

  it("executes payment successfully", async () => {
    const mockResult = { txHash: "0x123" };
    const paymentFn = vi.fn().mockResolvedValue(mockResult);
    const onSuccess = vi.fn();
    const onStart = vi.fn();

    const { execute, status, result } = useAsyncPayment({
      paymentFn,
      onSuccess,
      onStart,
    });

    const paymentResult = await execute();

    expect(paymentFn).toHaveBeenCalled();
    expect(onStart).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(mockResult);
    expect(paymentResult).toEqual(mockResult);
    expect(status.value).toBe("success");
    expect(result.value).toEqual(mockResult);
  });

  it("handles payment error", async () => {
    const paymentFn = vi.fn().mockRejectedValue(new Error("Insufficient funds"));
    const onError = vi.fn();

    const { execute, status, error, isError } = useAsyncPayment({
      paymentFn,
      onError,
    });

    await execute();

    expect(status.value).toBe("error");
    expect(isError.value).toBe(true);
    expect(error.value).toBe("Insufficient funds");
    expect(onError).toHaveBeenCalled();
  });

  it("shows loading state during execution", async () => {
    let resolvePayment: (value: unknown) => void;
    const paymentPromise = new Promise(resolve => {
      resolvePayment = resolve;
    });
    const paymentFn = vi.fn().mockReturnValue(paymentPromise);

    const { execute, isLoading, status } = useAsyncPayment({ paymentFn });

    const executePromise = execute();
    expect(isLoading.value).toBe(true);
    expect(status.value).toBe("loading");

    resolvePayment!({ success: true });
    await executePromise;

    expect(isLoading.value).toBe(false);
  });

  it("resets state", async () => {
    const paymentFn = vi.fn().mockResolvedValue({ success: true });

    const { execute, isSuccess, reset } = useAsyncPayment({ paymentFn });

    await execute();
    expect(isSuccess.value).toBe(true);

    reset();
    expect(isSuccess.value).toBe(false);
  });
});
