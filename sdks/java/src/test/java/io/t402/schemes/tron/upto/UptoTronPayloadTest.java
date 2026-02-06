package io.t402.schemes.tron.upto;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for TRON Up-To scheme types.
 */
class UptoTronPayloadTest {

    /* ------------ UptoTronAuthorization Tests ------------ */

    @Test
    void authorizationStructure() {
        UptoTronAuthorization auth = new UptoTronAuthorization(
            "TXyz1234567890123456789012345678ab",
            "TAbcdefghijklmnopqrstuvwxyz123456",
            "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "10000000",
            1740675689000L,
            "abcd",
            "1234567890abcdef",
            1740672089000L
        );

        assertTrue(auth.owner.startsWith("T"));
        assertTrue(auth.spender.startsWith("T"));
        assertEquals("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", auth.contractAddress);
        assertEquals("10000000", auth.maxAmount);
        assertEquals(1740675689000L, auth.expiration);
        assertEquals("abcd", auth.refBlockBytes);
        assertEquals("1234567890abcdef", auth.refBlockHash);
        assertEquals(1740672089000L, auth.timestamp);
    }

    @Test
    void authorizationBuilder() {
        UptoTronAuthorization auth = UptoTronAuthorization.builder()
            .owner("TOwner123")
            .spender("TSpender456")
            .contractAddress("TContract789")
            .maxAmount("5000000")
            .expiration(1740675689000L)
            .refBlockBytes("ef01")
            .refBlockHash("abcdef0123456789")
            .timestamp(1740672089000L)
            .build();

        assertEquals("TOwner123", auth.owner);
        assertEquals("TSpender456", auth.spender);
        assertEquals("TContract789", auth.contractAddress);
        assertEquals("5000000", auth.maxAmount);
        assertEquals(1740675689000L, auth.expiration);
        assertEquals("ef01", auth.refBlockBytes);
        assertEquals("abcdef0123456789", auth.refBlockHash);
        assertEquals(1740672089000L, auth.timestamp);
    }

    @Test
    void authorizationToMap() {
        UptoTronAuthorization auth = new UptoTronAuthorization(
            "TOwner", "TSpender", "TContract", "10000000",
            1740675689000L, "abcd", "12345678", 1740672089000L
        );

        Map<String, Object> map = auth.toMap();

        assertEquals("TOwner", map.get("owner"));
        assertEquals("TSpender", map.get("spender"));
        assertEquals("TContract", map.get("contractAddress"));
        assertEquals("10000000", map.get("maxAmount"));
        assertEquals(1740675689000L, map.get("expiration"));
        assertEquals("abcd", map.get("refBlockBytes"));
        assertEquals("12345678", map.get("refBlockHash"));
        assertEquals(1740672089000L, map.get("timestamp"));
    }

    /* ------------ UptoTronPayload Tests ------------ */

    @Test
    void payloadStructure() {
        UptoTronAuthorization auth = new UptoTronAuthorization(
            "TOwner123", "TSpender456", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "10000000", 1740675689000L, "abcd", "1234567890abcdef", 1740672089000L
        );

        UptoTronPayload payload = new UptoTronPayload(
            "a1b2c3d4e5f6",
            auth,
            "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480"
        );

        assertEquals("a1b2c3d4e5f6", payload.signedTransaction);
        assertEquals("TOwner123", payload.authorization.owner);
        assertEquals("10000000", payload.authorization.maxAmount);
        assertEquals(66, payload.paymentNonce.length());
    }

    @Test
    void payloadBuilder() {
        UptoTronPayload payload = UptoTronPayload.builder()
            .signedTransaction("a1b2c3d4e5f6")
            .authorization(UptoTronAuthorization.builder()
                .owner("TOwner123")
                .spender("TSpender456")
                .contractAddress("TContract789")
                .maxAmount("10000000")
                .expiration(1740675689000L)
                .refBlockBytes("abcd")
                .refBlockHash("1234567890abcdef")
                .timestamp(1740672089000L)
                .build())
            .paymentNonce("0xnonce123")
            .build();

        assertEquals("a1b2c3d4e5f6", payload.signedTransaction);
        assertEquals("TOwner123", payload.authorization.owner);
        assertEquals("TSpender456", payload.authorization.spender);
        assertEquals("0xnonce123", payload.paymentNonce);
    }

    @Test
    void payloadToMap() {
        UptoTronAuthorization auth = new UptoTronAuthorization(
            "TOwner", "TSpender", "TContract", "10000000",
            1740675689000L, "abcd", "12345678", 1740672089000L
        );

        UptoTronPayload payload = new UptoTronPayload("a1b2c3d4", auth, "0xnonce");

        Map<String, Object> result = payload.toMap();

        assertEquals("a1b2c3d4", result.get("signedTransaction"));
        assertEquals("0xnonce", result.get("paymentNonce"));

        @SuppressWarnings("unchecked")
        Map<String, Object> authMap = (Map<String, Object>) result.get("authorization");
        assertEquals("TOwner", authMap.get("owner"));
        assertEquals("TSpender", authMap.get("spender"));
        assertEquals("TContract", authMap.get("contractAddress"));
        assertEquals("10000000", authMap.get("maxAmount"));
        assertEquals(1740675689000L, authMap.get("expiration"));
    }

    @Test
    void payloadFromMap() {
        Map<String, Object> data = new HashMap<>();
        data.put("signedTransaction", "a1b2c3d4e5f6");
        data.put("paymentNonce", "0xabc123");
        data.put("authorization", Map.of(
            "owner", "TOwner123",
            "spender", "TSpender456",
            "contractAddress", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "maxAmount", "10000000",
            "expiration", 1740675689000L,
            "refBlockBytes", "abcd",
            "refBlockHash", "1234567890abcdef",
            "timestamp", 1740672089000L
        ));

        UptoTronPayload payload = UptoTronPayload.fromMap(data);

        assertEquals("a1b2c3d4e5f6", payload.signedTransaction);
        assertEquals("0xabc123", payload.paymentNonce);
        assertEquals("TOwner123", payload.authorization.owner);
        assertEquals("TSpender456", payload.authorization.spender);
        assertEquals("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", payload.authorization.contractAddress);
        assertEquals("10000000", payload.authorization.maxAmount);
        assertEquals(1740675689000L, payload.authorization.expiration);
        assertEquals("abcd", payload.authorization.refBlockBytes);
        assertEquals("1234567890abcdef", payload.authorization.refBlockHash);
        assertEquals(1740672089000L, payload.authorization.timestamp);
    }

    @Test
    void payloadFromMapRoundTrip() {
        UptoTronAuthorization auth = new UptoTronAuthorization(
            "TOwner", "TSpender", "TContract", "10000000",
            1740675689000L, "abcd", "12345678", 1740672089000L
        );
        UptoTronPayload original = new UptoTronPayload("a1b2c3d4", auth, "0xnonce");

        Map<String, Object> map = original.toMap();
        UptoTronPayload restored = UptoTronPayload.fromMap(map);

        assertEquals(original.signedTransaction, restored.signedTransaction);
        assertEquals(original.paymentNonce, restored.paymentNonce);
        assertEquals(original.authorization.owner, restored.authorization.owner);
        assertEquals(original.authorization.spender, restored.authorization.spender);
        assertEquals(original.authorization.contractAddress, restored.authorization.contractAddress);
        assertEquals(original.authorization.maxAmount, restored.authorization.maxAmount);
        assertEquals(original.authorization.expiration, restored.authorization.expiration);
    }

    /* ------------ isValid Tests ------------ */

    @Test
    void isValidWithValidPayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("signedTransaction", "a1b2c3d4");
        payload.put("paymentNonce", "0xnonce");
        payload.put("authorization", Map.of(
            "owner", "TOwner123",
            "spender", "TSpender456",
            "contractAddress", "TContract789",
            "maxAmount", "10000000",
            "expiration", 1740675689000L,
            "refBlockBytes", "abcd",
            "refBlockHash", "12345678",
            "timestamp", 1740672089000L
        ));

        assertTrue(UptoTronPayload.isValid(payload));
    }

    @Test
    void isValidRejectsNull() {
        assertFalse(UptoTronPayload.isValid(null));
    }

    @Test
    void isValidRejectsEmptyMap() {
        assertFalse(UptoTronPayload.isValid(new HashMap<>()));
    }

    @Test
    void isValidRejectsMissingSignedTransaction() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("paymentNonce", "0xnonce");
        payload.put("authorization", Map.of(
            "owner", "TOwner",
            "spender", "TSpender",
            "contractAddress", "TContract",
            "maxAmount", "10000000",
            "expiration", 1740675689000L,
            "refBlockBytes", "abcd",
            "refBlockHash", "12345678",
            "timestamp", 1740672089000L
        ));

        assertFalse(UptoTronPayload.isValid(payload));
    }

    @Test
    void isValidRejectsEmptySignedTransaction() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("signedTransaction", "");
        payload.put("paymentNonce", "0xnonce");
        payload.put("authorization", Map.of(
            "owner", "TOwner",
            "spender", "TSpender",
            "contractAddress", "TContract",
            "maxAmount", "10000000",
            "expiration", 1740675689000L,
            "refBlockBytes", "abcd",
            "refBlockHash", "12345678",
            "timestamp", 1740672089000L
        ));

        assertFalse(UptoTronPayload.isValid(payload));
    }

    @Test
    void isValidRejectsMissingPaymentNonce() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("signedTransaction", "a1b2c3d4");
        payload.put("authorization", Map.of(
            "owner", "TOwner",
            "spender", "TSpender",
            "contractAddress", "TContract",
            "maxAmount", "10000000",
            "expiration", 1740675689000L,
            "refBlockBytes", "abcd",
            "refBlockHash", "12345678",
            "timestamp", 1740672089000L
        ));

        assertFalse(UptoTronPayload.isValid(payload));
    }

    @Test
    void isValidRejectsMissingAuthorization() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("signedTransaction", "a1b2c3d4");
        payload.put("paymentNonce", "0xnonce");

        assertFalse(UptoTronPayload.isValid(payload));
    }

    @Test
    void isValidRejectsNonMapAuthorization() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("signedTransaction", "a1b2c3d4");
        payload.put("paymentNonce", "0xnonce");
        payload.put("authorization", "not a map");

        assertFalse(UptoTronPayload.isValid(payload));
    }

    @Test
    void isValidRejectsMissingOwner() {
        Map<String, Object> authMap = new HashMap<>();
        authMap.put("spender", "TSpender");
        authMap.put("contractAddress", "TContract");
        authMap.put("maxAmount", "10000000");
        authMap.put("expiration", 1740675689000L);
        authMap.put("refBlockBytes", "abcd");
        authMap.put("refBlockHash", "12345678");
        authMap.put("timestamp", 1740672089000L);

        Map<String, Object> payload = new HashMap<>();
        payload.put("signedTransaction", "a1b2c3d4");
        payload.put("paymentNonce", "0xnonce");
        payload.put("authorization", authMap);

        assertFalse(UptoTronPayload.isValid(payload));
    }

    @Test
    void isValidRejectsMissingSpender() {
        Map<String, Object> authMap = new HashMap<>();
        authMap.put("owner", "TOwner");
        authMap.put("contractAddress", "TContract");
        authMap.put("maxAmount", "10000000");
        authMap.put("expiration", 1740675689000L);
        authMap.put("refBlockBytes", "abcd");
        authMap.put("refBlockHash", "12345678");
        authMap.put("timestamp", 1740672089000L);

        Map<String, Object> payload = new HashMap<>();
        payload.put("signedTransaction", "a1b2c3d4");
        payload.put("paymentNonce", "0xnonce");
        payload.put("authorization", authMap);

        assertFalse(UptoTronPayload.isValid(payload));
    }

    @Test
    void isValidRejectsExactSchemePayload() {
        // Exact scheme uses from/to/amount, not owner/spender/maxAmount
        Map<String, Object> exactAuth = new HashMap<>();
        exactAuth.put("from", "TOwner");
        exactAuth.put("to", "TRecipient");
        exactAuth.put("contractAddress", "TContract");
        exactAuth.put("amount", "1000000");
        exactAuth.put("expiration", 1740675689000L);
        exactAuth.put("refBlockBytes", "abcd");
        exactAuth.put("refBlockHash", "12345678");
        exactAuth.put("timestamp", 1740672089000L);

        Map<String, Object> payload = new HashMap<>();
        payload.put("signedTransaction", "a1b2c3d4");
        payload.put("paymentNonce", "0xnonce");
        payload.put("authorization", exactAuth);

        assertFalse(UptoTronPayload.isValid(payload));
    }

    /* ------------ UptoTronExtra Tests ------------ */

    @Test
    void extraWithAllFields() {
        UptoTronExtra extra = UptoTronExtra.of("10000000", "100000")
            .withUnit("request")
            .withUnitPrice("50000")
            .withSpenderAddress("TSpender123");

        assertEquals("10000000", extra.maxAmount);
        assertEquals("100000", extra.minAmount);
        assertEquals("request", extra.unit);
        assertEquals("50000", extra.unitPrice);
        assertEquals("TSpender123", extra.spenderAddress);
    }

    @Test
    void extraWithMinimalFields() {
        UptoTronExtra extra = new UptoTronExtra();

        assertNull(extra.maxAmount);
        assertNull(extra.minAmount);
        assertNull(extra.unit);
        assertNull(extra.unitPrice);
        assertNull(extra.spenderAddress);
    }

    @Test
    void extraWithAmountsOnly() {
        UptoTronExtra extra = new UptoTronExtra("10000000", "100000");

        assertEquals("10000000", extra.maxAmount);
        assertEquals("100000", extra.minAmount);
        assertNull(extra.unit);
        assertNull(extra.unitPrice);
        assertNull(extra.spenderAddress);
    }

    @Test
    void extraChaining() {
        UptoTronExtra extra = new UptoTronExtra("5000000", "500000")
            .withUnit("token")
            .withUnitPrice("100");

        assertEquals("5000000", extra.maxAmount);
        assertEquals("500000", extra.minAmount);
        assertEquals("token", extra.unit);
        assertEquals("100", extra.unitPrice);
    }
}
