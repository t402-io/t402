package io.t402.schemes.evm.exact_legacy;

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
 * Tests for Exact-Legacy EVM scheme implementations.
 */
@DisplayName("Exact-Legacy EVM Schemes")
class ExactLegacyEvmSchemeTest {

    private static final String SAMPLE_ADDRESS_1 = "0x1234567890123456789012345678901234567890";
    private static final String SAMPLE_ADDRESS_2 = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";
    private static final String FACILITATOR_ADDRESS = "0xFacilitator0000000000000000000000000000001";
    private static final String SAMPLE_SIGNATURE = "0x" + "ab".repeat(32) + "cd".repeat(32) + "1b";
    private static final String SAMPLE_NONCE = "0x" + "ff".repeat(32);

    // =========================================================================
    // LegacyEvmAuthorization Tests
    // =========================================================================

    @Nested
    @DisplayName("LegacyEvmAuthorization")
    class AuthorizationTest {

        @Test
        @DisplayName("should build authorization with all fields including spender")
        void testBuildAuthorization() {
            LegacyEvmAuthorization auth = LegacyEvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .value("1000000")
                .nonce(SAMPLE_NONCE)
                .validAfter(100)
                .validBefore(9999999)
                .spender(FACILITATOR_ADDRESS)
                .build();

            assertEquals(SAMPLE_ADDRESS_1, auth.getFrom());
            assertEquals(SAMPLE_ADDRESS_2, auth.getTo());
            assertEquals("1000000", auth.getValue());
            assertEquals(SAMPLE_NONCE, auth.getNonce());
            assertEquals(100, auth.getValidAfter());
            assertEquals(9999999, auth.getValidBefore());
            assertEquals(FACILITATOR_ADDRESS, auth.getSpender());
        }

        @Test
        @DisplayName("should throw when spender is missing")
        void testMissingSpender() {
            assertThrows(IllegalArgumentException.class, () ->
                LegacyEvmAuthorization.builder()
                    .from(SAMPLE_ADDRESS_1)
                    .to(SAMPLE_ADDRESS_2)
                    .value("1000000")
                    .nonce(SAMPLE_NONCE)
                    .validAfter(100)
                    .validBefore(9999999)
                    .build());
        }

        @Test
        @DisplayName("should throw when from is missing")
        void testMissingFrom() {
            assertThrows(IllegalArgumentException.class, () ->
                LegacyEvmAuthorization.builder()
                    .to(SAMPLE_ADDRESS_2)
                    .value("1000000")
                    .nonce(SAMPLE_NONCE)
                    .spender(FACILITATOR_ADDRESS)
                    .build());
        }

        @Test
        @DisplayName("should throw when to is missing")
        void testMissingTo() {
            assertThrows(IllegalArgumentException.class, () ->
                LegacyEvmAuthorization.builder()
                    .from(SAMPLE_ADDRESS_1)
                    .value("1000000")
                    .nonce(SAMPLE_NONCE)
                    .spender(FACILITATOR_ADDRESS)
                    .build());
        }

        @Test
        @DisplayName("should throw when value is missing")
        void testMissingValue() {
            assertThrows(IllegalArgumentException.class, () ->
                LegacyEvmAuthorization.builder()
                    .from(SAMPLE_ADDRESS_1)
                    .to(SAMPLE_ADDRESS_2)
                    .nonce(SAMPLE_NONCE)
                    .spender(FACILITATOR_ADDRESS)
                    .build());
        }

        @Test
        @DisplayName("should throw when nonce is missing")
        void testMissingNonce() {
            assertThrows(IllegalArgumentException.class, () ->
                LegacyEvmAuthorization.builder()
                    .from(SAMPLE_ADDRESS_1)
                    .to(SAMPLE_ADDRESS_2)
                    .value("1000000")
                    .spender(FACILITATOR_ADDRESS)
                    .build());
        }

        @Test
        @DisplayName("should set default validBefore when not provided")
        void testDefaultValidBefore() {
            LegacyEvmAuthorization auth = LegacyEvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .value("1000000")
                .nonce(SAMPLE_NONCE)
                .spender(FACILITATOR_ADDRESS)
                .build();

            long now = System.currentTimeMillis() / 1000;
            assertTrue(auth.getValidBefore() > now);
            assertTrue(auth.getValidBefore() <= now + EvmConstants.DEFAULT_VALIDITY_DURATION + 1);
        }

        @Test
        @DisplayName("should convert to signing payload including spender")
        void testToSigningPayload() {
            LegacyEvmAuthorization auth = createSampleAuthorization();

            Map<String, Object> payload = auth.toSigningPayload();

            assertEquals(SAMPLE_ADDRESS_1, payload.get("from"));
            assertEquals(SAMPLE_ADDRESS_2, payload.get("to"));
            assertEquals("1000000", payload.get("value"));
            assertEquals("100", payload.get("validAfter"));
            assertEquals("9999999", payload.get("validBefore"));
            assertEquals(SAMPLE_NONCE, payload.get("nonce"));
            assertEquals(FACILITATOR_ADDRESS, payload.get("spender"));
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapSerialization() {
            LegacyEvmAuthorization original = createSampleAuthorization();

            Map<String, Object> map = original.toMap();
            LegacyEvmAuthorization restored = LegacyEvmAuthorization.fromMap(map);

            assertEquals(original.getFrom(), restored.getFrom());
            assertEquals(original.getTo(), restored.getTo());
            assertEquals(original.getValue(), restored.getValue());
            assertEquals(original.getNonce(), restored.getNonce());
            assertEquals(original.getValidAfter(), restored.getValidAfter());
            assertEquals(original.getValidBefore(), restored.getValidBefore());
            assertEquals(original.getSpender(), restored.getSpender());
        }
    }

    // =========================================================================
    // ExactLegacyEvmPayload Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactLegacyEvmPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build payload with signature and authorization")
        void testBuildPayload() {
            LegacyEvmAuthorization auth = createSampleAuthorization();
            ExactLegacyEvmPayload payload = ExactLegacyEvmPayload.builder()
                .signature(SAMPLE_SIGNATURE)
                .authorization(auth)
                .build();

            assertEquals(SAMPLE_SIGNATURE, payload.getSignature());
            assertEquals(auth.getFrom(), payload.getAuthorization().getFrom());
            assertEquals(auth.getSpender(), payload.getAuthorization().getSpender());
        }

        @Test
        @DisplayName("should throw when signature is missing")
        void testMissingSignature() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactLegacyEvmPayload.builder()
                    .authorization(createSampleAuthorization())
                    .build());
        }

        @Test
        @DisplayName("should throw when authorization is missing")
        void testMissingAuthorization() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactLegacyEvmPayload.builder()
                    .signature(SAMPLE_SIGNATURE)
                    .build());
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapSerialization() {
            LegacyEvmAuthorization auth = createSampleAuthorization();
            ExactLegacyEvmPayload original = ExactLegacyEvmPayload.builder()
                .signature(SAMPLE_SIGNATURE)
                .authorization(auth)
                .build();

            Map<String, Object> map = original.toMap();
            ExactLegacyEvmPayload restored = ExactLegacyEvmPayload.fromMap(map);

            assertEquals(original.getSignature(), restored.getSignature());
            assertEquals(original.getAuthorization().getFrom(), restored.getAuthorization().getFrom());
            assertEquals(original.getAuthorization().getTo(), restored.getAuthorization().getTo());
            assertEquals(original.getAuthorization().getValue(), restored.getAuthorization().getValue());
            assertEquals(original.getAuthorization().getSpender(), restored.getAuthorization().getSpender());
        }
    }

    // =========================================================================
    // ExactLegacyEvmServerScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactLegacyEvmServerScheme")
    class ServerSchemeTest {

        private ExactLegacyEvmServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactLegacyEvmServerScheme(EvmConstants.ETHEREUM_MAINNET, FACILITATOR_ADDRESS);
        }

        @Test
        @DisplayName("should have correct scheme identifier")
        void testSchemeIdentifier() {
            assertEquals("exact-legacy", ExactLegacyEvmServerScheme.SCHEME);
        }

        @Test
        @DisplayName("should create with default network")
        void testDefaultNetwork() {
            ExactLegacyEvmServerScheme defaultScheme = new ExactLegacyEvmServerScheme(FACILITATOR_ADDRESS);
            assertEquals(EvmConstants.ETHEREUM_MAINNET, defaultScheme.getDefaultNetwork());
        }

        @Test
        @DisplayName("should reject non-EVM network")
        void testRejectNonEvmNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactLegacyEvmServerScheme("solana:mainnet", FACILITATOR_ADDRESS));
        }

        @Test
        @DisplayName("should reject null facilitator address")
        void testRejectNullFacilitator() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactLegacyEvmServerScheme(EvmConstants.ETHEREUM_MAINNET, null));
        }

        @Test
        @DisplayName("should reject empty facilitator address")
        void testRejectEmptyFacilitator() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactLegacyEvmServerScheme(EvmConstants.ETHEREUM_MAINNET, ""));
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", EvmConstants.ETHEREUM_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertEquals(EvmConstants.USDT0_ADDRESSES.get(EvmConstants.ETHEREUM_MAINNET), result.get("asset"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDT0", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("1500000", EvmConstants.ETHEREUM_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should throw for non-EVM network in parsePrice")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "solana:mainnet"));
        }

        @Test
        @DisplayName("should create payment requirements with legacy extra fields")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", SAMPLE_ADDRESS_2, "API Access");

            assertEquals(2, requirements.get("t402Version"));
            assertEquals("exact-legacy", requirements.get("scheme"));
            assertEquals(EvmConstants.ETHEREUM_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertNotNull(requirements.get("asset"));
            assertEquals(EvmConstants.DEFAULT_VALIDITY_DURATION, requirements.get("maxTimeoutSeconds"));
            assertEquals("API Access", requirements.get("resource"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertNotNull(extra);
            assertEquals(FACILITATOR_ADDRESS, extra.get("spender"));
            assertEquals("legacy", extra.get("tokenType"));
            assertEquals("T402LegacyTransfer", extra.get("name"));
            assertEquals("1", extra.get("version"));
            assertEquals(1L, extra.get("chainId"));
        }

        @Test
        @DisplayName("should create requirements with network override")
        void testGetPaymentRequirementsNetworkOverride() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "2.00", EvmConstants.BASE_MAINNET, SAMPLE_ADDRESS_2, "Premium");

            assertEquals(EvmConstants.BASE_MAINNET, requirements.get("network"));
            assertEquals("2000000", requirements.get("maxAmountRequired"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals(8453L, extra.get("chainId"));
        }

        @Test
        @DisplayName("should create requirements with full parameters")
        void testCreatePaymentRequirements() {
            String customToken = "0xCustomToken1234567890123456789012345678";
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                EvmConstants.ETHEREUM_MAINNET,
                SAMPLE_ADDRESS_2,
                "5000000",
                customToken,
                600
            );

            assertEquals("exact-legacy", requirements.get("scheme"));
            assertEquals(EvmConstants.ETHEREUM_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("5000000", requirements.get("maxAmountRequired"));
            assertEquals(customToken, requirements.get("asset"));
            assertEquals(600, requirements.get("maxTimeoutSeconds"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals(FACILITATOR_ADDRESS, extra.get("spender"));
            assertEquals("legacy", extra.get("tokenType"));
        }

        @Test
        @DisplayName("should validate correct requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact-legacy");
            valid.put("network", EvmConstants.ETHEREUM_MAINNET);
            valid.put("payTo", SAMPLE_ADDRESS_2);
            valid.put("extra", Map.of("spender", FACILITATOR_ADDRESS));

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
            wrongScheme.put("network", EvmConstants.ETHEREUM_MAINNET);
            wrongScheme.put("payTo", SAMPLE_ADDRESS_2);
            wrongScheme.put("extra", Map.of("spender", FACILITATOR_ADDRESS));
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-EVM network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact-legacy");
            wrongNetwork.put("network", "solana:mainnet");
            wrongNetwork.put("payTo", SAMPLE_ADDRESS_2);
            wrongNetwork.put("extra", Map.of("spender", FACILITATOR_ADDRESS));
            assertFalse(scheme.validateRequirements(wrongNetwork));

            // Missing payTo
            Map<String, Object> noPayTo = new HashMap<>();
            noPayTo.put("scheme", "exact-legacy");
            noPayTo.put("network", EvmConstants.ETHEREUM_MAINNET);
            noPayTo.put("extra", Map.of("spender", FACILITATOR_ADDRESS));
            assertFalse(scheme.validateRequirements(noPayTo));

            // Missing spender in extra
            Map<String, Object> noSpender = new HashMap<>();
            noSpender.put("scheme", "exact-legacy");
            noSpender.put("network", EvmConstants.ETHEREUM_MAINNET);
            noSpender.put("payTo", SAMPLE_ADDRESS_2);
            noSpender.put("extra", Map.of("tokenType", "legacy"));
            assertFalse(scheme.validateRequirements(noSpender));

            // Missing extra entirely
            Map<String, Object> noExtra = new HashMap<>();
            noExtra.put("scheme", "exact-legacy");
            noExtra.put("network", EvmConstants.ETHEREUM_MAINNET);
            noExtra.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(noExtra));
        }
    }

    // =========================================================================
    // ExactLegacyEvmClientScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactLegacyEvmClientScheme")
    class ClientSchemeTest {

        private MockClientLegacyEvmSigner mockSigner;
        private ExactLegacyEvmClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientLegacyEvmSigner(SAMPLE_ADDRESS_1);
            scheme = new ExactLegacyEvmClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should have correct scheme identifier")
        void testSchemeIdentifier() {
            assertEquals("exact-legacy", ExactLegacyEvmClientScheme.SCHEME);
        }

        @Test
        @DisplayName("should have correct primary type")
        void testPrimaryType() {
            assertEquals("LegacyTransferAuthorization", ExactLegacyEvmClientScheme.PRIMARY_TYPE);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SAMPLE_ADDRESS_1, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactLegacyEvmClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload with spender")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("maxTimeoutSeconds", 300);
            requirements.put("extra", Map.of(
                "spender", FACILITATOR_ADDRESS,
                "name", "T402LegacyTransfer",
                "version", "1"
            ));

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("exact-legacy", result.get("scheme"));
            assertEquals(EvmConstants.ETHEREUM_MAINNET, result.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            assertNotNull(payloadData);
            assertNotNull(payloadData.get("signature"));
            assertTrue(((String) payloadData.get("signature")).startsWith("0x"));

            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");
            assertNotNull(auth);
            assertEquals(SAMPLE_ADDRESS_1, auth.get("from"));
            assertEquals(SAMPLE_ADDRESS_2, auth.get("to"));
            assertEquals("1000000", auth.get("value"));
            assertEquals(FACILITATOR_ADDRESS, auth.get("spender"));
            assertNotNull(auth.get("nonce"));
            assertTrue(((String) auth.get("nonce")).startsWith("0x"));
            assertEquals(66, ((String) auth.get("nonce")).length()); // 0x + 64 hex chars
        }

        @Test
        @DisplayName("should fail when spender is missing from extra")
        void testMissingSpender() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("extra", Map.of("name", "T402LegacyTransfer"));

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail when extra is not provided")
        void testMissingExtra() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");

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
            requirements.put("extra", Map.of("spender", FACILITATOR_ADDRESS));

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail for missing payTo")
        void testMissingPayTo() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("extra", Map.of("spender", FACILITATOR_ADDRESS));

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail for missing amount")
        void testMissingAmount() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("extra", Map.of("spender", FACILITATOR_ADDRESS));

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should set valid time window")
        void testTimeWindow() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("maxTimeoutSeconds", 600);
            requirements.put("extra", Map.of("spender", FACILITATOR_ADDRESS));

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");

            long now = System.currentTimeMillis() / 1000;
            long validAfter = ((Number) auth.get("validAfter")).longValue();
            long validBefore = ((Number) auth.get("validBefore")).longValue();

            // validAfter should be ~1 minute in the past
            assertTrue(validAfter <= now);
            assertTrue(validAfter >= now - EvmConstants.CLOCK_SKEW_TOLERANCE - 2);

            // validBefore should be ~600 seconds in the future
            assertTrue(validBefore > now);
            assertTrue(validBefore <= now + 602);
        }

        @Test
        @DisplayName("should generate unique nonces")
        void testUniqueNonces() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("extra", Map.of("spender", FACILITATOR_ADDRESS));

            Map<String, Object> result1 = scheme.createPaymentPayloadSync(requirements);
            Map<String, Object> result2 = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payload1 = (Map<String, Object>) result1.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> auth1 = (Map<String, Object>) payload1.get("authorization");

            @SuppressWarnings("unchecked")
            Map<String, Object> payload2 = (Map<String, Object>) result2.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> auth2 = (Map<String, Object>) payload2.get("authorization");

            assertNotEquals(auth1.get("nonce"), auth2.get("nonce"));
        }
    }

    // =========================================================================
    // ExactLegacyEvmFacilitatorScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactLegacyEvmFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorLegacyEvmSigner mockSigner;
        private ExactLegacyEvmFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorLegacyEvmSigner(List.of(FACILITATOR_ADDRESS));
            scheme = new ExactLegacyEvmFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should have correct scheme identifier")
        void testSchemeIdentifier() {
            assertEquals("exact-legacy", ExactLegacyEvmFacilitatorScheme.SCHEME);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactLegacyEvmFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should reject invalid minAllowanceRatio")
        void testInvalidRatio() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactLegacyEvmFacilitatorScheme(mockSigner, 1.5));
            assertThrows(IllegalArgumentException.class, () ->
                new ExactLegacyEvmFacilitatorScheme(mockSigner, -0.1));
        }

        @Test
        @DisplayName("should get addresses")
        void testGetAddresses() {
            List<String> addresses = scheme.getAddresses();
            assertEquals(1, addresses.size());
            assertEquals(FACILITATOR_ADDRESS, addresses.get(0));
        }

        @Test
        @DisplayName("should get signers for network")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(EvmConstants.ETHEREUM_MAINNET);
            assertEquals(1, signers.size());
            assertEquals(FACILITATOR_ADDRESS, signers.get(0));
        }

        @Test
        @DisplayName("should get default minAllowanceRatio")
        void testDefaultMinAllowanceRatio() {
            assertEquals(1.0, scheme.getMinAllowanceRatio());
        }

        @Test
        @DisplayName("should accept custom minAllowanceRatio")
        void testCustomMinAllowanceRatio() {
            ExactLegacyEvmFacilitatorScheme customScheme =
                new ExactLegacyEvmFacilitatorScheme(mockSigner, 0.8);
            assertEquals(0.8, customScheme.getMinAllowanceRatio());
        }

        @Test
        @DisplayName("should reject unsupported scheme")
        void testVerifyUnsupportedScheme() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "exact");

            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
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

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
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

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_network", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing payload data")
        void testVerifyMissingPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "exact-legacy");
            payload.put("network", EvmConstants.ETHEREUM_MAINNET);

            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        @Test
        @DisplayName("should reject invalid spender")
        void testVerifyInvalidSpender() {
            Map<String, Object> payload = createPayloadWithSpender("0xWrongSpender00000000000000000000000000");

            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_spender", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000");

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("amount_insufficient", result.invalidReason);
        }

        @Test
        @DisplayName("should reject recipient mismatch")
        void testVerifyRecipientMismatch() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo", "0xWrongRecipientAddress000000000000000000");

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("recipient_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject expired payment")
        void testVerifyExpiredPayment() {
            long pastTime = System.currentTimeMillis() / 1000 - 1000;
            Map<String, Object> payload = createPayloadWithTimes(0, pastTime);
            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("expired", result.invalidReason);
        }

        @Test
        @DisplayName("should reject not-yet-valid payment")
        void testVerifyNotYetValid() {
            long futureTime = System.currentTimeMillis() / 1000 + 10000;
            Map<String, Object> payload = createPayloadWithTimes(futureTime, futureTime + 1000);
            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("not_yet_valid", result.invalidReason);
        }

        @Test
        @DisplayName("should reject signer mismatch")
        void testVerifySignerMismatch() {
            mockSigner.setRecoveredAddress("0xDifferentAddress0000000000000000000000");

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("signer_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient balance")
        void testVerifyInsufficientBalance() {
            mockSigner.setBalance("500000"); // Less than required 1000000

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("insufficient_balance", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient allowance")
        void testVerifyInsufficientAllowance() {
            mockSigner.setAllowance("500000"); // Less than required 1000000

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("insufficient_allowance", result.invalidReason);
        }

        @Test
        @DisplayName("should verify valid payment")
        void testVerifyValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertNull(result.error);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
            assertEquals(EvmConstants.ETHEREUM_MAINNET, result.network);
            assertNotNull(result.payload);
        }

        @Test
        @DisplayName("should verify with case-insensitive address comparison")
        void testVerifyCaseInsensitive() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo", SAMPLE_ADDRESS_2.toLowerCase());

            mockSigner.setRecoveredAddress(SAMPLE_ADDRESS_1.toUpperCase().replace("X", "x"));

            ExactLegacyEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertEquals(ExactLegacyEvmFacilitatorScheme.SettlementStatus.SUCCESS, result.status);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should return pending when confirmation fails")
        void testSettlePending() {
            mockSigner.setConfirmResult(false);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals(ExactLegacyEvmFacilitatorScheme.SettlementStatus.PENDING, result.status);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "exact");

            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals(ExactLegacyEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("unsupported_scheme", result.errorReason);
        }

        @Test
        @DisplayName("should handle transaction send failure")
        void testSettleTransactionFailure() {
            mockSigner.setSendShouldFail(true);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactLegacyEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals(ExactLegacyEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("transaction_failed", result.errorReason);
        }

        // Helper methods

        private Map<String, Object> createValidPayload() {
            long now = System.currentTimeMillis() / 1000;
            return createPayloadWithTimes(now - 60, now + 300);
        }

        private Map<String, Object> createPayloadWithTimes(long validAfter, long validBefore) {
            return createPayloadWithTimesAndSpender(validAfter, validBefore, FACILITATOR_ADDRESS);
        }

        private Map<String, Object> createPayloadWithSpender(String spender) {
            long now = System.currentTimeMillis() / 1000;
            return createPayloadWithTimesAndSpender(now - 60, now + 300, spender);
        }

        private Map<String, Object> createPayloadWithTimesAndSpender(
                long validAfter, long validBefore, String spender) {
            Map<String, Object> auth = new HashMap<>();
            auth.put("from", SAMPLE_ADDRESS_1);
            auth.put("to", SAMPLE_ADDRESS_2);
            auth.put("value", "1000000");
            auth.put("nonce", SAMPLE_NONCE);
            auth.put("validAfter", validAfter);
            auth.put("validBefore", validBefore);
            auth.put("spender", spender);

            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("signature", SAMPLE_SIGNATURE);
            payloadData.put("authorization", auth);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact-legacy");
            payload.put("network", EvmConstants.ETHEREUM_MAINNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact-legacy");
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", EvmConstants.USDT0_ADDRESSES.get(EvmConstants.ETHEREUM_MAINNET));
            requirements.put("maxTimeoutSeconds", 300);
            requirements.put("extra", Map.of(
                "spender", FACILITATOR_ADDRESS,
                "tokenType", "legacy",
                "name", "T402LegacyTransfer",
                "version", "1"
            ));
            return requirements;
        }
    }

    // =========================================================================
    // Mock Implementations
    // =========================================================================

    static class MockClientLegacyEvmSigner implements ClientLegacyEvmSigner {
        private final String address;

        MockClientLegacyEvmSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> signLegacyPayment(
                LegacyEvmAuthorization authorization, String network) {
            return CompletableFuture.completedFuture(SAMPLE_SIGNATURE);
        }
    }

    static class MockFacilitatorLegacyEvmSigner implements FacilitatorLegacyEvmSigner {
        private final List<String> addresses;
        private String recoveredAddress = SAMPLE_ADDRESS_1;
        private boolean confirmResult = true;
        private boolean sendShouldFail = false;
        private int sendCount = 0;
        private String balance = "10000000";
        private String allowance = "10000000";

        MockFacilitatorLegacyEvmSigner(List<String> addresses) {
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

        void setBalance(String balance) {
            this.balance = balance;
        }

        void setAllowance(String allowance) {
            this.allowance = allowance;
        }

        @Override
        public List<String> getAddresses() {
            return addresses;
        }

        @Override
        public CompletableFuture<String> recoverLegacySigner(
                LegacyEvmAuthorization authorization, String signature, String network) {
            return CompletableFuture.completedFuture(recoveredAddress);
        }

        @Override
        public CompletableFuture<String> sendTransferFrom(
                LegacyEvmAuthorization authorization, String network) {
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

        @Override
        public CompletableFuture<String> getAllowance(
                String owner, String spender, String token, String network) {
            return CompletableFuture.completedFuture(allowance);
        }
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    private static LegacyEvmAuthorization createSampleAuthorization() {
        return LegacyEvmAuthorization.builder()
            .from(SAMPLE_ADDRESS_1)
            .to(SAMPLE_ADDRESS_2)
            .value("1000000")
            .nonce(SAMPLE_NONCE)
            .validAfter(100)
            .validBefore(9999999)
            .spender(FACILITATOR_ADDRESS)
            .build();
    }
}
