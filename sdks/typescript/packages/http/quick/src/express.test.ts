import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the underlying express middleware
vi.mock("@t402/express", () => ({
  paymentMiddlewareFromConfig: vi.fn().mockReturnValue(
    (_req: unknown, _res: unknown, next: () => void) => next()
  ),
}));

vi.mock("@t402/core/http", () => ({
  HTTPFacilitatorClient: vi.fn().mockImplementation((config: { url?: string }) => ({
    url: config?.url || "https://facilitator.t402.io",
    verify: vi.fn(),
    settle: vi.fn(),
    getSupported: vi.fn(),
  })),
}));

import { t402 } from "./express";
import { paymentMiddlewareFromConfig } from "@t402/express";
import { HTTPFacilitatorClient } from "@t402/core/http";

describe("@t402/quick/express", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates middleware from simplified config", () => {
    const middleware = t402({
      price: "1.00",
      payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
    });

    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe("function");
    expect(paymentMiddlewareFromConfig).toHaveBeenCalledOnce();
  });

  it("passes resolved RoutesConfig to underlying middleware", () => {
    t402({
      price: "5.00",
      payTo: "0x123",
      network: "eip155:56",
    });

    const call = vi.mocked(paymentMiddlewareFromConfig).mock.calls[0];
    const routes = call[0] as any;

    expect(routes.accepts.scheme).toBe("exact");
    expect(routes.accepts.network).toBe("eip155:56");
    expect(routes.accepts.price.amount).toBe("5000000");
    expect(routes.accepts.payTo).toBe("0x123");
  });

  it("creates facilitator client with correct URL", () => {
    t402({
      price: "1.00",
      payTo: "0x123",
      facilitator: "https://my-facilitator.example.com",
    });

    expect(HTTPFacilitatorClient).toHaveBeenCalledWith({
      url: "https://my-facilitator.example.com",
    });
  });

  it("uses default facilitator URL when not specified", () => {
    t402({
      price: "1.00",
      payTo: "0x123",
    });

    expect(HTTPFacilitatorClient).toHaveBeenCalledWith({
      url: "https://facilitator.t402.io",
    });
  });

  it("throws on invalid config", () => {
    expect(() => t402({ price: "", payTo: "0x123" })).toThrow("price is required");
    expect(() => t402({ price: "1.00" } as any)).toThrow("payTo");
  });
});
