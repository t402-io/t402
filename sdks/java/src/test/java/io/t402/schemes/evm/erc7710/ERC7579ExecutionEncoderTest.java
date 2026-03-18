package io.t402.schemes.evm.erc7710;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for ERC-7579 execution encoding and ERC-7710 payload parsing.
 */
@DisplayName("ERC-7710 / ERC-7579 Encoding")
class ERC7579ExecutionEncoderTest {

    private static final String USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    private static final String RECIPIENT_ADDRESS = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C";

    // =========================================================================
    // ERC-7579 Execution Encoding Tests
    // =========================================================================

    @Nested
    @DisplayName("encodeERC20Transfer")
    class EncodeERC20TransferTest {

        @Test
        @DisplayName("should encode ERC-20 transfer in ERC-7579 single execution format")
        void testEncodeERC20Transfer() {
            byte[] result = ERC7579ExecutionEncoder.encodeERC20Transfer(
                    USDC_ADDRESS, RECIPIENT_ADDRESS, BigInteger.valueOf(10000));

            // 20 bytes target + 32 bytes value + 4 selector + 32 addr + 32 amount = 120 bytes
            assertEquals(120, result.length);

            String hex = ERC7579ExecutionEncoder.bytesToHex(result).substring(2); // strip 0x

            // First 40 hex chars (20 bytes) = token address (lowercase)
            assertEquals("a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
                    hex.substring(0, 40));

            // Next 64 hex chars (32 bytes) = value (zero, no ETH)
            assertEquals("0".repeat(64), hex.substring(40, 104));

            // Calldata starts at char 104
            // transfer selector: a9059cbb
            assertEquals("a9059cbb", hex.substring(104, 112));

            // Recipient padded to 32 bytes
            assertEquals("000000000000000000000000209693bc6afc0c5328ba36faf03c514ef312287c",
                    hex.substring(112, 176));

            // Amount (10000 = 0x2710) padded to 32 bytes
            assertEquals("0000000000000000000000000000000000000000000000000000000000002710",
                    hex.substring(176, 240));
        }

        @Test
        @DisplayName("should handle large amounts")
        void testLargeAmount() {
            BigInteger largeAmount = new BigInteger("1000000000000"); // 1M USDC (6 decimals)
            byte[] result = ERC7579ExecutionEncoder.encodeERC20Transfer(
                    USDC_ADDRESS, RECIPIENT_ADDRESS, largeAmount);

            assertEquals(120, result.length);

            String hex = ERC7579ExecutionEncoder.bytesToHex(result).substring(2);
            // Amount = 1000000000000 = 0xe8d4a51000
            String amountHex = hex.substring(176, 240);
            assertEquals(largeAmount, new BigInteger(amountHex, 16));
        }

        @Test
        @DisplayName("should handle zero amount")
        void testZeroAmount() {
            byte[] result = ERC7579ExecutionEncoder.encodeERC20Transfer(
                    USDC_ADDRESS, RECIPIENT_ADDRESS, BigInteger.ZERO);

            assertEquals(120, result.length);

            String hex = ERC7579ExecutionEncoder.bytesToHex(result).substring(2);
            String amountHex = hex.substring(176, 240);
            assertEquals("0".repeat(64), amountHex);
        }

        @Test
        @DisplayName("should reject negative amounts")
        void testNegativeAmount() {
            assertThrows(IllegalArgumentException.class, () ->
                ERC7579ExecutionEncoder.encodeERC20Transfer(
                    USDC_ADDRESS, RECIPIENT_ADDRESS, BigInteger.valueOf(-1)));
        }

        @Test
        @DisplayName("should reject invalid token address")
        void testInvalidTokenAddress() {
            assertThrows(IllegalArgumentException.class, () ->
                ERC7579ExecutionEncoder.encodeERC20Transfer(
                    "0xinvalid", RECIPIENT_ADDRESS, BigInteger.TEN));
        }

        @Test
        @DisplayName("should reject short address")
        void testShortAddress() {
            assertThrows(IllegalArgumentException.class, () ->
                ERC7579ExecutionEncoder.encodeERC20Transfer(
                    "0xabcd", RECIPIENT_ADDRESS, BigInteger.TEN));
        }
    }

    // =========================================================================
    // Hex Utility Tests
    // =========================================================================

    @Nested
    @DisplayName("hexToBytes")
    class HexToBytesTest {

        @Test
        @DisplayName("should decode hex with 0x prefix")
        void testHexWithPrefix() {
            byte[] result = ERC7579ExecutionEncoder.hexToBytes("0xabcd");
            assertEquals(2, result.length);
            assertEquals((byte) 0xab, result[0]);
            assertEquals((byte) 0xcd, result[1]);
        }

        @Test
        @DisplayName("should decode hex without prefix")
        void testHexWithoutPrefix() {
            byte[] result = ERC7579ExecutionEncoder.hexToBytes("abcd");
            assertEquals(2, result.length);
            assertEquals((byte) 0xab, result[0]);
            assertEquals((byte) 0xcd, result[1]);
        }

        @Test
        @DisplayName("should handle empty hex string with prefix")
        void testEmptyHex() {
            byte[] result = ERC7579ExecutionEncoder.hexToBytes("0x");
            assertEquals(0, result.length);
        }

        @Test
        @DisplayName("should reject null input")
        void testNullInput() {
            assertThrows(IllegalArgumentException.class, () ->
                ERC7579ExecutionEncoder.hexToBytes(null));
        }
    }

    // =========================================================================
    // Single Call Mode Tests
    // =========================================================================

    @Nested
    @DisplayName("SINGLE_CALL_MODE")
    class SingleCallModeTest {

        @Test
        @DisplayName("should be 32 zero bytes")
        void testSingleCallMode() {
            assertEquals(32, ERC7579ExecutionEncoder.SINGLE_CALL_MODE.length);
            for (byte b : ERC7579ExecutionEncoder.SINGLE_CALL_MODE) {
                assertEquals(0, b);
            }
        }
    }

    // =========================================================================
    // ERC-20 Transfer Selector Tests
    // =========================================================================

    @Nested
    @DisplayName("ERC20_TRANSFER_SELECTOR")
    class TransferSelectorTest {

        @Test
        @DisplayName("should be a9059cbb")
        void testTransferSelector() {
            assertEquals(4, ERC7579ExecutionEncoder.ERC20_TRANSFER_SELECTOR.length);
            assertEquals((byte) 0xa9, ERC7579ExecutionEncoder.ERC20_TRANSFER_SELECTOR[0]);
            assertEquals((byte) 0x05, ERC7579ExecutionEncoder.ERC20_TRANSFER_SELECTOR[1]);
            assertEquals((byte) 0x9c, ERC7579ExecutionEncoder.ERC20_TRANSFER_SELECTOR[2]);
            assertEquals((byte) 0xbb, ERC7579ExecutionEncoder.ERC20_TRANSFER_SELECTOR[3]);
        }
    }

    // =========================================================================
    // ERC7710Payload Tests
    // =========================================================================

    @Nested
    @DisplayName("ERC7710Payload")
    class ERC7710PayloadTest {

        @Test
        @DisplayName("should parse from map")
        void testFromMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("delegationManager", "0xDelegationManagerAddress");
            map.put("permissionContext", "0xabcdef");
            map.put("delegator", "0x857b06519E91e3A54538791bDbb0E22373e36b66");

            ERC7710Payload payload = ERC7710Payload.fromMap(map);

            assertEquals("0xDelegationManagerAddress", payload.getDelegationManager());
            assertEquals("0xabcdef", payload.getPermissionContext());
            assertEquals("0x857b06519E91e3A54538791bDbb0E22373e36b66", payload.getDelegator());
        }

        @Test
        @DisplayName("should round-trip through toMap and fromMap")
        void testRoundTrip() {
            ERC7710Payload original = new ERC7710Payload(
                    "0xDM", "0xPC", "0xDelegator");

            Map<String, Object> map = original.toMap();
            ERC7710Payload restored = ERC7710Payload.fromMap(map);

            assertEquals(original.getDelegationManager(), restored.getDelegationManager());
            assertEquals(original.getPermissionContext(), restored.getPermissionContext());
            assertEquals(original.getDelegator(), restored.getDelegator());
        }

        @Test
        @DisplayName("should throw for missing delegationManager")
        void testMissingDelegationManager() {
            Map<String, Object> map = new HashMap<>();
            map.put("permissionContext", "0xabcdef");
            map.put("delegator", "0xDelegator");

            assertThrows(IllegalArgumentException.class, () ->
                ERC7710Payload.fromMap(map));
        }

        @Test
        @DisplayName("should throw for missing permissionContext")
        void testMissingPermissionContext() {
            Map<String, Object> map = new HashMap<>();
            map.put("delegationManager", "0xDM");
            map.put("delegator", "0xDelegator");

            assertThrows(IllegalArgumentException.class, () ->
                ERC7710Payload.fromMap(map));
        }

        @Test
        @DisplayName("should throw for missing delegator")
        void testMissingDelegator() {
            Map<String, Object> map = new HashMap<>();
            map.put("delegationManager", "0xDM");
            map.put("permissionContext", "0xPC");

            assertThrows(IllegalArgumentException.class, () ->
                ERC7710Payload.fromMap(map));
        }

        @Test
        @DisplayName("should throw for empty delegationManager")
        void testEmptyDelegationManager() {
            Map<String, Object> map = new HashMap<>();
            map.put("delegationManager", "");
            map.put("permissionContext", "0xPC");
            map.put("delegator", "0xDelegator");

            assertThrows(IllegalArgumentException.class, () ->
                ERC7710Payload.fromMap(map));
        }
    }

    // =========================================================================
    // ERC7710EvmFacilitatorScheme Tests
    // =========================================================================

    @Nested
    @DisplayName("ERC7710EvmFacilitatorScheme")
    class SchemeTest {

        @Test
        @DisplayName("should have correct scheme constant")
        void testSchemeConstant() {
            assertEquals("exact", ERC7710EvmFacilitatorScheme.SCHEME);
        }

        @Test
        @DisplayName("should have correct CAIP family constant")
        void testCaipFamilyConstant() {
            assertEquals("eip155:*", ERC7710EvmFacilitatorScheme.CAIP_FAMILY);
        }

        @Test
        @DisplayName("should reject null signer")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new ERC7710EvmFacilitatorScheme(null));
        }
    }
}
