package io.t402.schemes.tron.exact;

import io.t402.schemes.tron.*;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for Exact TRON scheme implementations.
 */
@DisplayName("Exact TRON Schemes")
class ExactTronSchemeTest {

    private static final String SAMPLE_ADDRESS_1 = "TXyz9aM3gxyNxtwC8K7EpP5ZMxQwqKy1vF";
    private static final String SAMPLE_ADDRESS_2 = "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5";
    private static final String FACILITATOR_ADDRESS = "TDGmmwNEfxdyNRNNQq7bpJMRHHcFJQdNZv";

    // Sample signature (hex-encoded)
    private static final String MOCK_SIGNATURE = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12";

    @Nested
    @DisplayName("ExactTronServerScheme")
    class ServerSchemeTest {

        private ExactTronServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactTronServerScheme();
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", TronConstants.TRON_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertEquals(TronConstants.USDT_MAINNET, result.get("asset"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDT", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("1500000", TronConstants.TRON_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should normalize legacy network identifiers")
        void testParsePriceLegacyNetwork() {
            Map<String, Object> result = scheme.parsePrice("1.00", "mainnet");

            assertEquals("1000000", result.get("amount"));
            assertEquals(TronConstants.USDT_MAINNET, result.get("asset"));
        }

        @Test
        @DisplayName("should use nile testnet USDT for nile")
        void testParsePriceNile() {
            Map<String, Object> result = scheme.parsePrice("1.00", TronConstants.TRON_NILE);

            assertEquals(TronConstants.USDT_NILE, result.get("asset"));
        }

        @Test
        @DisplayName("should use shasta testnet USDT for shasta")
        void testParsePriceShasta() {
            Map<String, Object> result = scheme.parsePrice("1.00", TronConstants.TRON_SHASTA);

            assertEquals(TronConstants.USDT_SHASTA, result.get("asset"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "invalid-network"));
        }

        @Test
        @DisplayName("should create complete payment requirements")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50",
                SAMPLE_ADDRESS_2,
                "API Access"
            );

            assertEquals("exact", requirements.get("scheme"));
            assertEquals(TronConstants.TRON_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertEquals(TronConstants.USDT_MAINNET, requirements.get("asset"));
            assertEquals(TronConstants.DEFAULT_VALIDITY_DURATION, requirements.get("maxTimeoutSeconds"));
            assertEquals("API Access", requirements.get("resource"));
        }

        @Test
        @DisplayName("should create requirements with custom network")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                TronConstants.TRON_NILE,
                SAMPLE_ADDRESS_2,
                "1000000",
                null,
                600
            );

            assertEquals("exact", requirements.get("scheme"));
            assertEquals(TronConstants.TRON_NILE, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("1000000", requirements.get("maxAmountRequired"));
            assertEquals(TronConstants.USDT_NILE, requirements.get("asset"));
            assertEquals(600, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact");
            valid.put("network", TronConstants.TRON_MAINNET);
            valid.put("payTo", SAMPLE_ADDRESS_2);

            assertTrue(scheme.validateRequirements(valid));

            // Missing scheme
            Map<String, Object> noScheme = new HashMap<>();
            noScheme.put("network", TronConstants.TRON_MAINNET);
            noScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(noScheme));

            // Wrong scheme
            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "upto");
            wrongScheme.put("network", TronConstants.TRON_MAINNET);
            wrongScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-TRON network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongNetwork));
        }
    }

    @Nested
    @DisplayName("ExactTronClientScheme")
    class ClientSchemeTest {

        private MockClientSigner mockSigner;
        private ExactTronClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientSigner(SAMPLE_ADDRESS_1);
            scheme = new ExactTronClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SAMPLE_ADDRESS_1, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactTronClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", TronConstants.TRON_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TronConstants.USDT_MAINNET);
            requirements.put("maxTimeoutSeconds", 300);

            Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, payload.get("t402Version"));
            assertEquals("exact", payload.get("scheme"));
            assertEquals(TronConstants.TRON_MAINNET, payload.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            assertNotNull(payloadData);
            assertEquals(MOCK_SIGNATURE, payloadData.get("signature"));

            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");
            assertNotNull(auth);
            assertEquals(SAMPLE_ADDRESS_1, auth.get("from"));
            assertEquals(SAMPLE_ADDRESS_2, auth.get("to"));
            assertEquals("1000000", auth.get("amount"));
        }

        @Test
        @DisplayName("should create payment payload async")
        void testCreatePayloadAsync() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", TronConstants.TRON_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            Map<String, Object> payload = future.join();

            assertEquals("exact", payload.get("scheme"));
            assertEquals(TronConstants.TRON_MAINNET, payload.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            assertNotNull(payloadData.get("signature"));
        }
    }

    @Nested
    @DisplayName("ExactTronFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorSigner mockSigner;
        private ExactTronFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorSigner(Arrays.asList(FACILITATOR_ADDRESS));
            scheme = new ExactTronFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactTronFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get addresses")
        void testGetAddresses() {
            List<String> addresses = scheme.getAddresses();
            assertEquals(1, addresses.size());
            assertEquals(FACILITATOR_ADDRESS, addresses.get(0));
        }

        @Test
        @DisplayName("should reject missing payload")
        void testVerifyMissingPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "exact");
            payload.put("network", TronConstants.TRON_MAINNET);
            // Missing payload

            Map<String, Object> requirements = createValidRequirements();

            ExactTronFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertEquals("Missing payload", result.error);
        }

        @Test
        @DisplayName("should reject recipient mismatch")
        void testVerifyRecipientMismatch() {
            Map<String, Object> payload = createValidPayload();

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo", "TDifferentAddress111111111111111111");

            ExactTronFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Invalid recipient"));
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyAmountInsufficient() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than payload's 1000000

            ExactTronFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Amount too low"));
        }

        @Test
        @DisplayName("should reject expired payment")
        void testVerifyExpiredPayment() {
            Map<String, Object> payload = createValidPayload();

            // Set validBefore to past
            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");
            auth.put("validBefore", System.currentTimeMillis() / 1000 - 1000);

            Map<String, Object> requirements = createValidRequirements();

            ExactTronFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("expired"));
        }

        @Test
        @DisplayName("should reject payment not yet valid")
        void testVerifyPaymentNotYetValid() {
            Map<String, Object> payload = createValidPayload();

            // Set validAfter to future
            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");
            auth.put("validAfter", System.currentTimeMillis() / 1000 + 10000);

            Map<String, Object> requirements = createValidRequirements();

            ExactTronFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("not yet valid"));
        }

        @Test
        @DisplayName("should verify valid payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactTronFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
            assertNull(result.error);
            assertNotNull(result.payload);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactTronFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertEquals(ExactTronFacilitatorScheme.SettlementStatus.SUCCESS, result.status);
            assertNotNull(result.transaction);
            assertNull(result.error);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than provided

            ExactTronFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertEquals(ExactTronFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertNotNull(result.error);
        }

        private Map<String, Object> createValidPayload() {
            long now = System.currentTimeMillis() / 1000;
            long validAfter = now - 60;
            long validBefore = now + 300;

            Map<String, Object> auth = new HashMap<>();
            auth.put("from", SAMPLE_ADDRESS_1);
            auth.put("to", SAMPLE_ADDRESS_2);
            auth.put("amount", "1000000");
            auth.put("nonce", "0x123456789abcdef");
            auth.put("token", TronConstants.USDT_MAINNET);
            auth.put("validAfter", validAfter);
            auth.put("validBefore", validBefore);

            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("signature", MOCK_SIGNATURE);
            payloadData.put("authorization", auth);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact");
            payload.put("network", TronConstants.TRON_MAINNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact");
            requirements.put("network", TronConstants.TRON_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TronConstants.USDT_MAINNET);
            requirements.put("maxTimeoutSeconds", 300);

            return requirements;
        }
    }

    // Mock implementations for testing

    static class MockClientSigner implements ClientTronSigner {
        private final String address;

        MockClientSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> signPayment(TronAuthorization authorization, String network) {
            // Return a mock signature
            return CompletableFuture.completedFuture(MOCK_SIGNATURE);
        }
    }

    static class MockFacilitatorSigner implements FacilitatorTronSigner {
        private final List<String> addresses;
        private int txCount = 0;

        MockFacilitatorSigner(List<String> addresses) {
            this.addresses = addresses;
        }

        @Override
        public List<String> getAddresses() {
            return addresses;
        }

        @Override
        public CompletableFuture<Boolean> verifySignature(
                TronAuthorization authorization, String signature, String network) {
            // Mock: always valid for test signature
            return CompletableFuture.completedFuture(MOCK_SIGNATURE.equals(signature));
        }

        @Override
        public CompletableFuture<String> sendTransaction(
                TronAuthorization authorization, String signature, String network) {
            txCount++;
            return CompletableFuture.completedFuture("MockTxHash" + txCount);
        }

        @Override
        public CompletableFuture<Boolean> confirmTransaction(String txHash, String network) {
            return CompletableFuture.completedFuture(true);
        }

        @Override
        public CompletableFuture<String> getBalance(String address, String token, String network) {
            return CompletableFuture.completedFuture("10000000000");
        }
    }
}
