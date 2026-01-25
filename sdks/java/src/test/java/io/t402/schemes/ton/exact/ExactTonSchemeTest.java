package io.t402.schemes.ton.exact;

import io.t402.schemes.ton.*;

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
 * Tests for Exact TON scheme implementations.
 */
@DisplayName("Exact TON Schemes")
class ExactTonSchemeTest {

    private static final String SAMPLE_ADDRESS_1 = "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2";
    private static final String SAMPLE_ADDRESS_2 = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
    private static final String FACILITATOR_ADDRESS = "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a";

    // Sample signature (Base64-encoded)
    private static final String MOCK_SIGNATURE = "dGVzdC1zaWduYXR1cmU=";

    @Nested
    @DisplayName("ExactTonServerScheme")
    class ServerSchemeTest {

        private ExactTonServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactTonServerScheme();
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", TonConstants.TON_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertEquals(TonConstants.USDT_MAINNET, result.get("asset"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDT", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("1500000", TonConstants.TON_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should normalize legacy network identifiers")
        void testParsePriceLegacyNetwork() {
            Map<String, Object> result = scheme.parsePrice("1.00", "mainnet");

            assertEquals("1000000", result.get("amount"));
            assertEquals(TonConstants.USDT_MAINNET, result.get("asset"));
        }

        @Test
        @DisplayName("should use testnet USDT for testnet")
        void testParsePriceTestnet() {
            Map<String, Object> result = scheme.parsePrice("1.00", TonConstants.TON_TESTNET);

            assertEquals(TonConstants.USDT_TESTNET, result.get("asset"));
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
            assertEquals(TonConstants.TON_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertEquals(TonConstants.USDT_MAINNET, requirements.get("asset"));
            assertEquals(TonConstants.DEFAULT_VALIDITY_DURATION, requirements.get("maxTimeoutSeconds"));
            assertEquals("API Access", requirements.get("resource"));
        }

        @Test
        @DisplayName("should create requirements with custom network")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                TonConstants.TON_TESTNET,
                SAMPLE_ADDRESS_2,
                "1000000",
                null,
                600
            );

            assertEquals("exact", requirements.get("scheme"));
            assertEquals(TonConstants.TON_TESTNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("1000000", requirements.get("maxAmountRequired"));
            assertEquals(TonConstants.USDT_TESTNET, requirements.get("asset"));
            assertEquals(600, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact");
            valid.put("network", TonConstants.TON_MAINNET);
            valid.put("payTo", SAMPLE_ADDRESS_2);

            assertTrue(scheme.validateRequirements(valid));

            // Missing scheme
            Map<String, Object> noScheme = new HashMap<>();
            noScheme.put("network", TonConstants.TON_MAINNET);
            noScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(noScheme));

            // Wrong scheme
            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "upto");
            wrongScheme.put("network", TonConstants.TON_MAINNET);
            wrongScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-TON network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongNetwork));
        }
    }

    @Nested
    @DisplayName("ExactTonClientScheme")
    class ClientSchemeTest {

        private MockClientSigner mockSigner;
        private ExactTonClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientSigner(SAMPLE_ADDRESS_1);
            scheme = new ExactTonClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SAMPLE_ADDRESS_1, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactTonClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", TonConstants.TON_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TonConstants.USDT_MAINNET);
            requirements.put("maxTimeoutSeconds", 300);

            Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, payload.get("t402Version"));
            assertEquals("exact", payload.get("scheme"));
            assertEquals(TonConstants.TON_MAINNET, payload.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            assertNotNull(payloadData);
            assertEquals(MOCK_SIGNATURE, payloadData.get("signature"));

            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");
            assertNotNull(auth);
            assertEquals(SAMPLE_ADDRESS_1, auth.get("sender"));
            assertEquals(SAMPLE_ADDRESS_2, auth.get("recipient"));
            assertEquals("1000000", auth.get("amount"));
        }

        @Test
        @DisplayName("should create payment payload async")
        void testCreatePayloadAsync() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", TonConstants.TON_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            Map<String, Object> payload = future.join();

            assertEquals("exact", payload.get("scheme"));
            assertEquals(TonConstants.TON_MAINNET, payload.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            assertNotNull(payloadData.get("signature"));
        }
    }

    @Nested
    @DisplayName("ExactTonFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorSigner mockSigner;
        private ExactTonFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorSigner(Arrays.asList(FACILITATOR_ADDRESS));
            scheme = new ExactTonFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactTonFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(TonConstants.TON_MAINNET);
            assertEquals(1, signers.size());
            assertEquals(FACILITATOR_ADDRESS, signers.get(0));
        }

        @Test
        @DisplayName("should get extra with facilitator")
        void testGetExtra() {
            Map<String, Object> extra = scheme.getExtra(TonConstants.TON_MAINNET);
            assertNotNull(extra);
            assertEquals(FACILITATOR_ADDRESS, extra.get("facilitator"));
        }

        @Test
        @DisplayName("should reject invalid payload structure")
        void testVerifyInvalidPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "exact");
            payload.put("network", TonConstants.TON_MAINNET);
            // Missing payload

            Map<String, Object> requirements = createValidRequirements();

            ExactTonFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        @Test
        @DisplayName("should reject scheme mismatch")
        void testVerifySchemeMismatch() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "upto");

            Map<String, Object> requirements = createValidRequirements();

            ExactTonFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("unsupported_scheme", result.invalidReason);
        }

        @Test
        @DisplayName("should reject network mismatch")
        void testVerifyNetworkMismatch() {
            Map<String, Object> payload = createValidPayload();
            payload.put("network", TonConstants.TON_TESTNET);

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("network", TonConstants.TON_MAINNET);

            ExactTonFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("network_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject recipient mismatch")
        void testVerifyRecipientMismatch() {
            Map<String, Object> payload = createValidPayload();
            // payload's auth.recipient is SAMPLE_ADDRESS_2

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo", "EQDifferentAddress111111111111111111111111111");

            ExactTonFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("recipient_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyAmountInsufficient() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than payload's 1000000

            ExactTonFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("amount_insufficient", result.invalidReason);
        }

        @Test
        @DisplayName("should reject expired authorization")
        void testVerifyAuthorizationExpired() {
            Map<String, Object> payload = createValidPayload();

            // Set validUntil to past
            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");
            auth.put("validUntil", System.currentTimeMillis() / 1000 - 1000);

            Map<String, Object> requirements = createValidRequirements();

            ExactTonFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("authorization_expired", result.invalidReason);
        }

        @Test
        @DisplayName("should verify valid payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactTonFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactTonFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "upto"); // Wrong scheme

            Map<String, Object> requirements = createValidRequirements();

            ExactTonFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals("unsupported_scheme", result.errorReason);
        }

        private Map<String, Object> createValidPayload() {
            long validUntil = System.currentTimeMillis() / 1000 + 300;

            Map<String, Object> auth = new HashMap<>();
            auth.put("sender", SAMPLE_ADDRESS_1);
            auth.put("recipient", SAMPLE_ADDRESS_2);
            auth.put("amount", "1000000");
            auth.put("nonce", "test-nonce-123");
            auth.put("token", TonConstants.USDT_MAINNET);
            auth.put("validUntil", validUntil);

            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("signature", MOCK_SIGNATURE);
            payloadData.put("authorization", auth);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact");
            payload.put("network", TonConstants.TON_MAINNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact");
            requirements.put("network", TonConstants.TON_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TonConstants.USDT_MAINNET);
            requirements.put("maxTimeoutSeconds", 300);

            return requirements;
        }
    }

    // Mock implementations for testing

    static class MockClientSigner implements ClientTonSigner {
        private final String address;

        MockClientSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> signPayment(TonAuthorization authorization, String network) {
            // Return a mock signature
            return CompletableFuture.completedFuture(MOCK_SIGNATURE);
        }
    }

    static class MockFacilitatorSigner implements FacilitatorTonSigner {
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
                TonAuthorization authorization, String signature, String network) {
            // Mock: always valid for test signature
            return CompletableFuture.completedFuture(MOCK_SIGNATURE.equals(signature));
        }

        @Override
        public CompletableFuture<String> sendTransaction(
                TonAuthorization authorization, String signature, String network) {
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
