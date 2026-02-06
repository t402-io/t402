import { describe, it, expect } from "vitest";
import {
  ERR_INVALID_REQUEST,
  ERR_INTERNAL,
  ERR_RATE_LIMITED,
  ERR_VERIFICATION_FAILED,
  ERR_PAYMENT_MISMATCH,
  ERR_CHAIN_UNAVAILABLE,
  ERR_BRIDGE_UNAVAILABLE,
  ERR_STREAM_NOT_FOUND,
  ERR_STREAM_ALREADY_CLOSED,
  ERR_INTENT_NOT_FOUND,
  ERR_RESOURCE_NOT_FOUND,
  ERR_RESOURCE_ALREADY_EXISTS,
  ERR_NOT_AUTHORIZED,
  ERR_INVALID_PARAMETERS,
  ERR_SETTLEMENT_FAILED,
  httpStatusForCode,
  isClientError,
  isServerError,
  isFacilitatorError,
  isChainError,
  isBridgeError,
} from "../../../src/types/errors";

describe("T402 Error Codes", () => {
  it("should have correct T402 prefix format", () => {
    expect(ERR_INVALID_REQUEST).toBe("T402-1001");
    expect(ERR_INTERNAL).toBe("T402-2001");
    expect(ERR_VERIFICATION_FAILED).toBe("T402-3001");
    expect(ERR_CHAIN_UNAVAILABLE).toBe("T402-4001");
    expect(ERR_BRIDGE_UNAVAILABLE).toBe("T402-5001");
    expect(ERR_STREAM_NOT_FOUND).toBe("T402-6001");
    expect(ERR_INTENT_NOT_FOUND).toBe("T402-7001");
    expect(ERR_RESOURCE_NOT_FOUND).toBe("T402-8001");
  });
});

describe("httpStatusForCode", () => {
  it("should return 400 for client errors", () => {
    expect(httpStatusForCode(ERR_INVALID_REQUEST)).toBe(400);
  });

  it("should return 429 for rate limited", () => {
    expect(httpStatusForCode(ERR_RATE_LIMITED)).toBe(429);
  });

  it("should return 500 for server errors", () => {
    expect(httpStatusForCode(ERR_INTERNAL)).toBe(500);
  });

  it("should return 422 for verification/mismatch errors", () => {
    expect(httpStatusForCode(ERR_VERIFICATION_FAILED)).toBe(422);
    expect(httpStatusForCode(ERR_PAYMENT_MISMATCH)).toBe(422);
  });

  it("should return 500 for other facilitator errors", () => {
    expect(httpStatusForCode(ERR_SETTLEMENT_FAILED)).toBe(500);
  });

  it("should return 502 for chain errors", () => {
    expect(httpStatusForCode(ERR_CHAIN_UNAVAILABLE)).toBe(502);
  });

  it("should return 502 for bridge errors", () => {
    expect(httpStatusForCode(ERR_BRIDGE_UNAVAILABLE)).toBe(502);
  });

  it("should return 404 for not found errors", () => {
    expect(httpStatusForCode(ERR_STREAM_NOT_FOUND)).toBe(404);
    expect(httpStatusForCode(ERR_INTENT_NOT_FOUND)).toBe(404);
    expect(httpStatusForCode(ERR_RESOURCE_NOT_FOUND)).toBe(404);
  });

  it("should return 400 for other stream/intent errors", () => {
    expect(httpStatusForCode(ERR_STREAM_ALREADY_CLOSED)).toBe(400);
  });

  it("should return correct discovery statuses", () => {
    expect(httpStatusForCode(ERR_RESOURCE_ALREADY_EXISTS)).toBe(409);
    expect(httpStatusForCode(ERR_NOT_AUTHORIZED)).toBe(403);
    expect(httpStatusForCode(ERR_INVALID_PARAMETERS)).toBe(400);
  });
});

describe("Category helpers", () => {
  it("isClientError", () => {
    expect(isClientError(ERR_INVALID_REQUEST)).toBe(true);
    expect(isClientError(ERR_INTERNAL)).toBe(false);
  });

  it("isServerError", () => {
    expect(isServerError(ERR_INTERNAL)).toBe(true);
    expect(isServerError(ERR_INVALID_REQUEST)).toBe(false);
  });

  it("isFacilitatorError", () => {
    expect(isFacilitatorError(ERR_VERIFICATION_FAILED)).toBe(true);
    expect(isFacilitatorError(ERR_INVALID_REQUEST)).toBe(false);
  });

  it("isChainError", () => {
    expect(isChainError(ERR_CHAIN_UNAVAILABLE)).toBe(true);
  });

  it("isBridgeError", () => {
    expect(isBridgeError(ERR_BRIDGE_UNAVAILABLE)).toBe(true);
  });
});
