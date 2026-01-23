package io.t402.schemes.evm.exact;

import io.t402.schemes.evm.*;

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
 * Tests for Exact EVM scheme implementations.
 */
@DisplayName("Exact EVM Schemes")
class ExactEvmSchemeTest {

    private static final String SAMPLE_ADDRESS_1 = "0x1234567890123456789012345678901234567890";
    private static final String SAMPLE_ADDRESS_2 = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";
    private static final String SAMPLE_SIGNATURE = "0x" + "ab".repeat(32) + "cd".repeat(32) + "1b";
    private static final String SAMPLE_NONCE = "0x" + "ff".repeat(32);

    // =========================================================================
    // EvmConstants Tests
    // =========================================================================

    @Nested
    @DisplayName("EvmConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should return USDT0 address for supported network")
        void testGetUsdt0Address() {
            assertEquals("0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
                EvmConstants.getUsdt0Address(EvmConstants.ETHEREUM_MAINNET));
            assertEquals("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
                EvmConstants.getUsdt0Address(EvmConstants.ARBITRUM_ONE));
        }

        @Test
        @DisplayName("should throw for unsupported USDT0 network")
        void testGetUsdt0AddressUnsupported() {
            assertThrows(IllegalArgumentException.class, () ->
                EvmConstants.getUsdt0Address("eip155:9999999"));
        }

        @Test
        @DisplayName("should return USDC address for supported network")
        void testGetUsdcAddress() {
            assertEquals("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                EvmConstants.getUsdcAddress(EvmConstants.BASE_MAINNET));
        }

        @Test
        @DisplayName("should throw for unsupported USDC network")
        void testGetUsdcAddressUnsupported() {
            assertThrows(IllegalArgumentException.class, () ->
                EvmConstants.getUsdcAddress("eip155:57073")); // Ink has USDT0, not USDC
        }

        @Test
        @DisplayName("should prefer USDT0 as default token")
        void testGetDefaultTokenAddress() {
            // Network with USDT0 should return USDT0
            assertEquals(EvmConstants.USDT0_ADDRESSES.get(EvmConstants.ETHEREUM_MAINNET),
                EvmConstants.getDefaultTokenAddress(EvmConstants.ETHEREUM_MAINNET));

            // Network with only USDC should return USDC
            assertEquals(EvmConstants.USDC_ADDRESSES.get(EvmConstants.BASE_MAINNET),
                EvmConstants.getDefaultTokenAddress(EvmConstants.BASE_MAINNET));
        }

        @Test
        @DisplayName("should extract chain ID from CAIP-2")
        void testGetChainId() {
            assertEquals(1L, EvmConstants.getChainId(EvmConstants.ETHEREUM_MAINNET));
            assertEquals(8453L, EvmConstants.getChainId(EvmConstants.BASE_MAINNET));
            assertEquals(42161L, EvmConstants.getChainId(EvmConstants.ARBITRUM_ONE));
            // Unknown but valid CAIP-2 format
            assertEquals(12345L, EvmConstants.getChainId("eip155:12345"));
        }

        @Test
        @DisplayName("should throw for invalid chain ID format")
        void testGetChainIdInvalid() {
            assertThrows(IllegalArgumentException.class, () ->
                EvmConstants.getChainId("eip155:abc"));
            assertThrows(IllegalArgumentException.class, () ->
                EvmConstants.getChainId("solana:mainnet"));
        }

        @Test
        @DisplayName("should identify EVM networks")
        void testIsEvmNetwork() {
            assertTrue(EvmConstants.isEvmNetwork("eip155:1"));
            assertTrue(EvmConstants.isEvmNetwork("eip155:8453"));
            assertFalse(EvmConstants.isEvmNetwork("solana:mainnet"));
            assertFalse(EvmConstants.isEvmNetwork("tron:mainnet"));
            assertFalse(EvmConstants.isEvmNetwork(null));
        }

        @Test
        @DisplayName("should get token name for known tokens")
        void testGetTokenName() {
            assertEquals("TetherToken", EvmConstants.getTokenName(
                EvmConstants.ETHEREUM_MAINNET, EvmConstants.USDT0_ADDRESSES.get(EvmConstants.ETHEREUM_MAINNET)));
            assertEquals("USD Coin", EvmConstants.getTokenName(
                EvmConstants.BASE_MAINNET, EvmConstants.USDC_ADDRESSES.get(EvmConstants.BASE_MAINNET)));
        }

        @Test
        @DisplayName("should get token version for known tokens")
        void testGetTokenVersion() {
            assertEquals("1", EvmConstants.getTokenVersion(
                EvmConstants.ETHEREUM_MAINNET, EvmConstants.USDT0_ADDRESSES.get(EvmConstants.ETHEREUM_MAINNET)));
            assertEquals("2", EvmConstants.getTokenVersion(
                EvmConstants.BASE_MAINNET, EvmConstants.USDC_ADDRESSES.get(EvmConstants.BASE_MAINNET)));
        }

        @Test
        @DisplayName("should identify supported networks")
        void testIsSupportedNetwork() {
            assertTrue(EvmConstants.isSupportedNetwork(EvmConstants.ETHEREUM_MAINNET));
            assertTrue(EvmConstants.isSupportedNetwork(EvmConstants.BASE_MAINNET));
            assertFalse(EvmConstants.isSupportedNetwork("eip155:999999"));
        }
    }

    // =========================================================================
    // EvmTypes Tests
    // =========================================================================

    @Nested
    @DisplayName("EvmTypes")
    class TypesTest {

        @Test
        @DisplayName("should have correct TransferWithAuthorization fields")
        void testTransferAuthFields() {
            assertEquals(6, EvmTypes.TRANSFER_WITH_AUTHORIZATION_FIELDS.size());

            var fieldNames = EvmTypes.TRANSFER_WITH_AUTHORIZATION_FIELDS.stream()
                .map(f -> f.name)
                .toList();
            assertTrue(fieldNames.contains("from"));
            assertTrue(fieldNames.contains("to"));
            assertTrue(fieldNames.contains("value"));
            assertTrue(fieldNames.contains("validAfter"));
            assertTrue(fieldNames.contains("validBefore"));
            assertTrue(fieldNames.contains("nonce"));
        }

        @Test
        @DisplayName("should have correct domain fields")
        void testDomainFields() {
            assertEquals(4, EvmTypes.DOMAIN_TYPE_FIELDS.size());

            var fieldNames = EvmTypes.DOMAIN_TYPE_FIELDS.stream()
                .map(f -> f.name)
                .toList();
            assertTrue(fieldNames.contains("name"));
            assertTrue(fieldNames.contains("version"));
            assertTrue(fieldNames.contains("chainId"));
            assertTrue(fieldNames.contains("verifyingContract"));
        }

        @Test
        @DisplayName("should create domain map")
        void testCreateDomain() {
            Map<String, Object> domain = EvmTypes.createDomain("TetherToken", "1", 8453L, "0xtoken");

            assertEquals("TetherToken", domain.get("name"));
            assertEquals("1", domain.get("version"));
            assertEquals(8453L, domain.get("chainId"));
            assertEquals("0xtoken", domain.get("verifyingContract"));
        }

        @Test
        @DisplayName("should create transfer auth message")
        void testCreateTransferAuthMessage() {
            EvmAuthorization auth = EvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .value("1000000")
                .nonce(SAMPLE_NONCE)
                .validAfter(100)
                .validBefore(9999999)
                .build();

            Map<String, Object> message = EvmTypes.createTransferAuthMessage(auth);

            assertEquals(SAMPLE_ADDRESS_1, message.get("from"));
            assertEquals(SAMPLE_ADDRESS_2, message.get("to"));
            assertEquals(new java.math.BigInteger("1000000"), message.get("value"));
            assertEquals(SAMPLE_NONCE, message.get("nonce"));
        }

        @Test
        @DisplayName("should identify valid TransferAuth payload")
        void testIsTransferAuthPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("signature", "0x1234");
            payload.put("authorization", Map.of(
                "from", "0x123",
                "to", "0x456",
                "value", "1000",
                "validAfter", 0,
                "validBefore", 999999,
                "nonce", "0xabc"
            ));

            assertTrue(EvmTypes.isTransferAuthPayload(payload));
        }

        @Test
        @DisplayName("should reject invalid payloads")
        void testIsTransferAuthPayloadInvalid() {
            assertFalse(EvmTypes.isTransferAuthPayload(null));
            assertFalse(EvmTypes.isTransferAuthPayload(new HashMap<>()));

            // Object signature instead of string (EIP-2612 style)
            Map<String, Object> objectSig = new HashMap<>();
            objectSig.put("signature", Map.of("v", 28, "r", "0x123", "s", "0x456"));
            objectSig.put("authorization", Map.of("from", "0x123"));
            assertFalse(EvmTypes.isTransferAuthPayload(objectSig));

            // Missing authorization fields
            Map<String, Object> incomplete = new HashMap<>();
            incomplete.put("signature", "0x123");
            incomplete.put("authorization", Map.of("from", "0x123"));
            assertFalse(EvmTypes.isTransferAuthPayload(incomplete));
        }

        @Test
        @DisplayName("should get transfer auth types map")
        void testGetTransferAuthTypes() {
            var types = EvmTypes.getTransferAuthTypes();

            assertTrue(types.containsKey("EIP712Domain"));
            assertTrue(types.containsKey("TransferWithAuthorization"));
            assertEquals(4, types.get("EIP712Domain").size());
            assertEquals(6, types.get("TransferWithAuthorization").size());
        }
    }

    // =========================================================================
    // EvmAuthorization Tests
    // =========================================================================

    @Nested
    @DisplayName("EvmAuthorization")
    class AuthorizationTest {

        @Test
        @DisplayName("should build authorization with all fields")
        void testBuildAuthorization() {
            EvmAuthorization auth = EvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .value("1000000")
                .nonce(SAMPLE_NONCE)
                .validAfter(100)
                .validBefore(9999999)
                .build();

            assertEquals(SAMPLE_ADDRESS_1, auth.getFrom());
            assertEquals(SAMPLE_ADDRESS_2, auth.getTo());
            assertEquals("1000000", auth.getValue());
            assertEquals(SAMPLE_NONCE, auth.getNonce());
            assertEquals(100, auth.getValidAfter());
            assertEquals(9999999, auth.getValidBefore());
        }

        @Test
        @DisplayName("should throw when from is missing")
        void testMissingFrom() {
            assertThrows(IllegalArgumentException.class, () ->
                EvmAuthorization.builder()
                    .to(SAMPLE_ADDRESS_2)
                    .value("1000000")
                    .nonce(SAMPLE_NONCE)
                    .build());
        }

        @Test
        @DisplayName("should throw when to is missing")
        void testMissingTo() {
            assertThrows(IllegalArgumentException.class, () ->
                EvmAuthorization.builder()
                    .from(SAMPLE_ADDRESS_1)
                    .value("1000000")
                    .nonce(SAMPLE_NONCE)
                    .build());
        }

        @Test
        @DisplayName("should throw when value is missing")
        void testMissingValue() {
            assertThrows(IllegalArgumentException.class, () ->
                EvmAuthorization.builder()
                    .from(SAMPLE_ADDRESS_1)
                    .to(SAMPLE_ADDRESS_2)
                    .nonce(SAMPLE_NONCE)
                    .build());
        }

        @Test
        @DisplayName("should throw when nonce is missing")
        void testMissingNonce() {
            assertThrows(IllegalArgumentException.class, () ->
                EvmAuthorization.builder()
                    .from(SAMPLE_ADDRESS_1)
                    .to(SAMPLE_ADDRESS_2)
                    .value("1000000")
                    .build());
        }

        @Test
        @DisplayName("should set default validBefore when not provided")
        void testDefaultValidBefore() {
            EvmAuthorization auth = EvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .value("1000000")
                .nonce(SAMPLE_NONCE)
                .build();

            long now = System.currentTimeMillis() / 1000;
            assertTrue(auth.getValidBefore() > now);
            assertTrue(auth.getValidBefore() <= now + EvmConstants.DEFAULT_VALIDITY_DURATION + 1);
        }

        @Test
        @DisplayName("should convert to signing payload")
        void testToSigningPayload() {
            EvmAuthorization auth = EvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .value("1000000")
                .nonce(SAMPLE_NONCE)
                .validAfter(100)
                .validBefore(9999999)
                .build();

            Map<String, Object> payload = auth.toSigningPayload();

            assertEquals(SAMPLE_ADDRESS_1, payload.get("from"));
            assertEquals(SAMPLE_ADDRESS_2, payload.get("to"));
            assertEquals("1000000", payload.get("value"));
            assertEquals("100", payload.get("validAfter"));
            assertEquals("9999999", payload.get("validBefore"));
            assertEquals(SAMPLE_NONCE, payload.get("nonce"));
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapSerialization() {
            EvmAuthorization original = EvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .value("1000000")
                .nonce(SAMPLE_NONCE)
                .validAfter(100)
                .validBefore(9999999)
                .build();

            Map<String, Object> map = original.toMap();
            EvmAuthorization restored = EvmAuthorization.fromMap(map);

            assertEquals(original.getFrom(), restored.getFrom());
            assertEquals(original.getTo(), restored.getTo());
            assertEquals(original.getValue(), restored.getValue());
            assertEquals(original.getNonce(), restored.getNonce());
            assertEquals(original.getValidAfter(), restored.getValidAfter());
            assertEquals(original.getValidBefore(), restored.getValidBefore());
        }
    }

    // =========================================================================
    // ExactEvmPayload Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactEvmPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build payload")
        void testBuildPayload() {
            EvmAuthorization auth = createSampleAuthorization();
            ExactEvmPayload payload = ExactEvmPayload.builder()
                .signature(SAMPLE_SIGNATURE)
                .authorization(auth)
                .build();

            assertEquals(SAMPLE_SIGNATURE, payload.getSignature());
            assertEquals(auth.getFrom(), payload.getAuthorization().getFrom());
        }

        @Test
        @DisplayName("should throw when signature is missing")
        void testMissingSignature() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactEvmPayload.builder()
                    .authorization(createSampleAuthorization())
                    .build());
        }

        @Test
        @DisplayName("should throw when authorization is missing")
        void testMissingAuthorization() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactEvmPayload.builder()
                    .signature(SAMPLE_SIGNATURE)
                    .build());
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapSerialization() {
            EvmAuthorization auth = createSampleAuthorization();
            ExactEvmPayload original = ExactEvmPayload.builder()
                .signature(SAMPLE_SIGNATURE)
                .authorization(auth)
                .build();

            Map<String, Object> map = original.toMap();
            ExactEvmPayload restored = ExactEvmPayload.fromMap(map);

            assertEquals(original.getSignature(), restored.getSignature());
            assertEquals(original.getAuthorization().getFrom(), restored.getAuthorization().getFrom());
            assertEquals(original.getAuthorization().getTo(), restored.getAuthorization().getTo());
            assertEquals(original.getAuthorization().getValue(), restored.getAuthorization().getValue());
        }
    }

    // =========================================================================
    // ExactEvmServerScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactEvmServerScheme")
    class ServerSchemeTest {

        private ExactEvmServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactEvmServerScheme(EvmConstants.BASE_MAINNET);
        }

        @Test
        @DisplayName("should create with default network")
        void testDefaultNetwork() {
            ExactEvmServerScheme defaultScheme = new ExactEvmServerScheme();
            assertEquals(EvmConstants.ETHEREUM_MAINNET, defaultScheme.getDefaultNetwork());
        }

        @Test
        @DisplayName("should reject non-EVM network")
        void testRejectNonEvmNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactEvmServerScheme("solana:mainnet"));
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
        @DisplayName("should create payment requirements with EIP-712 extra")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", SAMPLE_ADDRESS_2, "API Access");

            assertEquals(2, requirements.get("t402Version"));
            assertEquals("exact", requirements.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
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
                "2.00", EvmConstants.ETHEREUM_MAINNET, SAMPLE_ADDRESS_2, "Premium");

            assertEquals(EvmConstants.ETHEREUM_MAINNET, requirements.get("network"));
            assertEquals("2000000", requirements.get("maxAmountRequired"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertEquals(1L, extra.get("chainId"));
        }

        @Test
        @DisplayName("should create requirements with full parameters")
        void testCreatePaymentRequirements() {
            String customToken = "0xCustomToken1234567890123456789012345678";
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                EvmConstants.BASE_MAINNET,
                SAMPLE_ADDRESS_2,
                "5000000",
                customToken,
                600
            );

            assertEquals("exact", requirements.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("5000000", requirements.get("maxAmountRequired"));
            assertEquals(customToken, requirements.get("asset"));
            assertEquals(600, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should validate correct requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact");
            valid.put("network", EvmConstants.BASE_MAINNET);
            valid.put("payTo", SAMPLE_ADDRESS_2);

            assertTrue(scheme.validateRequirements(valid));
        }

        @Test
        @DisplayName("should reject invalid requirements")
        void testValidateInvalidRequirements() {
            // Null
            assertFalse(scheme.validateRequirements(null));

            // Wrong scheme
            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "upto");
            wrongScheme.put("network", EvmConstants.BASE_MAINNET);
            wrongScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-EVM network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact");
            wrongNetwork.put("network", "solana:mainnet");
            wrongNetwork.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongNetwork));

            // Missing payTo
            Map<String, Object> noPayTo = new HashMap<>();
            noPayTo.put("scheme", "exact");
            noPayTo.put("network", EvmConstants.BASE_MAINNET);
            assertFalse(scheme.validateRequirements(noPayTo));
        }
    }

    // =========================================================================
    // ExactEvmClientScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactEvmClientScheme")
    class ClientSchemeTest {

        private MockClientEvmSigner mockSigner;
        private ExactEvmClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientEvmSigner(SAMPLE_ADDRESS_1);
            scheme = new ExactEvmClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SAMPLE_ADDRESS_1, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactEvmClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", EvmConstants.USDC_ADDRESSES.get(EvmConstants.BASE_MAINNET));
            requirements.put("maxTimeoutSeconds", 300);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("exact", result.get("scheme"));
            assertEquals(EvmConstants.BASE_MAINNET, result.get("network"));

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
            assertNotNull(auth.get("nonce"));
            assertTrue(((String) auth.get("nonce")).startsWith("0x"));
            assertEquals(66, ((String) auth.get("nonce")).length()); // 0x + 64 hex chars = 32 bytes
        }

        @Test
        @DisplayName("should create payment payload with default version")
        void testCreatePayloadDefaultVersion() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.ETHEREUM_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "500000");

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
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
        @DisplayName("should set valid time window")
        void testTimeWindow() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("maxTimeoutSeconds", 600);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");

            long now = System.currentTimeMillis() / 1000;
            long validAfter = ((Number) auth.get("validAfter")).longValue();
            long validBefore = ((Number) auth.get("validBefore")).longValue();

            // validAfter should be ~1 minute in the past (clock skew tolerance)
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
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");

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
    // ExactEvmFacilitatorScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactEvmFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorEvmSigner mockSigner;
        private ExactEvmFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorEvmSigner(List.of(SAMPLE_ADDRESS_2));
            scheme = new ExactEvmFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactEvmFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get addresses")
        void testGetAddresses() {
            List<String> addresses = scheme.getAddresses();
            assertEquals(1, addresses.size());
            assertEquals(SAMPLE_ADDRESS_2, addresses.get(0));
        }

        @Test
        @DisplayName("should get signers for network")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(EvmConstants.BASE_MAINNET);
            assertEquals(1, signers.size());
            assertEquals(SAMPLE_ADDRESS_2, signers.get(0));
        }

        @Test
        @DisplayName("should reject unsupported scheme")
        void testVerifyUnsupportedScheme() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "upto");

            Map<String, Object> requirements = createValidRequirements();

            ExactEvmFacilitatorScheme.VerificationResult result =
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

            ExactEvmFacilitatorScheme.VerificationResult result =
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

            ExactEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_network", result.invalidReason);
        }

        @Test
        @DisplayName("should reject missing payload data")
        void testVerifyMissingPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "exact");
            payload.put("network", EvmConstants.BASE_MAINNET);
            // No "payload" key

            Map<String, Object> requirements = createValidRequirements();

            ExactEvmFacilitatorScheme.VerificationResult result =
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

            ExactEvmFacilitatorScheme.VerificationResult result =
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

            ExactEvmFacilitatorScheme.VerificationResult result =
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

            ExactEvmFacilitatorScheme.VerificationResult result =
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

            ExactEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("not_yet_valid", result.invalidReason);
        }

        @Test
        @DisplayName("should reject signer mismatch")
        void testVerifySignerMismatch() {
            // Mock signer returns a different address than "from"
            mockSigner.setRecoveredAddress("0xDifferentAddress0000000000000000000000");

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("signer_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should verify valid payment")
        void testVerifyValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertNull(result.error);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
            assertEquals(EvmConstants.BASE_MAINNET, result.network);
            assertNotNull(result.payload);
        }

        @Test
        @DisplayName("should verify with case-insensitive address comparison")
        void testVerifyCaseInsensitive() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            // Use different case for payTo
            requirements.put("payTo", SAMPLE_ADDRESS_2.toLowerCase());

            // Set mock to return matching address in different case
            mockSigner.setRecoveredAddress(SAMPLE_ADDRESS_1.toUpperCase().replace("X", "x"));

            ExactEvmFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertEquals(ExactEvmFacilitatorScheme.SettlementStatus.SUCCESS, result.status);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should return pending when confirmation fails")
        void testSettlePending() {
            mockSigner.setConfirmResult(false);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals(ExactEvmFacilitatorScheme.SettlementStatus.PENDING, result.status);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "upto"); // Wrong scheme

            Map<String, Object> requirements = createValidRequirements();

            ExactEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals(ExactEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("unsupported_scheme", result.errorReason);
        }

        @Test
        @DisplayName("should handle transaction send failure")
        void testSettleTransactionFailure() {
            mockSigner.setSendShouldFail(true);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactEvmFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals(ExactEvmFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertEquals("transaction_failed", result.errorReason);
        }

        // Helper methods

        private Map<String, Object> createValidPayload() {
            long now = System.currentTimeMillis() / 1000;
            return createPayloadWithTimes(now - 60, now + 300);
        }

        private Map<String, Object> createPayloadWithTimes(long validAfter, long validBefore) {
            Map<String, Object> auth = new HashMap<>();
            auth.put("from", SAMPLE_ADDRESS_1);
            auth.put("to", SAMPLE_ADDRESS_2);
            auth.put("value", "1000000");
            auth.put("nonce", SAMPLE_NONCE);
            auth.put("validAfter", validAfter);
            auth.put("validBefore", validBefore);

            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("signature", SAMPLE_SIGNATURE);
            payloadData.put("authorization", auth);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact");
            payload.put("network", EvmConstants.BASE_MAINNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact");
            requirements.put("network", EvmConstants.BASE_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", EvmConstants.USDC_ADDRESSES.get(EvmConstants.BASE_MAINNET));
            requirements.put("maxTimeoutSeconds", 300);
            return requirements;
        }
    }

    // =========================================================================
    // Mock Implementations
    // =========================================================================

    static class MockClientEvmSigner implements ClientEvmSigner {
        private final String address;

        MockClientEvmSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> signPayment(EvmAuthorization authorization, String network) {
            // Return a mock signature
            return CompletableFuture.completedFuture(SAMPLE_SIGNATURE);
        }
    }

    static class MockFacilitatorEvmSigner implements FacilitatorEvmSigner {
        private final List<String> addresses;
        private String recoveredAddress = SAMPLE_ADDRESS_1;
        private boolean confirmResult = true;
        private boolean sendShouldFail = false;
        private int sendCount = 0;

        MockFacilitatorEvmSigner(List<String> addresses) {
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

        @Override
        public List<String> getAddresses() {
            return addresses;
        }

        @Override
        public CompletableFuture<String> recoverSigner(
                EvmAuthorization authorization, String signature, String network) {
            return CompletableFuture.completedFuture(recoveredAddress);
        }

        @Override
        public CompletableFuture<String> sendTransferWithAuthorization(
                EvmAuthorization authorization, String signature, String network) {
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
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    private static EvmAuthorization createSampleAuthorization() {
        return EvmAuthorization.builder()
            .from(SAMPLE_ADDRESS_1)
            .to(SAMPLE_ADDRESS_2)
            .value("1000000")
            .nonce(SAMPLE_NONCE)
            .validAfter(100)
            .validBefore(9999999)
            .build();
    }
}
