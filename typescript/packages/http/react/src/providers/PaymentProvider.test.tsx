import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { PaymentProvider, usePaymentContext } from "./PaymentProvider";
import type { PaymentRequired, PaymentRequirements } from "@t402/core/types";

const mockRequirement: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:8453",
  asset: "usdt0",
  amount: "1000000",
  payTo: "0x1234567890abcdef1234567890abcdef12345678",
  maxTimeoutSeconds: 300,
  extra: {},
};

const mockPaymentRequired: PaymentRequired = {
  t402Version: 1,
  resource: {
    url: "/api/protected",
    description: "Protected resource",
    mimeType: "application/json",
  },
  accepts: [mockRequirement],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PaymentProvider>{children}</PaymentProvider>
);

const wrapperWithInitial = ({ children }: { children: React.ReactNode }) => (
  <PaymentProvider initialPaymentRequired={mockPaymentRequired}>{children}</PaymentProvider>
);

const wrapperWithTestnet = ({ children }: { children: React.ReactNode }) => (
  <PaymentProvider testnet={true}>{children}</PaymentProvider>
);

describe("PaymentProvider", () => {
  it("throws error when usePaymentContext is used outside provider", () => {
    expect(() => {
      renderHook(() => usePaymentContext());
    }).toThrow("usePaymentContext must be used within a PaymentProvider");
  });

  it("provides initial state", () => {
    const { result } = renderHook(() => usePaymentContext(), { wrapper });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.paymentRequired).toBeNull();
    expect(result.current.selectedRequirement).toBeNull();
    expect(result.current.isTestnet).toBe(false);
  });

  it("initializes with payment required data", () => {
    const { result } = renderHook(() => usePaymentContext(), {
      wrapper: wrapperWithInitial,
    });

    expect(result.current.paymentRequired).toEqual(mockPaymentRequired);
    expect(result.current.selectedRequirement).toEqual(mockRequirement);
  });

  it("initializes with testnet mode", () => {
    const { result } = renderHook(() => usePaymentContext(), {
      wrapper: wrapperWithTestnet,
    });

    expect(result.current.isTestnet).toBe(true);
  });

  it("sets payment required data", () => {
    const { result } = renderHook(() => usePaymentContext(), { wrapper });

    act(() => {
      result.current.setPaymentRequired(mockPaymentRequired);
    });

    expect(result.current.paymentRequired).toEqual(mockPaymentRequired);
    expect(result.current.selectedRequirement).toEqual(mockRequirement);
  });

  it("selects a specific requirement", () => {
    const secondRequirement: PaymentRequirements = {
      ...mockRequirement,
      network: "eip155:42161",
    };

    const paymentRequiredWithMultiple: PaymentRequired = {
      ...mockPaymentRequired,
      accepts: [mockRequirement, secondRequirement],
    };

    const wrapperWithMultiple = ({ children }: { children: React.ReactNode }) => (
      <PaymentProvider initialPaymentRequired={paymentRequiredWithMultiple}>
        {children}
      </PaymentProvider>
    );

    const { result } = renderHook(() => usePaymentContext(), {
      wrapper: wrapperWithMultiple,
    });

    act(() => {
      result.current.selectRequirement(secondRequirement);
    });

    expect(result.current.selectedRequirement).toEqual(secondRequirement);
  });

  it("sets status", () => {
    const { result } = renderHook(() => usePaymentContext(), { wrapper });

    act(() => {
      result.current.setStatus("loading");
    });

    expect(result.current.status).toBe("loading");
  });

  it("sets error", () => {
    const { result } = renderHook(() => usePaymentContext(), { wrapper });

    act(() => {
      result.current.setError("Payment failed");
    });

    expect(result.current.error).toBe("Payment failed");
    expect(result.current.status).toBe("error");
  });

  it("clears error when status is set to non-error", () => {
    const { result } = renderHook(() => usePaymentContext(), { wrapper });

    act(() => {
      result.current.setError("Payment failed");
    });

    expect(result.current.error).toBe("Payment failed");

    act(() => {
      result.current.setStatus("loading");
    });

    expect(result.current.error).toBeNull();
  });

  it("resets state", () => {
    const { result } = renderHook(() => usePaymentContext(), {
      wrapper: wrapperWithInitial,
    });

    expect(result.current.paymentRequired).not.toBeNull();

    act(() => {
      result.current.setStatus("success");
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.paymentRequired).toBeNull();
    expect(result.current.selectedRequirement).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("detects testnet from requirement network", () => {
    const testnetRequirement: PaymentRequirements = {
      ...mockRequirement,
      network: "eip155:84532", // Base Sepolia
    };

    const testnetPaymentRequired: PaymentRequired = {
      ...mockPaymentRequired,
      accepts: [testnetRequirement],
    };

    const { result } = renderHook(() => usePaymentContext(), { wrapper });

    act(() => {
      result.current.setPaymentRequired(testnetPaymentRequired);
    });

    expect(result.current.isTestnet).toBe(true);
  });
});
