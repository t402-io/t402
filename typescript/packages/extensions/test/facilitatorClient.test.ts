/**
 * Tests for Bazaar Facilitator Client Extension
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withBazaar,
  type ListDiscoveryResourcesParams,
  type DiscoveryResourcesResponse,
} from "../src/bazaar/facilitatorClient";

// Mock HTTPFacilitatorClient
class MockHTTPFacilitatorClient {
  url: string;

  constructor(url: string = "https://facilitator.example.com") {
    this.url = url;
  }

  async createAuthHeaders(_scope: string): Promise<{ headers: Record<string, string> }> {
    return { headers: { Authorization: "Bearer test-token" } };
  }
}

describe("withBazaar", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("extension structure", () => {
    it("should add discovery extension to client", () => {
      const client = new MockHTTPFacilitatorClient();
      const extended = withBazaar(client);

      expect(extended.extensions).toBeDefined();
      expect(extended.extensions.discovery).toBeDefined();
      expect(typeof extended.extensions.discovery.listResources).toBe("function");
    });

    it("should preserve existing extensions", () => {
      const client = new MockHTTPFacilitatorClient() as MockHTTPFacilitatorClient & {
        extensions: { existing: { value: number } };
      };
      client.extensions = { existing: { value: 42 } };

      const extended = withBazaar(client);

      expect(extended.extensions.existing).toBeDefined();
      expect(extended.extensions.existing.value).toBe(42);
      expect(extended.extensions.discovery).toBeDefined();
    });

    it("should preserve original client properties", () => {
      const client = new MockHTTPFacilitatorClient("https://custom.url.com");
      const extended = withBazaar(client);

      expect(extended.url).toBe("https://custom.url.com");
    });
  });

  describe("listResources", () => {
    it("should call fetch with correct endpoint", async () => {
      const mockResponse: DiscoveryResourcesResponse = {
        resources: [{ url: "https://api.example.com/data", type: "http" }],
        total: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new MockHTTPFacilitatorClient("https://facilitator.test.com");
      const extended = withBazaar(client);

      const result = await extended.extensions.discovery.listResources();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://facilitator.test.com/discovery/resources",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it("should include type query parameter when specified", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [] }),
      });

      const client = new MockHTTPFacilitatorClient();
      const extended = withBazaar(client);

      await extended.extensions.discovery.listResources({ type: "http" });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("type=http"),
        expect.any(Object),
      );
    });

    it("should include limit query parameter when specified", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [] }),
      });

      const client = new MockHTTPFacilitatorClient();
      const extended = withBazaar(client);

      await extended.extensions.discovery.listResources({ limit: 10 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=10"),
        expect.any(Object),
      );
    });

    it("should include offset query parameter when specified", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [] }),
      });

      const client = new MockHTTPFacilitatorClient();
      const extended = withBazaar(client);

      await extended.extensions.discovery.listResources({ offset: 20 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("offset=20"),
        expect.any(Object),
      );
    });

    it("should include all query parameters when specified", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [] }),
      });

      const client = new MockHTTPFacilitatorClient();
      const extended = withBazaar(client);

      const params: ListDiscoveryResourcesParams = {
        type: "http",
        limit: 50,
        offset: 100,
      };

      await extended.extensions.discovery.listResources(params);

      const callUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(callUrl).toContain("type=http");
      expect(callUrl).toContain("limit=50");
      expect(callUrl).toContain("offset=100");
    });

    it("should not include query string when no params provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ resources: [] }),
      });

      const client = new MockHTTPFacilitatorClient("https://test.com");
      const extended = withBazaar(client);

      await extended.extensions.discovery.listResources();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://test.com/discovery/resources",
        expect.any(Object),
      );
    });

    it("should throw error on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Server error details"),
      });

      const client = new MockHTTPFacilitatorClient();
      const extended = withBazaar(client);

      await expect(extended.extensions.discovery.listResources()).rejects.toThrow(
        "Facilitator listDiscoveryResources failed (500): Server error details",
      );
    });

    it("should handle text() failure gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.reject(new Error("Cannot read body")),
      });

      const client = new MockHTTPFacilitatorClient();
      const extended = withBazaar(client);

      await expect(extended.extensions.discovery.listResources()).rejects.toThrow(
        "Facilitator listDiscoveryResources failed (404): Not Found",
      );
    });

    it("should return resources with metadata", async () => {
      const mockResponse: DiscoveryResourcesResponse = {
        resources: [
          {
            url: "https://api.example.com/weather",
            type: "http",
            metadata: {
              method: "GET",
              description: "Get weather data",
            },
          },
          {
            url: "https://api.example.com/search",
            type: "http",
            metadata: {
              method: "POST",
              description: "Search resources",
            },
          },
        ],
        total: 2,
        limit: 10,
        offset: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new MockHTTPFacilitatorClient();
      const extended = withBazaar(client);

      const result = await extended.extensions.discovery.listResources();

      expect(result.resources).toHaveLength(2);
      expect(result.resources[0].metadata?.method).toBe("GET");
      expect(result.resources[1].metadata?.method).toBe("POST");
      expect(result.total).toBe(2);
    });
  });

  describe("type inference", () => {
    it("should maintain type compatibility with original client methods", () => {
      const client = new MockHTTPFacilitatorClient();
      const extended = withBazaar(client);

      // Should still have access to original client properties
      expect(extended.url).toBeDefined();
      expect(typeof extended.createAuthHeaders).toBe("function");
    });
  });
});
