import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HTTPFacilitatorClient } from "../../../src/http/httpFacilitatorClient";
import { T402PaymentError } from "../../../src/errors";
import { buildPaymentPayload, buildPaymentRequirements } from "../../mocks";

describe("HTTPFacilitatorClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(status: number, body: unknown = {}, statusText = "Error") {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body)),
    });
  }

  describe("verify", () => {
    it("should throw T402PaymentError with verification phase on failure", async () => {
      mockFetch(502, "Bad Gateway");
      const client = new HTTPFacilitatorClient();
      const payload = buildPaymentPayload();
      const requirements = buildPaymentRequirements();

      await expect(client.verify(payload, requirements)).rejects.toThrow(T402PaymentError);
      try {
        await client.verify(payload, requirements);
      } catch (err) {
        const e = err as T402PaymentError;
        expect(e.phase).toBe("verification");
        expect(e.code).toBe(502);
        expect(e.retryable).toBe(true);
      }
    });

    it("should mark 4xx errors as non-retryable", async () => {
      mockFetch(400, "Bad Request");
      const client = new HTTPFacilitatorClient();

      try {
        await client.verify(buildPaymentPayload(), buildPaymentRequirements());
      } catch (err) {
        const e = err as T402PaymentError;
        expect(e.retryable).toBe(false);
        expect(e.code).toBe(400);
      }
    });

    it("should mark 429 as retryable", async () => {
      mockFetch(429, "Rate limited");
      const client = new HTTPFacilitatorClient();

      try {
        await client.verify(buildPaymentPayload(), buildPaymentRequirements());
      } catch (err) {
        const e = err as T402PaymentError;
        expect(e.retryable).toBe(true);
        expect(e.code).toBe(429);
      }
    });

    it("should return VerifyResponse on success", async () => {
      const verifyResp = { valid: true, message: "ok" };
      mockFetch(200, verifyResp);
      const client = new HTTPFacilitatorClient();
      const result = await client.verify(buildPaymentPayload(), buildPaymentRequirements());
      expect(result).toEqual(verifyResp);
    });
  });

  describe("settle", () => {
    it("should throw T402PaymentError with settlement phase on failure", async () => {
      mockFetch(500, "Internal Server Error");
      const client = new HTTPFacilitatorClient();

      await expect(
        client.settle(buildPaymentPayload(), buildPaymentRequirements()),
      ).rejects.toThrow(T402PaymentError);

      try {
        await client.settle(buildPaymentPayload(), buildPaymentRequirements());
      } catch (err) {
        const e = err as T402PaymentError;
        expect(e.phase).toBe("settlement");
        expect(e.code).toBe(500);
        expect(e.retryable).toBe(true);
      }
    });
  });

  describe("getSupported", () => {
    it("should throw T402PaymentError on failure", async () => {
      mockFetch(503, "Service Unavailable");
      const client = new HTTPFacilitatorClient();

      await expect(client.getSupported()).rejects.toThrow(T402PaymentError);

      try {
        await client.getSupported();
      } catch (err) {
        const e = err as T402PaymentError;
        expect(e.phase).toBe("unknown");
        expect(e.code).toBe(503);
        expect(e.retryable).toBe(true);
      }
    });
  });
});
