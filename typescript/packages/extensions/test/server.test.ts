/**
 * Tests for Bazaar Server Extension
 */

import { describe, it, expect } from "vitest";
import { bazaarResourceServerExtension } from "../src/bazaar/server";

describe("bazaarResourceServerExtension", () => {
  describe("key", () => {
    it("should have the correct extension key", () => {
      expect(bazaarResourceServerExtension.key).toBe("bazaar");
    });
  });

  describe("enrichDeclaration", () => {
    it("should add method from HTTP context to declaration", () => {
      const declaration = {
        info: {
          input: {
            type: "http",
          },
        },
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: {
            input: {
              type: "object",
              properties: {
                type: { type: "string", const: "http" },
              },
              required: ["type"],
            },
          },
          required: ["input"],
        },
      };

      const httpContext = {
        method: "GET",
        adapter: {},
      };

      const enriched = bazaarResourceServerExtension.enrichDeclaration!(
        declaration,
        httpContext,
      );

      expect(enriched.info.input.method).toBe("GET");
    });

    it("should add method to schema required fields", () => {
      const declaration = {
        info: {
          input: {
            type: "http",
          },
        },
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: {
            input: {
              type: "object",
              properties: {
                type: { type: "string", const: "http" },
              },
              required: ["type"],
            },
          },
          required: ["input"],
        },
      };

      const httpContext = {
        method: "POST",
        adapter: {},
      };

      const enriched = bazaarResourceServerExtension.enrichDeclaration!(
        declaration,
        httpContext,
      );

      expect(enriched.schema.properties.input.required).toContain("method");
    });

    it("should not duplicate method in required if already present", () => {
      const declaration = {
        info: {
          input: {
            type: "http",
          },
        },
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: {
            input: {
              type: "object",
              properties: {
                type: { type: "string", const: "http" },
                method: { type: "string" },
              },
              required: ["type", "method"],
            },
          },
          required: ["input"],
        },
      };

      const httpContext = {
        method: "PUT",
        adapter: {},
      };

      const enriched = bazaarResourceServerExtension.enrichDeclaration!(
        declaration,
        httpContext,
      );

      const methodCount = enriched.schema.properties.input.required.filter(
        (r: string) => r === "method",
      ).length;
      expect(methodCount).toBe(1);
    });

    it("should return declaration unchanged for non-HTTP context", () => {
      const declaration = {
        info: {
          input: {
            type: "http",
          },
        },
        schema: {
          type: "object",
        },
      };

      // Non-HTTP context (missing method or adapter)
      const nonHttpContext = {
        someOtherProperty: "value",
      };

      const result = bazaarResourceServerExtension.enrichDeclaration!(
        declaration,
        nonHttpContext,
      );

      expect(result).toEqual(declaration);
    });

    it("should return declaration unchanged for null context", () => {
      const declaration = {
        info: {
          input: {
            type: "http",
          },
        },
        schema: {
          type: "object",
        },
      };

      const result = bazaarResourceServerExtension.enrichDeclaration!(
        declaration,
        null,
      );

      expect(result).toEqual(declaration);
    });

    it("should preserve existing info properties", () => {
      const declaration = {
        info: {
          input: {
            type: "http",
            queryParams: { limit: 10 },
          },
          output: {
            type: "json",
            example: { data: [] },
          },
        },
        schema: {
          type: "object",
          properties: {
            input: {
              type: "object",
              required: [],
            },
          },
        },
      };

      const httpContext = {
        method: "GET",
        adapter: {},
      };

      const enriched = bazaarResourceServerExtension.enrichDeclaration!(
        declaration,
        httpContext,
      );

      expect(enriched.info.input.queryParams).toEqual({ limit: 10 });
      expect(enriched.info.output).toEqual({ type: "json", example: { data: [] } });
    });

    it("should handle empty declaration gracefully", () => {
      const declaration = {};

      const httpContext = {
        method: "DELETE",
        adapter: {},
      };

      const enriched = bazaarResourceServerExtension.enrichDeclaration!(
        declaration,
        httpContext,
      );

      expect(enriched.info.input.method).toBe("DELETE");
    });

    it("should work with all HTTP methods", () => {
      const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

      for (const method of methods) {
        const declaration = {
          info: { input: { type: "http" } },
          schema: { properties: { input: { required: [] } } },
        };

        const httpContext = { method, adapter: {} };

        const enriched = bazaarResourceServerExtension.enrichDeclaration!(
          declaration,
          httpContext,
        );

        expect(enriched.info.input.method).toBe(method);
      }
    });
  });
});
