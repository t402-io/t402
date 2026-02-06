package io.t402.schemes.near.upto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for NEAR Up-To scheme types.
 */
@DisplayName("Upto NEAR Types")
class UptoNearPayloadTest {

    private static final String SAMPLE_TX_HASH = "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ";
    private static final String SENDER_ACCOUNT = "alice.near";
    private static final String FACILITATOR_ACCOUNT = "facilitator.near";
    private static final String TOKEN_CONTRACT = "usdt.tether-token.near";
    private static final String PAYMENT_NONCE = "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480";

    /* ------------ UptoNearAuthorization Tests ------------ */

    @Nested
    @DisplayName("UptoNearAuthorization")
    class AuthorizationTest {

        @Test
        @DisplayName("should have correct structure")
        void testStructure() {
            UptoNearPayload.UptoNearAuthorization auth =
                UptoNearPayload.UptoNearAuthorization.builder()
                    .from(SENDER_ACCOUNT)
                    .facilitator(FACILITATOR_ACCOUNT)
                    .tokenContract(TOKEN_CONTRACT)
                    .maxAmount("1000000")
                    .build();

            assertEquals(SENDER_ACCOUNT, auth.getFrom());
            assertEquals(FACILITATOR_ACCOUNT, auth.getFacilitator());
            assertEquals(TOKEN_CONTRACT, auth.getTokenContract());
            assertEquals("1000000", auth.getMaxAmount());
        }

        @Test
        @DisplayName("should report valid when all fields present")
        void testIsValid() {
            UptoNearPayload.UptoNearAuthorization auth =
                UptoNearPayload.UptoNearAuthorization.builder()
                    .from(SENDER_ACCOUNT)
                    .facilitator(FACILITATOR_ACCOUNT)
                    .tokenContract(TOKEN_CONTRACT)
                    .maxAmount("1000000")
                    .build();

            assertTrue(auth.isValid());
        }

        @Test
        @DisplayName("should throw for missing from")
        void testMissingFrom() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoNearPayload.UptoNearAuthorization.builder()
                    .facilitator(FACILITATOR_ACCOUNT)
                    .tokenContract(TOKEN_CONTRACT)
                    .maxAmount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should throw for missing facilitator")
        void testMissingFacilitator() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoNearPayload.UptoNearAuthorization.builder()
                    .from(SENDER_ACCOUNT)
                    .tokenContract(TOKEN_CONTRACT)
                    .maxAmount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should throw for missing tokenContract")
        void testMissingTokenContract() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoNearPayload.UptoNearAuthorization.builder()
                    .from(SENDER_ACCOUNT)
                    .facilitator(FACILITATOR_ACCOUNT)
                    .maxAmount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should throw for missing maxAmount")
        void testMissingMaxAmount() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoNearPayload.UptoNearAuthorization.builder()
                    .from(SENDER_ACCOUNT)
                    .facilitator(FACILITATOR_ACCOUNT)
                    .tokenContract(TOKEN_CONTRACT)
                    .build());
        }

        @Test
        @DisplayName("should create from map")
        void testFromMap() {
            Map<String, Object> data = Map.of(
                "from", SENDER_ACCOUNT,
                "facilitator", FACILITATOR_ACCOUNT,
                "tokenContract", TOKEN_CONTRACT,
                "maxAmount", "1000000"
            );

            UptoNearPayload.UptoNearAuthorization auth =
                UptoNearPayload.UptoNearAuthorization.fromMap(data);

            assertEquals(SENDER_ACCOUNT, auth.getFrom());
            assertEquals(FACILITATOR_ACCOUNT, auth.getFacilitator());
            assertEquals(TOKEN_CONTRACT, auth.getTokenContract());
            assertEquals("1000000", auth.getMaxAmount());
        }
    }

    /* ------------ UptoNearPayload Tests ------------ */

    @Nested
    @DisplayName("UptoNearPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build a valid payload")
        void testBuildPayload() {
            UptoNearPayload payload = UptoNearPayload.builder()
                .txHash(SAMPLE_TX_HASH)
                .authorization(
                    UptoNearPayload.UptoNearAuthorization.builder()
                        .from(SENDER_ACCOUNT)
                        .facilitator(FACILITATOR_ACCOUNT)
                        .tokenContract(TOKEN_CONTRACT)
                        .maxAmount("1000000")
                        .build())
                .paymentNonce(PAYMENT_NONCE)
                .build();

            assertEquals(SAMPLE_TX_HASH, payload.getTxHash());
            assertEquals(SENDER_ACCOUNT, payload.getAuthorization().getFrom());
            assertEquals(FACILITATOR_ACCOUNT, payload.getAuthorization().getFacilitator());
            assertEquals(TOKEN_CONTRACT, payload.getAuthorization().getTokenContract());
            assertEquals("1000000", payload.getAuthorization().getMaxAmount());
            assertEquals(PAYMENT_NONCE, payload.getPaymentNonce());
        }

        @Test
        @DisplayName("should report valid for complete payload")
        void testIsValid() {
            UptoNearPayload payload = createValidPayload();
            assertTrue(payload.isValid());
        }

        @Test
        @DisplayName("should throw for missing txHash")
        void testMissingTxHash() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoNearPayload.builder()
                    .authorization(createValidAuthorization())
                    .paymentNonce(PAYMENT_NONCE)
                    .build());
        }

        @Test
        @DisplayName("should throw for missing paymentNonce")
        void testMissingPaymentNonce() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoNearPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .authorization(createValidAuthorization())
                    .build());
        }

        @Test
        @DisplayName("should throw for missing authorization")
        void testMissingAuthorization() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoNearPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .paymentNonce(PAYMENT_NONCE)
                    .build());
        }

        @Test
        @DisplayName("should convert payload to map and back")
        void testPayloadRoundTrip() {
            UptoNearPayload original = createValidPayload();

            Map<String, Object> map = original.toMap();
            assertEquals(SAMPLE_TX_HASH, map.get("txHash"));
            assertEquals(PAYMENT_NONCE, map.get("paymentNonce"));

            @SuppressWarnings("unchecked")
            Map<String, Object> authMap = (Map<String, Object>) map.get("authorization");
            assertEquals(SENDER_ACCOUNT, authMap.get("from"));
            assertEquals(FACILITATOR_ACCOUNT, authMap.get("facilitator"));
            assertEquals(TOKEN_CONTRACT, authMap.get("tokenContract"));
            assertEquals("1000000", authMap.get("maxAmount"));

            UptoNearPayload restored = UptoNearPayload.fromMap(map);
            assertEquals(original.getTxHash(), restored.getTxHash());
            assertEquals(original.getPaymentNonce(), restored.getPaymentNonce());
            assertEquals(original.getAuthorization().getFrom(),
                restored.getAuthorization().getFrom());
            assertEquals(original.getAuthorization().getFacilitator(),
                restored.getAuthorization().getFacilitator());
            assertEquals(original.getAuthorization().getTokenContract(),
                restored.getAuthorization().getTokenContract());
            assertEquals(original.getAuthorization().getMaxAmount(),
                restored.getAuthorization().getMaxAmount());
        }

        @Test
        @DisplayName("should throw for null map")
        void testFromNullMap() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoNearPayload.fromMap(null));
        }
    }

    /* ------------ isUptoNearPayload Tests ------------ */

    @Nested
    @DisplayName("isUptoNearPayload")
    class TypeGuardTest {

        @Test
        @DisplayName("should return true for valid payload")
        void testValidPayload() {
            Map<String, Object> data = new HashMap<>();
            data.put("txHash", SAMPLE_TX_HASH);
            data.put("paymentNonce", PAYMENT_NONCE);
            data.put("authorization", Map.of(
                "from", SENDER_ACCOUNT,
                "facilitator", FACILITATOR_ACCOUNT,
                "tokenContract", TOKEN_CONTRACT,
                "maxAmount", "1000000"
            ));

            assertTrue(UptoNearPayload.isUptoNearPayload(data));
        }

        @Test
        @DisplayName("should return false for null")
        void testNull() {
            assertFalse(UptoNearPayload.isUptoNearPayload(null));
        }

        @Test
        @DisplayName("should return false for empty map")
        void testEmptyMap() {
            assertFalse(UptoNearPayload.isUptoNearPayload(new HashMap<>()));
        }

        @Test
        @DisplayName("should return false for missing txHash")
        void testMissingTxHash() {
            Map<String, Object> data = new HashMap<>();
            data.put("paymentNonce", PAYMENT_NONCE);
            data.put("authorization", Map.of(
                "from", SENDER_ACCOUNT,
                "facilitator", FACILITATOR_ACCOUNT,
                "tokenContract", TOKEN_CONTRACT,
                "maxAmount", "1000000"
            ));

            assertFalse(UptoNearPayload.isUptoNearPayload(data));
        }

        @Test
        @DisplayName("should return false for missing paymentNonce")
        void testMissingPaymentNonce() {
            Map<String, Object> data = new HashMap<>();
            data.put("txHash", SAMPLE_TX_HASH);
            data.put("authorization", Map.of(
                "from", SENDER_ACCOUNT,
                "facilitator", FACILITATOR_ACCOUNT,
                "tokenContract", TOKEN_CONTRACT,
                "maxAmount", "1000000"
            ));

            assertFalse(UptoNearPayload.isUptoNearPayload(data));
        }

        @Test
        @DisplayName("should return false for missing authorization")
        void testMissingAuthorization() {
            Map<String, Object> data = new HashMap<>();
            data.put("txHash", SAMPLE_TX_HASH);
            data.put("paymentNonce", PAYMENT_NONCE);

            assertFalse(UptoNearPayload.isUptoNearPayload(data));
        }

        @Test
        @DisplayName("should return false for incomplete authorization")
        void testIncompleteAuthorization() {
            Map<String, Object> data = new HashMap<>();
            data.put("txHash", SAMPLE_TX_HASH);
            data.put("paymentNonce", PAYMENT_NONCE);
            data.put("authorization", Map.of("from", SENDER_ACCOUNT));

            assertFalse(UptoNearPayload.isUptoNearPayload(data));
        }

        @Test
        @DisplayName("should return false for exact-direct payload")
        void testExactDirectPayload() {
            Map<String, Object> data = new HashMap<>();
            data.put("txHash", SAMPLE_TX_HASH);
            data.put("from", SENDER_ACCOUNT);
            data.put("to", "merchant.near");
            data.put("amount", "1000000");

            assertFalse(UptoNearPayload.isUptoNearPayload(data));
        }

        @Test
        @DisplayName("should return false for empty from in authorization")
        void testEmptyFrom() {
            Map<String, Object> data = new HashMap<>();
            data.put("txHash", SAMPLE_TX_HASH);
            data.put("paymentNonce", PAYMENT_NONCE);
            data.put("authorization", Map.of(
                "from", "",
                "facilitator", FACILITATOR_ACCOUNT,
                "tokenContract", TOKEN_CONTRACT,
                "maxAmount", "1000000"
            ));

            assertFalse(UptoNearPayload.isUptoNearPayload(data));
        }

        @Test
        @DisplayName("should return false for empty facilitator in authorization")
        void testEmptyFacilitator() {
            Map<String, Object> data = new HashMap<>();
            data.put("txHash", SAMPLE_TX_HASH);
            data.put("paymentNonce", PAYMENT_NONCE);
            data.put("authorization", Map.of(
                "from", SENDER_ACCOUNT,
                "facilitator", "",
                "tokenContract", TOKEN_CONTRACT,
                "maxAmount", "1000000"
            ));

            assertFalse(UptoNearPayload.isUptoNearPayload(data));
        }

        @Test
        @DisplayName("should return false for non-string txHash")
        void testNonStringTxHash() {
            Map<String, Object> data = new HashMap<>();
            data.put("txHash", 12345);
            data.put("paymentNonce", PAYMENT_NONCE);
            data.put("authorization", Map.of(
                "from", SENDER_ACCOUNT,
                "facilitator", FACILITATOR_ACCOUNT,
                "tokenContract", TOKEN_CONTRACT,
                "maxAmount", "1000000"
            ));

            assertFalse(UptoNearPayload.isUptoNearPayload(data));
        }
    }

    /* ------------ UptoNearExtra Tests ------------ */

    @Nested
    @DisplayName("UptoNearExtra")
    class ExtraTest {

        @Test
        @DisplayName("should create with facilitator only")
        void testFacilitatorOnly() {
            UptoNearExtra extra = new UptoNearExtra(FACILITATOR_ACCOUNT);

            assertEquals(FACILITATOR_ACCOUNT, extra.facilitator);
            assertNull(extra.maxAmount);
            assertNull(extra.minAmount);
            assertNull(extra.unit);
            assertNull(extra.unitPrice);
        }

        @Test
        @DisplayName("should create with facilitator and amount bounds")
        void testWithAmountBounds() {
            UptoNearExtra extra = new UptoNearExtra(
                FACILITATOR_ACCOUNT, "1000000", "10000");

            assertEquals(FACILITATOR_ACCOUNT, extra.facilitator);
            assertEquals("1000000", extra.maxAmount);
            assertEquals("10000", extra.minAmount);
        }

        @Test
        @DisplayName("should support chaining methods")
        void testChaining() {
            UptoNearExtra extra = new UptoNearExtra(FACILITATOR_ACCOUNT)
                .withMaxAmount("1000000")
                .withMinAmount("10000")
                .withUnit("token")
                .withUnitPrice("100");

            assertEquals(FACILITATOR_ACCOUNT, extra.facilitator);
            assertEquals("1000000", extra.maxAmount);
            assertEquals("10000", extra.minAmount);
            assertEquals("token", extra.unit);
            assertEquals("100", extra.unitPrice);
        }

        @Test
        @DisplayName("should support empty construction")
        void testEmptyConstruction() {
            UptoNearExtra extra = new UptoNearExtra();

            assertNull(extra.facilitator);
            assertNull(extra.maxAmount);
            assertNull(extra.minAmount);
            assertNull(extra.unit);
            assertNull(extra.unitPrice);
        }
    }

    // =========================================================================
    // Helper methods
    // =========================================================================

    private UptoNearPayload createValidPayload() {
        return UptoNearPayload.builder()
            .txHash(SAMPLE_TX_HASH)
            .authorization(createValidAuthorization())
            .paymentNonce(PAYMENT_NONCE)
            .build();
    }

    private UptoNearPayload.UptoNearAuthorization createValidAuthorization() {
        return UptoNearPayload.UptoNearAuthorization.builder()
            .from(SENDER_ACCOUNT)
            .facilitator(FACILITATOR_ACCOUNT)
            .tokenContract(TOKEN_CONTRACT)
            .maxAmount("1000000")
            .build();
    }
}
