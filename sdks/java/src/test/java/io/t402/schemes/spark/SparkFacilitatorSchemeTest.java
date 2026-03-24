package io.t402.schemes.spark;

import io.t402.schemes.spark.exact.SparkFacilitatorScheme;

import static org.junit.jupiter.api.Assertions.*;

import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for Spark payment scheme implementations.
 */
@DisplayName("Spark Payment Schemes")
class SparkFacilitatorSchemeTest {

    // ============================================================
    // Mock Implementation
    // ============================================================

    static class MockSparkSigner implements SparkSigner {
        private final Map<String, TransferInfo> transfers = new HashMap<>();
        private final String address;

        MockSparkSigner(String address) {
            this.address = address;
        }

        void addTransfer(TransferInfo transfer) {
            transfers.put(transfer.getId(), transfer);
        }

        @Override
        public TransferInfo getTransfer(String transferId) throws Exception {
            TransferInfo info = transfers.get(transferId);
            if (info == null) {
                throw new Exception("transfer not found: " + transferId);
            }
            return info;
        }

        @Override
        public String getAddress() {
            return address;
        }
    }

    // ============================================================
    // Test Helpers
    // ============================================================

    private static final String SERVER_ADDRESS = "spark:server123";
    // Sample preimage matching the Go test: "secret-preimage-32bytes-padding!"
    private static final String SAMPLE_PREIMAGE_TEXT = "secret-preimage-32bytes-padding!";

    private static String sha256Hex(byte[] input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input);
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private static byte[] hexToBytes(String hex) {
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            int idx = i * 2;
            bytes[i] = (byte) Integer.parseInt(hex.substring(idx, idx + 2), 16);
        }
        return bytes;
    }

    private static Map<String, Object> createSparkPayload(String transferId) {
        Map<String, Object> payloadData = new HashMap<>();
        payloadData.put("paymentType", SparkConstants.PAYMENT_TYPE_SPARK);
        payloadData.put("transferId", transferId);

        Map<String, Object> payload = new HashMap<>();
        payload.put("payload", payloadData);
        return payload;
    }

    private static Map<String, Object> createLightningPayload(String preimageHex, String paymentHash) {
        Map<String, Object> payloadData = new HashMap<>();
        payloadData.put("paymentType", SparkConstants.PAYMENT_TYPE_LIGHTNING);
        payloadData.put("preimage", preimageHex);
        payloadData.put("paymentHash", paymentHash);

        Map<String, Object> payload = new HashMap<>();
        payload.put("payload", payloadData);
        return payload;
    }

    private static Map<String, Object> createRequirements(String amount) {
        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", "exact");
        requirements.put("network", SparkConstants.SPARK_MAINNET);
        requirements.put("amount", amount);
        return requirements;
    }

    // ============================================================
    // SparkConstants Tests
    // ============================================================

    @Nested
    @DisplayName("SparkConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should have correct CAIP-2 identifiers")
        void testCaip2Identifiers() {
            assertEquals("spark:mainnet", SparkConstants.SPARK_MAINNET);
            assertEquals("spark:testnet", SparkConstants.SPARK_TESTNET);
        }

        @Test
        @DisplayName("should have correct scheme and payment types")
        void testSchemeAndPaymentTypes() {
            assertEquals("exact", SparkConstants.SCHEME_EXACT);
            assertEquals("spark", SparkConstants.PAYMENT_TYPE_SPARK);
            assertEquals("lightning", SparkConstants.PAYMENT_TYPE_LIGHTNING);
            assertEquals("spark:*", SparkConstants.CAIP_FAMILY);
        }

        @Test
        @DisplayName("should identify Spark networks")
        void testIsSparkNetwork() {
            assertTrue(SparkConstants.isSparkNetwork(SparkConstants.SPARK_MAINNET));
            assertTrue(SparkConstants.isSparkNetwork(SparkConstants.SPARK_TESTNET));
            assertFalse(SparkConstants.isSparkNetwork("eip155:1"));
            assertFalse(SparkConstants.isSparkNetwork("bip122:000000000019d6689c085ae165831e93"));
            assertFalse(SparkConstants.isSparkNetwork(null));
        }

        @Test
        @DisplayName("should validate supported Spark networks")
        void testIsSupportedNetwork() {
            assertTrue(SparkConstants.isSupportedNetwork(SparkConstants.SPARK_MAINNET));
            assertTrue(SparkConstants.isSupportedNetwork(SparkConstants.SPARK_TESTNET));
            assertFalse(SparkConstants.isSupportedNetwork("spark:unknown"));
            assertFalse(SparkConstants.isSupportedNetwork("eip155:1"));
        }
    }

    // ============================================================
    // TransferStatus Tests
    // ============================================================

    @Nested
    @DisplayName("TransferStatus")
    class TransferStatusTest {

        @Test
        @DisplayName("should have correct integer values")
        void testValues() {
            assertEquals(0, TransferStatus.PENDING.getValue());
            assertEquals(5, TransferStatus.COMPLETED.getValue());
            assertEquals(9, TransferStatus.FAILED.getValue());
        }

        @Test
        @DisplayName("should convert from integer values")
        void testFromValue() {
            assertEquals(TransferStatus.PENDING, TransferStatus.fromValue(0));
            assertEquals(TransferStatus.COMPLETED, TransferStatus.fromValue(5));
            assertEquals(TransferStatus.FAILED, TransferStatus.fromValue(9));
        }

        @Test
        @DisplayName("should reject unknown values")
        void testFromValueUnknown() {
            assertThrows(IllegalArgumentException.class, () -> TransferStatus.fromValue(99));
        }
    }

    // ============================================================
    // SparkPayload Tests
    // ============================================================

    @Nested
    @DisplayName("SparkPayload")
    class PayloadTest {

        @Test
        @DisplayName("should serialize and deserialize spark payload")
        void testSparkRoundTrip() {
            SparkPayload payload = new SparkPayload("spark", "tx-001", null, null);
            Map<String, Object> map = payload.toMap();

            assertEquals("spark", map.get("paymentType"));
            assertEquals("tx-001", map.get("transferId"));
            assertFalse(map.containsKey("preimage"));
            assertFalse(map.containsKey("paymentHash"));

            SparkPayload restored = SparkPayload.fromMap(map);
            assertEquals("spark", restored.getPaymentType());
            assertEquals("tx-001", restored.getTransferId());
            assertNull(restored.getPreimage());
            assertNull(restored.getPaymentHash());
        }

        @Test
        @DisplayName("should serialize and deserialize lightning payload")
        void testLightningRoundTrip() {
            SparkPayload payload = new SparkPayload("lightning", null, "aabb", "ccdd");
            Map<String, Object> map = payload.toMap();

            assertEquals("lightning", map.get("paymentType"));
            assertFalse(map.containsKey("transferId"));
            assertEquals("aabb", map.get("preimage"));
            assertEquals("ccdd", map.get("paymentHash"));

            SparkPayload restored = SparkPayload.fromMap(map);
            assertEquals("lightning", restored.getPaymentType());
            assertNull(restored.getTransferId());
            assertEquals("aabb", restored.getPreimage());
            assertEquals("ccdd", restored.getPaymentHash());
        }

        @Test
        @DisplayName("should handle null map")
        void testFromNullMap() {
            SparkPayload payload = SparkPayload.fromMap(null);
            assertNull(payload.getPaymentType());
            assertNull(payload.getTransferId());
        }
    }

    // ============================================================
    // TransferInfo Tests
    // ============================================================

    @Nested
    @DisplayName("TransferInfo")
    class TransferInfoTest {

        @Test
        @DisplayName("should store transfer details")
        void testTransferInfo() {
            TransferInfo info = new TransferInfo(
                "tx-001", 1000, "spark:sender", "spark:receiver", TransferStatus.COMPLETED);

            assertEquals("tx-001", info.getId());
            assertEquals(1000, info.getAmount());
            assertEquals("spark:sender", info.getSender());
            assertEquals("spark:receiver", info.getReceiver());
            assertEquals(TransferStatus.COMPLETED, info.getStatus());
        }
    }

    // ============================================================
    // SparkFacilitatorScheme Tests
    // ============================================================

    @Nested
    @DisplayName("SparkFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockSparkSigner mockSigner;
        private SparkFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockSparkSigner(SERVER_ADDRESS);
            scheme = new SparkFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new SparkFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should return correct scheme and CAIP family")
        void testSchemeAndFamily() {
            assertEquals("exact", scheme.getScheme());
            assertEquals("spark:*", scheme.getCaipFamily());
        }

        // ============================================================
        // Spark Transfer Verification
        // ============================================================

        @Test
        @DisplayName("should verify valid spark transfer")
        void testVerifySparkTransfer() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 1000, "spark:sender", SERVER_ADDRESS, TransferStatus.COMPLETED));

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertEquals("spark:sender", result.payer);
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifySparkInsufficientAmount() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 500, "spark:sender", SERVER_ADDRESS, TransferStatus.COMPLETED));

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("insufficient_amount", result.invalidReason);
        }

        @Test
        @DisplayName("should accept overpayment")
        void testVerifySparkOverpayment() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 2000, "spark:sender", SERVER_ADDRESS, TransferStatus.COMPLETED));

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));

            assertTrue(result.isValid);
        }

        @Test
        @DisplayName("should reject wrong recipient")
        void testVerifySparkWrongRecipient() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 1000, "spark:sender", "spark:wrong", TransferStatus.COMPLETED));

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("wrong_recipient", result.invalidReason);
        }

        @Test
        @DisplayName("should reject pending transfer")
        void testVerifySparkNotCompleted() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 1000, "spark:sender", SERVER_ADDRESS, TransferStatus.PENDING));

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("transfer_not_completed", result.invalidReason);
        }

        @Test
        @DisplayName("should reject failed transfer")
        void testVerifySparkFailed() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 1000, "spark:sender", SERVER_ADDRESS, TransferStatus.FAILED));

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("transfer_not_completed", result.invalidReason);
        }

        @Test
        @DisplayName("should reject transfer not found")
        void testVerifySparkNotFound() {
            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createSparkPayload("tx-nonexistent"), createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("transfer_not_found", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing transfer ID")
        void testVerifySparkMissingTransferId() {
            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("paymentType", "spark");
            // no transferId

            Map<String, Object> payload = new HashMap<>();
            payload.put("payload", payloadData);

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("missing_transfer_id", result.invalidReason);
        }

        @Test
        @DisplayName("should detect replay attacks on spark transfers")
        void testVerifySparkReplayProtection() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 1000, "spark:sender", SERVER_ADDRESS, TransferStatus.COMPLETED));

            // First verification succeeds
            SparkFacilitatorScheme.VerificationResult first =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));
            assertTrue(first.isValid);

            // Second verification fails (replay)
            SparkFacilitatorScheme.VerificationResult second =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));
            assertFalse(second.isValid);
            assertEquals("replay_detected", second.invalidReason);
        }

        @Test
        @DisplayName("should allow different transfer IDs")
        void testVerifySparkDifferentTransfers() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 1000, "spark:sender", SERVER_ADDRESS, TransferStatus.COMPLETED));
            mockSigner.addTransfer(new TransferInfo(
                "tx-002", 2000, "spark:sender2", SERVER_ADDRESS, TransferStatus.COMPLETED));

            SparkFacilitatorScheme.VerificationResult first =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));
            assertTrue(first.isValid);

            SparkFacilitatorScheme.VerificationResult second =
                scheme.verifySync(createSparkPayload("tx-002"), createRequirements("1000"));
            assertTrue(second.isValid);
        }

        @Test
        @DisplayName("should reject case-insensitive recipient match")
        void testVerifySparkCaseInsensitiveRecipient() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 1000, "spark:sender", "SPARK:SERVER123", TransferStatus.COMPLETED));

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createSparkPayload("tx-001"), createRequirements("1000"));

            assertTrue(result.isValid);
        }

        // ============================================================
        // Lightning Verification
        // ============================================================

        @Test
        @DisplayName("should verify valid lightning preimage")
        void testVerifyLightning() {
            byte[] preimage = SAMPLE_PREIMAGE_TEXT.getBytes();
            String preimageHex = bytesToHex(preimage);
            String hashHex = sha256Hex(preimage);

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(
                    createLightningPayload(preimageHex, hashHex),
                    createRequirements("1000"));

            assertTrue(result.isValid);
            assertTrue(result.payer.startsWith("lightning:"));
        }

        @Test
        @DisplayName("should reject bad preimage")
        void testVerifyLightningBadPreimage() {
            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(
                    createLightningPayload("aabbccdd",
                        "0000000000000000000000000000000000000000000000000000000000000000"),
                    createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("preimage_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject invalid preimage hex")
        void testVerifyLightningInvalidPreimage() {
            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(
                    createLightningPayload("xyz_not_hex", "aabbccdd"),
                    createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("invalid_preimage", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing lightning proof")
        void testVerifyLightningMissingProof() {
            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("paymentType", "lightning");
            // no preimage or paymentHash

            Map<String, Object> payload = new HashMap<>();
            payload.put("payload", payloadData);

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("missing_lightning_proof", result.invalidReason);
        }

        @Test
        @DisplayName("should detect replay attacks on lightning payments")
        void testVerifyLightningReplayProtection() {
            byte[] preimage = SAMPLE_PREIMAGE_TEXT.getBytes();
            String preimageHex = bytesToHex(preimage);
            String hashHex = sha256Hex(preimage);

            // First verification succeeds
            SparkFacilitatorScheme.VerificationResult first =
                scheme.verifySync(
                    createLightningPayload(preimageHex, hashHex),
                    createRequirements("1000"));
            assertTrue(first.isValid);

            // Second verification fails (replay)
            SparkFacilitatorScheme.VerificationResult second =
                scheme.verifySync(
                    createLightningPayload(preimageHex, hashHex),
                    createRequirements("1000"));
            assertFalse(second.isValid);
            assertEquals("replay_detected", second.invalidReason);
        }

        @Test
        @DisplayName("should handle 0x-prefixed preimage and hash")
        void testVerifyLightningWithPrefix() {
            byte[] preimage = SAMPLE_PREIMAGE_TEXT.getBytes();
            String preimageHex = "0x" + bytesToHex(preimage);
            String hashHex = "0x" + sha256Hex(preimage);

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(
                    createLightningPayload(preimageHex, hashHex),
                    createRequirements("1000"));

            assertTrue(result.isValid);
        }

        // ============================================================
        // Unsupported Type
        // ============================================================

        @Test
        @DisplayName("should reject unsupported payment type")
        void testVerifyUnsupportedType() {
            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("paymentType", "l1");

            Map<String, Object> payload = new HashMap<>();
            payload.put("payload", payloadData);

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("unsupported_payment_type", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing payment type")
        void testVerifyMissingPaymentType() {
            Map<String, Object> payloadData = new HashMap<>();
            // no paymentType

            Map<String, Object> payload = new HashMap<>();
            payload.put("payload", payloadData);

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("missing_payment_type", result.invalidReason);
        }

        @Test
        @DisplayName("should reject invalid payload structure")
        void testVerifyInvalidPayloadStructure() {
            Map<String, Object> payload = new HashMap<>();
            // no "payload" key

            SparkFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, createRequirements("1000"));

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        // ============================================================
        // Settlement
        // ============================================================

        @Test
        @DisplayName("should settle valid spark transfer")
        void testSettleSparkSuccess() {
            mockSigner.addTransfer(new TransferInfo(
                "tx-001", 1000, "spark:sender", SERVER_ADDRESS, TransferStatus.COMPLETED));

            SparkFacilitatorScheme.SettlementResult result =
                scheme.settleSync(createSparkPayload("tx-001"), createRequirements("1000"));

            assertTrue(result.success);
            assertEquals("tx-001", result.transaction);
            assertEquals("spark:sender", result.payer);
            assertEquals(SparkConstants.SPARK_MAINNET, result.network);
        }

        @Test
        @DisplayName("should settle valid lightning payment")
        void testSettleLightningSuccess() {
            byte[] preimage = SAMPLE_PREIMAGE_TEXT.getBytes();
            String preimageHex = bytesToHex(preimage);
            String hashHex = sha256Hex(preimage);

            SparkFacilitatorScheme.SettlementResult result =
                scheme.settleSync(
                    createLightningPayload(preimageHex, hashHex),
                    createRequirements("1000"));

            assertTrue(result.success);
            assertEquals(hashHex, result.transaction);
            assertTrue(result.payer.startsWith("lightning:"));
        }

        @Test
        @DisplayName("should fail settlement on invalid transfer")
        void testSettleFailure() {
            SparkFacilitatorScheme.SettlementResult result =
                scheme.settleSync(createSparkPayload("tx-nonexistent"), createRequirements("1000"));

            assertFalse(result.success);
            assertNotNull(result.errorReason);
        }

        // ============================================================
        // Result Map Conversion
        // ============================================================

        @Test
        @DisplayName("should convert verification result to map")
        void testVerificationResultToMap() {
            SparkFacilitatorScheme.VerificationResult valid =
                SparkFacilitatorScheme.VerificationResult.valid("spark:sender");
            Map<String, Object> map = valid.toMap();
            assertEquals(true, map.get("isValid"));
            assertNull(map.get("invalidReason"));
            assertEquals("spark:sender", map.get("payer"));

            SparkFacilitatorScheme.VerificationResult invalid =
                SparkFacilitatorScheme.VerificationResult.invalid("test_error", "");
            Map<String, Object> map2 = invalid.toMap();
            assertEquals(false, map2.get("isValid"));
            assertEquals("test_error", map2.get("invalidReason"));
        }

        @Test
        @DisplayName("should convert settlement result to map")
        void testSettlementResultToMap() {
            SparkFacilitatorScheme.SettlementResult success =
                SparkFacilitatorScheme.SettlementResult.success("spark:mainnet", "tx-001", "spark:sender");
            Map<String, Object> map = success.toMap();
            assertEquals(true, map.get("success"));
            assertEquals("spark:mainnet", map.get("network"));
            assertEquals("tx-001", map.get("transaction"));
            assertNull(map.get("errorReason"));
            assertEquals("spark:sender", map.get("payer"));
        }
    }
}
