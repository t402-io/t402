package io.t402.bridge;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;

/**
 * Tests for BridgeConstants.
 */
class BridgeConstantsTest {

    @Test
    void getEndpointIdForKnownChains() {
        assertEquals(30101, BridgeConstants.getEndpointId("ethereum"));
        assertEquals(30110, BridgeConstants.getEndpointId("arbitrum"));
        assertEquals(30184, BridgeConstants.getEndpointId("base"));
        assertEquals(30291, BridgeConstants.getEndpointId("ink"));
    }

    @Test
    void getEndpointIdIsCaseInsensitive() {
        assertEquals(BridgeConstants.getEndpointId("ethereum"), BridgeConstants.getEndpointId("ETHEREUM"));
        assertEquals(BridgeConstants.getEndpointId("arbitrum"), BridgeConstants.getEndpointId("Arbitrum"));
    }

    @Test
    void getEndpointIdReturnsNullForUnknown() {
        assertNull(BridgeConstants.getEndpointId("unknown"));
        assertNull(BridgeConstants.getEndpointId(""));
    }

    @Test
    void getEndpointIdFromNetwork() {
        assertEquals(30101, BridgeConstants.getEndpointIdFromNetwork("eip155:1"));
        assertEquals(30110, BridgeConstants.getEndpointIdFromNetwork("eip155:42161"));
        assertEquals(30184, BridgeConstants.getEndpointIdFromNetwork("eip155:8453"));
    }

    @Test
    void getEndpointIdFromNetworkReturnsNullForUnknown() {
        assertNull(BridgeConstants.getEndpointIdFromNetwork("eip155:999999"));
        assertNull(BridgeConstants.getEndpointIdFromNetwork("unknown:1"));
    }

    @Test
    void getUsdt0OftAddressForKnownChains() {
        assertNotNull(BridgeConstants.getUsdt0OftAddress("ethereum"));
        assertNotNull(BridgeConstants.getUsdt0OftAddress("arbitrum"));
        assertNotNull(BridgeConstants.getUsdt0OftAddress("base"));

        assertTrue(BridgeConstants.getUsdt0OftAddress("ethereum").startsWith("0x"));
    }

    @Test
    void getUsdt0OftAddressReturnsNullForUnknown() {
        assertNull(BridgeConstants.getUsdt0OftAddress("unknown"));
    }

    @Test
    void supportsBridgingForKnownChains() {
        assertTrue(BridgeConstants.supportsBridging("ethereum"));
        assertTrue(BridgeConstants.supportsBridging("arbitrum"));
        assertTrue(BridgeConstants.supportsBridging("base"));
        assertTrue(BridgeConstants.supportsBridging("ink"));
    }

    @Test
    void supportsBridgingReturnsFalseForUnknown() {
        assertFalse(BridgeConstants.supportsBridging("unknown"));
        assertFalse(BridgeConstants.supportsBridging(""));
    }

    @Test
    void getBridgeableChainsReturnsSet() {
        Set<String> chains = BridgeConstants.getBridgeableChains();

        assertNotNull(chains);
        assertFalse(chains.isEmpty());
        assertTrue(chains.contains("ethereum"));
        assertTrue(chains.contains("arbitrum"));
    }

    @Test
    void addressToBytes32() {
        byte[] result = BridgeConstants.addressToBytes32("0x1234567890abcdef1234567890abcdef12345678");

        assertEquals(32, result.length);
        // First 12 bytes should be zero
        for (int i = 0; i < 12; i++) {
            assertEquals(0, result[i]);
        }
        // Remaining 20 bytes should be the address
        assertNotEquals(0, result[12]);
    }

    @Test
    void bytes32ToAddress() {
        byte[] bytes32 = new byte[32];
        bytes32[12] = 0x12;
        bytes32[13] = 0x34;
        bytes32[14] = 0x56;
        bytes32[15] = 0x78;
        bytes32[16] = (byte) 0x90;
        bytes32[17] = (byte) 0xab;
        bytes32[18] = (byte) 0xcd;
        bytes32[19] = (byte) 0xef;
        bytes32[20] = 0x12;
        bytes32[21] = 0x34;
        bytes32[22] = 0x56;
        bytes32[23] = 0x78;
        bytes32[24] = (byte) 0x90;
        bytes32[25] = (byte) 0xab;
        bytes32[26] = (byte) 0xcd;
        bytes32[27] = (byte) 0xef;
        bytes32[28] = 0x12;
        bytes32[29] = 0x34;
        bytes32[30] = 0x56;
        bytes32[31] = 0x78;

        String address = BridgeConstants.bytes32ToAddress(bytes32);

        assertTrue(address.startsWith("0x"));
        assertEquals(42, address.length());
    }

    @Test
    void bytes32ToAddressRejectsWrongLength() {
        assertThrows(IllegalArgumentException.class, () ->
            BridgeConstants.bytes32ToAddress(new byte[20])
        );
    }

    @Test
    void roundTripAddressConversion() {
        String original = "0x1234567890abcdef1234567890abcdef12345678";
        byte[] bytes32 = BridgeConstants.addressToBytes32(original);
        String result = BridgeConstants.bytes32ToAddress(bytes32);

        assertEquals(original.toLowerCase(), result.toLowerCase());
    }

    @Test
    void networkToChain() {
        assertEquals("ethereum", BridgeConstants.networkToChain("eip155:1"));
        assertEquals("arbitrum", BridgeConstants.networkToChain("eip155:42161"));
        assertNull(BridgeConstants.networkToChain("unknown:1"));
    }
}
