import { describe, it, expect } from "vitest";
import {
  declarePaymentIdExtension,
  parsePaymentIdPayload,
  validatePaymentId,
} from "./server.js";
import { PAYMENT_ID_EXTENSION_KEY } from "./types.js";

describe("Payment ID Server", () => {
  describe("declarePaymentIdExtension", () => {
    it("should generate a UUID v4 id by default", () => {
      const extension = declarePaymentIdExtension();

      expect(extension.info.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(extension.schema).toBeDefined();
    });

    it("should use custom id when provided", () => {
      const extension = declarePaymentIdExtension({ id: "custom-id-123" });

      expect(extension.info.id).toBe("custom-id-123");
    });

    it("should include optional fields when provided", () => {
      const extension = declarePaymentIdExtension({
        idempotencyKey: "idem-key-1",
        groupId: "group-1",
        metadata: { orderId: "order-123", userId: "user-456" },
      });

      expect(extension.info.idempotencyKey).toBe("idem-key-1");
      expect(extension.info.groupId).toBe("group-1");
      expect(extension.info.metadata).toEqual({
        orderId: "order-123",
        userId: "user-456",
      });
    });

    it("should not include optional fields when not provided", () => {
      const extension = declarePaymentIdExtension();

      expect(extension.info.idempotencyKey).toBeUndefined();
      expect(extension.info.groupId).toBeUndefined();
      expect(extension.info.metadata).toBeUndefined();
    });

    it("should include JSON schema", () => {
      const extension = declarePaymentIdExtension();

      expect(extension.schema).toHaveProperty("type", "object");
      expect(extension.schema).toHaveProperty("required");
    });

    it("should generate unique IDs on each call", () => {
      const ext1 = declarePaymentIdExtension();
      const ext2 = declarePaymentIdExtension();

      expect(ext1.info.id).not.toBe(ext2.info.id);
    });
  });

  describe("parsePaymentIdPayload", () => {
    it("should parse valid payment ID payload", () => {
      const extensions = {
        [PAYMENT_ID_EXTENSION_KEY]: {
          id: "test-id-123",
          clientId: "client-456",
        },
      };

      const payload = parsePaymentIdPayload(extensions);

      expect(payload).not.toBeNull();
      expect(payload!.id).toBe("test-id-123");
      expect(payload!.clientId).toBe("client-456");
    });

    it("should return null when extension is not present", () => {
      const payload = parsePaymentIdPayload({});
      expect(payload).toBeNull();
    });

    it("should return null when extensions is undefined", () => {
      const payload = parsePaymentIdPayload(undefined);
      expect(payload).toBeNull();
    });

    it("should parse payload without clientId", () => {
      const extensions = {
        [PAYMENT_ID_EXTENSION_KEY]: { id: "test-id-123" },
      };

      const payload = parsePaymentIdPayload(extensions);

      expect(payload).not.toBeNull();
      expect(payload!.id).toBe("test-id-123");
      expect(payload!.clientId).toBeUndefined();
    });

    it("should throw on invalid extension value", () => {
      const extensions = {
        [PAYMENT_ID_EXTENSION_KEY]: "not-an-object",
      };

      expect(() => parsePaymentIdPayload(extensions)).toThrow("expected object");
    });

    it("should throw on missing id", () => {
      const extensions = {
        [PAYMENT_ID_EXTENSION_KEY]: { clientId: "test" },
      };

      expect(() => parsePaymentIdPayload(extensions)).toThrow("missing or empty id");
    });

    it("should throw on empty id", () => {
      const extensions = {
        [PAYMENT_ID_EXTENSION_KEY]: { id: "" },
      };

      expect(() => parsePaymentIdPayload(extensions)).toThrow("missing or empty id");
    });
  });

  describe("validatePaymentId", () => {
    it("should return true when IDs match", () => {
      const result = validatePaymentId({ id: "test-id" }, { id: "test-id" });
      expect(result).toBe(true);
    });

    it("should return false when IDs do not match", () => {
      const result = validatePaymentId({ id: "test-id-1" }, { id: "test-id-2" });
      expect(result).toBe(false);
    });

    it("should validate with clientId present", () => {
      const result = validatePaymentId(
        { id: "test-id", clientId: "client-1" },
        { id: "test-id" },
      );
      expect(result).toBe(true);
    });
  });
});
