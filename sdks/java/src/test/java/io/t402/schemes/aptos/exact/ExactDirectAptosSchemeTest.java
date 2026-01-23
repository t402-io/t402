package io.t402.schemes.aptos.exact;

import io.t402.schemes.aptos.*;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for Exact-Direct Aptos scheme implementations.
 */
@DisplayName("Exact-Direct Aptos Schemes")
class ExactDirectAptosSchemeTest {

    private static final String SAMPLE_ADDRESS_1 =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    private static final String SAMPLE_ADDRESS_2 =
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    private static final String SAMPLE_TX_HASH =
        "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678";
    private static final String SAMPLE_METADATA =
        "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb";

    // =========================================================================
    // AptosConstants Tests
    // =========================================================================

    @Nested
    @DisplayName("AptosConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should return USDT metadata address for mainnet")
        void testGetUsdtMetadataMainnet() {
            assertEquals(
                "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
                AptosConstants.getUsdtMetadataAddress(AptosConstants.APTOS_MAINNET));
        }

        @Test
        @DisplayName("should return USDT metadata address for testnet")
        void testGetUsdtMetadataTestnet() {
            assertEquals(
                "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
                AptosConstants.getUsdtMetadataAddress(AptosConstants.APTOS_TESTNET));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testGetUsdtMetadataUnsupported() {
            assertThrows(IllegalArgumentException.class, () ->
                AptosConstants.getUsdtMetadataAddress("solana:mainnet"));
        }

        @Test
        @DisplayName("should normalize network identifiers")
        void testNormalizeNetwork() {
            assertEquals(AptosConstants.APTOS_MAINNET, AptosConstants.normalizeNetwork("mainnet"));
            assertEquals(AptosConstants.APTOS_MAINNET, AptosConstants.normalizeNetwork("aptos-mainnet"));
            assertEquals(AptosConstants.APTOS_TESTNET, AptosConstants.normalizeNetwork("testnet"));
            assertEquals(AptosConstants.APTOS_TESTNET, AptosConstants.normalizeNetwork("aptos-testnet"));
            assertEquals(AptosConstants.APTOS_DEVNET, AptosConstants.normalizeNetwork("devnet"));
            assertEquals(AptosConstants.APTOS_MAINNET, AptosConstants.normalizeNetwork(null));
            assertEquals("aptos:1", AptosConstants.normalizeNetwork("aptos:1"));
        }

        @Test
        @DisplayName("should identify valid Aptos networks")
        void testIsValidNetwork() {
            assertTrue(AptosConstants.isValidNetwork("aptos:1"));
            assertTrue(AptosConstants.isValidNetwork("aptos:2"));
            assertTrue(AptosConstants.isValidNetwork("aptos:149"));
            assertFalse(AptosConstants.isValidNetwork("aptos:999"));
            assertFalse(AptosConstants.isValidNetwork("eip155:1"));
            assertFalse(AptosConstants.isValidNetwork("solana:mainnet"));
        }

        @Test
        @DisplayName("should validate Aptos address format")
        void testIsValidAddress() {
            assertTrue(AptosConstants.isValidAddress("0x1"));
            assertTrue(AptosConstants.isValidAddress(SAMPLE_ADDRESS_1));
            assertTrue(AptosConstants.isValidAddress("0xABCDef"));
            assertFalse(AptosConstants.isValidAddress(null));
            assertFalse(AptosConstants.isValidAddress(""));
            assertFalse(AptosConstants.isValidAddress("1234")); // no 0x prefix
            assertFalse(AptosConstants.isValidAddress("0x")); // empty hex
            assertFalse(AptosConstants.isValidAddress(
                "0x" + "a".repeat(65))); // too long
            assertFalse(AptosConstants.isValidAddress("0xGHIJ")); // invalid hex
        }

        @Test
        @DisplayName("should validate transaction hash format")
        void testIsValidTxHash() {
            assertTrue(AptosConstants.isValidTxHash(SAMPLE_TX_HASH));
            assertTrue(AptosConstants.isValidTxHash("0x" + "a".repeat(64)));
            assertFalse(AptosConstants.isValidTxHash(null));
            assertFalse(AptosConstants.isValidTxHash(""));
            assertFalse(AptosConstants.isValidTxHash("0x" + "a".repeat(63))); // too short
            assertFalse(AptosConstants.isValidTxHash("0x" + "a".repeat(65))); // too long
            assertFalse(AptosConstants.isValidTxHash("0x" + "g".repeat(64))); // invalid hex
            assertFalse(AptosConstants.isValidTxHash("a".repeat(64))); // no 0x prefix
        }

        @Test
        @DisplayName("should normalize addresses for comparison")
        void testNormalizeAddress() {
            assertEquals("0xabcdef", AptosConstants.normalizeAddress("0xABCDEF"));
            assertEquals("0xabcdef", AptosConstants.normalizeAddress("0xabcdef"));
            assertEquals("0xabcdef", AptosConstants.normalizeAddress("ABCDEF"));
            assertEquals("", AptosConstants.normalizeAddress(null));
            assertEquals("", AptosConstants.normalizeAddress(""));
        }

        @Test
        @DisplayName("should compare addresses case-insensitively")
        void testCompareAddresses() {
            assertTrue(AptosConstants.compareAddresses("0xABCDEF", "0xabcdef"));
            assertTrue(AptosConstants.compareAddresses("0xAbCd", "0xabcd"));
            assertFalse(AptosConstants.compareAddresses("0xabc", "0xdef"));
            assertFalse(AptosConstants.compareAddresses(null, "0xabc"));
            assertFalse(AptosConstants.compareAddresses("0xabc", null));
            assertFalse(AptosConstants.compareAddresses("", "0xabc"));
        }

        @Test
        @DisplayName("should have correct constant values")
        void testConstants() {
            assertEquals("exact-direct", AptosConstants.SCHEME_EXACT_DIRECT);
            assertEquals("aptos:*", AptosConstants.CAIP_FAMILY);
            assertEquals("aptos:1", AptosConstants.APTOS_MAINNET);
            assertEquals("aptos:2", AptosConstants.APTOS_TESTNET);
            assertEquals(6, AptosConstants.USDT_DECIMALS);
            assertEquals("0x1::primary_fungible_store::transfer", AptosConstants.FA_TRANSFER_FUNCTION);
        }
    }

    // =========================================================================
    // ExactDirectPayload Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactDirectPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build payload with all fields")
        void testBuildPayload() {
            ExactDirectPayload payload = ExactDirectPayload.builder()
                .txHash(SAMPLE_TX_HASH)
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .amount("1000000")
                .metadataAddress(SAMPLE_METADATA)
                .build();

            assertEquals(SAMPLE_TX_HASH, payload.getTxHash());
            assertEquals(SAMPLE_ADDRESS_1, payload.getFrom());
            assertEquals(SAMPLE_ADDRESS_2, payload.getTo());
            assertEquals("1000000", payload.getAmount());
            assertEquals(SAMPLE_METADATA, payload.getMetadataAddress());
        }

        @Test
        @DisplayName("should throw when txHash is missing")
        void testMissingTxHash() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .from(SAMPLE_ADDRESS_1)
                    .to(SAMPLE_ADDRESS_2)
                    .amount("1000000")
                    .metadataAddress(SAMPLE_METADATA)
                    .build());
        }

        @Test
        @DisplayName("should throw when from is missing")
        void testMissingFrom() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .to(SAMPLE_ADDRESS_2)
                    .amount("1000000")
                    .metadataAddress(SAMPLE_METADATA)
                    .build());
        }

        @Test
        @DisplayName("should throw when to is missing")
        void testMissingTo() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .from(SAMPLE_ADDRESS_1)
                    .amount("1000000")
                    .metadataAddress(SAMPLE_METADATA)
                    .build());
        }

        @Test
        @DisplayName("should throw when amount is missing")
        void testMissingAmount() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .from(SAMPLE_ADDRESS_1)
                    .to(SAMPLE_ADDRESS_2)
                    .metadataAddress(SAMPLE_METADATA)
                    .build());
        }

        @Test
        @DisplayName("should throw when metadataAddress is missing")
        void testMissingMetadata() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .from(SAMPLE_ADDRESS_1)
                    .to(SAMPLE_ADDRESS_2)
                    .amount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should convert to and from map with camelCase keys")
        void testMapSerialization() {
            ExactDirectPayload original = ExactDirectPayload.builder()
                .txHash(SAMPLE_TX_HASH)
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .amount("1000000")
                .metadataAddress(SAMPLE_METADATA)
                .build();

            Map<String, Object> map = original.toMap();
            assertEquals(SAMPLE_TX_HASH, map.get("txHash"));
            assertEquals(SAMPLE_ADDRESS_1, map.get("from"));
            assertEquals(SAMPLE_ADDRESS_2, map.get("to"));
            assertEquals("1000000", map.get("amount"));
            assertEquals(SAMPLE_METADATA, map.get("metadataAddress"));

            ExactDirectPayload restored = ExactDirectPayload.fromMap(map);
            assertEquals(original.getTxHash(), restored.getTxHash());
            assertEquals(original.getFrom(), restored.getFrom());
            assertEquals(original.getTo(), restored.getTo());
            assertEquals(original.getAmount(), restored.getAmount());
            assertEquals(original.getMetadataAddress(), restored.getMetadataAddress());
        }

        @Test
        @DisplayName("should parse from map with snake_case keys")
        void testFromMapSnakeCase() {
            Map<String, Object> map = new HashMap<>();
            map.put("tx_hash", SAMPLE_TX_HASH);
            map.put("from_address", SAMPLE_ADDRESS_1);
            map.put("to_address", SAMPLE_ADDRESS_2);
            map.put("amount", "500000");
            map.put("metadata_address", SAMPLE_METADATA);

            ExactDirectPayload payload = ExactDirectPayload.fromMap(map);
            assertEquals(SAMPLE_TX_HASH, payload.getTxHash());
            assertEquals(SAMPLE_ADDRESS_1, payload.getFrom());
            assertEquals(SAMPLE_ADDRESS_2, payload.getTo());
            assertEquals("500000", payload.getAmount());
            assertEquals(SAMPLE_METADATA, payload.getMetadataAddress());
        }
    }

    // =========================================================================
    // ExactDirectAptosServerScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactDirectAptosServerScheme")
    class ServerSchemeTest {

        private ExactDirectAptosServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactDirectAptosServerScheme(AptosConstants.APTOS_MAINNET);
        }

        @Test
        @DisplayName("should create with default network")
        void testDefaultNetwork() {
            ExactDirectAptosServerScheme defaultScheme = new ExactDirectAptosServerScheme();
            assertEquals(AptosConstants.APTOS_MAINNET, defaultScheme.getDefaultNetwork());
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", AptosConstants.APTOS_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertEquals(AptosConstants.USDT_MAINNET_METADATA, result.get("asset"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDT", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse price with dollar sign")
        void testParsePriceDollarSign() {
            Map<String, Object> result = scheme.parsePrice("$2.50", AptosConstants.APTOS_MAINNET);

            assertEquals("2500000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("1500000", AptosConstants.APTOS_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse small decimal price")
        void testParsePriceSmall() {
            Map<String, Object> result = scheme.parsePrice("0.01", AptosConstants.APTOS_MAINNET);

            assertEquals("10000", result.get("amount"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "solana:mainnet"));
        }

        @Test
        @DisplayName("should create payment requirements")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", SAMPLE_ADDRESS_2, "API Access");

            assertEquals(2, requirements.get("t402Version"));
            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(AptosConstants.APTOS_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertEquals(AptosConstants.USDT_MAINNET_METADATA, requirements.get("asset"));
            assertEquals(AptosConstants.DEFAULT_VALIDITY_DURATION, requirements.get("maxTimeoutSeconds"));
            assertEquals("API Access", requirements.get("resource"));
        }

        @Test
        @DisplayName("should create requirements with network override")
        void testGetPaymentRequirementsNetworkOverride() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "2.00", AptosConstants.APTOS_TESTNET, SAMPLE_ADDRESS_2, "Premium");

            assertEquals(AptosConstants.APTOS_TESTNET, requirements.get("network"));
            assertEquals("2000000", requirements.get("maxAmountRequired"));
        }

        @Test
        @DisplayName("should create requirements with custom parameters")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                AptosConstants.APTOS_MAINNET,
                SAMPLE_ADDRESS_2,
                "5000000",
                SAMPLE_METADATA,
                600
            );

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(AptosConstants.APTOS_MAINNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("5000000", requirements.get("maxAmountRequired"));
            assertEquals(SAMPLE_METADATA, requirements.get("asset"));
            assertEquals(600, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should validate correct requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact-direct");
            valid.put("network", AptosConstants.APTOS_MAINNET);
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
            wrongScheme.put("scheme", "exact");
            wrongScheme.put("network", AptosConstants.APTOS_MAINNET);
            wrongScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-Aptos network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact-direct");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongNetwork));

            // Missing payTo
            Map<String, Object> noPayTo = new HashMap<>();
            noPayTo.put("scheme", "exact-direct");
            noPayTo.put("network", AptosConstants.APTOS_MAINNET);
            assertFalse(scheme.validateRequirements(noPayTo));

            // Invalid payTo address
            Map<String, Object> badPayTo = new HashMap<>();
            badPayTo.put("scheme", "exact-direct");
            badPayTo.put("network", AptosConstants.APTOS_MAINNET);
            badPayTo.put("payTo", "invalid-address");
            assertFalse(scheme.validateRequirements(badPayTo));
        }
    }

    // =========================================================================
    // ExactDirectAptosClientScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactDirectAptosClientScheme")
    class ClientSchemeTest {

        private MockClientAptosSigner mockSigner;
        private ExactDirectAptosClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientAptosSigner(SAMPLE_ADDRESS_1);
            scheme = new ExactDirectAptosClientScheme(mockSigner);
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
                new ExactDirectAptosClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", AptosConstants.APTOS_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SAMPLE_METADATA);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("exact-direct", result.get("scheme"));
            assertEquals(AptosConstants.APTOS_MAINNET, result.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            assertNotNull(payloadData);
            assertEquals(SAMPLE_TX_HASH, payloadData.get("txHash"));
            assertEquals(SAMPLE_ADDRESS_1, payloadData.get("from"));
            assertEquals(SAMPLE_ADDRESS_2, payloadData.get("to"));
            assertEquals("1000000", payloadData.get("amount"));
            assertEquals(SAMPLE_METADATA, payloadData.get("metadataAddress"));
        }

        @Test
        @DisplayName("should use default asset when not provided")
        void testDefaultAsset() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", AptosConstants.APTOS_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            // No asset specified

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) result.get("payload");
            assertEquals(AptosConstants.USDT_MAINNET_METADATA, payloadData.get("metadataAddress"));
        }

        @Test
        @DisplayName("should verify signer received correct tx payload")
        void testSignerReceivesCorrectPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", AptosConstants.APTOS_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "500000");
            requirements.put("asset", SAMPLE_METADATA);

            scheme.createPaymentPayloadSync(requirements);

            // Verify the signer received the correct transaction payload
            Map<String, Object> lastTxPayload = mockSigner.getLastTxPayload();
            assertNotNull(lastTxPayload);
            assertEquals("entry_function_payload", lastTxPayload.get("type"));
            assertEquals(AptosConstants.FA_TRANSFER_FUNCTION, lastTxPayload.get("function"));

            @SuppressWarnings("unchecked")
            List<Object> arguments = (List<Object>) lastTxPayload.get("arguments");
            assertEquals(3, arguments.size());
            assertEquals(SAMPLE_METADATA, arguments.get(0));
            assertEquals(SAMPLE_ADDRESS_2, arguments.get(1));
            assertEquals("500000", arguments.get(2));
        }

        @Test
        @DisplayName("should fail for non-Aptos network")
        void testNonAptosNetwork() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", "eip155:1");
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail for missing payTo")
        void testMissingPayTo() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", AptosConstants.APTOS_MAINNET);
            requirements.put("maxAmountRequired", "1000000");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail for invalid payTo address")
        void testInvalidPayToAddress() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", AptosConstants.APTOS_MAINNET);
            requirements.put("payTo", "not-a-valid-address");
            requirements.put("maxAmountRequired", "1000000");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail for missing amount")
        void testMissingAmount() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", AptosConstants.APTOS_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail for zero amount")
        void testZeroAmount() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", AptosConstants.APTOS_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "0");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }

        @Test
        @DisplayName("should fail for negative amount")
        void testNegativeAmount() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", AptosConstants.APTOS_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "-100");

            CompletableFuture<Map<String, Object>> future = scheme.createPaymentPayload(requirements);

            assertTrue(future.isCompletedExceptionally());
        }
    }

    // =========================================================================
    // ExactDirectAptosFacilitatorScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ExactDirectAptosFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorAptosSigner mockSigner;
        private ExactDirectAptosFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorAptosSigner();
            scheme = new ExactDirectAptosFacilitatorScheme(mockSigner, 3600);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactDirectAptosFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers for network")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(AptosConstants.APTOS_MAINNET);
            assertNotNull(signers);
            assertTrue(signers.isEmpty()); // exact-direct facilitator has no addresses
        }

        @Test
        @DisplayName("should verify valid payment")
        void testVerifyValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
            assertNull(result.error);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
            assertEquals(AptosConstants.APTOS_MAINNET, result.network);
            assertNotNull(result.payload);
            assertEquals(SAMPLE_TX_HASH, result.payload.getTxHash());
        }

        @Test
        @DisplayName("should reject missing payload")
        void testVerifyMissingPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("network", AptosConstants.APTOS_MAINNET);
            // No "payload" key

            Map<String, Object> requirements = createValidRequirements();

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertEquals("Missing payload", result.error);
        }

        @Test
        @DisplayName("should reject invalid transaction hash")
        void testVerifyInvalidTxHash() {
            Map<String, Object> innerPayload = new HashMap<>();
            innerPayload.put("txHash", "not-a-valid-hash");
            innerPayload.put("from", SAMPLE_ADDRESS_1);
            innerPayload.put("to", SAMPLE_ADDRESS_2);
            innerPayload.put("amount", "1000000");
            innerPayload.put("metadataAddress", SAMPLE_METADATA);

            Map<String, Object> payload = new HashMap<>();
            payload.put("network", AptosConstants.APTOS_MAINNET);
            payload.put("payload", innerPayload);

            Map<String, Object> requirements = createValidRequirements();

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertEquals("Invalid transaction hash format", result.error);
        }

        @Test
        @DisplayName("should reject replay attacks")
        void testVerifyReplayAttack() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // First verification should succeed
            ExactDirectAptosFacilitatorScheme.VerificationResult result1 =
                scheme.verifySync(payload, requirements);
            assertTrue(result1.valid);

            // Second verification with same tx should fail
            ExactDirectAptosFacilitatorScheme.VerificationResult result2 =
                scheme.verifySync(payload, requirements);
            assertFalse(result2.valid);
            assertEquals("Transaction has already been used", result2.error);
        }

        @Test
        @DisplayName("should reject failed transactions")
        void testVerifyFailedTransaction() {
            mockSigner.setTransactionSuccess(false);
            mockSigner.setVmStatus("EXECUTION_FAILURE");

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Transaction failed"));
            assertTrue(result.error.contains("EXECUTION_FAILURE"));
        }

        @Test
        @DisplayName("should reject transactions with wrong recipient")
        void testVerifyRecipientMismatch() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo", "0x9999999999999999999999999999999999999999999999999999999999999999");

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Recipient mismatch"));
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than the 1000000 in tx

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Insufficient amount"));
        }

        @Test
        @DisplayName("should accept equal amount")
        void testVerifyEqualAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "1000000"); // Equal to tx amount

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
        }

        @Test
        @DisplayName("should accept greater amount")
        void testVerifyGreaterAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "500000"); // Less than the 1000000 in tx

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
        }

        @Test
        @DisplayName("should reject old transactions")
        void testVerifyOldTransaction() {
            // Set timestamp to 2 hours ago (7200 seconds)
            long oldTimestamp = (System.currentTimeMillis() / 1000 - 7200) * 1_000_000L;
            mockSigner.setTimestamp(String.valueOf(oldTimestamp));

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Transaction too old"));
        }

        @Test
        @DisplayName("should reject non-transfer transactions")
        void testVerifyNonTransferTransaction() {
            mockSigner.setFunction("0x1::coin::transfer");

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Could not extract transfer details"));
        }

        @Test
        @DisplayName("should handle transaction query failure")
        void testVerifyTransactionNotFound() {
            mockSigner.setShouldFail(true);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Transaction not found"));
        }

        @Test
        @DisplayName("should verify with case-insensitive address comparison")
        void testVerifyCaseInsensitive() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            // Use uppercase payTo
            requirements.put("payTo", SAMPLE_ADDRESS_2.toUpperCase().replace("X", "x"));

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectAptosFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertEquals(ExactDirectAptosFacilitatorScheme.SettlementStatus.SUCCESS, result.status);
            assertEquals(SAMPLE_TX_HASH, result.transaction);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
            assertNull(result.error);
        }

        @Test
        @DisplayName("should fail settlement for invalid payment")
        void testSettleInvalidPayment() {
            mockSigner.setTransactionSuccess(false);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectAptosFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertEquals(ExactDirectAptosFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertNull(result.transaction);
            assertNotNull(result.error);
        }

        @Test
        @DisplayName("should clean up expired used transactions")
        void testCleanupUsedTransactions() throws InterruptedException {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // Verify to mark as used
            scheme.verifySync(payload, requirements);

            // Second verification should fail (replay protection)
            ExactDirectAptosFacilitatorScheme.VerificationResult replayResult =
                scheme.verifySync(payload, requirements);
            assertFalse(replayResult.valid);

            // Wait a short time so the cache entry has a past timestamp
            Thread.sleep(50);

            // Cleanup with max age of 0 seconds: cutoff = now - 0ms = now
            // entries with timestamp < now should be removed (which includes our entry from 50ms ago)
            // We need to ensure the entry was stored before cutoff. Use cleanup from the future.
            // Actually let's just verify cleanup with a very short duration removes entries.
            // The entry was stored at time T. cleanupUsedTransactions(0) means cutoff = now.
            // Since T < now (50ms ago), it should be removed.
            int removed = scheme.cleanupUsedTransactions(0);
            assertEquals(1, removed);

            // Now the entry is removed, and a new scheme can verify again
            mockSigner = new MockFacilitatorAptosSigner();
            scheme = new ExactDirectAptosFacilitatorScheme(mockSigner, 3600);

            ExactDirectAptosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);
            assertTrue(result.valid);
        }

        // Helper methods

        private Map<String, Object> createValidPayload() {
            Map<String, Object> innerPayload = new HashMap<>();
            innerPayload.put("txHash", SAMPLE_TX_HASH);
            innerPayload.put("from", SAMPLE_ADDRESS_1);
            innerPayload.put("to", SAMPLE_ADDRESS_2);
            innerPayload.put("amount", "1000000");
            innerPayload.put("metadataAddress", SAMPLE_METADATA);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact-direct");
            payload.put("network", AptosConstants.APTOS_MAINNET);
            payload.put("payload", innerPayload);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact-direct");
            requirements.put("network", AptosConstants.APTOS_MAINNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", SAMPLE_METADATA);
            return requirements;
        }
    }

    // =========================================================================
    // AptosSchemes Factory Tests
    // =========================================================================

    @Nested
    @DisplayName("AptosSchemes")
    class SchemesFactoryTest {

        @Test
        @DisplayName("should create client scheme")
        void testCreateClient() {
            ClientAptosSigner signer = new MockClientAptosSigner(SAMPLE_ADDRESS_1);
            ExactDirectAptosClientScheme client = AptosSchemes.createClient(signer);
            assertNotNull(client);
            assertEquals(SAMPLE_ADDRESS_1, client.getAddress());
        }

        @Test
        @DisplayName("should create server scheme with defaults")
        void testCreateServer() {
            ExactDirectAptosServerScheme server = AptosSchemes.createServer();
            assertNotNull(server);
            assertEquals(AptosConstants.APTOS_MAINNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create server scheme with network")
        void testCreateServerWithNetwork() {
            ExactDirectAptosServerScheme server = AptosSchemes.createServer(AptosConstants.APTOS_TESTNET);
            assertEquals(AptosConstants.APTOS_TESTNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create facilitator scheme")
        void testCreateFacilitator() {
            FacilitatorAptosSigner signer = new MockFacilitatorAptosSigner();
            ExactDirectAptosFacilitatorScheme facilitator = AptosSchemes.createFacilitator(signer);
            assertNotNull(facilitator);
        }

        @Test
        @DisplayName("should create facilitator scheme with max age")
        void testCreateFacilitatorWithMaxAge() {
            FacilitatorAptosSigner signer = new MockFacilitatorAptosSigner();
            ExactDirectAptosFacilitatorScheme facilitator = AptosSchemes.createFacilitator(signer, 7200);
            assertNotNull(facilitator);
        }

        @Test
        @DisplayName("should return correct scheme identifier")
        void testGetScheme() {
            assertEquals("exact-direct", AptosSchemes.getScheme());
        }

        @Test
        @DisplayName("should validate networks")
        void testIsValidNetwork() {
            assertTrue(AptosSchemes.isValidNetwork("aptos:1"));
            assertFalse(AptosSchemes.isValidNetwork("eip155:1"));
        }

        @Test
        @DisplayName("should get USDT metadata address")
        void testGetUsdtMetadataAddress() {
            assertEquals(AptosConstants.USDT_MAINNET_METADATA,
                AptosSchemes.getUsdtMetadataAddress("aptos:1"));
        }

        @Test
        @DisplayName("should have correct supported networks")
        void testSupportedNetworks() {
            assertEquals(3, AptosSchemes.SUPPORTED_NETWORKS.size());
            assertTrue(AptosSchemes.SUPPORTED_NETWORKS.contains(AptosConstants.APTOS_MAINNET));
            assertTrue(AptosSchemes.SUPPORTED_NETWORKS.contains(AptosConstants.APTOS_TESTNET));
            assertTrue(AptosSchemes.SUPPORTED_NETWORKS.contains(AptosConstants.APTOS_DEVNET));
        }

        @Test
        @DisplayName("should have correct network pattern")
        void testNetworkPattern() {
            assertEquals("aptos:*", AptosSchemes.NETWORK_PATTERN);
        }
    }

    // =========================================================================
    // extractTransferDetails Tests
    // =========================================================================

    @Nested
    @DisplayName("extractTransferDetails")
    class ExtractTransferDetailsTest {

        @Test
        @DisplayName("should extract valid FA transfer details")
        void testExtractValidTransfer() {
            Map<String, Object> tx = createValidTransaction();
            Map<String, String> result = ExactDirectAptosFacilitatorScheme.extractTransferDetails(tx);

            assertNotNull(result);
            assertEquals(SAMPLE_ADDRESS_1, result.get("from"));
            assertEquals(SAMPLE_ADDRESS_2, result.get("to"));
            assertEquals("1000000", result.get("amount"));
            assertEquals(SAMPLE_METADATA, result.get("metadata_address"));
        }

        @Test
        @DisplayName("should return null for failed transaction")
        void testExtractFailedTransaction() {
            Map<String, Object> tx = createValidTransaction();
            tx.put("success", false);

            assertNull(ExactDirectAptosFacilitatorScheme.extractTransferDetails(tx));
        }

        @Test
        @DisplayName("should return null for non-entry_function_payload")
        void testExtractWrongPayloadType() {
            Map<String, Object> tx = createValidTransaction();
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) tx.get("payload");
            payload.put("type", "script_payload");

            assertNull(ExactDirectAptosFacilitatorScheme.extractTransferDetails(tx));
        }

        @Test
        @DisplayName("should return null for non-transfer function")
        void testExtractWrongFunction() {
            Map<String, Object> tx = createValidTransaction();
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) tx.get("payload");
            payload.put("function", "0x1::coin::transfer");

            assertNull(ExactDirectAptosFacilitatorScheme.extractTransferDetails(tx));
        }

        @Test
        @DisplayName("should return null for insufficient arguments")
        void testExtractInsufficientArguments() {
            Map<String, Object> tx = createValidTransaction();
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) tx.get("payload");
            List<Object> args = new ArrayList<>();
            args.add(SAMPLE_METADATA);
            payload.put("arguments", args); // Only 1 argument

            assertNull(ExactDirectAptosFacilitatorScheme.extractTransferDetails(tx));
        }

        @Test
        @DisplayName("should return null for null transaction")
        void testExtractNullTransaction() {
            assertNull(ExactDirectAptosFacilitatorScheme.extractTransferDetails(null));
        }

        @Test
        @DisplayName("should return null for missing payload")
        void testExtractMissingPayload() {
            Map<String, Object> tx = new HashMap<>();
            tx.put("success", true);
            tx.put("sender", SAMPLE_ADDRESS_1);

            assertNull(ExactDirectAptosFacilitatorScheme.extractTransferDetails(tx));
        }

        private Map<String, Object> createValidTransaction() {
            List<Object> arguments = new ArrayList<>();
            arguments.add(SAMPLE_METADATA);
            arguments.add(SAMPLE_ADDRESS_2);
            arguments.add("1000000");

            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "entry_function_payload");
            payload.put("function", AptosConstants.FA_TRANSFER_FUNCTION);
            payload.put("arguments", arguments);

            Map<String, Object> tx = new HashMap<>();
            tx.put("success", true);
            tx.put("sender", SAMPLE_ADDRESS_1);
            tx.put("payload", payload);
            tx.put("timestamp", String.valueOf(System.currentTimeMillis() * 1000));

            return tx;
        }
    }

    // =========================================================================
    // Mock Implementations
    // =========================================================================

    static class MockClientAptosSigner implements ClientAptosSigner {
        private final String address;
        private Map<String, Object> lastTxPayload;

        MockClientAptosSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> signAndSubmit(Map<String, Object> txPayload, String network) {
            this.lastTxPayload = txPayload;
            return CompletableFuture.completedFuture(SAMPLE_TX_HASH);
        }

        Map<String, Object> getLastTxPayload() {
            return lastTxPayload;
        }
    }

    static class MockFacilitatorAptosSigner implements FacilitatorAptosSigner {
        private boolean shouldFail = false;
        private boolean transactionSuccess = true;
        private String vmStatus = "Executed successfully";
        private String function = AptosConstants.FA_TRANSFER_FUNCTION;
        private String timestamp = String.valueOf(System.currentTimeMillis() * 1000); // microseconds

        void setShouldFail(boolean shouldFail) {
            this.shouldFail = shouldFail;
        }

        void setTransactionSuccess(boolean success) {
            this.transactionSuccess = success;
        }

        void setVmStatus(String vmStatus) {
            this.vmStatus = vmStatus;
        }

        void setFunction(String function) {
            this.function = function;
        }

        void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }

        @Override
        public List<String> getAddresses(String network) {
            return List.of(); // exact-direct facilitator has no addresses
        }

        @Override
        public CompletableFuture<Map<String, Object>> getTransaction(String txHash, String network) {
            if (shouldFail) {
                return CompletableFuture.failedFuture(
                    new AptosTransactionException("Transaction not found"));
            }

            List<Object> arguments = new ArrayList<>();
            arguments.add(SAMPLE_METADATA);
            arguments.add(SAMPLE_ADDRESS_2);
            arguments.add("1000000");

            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "entry_function_payload");
            payload.put("function", function);
            payload.put("arguments", arguments);

            Map<String, Object> tx = new HashMap<>();
            tx.put("hash", txHash);
            tx.put("success", transactionSuccess);
            tx.put("vm_status", vmStatus);
            tx.put("sender", SAMPLE_ADDRESS_1);
            tx.put("timestamp", timestamp);
            tx.put("payload", payload);

            return CompletableFuture.completedFuture(tx);
        }
    }
}
