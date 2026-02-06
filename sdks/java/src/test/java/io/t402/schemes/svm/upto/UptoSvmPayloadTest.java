package io.t402.schemes.svm.upto;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for SVM Up-To scheme types.
 */
@DisplayName("SVM Up-To Types")
class UptoSvmPayloadTest {

    // Sample valid Solana addresses (base58)
    private static final String SAMPLE_OWNER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
    private static final String SAMPLE_DELEGATE = "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL";
    private static final String SAMPLE_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    private static final String SAMPLE_ATA = "FEeSRuEDk8ENZbpzXjn4DLBMbCjPo2EfQQsMCAfmxZGu";
    private static final String SAMPLE_TX = java.util.Base64.getEncoder().encodeToString(new byte[150]);

    @Nested
    @DisplayName("UptoSvmAuthorization")
    class UptoSvmAuthorizationTest {

        @Test
        @DisplayName("should create authorization with constructor")
        void testConstructor() {
            UptoSvmAuthorization auth = new UptoSvmAuthorization(
                SAMPLE_OWNER, SAMPLE_DELEGATE, SAMPLE_MINT, "1000000", SAMPLE_ATA
            );

            assertEquals(SAMPLE_OWNER, auth.owner);
            assertEquals(SAMPLE_DELEGATE, auth.delegate);
            assertEquals(SAMPLE_MINT, auth.mint);
            assertEquals("1000000", auth.maxAmount);
            assertEquals(SAMPLE_ATA, auth.sourceATA);
        }

        @Test
        @DisplayName("should create authorization with builder")
        void testBuilder() {
            UptoSvmAuthorization auth = UptoSvmAuthorization.builder()
                .owner(SAMPLE_OWNER)
                .delegate(SAMPLE_DELEGATE)
                .mint(SAMPLE_MINT)
                .maxAmount("5000000")
                .sourceATA(SAMPLE_ATA)
                .build();

            assertEquals(SAMPLE_OWNER, auth.owner);
            assertEquals(SAMPLE_DELEGATE, auth.delegate);
            assertEquals(SAMPLE_MINT, auth.mint);
            assertEquals("5000000", auth.maxAmount);
            assertEquals(SAMPLE_ATA, auth.sourceATA);
        }

        @Test
        @DisplayName("should accept numeric maxAmount in builder")
        void testBuilderNumericMaxAmount() {
            UptoSvmAuthorization auth = UptoSvmAuthorization.builder()
                .owner(SAMPLE_OWNER)
                .delegate(SAMPLE_DELEGATE)
                .mint(SAMPLE_MINT)
                .maxAmount(1000000L)
                .sourceATA(SAMPLE_ATA)
                .build();

            assertEquals("1000000", auth.maxAmount);
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapConversion() {
            UptoSvmAuthorization original = new UptoSvmAuthorization(
                SAMPLE_OWNER, SAMPLE_DELEGATE, SAMPLE_MINT, "1000000", SAMPLE_ATA
            );

            Map<String, Object> map = original.toMap();
            UptoSvmAuthorization restored = UptoSvmAuthorization.fromMap(map);

            assertEquals(original.owner, restored.owner);
            assertEquals(original.delegate, restored.delegate);
            assertEquals(original.mint, restored.mint);
            assertEquals(original.maxAmount, restored.maxAmount);
            assertEquals(original.sourceATA, restored.sourceATA);
        }

        @Test
        @DisplayName("should handle numeric maxAmount in map")
        void testMapWithNumericMaxAmount() {
            Map<String, Object> map = new HashMap<>();
            map.put("owner", SAMPLE_OWNER);
            map.put("delegate", SAMPLE_DELEGATE);
            map.put("mint", SAMPLE_MINT);
            map.put("maxAmount", 1000000L);
            map.put("sourceATA", SAMPLE_ATA);

            UptoSvmAuthorization auth = UptoSvmAuthorization.fromMap(map);
            assertEquals("1000000", auth.maxAmount);
        }
    }

    @Nested
    @DisplayName("UptoSvmPayload")
    class UptoSvmPayloadTests {

        @Test
        @DisplayName("should create payload with constructor")
        void testConstructor() {
            UptoSvmAuthorization auth = new UptoSvmAuthorization(
                SAMPLE_OWNER, SAMPLE_DELEGATE, SAMPLE_MINT, "1000000", SAMPLE_ATA
            );
            UptoSvmPayload payload = new UptoSvmPayload(SAMPLE_TX, auth, "a1b2c3d4e5f6");

            assertEquals(SAMPLE_TX, payload.transaction);
            assertNotNull(payload.authorization);
            assertEquals(SAMPLE_OWNER, payload.authorization.owner);
            assertEquals(SAMPLE_DELEGATE, payload.authorization.delegate);
            assertEquals("a1b2c3d4e5f6", payload.paymentNonce);
        }

        @Test
        @DisplayName("should create payload with builder")
        void testBuilder() {
            UptoSvmPayload payload = UptoSvmPayload.builder()
                .transaction(SAMPLE_TX)
                .authorization(UptoSvmAuthorization.builder()
                    .owner(SAMPLE_OWNER)
                    .delegate(SAMPLE_DELEGATE)
                    .mint(SAMPLE_MINT)
                    .maxAmount("1000000")
                    .sourceATA(SAMPLE_ATA)
                    .build())
                .paymentNonce("deadbeef")
                .build();

            assertEquals(SAMPLE_TX, payload.transaction);
            assertEquals(SAMPLE_OWNER, payload.authorization.owner);
            assertEquals(SAMPLE_DELEGATE, payload.authorization.delegate);
            assertEquals("deadbeef", payload.paymentNonce);
        }

        @Test
        @DisplayName("should validate payload structure")
        void testIsValid() {
            UptoSvmAuthorization auth = new UptoSvmAuthorization(
                SAMPLE_OWNER, SAMPLE_DELEGATE, SAMPLE_MINT, "1000000", SAMPLE_ATA
            );

            UptoSvmPayload validPayload = new UptoSvmPayload(SAMPLE_TX, auth, "nonce123");
            assertTrue(validPayload.isValid());

            UptoSvmPayload noTransaction = new UptoSvmPayload(null, auth, "nonce123");
            assertFalse(noTransaction.isValid());

            UptoSvmPayload emptyTransaction = new UptoSvmPayload("", auth, "nonce123");
            assertFalse(emptyTransaction.isValid());

            UptoSvmPayload noNonce = new UptoSvmPayload(SAMPLE_TX, auth, null);
            assertFalse(noNonce.isValid());

            UptoSvmPayload emptyNonce = new UptoSvmPayload(SAMPLE_TX, auth, "");
            assertFalse(emptyNonce.isValid());

            UptoSvmPayload noAuth = new UptoSvmPayload(SAMPLE_TX, null, "nonce123");
            assertFalse(noAuth.isValid());

            UptoSvmAuthorization incompleteAuth = new UptoSvmAuthorization();
            UptoSvmPayload incompletePayload = new UptoSvmPayload(SAMPLE_TX, incompleteAuth, "nonce123");
            assertFalse(incompletePayload.isValid());
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapConversion() {
            UptoSvmAuthorization auth = new UptoSvmAuthorization(
                SAMPLE_OWNER, SAMPLE_DELEGATE, SAMPLE_MINT, "1000000", SAMPLE_ATA
            );
            UptoSvmPayload original = new UptoSvmPayload(SAMPLE_TX, auth, "a1b2c3d4e5f6");

            Map<String, Object> map = original.toMap();
            UptoSvmPayload restored = UptoSvmPayload.fromMap(map);

            assertEquals(original.transaction, restored.transaction);
            assertEquals(original.paymentNonce, restored.paymentNonce);
            assertNotNull(restored.authorization);
            assertEquals(original.authorization.owner, restored.authorization.owner);
            assertEquals(original.authorization.delegate, restored.authorization.delegate);
            assertEquals(original.authorization.mint, restored.authorization.mint);
            assertEquals(original.authorization.maxAmount, restored.authorization.maxAmount);
            assertEquals(original.authorization.sourceATA, restored.authorization.sourceATA);
        }

        @Test
        @DisplayName("should produce correct map keys")
        void testToMapKeys() {
            UptoSvmAuthorization auth = new UptoSvmAuthorization(
                SAMPLE_OWNER, SAMPLE_DELEGATE, SAMPLE_MINT, "1000000", SAMPLE_ATA
            );
            UptoSvmPayload payload = new UptoSvmPayload(SAMPLE_TX, auth, "nonce");

            Map<String, Object> map = payload.toMap();

            assertTrue(map.containsKey("transaction"));
            assertTrue(map.containsKey("paymentNonce"));
            assertTrue(map.containsKey("authorization"));

            @SuppressWarnings("unchecked")
            Map<String, Object> authMap = (Map<String, Object>) map.get("authorization");
            assertTrue(authMap.containsKey("owner"));
            assertTrue(authMap.containsKey("delegate"));
            assertTrue(authMap.containsKey("mint"));
            assertTrue(authMap.containsKey("maxAmount"));
            assertTrue(authMap.containsKey("sourceATA"));
        }
    }

    @Nested
    @DisplayName("isUptoSvmPayload")
    class IsUptoSvmPayloadTest {

        @Test
        @DisplayName("should return true for valid payload")
        void testValidPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("transaction", SAMPLE_TX);
            payload.put("paymentNonce", "a1b2c3d4e5f6");
            payload.put("authorization", Map.of(
                "owner", SAMPLE_OWNER,
                "delegate", SAMPLE_DELEGATE,
                "mint", SAMPLE_MINT,
                "maxAmount", "1000000",
                "sourceATA", SAMPLE_ATA
            ));

            assertTrue(UptoSvmPayload.isUptoSvmPayload(payload));
        }

        @Test
        @DisplayName("should return false for null")
        void testNull() {
            assertFalse(UptoSvmPayload.isUptoSvmPayload(null));
        }

        @Test
        @DisplayName("should return false for empty map")
        void testEmptyMap() {
            assertFalse(UptoSvmPayload.isUptoSvmPayload(new HashMap<>()));
        }

        @Test
        @DisplayName("should return false when transaction is missing")
        void testMissingTransaction() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("paymentNonce", "a1b2c3d4e5f6");
            payload.put("authorization", Map.of(
                "owner", SAMPLE_OWNER,
                "delegate", SAMPLE_DELEGATE,
                "mint", SAMPLE_MINT,
                "maxAmount", "1000000",
                "sourceATA", SAMPLE_ATA
            ));

            assertFalse(UptoSvmPayload.isUptoSvmPayload(payload));
        }

        @Test
        @DisplayName("should return false when paymentNonce is missing")
        void testMissingPaymentNonce() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("transaction", SAMPLE_TX);
            payload.put("authorization", Map.of(
                "owner", SAMPLE_OWNER,
                "delegate", SAMPLE_DELEGATE,
                "mint", SAMPLE_MINT,
                "maxAmount", "1000000",
                "sourceATA", SAMPLE_ATA
            ));

            assertFalse(UptoSvmPayload.isUptoSvmPayload(payload));
        }

        @Test
        @DisplayName("should return false when authorization is missing")
        void testMissingAuthorization() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("transaction", SAMPLE_TX);
            payload.put("paymentNonce", "a1b2c3d4e5f6");

            assertFalse(UptoSvmPayload.isUptoSvmPayload(payload));
        }

        @Test
        @DisplayName("should return false when authorization is not a map")
        void testAuthorizationNotMap() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("transaction", SAMPLE_TX);
            payload.put("paymentNonce", "a1b2c3d4e5f6");
            payload.put("authorization", "not-a-map");

            assertFalse(UptoSvmPayload.isUptoSvmPayload(payload));
        }

        @Test
        @DisplayName("should return false when authorization fields are incomplete")
        void testIncompleteAuthorization() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("transaction", SAMPLE_TX);
            payload.put("paymentNonce", "a1b2c3d4e5f6");
            payload.put("authorization", Map.of(
                "owner", SAMPLE_OWNER
                // missing delegate, mint, maxAmount, sourceATA
            ));

            assertFalse(UptoSvmPayload.isUptoSvmPayload(payload));
        }

        @Test
        @DisplayName("should return false when maxAmount is numeric instead of string")
        void testNumericMaxAmount() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("transaction", SAMPLE_TX);
            payload.put("paymentNonce", "a1b2c3d4e5f6");
            Map<String, Object> auth = new HashMap<>();
            auth.put("owner", SAMPLE_OWNER);
            auth.put("delegate", SAMPLE_DELEGATE);
            auth.put("mint", SAMPLE_MINT);
            auth.put("maxAmount", 1000000); // number instead of string
            auth.put("sourceATA", SAMPLE_ATA);
            payload.put("authorization", auth);

            assertFalse(UptoSvmPayload.isUptoSvmPayload(payload));
        }

        @Test
        @DisplayName("should return false for exact SVM payload (no delegate)")
        void testRejectsExactSvmPayload() {
            Map<String, Object> exactPayload = new HashMap<>();
            exactPayload.put("transaction", SAMPLE_TX);

            assertFalse(UptoSvmPayload.isUptoSvmPayload(exactPayload));
        }
    }

    @Nested
    @DisplayName("UptoSvmExtra")
    class UptoSvmExtraTest {

        @Test
        @DisplayName("should create with fee payer")
        void testConstructor() {
            UptoSvmExtra extra = new UptoSvmExtra(SAMPLE_DELEGATE);

            assertEquals(SAMPLE_DELEGATE, extra.feePayer);
            assertNull(extra.maxAmount);
            assertNull(extra.minAmount);
            assertNull(extra.unit);
            assertNull(extra.unitPrice);
        }

        @Test
        @DisplayName("should support chaining")
        void testChaining() {
            UptoSvmExtra extra = new UptoSvmExtra(SAMPLE_DELEGATE)
                .withMaxAmount("10000000")
                .withMinAmount("100000")
                .withUnit("token")
                .withUnitPrice("100");

            assertEquals(SAMPLE_DELEGATE, extra.feePayer);
            assertEquals("10000000", extra.maxAmount);
            assertEquals("100000", extra.minAmount);
            assertEquals("token", extra.unit);
            assertEquals("100", extra.unitPrice);
        }

        @Test
        @DisplayName("should allow empty construction")
        void testDefaultConstructor() {
            UptoSvmExtra extra = new UptoSvmExtra();

            assertNull(extra.feePayer);
            assertNull(extra.maxAmount);
            assertNull(extra.minAmount);
            assertNull(extra.unit);
            assertNull(extra.unitPrice);
        }

        @Test
        @DisplayName("should produce readable toString")
        void testToString() {
            UptoSvmExtra extra = new UptoSvmExtra(SAMPLE_DELEGATE)
                .withUnit("request")
                .withUnitPrice("500");

            String str = extra.toString();
            assertTrue(str.contains("feePayer"));
            assertTrue(str.contains(SAMPLE_DELEGATE));
            assertTrue(str.contains("request"));
            assertTrue(str.contains("500"));
        }
    }
}
