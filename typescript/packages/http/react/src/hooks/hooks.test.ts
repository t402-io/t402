import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
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
    const { result } = renderHook(() => usePaymentRequired());

    expect(result.current.status).toBe("idle");
    expect(result.current.paymentRequired).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("captures 402 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 402,
      ok: false,
      json: async () => mockPaymentRequired,
    } as Response);

    const { result } = renderHook(() => usePaymentRequired());

    await act(async () => {
      await result.current.fetchResource("/api/protected");
    });

    expect(result.current.paymentRequired).toEqual(mockPaymentRequired);
    expect(result.current.status).toBe("idle");
  });

  it("handles successful response", async () => {
    const mockResponse = { data: "success" };
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const onSuccess = vi.fn();
    const { result } = renderHook(() => usePaymentRequired({ onSuccess }));

    let response: Response | null = null;
    await act(async () => {
      response = await result.current.fetchResource("/api/protected");
    });

    expect(response).not.toBeNull();
    expect(result.current.status).toBe("success");
    expect(onSuccess).toHaveBeenCalled();
  });

  it("handles errors", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    const onError = vi.fn();
    const { result } = renderHook(() => usePaymentRequired({ onError }));

    await act(async () => {
      await result.current.fetchResource("/api/protected");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Network error");
    expect(onError).toHaveBeenCalled();
  });

  it("resets state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      status: 402,
      ok: false,
      json: async () => mockPaymentRequired,
    } as Response);

    const { result } = renderHook(() => usePaymentRequired());

    await act(async () => {
      await result.current.fetchResource("/api/protected");
    });

    expect(result.current.paymentRequired).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.paymentRequired).toBeNull();
    expect(result.current.status).toBe("idle");
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
    const { result } = renderHook(() => usePaymentStatus());

    expect(result.current.status).toBe("idle");
    expect(result.current.message).toBeNull();
  });

  it("sets status with message", () => {
    const { result } = renderHook(() => usePaymentStatus());

    act(() => {
      result.current.setStatus("loading", "Processing...");
    });

    expect(result.current.status).toBe("loading");
    expect(result.current.message?.text).toBe("Processing...");
    expect(result.current.message?.type).toBe("info");
  });

  it("sets success with auto-dismiss", async () => {
    const { result } = renderHook(() => usePaymentStatus());

    act(() => {
      result.current.setSuccess("Payment successful!", 2000);
    });

    expect(result.current.status).toBe("success");
    expect(result.current.message?.text).toBe("Payment successful!");
    expect(result.current.message?.type).toBe("success");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.message).toBeNull();
  });

  it("sets error without auto-dismiss", () => {
    const { result } = renderHook(() => usePaymentStatus());

    act(() => {
      result.current.setError("Payment failed");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.message?.text).toBe("Payment failed");
    expect(result.current.message?.type).toBe("error");

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Error messages should persist
    expect(result.current.message).not.toBeNull();
  });

  it("sets info and warning messages", () => {
    const { result } = renderHook(() => usePaymentStatus());

    act(() => {
      result.current.setInfo("Please wait...");
    });
    expect(result.current.message?.type).toBe("info");

    act(() => {
      result.current.setWarning("Low balance");
    });
    expect(result.current.message?.type).toBe("warning");
  });

  it("clears message", () => {
    const { result } = renderHook(() => usePaymentStatus());

    act(() => {
      result.current.setError("Error");
    });

    expect(result.current.message).not.toBeNull();

    act(() => {
      result.current.clearMessage();
    });

    expect(result.current.message).toBeNull();
  });

  it("resets to idle", () => {
    const { result } = renderHook(() => usePaymentStatus());

    act(() => {
      result.current.setError("Error");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.message).toBeNull();
  });
});

describe("useAsyncPayment", () => {
  it("starts with idle state", () => {
    const paymentFn = vi.fn();
    const { result } = renderHook(() => useAsyncPayment({ paymentFn }));

    expect(result.current.status).toBe("idle");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("executes payment successfully", async () => {
    const mockResult = { txHash: "0x123" };
    const paymentFn = vi.fn().mockResolvedValue(mockResult);
    const onSuccess = vi.fn();
    const onStart = vi.fn();

    const { result } = renderHook(() =>
      useAsyncPayment({ paymentFn, onSuccess, onStart }),
    );

    let paymentResult: unknown;
    await act(async () => {
      paymentResult = await result.current.execute();
    });

    expect(paymentFn).toHaveBeenCalled();
    expect(onStart).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(mockResult);
    expect(paymentResult).toEqual(mockResult);
    expect(result.current.status).toBe("success");
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.result).toEqual(mockResult);
  });

  it("handles payment error", async () => {
    const paymentFn = vi.fn().mockRejectedValue(new Error("Insufficient funds"));
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useAsyncPayment({ paymentFn, onError }),
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe("Insufficient funds");
    expect(onError).toHaveBeenCalled();
  });

  it("shows loading state during execution", async () => {
    let resolvePayment: (value: unknown) => void;
    const paymentPromise = new Promise(resolve => {
      resolvePayment = resolve;
    });
    const paymentFn = vi.fn().mockReturnValue(paymentPromise);

    const { result } = renderHook(() => useAsyncPayment({ paymentFn }));

    // Start execution without waiting
    act(() => {
      result.current.execute();
    });

    // Should be loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.status).toBe("loading");

    // Resolve the payment
    await act(async () => {
      resolvePayment!({ success: true });
    });

    // Should no longer be loading
    expect(result.current.isLoading).toBe(false);
  });

  it("resets state", async () => {
    const paymentFn = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAsyncPayment({ paymentFn }));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.isSuccess).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
