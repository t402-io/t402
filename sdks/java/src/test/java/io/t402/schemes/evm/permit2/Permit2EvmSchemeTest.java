package io.t402.schemes.evm.permit2;

import io.t402.schemes.evm.EvmConstants;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for Permit2 EVM scheme implementations.
 */
@DisplayName("Permit2 EVM Schemes")
class Permit2EvmSchemeTest {

    private static final String SAMPLE_ADDRESS_1 = "0x1234567890123456789012345678901234567890";
    private static final String SAMPLE_ADDRESS_2 = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";
    private static final String SAMPLE_SIGNATURE = "0x" + "ab".repeat(32) + "cd".repeat(32) + "1b";
    private static final String SAMPLE_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    // =========================================================================
    // Permit2Constants Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2Constants")
    class ConstantsTest {

        @Test
        @DisplayName("should have correct Permit2 address")
        void testPermit2Address() {
            assertEquals("0x000000000022D473030F116dDEE9F6B43aC78BA3",
                Permit2Constants.PERMIT2_ADDRESS);
        }

        @Test
        @DisplayName("should have correct scheme identifier")
        void testSchemeIdentifier() {
            assertEquals("permit2", Permit2Constants.SCHEME_PERMIT2);
        }

        @Test
        @DisplayName("should have correct CAIP family")
        void testCaipFamily() {
            assertEquals("eip155:*", Permit2Constants.CAIP_FAMILY);
        }

        @Test
        @DisplayName("should have correct domain name")
        void testDomainName() {
            assertEquals("Permit2", Permit2Constants.PERMIT2_DOMAIN_NAME);
        }
    }

    // =========================================================================
    // Permit2Payload Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2Payload")
    class PayloadTest {

        @Test
        @DisplayName("should build payload with all fields")
        void testBuildPayload() {
            Permit2Payload payload = Permit2Payload.builder()
                .token(SAMPLE_TOKEN)
                .amount("1000000")
                .nonce("12345")
                .deadline("1700000000")
                .to(SAMPLE_ADDRESS_2)
                .requestedAmount("1000000")
                .signature(SAMPLE_SIGNATURE)
                .owner(SAMPLE_ADDRESS_1)
                .build();

            assertEquals(SAMPLE_TOKEN, payload.getToken());
            assertEquals("1000000", payload.getAmount());
            assertEquals("12345", payload.getNonce());
            assertEquals("1700000000", payload.getDeadline());
            assertEquals(SAMPLE_ADDRESS_2, payload.getTo());
            assertEquals("1000000", payload.getRequestedAmount());
            assertEquals(SAMPLE_SIGNATURE, payload.getSignature());
            assertEquals(SAMPLE_ADDRESS_1, payload.getOwner());
        }

        @Test
        @DisplayName("should throw when token is missing")
        void testMissingToken() {
            assertThrows(IllegalArgumentException.class, () ->
                Permit2Payload.builder()
                    .amount("1000000")
                    .nonce("12345")
                    .deadline("1700000000")
                    .to(SAMPLE_ADDRESS_2)
                    .requestedAmount("1000000")
                    .signature(SAMPLE_SIGNATURE)
                    .owner(SAMPLE_ADDRESS_1)
                    .build());
        }

        @Test
        @DisplayName("should throw when signature is missing")
        void testMissingSignature() {
            assertThrows(IllegalArgumentException.class, () ->
                Permit2Payload.builder()
                    .token(SAMPLE_TOKEN)
                    .amount("1000000")
                    .nonce("12345")
                    .deadline("1700000000")
                    .to(SAMPLE_ADDRESS_2)
                    .requestedAmount("1000000")
                    .owner(SAMPLE_ADDRESS_1)
                    .build());
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapSerialization() {
            Permit2Payload original = Permit2Payload.builder()
                .token(SAMPLE_TOKEN)
                .amount("1000000")
                .nonce("12345")
                .deadline("1700000000")
                .to(SAMPLE_ADDRESS_2)
                .requestedAmount("1000000")
                .signature(SAMPLE_SIGNATURE)
                .owner(SAMPLE_ADDRESS_1)
                .build();

            Map<String, Object> map = original.toMap();
            Permit2Payload restored = Permit2Payload.fromMap(map);

            assertEquals(original.getToken(), restored.getToken());
            assertEquals(original.getAmount(), restored.getAmount());
            assertEquals(original.getNonce(), restored.getNonce());
            assertEquals(original.getDeadline(), restored.getDeadline());
            assertEquals(original.getTo(), restored.getTo());
            assertEquals(original.getRequestedAmount(), restored.getRequestedAmount());
            assertEquals(original.getSignature(), restored.getSignature());
            assertEquals(original.getOwner(), restored.getOwner());
        }

        @Test
        @DisplayName("should have correct map structure")
        @SuppressWarnings("unchecked")
        void testMapStructure() {
            Permit2Payload payload = Permit2Payload.builder()
                .token(SAMPLE_TOKEN)
                .amount("1000000")
                .nonce("12345")
                .deadline("1700000000")
                .to(SAMPLE_ADDRESS_2)
                .requestedAmount("1000000")
                .signature(SAMPLE_SIGNATURE)
                .owner(SAMPLE_ADDRESS_1)
                .build();

            Map<String, Object> map = payload.toMap();

            // Check top-level keys
            assertTrue(map.containsKey("permit"));
            assertTrue(map.containsKey("transferDetails"));
            assertTrue(map.containsKey("signature"));
            assertTrue(map.containsKey("owner"));

            // Check permit structure
            Map<String, Object> permit = (Map<String, Object>) map.get("permit");
            assertNotNull(permit.get("permitted"));
            assertEquals("12345", permit.get("nonce"));
            assertEquals("1700000000", permit.get("deadline"));

            Map<String, Object> permitted = (Map<String, Object>) permit.get("permitted");
            assertEquals(SAMPLE_TOKEN, permitted.get("token"));
            assertEquals("1000000", permitted.get("amount"));

            // Check transferDetails
            Map<String, Object> td = (Map<String, Object>) map.get("transferDetails");
            assertEquals(SAMPLE_ADDRESS_2, td.get("to"));
            assertEquals("1000000", td.get("requestedAmount"));
        }
    }

    // =========================================================================
    // Permit2EvmServerScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2EvmServerScheme")
    class ServerSchemeTest {

        private Permit2EvmServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new Permit2EvmServerScheme(EvmConstants.BASE_MAINNET);
        }

        @Test
        @DisplayName("should create with default network")
        void testDefaultNetwork() {
            Permit2EvmServerScheme defaultScheme = new Permit2EvmServerScheme();
            assertEquals(EvmConstants.ETHEREUM_MAINNET, defaultScheme.getDefaultNetwork());
        }

        @Test
        @DisplayName("should reject non-EVM network")
        void testRejectNonEvmNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                new Permit2EvmServerScheme("solana:mainnet"));
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", EvmConstants.BASE_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertNotNull(result.get("asset"));
            assertEquals(6, result.get("decimals"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("1500000", EvmConstants.BASE_MAINNET);
            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should create payment requirements with permit2Address extra")
        @SuppressWarnings("unchecked")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", SAMPLE_ADDRESS_2, "API Access");

            assertEquals(2, requirements.get("t402Version"));
            assertEquals("permit2", requirements.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertNotNull(requirements.get("asset"));
            assertEquals("API Access", requirements.get("resource"));

            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertNotNull(extra);
            assertEquals(Permit2Constants.PERMIT2_ADDRESS, extra.get("permit2Address"));
        }

        @Test
        @DisplayName("should validate correct requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "permit2");
            valid.put("network", EvmConstants.BASE_MAINNET);
            valid.put("payTo", SAMPLE_ADDRESS_2);

            assertTrue(scheme.validateRequirements(valid));
        }

        @Test
        @DisplayName("should reject invalid requirements")
        void testValidateInvalidRequirements() {
            assertFalse(scheme.validateRequirements(null));

            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "exact");
            wrongScheme.put("network", EvmConstants.BASE_MAINNET);
            wrongScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongScheme));

            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "permit2");
            wrongNetwork.put("network", "solana:mainnet");
            wrongNetwork.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongNetwork));

            Map<String, Object> noPayTo = new HashMap<>();
            noPayTo.put("scheme", "permit2");
            noPayTo.put("network", EvmConstants.BASE_MAINNET);
            assertFalse(scheme.validateRequirements(noPayTo));
        }
    }

    // =========================================================================
    // Permit2EvmClientScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2EvmClientScheme")
    class ClientSchemeTest {

        private MockPermit2Signer mockSigner;
        private Permit2EvmClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockPermit2Signer(SAMPLE_ADDRESS_1);
            scheme = new Permit2EvmClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SAMPLE_ADDRESS_1, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new Permit2EvmClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        @SuppressWarnings("unchecked")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SAMPLE_TOKEN);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("permit2", result.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, result.get("network"));

            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            assertNotNull(payloadData);
            assertNotNull(payloadData.get("signature"));
            assertEquals(SAMPLE_ADDRESS_1, payloadData.get("owner"));

            // Check permit structure
            Map<String, Object> permit = (Map<String, Object>) payloadData.get("permit");
            assertNotNull(permit);
            Map<String, Object> permitted = (Map<String, Object>) permit.get("permitted");
            assertEquals(SAMPLE_TOKEN, permitted.get("token"));
            assertEquals("1000000", permitted.get("amount"));
            assertNotNull(permit.get("nonce"));
            assertNotNull(permit.get("deadline"));

            // Check transferDetails
            Map<String, Object> td = (Map<String, Object>) payloadData.get("transferDetails");
            assertNotNull(td);
            assertEquals(SAMPLE_ADDRESS_2, td.get("to"));
            assertEquals("1000000", td.get("requestedAmount"));
        }

        @Test
        @DisplayName("should fail for non-EVM network")
        void testNonEvmNetwork() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", "solana:mainnet");
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);
            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail for missing payTo")
        void testMissingPayTo() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("maxAmountRequired", "1000000");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);
            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail for missing amount")
        void testMissingAmount() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);
            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should generate unique nonces")
        @SuppressWarnings("unchecked")
        void testUniqueNonces() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SAMPLE_TOKEN);

            Map<String, Object> result1 = scheme.createPaymentPayloadSync(requirements);
            Map<String, Object> result2 = scheme.createPaymentPayloadSync(requirements);

            Map<String, Object> payload1 = (Map<String, Object>) result1.get("payload");
            Map<String, Object> permit1 = (Map<String, Object>) payload1.get("permit");

            Map<String, Object> payload2 = (Map<String, Object>) result2.get("payload");
            Map<String, Object> permit2 = (Map<String, Object>) payload2.get("permit");

            assertNotEquals(permit1.get("nonce"), permit2.get("nonce"));
        }
    }

    // =========================================================================
    // Permit2EvmFacilitatorScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2EvmFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockPermit2FacilitatorSigner mockSigner;
        private Permit2EvmFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockPermit2FacilitatorSigner(List.of(SAMPLE_ADDRESS_2));
            scheme = new Permit2EvmFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new Permit2EvmFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get addresses")
        void testGetAddresses() {
            List<String> addresses = scheme.getAddresses();
            assertEquals(1, addresses.size());
            assertEquals(SAMPLE_ADDRESS_2, addresses.get(0));
        }

        @Test
        @DisplayName("should get extra with permit2Address")
        void testGetExtra() {
            Map<String, Object> extra = scheme.getExtra();
            assertEquals(Permit2Constants.PERMIT2_ADDRESS, extra.get("permit2Address"));
        }

        @Test
        @DisplayName("should reject unsupported scheme")
        void testVerifyUnsupportedScheme() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "exact");

            Permit2EvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, createValidRequirements());

            assertFalse(result.isValid);
            assertEquals("invalid_scheme", result.invalidReason);
        }

        @Test
        @DisplayName("should reject network mismatch")
        void testVerifyNetworkMismatch() {
            Map<String, Object> payload = createValidPayload();
            payload.put("network", EvmConstants.ETHEREUM_MAINNET);

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("network", EvmConstants.BASE_MAINNET);

            Permit2EvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("network_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject non-EVM network")
        void testVerifyNonEvmNetwork() {
            Map<String, Object> payload = createValidPayload();
            payload.put("network", "solana:mainnet");

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("network", "solana:mainnet");

            Permit2EvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_network", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing payload data")
        void testVerifyMissingPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "permit2");
            payload.put("network", EvmConstants.BASE_MAINNET);

            Permit2EvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, createValidRequirements());

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000");

            Permit2EvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("insufficient_permitted_amount", result.invalidReason);
        }

        @Test
        @DisplayName("should reject recipient mismatch")
        void testVerifyRecipientMismatch() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo", "0xWrongRecipientAddress000000000000000000");

            Permit2EvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("recipient_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject token mismatch")
        void testVerifyTokenMismatch() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("asset", "0xDifferentToken00000000000000000000000000");

            Permit2EvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("token_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient balance")
        void testVerifyInsufficientBalance() {
            mockSigner.setBalance("500000"); // Less than required 1000000

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            Permit2EvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("insufficient_balance", result.invalidReason);
        }

        @Test
        @DisplayName("should verify valid payment")
        void testVerifyValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            Permit2EvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
            assertEquals(EvmConstants.BASE_MAINNET, result.network);
            assertNotNull(result.payload);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            Permit2EvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertEquals(Permit2EvmFacilitatorScheme.SettlementStatus.SUCCESS, result.status);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should return pending when confirmation fails")
        void testSettlePending() {
            mockSigner.setConfirmResult(false);

            Permit2EvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(createValidPayload(), createValidRequirements());

            assertFalse(result.success);
            assertEquals(Permit2EvmFacilitatorScheme.SettlementStatus.PENDING, result.status);
            assertNotNull(result.transaction);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "exact");

            Permit2EvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, createValidRequirements());

            assertFalse(result.success);
            assertEquals(Permit2EvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("invalid_scheme", result.errorReason);
        }

        @Test
        @DisplayName("should handle transaction send failure")
        void testSettleTransactionFailure() {
            mockSigner.setSendShouldFail(true);

            Permit2EvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(createValidPayload(), createValidRequirements());

            assertFalse(result.success);
            assertEquals(Permit2EvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("transaction_failed", result.errorReason);
        }

        // Helper methods

        private Map<String, Object> createValidPayload() {
            Map<String, Object> permitted = new HashMap<>();
            permitted.put("token", SAMPLE_TOKEN);
            permitted.put("amount", "1000000");

            Map<String, Object> permit = new HashMap<>();
            permit.put("permitted", permitted);
            permit.put("nonce", "12345");
            permit.put("deadline", String.valueOf(System.currentTimeMillis() / 1000 + 3600));

            Map<String, Object> transferDetails = new HashMap<>();
            transferDetails.put("to", SAMPLE_ADDRESS_2);
            transferDetails.put("requestedAmount", "1000000");

            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("permit", permit);
            payloadData.put("transferDetails", transferDetails);
            payloadData.put("signature", SAMPLE_SIGNATURE);
            payloadData.put("owner", SAMPLE_ADDRESS_1);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "permit2");
            payload.put("network", EvmConstants.BASE_MAINNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "permit2");
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SAMPLE_TOKEN);

            Map<String, Object> extra = new HashMap<>();
            extra.put("permit2Address", Permit2Constants.PERMIT2_ADDRESS);
            requirements.put("extra", extra);

            return requirements;
        }
    }

    // =========================================================================
    // Mock Implementations
    // =========================================================================

    static class MockPermit2Signer implements Permit2Signer {
        private final String address;

        MockPermit2Signer(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> signPermit2TypedData(
                Map<String, Object> domain,
                Map<String, Object> message,
                String network) {
            return CompletableFuture.completedFuture(SAMPLE_SIGNATURE);
        }
    }

    static class MockPermit2FacilitatorSigner implements Permit2FacilitatorSigner {
        private final List<String> addresses;
        private String balance = "10000000";
        private boolean confirmResult = true;
        private boolean sendShouldFail = false;
        private int sendCount = 0;

        MockPermit2FacilitatorSigner(List<String> addresses) {
            this.addresses = addresses;
        }

        void setBalance(String balance) {
            this.balance = balance;
        }

        void setConfirmResult(boolean result) {
            this.confirmResult = result;
        }

        void setSendShouldFail(boolean shouldFail) {
            this.sendShouldFail = shouldFail;
        }

        @Override
        public List<String> getAddresses() {
            return addresses;
        }

        @Override
        public CompletableFuture<String> sendPermitTransferFrom(
                Permit2Payload payload, String network) {
            if (sendShouldFail) {
                return CompletableFuture.failedFuture(
                    new RuntimeException("Transaction reverted"));
            }
            sendCount++;
            return CompletableFuture.completedFuture("0xTxHash" + sendCount);
        }

        @Override
        public CompletableFuture<Boolean> confirmTransaction(String txHash, String network) {
            return CompletableFuture.completedFuture(confirmResult);
        }

        @Override
        public CompletableFuture<String> getBalance(String address, String token, String network) {
            return CompletableFuture.completedFuture(balance);
        }
    }
}
