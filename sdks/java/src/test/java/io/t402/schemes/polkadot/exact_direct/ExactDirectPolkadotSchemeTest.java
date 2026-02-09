package io.t402.schemes.polkadot.exact_direct;

import io.t402.schemes.polkadot.*;

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
 * Tests for Polkadot exact-direct scheme implementations.
 */
@DisplayName("Exact-Direct Polkadot Schemes")
class ExactDirectPolkadotSchemeTest {

    // Valid SS58 addresses (47 characters, Base58)
    private static final String SENDER_ADDRESS =
        "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
    private static final String RECIPIENT_ADDRESS =
        "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty";

    // Valid extrinsic hash (0x + 64 hex chars)
    private static final String SAMPLE_EXTRINSIC_HASH =
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    private static final String SAMPLE_BLOCK_HASH =
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

    @Nested
    @DisplayName("PolkadotConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should validate correct SS58 addresses")
        void testValidSS58Addresses() {
            assertTrue(PolkadotConstants.isValidSS58Address(SENDER_ADDRESS));
            assertTrue(PolkadotConstants.isValidSS58Address(RECIPIENT_ADDRESS));
        }

        @Test
        @DisplayName("should reject invalid SS58 addresses")
        void testInvalidSS58Addresses() {
            assertFalse(PolkadotConstants.isValidSS58Address(null));
            assertFalse(PolkadotConstants.isValidSS58Address(""));
            assertFalse(PolkadotConstants.isValidSS58Address("short"));
            assertFalse(PolkadotConstants.isValidSS58Address("0x1234567890abcdef")); // Ethereum-style
        }

        @Test
        @DisplayName("should validate correct hashes")
        void testValidHashes() {
            assertTrue(PolkadotConstants.isValidHash(SAMPLE_EXTRINSIC_HASH));
            assertTrue(PolkadotConstants.isValidHash(SAMPLE_BLOCK_HASH));
        }

        @Test
        @DisplayName("should reject invalid hashes")
        void testInvalidHashes() {
            assertFalse(PolkadotConstants.isValidHash(null));
            assertFalse(PolkadotConstants.isValidHash(""));
            assertFalse(PolkadotConstants.isValidHash("not-a-hash"));
            assertFalse(PolkadotConstants.isValidHash("0x123")); // Too short
            assertFalse(PolkadotConstants.isValidHash("abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")); // Missing 0x
        }

        @Test
        @DisplayName("should normalize network identifiers")
        void testNormalizeNetwork() {
            assertEquals(PolkadotConstants.POLKADOT_ASSET_HUB, PolkadotConstants.normalizeNetwork("polkadot"));
            assertEquals(PolkadotConstants.POLKADOT_ASSET_HUB, PolkadotConstants.normalizeNetwork("asset-hub"));
            assertEquals(PolkadotConstants.WESTEND_ASSET_HUB, PolkadotConstants.normalizeNetwork("westend"));
            assertEquals(PolkadotConstants.POLKADOT_ASSET_HUB, PolkadotConstants.normalizeNetwork(null));
            assertEquals("polkadot:custom", PolkadotConstants.normalizeNetwork("polkadot:custom"));
        }

        @Test
        @DisplayName("should validate network identifiers")
        void testValidNetwork() {
            assertTrue(PolkadotConstants.isValidNetwork(PolkadotConstants.POLKADOT_ASSET_HUB));
            assertTrue(PolkadotConstants.isValidNetwork(PolkadotConstants.WESTEND_ASSET_HUB));
            assertFalse(PolkadotConstants.isValidNetwork("eip155:1"));
            assertFalse(PolkadotConstants.isValidNetwork(null));
        }

        @Test
        @DisplayName("should create asset identifiers")
        void testCreateAssetIdentifier() {
            String asset = PolkadotConstants.createAssetIdentifier(
                PolkadotConstants.POLKADOT_ASSET_HUB, 1984);
            assertEquals("polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984", asset);
        }

        @Test
        @DisplayName("should parse asset identifiers")
        void testParseAssetIdentifier() {
            assertEquals(1984, PolkadotConstants.parseAssetIdentifier(
                "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984"));
            assertEquals(-1, PolkadotConstants.parseAssetIdentifier("invalid"));
            assertEquals(-1, PolkadotConstants.parseAssetIdentifier(null));
        }

        @Test
        @DisplayName("should check isSupportedNetwork correctly")
        void testIsSupportedNetwork() {
            assertTrue(PolkadotConstants.isSupportedNetwork(PolkadotConstants.POLKADOT_ASSET_HUB));
            assertTrue(PolkadotConstants.isSupportedNetwork(PolkadotConstants.WESTEND_ASSET_HUB));
            assertFalse(PolkadotConstants.isSupportedNetwork("polkadot:custom"));
            // null normalizes to POLKADOT_ASSET_HUB, so isSupportedNetwork(null) is true
            assertTrue(PolkadotConstants.isSupportedNetwork(null));
            // Aliases resolve to supported networks
            assertTrue(PolkadotConstants.isSupportedNetwork("polkadot"));
            assertTrue(PolkadotConstants.isSupportedNetwork("westend"));
            // Non-polkadot network
            assertFalse(PolkadotConstants.isSupportedNetwork("eip155:1"));
        }

        @Test
        @DisplayName("should get USDT asset ID for any network")
        void testGetUsdtAssetId() {
            assertEquals(1984, PolkadotConstants.getUsdtAssetId(PolkadotConstants.POLKADOT_ASSET_HUB));
            assertEquals(1984, PolkadotConstants.getUsdtAssetId(PolkadotConstants.WESTEND_ASSET_HUB));
            assertEquals(1984, PolkadotConstants.getUsdtAssetId("any-network"));
        }

        @Test
        @DisplayName("should get indexer URL for supported networks")
        void testGetIndexerUrl() {
            assertEquals(PolkadotConstants.POLKADOT_ASSET_HUB_INDEXER,
                PolkadotConstants.getIndexerUrl(PolkadotConstants.POLKADOT_ASSET_HUB));
            assertEquals(PolkadotConstants.WESTEND_ASSET_HUB_INDEXER,
                PolkadotConstants.getIndexerUrl(PolkadotConstants.WESTEND_ASSET_HUB));
            assertThrows(IllegalArgumentException.class, () ->
                PolkadotConstants.getIndexerUrl("polkadot:unsupported"));
        }

        @Test
        @DisplayName("should parse asset identifier edge cases")
        void testParseAssetIdentifier_EdgeCases() {
            assertEquals(-1, PolkadotConstants.parseAssetIdentifier(""));
            assertEquals(-1, PolkadotConstants.parseAssetIdentifier("polkadot:68d56f15f85d3136970ec16946040bc1"));
            assertEquals(-1, PolkadotConstants.parseAssetIdentifier("/asset:notanumber"));
        }

        @Test
        @DisplayName("should validate SS58 address edge cases")
        void testSS58Validation_EdgeCases() {
            // 44 chars (too short for 45-50 range)
            assertFalse(PolkadotConstants.isValidSS58Address(
                "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGK"));
            // 51 chars (too long for 45-50 range)
            assertFalse(PolkadotConstants.isValidSS58Address(
                "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQYxyz"));
            // Invalid Base58 char '0' at start (48 chars but with invalid char)
            assertFalse(PolkadotConstants.isValidSS58Address(
                "0GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"));
            // Invalid Base58 char 'O' (capital O)
            assertFalse(PolkadotConstants.isValidSS58Address(
                "5OrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"));
        }

        @Test
        @DisplayName("should have correct constant values")
        void testConstantValues() {
            assertEquals("exact-direct", PolkadotConstants.SCHEME_EXACT_DIRECT);
            assertEquals("polkadot:*", PolkadotConstants.CAIP_FAMILY);
            assertEquals(6, PolkadotConstants.USDT_DECIMALS);
            assertEquals(1984, PolkadotConstants.USDT_ASSET_ID);
            assertEquals(300, PolkadotConstants.DEFAULT_VALIDITY_DURATION);
        }
    }

    @Nested
    @DisplayName("ExactDirectPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build and serialize payload")
        void testBuildPayload() {
            ExactDirectPayload payload = ExactDirectPayload.builder()
                .extrinsicHash(SAMPLE_EXTRINSIC_HASH)
                .blockHash(SAMPLE_BLOCK_HASH)
                .extrinsicIndex(2)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1000000")
                .assetId(1984)
                .build();

            assertEquals(SAMPLE_EXTRINSIC_HASH, payload.getExtrinsicHash());
            assertEquals(SAMPLE_BLOCK_HASH, payload.getBlockHash());
            assertEquals(2, payload.getExtrinsicIndex());
            assertEquals(SENDER_ADDRESS, payload.getFrom());
            assertEquals(RECIPIENT_ADDRESS, payload.getTo());
            assertEquals("1000000", payload.getAmount());
            assertEquals(1984, payload.getAssetId());
        }

        @Test
        @DisplayName("should convert to/from map")
        void testToFromMap() {
            ExactDirectPayload original = ExactDirectPayload.builder()
                .extrinsicHash(SAMPLE_EXTRINSIC_HASH)
                .blockHash(SAMPLE_BLOCK_HASH)
                .extrinsicIndex(2)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1500000")
                .assetId(1984)
                .build();

            Map<String, Object> map = original.toMap();
            assertEquals(SAMPLE_EXTRINSIC_HASH, map.get("extrinsicHash"));
            assertEquals(SAMPLE_BLOCK_HASH, map.get("blockHash"));
            assertEquals(2, map.get("extrinsicIndex"));
            assertEquals(SENDER_ADDRESS, map.get("from"));
            assertEquals(RECIPIENT_ADDRESS, map.get("to"));
            assertEquals("1500000", map.get("amount"));
            assertEquals(1984, map.get("assetId"));

            ExactDirectPayload restored = ExactDirectPayload.fromMap(map);
            assertEquals(original.getExtrinsicHash(), restored.getExtrinsicHash());
            assertEquals(original.getBlockHash(), restored.getBlockHash());
            assertEquals(original.getExtrinsicIndex(), restored.getExtrinsicIndex());
            assertEquals(original.getFrom(), restored.getFrom());
            assertEquals(original.getTo(), restored.getTo());
            assertEquals(original.getAmount(), restored.getAmount());
            assertEquals(original.getAssetId(), restored.getAssetId());
        }

        @Test
        @DisplayName("should reject missing required fields")
        void testMissingFields() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .from(SENDER_ADDRESS)
                    .to(RECIPIENT_ADDRESS)
                    .amount("1000000")
                    .assetId(1984)
                    .build()); // Missing extrinsicHash

            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .extrinsicHash(SAMPLE_EXTRINSIC_HASH)
                    .to(RECIPIENT_ADDRESS)
                    .amount("1000000")
                    .assetId(1984)
                    .build()); // Missing from
        }

        @Test
        @DisplayName("should reject missing to address")
        void testBuilderMissingTo() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .extrinsicHash(SAMPLE_EXTRINSIC_HASH)
                    .from(SENDER_ADDRESS)
                    .amount("1000000")
                    .assetId(1984)
                    .build());
        }

        @Test
        @DisplayName("should reject missing amount")
        void testBuilderMissingAmount() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .extrinsicHash(SAMPLE_EXTRINSIC_HASH)
                    .from(SENDER_ADDRESS)
                    .to(RECIPIENT_ADDRESS)
                    .assetId(1984)
                    .build());
        }

        @Test
        @DisplayName("should handle snake_case keys in fromMap")
        void testFromMapWithSnakeCaseKeys() {
            Map<String, Object> map = new HashMap<>();
            map.put("extrinsic_hash", SAMPLE_EXTRINSIC_HASH);
            map.put("block_hash", SAMPLE_BLOCK_HASH);
            map.put("extrinsic_index", 3);
            map.put("from_address", SENDER_ADDRESS);
            map.put("to_address", RECIPIENT_ADDRESS);
            map.put("amount", "2000000");
            map.put("asset_id", 1984);

            ExactDirectPayload payload = ExactDirectPayload.fromMap(map);
            assertEquals(SAMPLE_EXTRINSIC_HASH, payload.getExtrinsicHash());
            assertEquals(SAMPLE_BLOCK_HASH, payload.getBlockHash());
            assertEquals(3, payload.getExtrinsicIndex());
            assertEquals(SENDER_ADDRESS, payload.getFrom());
            assertEquals(RECIPIENT_ADDRESS, payload.getTo());
            assertEquals("2000000", payload.getAmount());
            assertEquals(1984, payload.getAssetId());
        }

        @Test
        @DisplayName("should handle string numbers in fromMap")
        void testFromMapWithStringNumbers() {
            Map<String, Object> map = new HashMap<>();
            map.put("extrinsicHash", SAMPLE_EXTRINSIC_HASH);
            map.put("blockHash", SAMPLE_BLOCK_HASH);
            map.put("extrinsicIndex", "5");
            map.put("from", SENDER_ADDRESS);
            map.put("to", RECIPIENT_ADDRESS);
            map.put("amount", "1000000");
            map.put("assetId", "1984");

            ExactDirectPayload payload = ExactDirectPayload.fromMap(map);
            assertEquals(5, payload.getExtrinsicIndex());
            assertEquals(1984, payload.getAssetId());
        }
    }

    @Nested
    @DisplayName("ExactDirectPolkadotServerScheme")
    class ServerSchemeTest {

        private ExactDirectPolkadotServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactDirectPolkadotServerScheme();
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", PolkadotConstants.POLKADOT_ASSET_HUB);

            assertEquals("1500000", result.get("amount"));
            assertTrue(((String) result.get("asset")).contains("/asset:1984"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDT", result.get("symbol"));
            assertEquals(1984, result.get("assetId"));
        }

        @Test
        @DisplayName("should parse dollar-prefixed price")
        void testParsePriceDollar() {
            Map<String, Object> result = scheme.parsePrice("$0.10", PolkadotConstants.POLKADOT_ASSET_HUB);

            assertEquals("100000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse atomic amount")
        void testParsePriceAtomic() {
            Map<String, Object> result = scheme.parsePrice("1500000", PolkadotConstants.POLKADOT_ASSET_HUB);

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
                PolkadotConstants.POLKADOT_ASSET_HUB,
                RECIPIENT_ADDRESS,
                "1000000",
                1984,
                300
            );

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(PolkadotConstants.POLKADOT_ASSET_HUB, requirements.get("network"));
            assertEquals(RECIPIENT_ADDRESS, requirements.get("payTo"));
            assertEquals("1000000", requirements.get("maxAmountRequired"));
            assertEquals(300, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact-direct");
            valid.put("network", PolkadotConstants.POLKADOT_ASSET_HUB);
            valid.put("payTo", RECIPIENT_ADDRESS);

            assertTrue(scheme.validateRequirements(valid));

            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "exact");
            wrongScheme.put("network", PolkadotConstants.POLKADOT_ASSET_HUB);
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
            assertEquals(PolkadotConstants.POLKADOT_ASSET_HUB, requirements.get("network"));
            assertEquals(RECIPIENT_ADDRESS, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertEquals("Test API", requirements.get("resource"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertNotNull(extra);
            assertEquals(1984, extra.get("assetId"));
            assertEquals("USDT", extra.get("assetSymbol"));
            assertEquals(6, extra.get("assetDecimals"));
        }

        @Test
        @DisplayName("should use Westend Asset Hub network")
        void testWestendNetwork() {
            ExactDirectPolkadotServerScheme westendScheme =
                new ExactDirectPolkadotServerScheme(PolkadotConstants.WESTEND_ASSET_HUB);

            assertEquals(PolkadotConstants.WESTEND_ASSET_HUB, westendScheme.getDefaultNetwork());
        }
    }

    @Nested
    @DisplayName("ExactDirectPolkadotClientScheme")
    class ClientSchemeTest {

        private MockClientPolkadotSigner mockSigner;
        private ExactDirectPolkadotClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientPolkadotSigner(SENDER_ADDRESS);
            scheme = new ExactDirectPolkadotClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SENDER_ADDRESS, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactDirectPolkadotClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePayloadSync() {
            Map<String, Object> requirements = createClientRequirements();

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("exact-direct", result.get("scheme"));
            assertEquals(PolkadotConstants.POLKADOT_ASSET_HUB, result.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.get("payload");
            assertNotNull(payload);
            assertEquals(SAMPLE_EXTRINSIC_HASH, payload.get("extrinsicHash"));
            assertEquals(SAMPLE_BLOCK_HASH, payload.get("blockHash"));
            assertEquals(2, payload.get("extrinsicIndex"));
            assertEquals(SENDER_ADDRESS, payload.get("from"));
            assertEquals(RECIPIENT_ADDRESS, payload.get("to"));
            assertEquals("1000000", payload.get("amount"));
            assertEquals(1984, payload.get("assetId"));
        }

        @Test
        @DisplayName("should reject invalid requirements")
        void testInvalidRequirements() {
            Map<String, Object> noPayTo = new HashMap<>();
            noPayTo.put("network", PolkadotConstants.POLKADOT_ASSET_HUB);
            noPayTo.put("maxAmountRequired", "1000000");
            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(noPayTo));

            Map<String, Object> badNetwork = new HashMap<>();
            badNetwork.put("network", "eip155:1");
            badNetwork.put("payTo", RECIPIENT_ADDRESS);
            badNetwork.put("maxAmountRequired", "1000000");
            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(badNetwork));

            Map<String, Object> zeroAmount = new HashMap<>();
            zeroAmount.put("network", PolkadotConstants.POLKADOT_ASSET_HUB);
            zeroAmount.put("payTo", RECIPIENT_ADDRESS);
            zeroAmount.put("maxAmountRequired", "0");
            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(zeroAmount));
        }

        private Map<String, Object> createClientRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", PolkadotConstants.POLKADOT_ASSET_HUB);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984");
            return requirements;
        }
    }

    @Nested
    @DisplayName("ExactDirectPolkadotFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorPolkadotSigner mockSigner;
        private ExactDirectPolkadotFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorPolkadotSigner();
            Map<String, List<String>> addresses = new HashMap<>();
            addresses.put(PolkadotConstants.POLKADOT_ASSET_HUB, List.of(RECIPIENT_ADDRESS));
            scheme = new ExactDirectPolkadotFacilitatorScheme(mockSigner, addresses);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactDirectPolkadotFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(PolkadotConstants.POLKADOT_ASSET_HUB);
            assertEquals(1, signers.size());
            assertEquals(RECIPIENT_ADDRESS, signers.get(0));

            List<String> noSigners = scheme.getSigners("polkadot:unknown");
            assertTrue(noSigners.isEmpty());
        }

        @Test
        @DisplayName("should get extra with asset metadata")
        void testGetExtra() {
            Map<String, Object> extra = scheme.getExtra(PolkadotConstants.POLKADOT_ASSET_HUB);
            assertNotNull(extra);
            assertEquals(1984, extra.get("assetId"));
            assertEquals("USDT", extra.get("assetSymbol"));
            assertEquals(6, extra.get("assetDecimals"));
        }

        @Test
        @DisplayName("should verify valid payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setExtrinsicData(createSuccessfulExtrinsic());

            ExactDirectPolkadotFacilitatorScheme.VerificationResult result =
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

            ExactDirectPolkadotFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        @Test
        @DisplayName("should reject extrinsic not found")
        void testVerifyExtrinsicNotFound() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setExtrinsicData(null);

            ExactDirectPolkadotFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("extrinsic_not_found", result.invalidReason);
        }

        @Test
        @DisplayName("should reject failed extrinsic")
        void testVerifyFailedExtrinsic() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            Map<String, Object> failedExt = createSuccessfulExtrinsic();
            failedExt.put("success", false);
            mockSigner.setExtrinsicData(failedExt);

            ExactDirectPolkadotFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("extrinsic_failed", result.invalidReason);
        }

        @Test
        @DisplayName("should reject wrong module")
        void testVerifyWrongModule() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            Map<String, Object> wrongModule = createSuccessfulExtrinsic();
            wrongModule.put("call_module", "Balances");
            mockSigner.setExtrinsicData(wrongModule);

            ExactDirectPolkadotFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("invalid_module"));
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than transferred

            mockSigner.setExtrinsicData(createSuccessfulExtrinsic());

            ExactDirectPolkadotFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("amount_insufficient"));
        }

        @Test
        @DisplayName("should reject wrong asset ID")
        void testVerifyWrongAssetId() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("asset", "polkadot:68d56f15f85d3136970ec16946040bc1/asset:9999");

            mockSigner.setExtrinsicData(createSuccessfulExtrinsic());

            ExactDirectPolkadotFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("asset_id_mismatch"));
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setExtrinsicData(createSuccessfulExtrinsic());

            ExactDirectPolkadotFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertEquals(SAMPLE_EXTRINSIC_HASH, result.transaction);
            assertEquals(SENDER_ADDRESS, result.payer);
            assertEquals(PolkadotConstants.POLKADOT_ASSET_HUB, result.network);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = new HashMap<>(); // Missing payload key
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectPolkadotFacilitatorScheme.SettlementResult result =
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
            requirements.put("payTo", "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy");

            mockSigner.setExtrinsicData(createSuccessfulExtrinsic());

            ExactDirectPolkadotFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("recipient_mismatch"));
        }

        @Test
        @DisplayName("should reject payload with wrong sender")
        void testVerifyWrongSender() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // Create extrinsic with a different account_id
            Map<String, Object> ext = createSuccessfulExtrinsic();
            ext.put("account_id", "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy");
            mockSigner.setExtrinsicData(ext);

            ExactDirectPolkadotFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("sender_mismatch"));
        }

        @Test
        @DisplayName("should verify asynchronously via CompletableFuture")
        void testVerifyAsync() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setExtrinsicData(createSuccessfulExtrinsic());

            CompletableFuture<ExactDirectPolkadotFacilitatorScheme.VerificationResult> future =
                scheme.verify(payload, requirements);

            assertNotNull(future);
            ExactDirectPolkadotFacilitatorScheme.VerificationResult result = future.join();
            assertTrue(result.isValid);
            assertEquals(SENDER_ADDRESS, result.payer);
        }

        @Test
        @DisplayName("should settle asynchronously via CompletableFuture")
        void testSettleAsync() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setExtrinsicData(createSuccessfulExtrinsic());

            CompletableFuture<ExactDirectPolkadotFacilitatorScheme.SettlementResult> future =
                scheme.settle(payload, requirements);

            assertNotNull(future);
            ExactDirectPolkadotFacilitatorScheme.SettlementResult result = future.join();
            assertTrue(result.success);
            assertEquals(SAMPLE_EXTRINSIC_HASH, result.transaction);
            assertEquals(SENDER_ADDRESS, result.payer);
        }

        private Map<String, Object> createValidPayload() {
            Map<String, Object> inner = new HashMap<>();
            inner.put("extrinsicHash", SAMPLE_EXTRINSIC_HASH);
            inner.put("blockHash", SAMPLE_BLOCK_HASH);
            inner.put("extrinsicIndex", 2);
            inner.put("from", SENDER_ADDRESS);
            inner.put("to", RECIPIENT_ADDRESS);
            inner.put("amount", "1000000");
            inner.put("assetId", 1984);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact-direct");
            payload.put("network", PolkadotConstants.POLKADOT_ASSET_HUB);
            payload.put("payload", inner);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact-direct");
            requirements.put("network", PolkadotConstants.POLKADOT_ASSET_HUB);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984");
            return requirements;
        }

        private Map<String, Object> createSuccessfulExtrinsic() {
            List<Map<String, Object>> params = new ArrayList<>();

            Map<String, Object> assetIdParam = new HashMap<>();
            assetIdParam.put("name", "id");
            assetIdParam.put("value", 1984);
            params.add(assetIdParam);

            Map<String, Object> targetParam = new HashMap<>();
            targetParam.put("name", "target");
            targetParam.put("value", RECIPIENT_ADDRESS);
            params.add(targetParam);

            Map<String, Object> amountParam = new HashMap<>();
            amountParam.put("name", "amount");
            amountParam.put("value", "1000000");
            params.add(amountParam);

            Map<String, Object> extrinsic = new HashMap<>();
            extrinsic.put("extrinsic_hash", SAMPLE_EXTRINSIC_HASH);
            extrinsic.put("block_hash", SAMPLE_BLOCK_HASH);
            extrinsic.put("block_num", 12345);
            extrinsic.put("extrinsic_index", 2);
            extrinsic.put("success", true);
            extrinsic.put("account_id", SENDER_ADDRESS);
            extrinsic.put("call_module", "Assets");
            extrinsic.put("call_module_function", "transfer_keep_alive");
            extrinsic.put("params", params);

            return extrinsic;
        }
    }

    @Nested
    @DisplayName("PolkadotSchemes Factory")
    class SchemesFactoryTest {

        @Test
        @DisplayName("should create client")
        void testCreateClient() {
            MockClientPolkadotSigner mockSigner = new MockClientPolkadotSigner(SENDER_ADDRESS);
            ExactDirectPolkadotClientScheme client = PolkadotSchemes.createClient(mockSigner);
            assertNotNull(client);
            assertEquals(SENDER_ADDRESS, client.getAddress());
        }

        @Test
        @DisplayName("should throw for null signer on createClient")
        void testCreateClientNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                PolkadotSchemes.createClient(null));
        }

        @Test
        @DisplayName("should create server with defaults")
        void testCreateServer() {
            ExactDirectPolkadotServerScheme server = PolkadotSchemes.createServer();
            assertNotNull(server);
            assertEquals(PolkadotConstants.POLKADOT_ASSET_HUB, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create server with westend")
        void testCreateServerWithNetwork() {
            ExactDirectPolkadotServerScheme server =
                PolkadotSchemes.createServer(PolkadotConstants.WESTEND_ASSET_HUB);
            assertNotNull(server);
            assertEquals(PolkadotConstants.WESTEND_ASSET_HUB, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create facilitator")
        void testCreateFacilitator() {
            MockFacilitatorPolkadotSigner mockSigner = new MockFacilitatorPolkadotSigner();
            ExactDirectPolkadotFacilitatorScheme facilitator =
                PolkadotSchemes.createFacilitator(mockSigner);
            assertNotNull(facilitator);
        }

        @Test
        @DisplayName("should create facilitator with addresses")
        void testCreateFacilitatorWithAddresses() {
            MockFacilitatorPolkadotSigner mockSigner = new MockFacilitatorPolkadotSigner();
            Map<String, List<String>> addresses = new HashMap<>();
            addresses.put(PolkadotConstants.POLKADOT_ASSET_HUB, List.of(RECIPIENT_ADDRESS));
            ExactDirectPolkadotFacilitatorScheme facilitator =
                PolkadotSchemes.createFacilitator(mockSigner, addresses);
            assertNotNull(facilitator);
            List<String> signers = facilitator.getSigners(PolkadotConstants.POLKADOT_ASSET_HUB);
            assertEquals(1, signers.size());
            assertEquals(RECIPIENT_ADDRESS, signers.get(0));
        }

        @Test
        @DisplayName("should return correct scheme identifier")
        void testGetScheme() {
            assertEquals("exact-direct", PolkadotSchemes.getScheme());
        }

        @Test
        @DisplayName("should delegate isValidNetwork to PolkadotConstants")
        void testIsValidNetwork() {
            assertTrue(PolkadotSchemes.isValidNetwork(PolkadotConstants.POLKADOT_ASSET_HUB));
            assertTrue(PolkadotSchemes.isValidNetwork(PolkadotConstants.WESTEND_ASSET_HUB));
            assertFalse(PolkadotSchemes.isValidNetwork("eip155:1"));
            assertFalse(PolkadotSchemes.isValidNetwork(null));
        }

        @Test
        @DisplayName("should have both networks in SUPPORTED_NETWORKS")
        void testSupportedNetworks() {
            assertTrue(PolkadotSchemes.SUPPORTED_NETWORKS.contains(PolkadotConstants.POLKADOT_ASSET_HUB));
            assertTrue(PolkadotSchemes.SUPPORTED_NETWORKS.contains(PolkadotConstants.WESTEND_ASSET_HUB));
            assertEquals(2, PolkadotSchemes.SUPPORTED_NETWORKS.size());
        }

        @Test
        @DisplayName("should have correct NETWORK_PATTERN")
        void testNetworkPattern() {
            assertEquals("polkadot:*", PolkadotSchemes.NETWORK_PATTERN);
        }
    }

    // ============================================================
    // Mock implementations
    // ============================================================

    static class MockClientPolkadotSigner implements ClientPolkadotSigner {
        private final String address;

        MockClientPolkadotSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<Map<String, Object>> signAndSubmit(
                Map<String, Object> call, String network) {
            Map<String, Object> result = new HashMap<>();
            result.put("extrinsicHash", SAMPLE_EXTRINSIC_HASH);
            result.put("blockHash", SAMPLE_BLOCK_HASH);
            result.put("extrinsicIndex", 2);
            return CompletableFuture.completedFuture(result);
        }
    }

    static class MockFacilitatorPolkadotSigner implements FacilitatorPolkadotSigner {
        private Map<String, Object> extrinsicData;

        void setExtrinsicData(Map<String, Object> data) {
            this.extrinsicData = data;
        }

        @Override
        public CompletableFuture<Map<String, Object>> getExtrinsic(
                String extrinsicHash, String network) {
            return CompletableFuture.completedFuture(extrinsicData);
        }
    }
}
