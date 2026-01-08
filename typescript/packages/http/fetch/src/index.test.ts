import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapFetchWithPayment, wrapFetchWithPaymentFromConfig } from "./index";
import type { t402Client, t402HTTPClient, t402ClientConfig } from "@t402/core/client";
import type { PaymentPayload, PaymentRequired, PaymentRequirements } from "@t402/core/types";

// Mock the @t402/core/client module
vi.mock("@t402/core/client", () => {
  const MockT402HTTPClient = vi.fn();
  MockT402HTTPClient.prototype.getPaymentRequiredResponse = vi.fn();
  MockT402HTTPClient.prototype.encodePaymentSignatureHeader = vi.fn();

  const MockT402Client = vi.fn() as ReturnType<typeof vi.fn> & {
    fromConfig: ReturnType<typeof vi.fn>;
  };
  MockT402Client.prototype.createPaymentPayload = vi.fn();
  MockT402Client.fromConfig = vi.fn();

  return {
    t402HTTPClient: MockT402HTTPClient,
    t402Client: MockT402Client,
  };
});

type RequestInitWithRetry = RequestInit & { __is402Retry?: boolean };

describe("wrapFetchWithPayment()", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockClient: t402Client;
  let wrappedFetch: ReturnType<typeof wrapFetchWithPayment>;

  const validPaymentRequired: PaymentRequired = {
    t402Version: 2,
    resource: {
      url: "https://api.example.com/resource",
      description: "Test payment",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:84532" as const,
        amount: "1000000",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1234567890123456789012345678901234567890",
        maxTimeoutSeconds: 300,
        extra: {},
      } as PaymentRequirements,
    ],
  };

  const validPaymentPayload: PaymentPayload = {
    t402Version: 2,
    resource: validPaymentRequired.resource,
    accepted: validPaymentRequired.accepts[0],
    payload: { signature: "0xmocksignature" },
  };

  const createResponse = (
    status: number,
    data?: unknown,
    headers?: Record<string, string>,
  ): Response => {
    return new Response(data ? JSON.stringify(data) : null, {
      status,
      statusText: status === 402 ? "Payment Required" : "OK",
      headers: new Headers(headers),
    });
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    mockFetch = vi.fn();

    // Create mock client
    const { t402Client: MockT402Client, t402HTTPClient: MockT402HTTPClient } = await import(
      "@t402/core/client"
    );

    mockClient = new MockT402Client() as unknown as t402Client;

    // Setup default mock implementations
    (mockClient.createPaymentPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      validPaymentPayload,
    );

    (
      MockT402HTTPClient.prototype.getPaymentRequiredResponse as ReturnType<typeof vi.fn>
    ).mockReturnValue(validPaymentRequired);
    (
      MockT402HTTPClient.prototype.encodePaymentSignatureHeader as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      "PAYMENT-SIGNATURE": "encoded-payment-header",
    });

    wrappedFetch = wrapFetchWithPayment(mockFetch, mockClient);
  });

  it("should return the original response for non-402 status codes", async () => {
    const successResponse = createResponse(200, { data: "success" });
    mockFetch.mockResolvedValue(successResponse);

    const result = await wrappedFetch("https://api.example.com", { method: "GET" });

    expect(result).toBe(successResponse);
    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com", { method: "GET" });
  });

  it("should handle 402 errors and retry with payment header", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");
    const successResponse = createResponse(200, { data: "success" });

    mockFetch
      .mockResolvedValueOnce(
        createResponse(402, validPaymentRequired, { "PAYMENT-REQUIRED": "encoded-header" }),
      )
      .mockResolvedValueOnce(successResponse);

    const result = await wrappedFetch("https://api.example.com", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    } as RequestInitWithRetry);

    expect(result).toBe(successResponse);
    expect(MockT402HTTPClient.prototype.getPaymentRequiredResponse).toHaveBeenCalled();
    expect(mockClient.createPaymentPayload).toHaveBeenCalledWith(validPaymentRequired);
    expect(MockT402HTTPClient.prototype.encodePaymentSignatureHeader).toHaveBeenCalledWith(
      validPaymentPayload,
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith("https://api.example.com", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-SIGNATURE": "encoded-payment-header",
        "Access-Control-Expose-Headers": "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE",
      },
      __is402Retry: true,
    } as RequestInitWithRetry);
  });

  it("should not retry if already retried", async () => {
    mockFetch.mockResolvedValue(createResponse(402, validPaymentRequired));

    await expect(
      wrappedFetch("https://api.example.com", {
        method: "GET",
        __is402Retry: true,
      } as RequestInitWithRetry),
    ).rejects.toThrow("Payment already attempted");
  });

  it("should reject if missing fetch request config", async () => {
    mockFetch.mockResolvedValue(createResponse(402, validPaymentRequired));

    await expect(wrappedFetch("https://api.example.com")).rejects.toThrow(
      "Missing fetch request configuration",
    );
  });

  it("should reject with descriptive error if payment requirements parsing fails", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");
    (
      MockT402HTTPClient.prototype.getPaymentRequiredResponse as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw new Error("Invalid payment header format");
    });

    mockFetch.mockResolvedValue(createResponse(402, undefined));

    await expect(wrappedFetch("https://api.example.com", { method: "GET" })).rejects.toThrow(
      "Failed to parse payment requirements: Invalid payment header format",
    );
  });

  it("should reject with descriptive error if payment payload creation fails", async () => {
    const paymentError = new Error("Insufficient funds");
    (mockClient.createPaymentPayload as ReturnType<typeof vi.fn>).mockRejectedValue(paymentError);

    mockFetch.mockResolvedValue(createResponse(402, validPaymentRequired));

    await expect(wrappedFetch("https://api.example.com", { method: "GET" })).rejects.toThrow(
      "Failed to create payment payload: Insufficient funds",
    );
  });

  it("should reject with generic error message for unknown parsing errors", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");
    (
      MockT402HTTPClient.prototype.getPaymentRequiredResponse as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw "String error"; // Non-Error thrown
    });

    mockFetch.mockResolvedValue(createResponse(402, undefined));

    await expect(wrappedFetch("https://api.example.com", { method: "GET" })).rejects.toThrow(
      "Failed to parse payment requirements: Unknown error",
    );
  });

  it("should reject with generic error message for unknown payment creation errors", async () => {
    (mockClient.createPaymentPayload as ReturnType<typeof vi.fn>).mockRejectedValue("String error");

    mockFetch.mockResolvedValue(createResponse(402, validPaymentRequired));

    await expect(wrappedFetch("https://api.example.com", { method: "GET" })).rejects.toThrow(
      "Failed to create payment payload: Unknown error",
    );
  });

  it("should handle v1 payment responses from body", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");
    const successResponse = createResponse(200, { data: "success" });

    const v1PaymentRequired: PaymentRequired = {
      ...validPaymentRequired,
      t402Version: 1,
    };

    const v1PaymentPayload: PaymentPayload = {
      ...validPaymentPayload,
      t402Version: 1,
    };

    (
      MockT402HTTPClient.prototype.getPaymentRequiredResponse as ReturnType<typeof vi.fn>
    ).mockReturnValue(v1PaymentRequired);
    (
      MockT402HTTPClient.prototype.encodePaymentSignatureHeader as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      "X-PAYMENT": "v1-payment-header",
    });
    (mockClient.createPaymentPayload as ReturnType<typeof vi.fn>).mockResolvedValue(
      v1PaymentPayload,
    );

    mockFetch.mockResolvedValueOnce(createResponse(402, v1PaymentRequired));
    mockFetch.mockResolvedValueOnce(successResponse);

    const result = await wrappedFetch("https://api.example.com", { method: "GET" });

    expect(result).toBe(successResponse);
    expect(MockT402HTTPClient.prototype.encodePaymentSignatureHeader).toHaveBeenCalledWith(
      v1PaymentPayload,
    );
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://api.example.com",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-PAYMENT": "v1-payment-header",
        }),
      }),
    );
  });

  it("should propagate retry errors", async () => {
    const retryError = new Error("Network error on retry");

    mockFetch.mockResolvedValueOnce(createResponse(402, validPaymentRequired));
    mockFetch.mockRejectedValueOnce(retryError);

    await expect(wrappedFetch("https://api.example.com", { method: "GET" })).rejects.toBe(
      retryError,
    );
  });

  it("should set Access-Control-Expose-Headers on retry request", async () => {
    const successResponse = createResponse(200, { data: "success" });

    mockFetch.mockResolvedValueOnce(createResponse(402, validPaymentRequired));
    mockFetch.mockResolvedValueOnce(successResponse);

    await wrappedFetch("https://api.example.com", { method: "GET" });

    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://api.example.com",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Access-Control-Expose-Headers": "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE",
        }),
      }),
    );
  });

  it("should handle empty response body gracefully", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");
    const successResponse = createResponse(200, { data: "success" });

    // Response with headers only, no body
    const headerOnlyResponse = new Response("", {
      status: 402,
      headers: new Headers({ "PAYMENT-REQUIRED": "encoded-header" }),
    });

    mockFetch.mockResolvedValueOnce(headerOnlyResponse);
    mockFetch.mockResolvedValueOnce(successResponse);

    const result = await wrappedFetch("https://api.example.com", { method: "GET" });

    expect(result).toBe(successResponse);
    expect(MockT402HTTPClient.prototype.getPaymentRequiredResponse).toHaveBeenCalled();
  });

  it("should handle invalid JSON in response body gracefully", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");
    const successResponse = createResponse(200, { data: "success" });

    // Response with invalid JSON body
    const invalidJsonResponse = new Response("not valid json", {
      status: 402,
      headers: new Headers({ "PAYMENT-REQUIRED": "encoded-header" }),
    });

    mockFetch.mockResolvedValueOnce(invalidJsonResponse);
    mockFetch.mockResolvedValueOnce(successResponse);

    const result = await wrappedFetch("https://api.example.com", { method: "GET" });

    expect(result).toBe(successResponse);
    expect(MockT402HTTPClient.prototype.getPaymentRequiredResponse).toHaveBeenCalled();
  });

  it("should accept t402HTTPClient directly", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");

    const httpClient = new MockT402HTTPClient(mockClient) as unknown as t402HTTPClient;
    const wrappedWithHttpClient = wrapFetchWithPayment(mockFetch, httpClient);

    const successResponse = createResponse(200, { data: "success" });
    mockFetch.mockResolvedValue(successResponse);

    const result = await wrappedWithHttpClient("https://api.example.com", { method: "GET" });

    expect(result).toBe(successResponse);
  });
});

describe("wrapFetchWithPaymentFromConfig()", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetAllMocks();

    mockFetch = vi.fn();

    const { t402Client: MockT402Client, t402HTTPClient: MockT402HTTPClient } = await import(
      "@t402/core/client"
    );
    (MockT402Client.fromConfig as ReturnType<typeof vi.fn>).mockReturnValue(new MockT402Client());

    (
      MockT402HTTPClient.prototype.getPaymentRequiredResponse as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      t402Version: 2,
      resource: { url: "test", description: "test", mimeType: "text/plain" },
      accepts: [],
    });
  });

  it("should create client from config and wrap fetch", async () => {
    const { t402Client: MockT402Client } = await import("@t402/core/client");

    const config: t402ClientConfig = {
      schemes: [],
    };

    const wrappedFetch = wrapFetchWithPaymentFromConfig(mockFetch, config);

    expect(MockT402Client.fromConfig).toHaveBeenCalledWith(config);
    expect(typeof wrappedFetch).toBe("function");
  });

  it("should return wrapped fetch function", async () => {
    const config: t402ClientConfig = {
      schemes: [],
    };

    const wrappedFetch = wrapFetchWithPaymentFromConfig(mockFetch, config);
    const successResponse = new Response(JSON.stringify({ data: "success" }), { status: 200 });
    mockFetch.mockResolvedValue(successResponse);

    const result = await wrappedFetch("https://api.example.com", { method: "GET" });

    expect(result).toBe(successResponse);
    expect(mockFetch).toHaveBeenCalled();
  });
});
