package io.t402.errors;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.junit.jupiter.api.Assertions.*;

class ErrorCodeTest {

    @Test
    void allCodesHaveCorrectFormat() {
        for (ErrorCode code : ErrorCode.values()) {
            String codeStr = code.getCode();
            assertEquals(9, codeStr.length(), "Code " + code + " has wrong length");
            assertTrue(codeStr.startsWith("T402-"), "Code " + code + " missing T402- prefix");
            char category = codeStr.charAt(5);
            assertTrue(category >= '1' && category <= '8',
                    "Code " + code + " has invalid category: " + category);
        }
    }

    @Test
    void totalCodeCount() {
        assertEquals(66, ErrorCode.values().length);
    }

    @Test
    void categoryHelpers() {
        assertTrue(ErrorCode.INVALID_REQUEST.isClientError());
        assertFalse(ErrorCode.INVALID_REQUEST.isServerError());

        assertTrue(ErrorCode.INTERNAL.isServerError());
        assertFalse(ErrorCode.INTERNAL.isClientError());

        assertTrue(ErrorCode.VERIFICATION_FAILED.isFacilitatorError());
        assertTrue(ErrorCode.CHAIN_UNAVAILABLE.isChainError());
        assertTrue(ErrorCode.BRIDGE_UNAVAILABLE.isBridgeError());
    }

    @Test
    void httpStatusClientErrors() {
        assertEquals(400, ErrorCode.INVALID_REQUEST.httpStatus());
        assertEquals(400, ErrorCode.INVALID_SIGNATURE.httpStatus());
    }

    @Test
    void httpStatusRateLimited() {
        assertEquals(429, ErrorCode.RATE_LIMITED.httpStatus());
    }

    @Test
    void httpStatusServerErrors() {
        assertEquals(500, ErrorCode.INTERNAL.httpStatus());
    }

    @Test
    void httpStatusFacilitatorErrors() {
        assertEquals(422, ErrorCode.VERIFICATION_FAILED.httpStatus());
        assertEquals(422, ErrorCode.PAYMENT_MISMATCH.httpStatus());
        assertEquals(500, ErrorCode.SETTLEMENT_FAILED.httpStatus());
    }

    @Test
    void httpStatusChainAndBridgeErrors() {
        assertEquals(502, ErrorCode.CHAIN_UNAVAILABLE.httpStatus());
        assertEquals(502, ErrorCode.BRIDGE_UNAVAILABLE.httpStatus());
    }

    @Test
    void httpStatusDiscoveryErrors() {
        assertEquals(404, ErrorCode.RESOURCE_NOT_FOUND.httpStatus());
        assertEquals(409, ErrorCode.RESOURCE_ALREADY_EXISTS.httpStatus());
        assertEquals(403, ErrorCode.NOT_AUTHORIZED.httpStatus());
        assertEquals(400, ErrorCode.INVALID_PARAMETERS.httpStatus());
    }

    @Test
    void httpStatusStreamErrors() {
        assertEquals(404, ErrorCode.STREAM_NOT_FOUND.httpStatus());
        assertEquals(400, ErrorCode.STREAM_ALREADY_CLOSED.httpStatus());
    }

    @Test
    void httpStatusIntentErrors() {
        assertEquals(404, ErrorCode.INTENT_NOT_FOUND.httpStatus());
        assertEquals(400, ErrorCode.INTENT_EXPIRED.httpStatus());
    }

    @Test
    void fromCodeLookup() {
        assertEquals(ErrorCode.INVALID_REQUEST, ErrorCode.fromCode("T402-1001"));
        assertEquals(ErrorCode.SETTLEMENT_FAILED, ErrorCode.fromCode("T402-3002"));
        assertNull(ErrorCode.fromCode("INVALID"));
        assertNull(ErrorCode.fromCode("T402-9999"));
    }

    @Test
    void toStringReturnsCode() {
        assertEquals("T402-1001", ErrorCode.INVALID_REQUEST.toString());
        assertEquals("T402-3001", ErrorCode.VERIFICATION_FAILED.toString());
    }

    @ParameterizedTest
    @EnumSource(ErrorCode.class)
    void allCodesHaveValidHttpStatus(ErrorCode code) {
        int status = code.httpStatus();
        assertTrue(status >= 400 && status < 600,
                "Code " + code + " has invalid HTTP status: " + status);
    }
}
