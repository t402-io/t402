package io.t402.schemes.evm.upto;

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
 * Tests for Up-To EVM scheme implementations.
 */
@DisplayName("Up-To EVM Schemes")
class UptoEvmSchemeTest {

    private static final String SAMPLE_OWNER = "0x1234567890123456789012345678901234567890";
    private static final String SAMPLE_SPENDER = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";
    private static final String SAMPLE_PAY_TO = "0xaBcDeFaBcDeFaBcDeFaBcDeFaBcDeFaBcDeFaBcD";
    private static final String SAMPLE_R = "0x" + "ab".repeat(32);
    private static final String SAMPLE_S = "0x" + "cd".repeat(32);
    private static final int SAMPLE_V = 28;
    private static final String SAMPLE_PAYMENT_NONCE = "0x" + "ff".repeat(32);

    // =========================================================================
    // ClientUptoEvmSigner Interface Tests
    // =========================================================================

    @Nested
    @DisplayName("ClientUptoEvmSigner")
    class ClientSignerTest {

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            MockClientUptoEvmSigner signer = new MockClientUptoEvmSigner(SAMPLE_OWNER);
            assertEquals(SAMPLE_OWNER, signer.getAddress());
        }

        @Test
        @DisplayName("should get nonce synchronously")
        void testGetNonceSync() {
            MockClientUptoEvmSigner signer = new MockClientUptoEvmSigner(SAMPLE_OWNER);
            signer.setNonce(5);

            int nonce = signer.getNonceSync("0xtoken", EvmConstants.BASE_MAINNET);
            assertEquals(5, nonce);
        }

        @Test
        @DisplayName("should sign permit synchronously")
        void testSignPermitSync() {
            MockClientUptoEvmSigner signer = new MockClientUptoEvmSigner(SAMPLE_OWNER);

            PermitAuthorization auth = PermitAuthorization.builder()
                .owner(SAMPLE_OWNER)
                .spender(SAMPLE_SPENDER)
                .value("1000000")
                .deadline("9999999999")
                .nonce(0)
                .build();

            PermitSignature sig = signer.signPermitSync(auth, EvmConstants.BASE_MAINNET);
            assertNotNull(sig);
            assertEquals(SAMPLE_V, sig.v);
            assertEquals(SAMPLE_R, sig.r);
            assertEquals(SAMPLE_S, sig.s);
        }
    }

    // =========================================================================
    // FacilitatorUptoEvmSigner Interface Tests
    // =========================================================================

    @Nested
    @DisplayName("FacilitatorUptoEvmSigner")
    class FacilitatorSignerTest {

        @Test
        @DisplayName("should get addresses")
        void testGetAddresses() {
            MockFacilitatorUptoEvmSigner signer =
                new MockFacilitatorUptoEvmSigner(List.of(SAMPLE_SPENDER));
            assertEquals(1, signer.getAddresses().size());
            assertEquals(SAMPLE_SPENDER, signer.getAddresses().get(0));
        }

        @Test
        @DisplayName("should recover permit signer synchronously")
        void testRecoverPermitSignerSync() {
            MockFacilitatorUptoEvmSigner signer =
                new MockFacilitatorUptoEvmSigner(List.of(SAMPLE_SPENDER));

            PermitAuthorization auth = PermitAuthorization.builder()
                .owner(SAMPLE_OWNER)
                .spender(SAMPLE_SPENDER)
                .value("1000000")
                .deadline("9999999999")
                .nonce(0)
                .build();
            PermitSignature sig = PermitSignature.of(SAMPLE_V, SAMPLE_R, SAMPLE_S);

            String recovered = signer.recoverPermitSignerSync(auth, sig, EvmConstants.BASE_MAINNET);
            assertEquals(SAMPLE_OWNER, recovered);
        }

        @Test
        @DisplayName("should confirm transaction synchronously")
        void testConfirmTransactionSync() {
            MockFacilitatorUptoEvmSigner signer =
                new MockFacilitatorUptoEvmSigner(List.of(SAMPLE_SPENDER));

            assertTrue(signer.confirmTransactionSync("0xTxHash1", EvmConstants.BASE_MAINNET));
        }

        @Test
        @DisplayName("should get balance synchronously")
        void testGetBalanceSync() {
            MockFacilitatorUptoEvmSigner signer =
                new MockFacilitatorUptoEvmSigner(List.of(SAMPLE_SPENDER));

            String balance = signer.getBalanceSync(SAMPLE_OWNER, "0xtoken", EvmConstants.BASE_MAINNET);
            assertEquals("10000000", balance);
        }

        @Test
        @DisplayName("should get allowance synchronously")
        void testGetAllowanceSync() {
            MockFacilitatorUptoEvmSigner signer =
                new MockFacilitatorUptoEvmSigner(List.of(SAMPLE_SPENDER));

            String allowance = signer.getAllowanceSync(SAMPLE_OWNER, "0xtoken", EvmConstants.BASE_MAINNET);
            assertEquals("0", allowance);
        }
    }

    // =========================================================================
    // UptoEvmServerScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("UptoEvmServerScheme")
    class ServerSchemeTest {

        private UptoEvmServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new UptoEvmServerScheme(EvmConstants.BASE_MAINNET);
        }

        @Test
        @DisplayName("should create with default network")
        void testDefaultNetwork() {
            UptoEvmServerScheme defaultScheme = new UptoEvmServerScheme();
            assertEquals(EvmConstants.ETHEREUM_MAINNET, defaultScheme.getDefaultNetwork());
        }

        @Test
        @DisplayName("should reject non-EVM network")
        void testRejectNonEvmNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                new UptoEvmServerScheme("solana:mainnet"));
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", EvmConstants.BASE_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertEquals(EvmConstants.USDC_ADDRESSES.get(EvmConstants.BASE_MAINNET), result.get("asset"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDC", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("1500000", EvmConstants.BASE_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should prefer USDT0 for networks that have it")
        void testParsePriceUsdt0Network() {
            Map<String, Object> result = scheme.parsePrice("1.00", EvmConstants.ETHEREUM_MAINNET);

            assertEquals("1000000", result.get("amount"));
            assertEquals(EvmConstants.USDT0_ADDRESSES.get(EvmConstants.ETHEREUM_MAINNET), result.get("asset"));
            assertEquals("USDT0", result.get("symbol"));
        }

        @Test
        @DisplayName("should throw for non-EVM network in parsePrice")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "solana:mainnet"));
        }

        @Test
        @DisplayName("should create payment requirements with upto scheme")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", SAMPLE_PAY_TO, "API Access");

            assertEquals(2, requirements.get("t402Version"));
            assertEquals("upto", requirements.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_PAY_TO, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertNotNull(requirements.get("asset"));
            assertEquals(EvmConstants.DEFAULT_VALIDITY_DURATION, requirements.get("maxTimeoutSeconds"));
            assertEquals("API Access", requirements.get("resource"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertNotNull(extra);
            assertNotNull(extra.get("name"));
            assertNotNull(extra.get("version"));
            assertEquals(8453L, extra.get("chainId"));
        }

        @Test
        @DisplayName("should create requirements with network override")
        void testGetPaymentRequirementsNetworkOverride() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "2.00", EvmConstants.ETHEREUM_MAINNET, SAMPLE_PAY_TO, "Premium");

            assertEquals(EvmConstants.ETHEREUM_MAINNET, requirements.get("network"));
            assertEquals("2000000", requirements.get("maxAmountRequired"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals(1L, extra.get("chainId"));
        }

        @Test
        @DisplayName("should include router address in extra")
        void testGetPaymentRequirementsWithRouter() {
            scheme.withRouterAddress(SAMPLE_SPENDER);
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.00", SAMPLE_PAY_TO, "API Access");

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals(SAMPLE_SPENDER, extra.get("routerAddress"));
        }

        @Test
        @DisplayName("should include billing unit info in extra")
        void testGetPaymentRequirementsWithBilling() {
            scheme.withUnit("token").withUnitPrice("100");
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.00", SAMPLE_PAY_TO, "API Access");

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals("token", extra.get("unit"));
            assertEquals("100", extra.get("unitPrice"));
        }

        @Test
        @DisplayName("should create requirements with explicit spender address")
        void testGetPaymentRequirementsWithSpender() {
            Map<String, Object> requirements = scheme.getPaymentRequirementsWithSpender(
                "1.00", SAMPLE_PAY_TO, SAMPLE_SPENDER, "API Access");

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals(SAMPLE_SPENDER, extra.get("routerAddress"));
        }

        @Test
        @DisplayName("should create requirements with full parameters")
        void testCreatePaymentRequirements() {
            String customToken = "0xCustomToken1234567890123456789012345678";
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                EvmConstants.BASE_MAINNET,
                SAMPLE_PAY_TO,
                "5000000",
                customToken,
                SAMPLE_SPENDER,
                600
            );

            assertEquals("upto", requirements.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_PAY_TO, requirements.get("payTo"));
            assertEquals("5000000", requirements.get("maxAmountRequired"));
            assertEquals(customToken, requirements.get("asset"));
            assertEquals(600, requirements.get("maxTimeoutSeconds"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals(SAMPLE_SPENDER, extra.get("routerAddress"));
        }

        @Test
        @DisplayName("should validate correct requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "upto");
            valid.put("network", EvmConstants.BASE_MAINNET);
            valid.put("payTo", SAMPLE_PAY_TO);

            assertTrue(scheme.validateRequirements(valid));
        }

        @Test
        @DisplayName("should reject invalid requirements")
        void testValidateInvalidRequirements() {
            // Null
            assertFalse(scheme.validateRequirements(null));

            // Wrong scheme
            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "exact");
            wrongScheme.put("network", EvmConstants.BASE_MAINNET);
            wrongScheme.put("payTo", SAMPLE_PAY_TO);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-EVM network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "upto");
            wrongNetwork.put("network", "solana:mainnet");
            wrongNetwork.put("payTo", SAMPLE_PAY_TO);
            assertFalse(scheme.validateRequirements(wrongNetwork));

            // Missing payTo
            Map<String, Object> noPayTo = new HashMap<>();
            noPayTo.put("scheme", "upto");
            noPayTo.put("network", EvmConstants.BASE_MAINNET);
            assertFalse(scheme.validateRequirements(noPayTo));
        }

        @Test
        @DisplayName("should support method chaining")
        void testMethodChaining() {
            UptoEvmServerScheme chainedScheme = new UptoEvmServerScheme(EvmConstants.BASE_MAINNET)
                .withRouterAddress(SAMPLE_SPENDER)
                .withUnit("request")
                .withUnitPrice("50000");

            Map<String, Object> requirements = chainedScheme.getPaymentRequirements(
                "1.00", SAMPLE_PAY_TO, "Test");

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals(SAMPLE_SPENDER, extra.get("routerAddress"));
            assertEquals("request", extra.get("unit"));
            assertEquals("50000", extra.get("unitPrice"));
        }
    }

    // =========================================================================
    // UptoEvmClientScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("UptoEvmClientScheme")
    class ClientSchemeTest {

        private MockClientUptoEvmSigner mockSigner;
        private UptoEvmClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientUptoEvmSigner(SAMPLE_OWNER);
            scheme = new UptoEvmClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SAMPLE_OWNER, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new UptoEvmClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_PAY_TO);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", EvmConstants.USDC_ADDRESSES.get(EvmConstants.BASE_MAINNET));
            requirements.put("maxTimeoutSeconds", 300);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("upto", result.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, result.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            assertNotNull(payloadData);

            // Check signature structure (v, r, s object)
            @SuppressWarnings("unchecked")
            Map<String, Object> sigMap = (Map<String, Object>) payloadData.get("signature");
            assertNotNull(sigMap);
            assertEquals(SAMPLE_V, sigMap.get("v"));
            assertTrue(((String) sigMap.get("r")).startsWith("0x"));
            assertTrue(((String) sigMap.get("s")).startsWith("0x"));

            // Check authorization structure
            @SuppressWarnings("unchecked")
            Map<String, Object> authMap = (Map<String, Object>) payloadData.get("authorization");
            assertNotNull(authMap);
            assertEquals(SAMPLE_OWNER, authMap.get("owner"));
            assertEquals(SAMPLE_PAY_TO, authMap.get("spender")); // spender defaults to payTo
            assertEquals("1000000", authMap.get("value"));
            assertNotNull(authMap.get("deadline"));
            assertEquals(0, authMap.get("nonce")); // Mock returns 0

            // Check payment nonce
            String paymentNonce = (String) payloadData.get("paymentNonce");
            assertNotNull(paymentNonce);
            assertTrue(paymentNonce.startsWith("0x"));
            assertEquals(66, paymentNonce.length()); // 0x + 64 hex chars = 32 bytes
        }

        @Test
        @DisplayName("should use router address as spender when provided")
        void testCreatePayloadWithRouterAddress() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_PAY_TO);
            requirements.put("maxAmountRequired", "1000000");

            Map<String, Object> extra = new HashMap<>();
            extra.put("routerAddress", SAMPLE_SPENDER);
            requirements.put("extra", extra);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> authMap = (Map<String, Object>) payloadData.get("authorization");
            assertEquals(SAMPLE_SPENDER, authMap.get("spender"));
        }

        @Test
        @DisplayName("should create payload with default version")
        void testCreatePayloadDefaultVersion() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("payTo", SAMPLE_PAY_TO);
            requirements.put("maxAmountRequired", "500000");

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
        }

        @Test
        @DisplayName("should fail for non-EVM network")
        void testNonEvmNetwork() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", "solana:mainnet");
            requirements.put("payTo", SAMPLE_PAY_TO);
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
            requirements.put("payTo", SAMPLE_PAY_TO);

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should set deadline based on maxTimeoutSeconds")
        void testDeadline() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_PAY_TO);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("maxTimeoutSeconds", 600);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> authMap = (Map<String, Object>) payloadData.get("authorization");

            long now = System.currentTimeMillis() / 1000;
            long deadline = Long.parseLong((String) authMap.get("deadline"));

            // deadline should be ~600 seconds in the future
            assertTrue(deadline > now);
            assertTrue(deadline <= now + 602);
        }

        @Test
        @DisplayName("should use permit nonce from signer")
        void testPermitNonce() {
            mockSigner.setNonce(7);

            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_PAY_TO);
            requirements.put("maxAmountRequired", "1000000");

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> authMap = (Map<String, Object>) payloadData.get("authorization");
            assertEquals(7, authMap.get("nonce"));
        }

        @Test
        @DisplayName("should generate unique payment nonces")
        void testUniquePaymentNonces() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_PAY_TO);
            requirements.put("maxAmountRequired", "1000000");

            Map<String, Object> result1 = scheme.createPaymentPayloadSync(requirements);
            Map<String, Object> result2 = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payload1 = (Map<String, Object>) result1.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> payload2 = (Map<String, Object>) result2.get("payload");

            assertNotEquals(payload1.get("paymentNonce"), payload2.get("paymentNonce"));
        }

        @Test
        @DisplayName("should use default network when not specified")
        void testDefaultNetwork() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("payTo", SAMPLE_PAY_TO);
            requirements.put("maxAmountRequired", "1000000");

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(EvmConstants.ETHEREUM_MAINNET, result.get("network"));
        }
    }

    // =========================================================================
    // UptoEvmFacilitatorScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("UptoEvmFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorUptoEvmSigner mockSigner;
        private UptoEvmFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorUptoEvmSigner(List.of(SAMPLE_SPENDER));
            scheme = new UptoEvmFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new UptoEvmFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get addresses")
        void testGetAddresses() {
            List<String> addresses = scheme.getAddresses();
            assertEquals(1, addresses.size());
            assertEquals(SAMPLE_SPENDER, addresses.get(0));
        }

        @Test
        @DisplayName("should get signers for network")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(EvmConstants.BASE_MAINNET);
            assertEquals(1, signers.size());
            assertEquals(SAMPLE_SPENDER, signers.get(0));
        }

        @Test
        @DisplayName("should reject unsupported scheme")
        void testVerifyUnsupportedScheme() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "exact");

            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("unsupported_scheme", result.invalidReason);
        }

        @Test
        @DisplayName("should reject network mismatch")
        void testVerifyNetworkMismatch() {
            Map<String, Object> payload = createValidPayload();
            payload.put("network", EvmConstants.ETHEREUM_MAINNET);

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("network", EvmConstants.BASE_MAINNET);

            UptoEvmFacilitatorScheme.VerificationResult result =
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

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_network", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing payload data")
        void testVerifyMissingPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "upto");
            payload.put("network", EvmConstants.BASE_MAINNET);

            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        @Test
        @DisplayName("should reject non-EIP2612 payload structure")
        void testVerifyInvalidPayloadStructure() {
            // Exact-style payload (string signature)
            Map<String, Object> innerPayload = new HashMap<>();
            innerPayload.put("signature", "0x1234");
            innerPayload.put("authorization", Map.of("from", "0x123"));

            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "upto");
            payload.put("network", EvmConstants.BASE_MAINNET);
            payload.put("payload", innerPayload);

            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than payload's 1000000

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("amount_insufficient", result.invalidReason);
        }

        @Test
        @DisplayName("should reject spender not matching facilitator address")
        void testVerifySpenderMismatch() {
            // Create payload with wrong spender
            Map<String, Object> payload = createPayloadWithSpender(
                "0xWrongSpenderAddress000000000000000000000");

            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("spender_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject expired permit")
        void testVerifyExpiredPermit() {
            long pastTime = System.currentTimeMillis() / 1000 - 1000;
            Map<String, Object> payload = createPayloadWithDeadline(String.valueOf(pastTime));
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("expired", result.invalidReason);
        }

        @Test
        @DisplayName("should reject signer mismatch")
        void testVerifySignerMismatch() {
            mockSigner.setRecoveredAddress("0xDifferentAddress0000000000000000000000");

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("signer_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should verify valid payment")
        void testVerifyValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertNull(result.error);
            assertEquals(SAMPLE_OWNER, result.payer);
            assertEquals(EvmConstants.BASE_MAINNET, result.network);
            assertNotNull(result.payload);
        }

        @Test
        @DisplayName("should verify with case-insensitive address comparison")
        void testVerifyCaseInsensitive() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // Set mock to return matching address in different case
            mockSigner.setRecoveredAddress(SAMPLE_OWNER.toUpperCase().replace("X", "x"));

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
        }

        @Test
        @DisplayName("should reject missing owner in authorization")
        void testVerifyMissingOwner() {
            Map<String, Object> payload = createPayloadWithField("owner", null);
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("missing_owner", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing spender in authorization")
        void testVerifyMissingSpender() {
            Map<String, Object> payload = createPayloadWithField("spender", null);
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("missing_spender", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing value in authorization")
        void testVerifyMissingValue() {
            Map<String, Object> payload = createPayloadWithField("value", null);
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("missing_value", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing deadline in authorization")
        void testVerifyMissingDeadline() {
            Map<String, Object> payload = createPayloadWithField("deadline", null);
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("missing_deadline", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing maxAmountRequired in requirements")
        void testVerifyMissingMaxAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.remove("maxAmountRequired");

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("missing_amount", result.invalidReason);
        }

        @Test
        @DisplayName("should handle signature verification error")
        void testVerifySignatureError() {
            mockSigner.setRecoverShouldFail(true);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("signature_verification_error", result.invalidReason);
        }

        @Test
        @DisplayName("should settle valid payment with full amount")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertEquals(UptoEvmFacilitatorScheme.SettlementStatus.SUCCESS, result.status);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_OWNER, result.payer);
            assertEquals("1000000", result.settledAmount);
        }

        @Test
        @DisplayName("should settle with partial amount")
        void testSettlePartialAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            UptoEvmSettlement settlement = UptoEvmSettlement.of("500000"); // Half

            UptoEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements, settlement);

            assertTrue(result.success);
            assertEquals("500000", result.settledAmount);
        }

        @Test
        @DisplayName("should reject settle amount exceeding permit")
        void testSettleExceedsPermit() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            UptoEvmSettlement settlement = UptoEvmSettlement.of("2000000"); // More than 1000000

            UptoEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements, settlement);

            assertFalse(result.success);
            assertEquals(UptoEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("settle_amount_exceeds_permit", result.errorReason);
        }

        @Test
        @DisplayName("should reject zero settle amount")
        void testSettleZeroAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            UptoEvmSettlement settlement = UptoEvmSettlement.of("0");

            UptoEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements, settlement);

            assertFalse(result.success);
            assertEquals(UptoEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("invalid_settle_amount", result.errorReason);
        }

        @Test
        @DisplayName("should return pending when confirmation fails")
        void testSettlePending() {
            mockSigner.setConfirmResult(false);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals(UptoEvmFacilitatorScheme.SettlementStatus.PENDING, result.status);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_OWNER, result.payer);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "exact"); // Wrong scheme

            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals(UptoEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("unsupported_scheme", result.errorReason);
        }

        @Test
        @DisplayName("should handle transaction send failure")
        void testSettleTransactionFailure() {
            mockSigner.setSendShouldFail(true);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals(UptoEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("transaction_failed", result.errorReason);
        }

        @Test
        @DisplayName("should settle with usage details")
        void testSettleWithUsageDetails() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            UptoEvmSettlement settlement = UptoEvmSettlement.of("750000")
                .withUsageDetails(UptoEvmUsageDetails.of(15, "50000", "request"));

            UptoEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements, settlement);

            assertTrue(result.success);
            assertEquals("750000", result.settledAmount);
        }

        @Test
        @DisplayName("should reject settlement with missing payTo in requirements")
        void testSettleMissingPayTo() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.remove("payTo");

            UptoEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals("missing_pay_to", result.errorReason);
        }

        @Test
        @DisplayName("should accept amount equal to required")
        void testVerifyExactAmount() {
            Map<String, Object> payload = createValidPayload(); // value = 1000000
            Map<String, Object> requirements = createValidRequirements(); // maxAmountRequired = 1000000

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
        }

        @Test
        @DisplayName("should accept amount greater than required")
        void testVerifyExcessAmount() {
            Map<String, Object> payload = createPayloadWithValue("5000000"); // 5 USDT
            Map<String, Object> requirements = createValidRequirements(); // 1 USDT

            UptoEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
        }

        @Test
        @DisplayName("should support multiple facilitator addresses")
        void testMultipleFacilitatorAddresses() {
            String secondAddress = "0x9876543210987654321098765432109876543210";
            MockFacilitatorUptoEvmSigner multiSigner =
                new MockFacilitatorUptoEvmSigner(List.of(SAMPLE_SPENDER, secondAddress));
            UptoEvmFacilitatorScheme multiScheme = new UptoEvmFacilitatorScheme(multiSigner);

            // Use the second facilitator address as spender
            Map<String, Object> payload = createPayloadWithSpender(secondAddress);
            Map<String, Object> requirements = createValidRequirements();

            UptoEvmFacilitatorScheme.VerificationResult result =
                multiScheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
        }

        // Helper methods

        private Map<String, Object> createValidPayload() {
            long futureDeadline = System.currentTimeMillis() / 1000 + 300;
            return createPayloadWithDetails(
                SAMPLE_OWNER, SAMPLE_SPENDER, "1000000", String.valueOf(futureDeadline), 0);
        }

        private Map<String, Object> createPayloadWithSpender(String spender) {
            long futureDeadline = System.currentTimeMillis() / 1000 + 300;
            return createPayloadWithDetails(
                SAMPLE_OWNER, spender, "1000000", String.valueOf(futureDeadline), 0);
        }

        private Map<String, Object> createPayloadWithDeadline(String deadline) {
            return createPayloadWithDetails(
                SAMPLE_OWNER, SAMPLE_SPENDER, "1000000", deadline, 0);
        }

        private Map<String, Object> createPayloadWithValue(String value) {
            long futureDeadline = System.currentTimeMillis() / 1000 + 300;
            return createPayloadWithDetails(
                SAMPLE_OWNER, SAMPLE_SPENDER, value, String.valueOf(futureDeadline), 0);
        }

        private Map<String, Object> createPayloadWithField(String field, String value) {
            long futureDeadline = System.currentTimeMillis() / 1000 + 300;
            Map<String, Object> auth = new HashMap<>();
            auth.put("owner", SAMPLE_OWNER);
            auth.put("spender", SAMPLE_SPENDER);
            auth.put("value", "1000000");
            auth.put("deadline", String.valueOf(futureDeadline));
            auth.put("nonce", 0);

            // Override the specified field
            if (value == null) {
                auth.remove(field);
            } else {
                auth.put(field, value);
            }

            Map<String, Object> sig = new HashMap<>();
            sig.put("v", SAMPLE_V);
            sig.put("r", SAMPLE_R);
            sig.put("s", SAMPLE_S);

            Map<String, Object> innerPayload = new HashMap<>();
            innerPayload.put("signature", sig);
            innerPayload.put("authorization", auth);
            innerPayload.put("paymentNonce", SAMPLE_PAYMENT_NONCE);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "upto");
            payload.put("network", EvmConstants.BASE_MAINNET);
            payload.put("payload", innerPayload);

            return payload;
        }

        private Map<String, Object> createPayloadWithDetails(
                String owner, String spender, String value, String deadline, int nonce) {

            Map<String, Object> auth = new HashMap<>();
            auth.put("owner", owner);
            auth.put("spender", spender);
            auth.put("value", value);
            auth.put("deadline", deadline);
            auth.put("nonce", nonce);

            Map<String, Object> sig = new HashMap<>();
            sig.put("v", SAMPLE_V);
            sig.put("r", SAMPLE_R);
            sig.put("s", SAMPLE_S);

            Map<String, Object> innerPayload = new HashMap<>();
            innerPayload.put("signature", sig);
            innerPayload.put("authorization", auth);
            innerPayload.put("paymentNonce", SAMPLE_PAYMENT_NONCE);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "upto");
            payload.put("network", EvmConstants.BASE_MAINNET);
            payload.put("payload", innerPayload);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "upto");
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_PAY_TO);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", EvmConstants.USDC_ADDRESSES.get(EvmConstants.BASE_MAINNET));
            requirements.put("maxTimeoutSeconds", 300);
            return requirements;
        }
    }

    // =========================================================================
    // Mock Implementations
    // =========================================================================

    static class MockClientUptoEvmSigner implements ClientUptoEvmSigner {
        private final String address;
        private int nonce = 0;

        MockClientUptoEvmSigner(String address) {
            this.address = address;
        }

        void setNonce(int nonce) {
            this.nonce = nonce;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<Integer> getNonce(String tokenAddress, String network) {
            return CompletableFuture.completedFuture(nonce);
        }

        @Override
        public CompletableFuture<PermitSignature> signPermit(
                PermitAuthorization authorization, String network) {
            return CompletableFuture.completedFuture(
                PermitSignature.of(SAMPLE_V, SAMPLE_R, SAMPLE_S));
        }
    }

    static class MockFacilitatorUptoEvmSigner implements FacilitatorUptoEvmSigner {
        private final List<String> addresses;
        private String recoveredAddress = SAMPLE_OWNER;
        private boolean confirmResult = true;
        private boolean sendShouldFail = false;
        private boolean recoverShouldFail = false;
        private int sendCount = 0;

        MockFacilitatorUptoEvmSigner(List<String> addresses) {
            this.addresses = addresses;
        }

        void setRecoveredAddress(String address) {
            this.recoveredAddress = address;
        }

        void setConfirmResult(boolean result) {
            this.confirmResult = result;
        }

        void setSendShouldFail(boolean shouldFail) {
            this.sendShouldFail = shouldFail;
        }

        void setRecoverShouldFail(boolean shouldFail) {
            this.recoverShouldFail = shouldFail;
        }

        @Override
        public List<String> getAddresses() {
            return addresses;
        }

        @Override
        public CompletableFuture<String> recoverPermitSigner(
                PermitAuthorization authorization,
                PermitSignature signature,
                String network) {
            if (recoverShouldFail) {
                return CompletableFuture.failedFuture(
                    new RuntimeException("Signature recovery failed"));
            }
            return CompletableFuture.completedFuture(recoveredAddress);
        }

        @Override
        public CompletableFuture<String> sendPermitAndTransferFrom(
                PermitAuthorization authorization,
                PermitSignature signature,
                String payTo,
                String settleAmount,
                String network) {
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
            return CompletableFuture.completedFuture("10000000");
        }

        @Override
        public CompletableFuture<String> getAllowance(String owner, String token, String network) {
            return CompletableFuture.completedFuture("0");
        }
    }
}
