package io.t402.schemes.evm.permit2proxy;

import io.t402.schemes.evm.EvmConstants;
import io.t402.schemes.evm.permit2.Permit2Constants;

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
 * Tests for Permit2 Proxy EVM scheme implementations.
 */
@DisplayName("Permit2 Proxy EVM Schemes")
class Permit2ProxyEvmSchemeTest {

    private static final String SAMPLE_ADDRESS_1 = "0x1234567890123456789012345678901234567890";
    private static final String SAMPLE_ADDRESS_2 = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";
    private static final String SAMPLE_FACILITATOR = "0xFacilitator0000000000000000000000000000ab";
    private static final String SAMPLE_SIGNATURE = "0x" + "ab".repeat(32) + "cd".repeat(32) + "1b";
    private static final String SAMPLE_TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    // =========================================================================
    // Permit2ProxyConstants Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2ProxyConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should have correct scheme identifier")
        void testSchemeIdentifier() {
            assertEquals("permit2-proxy", Permit2ProxyConstants.SCHEME_PERMIT2_PROXY);
        }

        @Test
        @DisplayName("should have correct Permit2 address")
        void testPermit2Address() {
            assertEquals(Permit2Constants.PERMIT2_ADDRESS, Permit2ProxyConstants.PERMIT2_ADDRESS);
        }

        @Test
        @DisplayName("should have proxy addresses")
        void testProxyAddresses() {
            assertNotNull(Permit2ProxyConstants.EXACT_PROXY_ADDRESS);
            assertNotNull(Permit2ProxyConstants.UPTO_PROXY_ADDRESS);
        }

        @Test
        @DisplayName("should have witness type definitions")
        void testWitnessTypes() {
            assertNotNull(Permit2ProxyConstants.WITNESS_TYPEHASH);
            assertNotNull(Permit2ProxyConstants.WITNESS_TYPE_STRING);
            assertTrue(Permit2ProxyConstants.WITNESS_TYPE_STRING.contains("Witness"));
            assertTrue(Permit2ProxyConstants.WITNESS_TYPE_STRING.contains("facilitator"));
            assertTrue(Permit2ProxyConstants.WITNESS_TYPE_STRING.contains("validAfter"));
        }
    }

    // =========================================================================
    // Permit2ProxyPayload Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2ProxyPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build payload with all fields")
        void testBuildPayload() {
            Permit2ProxyPayload payload = createSamplePayload();

            assertEquals(SAMPLE_TOKEN, payload.getToken());
            assertEquals("1000000", payload.getAmount());
            assertEquals("12345", payload.getNonce());
            assertEquals("1700000000", payload.getDeadline());
            assertEquals(SAMPLE_ADDRESS_2, payload.getWitnessTo());
            assertEquals(SAMPLE_FACILITATOR, payload.getWitnessFacilitator());
            assertEquals("1699999970", payload.getWitnessValidAfter());
            assertEquals(SAMPLE_SIGNATURE, payload.getSignature());
            assertEquals(SAMPLE_ADDRESS_1, payload.getOwner());
        }

        @Test
        @DisplayName("should throw when witness facilitator is missing")
        void testMissingWitnessFacilitator() {
            assertThrows(IllegalArgumentException.class, () ->
                Permit2ProxyPayload.builder()
                    .token(SAMPLE_TOKEN)
                    .amount("1000000")
                    .nonce("12345")
                    .deadline("1700000000")
                    .witnessTo(SAMPLE_ADDRESS_2)
                    // missing witnessFacilitator
                    .witnessValidAfter("1699999970")
                    .signature(SAMPLE_SIGNATURE)
                    .owner(SAMPLE_ADDRESS_1)
                    .build());
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapSerialization() {
            Permit2ProxyPayload original = createSamplePayload();

            Map<String, Object> map = original.toMap();
            Permit2ProxyPayload restored = Permit2ProxyPayload.fromMap(map);

            assertEquals(original.getToken(), restored.getToken());
            assertEquals(original.getAmount(), restored.getAmount());
            assertEquals(original.getNonce(), restored.getNonce());
            assertEquals(original.getDeadline(), restored.getDeadline());
            assertEquals(original.getWitnessTo(), restored.getWitnessTo());
            assertEquals(original.getWitnessFacilitator(), restored.getWitnessFacilitator());
            assertEquals(original.getWitnessValidAfter(), restored.getWitnessValidAfter());
            assertEquals(original.getSignature(), restored.getSignature());
            assertEquals(original.getOwner(), restored.getOwner());
        }

        @Test
        @DisplayName("should have correct map structure")
        @SuppressWarnings("unchecked")
        void testMapStructure() {
            Permit2ProxyPayload payload = createSamplePayload();
            Map<String, Object> map = payload.toMap();

            assertTrue(map.containsKey("permit"));
            assertTrue(map.containsKey("witness"));
            assertTrue(map.containsKey("signature"));
            assertTrue(map.containsKey("owner"));

            // Check permit structure
            Map<String, Object> permit = (Map<String, Object>) map.get("permit");
            Map<String, Object> permitted = (Map<String, Object>) permit.get("permitted");
            assertEquals(SAMPLE_TOKEN, permitted.get("token"));
            assertEquals("1000000", permitted.get("amount"));

            // Check witness structure
            Map<String, Object> witness = (Map<String, Object>) map.get("witness");
            assertEquals(SAMPLE_ADDRESS_2, witness.get("to"));
            assertEquals(SAMPLE_FACILITATOR, witness.get("facilitator"));
            assertEquals("1699999970", witness.get("validAfter"));
        }

        private Permit2ProxyPayload createSamplePayload() {
            return Permit2ProxyPayload.builder()
                .token(SAMPLE_TOKEN)
                .amount("1000000")
                .nonce("12345")
                .deadline("1700000000")
                .witnessTo(SAMPLE_ADDRESS_2)
                .witnessFacilitator(SAMPLE_FACILITATOR)
                .witnessValidAfter("1699999970")
                .signature(SAMPLE_SIGNATURE)
                .owner(SAMPLE_ADDRESS_1)
                .build();
        }
    }

    // =========================================================================
    // Permit2ProxyEvmServerScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2ProxyEvmServerScheme")
    class ServerSchemeTest {

        private Permit2ProxyEvmServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new Permit2ProxyEvmServerScheme(EvmConstants.BASE_MAINNET);
        }

        @Test
        @DisplayName("should create with default network")
        void testDefaultNetwork() {
            Permit2ProxyEvmServerScheme defaultScheme = new Permit2ProxyEvmServerScheme();
            assertEquals(EvmConstants.ETHEREUM_MAINNET, defaultScheme.getDefaultNetwork());
        }

        @Test
        @DisplayName("should reject non-EVM network")
        void testRejectNonEvmNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                new Permit2ProxyEvmServerScheme("solana:mainnet"));
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", EvmConstants.BASE_MAINNET);
            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should create payment requirements with proxy extra")
        @SuppressWarnings("unchecked")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", SAMPLE_ADDRESS_2, "API Access");

            assertEquals(2, requirements.get("t402Version"));
            assertEquals("permit2-proxy", requirements.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertEquals("API Access", requirements.get("resource"));

            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertNotNull(extra);
            assertEquals(Permit2Constants.PERMIT2_ADDRESS, extra.get("permit2Address"));
            assertEquals(Permit2ProxyConstants.EXACT_PROXY_ADDRESS, extra.get("exactProxyAddress"));
            assertEquals(Permit2ProxyConstants.UPTO_PROXY_ADDRESS, extra.get("uptoProxyAddress"));
        }

        @Test
        @DisplayName("should validate correct requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "permit2-proxy");
            valid.put("network", EvmConstants.BASE_MAINNET);
            valid.put("payTo", SAMPLE_ADDRESS_2);

            assertTrue(scheme.validateRequirements(valid));
        }

        @Test
        @DisplayName("should reject invalid requirements")
        void testValidateInvalidRequirements() {
            assertFalse(scheme.validateRequirements(null));

            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "permit2");
            wrongScheme.put("network", EvmConstants.BASE_MAINNET);
            wrongScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongScheme));
        }
    }

    // =========================================================================
    // Permit2ProxyEvmClientScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2ProxyEvmClientScheme")
    class ClientSchemeTest {

        private MockPermit2ProxySigner mockSigner;
        private Permit2ProxyEvmClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockPermit2ProxySigner(SAMPLE_ADDRESS_1);
            scheme = new Permit2ProxyEvmClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SAMPLE_ADDRESS_1, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new Permit2ProxyEvmClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload with witness")
        @SuppressWarnings("unchecked")
        void testCreatePaymentPayload() {
            Map<String, Object> extra = new HashMap<>();
            extra.put("facilitator", SAMPLE_FACILITATOR);

            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SAMPLE_TOKEN);
            requirements.put("extra", extra);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("permit2-proxy", result.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, result.get("network"));

            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            assertNotNull(payloadData);
            assertEquals(SAMPLE_ADDRESS_1, payloadData.get("owner"));
            assertNotNull(payloadData.get("signature"));

            // Check witness
            Map<String, Object> witness = (Map<String, Object>) payloadData.get("witness");
            assertNotNull(witness);
            assertEquals(SAMPLE_ADDRESS_2, witness.get("to"));
            assertEquals(SAMPLE_FACILITATOR, witness.get("facilitator"));
            assertNotNull(witness.get("validAfter"));
        }

        @Test
        @DisplayName("should fail when facilitator is missing")
        void testMissingFacilitator() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SAMPLE_TOKEN);

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);
            assertTrue(future.isCompletedExceptionally());
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
    }

    // =========================================================================
    // Permit2ProxyEvmFacilitatorScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("Permit2ProxyEvmFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockPermit2ProxyFacilitatorSigner mockSigner;
        private Permit2ProxyEvmFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockPermit2ProxyFacilitatorSigner(List.of(SAMPLE_FACILITATOR));
            scheme = new Permit2ProxyEvmFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new Permit2ProxyEvmFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get addresses")
        void testGetAddresses() {
            List<String> addresses = scheme.getAddresses();
            assertEquals(1, addresses.size());
            assertEquals(SAMPLE_FACILITATOR, addresses.get(0));
        }

        @Test
        @DisplayName("should get extra with proxy addresses")
        void testGetExtra() {
            Map<String, Object> extra = scheme.getExtra();
            assertEquals(Permit2Constants.PERMIT2_ADDRESS, extra.get("permit2Address"));
            assertEquals(Permit2ProxyConstants.EXACT_PROXY_ADDRESS, extra.get("exactProxyAddress"));
            assertEquals(Permit2ProxyConstants.UPTO_PROXY_ADDRESS, extra.get("uptoProxyAddress"));
        }

        @Test
        @DisplayName("should reject unsupported scheme")
        void testVerifyUnsupportedScheme() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "exact");

            Permit2ProxyEvmFacilitatorScheme.VerificationResult result =
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

            Permit2ProxyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("network_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing payload data")
        void testVerifyMissingPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "permit2-proxy");
            payload.put("network", EvmConstants.BASE_MAINNET);

            Permit2ProxyEvmFacilitatorScheme.VerificationResult result =
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

            Permit2ProxyEvmFacilitatorScheme.VerificationResult result =
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

            Permit2ProxyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("recipient_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject unauthorized facilitator")
        void testVerifyUnauthorizedFacilitator() {
            // Create payload with a different facilitator
            Map<String, Object> payload = createPayloadWithFacilitator(
                "0xUnauthorized000000000000000000000000000");
            Map<String, Object> requirements = createValidRequirements();

            Permit2ProxyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("unauthorized_facilitator", result.invalidReason);
        }

        @Test
        @DisplayName("should reject token mismatch")
        void testVerifyTokenMismatch() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("asset", "0xDifferentToken00000000000000000000000000");

            Permit2ProxyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("token_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient balance")
        void testVerifyInsufficientBalance() {
            mockSigner.setBalance("500000");

            Permit2ProxyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createValidPayload(), createValidRequirements());

            assertFalse(result.isValid);
            assertEquals("insufficient_balance", result.invalidReason);
        }

        @Test
        @DisplayName("should verify valid payment")
        void testVerifyValidPayment() {
            Permit2ProxyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(createValidPayload(), createValidRequirements());

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
            assertEquals(EvmConstants.BASE_MAINNET, result.network);
            assertNotNull(result.payload);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Permit2ProxyEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(createValidPayload(), createValidRequirements());

            assertTrue(result.success);
            assertEquals(Permit2ProxyEvmFacilitatorScheme.SettlementStatus.SUCCESS, result.status);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should return pending when confirmation fails")
        void testSettlePending() {
            mockSigner.setConfirmResult(false);

            Permit2ProxyEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(createValidPayload(), createValidRequirements());

            assertFalse(result.success);
            assertEquals(Permit2ProxyEvmFacilitatorScheme.SettlementStatus.PENDING, result.status);
            assertNotNull(result.transaction);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "exact");

            Permit2ProxyEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, createValidRequirements());

            assertFalse(result.success);
            assertEquals(Permit2ProxyEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("invalid_scheme", result.errorReason);
        }

        @Test
        @DisplayName("should handle transaction send failure")
        void testSettleTransactionFailure() {
            mockSigner.setSendShouldFail(true);

            Permit2ProxyEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(createValidPayload(), createValidRequirements());

            assertFalse(result.success);
            assertEquals(Permit2ProxyEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("transaction_failed", result.errorReason);
        }

        // Helper methods

        private Map<String, Object> createValidPayload() {
            return createPayloadWithFacilitator(SAMPLE_FACILITATOR);
        }

        private Map<String, Object> createPayloadWithFacilitator(String facilitator) {
            long now = System.currentTimeMillis() / 1000;

            Map<String, Object> permitted = new HashMap<>();
            permitted.put("token", SAMPLE_TOKEN);
            permitted.put("amount", "1000000");

            Map<String, Object> permit = new HashMap<>();
            permit.put("permitted", permitted);
            permit.put("nonce", "12345");
            permit.put("deadline", String.valueOf(now + 3600));

            Map<String, Object> witness = new HashMap<>();
            witness.put("to", SAMPLE_ADDRESS_2);
            witness.put("facilitator", facilitator);
            witness.put("validAfter", String.valueOf(now - 30));

            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("permit", permit);
            payloadData.put("witness", witness);
            payloadData.put("signature", SAMPLE_SIGNATURE);
            payloadData.put("owner", SAMPLE_ADDRESS_1);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "permit2-proxy");
            payload.put("network", EvmConstants.BASE_MAINNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> extra = new HashMap<>();
            extra.put("permit2Address", Permit2Constants.PERMIT2_ADDRESS);
            extra.put("exactProxyAddress", Permit2ProxyConstants.EXACT_PROXY_ADDRESS);
            extra.put("uptoProxyAddress", Permit2ProxyConstants.UPTO_PROXY_ADDRESS);
            extra.put("facilitator", SAMPLE_FACILITATOR);

            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "permit2-proxy");
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SAMPLE_TOKEN);
            requirements.put("extra", extra);

            return requirements;
        }
    }

    // =========================================================================
    // Mock Implementations
    // =========================================================================

    static class MockPermit2ProxySigner implements Permit2ProxySigner {
        private final String address;

        MockPermit2ProxySigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> signPermitWitnessTransferFrom(
                Map<String, Object> domain,
                Map<String, Object> message,
                String network) {
            return CompletableFuture.completedFuture(SAMPLE_SIGNATURE);
        }
    }

    static class MockPermit2ProxyFacilitatorSigner implements Permit2ProxyFacilitatorSigner {
        private final List<String> addresses;
        private String balance = "10000000";
        private boolean confirmResult = true;
        private boolean sendShouldFail = false;
        private int sendCount = 0;

        MockPermit2ProxyFacilitatorSigner(List<String> addresses) {
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
        public CompletableFuture<String> sendSettle(
                Permit2ProxyPayload payload, String proxyAddress, String network) {
            if (sendShouldFail) {
                return CompletableFuture.failedFuture(
                    new RuntimeException("Transaction reverted"));
            }
            sendCount++;
            return CompletableFuture.completedFuture("0xTxHash" + sendCount);
        }

        @Override
        public CompletableFuture<String> sendSettleUpto(
                Permit2ProxyPayload payload, String amount, String proxyAddress, String network) {
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
