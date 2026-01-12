import { describe, it, expect, vi } from "vitest";
import type { FastifyRequest } from "fastify";
import { FastifyAdapter } from "./adapter";

/**
 * Factory for creating mock Fastify Request.
 *
 * @param options - Configuration options for the mock request.
 * @param options.url - The request URL (path + query string).
 * @param options.method - The HTTP method.
 * @param options.headers - Request headers (lowercase keys).
 * @param options.query - Query parameters.
 * @param options.body - Request body.
 * @param options.protocol - Protocol (http or https).
 * @param options.hostname - The hostname.
 * @returns A mock Fastify Request.
 */
function createMockRequest(
  options: {
    url?: string;
    method?: string;
    headers?: Record<string, string | string[]>;
    query?: Record<string, string | string[]>;
    body?: unknown;
    protocol?: string;
    hostname?: string;
  } = {},
): FastifyRequest {
  const mockRequest = {
    url: options.url || "/api/test",
    method: options.method || "GET",
    headers: options.headers || {},
    query: options.query || {},
    body: options.body,
    protocol: options.protocol || "https",
    hostname: options.hostname || "example.com",
  } as unknown as FastifyRequest;

  return mockRequest;
}

describe("FastifyAdapter", () => {
  describe("getHeader", () => {
    it("returns header value when present", () => {
      const request = createMockRequest({ headers: { "x-payment": "test-payment" } });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getHeader("X-Payment")).toBe("test-payment");
    });

    it("returns first value when header has multiple values", () => {
      const request = createMockRequest({ headers: { "x-custom": ["first", "second"] } });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getHeader("X-Custom")).toBe("first");
    });

    it("returns undefined for missing headers", () => {
      const request = createMockRequest();
      const adapter = new FastifyAdapter(request);
      expect(adapter.getHeader("X-Missing")).toBeUndefined();
    });

    it("is case insensitive", () => {
      const request = createMockRequest({ headers: { "content-type": "application/json" } });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getHeader("Content-Type")).toBe("application/json");
    });
  });

  describe("getMethod", () => {
    it("returns the HTTP method", () => {
      const request = createMockRequest({ method: "POST" });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getMethod()).toBe("POST");
    });

    it("returns GET by default", () => {
      const request = createMockRequest();
      const adapter = new FastifyAdapter(request);
      expect(adapter.getMethod()).toBe("GET");
    });
  });

  describe("getPath", () => {
    it("returns the pathname without query string", () => {
      const request = createMockRequest({ url: "/api/weather?city=NYC" });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getPath()).toBe("/api/weather");
    });

    it("returns path when no query string present", () => {
      const request = createMockRequest({ url: "/api/test" });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getPath()).toBe("/api/test");
    });

    it("handles root path", () => {
      const request = createMockRequest({ url: "/" });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getPath()).toBe("/");
    });
  });

  describe("getUrl", () => {
    it("returns the full URL", () => {
      const request = createMockRequest({
        protocol: "https",
        hostname: "example.com",
        url: "/api/test?foo=bar",
      });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getUrl()).toBe("https://example.com/api/test?foo=bar");
    });

    it("constructs URL from protocol and hostname", () => {
      const request = createMockRequest({
        protocol: "http",
        hostname: "localhost:3000",
        url: "/api/data",
      });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getUrl()).toBe("http://localhost:3000/api/data");
    });
  });

  describe("getAcceptHeader", () => {
    it("returns Accept header when present", () => {
      const request = createMockRequest({ headers: { accept: "text/html" } });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getAcceptHeader()).toBe("text/html");
    });

    it("returns empty string when missing", () => {
      const request = createMockRequest();
      const adapter = new FastifyAdapter(request);
      expect(adapter.getAcceptHeader()).toBe("");
    });
  });

  describe("getUserAgent", () => {
    it("returns User-Agent header when present", () => {
      const request = createMockRequest({ headers: { "user-agent": "Mozilla/5.0" } });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getUserAgent()).toBe("Mozilla/5.0");
    });

    it("returns empty string when missing", () => {
      const request = createMockRequest();
      const adapter = new FastifyAdapter(request);
      expect(adapter.getUserAgent()).toBe("");
    });
  });

  describe("getQueryParams", () => {
    it("returns all query parameters", () => {
      const request = createMockRequest({ query: { foo: "bar", baz: "qux" } });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getQueryParams()).toEqual({ foo: "bar", baz: "qux" });
    });

    it("returns empty object when no query params", () => {
      const request = createMockRequest({ query: {} });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getQueryParams()).toEqual({});
    });

    it("handles array values", () => {
      const request = createMockRequest({ query: { tags: ["a", "b", "c"] } });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getQueryParams()).toEqual({ tags: ["a", "b", "c"] });
    });
  });

  describe("getQueryParam", () => {
    it("returns single value for single param", () => {
      const request = createMockRequest({ query: { city: "NYC" } });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getQueryParam("city")).toBe("NYC");
    });

    it("returns undefined for missing param", () => {
      const request = createMockRequest({ query: {} });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getQueryParam("missing")).toBeUndefined();
    });

    it("returns array for multiple values", () => {
      const request = createMockRequest({ query: { ids: ["1", "2", "3"] } });
      const adapter = new FastifyAdapter(request);
      expect(adapter.getQueryParam("ids")).toEqual(["1", "2", "3"]);
    });
  });

  describe("getBody", () => {
    it("returns parsed body", async () => {
      const body = { data: "test" };
      const request = createMockRequest({ body });
      const adapter = new FastifyAdapter(request);
      expect(await adapter.getBody()).toEqual(body);
    });

    it("returns undefined when no body", async () => {
      const request = createMockRequest();
      const adapter = new FastifyAdapter(request);
      expect(await adapter.getBody()).toBeUndefined();
    });
  });
});
