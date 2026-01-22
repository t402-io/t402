import {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { wrapAxiosWithPayment, wrapAxiosWithPaymentFromConfig } from "./index";
import type { t402Client, t402ClientConfig } from "@t402/core/client";
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

describe("wrapAxiosWithPayment()", () => {
  let mockAxiosClient: AxiosInstance;
  let mockClient: t402Client;
  let interceptor: (error: AxiosError) => Promise<AxiosResponse>;

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

  const createErrorConfig = (isRetry = false): InternalAxiosRequestConfig =>
    ({
      headers: new AxiosHeaders(),
      url: "https://api.example.com",
      method: "GET",
      ...(isRetry ? { __is402Retry: true } : {}),
    }) as InternalAxiosRequestConfig;

  const createAxiosError = (
    status: number,
    config?: InternalAxiosRequestConfig,
    data?: PaymentRequired,
    headers?: Record<string, string>,
  ): AxiosError => {
    return new AxiosError(
      "Error",
      "ERROR",
      config,
      {},
      {
        status,
        statusText: status === 402 ? "Payment Required" : "Not Found",
        data,
        headers: headers || {},
        config: config || createErrorConfig(),
      },
    );
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    // Mock axios client
    mockAxiosClient = {
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
      request: vi.fn(),
    } as unknown as AxiosInstance;

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

    // Set up the interceptor
    wrapAxiosWithPayment(mockAxiosClient, mockClient);
    interceptor = (mockAxiosClient.interceptors.response.use as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
  });

  it("should return the axios client instance", () => {
    const result = wrapAxiosWithPayment(mockAxiosClient, mockClient);
    expect(result).toBe(mockAxiosClient);
  });

  it("should set up response interceptor", () => {
    expect(mockAxiosClient.interceptors.response.use).toHaveBeenCalled();
  });

  it("should pass through successful responses", async () => {
    const successHandler = (mockAxiosClient.interceptors.response.use as ReturnType<typeof vi.fn>)
      .mock.calls[0][0];
    const response = { data: "success" } as AxiosResponse;
    expect(successHandler(response)).toBe(response);
  });

  it("should not handle non-402 errors", async () => {
    const error = createAxiosError(404);
    await expect(interceptor(error)).rejects.toBe(error);
  });

  it("should not handle errors without response", async () => {
    const error = new AxiosError("Network Error", "ECONNREFUSED");
    await expect(interceptor(error)).rejects.toBe(error);
  });

  it("should handle 402 errors and retry with payment header", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");
    const successResponse = { data: "success" } as AxiosResponse;

    (mockAxiosClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(successResponse);

    const error = createAxiosError(402, createErrorConfig(), validPaymentRequired, {
      "PAYMENT-REQUIRED": "encoded-payment-required",
    });

    const result = await interceptor(error);

    expect(result).toBe(successResponse);
    expect(MockT402HTTPClient.prototype.getPaymentRequiredResponse).toHaveBeenCalled();
    expect(mockClient.createPaymentPayload).toHaveBeenCalledWith(validPaymentRequired);
    expect(MockT402HTTPClient.prototype.encodePaymentSignatureHeader).toHaveBeenCalledWith(
      validPaymentPayload,
    );
    expect(mockAxiosClient.request).toHaveBeenCalled();

    // Verify the retry config has payment headers and retry flag
    const retryConfig = (mockAxiosClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(retryConfig.__is402Retry).toBe(true);
  });

  it("should not retry if already retried", async () => {
    const error = createAxiosError(402, createErrorConfig(true), validPaymentRequired);
    await expect(interceptor(error)).rejects.toBe(error);
  });

  it("should reject if missing request config", async () => {
    const error = createAxiosError(402, undefined, validPaymentRequired);
    await expect(interceptor(error)).rejects.toThrow("Missing axios request configuration");
  });

  it("should reject if missing headers in config", async () => {
    const configWithoutHeaders = {
      url: "https://api.example.com",
      method: "GET",
    } as InternalAxiosRequestConfig;

    const error = createAxiosError(402, configWithoutHeaders, validPaymentRequired);
    await expect(interceptor(error)).rejects.toThrow("Missing axios request configuration");
  });

  it("should reject with descriptive error if payment requirements parsing fails", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");
    (
      MockT402HTTPClient.prototype.getPaymentRequiredResponse as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw new Error("Invalid payment header format");
    });

    const error = createAxiosError(402, createErrorConfig(), undefined);
    await expect(interceptor(error)).rejects.toThrow(
      "Failed to parse payment requirements: Invalid payment header format",
    );
  });

  it("should reject with descriptive error if payment payload creation fails", async () => {
    const paymentError = new Error("Insufficient funds");
    (mockClient.createPaymentPayload as ReturnType<typeof vi.fn>).mockRejectedValue(paymentError);

    const error = createAxiosError(402, createErrorConfig(), validPaymentRequired);
    await expect(interceptor(error)).rejects.toThrow(
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

    const error = createAxiosError(402, createErrorConfig(), undefined);
    await expect(interceptor(error)).rejects.toThrow(
      "Failed to parse payment requirements: Unknown error",
    );
  });

  it("should reject with generic error message for unknown payment creation errors", async () => {
    (mockClient.createPaymentPayload as ReturnType<typeof vi.fn>).mockRejectedValue("String error");

    const error = createAxiosError(402, createErrorConfig(), validPaymentRequired);
    await expect(interceptor(error)).rejects.toThrow(
      "Failed to create payment payload: Unknown error",
    );
  });

  it("should handle v1 payment responses from body", async () => {
    const { t402HTTPClient: MockT402HTTPClient } = await import("@t402/core/client");
    const successResponse = { data: "success" } as AxiosResponse;

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
    (mockAxiosClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(successResponse);

    const error = createAxiosError(402, createErrorConfig(), v1PaymentRequired);

    const result = await interceptor(error);

    expect(result).toBe(successResponse);
    expect(MockT402HTTPClient.prototype.encodePaymentSignatureHeader).toHaveBeenCalledWith(
      v1PaymentPayload,
    );
  });

  it("should propagate retry errors", async () => {
    const retryError = new Error("Retry failed");
    (mockAxiosClient.request as ReturnType<typeof vi.fn>).mockRejectedValue(retryError);

    const error = createAxiosError(402, createErrorConfig(), validPaymentRequired);

    await expect(interceptor(error)).rejects.toBe(retryError);
  });

  it("should set Access-Control-Expose-Headers on retry request", async () => {
    const successResponse = { data: "success" } as AxiosResponse;
    (mockAxiosClient.request as ReturnType<typeof vi.fn>).mockResolvedValue(successResponse);

    const error = createAxiosError(402, createErrorConfig(), validPaymentRequired);

    await interceptor(error);

    const retryConfig = (mockAxiosClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(retryConfig.headers.get("Access-Control-Expose-Headers")).toBe(
      "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE",
    );
  });
});

describe("wrapAxiosWithPaymentFromConfig()", () => {
  let mockAxiosClient: AxiosInstance;

  beforeEach(async () => {
    vi.resetAllMocks();

    mockAxiosClient = {
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
      request: vi.fn(),
    } as unknown as AxiosInstance;

    const { t402Client: MockT402Client } = await import("@t402/core/client");
    (MockT402Client.fromConfig as ReturnType<typeof vi.fn>).mockReturnValue(new MockT402Client());
  });

  it("should create client from config and wrap axios", async () => {
    const { t402Client: MockT402Client } = await import("@t402/core/client");

    const config: t402ClientConfig = {
      schemes: [],
    };

    const result = wrapAxiosWithPaymentFromConfig(mockAxiosClient, config);

    expect(MockT402Client.fromConfig).toHaveBeenCalledWith(config);
    expect(result).toBe(mockAxiosClient);
    expect(mockAxiosClient.interceptors.response.use).toHaveBeenCalled();
  });

  it("should return the axios client instance", () => {
    const config: t402ClientConfig = {
      schemes: [],
    };

    const result = wrapAxiosWithPaymentFromConfig(mockAxiosClient, config);
    expect(result).toBe(mockAxiosClient);
  });
});
