package io.t402.schemes.ton.upto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for TON Up-To scheme types.
 */
@DisplayName("Upto TON Types")
class UptoTonPayloadTest {

    private static final String SAMPLE_SENDER = "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2";
    private static final String SAMPLE_FACILITATOR = "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe";
    private static final String SAMPLE_JETTON_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
    private static final String SAMPLE_BOC = "te6cckEBAQEAJAAAQ4AXxx6CuYAlGP8P//+2bLUQ6w94Zv8nEiZ+lBvGKVo+8BA=";

    /* ------------ UptoTonAuthorization Tests ------------ */

    @Nested
    @DisplayName("UptoTonAuthorization")
    class AuthorizationTest {

        @Test
        @DisplayName("should have correct structure")
        void authorizationStructure() {
            UptoTonAuthorization auth = new UptoTonAuthorization(
                SAMPLE_SENDER,
                SAMPLE_FACILITATOR,
                SAMPLE_JETTON_MASTER,
                "5000000",
                "100000000",
                1740675689L,
                42L,
                "12345678901234567890"
            );

            assertEquals(SAMPLE_SENDER, auth.from);
            assertEquals(SAMPLE_FACILITATOR, auth.facilitator);
            assertEquals(SAMPLE_JETTON_MASTER, auth.jettonMaster);
            assertEquals("5000000", auth.maxAmount);
            assertEquals("100000000", auth.tonAmount);
            assertEquals(1740675689L, auth.validUntil);
            assertEquals(42L, auth.seqno);
            assertEquals("12345678901234567890", auth.queryId);
        }

        @Test
        @DisplayName("should create via factory method")
        void authorizationFactory() {
            UptoTonAuthorization auth = UptoTonAuthorization.of(
                SAMPLE_SENDER, SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                "5000000", "100000000", 1740675689L, 42L, "999"
            );

            assertEquals(SAMPLE_SENDER, auth.from);
            assertEquals(SAMPLE_FACILITATOR, auth.facilitator);
            assertEquals("999", auth.queryId);
        }

        @Test
        @DisplayName("should build with builder")
        void authorizationBuilder() {
            UptoTonAuthorization auth = UptoTonAuthorization.builder()
                .from(SAMPLE_SENDER)
                .facilitator(SAMPLE_FACILITATOR)
                .jettonMaster(SAMPLE_JETTON_MASTER)
                .maxAmount("5000000")
                .tonAmount("100000000")
                .validUntil(1740675689L)
                .seqno(42L)
                .queryId("12345678901234567890")
                .build();

            assertEquals(SAMPLE_SENDER, auth.from);
            assertEquals(SAMPLE_FACILITATOR, auth.facilitator);
            assertEquals(SAMPLE_JETTON_MASTER, auth.jettonMaster);
            assertEquals("5000000", auth.maxAmount);
            assertEquals(42L, auth.seqno);
        }

        @Test
        @DisplayName("should throw when builder missing from")
        void authorizationBuilderMissingFrom() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoTonAuthorization.builder()
                    .facilitator(SAMPLE_FACILITATOR)
                    .build()
            );
        }

        @Test
        @DisplayName("should throw when builder missing facilitator")
        void authorizationBuilderMissingFacilitator() {
            assertThrows(IllegalArgumentException.class, () ->
                UptoTonAuthorization.builder()
                    .from(SAMPLE_SENDER)
                    .build()
            );
        }

        @Test
        @DisplayName("should convert to map")
        void authorizationToMap() {
            UptoTonAuthorization auth = new UptoTonAuthorization(
                SAMPLE_SENDER, SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                "5000000", "100000000", 1740675689L, 42L, "999"
            );

            Map<String, Object> map = auth.toMap();

            assertEquals(SAMPLE_SENDER, map.get("from"));
            assertEquals(SAMPLE_FACILITATOR, map.get("facilitator"));
            assertEquals(SAMPLE_JETTON_MASTER, map.get("jettonMaster"));
            assertEquals("5000000", map.get("maxAmount"));
            assertEquals("100000000", map.get("tonAmount"));
            assertEquals(1740675689L, map.get("validUntil"));
            assertEquals(42L, map.get("seqno"));
            assertEquals("999", map.get("queryId"));
        }
    }

    /* ------------ UptoTonPayload Tests ------------ */

    @Nested
    @DisplayName("UptoTonPayload")
    class PayloadTest {

        @Test
        @DisplayName("should have correct structure")
        void payloadStructure() {
            UptoTonAuthorization auth = new UptoTonAuthorization(
                SAMPLE_SENDER, SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                "5000000", "100000000", 1740675689L, 42L, "12345678901234567890"
            );

            UptoTonPayload payload = new UptoTonPayload(
                SAMPLE_BOC, auth,
                "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480"
            );

            assertEquals(SAMPLE_BOC, payload.signedBoc);
            assertNotNull(payload.authorization);
            assertEquals(SAMPLE_SENDER, payload.authorization.from);
            assertEquals(SAMPLE_FACILITATOR, payload.authorization.facilitator);
            assertEquals(66, payload.paymentNonce.length());
        }

        @Test
        @DisplayName("should build with builder")
        void payloadBuilder() {
            UptoTonPayload payload = UptoTonPayload.builder()
                .signedBoc(SAMPLE_BOC)
                .authorization(UptoTonAuthorization.builder()
                    .from(SAMPLE_SENDER)
                    .facilitator(SAMPLE_FACILITATOR)
                    .jettonMaster(SAMPLE_JETTON_MASTER)
                    .maxAmount("5000000")
                    .tonAmount("100000000")
                    .validUntil(1740675689L)
                    .seqno(42L)
                    .queryId("999")
                    .build())
                .paymentNonce("0xnonce")
                .build();

            assertEquals(SAMPLE_BOC, payload.signedBoc);
            assertEquals(SAMPLE_SENDER, payload.authorization.from);
            assertEquals("0xnonce", payload.paymentNonce);
        }

        @Test
        @DisplayName("should convert to map")
        void payloadToMap() {
            UptoTonAuthorization auth = new UptoTonAuthorization(
                SAMPLE_SENDER, SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                "5000000", "100000000", 1740675689L, 42L, "999"
            );

            UptoTonPayload payload = new UptoTonPayload(SAMPLE_BOC, auth, "0xnonce");

            Map<String, Object> result = payload.toMap();

            assertEquals(SAMPLE_BOC, result.get("signedBoc"));
            assertEquals("0xnonce", result.get("paymentNonce"));

            @SuppressWarnings("unchecked")
            Map<String, Object> authMap = (Map<String, Object>) result.get("authorization");
            assertEquals(SAMPLE_SENDER, authMap.get("from"));
            assertEquals(SAMPLE_FACILITATOR, authMap.get("facilitator"));
            assertEquals(SAMPLE_JETTON_MASTER, authMap.get("jettonMaster"));
            assertEquals("5000000", authMap.get("maxAmount"));
        }

        @Test
        @DisplayName("should create from map")
        void payloadFromMap() {
            Map<String, Object> data = new HashMap<>();
            data.put("signedBoc", SAMPLE_BOC);
            data.put("paymentNonce", "0xnonce");
            data.put("authorization", Map.of(
                "from", SAMPLE_SENDER,
                "facilitator", SAMPLE_FACILITATOR,
                "jettonMaster", SAMPLE_JETTON_MASTER,
                "maxAmount", "5000000",
                "tonAmount", "100000000",
                "validUntil", 1740675689L,
                "seqno", 42L,
                "queryId", "12345678901234567890"
            ));

            UptoTonPayload payload = UptoTonPayload.fromMap(data);

            assertEquals(SAMPLE_BOC, payload.signedBoc);
            assertEquals("0xnonce", payload.paymentNonce);
            assertEquals(SAMPLE_SENDER, payload.authorization.from);
            assertEquals(SAMPLE_FACILITATOR, payload.authorization.facilitator);
            assertEquals(SAMPLE_JETTON_MASTER, payload.authorization.jettonMaster);
            assertEquals("5000000", payload.authorization.maxAmount);
            assertEquals("100000000", payload.authorization.tonAmount);
            assertEquals(1740675689L, payload.authorization.validUntil);
            assertEquals(42L, payload.authorization.seqno);
            assertEquals("12345678901234567890", payload.authorization.queryId);
        }

        @Test
        @DisplayName("should roundtrip through toMap/fromMap")
        void payloadRoundtrip() {
            UptoTonAuthorization auth = new UptoTonAuthorization(
                SAMPLE_SENDER, SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                "5000000", "100000000", 1740675689L, 42L, "999"
            );

            UptoTonPayload original = new UptoTonPayload(SAMPLE_BOC, auth, "0xabc123");
            Map<String, Object> map = original.toMap();
            UptoTonPayload restored = UptoTonPayload.fromMap(map);

            assertEquals(original.signedBoc, restored.signedBoc);
            assertEquals(original.paymentNonce, restored.paymentNonce);
            assertEquals(original.authorization.from, restored.authorization.from);
            assertEquals(original.authorization.facilitator, restored.authorization.facilitator);
            assertEquals(original.authorization.jettonMaster, restored.authorization.jettonMaster);
            assertEquals(original.authorization.maxAmount, restored.authorization.maxAmount);
            assertEquals(original.authorization.tonAmount, restored.authorization.tonAmount);
            assertEquals(original.authorization.validUntil, restored.authorization.validUntil);
            assertEquals(original.authorization.seqno, restored.authorization.seqno);
            assertEquals(original.authorization.queryId, restored.authorization.queryId);
        }
    }

    /* ------------ isValid Tests ------------ */

    @Nested
    @DisplayName("isValid")
    class IsValidTest {

        @Test
        @DisplayName("should return true for valid payload")
        void validPayload() {
            UptoTonPayload payload = new UptoTonPayload(
                SAMPLE_BOC,
                new UptoTonAuthorization(
                    SAMPLE_SENDER, SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                    "5000000", "100000000", 1740675689L, 42L, "999"
                ),
                "0xnonce"
            );

            assertTrue(payload.isValid());
        }

        @Test
        @DisplayName("should return false for missing signedBoc")
        void missingSignedBoc() {
            UptoTonPayload payload = new UptoTonPayload(
                null,
                new UptoTonAuthorization(
                    SAMPLE_SENDER, SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                    "5000000", "100000000", 1740675689L, 42L, "999"
                ),
                "0xnonce"
            );

            assertFalse(payload.isValid());
        }

        @Test
        @DisplayName("should return false for empty signedBoc")
        void emptySignedBoc() {
            UptoTonPayload payload = new UptoTonPayload(
                "",
                new UptoTonAuthorization(
                    SAMPLE_SENDER, SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                    "5000000", "100000000", 1740675689L, 42L, "999"
                ),
                "0xnonce"
            );

            assertFalse(payload.isValid());
        }

        @Test
        @DisplayName("should return false for missing paymentNonce")
        void missingPaymentNonce() {
            UptoTonPayload payload = new UptoTonPayload(
                SAMPLE_BOC,
                new UptoTonAuthorization(
                    SAMPLE_SENDER, SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                    "5000000", "100000000", 1740675689L, 42L, "999"
                ),
                null
            );

            assertFalse(payload.isValid());
        }

        @Test
        @DisplayName("should return false for missing authorization")
        void missingAuthorization() {
            UptoTonPayload payload = new UptoTonPayload(SAMPLE_BOC, null, "0xnonce");

            assertFalse(payload.isValid());
        }

        @Test
        @DisplayName("should return false for empty from")
        void emptyFrom() {
            UptoTonPayload payload = new UptoTonPayload(
                SAMPLE_BOC,
                new UptoTonAuthorization(
                    "", SAMPLE_FACILITATOR, SAMPLE_JETTON_MASTER,
                    "5000000", "100000000", 1740675689L, 42L, "999"
                ),
                "0xnonce"
            );

            assertFalse(payload.isValid());
        }

        @Test
        @DisplayName("should return false for empty facilitator")
        void emptyFacilitator() {
            UptoTonPayload payload = new UptoTonPayload(
                SAMPLE_BOC,
                new UptoTonAuthorization(
                    SAMPLE_SENDER, "", SAMPLE_JETTON_MASTER,
                    "5000000", "100000000", 1740675689L, 42L, "999"
                ),
                "0xnonce"
            );

            assertFalse(payload.isValid());
        }
    }

    /* ------------ isUptoTonPayload Tests ------------ */

    @Nested
    @DisplayName("isUptoTonPayload")
    class IsUptoTonPayloadTest {

        private Map<String, Object> validPayloadMap() {
            Map<String, Object> data = new HashMap<>();
            data.put("signedBoc", SAMPLE_BOC);
            data.put("paymentNonce", "0xnonce");
            data.put("authorization", Map.of(
                "from", SAMPLE_SENDER,
                "facilitator", SAMPLE_FACILITATOR,
                "jettonMaster", SAMPLE_JETTON_MASTER,
                "maxAmount", "5000000",
                "tonAmount", "100000000",
                "validUntil", 1740675689L,
                "seqno", 42L,
                "queryId", "12345678901234567890"
            ));
            return data;
        }

        @Test
        @DisplayName("should return true for valid payload map")
        void validPayload() {
            assertTrue(UptoTonPayload.isUptoTonPayload(validPayloadMap()));
        }

        @Test
        @DisplayName("should return false for null")
        void nullPayload() {
            assertFalse(UptoTonPayload.isUptoTonPayload(null));
        }

        @Test
        @DisplayName("should return false for empty map")
        void emptyMap() {
            assertFalse(UptoTonPayload.isUptoTonPayload(new HashMap<>()));
        }

        @Test
        @DisplayName("should return false for missing signedBoc")
        void missingSignedBoc() {
            Map<String, Object> data = validPayloadMap();
            data.remove("signedBoc");
            assertFalse(UptoTonPayload.isUptoTonPayload(data));
        }

        @Test
        @DisplayName("should return false for empty signedBoc")
        void emptySignedBoc() {
            Map<String, Object> data = validPayloadMap();
            data.put("signedBoc", "");
            assertFalse(UptoTonPayload.isUptoTonPayload(data));
        }

        @Test
        @DisplayName("should return false for missing paymentNonce")
        void missingPaymentNonce() {
            Map<String, Object> data = validPayloadMap();
            data.remove("paymentNonce");
            assertFalse(UptoTonPayload.isUptoTonPayload(data));
        }

        @Test
        @DisplayName("should return false for missing authorization")
        void missingAuthorization() {
            Map<String, Object> data = validPayloadMap();
            data.remove("authorization");
            assertFalse(UptoTonPayload.isUptoTonPayload(data));
        }

        @Test
        @DisplayName("should return false for exact scheme payload")
        void exactSchemePayload() {
            Map<String, Object> data = new HashMap<>();
            data.put("signedBoc", SAMPLE_BOC);
            data.put("authorization", Map.of(
                "from", SAMPLE_SENDER,
                "to", "EQSomeRecipient",
                "jettonMaster", SAMPLE_JETTON_MASTER,
                "jettonAmount", "1000000",
                "tonAmount", "100000000",
                "validUntil", 1740675689L,
                "seqno", 42L,
                "queryId", "12345"
            ));
            // Missing paymentNonce and authorization.facilitator
            assertFalse(UptoTonPayload.isUptoTonPayload(data));
        }

        @Test
        @DisplayName("should return false for wrong field types")
        void wrongFieldTypes() {
            Map<String, Object> data = new HashMap<>();
            data.put("signedBoc", SAMPLE_BOC);
            data.put("paymentNonce", "0xnonce");

            Map<String, Object> auth = new HashMap<>();
            auth.put("from", SAMPLE_SENDER);
            auth.put("facilitator", SAMPLE_FACILITATOR);
            auth.put("jettonMaster", SAMPLE_JETTON_MASTER);
            auth.put("maxAmount", 5000000); // should be String
            auth.put("tonAmount", "100000000");
            auth.put("validUntil", 1740675689L);
            auth.put("seqno", 42L);
            auth.put("queryId", "999");
            data.put("authorization", auth);

            assertFalse(UptoTonPayload.isUptoTonPayload(data));
        }
    }

    /* ------------ UptoTonExtra Tests ------------ */

    @Nested
    @DisplayName("UptoTonExtra")
    class ExtraTest {

        @Test
        @DisplayName("should have full upto parameters")
        void fullParameters() {
            UptoTonExtra extra = new UptoTonExtra(SAMPLE_FACILITATOR)
                .withMaxAmount("10000000")
                .withMinAmount("100000")
                .withUnit("token")
                .withUnitPrice("100");

            assertEquals(SAMPLE_FACILITATOR, extra.facilitator);
            assertEquals("10000000", extra.maxAmount);
            assertEquals("100000", extra.minAmount);
            assertEquals("token", extra.unit);
            assertEquals("100", extra.unitPrice);
        }

        @Test
        @DisplayName("should work with default constructor")
        void defaultConstructor() {
            UptoTonExtra extra = new UptoTonExtra();

            assertNull(extra.facilitator);
            assertNull(extra.maxAmount);
            assertNull(extra.minAmount);
            assertNull(extra.unit);
            assertNull(extra.unitPrice);
        }

        @Test
        @DisplayName("should work with only facilitator")
        void facilitatorOnly() {
            UptoTonExtra extra = new UptoTonExtra(SAMPLE_FACILITATOR);

            assertEquals(SAMPLE_FACILITATOR, extra.facilitator);
            assertNull(extra.unit);
            assertNull(extra.unitPrice);
        }

        @Test
        @DisplayName("should support method chaining")
        void methodChaining() {
            UptoTonExtra extra = new UptoTonExtra()
                .withFacilitator(SAMPLE_FACILITATOR)
                .withMaxAmount("10000000")
                .withMinAmount("100000")
                .withUnit("request")
                .withUnitPrice("500");

            assertEquals(SAMPLE_FACILITATOR, extra.facilitator);
            assertEquals("10000000", extra.maxAmount);
            assertEquals("100000", extra.minAmount);
            assertEquals("request", extra.unit);
            assertEquals("500", extra.unitPrice);
        }
    }
}
