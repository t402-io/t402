package io.t402.schemes.svm.exact;

import io.t402.schemes.svm.*;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for Exact SVM scheme implementations.
 */
@DisplayName("Exact SVM Schemes")
class ExactSvmSchemeTest {

    private static final String SAMPLE_ADDRESS_1 = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
    private static final String SAMPLE_ADDRESS_2 = "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL";
    private static final String FEE_PAYER_ADDRESS = "FeePayerAddress1111111111111111111111111111";

    // Mock transaction (150 bytes of zeros encoded as base64)
    private static final String MOCK_TRANSACTION = Base64.getEncoder().encodeToString(new byte[150]);

    @Nested
    @DisplayName("ExactSvmServerScheme")
    class ServerSchemeTest {

        private ExactSvmServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactSvmServerScheme();
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", SvmConstants.SOLANA_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertEquals(SvmConstants.USDC_MAINNET_ADDRESS, result.get("asset"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDC", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("1500000", SvmConstants.SOLANA_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should normalize legacy network identifiers")
        void testParsePriceLegacyNetwork() {
            Map<String, Object> result = scheme.parsePrice("1.00", "solana");

            assertEquals("1000000", result.get("amount"));
            assertEquals(SvmConstants.USDC_MAINNET_ADDRESS, result.get("asset"));
        }

        @Test
        @DisplayName("should use devnet USDC for devnet")
        void testParsePriceDevnet() {
            Map<String, Object> result = scheme.parsePrice("1.00", SvmConstants.SOLANA_DEVNET);

            assertEquals(SvmConstants.USDC_DEVNET_ADDRESS, result.get("asset"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "invalid-network"));
        }

        @Test
        @DisplayName("should enhance requirements with fee payer")
        void testEnhanceRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", "solana"); // legacy
            requirements.put("payTo", SAMPLE_ADDRESS_2);

            Map<String, Object> enhanced = scheme.enhancePaymentRequirements(requirements, FEE_PAYER_ADDRESS);

            assertEquals(SvmConstants.SOLANA_MAINNET, enhanced.get("network"));
            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) enhanced.get("extra");
            assertEquals(FEE_PAYER_ADDRESS, extra.get("feePayer"));
        }

        @Test
        @DisplayName("should create complete payment requirements")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                SvmConstants.SOLANA_MAINNET,
                SAMPLE_ADDRESS_2,
                "1000000",
                null,
                3600,
                FEE_PAYER_ADDRESS
            );

            assertEquals("exact", requirements.get("scheme"));
            assertEquals(SvmConstants.SOLANA_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("1000000", requirements.get("maxAmountRequired"));
            assertEquals(SvmConstants.USDC_MAINNET_ADDRESS, requirements.get("asset"));
            assertEquals(3600, requirements.get("maxTimeoutSeconds"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals(FEE_PAYER_ADDRESS, extra.get("feePayer"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact");
            valid.put("network", SvmConstants.SOLANA_MAINNET);
            valid.put("payTo", SAMPLE_ADDRESS_2);

            assertTrue(scheme.validateRequirements(valid));

            // Missing scheme
            Map<String, Object> noScheme = new HashMap<>();
            noScheme.put("network", SvmConstants.SOLANA_MAINNET);
            noScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(noScheme));

            // Wrong scheme
            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "upto");
            wrongScheme.put("network", SvmConstants.SOLANA_MAINNET);
            wrongScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-SVM network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongNetwork));
        }
    }

    @Nested
    @DisplayName("ExactSvmClientScheme")
    class ClientSchemeTest {

        private MockClientSigner mockSigner;
        private ExactSvmClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientSigner(SAMPLE_ADDRESS_1);
            scheme = new ExactSvmClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SAMPLE_ADDRESS_1, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactSvmClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload from transaction")
        void testCreatePayloadFromTransaction() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", SvmConstants.SOLANA_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SvmConstants.USDC_MAINNET_ADDRESS);
            requirements.put("maxTimeoutSeconds", 3600);

            Map<String, Object> extra = new HashMap<>();
            extra.put("feePayer", FEE_PAYER_ADDRESS);
            requirements.put("extra", extra);

            Map<String, Object> payload = scheme.createPaymentPayloadFromTransaction(
                requirements, MOCK_TRANSACTION);

            assertEquals(2, payload.get("t402Version"));
            assertEquals("exact", payload.get("scheme"));
            assertEquals(SvmConstants.SOLANA_MAINNET, payload.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            assertNotNull(payloadData);
            assertEquals(MOCK_TRANSACTION, payloadData.get("transaction"));

            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");
            assertNotNull(auth);
            assertEquals(SAMPLE_ADDRESS_1, auth.get("from"));
            assertEquals(SAMPLE_ADDRESS_2, auth.get("to"));
            assertEquals("1000000", auth.get("amount"));
            assertEquals(FEE_PAYER_ADDRESS, auth.get("feePayer"));
        }

        @Test
        @DisplayName("should create payment payload async")
        void testCreatePayloadAsync() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", SvmConstants.SOLANA_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(
                requirements,
                () -> CompletableFuture.completedFuture(MOCK_TRANSACTION)
            );

            Map<String, Object> payload = future.join();

            assertEquals("exact", payload.get("scheme"));
            assertEquals(SvmConstants.SOLANA_MAINNET, payload.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            assertNotNull(payloadData.get("transaction"));
        }
    }

    @Nested
    @DisplayName("ExactSvmFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorSigner mockSigner;
        private ExactSvmFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorSigner(Arrays.asList(FEE_PAYER_ADDRESS));
            scheme = new ExactSvmFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactSvmFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(SvmConstants.SOLANA_MAINNET);
            assertEquals(1, signers.size());
            assertEquals(FEE_PAYER_ADDRESS, signers.get(0));
        }

        @Test
        @DisplayName("should get extra with fee payer")
        void testGetExtra() {
            Map<String, Object> extra = scheme.getExtra(SvmConstants.SOLANA_MAINNET);
            assertNotNull(extra);
            assertEquals(FEE_PAYER_ADDRESS, extra.get("feePayer"));
        }

        @Test
        @DisplayName("should reject invalid payload structure")
        void testVerifyInvalidPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "exact");
            payload.put("network", SvmConstants.SOLANA_MAINNET);
            // Missing payload

            Map<String, Object> requirements = createValidRequirements();

            ExactSvmFacilitatorScheme.VerificationResult result =
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

            ExactSvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("unsupported_scheme", result.invalidReason);
        }

        @Test
        @DisplayName("should reject network mismatch")
        void testVerifyNetworkMismatch() {
            Map<String, Object> payload = createValidPayload();
            payload.put("network", SvmConstants.SOLANA_DEVNET);

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("network", SvmConstants.SOLANA_MAINNET);

            ExactSvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("network_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing fee payer")
        void testVerifyMissingFeePayer() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.remove("extra");

            ExactSvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_exact_svm_payload_missing_fee_payer", result.invalidReason);
        }

        @Test
        @DisplayName("should reject unmanaged fee payer")
        void testVerifyUnmanagedFeePayer() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            extra.put("feePayer", "UnknownFeePayer11111111111111111111111111");

            ExactSvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("fee_payer_not_managed_by_facilitator", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than payload's 1000000

            ExactSvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_exact_svm_payload_amount_insufficient", result.invalidReason);
        }

        @Test
        @DisplayName("should verify valid payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactSvmFacilitatorScheme.VerificationResult result =
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

            ExactSvmFacilitatorScheme.SettlementResult result =
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

            ExactSvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals("unsupported_scheme", result.errorReason);
        }

        private Map<String, Object> createValidPayload() {
            Map<String, Object> auth = new HashMap<>();
            auth.put("from", SAMPLE_ADDRESS_1);
            auth.put("to", SAMPLE_ADDRESS_2);
            auth.put("mint", SvmConstants.USDC_MAINNET_ADDRESS);
            auth.put("amount", "1000000");
            auth.put("validUntil", SvmUtils.calculateValidUntil(3600));
            auth.put("feePayer", FEE_PAYER_ADDRESS);

            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("transaction", MOCK_TRANSACTION);
            payloadData.put("authorization", auth);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact");
            payload.put("network", SvmConstants.SOLANA_MAINNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> extra = new HashMap<>();
            extra.put("feePayer", FEE_PAYER_ADDRESS);

            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact");
            requirements.put("network", SvmConstants.SOLANA_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SvmConstants.USDC_MAINNET_ADDRESS);
            requirements.put("maxTimeoutSeconds", 3600);
            requirements.put("extra", extra);

            return requirements;
        }
    }

    // Mock implementations for testing

    static class MockClientSigner implements ClientSvmSigner {
        private final String address;

        MockClientSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> signTransaction(String txBase64, String network) {
            // Just return the transaction as-is (mock signing)
            return CompletableFuture.completedFuture(txBase64);
        }
    }

    static class MockFacilitatorSigner implements FacilitatorSvmSigner {
        private final List<String> addresses;
        private int signCount = 0;

        MockFacilitatorSigner(List<String> addresses) {
            this.addresses = addresses;
        }

        @Override
        public List<String> getAddresses() {
            return addresses;
        }

        @Override
        public CompletableFuture<String> signTransaction(String txBase64, String feePayer, String network) {
            signCount++;
            return CompletableFuture.completedFuture(txBase64);
        }

        @Override
        public CompletableFuture<Boolean> simulateTransaction(String txBase64, String network) {
            return CompletableFuture.completedFuture(true);
        }

        @Override
        public CompletableFuture<String> sendTransaction(String txBase64, String network) {
            return CompletableFuture.completedFuture("MockSignature" + signCount);
        }

        @Override
        public CompletableFuture<Boolean> confirmTransaction(String signature, String network) {
            return CompletableFuture.completedFuture(true);
        }
    }
}
