package io.t402.schemes.btc.exact;

import io.t402.schemes.btc.*;
import io.t402.schemes.btc.lightning.LightningClientScheme;
import io.t402.schemes.btc.lightning.LightningFacilitatorScheme;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for BTC and Lightning payment scheme implementations.
 */
@DisplayName("BTC Payment Schemes")
class ExactBtcSchemeTest {

    private static final String BTC_ADDRESS_MAINNET = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4";
    private static final String BTC_ADDRESS_TESTNET = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
    private static final String SAMPLE_SIGNED_PSBT = "cHNidP8BAFUCAAAAAc5Gxkr9wL6CPTM=";
    private static final String FACILITATOR_ADDRESS = "bc1qfacilitator1234567890abcdef";
    // Sample preimage (32 bytes hex)
    private static final String SAMPLE_PREIMAGE = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Nested
    @DisplayName("BtcConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should identify Bitcoin on-chain networks")
        void testIsBtcNetwork() {
            assertTrue(BtcConstants.isBtcNetwork(BtcConstants.BTC_MAINNET));
            assertTrue(BtcConstants.isBtcNetwork(BtcConstants.BTC_TESTNET));
            assertFalse(BtcConstants.isBtcNetwork("lightning:mainnet"));
            assertFalse(BtcConstants.isBtcNetwork("eip155:1"));
            assertFalse(BtcConstants.isBtcNetwork(null));
        }

        @Test
        @DisplayName("should identify Lightning networks")
        void testIsLightningNetwork() {
            assertTrue(BtcConstants.isLightningNetwork(BtcConstants.LIGHTNING_MAINNET));
            assertTrue(BtcConstants.isLightningNetwork(BtcConstants.LIGHTNING_TESTNET));
            assertFalse(BtcConstants.isLightningNetwork(BtcConstants.BTC_MAINNET));
            assertFalse(BtcConstants.isLightningNetwork(null));
        }

        @Test
        @DisplayName("should validate supported BTC networks")
        void testIsSupportedBtcNetwork() {
            assertTrue(BtcConstants.isSupportedBtcNetwork(BtcConstants.BTC_MAINNET));
            assertTrue(BtcConstants.isSupportedBtcNetwork(BtcConstants.BTC_TESTNET));
            assertFalse(BtcConstants.isSupportedBtcNetwork("bip122:unknown"));
        }

        @Test
        @DisplayName("should validate supported Lightning networks")
        void testIsSupportedLightningNetwork() {
            assertTrue(BtcConstants.isSupportedLightningNetwork(BtcConstants.LIGHTNING_MAINNET));
            assertTrue(BtcConstants.isSupportedLightningNetwork(BtcConstants.LIGHTNING_TESTNET));
            assertFalse(BtcConstants.isSupportedLightningNetwork("lightning:unknown"));
        }

        @Test
        @DisplayName("should validate Bitcoin mainnet addresses")
        void testValidateMainnetAddress() {
            assertTrue(BtcConstants.validateBitcoinAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"));
            assertTrue(BtcConstants.validateBitcoinAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"));
            assertTrue(BtcConstants.validateBitcoinAddress("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"));
            assertTrue(BtcConstants.isMainnetAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"));
        }

        @Test
        @DisplayName("should validate Bitcoin testnet addresses")
        void testValidateTestnetAddress() {
            assertTrue(BtcConstants.validateBitcoinAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"));
            assertTrue(BtcConstants.validateBitcoinAddress("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn"));
            assertTrue(BtcConstants.isTestnetAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"));
        }

        @Test
        @DisplayName("should reject invalid Bitcoin addresses")
        void testRejectInvalidAddress() {
            assertFalse(BtcConstants.validateBitcoinAddress(null));
            assertFalse(BtcConstants.validateBitcoinAddress(""));
            assertFalse(BtcConstants.validateBitcoinAddress("short"));
            assertFalse(BtcConstants.validateBitcoinAddress("invalid_address_format_not_matching"));
        }

        @Test
        @DisplayName("should validate BOLT11 invoices")
        void testValidateBolt11Invoice() {
            assertTrue(BtcConstants.validateBolt11Invoice(
                "lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq"));
            assertTrue(BtcConstants.validateBolt11Invoice(
                "lntb1pvjluezpp5qqqsyqcyq5rqwzqf"));
            assertTrue(BtcConstants.validateBolt11Invoice(
                "LNBC1pvjluezpp5qqqsyqcyq5rqwzqf")); // Case-insensitive
            assertFalse(BtcConstants.validateBolt11Invoice(null));
            assertFalse(BtcConstants.validateBolt11Invoice(""));
            assertFalse(BtcConstants.validateBolt11Invoice("not_an_invoice"));
        }

        @Test
        @DisplayName("should validate hex strings")
        void testIsValidHex() {
            assertTrue(BtcConstants.isValidHex("abcdef0123456789", 8));
            assertTrue(BtcConstants.isValidHex("ABCDEF", 3));
            assertTrue(BtcConstants.isValidHex("ff", 0)); // Any length
            assertFalse(BtcConstants.isValidHex(null, 0));
            assertFalse(BtcConstants.isValidHex("", 0));
            assertFalse(BtcConstants.isValidHex("xyz", 0));
            assertFalse(BtcConstants.isValidHex("ab", 2)); // 2 hex chars != 2 bytes
        }

        @Test
        @DisplayName("should have correct CAIP-2 identifiers")
        void testCaip2Identifiers() {
            assertEquals("bip122:000000000019d6689c085ae165831e93", BtcConstants.BTC_MAINNET);
            assertEquals("bip122:000000000933ea01ad0ee984209779ba", BtcConstants.BTC_TESTNET);
            assertEquals("lightning:mainnet", BtcConstants.LIGHTNING_MAINNET);
            assertEquals("lightning:testnet", BtcConstants.LIGHTNING_TESTNET);
        }

        @Test
        @DisplayName("should have correct constants")
        void testConstants() {
            assertEquals(546, BtcConstants.DUST_LIMIT);
            assertEquals(100_000_000L, BtcConstants.SATS_PER_BTC);
            assertEquals(8, BtcConstants.BTC_DECIMALS);
            assertEquals("BTC", BtcConstants.DEFAULT_ASSET);
        }
    }

    @Nested
    @DisplayName("PSBTPayload")
    class PayloadTest {

        @Test
        @DisplayName("should serialize and deserialize")
        void testRoundTrip() {
            PSBTPayload payload = new PSBTPayload(SAMPLE_SIGNED_PSBT, "txid123");
            Map<String, Object> map = payload.toMap();

            assertEquals(SAMPLE_SIGNED_PSBT, map.get("signedPsbt"));
            assertEquals("txid123", map.get("txId"));

            PSBTPayload restored = PSBTPayload.fromMap(map);
            assertEquals(SAMPLE_SIGNED_PSBT, restored.getSignedPsbt());
            assertEquals("txid123", restored.getTxId());
        }

        @Test
        @DisplayName("should omit null txId in map")
        void testOmitNullTxId() {
            PSBTPayload payload = new PSBTPayload(SAMPLE_SIGNED_PSBT);
            Map<String, Object> map = payload.toMap();

            assertEquals(SAMPLE_SIGNED_PSBT, map.get("signedPsbt"));
            assertFalse(map.containsKey("txId"));
        }
    }

    @Nested
    @DisplayName("LightningPayload")
    class LightningPayloadTest {

        @Test
        @DisplayName("should serialize and deserialize")
        void testRoundTrip() {
            LightningPayload payload = new LightningPayload("hash123", "preimage456", "lnbc...");
            Map<String, Object> map = payload.toMap();

            assertEquals("hash123", map.get("paymentHash"));
            assertEquals("preimage456", map.get("preimage"));
            assertEquals("lnbc...", map.get("bolt11Invoice"));

            LightningPayload restored = LightningPayload.fromMap(map);
            assertEquals("hash123", restored.getPaymentHash());
            assertEquals("preimage456", restored.getPreimage());
            assertEquals("lnbc...", restored.getBolt11Invoice());
        }
    }

    @Nested
    @DisplayName("ExactBtcServerScheme")
    class ServerSchemeTest {

        private ExactBtcServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactBtcServerScheme();
        }

        @Test
        @DisplayName("should parse decimal BTC price to satoshis")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("0.01", BtcConstants.BTC_MAINNET);

            assertEquals("1000000", result.get("amount"));
            assertEquals("BTC", result.get("asset"));
            assertEquals(8, result.get("decimals"));
            assertEquals("BTC", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse integer price as satoshis")
        void testParsePriceAtomic() {
            Map<String, Object> result = scheme.parsePrice("100000", BtcConstants.BTC_MAINNET);

            assertEquals("100000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse small decimal BTC")
        void testParsePriceSmallDecimal() {
            Map<String, Object> result = scheme.parsePrice("0.00000546", BtcConstants.BTC_MAINNET);

            assertEquals("546", result.get("amount"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "eip155:1"));
        }

        @Test
        @DisplayName("should create complete payment requirements")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "0.001", BTC_ADDRESS_MAINNET, "API Access"
            );

            assertEquals("exact", requirements.get("scheme"));
            assertEquals(BtcConstants.BTC_MAINNET, requirements.get("network"));
            assertEquals(BTC_ADDRESS_MAINNET, requirements.get("payTo"));
            assertEquals("100000", requirements.get("amount"));
            assertEquals("BTC", requirements.get("asset"));
            assertEquals(BtcConstants.DEFAULT_VALIDITY_DURATION, requirements.get("maxTimeoutSeconds"));
            assertEquals("API Access", requirements.get("resource"));
        }

        @Test
        @DisplayName("should create requirements with custom parameters")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                BtcConstants.BTC_TESTNET, BTC_ADDRESS_TESTNET, "546000", 7200
            );

            assertEquals("exact", requirements.get("scheme"));
            assertEquals(BtcConstants.BTC_TESTNET, requirements.get("network"));
            assertEquals(BTC_ADDRESS_TESTNET, requirements.get("payTo"));
            assertEquals("546000", requirements.get("amount"));
            assertEquals(7200, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact");
            valid.put("network", BtcConstants.BTC_MAINNET);
            valid.put("payTo", BTC_ADDRESS_MAINNET);
            assertTrue(scheme.validateRequirements(valid));

            // Wrong scheme
            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "upto");
            wrongScheme.put("network", BtcConstants.BTC_MAINNET);
            wrongScheme.put("payTo", BTC_ADDRESS_MAINNET);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-BTC network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", BTC_ADDRESS_MAINNET);
            assertFalse(scheme.validateRequirements(wrongNetwork));

            // Invalid address
            Map<String, Object> badAddress = new HashMap<>();
            badAddress.put("scheme", "exact");
            badAddress.put("network", BtcConstants.BTC_MAINNET);
            badAddress.put("payTo", "invalid");
            assertFalse(scheme.validateRequirements(badAddress));
        }
    }

    @Nested
    @DisplayName("ExactBtcClientScheme")
    class ClientSchemeTest {

        private MockClientBtcSigner mockSigner;
        private ExactBtcClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientBtcSigner(BTC_ADDRESS_MAINNET);
            scheme = new ExactBtcClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(BTC_ADDRESS_MAINNET, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactBtcClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", BtcConstants.BTC_MAINNET);
            requirements.put("payTo", BTC_ADDRESS_MAINNET);
            requirements.put("amount", "100000");

            Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, payload.get("t402Version"));
            assertEquals("exact", payload.get("scheme"));
            assertEquals(BtcConstants.BTC_MAINNET, payload.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            assertNotNull(payloadData);
            assertEquals(SAMPLE_SIGNED_PSBT, payloadData.get("signedPsbt"));
        }

        @Test
        @DisplayName("should reject amount below dust limit")
        void testDustLimitValidation() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", BtcConstants.BTC_MAINNET);
            requirements.put("payTo", BTC_ADDRESS_MAINNET);
            requirements.put("amount", "100"); // < 546

            assertThrows(Exception.class, () -> scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should reject invalid Bitcoin address")
        void testInvalidAddress() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", BtcConstants.BTC_MAINNET);
            requirements.put("payTo", "xyz_invalid");
            requirements.put("amount", "100000");

            assertThrows(Exception.class, () -> scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should reject non-BTC network")
        void testNonBtcNetwork() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", "eip155:1");
            requirements.put("payTo", BTC_ADDRESS_MAINNET);
            requirements.put("amount", "100000");

            assertThrows(Exception.class, () -> scheme.createPaymentPayloadSync(requirements));
        }
    }

    @Nested
    @DisplayName("ExactBtcFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorBtcSigner mockSigner;
        private ExactBtcFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorBtcSigner(List.of(FACILITATOR_ADDRESS));
            scheme = new ExactBtcFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactBtcFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(BtcConstants.BTC_MAINNET);
            assertEquals(1, signers.size());
            assertEquals(FACILITATOR_ADDRESS, signers.get(0));
        }

        @Test
        @DisplayName("should verify valid PSBT payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactBtcFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertEquals("payer_address", result.payer);
        }

        @Test
        @DisplayName("should reject invalid payload structure")
        void testVerifyInvalidPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "exact");
            payload.put("network", BtcConstants.BTC_MAINNET);
            // Missing payload data

            Map<String, Object> requirements = createValidRequirements();

            ExactBtcFacilitatorScheme.VerificationResult result =
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

            ExactBtcFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("unsupported_scheme", result.invalidReason);
        }

        @Test
        @DisplayName("should reject network mismatch")
        void testVerifyNetworkMismatch() {
            Map<String, Object> payload = createValidPayload();
            payload.put("network", BtcConstants.BTC_TESTNET);

            Map<String, Object> requirements = createValidRequirements();

            ExactBtcFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("network_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject amount below dust limit")
        void testVerifyAmountBelowDust() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("amount", "100"); // Below dust limit

            ExactBtcFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("amount_below_dust_limit", result.invalidReason);
        }

        @Test
        @DisplayName("should prevent replay attacks")
        void testReplayProtection() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // First verification should succeed
            ExactBtcFacilitatorScheme.VerificationResult first =
                scheme.verifySync(payload, requirements);
            assertTrue(first.isValid);

            // Second verification with same PSBT should fail
            ExactBtcFacilitatorScheme.VerificationResult second =
                scheme.verifySync(payload, requirements);
            assertFalse(second.isValid);
            assertEquals("psbt_already_used", second.invalidReason);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactBtcFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertNotNull(result.transaction);
            assertEquals("payer_address", result.payer);
        }

        private Map<String, Object> createValidPayload() {
            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("signedPsbt", SAMPLE_SIGNED_PSBT);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact");
            payload.put("network", BtcConstants.BTC_MAINNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact");
            requirements.put("network", BtcConstants.BTC_MAINNET);
            requirements.put("payTo", BTC_ADDRESS_MAINNET);
            requirements.put("amount", "100000");
            requirements.put("asset", "BTC");
            requirements.put("maxTimeoutSeconds", 3600);

            return requirements;
        }
    }

    @Nested
    @DisplayName("LightningFacilitatorScheme")
    class LightningFacilitatorTest {

        private MockFacilitatorLightningSigner mockSigner;
        private LightningFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorLightningSigner(List.of("node_pubkey_hex"));
            scheme = new LightningFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should verify valid preimage")
        void testVerifyValidPreimage() {
            // Compute SHA-256(preimage) for the test
            String paymentHash = sha256Hex(hexToBytes(SAMPLE_PREIMAGE));

            Map<String, Object> payload = createLightningPayload(paymentHash, SAMPLE_PREIMAGE);
            Map<String, Object> requirements = createLightningRequirements();

            LightningFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
        }

        @Test
        @DisplayName("should reject preimage hash mismatch")
        void testRejectPreimageHashMismatch() {
            Map<String, Object> payload = createLightningPayload(
                "0000000000000000000000000000000000000000000000000000000000000000",
                SAMPLE_PREIMAGE
            );
            Map<String, Object> requirements = createLightningRequirements();

            LightningFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("preimage_hash_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject invalid preimage format")
        void testRejectInvalidPreimage() {
            Map<String, Object> payload = createLightningPayload("abcd", "xyz");
            Map<String, Object> requirements = createLightningRequirements();

            LightningFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_preimage_format", result.invalidReason);
        }

        @Test
        @DisplayName("should prevent replay attacks")
        void testReplayProtection() {
            String paymentHash = sha256Hex(hexToBytes(SAMPLE_PREIMAGE));

            Map<String, Object> payload = createLightningPayload(paymentHash, SAMPLE_PREIMAGE);
            Map<String, Object> requirements = createLightningRequirements();

            // First should succeed
            LightningFacilitatorScheme.VerificationResult first =
                scheme.verifySync(payload, requirements);
            assertTrue(first.isValid);

            // Second should fail (replay)
            LightningFacilitatorScheme.VerificationResult second =
                scheme.verifySync(payload, requirements);
            assertFalse(second.isValid);
            assertEquals("payment_hash_already_used", second.invalidReason);
        }

        @Test
        @DisplayName("should settle with payment hash as transaction ID")
        void testSettle() {
            String paymentHash = sha256Hex(hexToBytes(SAMPLE_PREIMAGE));

            Map<String, Object> payload = createLightningPayload(paymentHash, SAMPLE_PREIMAGE);
            Map<String, Object> requirements = createLightningRequirements();

            LightningFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertEquals(paymentHash, result.transaction);
        }

        private Map<String, Object> createLightningPayload(String paymentHash, String preimage) {
            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("paymentHash", paymentHash);
            payloadData.put("preimage", preimage);
            payloadData.put("bolt11Invoice", "lnbc10u1pvjluezpp5qqqsyqcyq5rqwzqf");

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact");
            payload.put("network", BtcConstants.LIGHTNING_MAINNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createLightningRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact");
            requirements.put("network", BtcConstants.LIGHTNING_MAINNET);
            requirements.put("payTo", "node_pubkey_hex");
            requirements.put("amount", "1000");

            return requirements;
        }
    }

    // ============================================================
    // Mock Implementations
    // ============================================================

    static class MockClientBtcSigner implements ClientBtcSigner {
        private final String address;

        MockClientBtcSigner(String address) {
            this.address = address;
        }

        @Override
        public String signPsbt(String unsignedPsbt) {
            return SAMPLE_SIGNED_PSBT;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public String getPublicKey() {
            return "02" + "ab".repeat(32);
        }
    }

    static class MockFacilitatorBtcSigner implements FacilitatorBtcSigner {
        private final List<String> addresses;
        private int broadcastCount = 0;

        MockFacilitatorBtcSigner(List<String> addresses) {
            this.addresses = addresses;
        }

        @Override
        public List<String> getAddresses() {
            return addresses;
        }

        @Override
        public VerifyResult verifyPsbt(String signedPsbt, String expectedPayTo, String expectedAmount) {
            return new VerifyResult(true, null, "payer_address");
        }

        @Override
        public String broadcastPsbt(String signedPsbt) {
            broadcastCount++;
            return "txid_" + broadcastCount;
        }

        @Override
        public ConfirmationResult waitForConfirmation(String txId, int confirmations) {
            return new ConfirmationResult(true, "blockhash123", 1);
        }
    }

    static class MockFacilitatorLightningSigner implements FacilitatorLightningSigner {
        private final List<String> addresses;

        MockFacilitatorLightningSigner(List<String> addresses) {
            this.addresses = addresses;
        }

        @Override
        public List<String> getAddresses() {
            return addresses;
        }

        @Override
        public PaymentLookupResult lookupPayment(String paymentHash) {
            return new PaymentLookupResult(true, "1000", SAMPLE_PREIMAGE);
        }
    }

    // ============================================================
    // Test Helpers
    // ============================================================

    private static String sha256Hex(byte[] input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input);
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static byte[] hexToBytes(String hex) {
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            int idx = i * 2;
            bytes[i] = (byte) Integer.parseInt(hex.substring(idx, idx + 2), 16);
        }
        return bytes;
    }
}
