package io.t402.schemes.svm;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for SVM types and utilities.
 */
@DisplayName("SVM Types and Utilities")
class SvmTypesTest {

    // Sample valid Solana address
    private static final String SAMPLE_ADDRESS_1 = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
    private static final String SAMPLE_ADDRESS_2 = "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL";

    @Nested
    @DisplayName("SvmConstants")
    class SvmConstantsTest {

        @Test
        @DisplayName("should have correct mainnet network ID")
        void testMainnetNetworkId() {
            assertEquals("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", SvmConstants.SOLANA_MAINNET);
        }

        @Test
        @DisplayName("should have correct devnet network ID")
        void testDevnetNetworkId() {
            assertEquals("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", SvmConstants.SOLANA_DEVNET);
        }

        @Test
        @DisplayName("should have correct testnet network ID")
        void testTestnetNetworkId() {
            assertEquals("solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z", SvmConstants.SOLANA_TESTNET);
        }

        @Test
        @DisplayName("should normalize legacy network identifiers")
        void testNormalizeNetwork() {
            assertEquals(SvmConstants.SOLANA_MAINNET, SvmConstants.normalizeNetwork("solana"));
            assertEquals(SvmConstants.SOLANA_DEVNET, SvmConstants.normalizeNetwork("solana-devnet"));
            assertEquals(SvmConstants.SOLANA_TESTNET, SvmConstants.normalizeNetwork("solana-testnet"));
        }

        @Test
        @DisplayName("should pass through CAIP-2 identifiers")
        void testNormalizeNetworkCaip2() {
            assertEquals(SvmConstants.SOLANA_MAINNET, SvmConstants.normalizeNetwork(SvmConstants.SOLANA_MAINNET));
            assertEquals(SvmConstants.SOLANA_DEVNET, SvmConstants.normalizeNetwork(SvmConstants.SOLANA_DEVNET));
        }

        @Test
        @DisplayName("should validate supported networks")
        void testIsValidNetwork() {
            assertTrue(SvmConstants.isValidNetwork(SvmConstants.SOLANA_MAINNET));
            assertTrue(SvmConstants.isValidNetwork(SvmConstants.SOLANA_DEVNET));
            assertTrue(SvmConstants.isValidNetwork(SvmConstants.SOLANA_TESTNET));
            assertTrue(SvmConstants.isValidNetwork("solana")); // legacy
            assertFalse(SvmConstants.isValidNetwork("invalid"));
        }

        @Test
        @DisplayName("should identify SVM networks")
        void testIsSvmNetwork() {
            assertTrue(SvmConstants.isSvmNetwork(SvmConstants.SOLANA_MAINNET));
            assertTrue(SvmConstants.isSvmNetwork("solana"));
            assertTrue(SvmConstants.isSvmNetwork("solana:custom"));
            assertFalse(SvmConstants.isSvmNetwork("eip155:1"));
        }

        @Test
        @DisplayName("should identify testnets")
        void testIsTestnet() {
            assertFalse(SvmConstants.isTestnet(SvmConstants.SOLANA_MAINNET));
            assertTrue(SvmConstants.isTestnet(SvmConstants.SOLANA_DEVNET));
            assertTrue(SvmConstants.isTestnet(SvmConstants.SOLANA_TESTNET));
        }

        @Test
        @DisplayName("should get correct USDC address for network")
        void testGetUsdcAddress() {
            assertEquals(SvmConstants.USDC_MAINNET_ADDRESS, SvmConstants.getUsdcAddress(SvmConstants.SOLANA_MAINNET));
            assertEquals(SvmConstants.USDC_DEVNET_ADDRESS, SvmConstants.getUsdcAddress(SvmConstants.SOLANA_DEVNET));
            assertEquals(SvmConstants.USDC_DEVNET_ADDRESS, SvmConstants.getUsdcAddress("solana-devnet"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testGetUsdcAddressInvalid() {
            assertThrows(IllegalArgumentException.class, () -> SvmConstants.getUsdcAddress("invalid"));
        }

        @Test
        @DisplayName("should get correct RPC URL for network")
        void testGetRpcUrl() {
            assertEquals(SvmConstants.MAINNET_RPC_URL, SvmConstants.getRpcUrl(SvmConstants.SOLANA_MAINNET));
            assertEquals(SvmConstants.DEVNET_RPC_URL, SvmConstants.getRpcUrl(SvmConstants.SOLANA_DEVNET));
            assertEquals(SvmConstants.TESTNET_RPC_URL, SvmConstants.getRpcUrl(SvmConstants.SOLANA_TESTNET));
        }
    }

    @Nested
    @DisplayName("SvmUtils")
    class SvmUtilsTest {

        @Test
        @DisplayName("should validate Solana addresses")
        void testValidateAddress() {
            assertTrue(SvmUtils.isValidAddress(SAMPLE_ADDRESS_1));
            assertTrue(SvmUtils.isValidAddress(SAMPLE_ADDRESS_2));
            assertTrue(SvmUtils.isValidAddress(SvmConstants.USDC_MAINNET_ADDRESS));
        }

        @Test
        @DisplayName("should reject invalid addresses")
        void testValidateAddressInvalid() {
            assertFalse(SvmUtils.isValidAddress(null));
            assertFalse(SvmUtils.isValidAddress(""));
            assertFalse(SvmUtils.isValidAddress("0x1234")); // EVM address
            assertFalse(SvmUtils.isValidAddress("invalid")); // too short
            assertFalse(SvmUtils.isValidAddress("O0l1")); // invalid base58 chars
        }

        @Test
        @DisplayName("should compare addresses correctly")
        void testAddressesEqual() {
            assertTrue(SvmUtils.addressesEqual(SAMPLE_ADDRESS_1, SAMPLE_ADDRESS_1));
            assertFalse(SvmUtils.addressesEqual(SAMPLE_ADDRESS_1, SAMPLE_ADDRESS_2));
            assertFalse(SvmUtils.addressesEqual(SAMPLE_ADDRESS_1, SAMPLE_ADDRESS_1.toLowerCase()));
            assertFalse(SvmUtils.addressesEqual(null, SAMPLE_ADDRESS_1));
        }

        @Test
        @DisplayName("should parse decimal amounts")
        void testParseAmount() {
            assertEquals(new BigInteger("1500000"), SvmUtils.parseAmount("1.5", 6));
            assertEquals(new BigInteger("1000000"), SvmUtils.parseAmount("1", 6));
            assertEquals(new BigInteger("1000000"), SvmUtils.parseAmount("1.0", 6));
            assertEquals(new BigInteger("100"), SvmUtils.parseAmount("0.0001", 6));
            assertEquals(new BigInteger("1234567890"), SvmUtils.parseAmount("1234.56789", 6));
        }

        @Test
        @DisplayName("should parse integer amounts")
        void testParseAmountInteger() {
            assertEquals(new BigInteger("5000000"), SvmUtils.parseAmount("5", 6));
            assertEquals(new BigInteger("100000000"), SvmUtils.parseAmount("100", 6));
        }

        @Test
        @DisplayName("should format amounts correctly")
        void testFormatAmount() {
            assertEquals("1.5", SvmUtils.formatAmount(new BigInteger("1500000"), 6));
            assertEquals("1", SvmUtils.formatAmount(new BigInteger("1000000"), 6));
            assertEquals("0.0001", SvmUtils.formatAmount(new BigInteger("100"), 6));
            assertEquals("0", SvmUtils.formatAmount(BigInteger.ZERO, 6));
        }

        @Test
        @DisplayName("should format long amounts correctly")
        void testFormatAmountLong() {
            assertEquals("1.5", SvmUtils.formatAmount(1500000L, 6));
            assertEquals("0", SvmUtils.formatAmount(0L, 6));
        }

        @Test
        @DisplayName("should validate transaction base64")
        void testIsValidTransaction() {
            // A valid base64 string with enough bytes
            String validTx = java.util.Base64.getEncoder().encodeToString(new byte[150]);
            assertTrue(SvmUtils.isValidTransaction(validTx));

            // Too short
            String shortTx = java.util.Base64.getEncoder().encodeToString(new byte[50]);
            assertFalse(SvmUtils.isValidTransaction(shortTx));

            // Invalid
            assertFalse(SvmUtils.isValidTransaction(null));
            assertFalse(SvmUtils.isValidTransaction(""));
            assertFalse(SvmUtils.isValidTransaction("not-base64!!!"));
        }

        @Test
        @DisplayName("should decode and encode transactions")
        void testTransactionCodec() {
            byte[] original = new byte[150];
            for (int i = 0; i < original.length; i++) {
                original[i] = (byte) (i % 256);
            }

            String encoded = SvmUtils.encodeTransaction(original);
            byte[] decoded = SvmUtils.decodeTransaction(encoded);

            assertArrayEquals(original, decoded);
        }

        @Test
        @DisplayName("should encode and decode base58")
        void testBase58Codec() {
            byte[] original = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
            String encoded = SvmUtils.base58Encode(original);
            byte[] decoded = SvmUtils.base58Decode(encoded);

            assertArrayEquals(original, decoded);
        }

        @Test
        @DisplayName("should handle base58 with leading zeros")
        void testBase58LeadingZeros() {
            byte[] original = new byte[] { 0, 0, 1, 2, 3 };
            String encoded = SvmUtils.base58Encode(original);
            assertTrue(encoded.startsWith("11")); // Leading zeros become '1's
            byte[] decoded = SvmUtils.base58Decode(encoded);
            assertArrayEquals(original, decoded);
        }

        @Test
        @DisplayName("should calculate validity timestamps")
        void testCalculateValidUntil() {
            long now = SvmUtils.getCurrentTimestamp();
            long validUntil = SvmUtils.calculateValidUntil(3600);

            assertTrue(validUntil > now);
            assertTrue(validUntil <= now + 3601); // Allow 1 second tolerance
        }
    }

    @Nested
    @DisplayName("SvmAuthorization")
    class SvmAuthorizationTest {

        @Test
        @DisplayName("should create authorization with builder")
        void testBuilder() {
            long validUntil = SvmUtils.calculateValidUntil(3600);

            SvmAuthorization auth = SvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .mint(SvmConstants.USDC_MAINNET_ADDRESS)
                .amount("1000000")
                .validUntil(validUntil)
                .feePayer(SAMPLE_ADDRESS_2)
                .build();

            assertEquals(SAMPLE_ADDRESS_1, auth.from);
            assertEquals(SAMPLE_ADDRESS_2, auth.to);
            assertEquals(SvmConstants.USDC_MAINNET_ADDRESS, auth.mint);
            assertEquals("1000000", auth.amount);
            assertEquals(validUntil, auth.validUntil);
            assertEquals(SAMPLE_ADDRESS_2, auth.feePayer);
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapConversion() {
            SvmAuthorization original = SvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .mint(SvmConstants.USDC_MAINNET_ADDRESS)
                .amount("1000000")
                .validUntil(1700000000L)
                .feePayer(SAMPLE_ADDRESS_2)
                .build();

            Map<String, Object> map = original.toMap();
            SvmAuthorization restored = SvmAuthorization.fromMap(map);

            assertEquals(original.from, restored.from);
            assertEquals(original.to, restored.to);
            assertEquals(original.mint, restored.mint);
            assertEquals(original.amount, restored.amount);
            assertEquals(original.validUntil, restored.validUntil);
            assertEquals(original.feePayer, restored.feePayer);
        }

        @Test
        @DisplayName("should handle numeric amount in map")
        void testMapWithNumericAmount() {
            Map<String, Object> map = new HashMap<>();
            map.put("from", SAMPLE_ADDRESS_1);
            map.put("to", SAMPLE_ADDRESS_2);
            map.put("mint", SvmConstants.USDC_MAINNET_ADDRESS);
            map.put("amount", 1000000L); // numeric
            map.put("validUntil", 1700000000L);

            SvmAuthorization auth = SvmAuthorization.fromMap(map);
            assertEquals("1000000", auth.amount);
        }
    }

    @Nested
    @DisplayName("ExactSvmPayload")
    class ExactSvmPayloadTest {

        @Test
        @DisplayName("should create payload with builder")
        void testBuilder() {
            String txBase64 = java.util.Base64.getEncoder().encodeToString(new byte[150]);
            SvmAuthorization auth = SvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .mint(SvmConstants.USDC_MAINNET_ADDRESS)
                .amount("1000000")
                .validUntil(1700000000L)
                .build();

            ExactSvmPayload payload = ExactSvmPayload.builder()
                .transaction(txBase64)
                .authorization(auth)
                .build();

            assertEquals(txBase64, payload.transaction);
            assertNotNull(payload.authorization);
            assertEquals(SAMPLE_ADDRESS_1, payload.authorization.from);
        }

        @Test
        @DisplayName("should validate payload structure")
        void testIsValid() {
            String txBase64 = java.util.Base64.getEncoder().encodeToString(new byte[150]);

            ExactSvmPayload validPayload = new ExactSvmPayload(txBase64);
            assertTrue(validPayload.isValid());

            ExactSvmPayload invalidPayload = new ExactSvmPayload();
            assertFalse(invalidPayload.isValid());

            ExactSvmPayload emptyPayload = new ExactSvmPayload("");
            assertFalse(emptyPayload.isValid());
        }

        @Test
        @DisplayName("should convert to and from map")
        void testMapConversion() {
            String txBase64 = java.util.Base64.getEncoder().encodeToString(new byte[150]);
            SvmAuthorization auth = SvmAuthorization.builder()
                .from(SAMPLE_ADDRESS_1)
                .to(SAMPLE_ADDRESS_2)
                .mint(SvmConstants.USDC_MAINNET_ADDRESS)
                .amount("1000000")
                .validUntil(1700000000L)
                .build();

            ExactSvmPayload original = new ExactSvmPayload(txBase64, auth);
            Map<String, Object> map = original.toMap();
            ExactSvmPayload restored = ExactSvmPayload.fromMap(map);

            assertEquals(original.transaction, restored.transaction);
            assertNotNull(restored.authorization);
            assertEquals(original.authorization.from, restored.authorization.from);
            assertEquals(original.authorization.amount, restored.authorization.amount);
        }
    }
}
