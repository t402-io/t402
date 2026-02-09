package io.t402.schemes.tezos.exact_direct;

import io.t402.schemes.tezos.*;

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
 * Tests for Tezos exact-direct scheme implementations.
 */
@DisplayName("Exact-Direct Tezos Schemes")
class ExactDirectTezosSchemeTest {

    // Valid Tezos addresses (36 chars, proper prefix, Base58)
    private static final String SENDER_ADDRESS = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
    private static final String RECIPIENT_ADDRESS = "tz1aSkwEot3L2kmUvcoxzjMomb9LTQjTBRKo";
    private static final String CONTRACT_ADDRESS = "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o";

    // Valid operation hash (51 chars, starts with 'o', Base58)
    private static final String SAMPLE_OP_HASH = "oo7bHfPqBPoYRCoHDTTBCe7rhNRrHjqK2MfxUPyaEFbL8HdUi7o";

    @Nested
    @DisplayName("TezosConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should validate correct addresses")
        void testValidAddresses() {
            assertTrue(TezosConstants.isValidAddress(SENDER_ADDRESS));
            assertTrue(TezosConstants.isValidAddress(RECIPIENT_ADDRESS));
            assertTrue(TezosConstants.isValidAddress(CONTRACT_ADDRESS));
        }

        @Test
        @DisplayName("should reject invalid addresses")
        void testInvalidAddresses() {
            assertFalse(TezosConstants.isValidAddress(null));
            assertFalse(TezosConstants.isValidAddress(""));
            assertFalse(TezosConstants.isValidAddress("invalid"));
            assertFalse(TezosConstants.isValidAddress("0x1234567890abcdef")); // Ethereum-style
        }

        @Test
        @DisplayName("should validate correct operation hashes")
        void testValidOpHash() {
            assertTrue(TezosConstants.isValidOperationHash(SAMPLE_OP_HASH));
        }

        @Test
        @DisplayName("should reject invalid operation hashes")
        void testInvalidOpHash() {
            assertFalse(TezosConstants.isValidOperationHash(null));
            assertFalse(TezosConstants.isValidOperationHash(""));
            assertFalse(TezosConstants.isValidOperationHash("invalid"));
            assertFalse(TezosConstants.isValidOperationHash("notstartswitho12345678901234567890123456789012345678901")); // 51 chars but no 'o' prefix
        }

        @Test
        @DisplayName("should normalize network identifiers")
        void testNormalizeNetwork() {
            assertEquals(TezosConstants.TEZOS_MAINNET, TezosConstants.normalizeNetwork("mainnet"));
            assertEquals(TezosConstants.TEZOS_MAINNET, TezosConstants.normalizeNetwork("tezos-mainnet"));
            assertEquals(TezosConstants.TEZOS_GHOSTNET, TezosConstants.normalizeNetwork("ghostnet"));
            assertEquals(TezosConstants.TEZOS_GHOSTNET, TezosConstants.normalizeNetwork("testnet"));
            assertEquals(TezosConstants.TEZOS_MAINNET, TezosConstants.normalizeNetwork(null));
            assertEquals("tezos:custom", TezosConstants.normalizeNetwork("tezos:custom"));
        }

        @Test
        @DisplayName("should validate network identifiers")
        void testValidNetwork() {
            assertTrue(TezosConstants.isValidNetwork(TezosConstants.TEZOS_MAINNET));
            assertTrue(TezosConstants.isValidNetwork(TezosConstants.TEZOS_GHOSTNET));
            assertFalse(TezosConstants.isValidNetwork("eip155:1"));
            assertFalse(TezosConstants.isValidNetwork(null));
        }

        @Test
        @DisplayName("should create asset identifiers")
        void testCreateAssetIdentifier() {
            String asset = TezosConstants.createAssetIdentifier(
                TezosConstants.TEZOS_MAINNET, CONTRACT_ADDRESS, 0);
            assertEquals("tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0", asset);
        }

        @Test
        @DisplayName("should check isSupportedNetwork correctly")
        void testIsSupportedNetwork() {
            assertTrue(TezosConstants.isSupportedNetwork(TezosConstants.TEZOS_MAINNET));
            assertTrue(TezosConstants.isSupportedNetwork(TezosConstants.TEZOS_GHOSTNET));
            assertFalse(TezosConstants.isSupportedNetwork("tezos:custom"));
            // null normalizes to mainnet, so isSupportedNetwork(null) is true
            assertTrue(TezosConstants.isSupportedNetwork(null));
            // Aliases resolve to supported networks
            assertTrue(TezosConstants.isSupportedNetwork("mainnet"));
            assertTrue(TezosConstants.isSupportedNetwork("ghostnet"));
            // Non-tezos network
            assertFalse(TezosConstants.isSupportedNetwork("eip155:1"));
        }

        @Test
        @DisplayName("should get USDT contract for mainnet")
        void testGetUsdtContract() {
            assertEquals(TezosConstants.USDT_MAINNET_CONTRACT,
                TezosConstants.getUsdtContract(TezosConstants.TEZOS_MAINNET));
            assertThrows(IllegalArgumentException.class, () ->
                TezosConstants.getUsdtContract(TezosConstants.TEZOS_GHOSTNET));
            assertThrows(IllegalArgumentException.class, () ->
                TezosConstants.getUsdtContract("tezos:unknown"));
        }

        @Test
        @DisplayName("should get USDT token ID")
        void testGetUsdtTokenId() {
            assertEquals(0, TezosConstants.getUsdtTokenId(TezosConstants.TEZOS_MAINNET));
            assertEquals(0, TezosConstants.getUsdtTokenId(TezosConstants.TEZOS_GHOSTNET));
            assertEquals(0, TezosConstants.getUsdtTokenId("any-network"));
        }

        @Test
        @DisplayName("should validate addresses with all prefixes")
        void testAddressValidation_AllPrefixes() {
            // tz1 prefix (Ed25519) - already tested via SENDER_ADDRESS
            assertTrue(TezosConstants.isValidAddress(SENDER_ADDRESS));

            // tz2 prefix (secp256k1) - 36 chars with valid Base58
            assertTrue(TezosConstants.isValidAddress("tz2AjBNJQyR7CUzFmJGPxqSMQrkBHqv2fVYb"));

            // tz3 prefix (P-256) - 36 chars with valid Base58
            assertTrue(TezosConstants.isValidAddress("tz3WXYtyDUNL91qfiCJtVUX746QpNv5i5ve5"));

            // KT1 prefix (contract)
            assertTrue(TezosConstants.isValidAddress(CONTRACT_ADDRESS));
        }

        @Test
        @DisplayName("should reject addresses with edge cases")
        void testAddressValidation_EdgeCases() {
            // Wrong length: 35 chars (too short)
            assertFalse(TezosConstants.isValidAddress("tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcj"));

            // Wrong length: 37 chars (too long)
            assertFalse(TezosConstants.isValidAddress("tz1VSUr8wwNhLAzempoch5d6hLRiTh8CjcjbX"));

            // Invalid Base58 chars: 0, O, I, l
            assertFalse(TezosConstants.isValidAddress("tz10SUr8wwNhLAzempoch5d6hLRiTh8Cjcjb")); // '0' is invalid
            assertFalse(TezosConstants.isValidAddress("tz1OSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb")); // 'O' is invalid
            assertFalse(TezosConstants.isValidAddress("tz1ISUr8wwNhLAzempoch5d6hLRiTh8Cjcjb")); // 'I' is invalid
            assertFalse(TezosConstants.isValidAddress("tz1lSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb")); // 'l' is invalid

            // Empty and null
            assertFalse(TezosConstants.isValidAddress(""));
            assertFalse(TezosConstants.isValidAddress(null));
        }

        @Test
        @DisplayName("should have correct constant values")
        void testConstantValues() {
            assertEquals("exact-direct", TezosConstants.SCHEME_EXACT_DIRECT);
            assertEquals("tezos:*", TezosConstants.CAIP_FAMILY);
            assertEquals(6, TezosConstants.USDT_DECIMALS);
            assertEquals(36, TezosConstants.ADDRESS_LENGTH);
            assertEquals(51, TezosConstants.OP_HASH_LENGTH);
            assertEquals(300, TezosConstants.DEFAULT_VALIDITY_DURATION);
            assertEquals("transfer", TezosConstants.FA2_TRANSFER_ENTRYPOINT);
        }
    }

    @Nested
    @DisplayName("ExactDirectPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build and serialize payload")
        void testBuildPayload() {
            ExactDirectPayload payload = ExactDirectPayload.builder()
                .opHash(SAMPLE_OP_HASH)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1000000")
                .contractAddress(CONTRACT_ADDRESS)
                .tokenId(0)
                .build();

            assertEquals(SAMPLE_OP_HASH, payload.getOpHash());
            assertEquals(SENDER_ADDRESS, payload.getFrom());
            assertEquals(RECIPIENT_ADDRESS, payload.getTo());
            assertEquals("1000000", payload.getAmount());
            assertEquals(CONTRACT_ADDRESS, payload.getContractAddress());
            assertEquals(0, payload.getTokenId());
        }

        @Test
        @DisplayName("should convert to/from map")
        void testToFromMap() {
            ExactDirectPayload original = ExactDirectPayload.builder()
                .opHash(SAMPLE_OP_HASH)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1500000")
                .contractAddress(CONTRACT_ADDRESS)
                .tokenId(0)
                .build();

            Map<String, Object> map = original.toMap();
            assertEquals(SAMPLE_OP_HASH, map.get("opHash"));
            assertEquals(SENDER_ADDRESS, map.get("from"));
            assertEquals(RECIPIENT_ADDRESS, map.get("to"));
            assertEquals("1500000", map.get("amount"));
            assertEquals(CONTRACT_ADDRESS, map.get("contractAddress"));
            assertEquals(0, map.get("tokenId"));

            ExactDirectPayload restored = ExactDirectPayload.fromMap(map);
            assertEquals(original.getOpHash(), restored.getOpHash());
            assertEquals(original.getFrom(), restored.getFrom());
            assertEquals(original.getTo(), restored.getTo());
            assertEquals(original.getAmount(), restored.getAmount());
            assertEquals(original.getContractAddress(), restored.getContractAddress());
            assertEquals(original.getTokenId(), restored.getTokenId());
        }

        @Test
        @DisplayName("should reject missing required fields")
        void testMissingFields() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .from(SENDER_ADDRESS)
                    .to(RECIPIENT_ADDRESS)
                    .amount("1000000")
                    .contractAddress(CONTRACT_ADDRESS)
                    .build());

            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .opHash(SAMPLE_OP_HASH)
                    .to(RECIPIENT_ADDRESS)
                    .amount("1000000")
                    .contractAddress(CONTRACT_ADDRESS)
                    .build());
        }

        @Test
        @DisplayName("should reject missing to address")
        void testBuilderMissingTo() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .opHash(SAMPLE_OP_HASH)
                    .from(SENDER_ADDRESS)
                    .amount("1000000")
                    .contractAddress(CONTRACT_ADDRESS)
                    .build());
        }

        @Test
        @DisplayName("should reject missing amount")
        void testBuilderMissingAmount() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .opHash(SAMPLE_OP_HASH)
                    .from(SENDER_ADDRESS)
                    .to(RECIPIENT_ADDRESS)
                    .contractAddress(CONTRACT_ADDRESS)
                    .build());
        }

        @Test
        @DisplayName("should reject missing contract address")
        void testBuilderMissingContractAddress() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .opHash(SAMPLE_OP_HASH)
                    .from(SENDER_ADDRESS)
                    .to(RECIPIENT_ADDRESS)
                    .amount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should throw when fromMap has null opHash")
        void testFromMapWithNullFields() {
            Map<String, Object> map = new HashMap<>();
            map.put("opHash", null);
            map.put("from", SENDER_ADDRESS);
            map.put("to", RECIPIENT_ADDRESS);
            map.put("amount", "1000000");
            map.put("contractAddress", CONTRACT_ADDRESS);
            map.put("tokenId", 0);

            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.fromMap(map));
        }

        @Test
        @DisplayName("should handle tokenId as String and Number in fromMap")
        void testTokenIdHandling() {
            // String tokenId
            Map<String, Object> mapWithString = new HashMap<>();
            mapWithString.put("opHash", SAMPLE_OP_HASH);
            mapWithString.put("from", SENDER_ADDRESS);
            mapWithString.put("to", RECIPIENT_ADDRESS);
            mapWithString.put("amount", "1000000");
            mapWithString.put("contractAddress", CONTRACT_ADDRESS);
            mapWithString.put("tokenId", "0");

            ExactDirectPayload fromString = ExactDirectPayload.fromMap(mapWithString);
            assertEquals(0, fromString.getTokenId());

            // Number tokenId
            Map<String, Object> mapWithNumber = new HashMap<>();
            mapWithNumber.put("opHash", SAMPLE_OP_HASH);
            mapWithNumber.put("from", SENDER_ADDRESS);
            mapWithNumber.put("to", RECIPIENT_ADDRESS);
            mapWithNumber.put("amount", "1000000");
            mapWithNumber.put("contractAddress", CONTRACT_ADDRESS);
            mapWithNumber.put("tokenId", 5);

            ExactDirectPayload fromNumber = ExactDirectPayload.fromMap(mapWithNumber);
            assertEquals(5, fromNumber.getTokenId());
        }
    }

    @Nested
    @DisplayName("ExactDirectTezosServerScheme")
    class ServerSchemeTest {

        private ExactDirectTezosServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactDirectTezosServerScheme();
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", TezosConstants.TEZOS_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertTrue(((String) result.get("asset")).contains("fa2:"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDt", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse dollar-prefixed price")
        void testParsePriceDollar() {
            Map<String, Object> result = scheme.parsePrice("$0.10", TezosConstants.TEZOS_MAINNET);

            assertEquals("100000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse atomic amount")
        void testParsePriceAtomic() {
            Map<String, Object> result = scheme.parsePrice("1500000", TezosConstants.TEZOS_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "eip155:1"));
        }

        @Test
        @DisplayName("should create payment requirements")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                TezosConstants.TEZOS_MAINNET,
                RECIPIENT_ADDRESS,
                "1000000",
                CONTRACT_ADDRESS,
                0,
                300
            );

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(TezosConstants.TEZOS_MAINNET, requirements.get("network"));
            assertEquals(RECIPIENT_ADDRESS, requirements.get("payTo"));
            assertEquals("1000000", requirements.get("maxAmountRequired"));
            assertEquals(300, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact-direct");
            valid.put("network", TezosConstants.TEZOS_MAINNET);
            valid.put("payTo", RECIPIENT_ADDRESS);

            assertTrue(scheme.validateRequirements(valid));

            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "exact");
            wrongScheme.put("network", TezosConstants.TEZOS_MAINNET);
            wrongScheme.put("payTo", RECIPIENT_ADDRESS);
            assertFalse(scheme.validateRequirements(wrongScheme));

            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact-direct");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", RECIPIENT_ADDRESS);
            assertFalse(scheme.validateRequirements(wrongNetwork));
        }

        @Test
        @DisplayName("should get payment requirements with description")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", RECIPIENT_ADDRESS, "Test API"
            );

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(TezosConstants.TEZOS_MAINNET, requirements.get("network"));
            assertEquals(RECIPIENT_ADDRESS, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertEquals("Test API", requirements.get("resource"));
        }
    }

    @Nested
    @DisplayName("ExactDirectTezosClientScheme")
    class ClientSchemeTest {

        private MockClientTezosSigner mockSigner;
        private ExactDirectTezosClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientTezosSigner(SENDER_ADDRESS, SAMPLE_OP_HASH);
            scheme = new ExactDirectTezosClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SENDER_ADDRESS, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactDirectTezosClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePayloadSync() {
            Map<String, Object> requirements = createClientRequirements();

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("exact-direct", result.get("scheme"));
            assertEquals(TezosConstants.TEZOS_MAINNET, result.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.get("payload");
            assertNotNull(payload);
            assertEquals(SAMPLE_OP_HASH, payload.get("opHash"));
            assertEquals(SENDER_ADDRESS, payload.get("from"));
            assertEquals(RECIPIENT_ADDRESS, payload.get("to"));
            assertEquals("1000000", payload.get("amount"));
            assertEquals(CONTRACT_ADDRESS, payload.get("contractAddress"));
            assertEquals(0, payload.get("tokenId"));
        }

        @Test
        @DisplayName("should parse CAIP-19 asset identifier")
        void testParseAssetIdentifier() {
            Map<String, Object> parsed = ExactDirectTezosClientScheme.parseAssetIdentifier(
                "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0"
            );
            assertEquals("KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o", parsed.get("contractAddress"));
            assertEquals(0, parsed.get("tokenId"));
        }

        @Test
        @DisplayName("should reject invalid requirements")
        void testInvalidRequirements() {
            Map<String, Object> noPayTo = new HashMap<>();
            noPayTo.put("network", TezosConstants.TEZOS_MAINNET);
            noPayTo.put("maxAmountRequired", "1000000");
            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(noPayTo));

            Map<String, Object> badNetwork = new HashMap<>();
            badNetwork.put("network", "eip155:1");
            badNetwork.put("payTo", RECIPIENT_ADDRESS);
            badNetwork.put("maxAmountRequired", "1000000");
            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(badNetwork));
        }

        private Map<String, Object> createClientRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", TezosConstants.TEZOS_MAINNET);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "tezos:NetXdQprcVkpaWU/fa2:" + CONTRACT_ADDRESS + "/0");
            return requirements;
        }
    }

    @Nested
    @DisplayName("ExactDirectTezosFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorTezosSigner mockSigner;
        private ExactDirectTezosFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorTezosSigner();
            Map<String, String> addresses = new HashMap<>();
            addresses.put(TezosConstants.TEZOS_MAINNET, RECIPIENT_ADDRESS);
            scheme = new ExactDirectTezosFacilitatorScheme(mockSigner, addresses);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactDirectTezosFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(TezosConstants.TEZOS_MAINNET);
            assertEquals(1, signers.size());
            assertEquals(RECIPIENT_ADDRESS, signers.get(0));

            List<String> noSigners = scheme.getSigners("tezos:unknown");
            assertTrue(noSigners.isEmpty());
        }

        @Test
        @DisplayName("should verify valid payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // Set up mock to return a valid operation
            mockSigner.setOperation(createAppliedOperation());

            ExactDirectTezosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertEquals(SENDER_ADDRESS, result.payer);
        }

        @Test
        @DisplayName("should reject invalid payload structure")
        void testVerifyInvalidPayloadStructure() {
            Map<String, Object> payload = new HashMap<>();
            // Missing "payload" key

            Map<String, Object> requirements = createValidRequirements();

            ExactDirectTezosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        @Test
        @DisplayName("should reject operation not found")
        void testVerifyOperationNotFound() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setOperation(null);

            ExactDirectTezosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("operation_not_found"));
        }

        @Test
        @DisplayName("should reject non-applied operation")
        void testVerifyFailedOperation() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            Map<String, Object> failedOp = createAppliedOperation();
            failedOp.put("status", "failed");
            mockSigner.setOperation(failedOp);

            ExactDirectTezosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("operation_status_not_applied"));
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than transferred

            Map<String, Object> op = createAppliedOperation();
            mockSigner.setOperation(op);

            ExactDirectTezosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("amount_insufficient"));
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setOperation(createAppliedOperation());

            ExactDirectTezosFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertEquals(SAMPLE_OP_HASH, result.transaction);
            assertEquals(SENDER_ADDRESS, result.payer);
            assertEquals(TezosConstants.TEZOS_MAINNET, result.network);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = new HashMap<>(); // Missing payload key
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectTezosFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertNotNull(result.errorReason);
        }

        @Test
        @DisplayName("should reject payload with wrong recipient")
        void testVerifyWrongRecipient() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            // Change payTo to a different address
            requirements.put("payTo", "tz1burnburnburnburnburnburnburjAYjjX");

            Map<String, Object> op = createAppliedOperation();
            mockSigner.setOperation(op);

            ExactDirectTezosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("recipient_mismatch"));
        }

        @Test
        @DisplayName("should reject payload with wrong contract address")
        void testVerifyWrongContractAddress() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            // Change the asset to point to a different contract
            requirements.put("asset", "tezos:NetXdQprcVkpaWU/fa2:KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn/0");

            Map<String, Object> op = createAppliedOperation();
            mockSigner.setOperation(op);

            ExactDirectTezosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("contract_mismatch"));
        }

        @Test
        @DisplayName("should verify asynchronously via CompletableFuture")
        void testVerifyAsync() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setOperation(createAppliedOperation());

            CompletableFuture<ExactDirectTezosFacilitatorScheme.VerificationResult> future =
                scheme.verify(payload, requirements);

            assertNotNull(future);
            ExactDirectTezosFacilitatorScheme.VerificationResult result = future.join();
            assertTrue(result.isValid);
            assertEquals(SENDER_ADDRESS, result.payer);
        }

        @Test
        @DisplayName("should settle asynchronously via CompletableFuture")
        void testSettleAsync() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setOperation(createAppliedOperation());

            CompletableFuture<ExactDirectTezosFacilitatorScheme.SettlementResult> future =
                scheme.settle(payload, requirements);

            assertNotNull(future);
            ExactDirectTezosFacilitatorScheme.SettlementResult result = future.join();
            assertTrue(result.success);
            assertEquals(SAMPLE_OP_HASH, result.transaction);
            assertEquals(SENDER_ADDRESS, result.payer);
        }

        private Map<String, Object> createValidPayload() {
            Map<String, Object> inner = new HashMap<>();
            inner.put("opHash", SAMPLE_OP_HASH);
            inner.put("from", SENDER_ADDRESS);
            inner.put("to", RECIPIENT_ADDRESS);
            inner.put("amount", "1000000");
            inner.put("contractAddress", CONTRACT_ADDRESS);
            inner.put("tokenId", 0);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact-direct");
            payload.put("network", TezosConstants.TEZOS_MAINNET);
            payload.put("payload", inner);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact-direct");
            requirements.put("network", TezosConstants.TEZOS_MAINNET);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "tezos:NetXdQprcVkpaWU/fa2:" + CONTRACT_ADDRESS + "/0");
            return requirements;
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> createAppliedOperation() {
            // Build FA2 transfer parameter structure
            Map<String, Object> tx = new HashMap<>();
            tx.put("to_", RECIPIENT_ADDRESS);
            tx.put("token_id", 0);
            tx.put("amount", "1000000");

            Map<String, Object> batch = new HashMap<>();
            batch.put("from_", SENDER_ADDRESS);
            batch.put("txs", List.of(tx));

            Map<String, Object> sender = new HashMap<>();
            sender.put("address", SENDER_ADDRESS);

            Map<String, Object> target = new HashMap<>();
            target.put("address", CONTRACT_ADDRESS);

            Map<String, Object> operation = new HashMap<>();
            operation.put("status", "applied");
            operation.put("entrypoint", "transfer");
            operation.put("sender", sender);
            operation.put("target", target);
            operation.put("parameter", List.of(batch));

            return operation;
        }
    }

    @Nested
    @DisplayName("TezosSchemes Factory")
    class SchemesFactoryTest {

        @Test
        @DisplayName("should create client")
        void testCreateClient() {
            MockClientTezosSigner mockSigner = new MockClientTezosSigner(SENDER_ADDRESS, SAMPLE_OP_HASH);
            ExactDirectTezosClientScheme client = TezosSchemes.createClient(mockSigner);
            assertNotNull(client);
            assertEquals(SENDER_ADDRESS, client.getAddress());
        }

        @Test
        @DisplayName("should throw for null signer on createClient")
        void testCreateClientNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                TezosSchemes.createClient(null));
        }

        @Test
        @DisplayName("should create server with defaults")
        void testCreateServer() {
            ExactDirectTezosServerScheme server = TezosSchemes.createServer();
            assertNotNull(server);
            assertEquals(TezosConstants.TEZOS_MAINNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create server with ghostnet")
        void testCreateServerWithNetwork() {
            ExactDirectTezosServerScheme server = TezosSchemes.createServer(TezosConstants.TEZOS_GHOSTNET);
            assertNotNull(server);
            assertEquals(TezosConstants.TEZOS_GHOSTNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create facilitator")
        void testCreateFacilitator() {
            MockFacilitatorTezosSigner mockSigner = new MockFacilitatorTezosSigner();
            ExactDirectTezosFacilitatorScheme facilitator = TezosSchemes.createFacilitator(mockSigner);
            assertNotNull(facilitator);
        }

        @Test
        @DisplayName("should create facilitator with addresses")
        void testCreateFacilitatorWithAddresses() {
            MockFacilitatorTezosSigner mockSigner = new MockFacilitatorTezosSigner();
            Map<String, String> addresses = new HashMap<>();
            addresses.put(TezosConstants.TEZOS_MAINNET, RECIPIENT_ADDRESS);
            ExactDirectTezosFacilitatorScheme facilitator =
                TezosSchemes.createFacilitator(mockSigner, addresses);
            assertNotNull(facilitator);
            List<String> signers = facilitator.getSigners(TezosConstants.TEZOS_MAINNET);
            assertEquals(1, signers.size());
            assertEquals(RECIPIENT_ADDRESS, signers.get(0));
        }

        @Test
        @DisplayName("should return correct scheme identifier")
        void testGetScheme() {
            assertEquals("exact-direct", TezosSchemes.getScheme());
        }

        @Test
        @DisplayName("should delegate isValidNetwork to TezosConstants")
        void testIsValidNetwork() {
            assertTrue(TezosSchemes.isValidNetwork(TezosConstants.TEZOS_MAINNET));
            assertTrue(TezosSchemes.isValidNetwork(TezosConstants.TEZOS_GHOSTNET));
            assertFalse(TezosSchemes.isValidNetwork("eip155:1"));
            assertFalse(TezosSchemes.isValidNetwork(null));
        }

        @Test
        @DisplayName("should have both networks in SUPPORTED_NETWORKS")
        void testSupportedNetworks() {
            assertTrue(TezosSchemes.SUPPORTED_NETWORKS.contains(TezosConstants.TEZOS_MAINNET));
            assertTrue(TezosSchemes.SUPPORTED_NETWORKS.contains(TezosConstants.TEZOS_GHOSTNET));
            assertEquals(2, TezosSchemes.SUPPORTED_NETWORKS.size());
        }

        @Test
        @DisplayName("should have correct NETWORK_PATTERN")
        void testNetworkPattern() {
            assertEquals("tezos:*", TezosSchemes.NETWORK_PATTERN);
        }
    }

    // ============================================================
    // Mock implementations
    // ============================================================

    static class MockClientTezosSigner implements ClientTezosSigner {
        private final String address;
        private final String opHash;

        MockClientTezosSigner(String address, String opHash) {
            this.address = address;
            this.opHash = opHash;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> transferFA2(
                String contract, int tokenId, String to, String amount, String network) {
            return CompletableFuture.completedFuture(opHash);
        }
    }

    static class MockFacilitatorTezosSigner implements FacilitatorTezosSigner {
        private Map<String, Object> operation;

        void setOperation(Map<String, Object> operation) {
            this.operation = operation;
        }

        @Override
        public CompletableFuture<Map<String, Object>> getOperation(String opHash, String network) {
            return CompletableFuture.completedFuture(operation);
        }
    }
}
