import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";
import type {
  HTTPProcessResult,
  t402HTTPResourceServer,
  PaywallProvider,
  FacilitatorClient,
} from "@t402/core/server";
import {
  t402ResourceServer,
  t402HTTPResourceServer as HTTPResourceServer,
} from "@t402/core/server";
import type { PaymentPayload, PaymentRequirements, SchemeNetworkServer } from "@t402/core/types";
import { paymentMiddleware, paymentMiddlewareFromConfig, type SchemeRegistration } from "./index";

// --- Test Fixtures ---
const mockRoutes = {
  "/api/*": {
    accepts: { scheme: "exact", payTo: "0x123", price: "$0.01", network: "eip155:84532" },
  },
} as const;

const mockPaymentPayload = {
  scheme: "exact",
  network: "eip155:84532",
  payload: { signature: "0xabc" },
} as unknown as PaymentPayload;

const mockPaymentRequirements = {
  scheme: "exact",
  network: "eip155:84532",
  maxAmountRequired: "1000",
  payTo: "0x123",
} as unknown as PaymentRequirements;

// --- Mock setup ---
let mockProcessHTTPRequest: ReturnType<typeof vi.fn>;
let mockProcessSettlement: ReturnType<typeof vi.fn>;
let mockRegisterPaywallProvider: ReturnType<typeof vi.fn>;
let mockRequiresPayment: ReturnType<typeof vi.fn>;

vi.mock("@t402/core/server", () => ({
  t402ResourceServer: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    registerExtension: vi.fn(),
    register: vi.fn(),
  })),
  t402HTTPResourceServer: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    processHTTPRequest: mockProcessHTTPRequest,
    processSettlement: mockProcessSettlement,
    registerPaywallProvider: mockRegisterPaywallProvider,
    requiresPayment: mockRequiresPayment,
  })),
}));

// --- Mock Factories ---
/**
 * Sets up the mock HTTP server to return specified results.
 *
 * @param processResult - The result to return from processHTTPRequest.
 * @param settlementResult - Result to return from processSettlement.
 */
function setupMockHttpServer(
  processResult: HTTPProcessResult,
  settlementResult:
    | { success: true; headers: Record<string, string> }
    | { success: false; errorReason: string } = { success: true, headers: {} },
): void {
  mockProcessHTTPRequest.mockResolvedValue(processResult);
  mockProcessSettlement.mockResolvedValue(settlementResult);
}

/**
 * Creates a mock Fastify Request for testing.
 *
 * @param options - Configuration options for the mock request.
 * @param options.url - The request URL (path + query string).
 * @param options.method - The HTTP method.
 * @param options.headers - Request headers.
 * @returns A mock Fastify Request.
 */
function createMockRequest(
  options: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  } = {},
): FastifyRequest {
  return {
    url: options.url || "/api/test",
    method: options.method || "GET",
    headers: options.headers || {},
    query: {},
    body: undefined,
    protocol: "https",
    hostname: "example.com",
  } as unknown as FastifyRequest;
}

/**
 * Creates a mock Fastify Reply for testing.
 *
 * @returns A mock Fastify Reply with tracking for testing.
 */
function createMockReply(): FastifyReply & {
  _status: number;
  _headers: Record<string, string>;
  _body: unknown;
  _type: string;
  _onSendHooks: Array<(request: FastifyRequest, reply: FastifyReply, payload: unknown) => Promise<unknown>>;
} {
  const reply = {
    _status: 200,
    _headers: {} as Record<string, string>,
    _body: undefined as unknown,
    _type: "application/json",
    _onSendHooks: [] as Array<(request: FastifyRequest, reply: FastifyReply, payload: unknown) => Promise<unknown>>,
    statusCode: 200,
    code: vi.fn(function (this: typeof reply, status: number) {
      this._status = status;
      this.statusCode = status;
      return this;
    }),
    header: vi.fn(function (this: typeof reply, key: string, value: string) {
      this._headers[key] = value;
      return this;
    }),
    type: vi.fn(function (this: typeof reply, type: string) {
      this._type = type;
      return this;
    }),
    send: vi.fn(function (this: typeof reply, body: unknown) {
      this._body = body;
      return this;
    }),
    addHook: vi.fn(function (
      this: typeof reply,
      hookName: string,
      handler: (request: FastifyRequest, reply: FastifyReply, payload: unknown) => Promise<unknown>,
    ) {
      if (hookName === "onSend") {
        this._onSendHooks.push(handler);
      }
      return this;
    }),
  };

  return reply as unknown as FastifyReply & typeof reply;
}

// --- Tests ---
describe("paymentMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessHTTPRequest = vi.fn();
    mockProcessSettlement = vi.fn();
    mockRegisterPaywallProvider = vi.fn();
    mockRequiresPayment = vi.fn().mockReturnValue(true);

    // Reset the mock implementation
    vi.mocked(HTTPResourceServer).mockImplementation(
      () =>
        ({
          processHTTPRequest: mockProcessHTTPRequest,
          processSettlement: mockProcessSettlement,
          registerPaywallProvider: mockRegisterPaywallProvider,
          requiresPayment: mockRequiresPayment,
        }) as unknown as t402HTTPResourceServer,
    );
  });

  it("continues when no-payment-required", async () => {
    setupMockHttpServer({ type: "no-payment-required" });

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    expect(mockProcessHTTPRequest).toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it("returns 402 HTML for payment-error with isHtml", async () => {
    setupMockHttpServer({
      type: "payment-error",
      response: {
        status: 402,
        body: "<html>Paywall</html>",
        headers: {},
        isHtml: true,
      },
    });

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(402);
    expect(reply.type).toHaveBeenCalledWith("text/html");
    expect(reply.send).toHaveBeenCalledWith("<html>Paywall</html>");
  });

  it("returns 402 JSON for payment-error", async () => {
    setupMockHttpServer({
      type: "payment-error",
      response: {
        status: 402,
        body: { error: "Payment required" },
        headers: {},
        isHtml: false,
      },
    });

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(402);
    expect(reply.send).toHaveBeenCalledWith({ error: "Payment required" });
  });

  it("sets custom headers from payment-error response", async () => {
    setupMockHttpServer({
      type: "payment-error",
      response: {
        status: 402,
        body: { error: "Payment required" },
        headers: { "X-Custom-Header": "custom-value" },
        isHtml: false,
      },
    });

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.header).toHaveBeenCalledWith("X-Custom-Header", "custom-value");
  });

  it("adds onSend hook for payment-verified", async () => {
    setupMockHttpServer(
      {
        type: "payment-verified",
        paymentPayload: mockPaymentPayload,
        paymentRequirements: mockPaymentRequirements,
      },
      { success: true, headers: { "PAYMENT-RESPONSE": "settled" } },
    );

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.addHook).toHaveBeenCalledWith("onSend", expect.any(Function));
    expect(reply._onSendHooks).toHaveLength(1);
  });

  it("settles payment in onSend hook for successful response", async () => {
    setupMockHttpServer(
      {
        type: "payment-verified",
        paymentPayload: mockPaymentPayload,
        paymentRequirements: mockPaymentRequirements,
      },
      { success: true, headers: { "PAYMENT-RESPONSE": "settled" } },
    );

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    // Simulate onSend hook execution
    const onSendHook = reply._onSendHooks[0];
    const payload = JSON.stringify({ data: "response" });
    const result = await onSendHook(request, reply, payload);

    expect(mockProcessSettlement).toHaveBeenCalledWith(mockPaymentPayload, mockPaymentRequirements);
    expect(reply.header).toHaveBeenCalledWith("PAYMENT-RESPONSE", "settled");
    expect(result).toBe(payload);
  });

  it("skips settlement when response status >= 400", async () => {
    setupMockHttpServer(
      {
        type: "payment-verified",
        paymentPayload: mockPaymentPayload,
        paymentRequirements: mockPaymentRequirements,
      },
      { success: true, headers: { "PAYMENT-RESPONSE": "settled" } },
    );

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();
    reply.statusCode = 500;

    await middleware(request, reply);

    // Simulate onSend hook execution
    const onSendHook = reply._onSendHooks[0];
    const payload = JSON.stringify({ error: "Server error" });
    const result = await onSendHook(request, reply, payload);

    expect(mockProcessSettlement).not.toHaveBeenCalled();
    expect(result).toBe(payload);
  });

  it("returns 402 when settlement fails", async () => {
    setupMockHttpServer(
      {
        type: "payment-verified",
        paymentPayload: mockPaymentPayload,
        paymentRequirements: mockPaymentRequirements,
      },
      { success: false, errorReason: "Insufficient funds" },
    );

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    // Simulate onSend hook execution
    const onSendHook = reply._onSendHooks[0];
    const payload = JSON.stringify({ data: "response" });
    const result = await onSendHook(request, reply, payload);

    expect(reply.code).toHaveBeenCalledWith(402);
    expect(result).toBe(JSON.stringify({
      error: "Settlement failed",
      details: "Insufficient funds",
    }));
  });

  it("returns 402 when settlement throws error", async () => {
    setupMockHttpServer({
      type: "payment-verified",
      paymentPayload: mockPaymentPayload,
      paymentRequirements: mockPaymentRequirements,
    });
    mockProcessSettlement.mockRejectedValue(new Error("Settlement rejected"));

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    // Simulate onSend hook execution
    const onSendHook = reply._onSendHooks[0];
    const payload = JSON.stringify({ data: "response" });
    const result = await onSendHook(request, reply, payload);

    expect(reply.code).toHaveBeenCalledWith(402);
    expect(result).toBe(JSON.stringify({
      error: "Settlement failed",
      details: "Settlement rejected",
    }));
  });

  it("passes paywallConfig to processHTTPRequest", async () => {
    setupMockHttpServer({ type: "no-payment-required" });
    const paywallConfig = { appName: "test-app" };

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      paywallConfig,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    expect(mockProcessHTTPRequest).toHaveBeenCalledWith(expect.anything(), paywallConfig);
  });

  it("registers custom paywall provider", () => {
    setupMockHttpServer({ type: "no-payment-required" });
    const paywall: PaywallProvider = { generateHtml: vi.fn() };

    paymentMiddleware(mockRoutes, {} as unknown as t402ResourceServer, undefined, paywall, false);

    expect(mockRegisterPaywallProvider).toHaveBeenCalledWith(paywall);
  });

  it("skips payment check when route does not require payment", async () => {
    mockRequiresPayment.mockReturnValue(false);

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    expect(mockProcessHTTPRequest).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});

describe("paymentMiddlewareFromConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessHTTPRequest = vi.fn();
    mockProcessSettlement = vi.fn();
    mockRegisterPaywallProvider = vi.fn();
    mockRequiresPayment = vi.fn().mockReturnValue(true);

    vi.mocked(HTTPResourceServer).mockImplementation(
      () =>
        ({
          initialize: vi.fn().mockResolvedValue(undefined),
          processHTTPRequest: mockProcessHTTPRequest,
          processSettlement: mockProcessSettlement,
          registerPaywallProvider: mockRegisterPaywallProvider,
          requiresPayment: mockRequiresPayment,
        }) as unknown as t402HTTPResourceServer,
    );

    vi.mocked(t402ResourceServer).mockImplementation(
      () =>
        ({
          initialize: vi.fn().mockResolvedValue(undefined),
          registerExtension: vi.fn(),
          register: vi.fn(),
        }) as unknown as t402ResourceServer,
    );
  });

  it("creates t402ResourceServer with facilitator clients", () => {
    setupMockHttpServer({ type: "no-payment-required" });
    const facilitator = { verify: vi.fn(), settle: vi.fn() } as unknown as FacilitatorClient;

    paymentMiddlewareFromConfig(mockRoutes, facilitator);

    expect(t402ResourceServer).toHaveBeenCalledWith(facilitator);
  });

  it("registers scheme servers for each network", () => {
    setupMockHttpServer({ type: "no-payment-required" });
    const schemeServer = { verify: vi.fn(), settle: vi.fn() } as unknown as SchemeNetworkServer;
    const schemes: SchemeRegistration[] = [
      { network: "eip155:84532", server: schemeServer },
      { network: "eip155:8453", server: schemeServer },
    ];

    paymentMiddlewareFromConfig(mockRoutes, undefined, schemes);

    const serverInstance = vi.mocked(t402ResourceServer).mock.results[0].value;
    expect(serverInstance.register).toHaveBeenCalledTimes(2);
    expect(serverInstance.register).toHaveBeenCalledWith("eip155:84532", schemeServer);
    expect(serverInstance.register).toHaveBeenCalledWith("eip155:8453", schemeServer);
  });

  it("returns a working middleware function", async () => {
    setupMockHttpServer({ type: "no-payment-required" });

    const middleware = paymentMiddlewareFromConfig(mockRoutes);
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    expect(mockProcessHTTPRequest).toHaveBeenCalled();
  });
});

describe("FastifyAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessHTTPRequest = vi.fn();
    mockProcessSettlement = vi.fn();
    mockRegisterPaywallProvider = vi.fn();
    mockRequiresPayment = vi.fn().mockReturnValue(true);

    vi.mocked(HTTPResourceServer).mockImplementation(
      () =>
        ({
          processHTTPRequest: mockProcessHTTPRequest,
          processSettlement: mockProcessSettlement,
          registerPaywallProvider: mockRegisterPaywallProvider,
          requiresPayment: mockRequiresPayment,
        }) as unknown as t402HTTPResourceServer,
    );
  });

  it("extracts path and method from request", async () => {
    setupMockHttpServer({ type: "no-payment-required" });

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest({ url: "/api/weather", method: "POST" });
    const reply = createMockReply();

    await middleware(request, reply);

    expect(mockProcessHTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/api/weather",
        method: "POST",
      }),
      undefined,
    );
  });

  it("extracts x-payment header", async () => {
    setupMockHttpServer({ type: "no-payment-required" });

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest({ headers: { "x-payment": "payment-data" } });
    const reply = createMockReply();

    await middleware(request, reply);

    expect(mockProcessHTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentHeader: "payment-data",
      }),
      undefined,
    );
  });

  it("extracts payment-signature header (v2)", async () => {
    setupMockHttpServer({ type: "no-payment-required" });

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest({ headers: { "payment-signature": "sig-data" } });
    const reply = createMockReply();

    await middleware(request, reply);

    expect(mockProcessHTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentHeader: "sig-data",
      }),
      undefined,
    );
  });

  it("prefers payment-signature over x-payment", async () => {
    setupMockHttpServer({ type: "no-payment-required" });

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest({
      headers: { "payment-signature": "sig-data", "x-payment": "x-payment-data" },
    });
    const reply = createMockReply();

    await middleware(request, reply);

    expect(mockProcessHTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentHeader: "sig-data",
      }),
      undefined,
    );
  });

  it("returns undefined paymentHeader when no payment headers present", async () => {
    setupMockHttpServer({ type: "no-payment-required" });

    const middleware = paymentMiddleware(
      mockRoutes,
      {} as unknown as t402ResourceServer,
      undefined,
      undefined,
      false,
    );
    const request = createMockRequest();
    const reply = createMockReply();

    await middleware(request, reply);

    expect(mockProcessHTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentHeader: undefined,
      }),
      undefined,
    );
  });
});
