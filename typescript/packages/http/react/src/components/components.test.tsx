import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { Spinner } from "./Spinner";
import { PaymentButton } from "./PaymentButton";
import { PaymentStatus } from "./PaymentStatus";
import { PaymentDetails } from "./PaymentDetails";
import { AddressDisplay } from "./AddressDisplay";
import type { PaymentRequirements } from "@t402/core/types";

describe("Spinner", () => {
  it("renders with default size", () => {
    render(<Spinner />);
    const spinner = screen.getByRole("status");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute("aria-label", "Loading");
  });

  it("renders with different sizes", () => {
    const { rerender } = render(<Spinner size="sm" />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(<Spinner size="lg" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Spinner className="custom-spinner" />);
    expect(screen.getByRole("status")).toHaveClass("custom-spinner");
  });
});

describe("PaymentButton", () => {
  it("renders with default text", () => {
    render(<PaymentButton />);
    expect(screen.getByText("Pay Now")).toBeInTheDocument();
  });

  it("renders with custom children", () => {
    render(<PaymentButton>Pay $10.00</PaymentButton>);
    expect(screen.getByText("Pay $10.00")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(<PaymentButton onClick={handleClick}>Pay</PaymentButton>);

    fireEvent.click(screen.getByText("Pay"));
    expect(handleClick).toHaveBeenCalled();
  });

  it("shows loading state", () => {
    render(<PaymentButton loading>Pay</PaymentButton>);
    expect(screen.getByRole("status")).toBeInTheDocument(); // Spinner
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when disabled prop is true", () => {
    render(<PaymentButton disabled>Pay</PaymentButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn();
    render(<PaymentButton onClick={handleClick} disabled>Pay</PaymentButton>);

    fireEvent.click(screen.getByText("Pay"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not call onClick when loading", () => {
    const handleClick = vi.fn();
    render(<PaymentButton onClick={handleClick} loading>Pay</PaymentButton>);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies variant styles", () => {
    const { rerender } = render(<PaymentButton variant="primary">Pay</PaymentButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();

    rerender(<PaymentButton variant="secondary">Pay</PaymentButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();

    rerender(<PaymentButton variant="outline">Pay</PaymentButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("applies size styles", () => {
    const { rerender } = render(<PaymentButton size="sm">Pay</PaymentButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();

    rerender(<PaymentButton size="lg">Pay</PaymentButton>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});

describe("PaymentStatus", () => {
  it("renders idle state", () => {
    render(<PaymentStatus status="idle" />);
    expect(screen.getByText("Ready to pay")).toBeInTheDocument();
  });

  it("renders loading state with spinner", () => {
    render(<PaymentStatus status="loading" />);
    expect(screen.getByText("Processing...")).toBeInTheDocument();
    // There are two status roles - the container and the spinner
    expect(screen.getAllByRole("status")).toHaveLength(2);
  });

  it("renders success state", () => {
    render(<PaymentStatus status="success" />);
    expect(screen.getByText("Payment successful")).toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<PaymentStatus status="error" />);
    expect(screen.getByText("Payment failed")).toBeInTheDocument();
    expect(screen.getByText("✕")).toBeInTheDocument();
  });

  it("renders custom message", () => {
    render(<PaymentStatus status="loading" message="Confirming transaction..." />);
    expect(screen.getByText("Confirming transaction...")).toBeInTheDocument();
  });

  it("has accessible role", () => {
    render(<PaymentStatus status="idle" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});

describe("PaymentDetails", () => {
  const mockRequirement: PaymentRequirements = {
    scheme: "exact",
    network: "eip155:8453",
    asset: "usdt0",
    amount: "1000000",
    payTo: "0x1234567890abcdef1234567890abcdef12345678",
    maxTimeoutSeconds: 300,
    extra: {},
  };

  it("renders amount", () => {
    render(<PaymentDetails requirement={mockRequirement} />);
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText(/1.*USDT0/)).toBeInTheDocument();
  });

  it("renders network when showNetwork is true", () => {
    render(<PaymentDetails requirement={mockRequirement} showNetwork />);
    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Base")).toBeInTheDocument();
  });

  it("hides network when showNetwork is false", () => {
    render(<PaymentDetails requirement={mockRequirement} showNetwork={false} />);
    expect(screen.queryByText("Network")).not.toBeInTheDocument();
  });

  it("renders asset when showAsset is true", () => {
    render(<PaymentDetails requirement={mockRequirement} showAsset />);
    expect(screen.getByText("Asset")).toBeInTheDocument();
  });

  it("renders recipient when showRecipient is true", () => {
    render(<PaymentDetails requirement={mockRequirement} showRecipient />);
    expect(screen.getByText("Recipient")).toBeInTheDocument();
    expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
  });

  it("formats large amounts correctly", () => {
    const largeAmountRequirement = {
      ...mockRequirement,
      amount: "100000000", // 100 USDT
    };
    render(<PaymentDetails requirement={largeAmountRequirement} />);
    expect(screen.getByText(/100.*USDT0/)).toBeInTheDocument();
  });
});

describe("AddressDisplay", () => {
  const mockAddress = "0x1234567890abcdef1234567890abcdef12345678";

  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders truncated address", () => {
    render(<AddressDisplay address={mockAddress} />);
    expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
  });

  it("renders with custom truncation", () => {
    render(<AddressDisplay address={mockAddress} startChars={8} endChars={6} />);
    expect(screen.getByText("0x123456...345678")).toBeInTheDocument();
  });

  it("shows full address in title", () => {
    render(<AddressDisplay address={mockAddress} />);
    expect(screen.getByTitle(mockAddress)).toBeInTheDocument();
  });

  it("does not show copy button by default", () => {
    render(<AddressDisplay address={mockAddress} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows copy button when copyable", () => {
    render(<AddressDisplay address={mockAddress} copyable />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy address")).toBeInTheDocument();
  });

  it("copies address when copy button clicked", async () => {
    render(<AddressDisplay address={mockAddress} copyable />);

    fireEvent.click(screen.getByRole("button"));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockAddress);
  });

  it("shows copied state after copy", async () => {
    render(<AddressDisplay address={mockAddress} copyable />);

    fireEvent.click(screen.getByRole("button"));

    // Wait for the copied state to appear
    await waitFor(() => {
      expect(screen.getByLabelText("Copied")).toBeInTheDocument();
    });
  });
});
