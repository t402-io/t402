import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { Spinner } from "./Spinner";
import { PaymentButton } from "./PaymentButton";
import { PaymentStatusDisplay } from "./PaymentStatusDisplay";
import { PaymentDetails } from "./PaymentDetails";
import { AddressDisplay } from "./AddressDisplay";
import type { PaymentRequirements } from "@t402/core/types";

describe("Spinner", () => {
  it("renders with default size", () => {
    const wrapper = mount(Spinner);
    expect(wrapper.attributes("role")).toBe("status");
    expect(wrapper.attributes("aria-label")).toBe("Loading");
  });

  it("renders with different sizes", () => {
    const wrapper = mount(Spinner, { props: { size: "lg" } });
    expect(wrapper.exists()).toBe(true);
  });
});

describe("PaymentButton", () => {
  it("renders with default text", () => {
    const wrapper = mount(PaymentButton);
    expect(wrapper.text()).toContain("Pay Now");
  });

  it("renders with custom slot content", () => {
    const wrapper = mount(PaymentButton, {
      slots: { default: "Pay $10.00" },
    });
    expect(wrapper.text()).toContain("Pay $10.00");
  });

  it("emits click when clicked", async () => {
    const wrapper = mount(PaymentButton);
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("shows loading state", () => {
    const wrapper = mount(PaymentButton, { props: { loading: true } });
    expect(wrapper.findComponent(Spinner).exists()).toBe(true);
    expect(wrapper.attributes("disabled")).toBeDefined();
  });

  it("is disabled when disabled prop is true", () => {
    const wrapper = mount(PaymentButton, { props: { disabled: true } });
    expect(wrapper.attributes("disabled")).toBeDefined();
  });

  it("does not emit click when disabled", async () => {
    const wrapper = mount(PaymentButton, { props: { disabled: true } });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeFalsy();
  });

  it("does not emit click when loading", async () => {
    const wrapper = mount(PaymentButton, { props: { loading: true } });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeFalsy();
  });
});

describe("PaymentStatusDisplay", () => {
  it("renders idle state", () => {
    const wrapper = mount(PaymentStatusDisplay, { props: { status: "idle" } });
    expect(wrapper.text()).toContain("Ready to pay");
  });

  it("renders loading state with spinner", () => {
    const wrapper = mount(PaymentStatusDisplay, { props: { status: "loading" } });
    expect(wrapper.text()).toContain("Processing...");
    expect(wrapper.findComponent(Spinner).exists()).toBe(true);
  });

  it("renders success state", () => {
    const wrapper = mount(PaymentStatusDisplay, { props: { status: "success" } });
    expect(wrapper.text()).toContain("Payment successful");
    expect(wrapper.text()).toContain("✓");
  });

  it("renders error state", () => {
    const wrapper = mount(PaymentStatusDisplay, { props: { status: "error" } });
    expect(wrapper.text()).toContain("Payment failed");
    expect(wrapper.text()).toContain("✕");
  });

  it("renders custom message", () => {
    const wrapper = mount(PaymentStatusDisplay, {
      props: { status: "loading", message: "Confirming transaction..." },
    });
    expect(wrapper.text()).toContain("Confirming transaction...");
  });

  it("has accessible role", () => {
    const wrapper = mount(PaymentStatusDisplay, { props: { status: "idle" } });
    expect(wrapper.attributes("role")).toBe("status");
    expect(wrapper.attributes("aria-live")).toBe("polite");
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
    const wrapper = mount(PaymentDetails, { props: { requirement: mockRequirement } });
    expect(wrapper.text()).toContain("Amount");
    expect(wrapper.text()).toContain("1 USDT0");
  });

  it("renders network when showNetwork is true", () => {
    const wrapper = mount(PaymentDetails, {
      props: { requirement: mockRequirement, showNetwork: true },
    });
    expect(wrapper.text()).toContain("Network");
    expect(wrapper.text()).toContain("Base");
  });

  it("hides network when showNetwork is false", () => {
    const wrapper = mount(PaymentDetails, {
      props: { requirement: mockRequirement, showNetwork: false },
    });
    expect(wrapper.text()).not.toContain("Network");
  });

  it("renders recipient when showRecipient is true", () => {
    const wrapper = mount(PaymentDetails, {
      props: { requirement: mockRequirement, showRecipient: true },
    });
    expect(wrapper.text()).toContain("Recipient");
    expect(wrapper.text()).toContain("0x1234...5678");
  });
});

describe("AddressDisplay", () => {
  const mockAddress = "0x1234567890abcdef1234567890abcdef12345678";

  it("renders truncated address", () => {
    const wrapper = mount(AddressDisplay, { props: { address: mockAddress } });
    expect(wrapper.text()).toContain("0x1234...5678");
  });

  it("renders with custom truncation", () => {
    const wrapper = mount(AddressDisplay, {
      props: { address: mockAddress, startChars: 8, endChars: 6 },
    });
    expect(wrapper.text()).toContain("0x123456...345678");
  });

  it("shows full address in title", () => {
    const wrapper = mount(AddressDisplay, { props: { address: mockAddress } });
    expect(wrapper.attributes("title")).toBe(mockAddress);
  });

  it("does not show copy button by default", () => {
    const wrapper = mount(AddressDisplay, { props: { address: mockAddress } });
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("shows copy button when copyable", () => {
    const wrapper = mount(AddressDisplay, {
      props: { address: mockAddress, copyable: true },
    });
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("copies address when copy button clicked", async () => {
    // Mock clipboard API
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: writeTextMock },
    });

    const wrapper = mount(AddressDisplay, {
      props: { address: mockAddress, copyable: true },
    });

    await wrapper.find("button").trigger("click");
    expect(writeTextMock).toHaveBeenCalledWith(mockAddress);

    vi.unstubAllGlobals();
  });
});
