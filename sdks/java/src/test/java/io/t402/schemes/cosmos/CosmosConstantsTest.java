package io.t402.schemes.cosmos;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Tests for Cosmos constants and utility methods.
 */
@DisplayName("CosmosConstants")
class CosmosConstantsTest {

    @Test
    @DisplayName("should have correct scheme identifier")
    void testSchemeIdentifier() {
        assertEquals("exact-direct", CosmosConstants.SCHEME_EXACT_DIRECT);
    }

    @Test
    @DisplayName("should have correct network identifiers")
    void testNetworkIdentifiers() {
        assertEquals("cosmos:noble-1", CosmosConstants.NOBLE_MAINNET);
        assertEquals("cosmos:grand-1", CosmosConstants.NOBLE_TESTNET);
    }

    @Test
    @DisplayName("should have correct USDC constants")
    void testUsdcConstants() {
        assertEquals("uusdc", CosmosConstants.USDC_DENOM);
        assertEquals("USDC", CosmosConstants.USDC_SYMBOL);
        assertEquals(6, CosmosConstants.USDC_DECIMALS);
    }

    @Test
    @DisplayName("should have correct bech32 prefix")
    void testBech32Prefix() {
        assertEquals("noble", CosmosConstants.BECH32_PREFIX);
    }

    @Test
    @DisplayName("should have correct CAIP family")
    void testCaipFamily() {
        assertEquals("cosmos:*", CosmosConstants.CAIP_FAMILY);
    }

    @Test
    @DisplayName("should have correct MsgSend type")
    void testMsgTypeSend() {
        assertEquals("/cosmos.bank.v1beta1.MsgSend", CosmosConstants.MSG_TYPE_SEND);
    }

    @Test
    @DisplayName("should have correct gas limit")
    void testGasLimit() {
        assertEquals(200000, CosmosConstants.DEFAULT_GAS_LIMIT);
    }

    @Test
    @DisplayName("should have correct RPC URLs")
    void testRpcUrls() {
        assertEquals("https://noble-rpc.polkachu.com", CosmosConstants.NOBLE_MAINNET_RPC);
        assertEquals("https://rpc.testnet.noble.strange.love", CosmosConstants.NOBLE_TESTNET_RPC);
    }

    @Test
    @DisplayName("should have correct REST URLs")
    void testRestUrls() {
        assertEquals("https://noble-api.polkachu.com", CosmosConstants.NOBLE_MAINNET_REST);
        assertEquals("https://api.testnet.noble.strange.love", CosmosConstants.NOBLE_TESTNET_REST);
    }

    @Test
    @DisplayName("should get RPC URL by network")
    void testGetRpcUrl() {
        assertEquals("https://noble-rpc.polkachu.com",
            CosmosConstants.getRpcUrl("cosmos:noble-1"));
        assertEquals("https://rpc.testnet.noble.strange.love",
            CosmosConstants.getRpcUrl("cosmos:grand-1"));
    }

    @Test
    @DisplayName("should throw for unsupported network RPC lookup")
    void testGetRpcUrlUnsupported() {
        assertThrows(IllegalArgumentException.class,
            () -> CosmosConstants.getRpcUrl("cosmos:unknown"));
    }

    @Test
    @DisplayName("should get REST URL by network")
    void testGetRestUrl() {
        assertEquals("https://noble-api.polkachu.com",
            CosmosConstants.getRestUrl("cosmos:noble-1"));
        assertEquals("https://api.testnet.noble.strange.love",
            CosmosConstants.getRestUrl("cosmos:grand-1"));
    }

    @Test
    @DisplayName("should throw for unsupported network REST lookup")
    void testGetRestUrlUnsupported() {
        assertThrows(IllegalArgumentException.class,
            () -> CosmosConstants.getRestUrl("cosmos:unknown"));
    }

    @Test
    @DisplayName("should get chain ID by network")
    void testGetChainId() {
        assertEquals("noble-1", CosmosConstants.getChainId("cosmos:noble-1"));
        assertEquals("grand-1", CosmosConstants.getChainId("cosmos:grand-1"));
    }

    @Test
    @DisplayName("should throw for unsupported network chain ID lookup")
    void testGetChainIdUnsupported() {
        assertThrows(IllegalArgumentException.class,
            () -> CosmosConstants.getChainId("cosmos:unknown"));
    }

    @Test
    @DisplayName("should normalize networks")
    void testNormalizeNetwork() {
        assertEquals(CosmosConstants.NOBLE_MAINNET,
            CosmosConstants.normalizeNetwork("noble-1"));
        assertEquals(CosmosConstants.NOBLE_MAINNET,
            CosmosConstants.normalizeNetwork("noble-mainnet"));
        assertEquals(CosmosConstants.NOBLE_MAINNET,
            CosmosConstants.normalizeNetwork("noble"));
        assertEquals(CosmosConstants.NOBLE_TESTNET,
            CosmosConstants.normalizeNetwork("grand-1"));
        assertEquals(CosmosConstants.NOBLE_TESTNET,
            CosmosConstants.normalizeNetwork("noble-testnet"));
        assertEquals(CosmosConstants.NOBLE_MAINNET,
            CosmosConstants.normalizeNetwork(null));
        assertEquals("cosmos:noble-1",
            CosmosConstants.normalizeNetwork("cosmos:noble-1"));
    }

    @Test
    @DisplayName("should validate networks")
    void testIsValidNetwork() {
        assertTrue(CosmosConstants.isValidNetwork("cosmos:noble-1"));
        assertTrue(CosmosConstants.isValidNetwork("cosmos:grand-1"));
        assertTrue(CosmosConstants.isValidNetwork("noble-1"));
        assertTrue(CosmosConstants.isValidNetwork("noble"));
        assertFalse(CosmosConstants.isValidNetwork("cosmos:unknown"));
        assertFalse(CosmosConstants.isValidNetwork("eip155:1"));
        assertFalse(CosmosConstants.isValidNetwork("near:mainnet"));
    }

    @Test
    @DisplayName("should validate noble addresses")
    void testIsValidAddress() {
        assertTrue(CosmosConstants.isValidAddress("noble1abc123xyz"));
        assertTrue(CosmosConstants.isValidAddress(
            "noble1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu"));
        assertTrue(CosmosConstants.isValidAddress("noble1x"));
    }

    @Test
    @DisplayName("should reject invalid addresses")
    void testIsValidAddressInvalid() {
        assertFalse(CosmosConstants.isValidAddress(null));
        assertFalse(CosmosConstants.isValidAddress(""));
        assertFalse(CosmosConstants.isValidAddress("noble")); // Just the prefix, too short
        assertFalse(CosmosConstants.isValidAddress("cosmos1abc123")); // Wrong prefix
        assertFalse(CosmosConstants.isValidAddress("osmo1abc123")); // Wrong prefix
    }

    @Test
    @DisplayName("should validate address with custom prefix")
    void testIsValidAddressCustomPrefix() {
        assertTrue(CosmosConstants.isValidAddress("cosmos1abc123", "cosmos"));
        assertTrue(CosmosConstants.isValidAddress("osmo1abc123", "osmo"));
        assertFalse(CosmosConstants.isValidAddress("noble1abc123", "cosmos"));
    }
}
