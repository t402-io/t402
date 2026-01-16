package io.t402.wdk;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;

/**
 * Tests for WDKChains.
 */
class WDKChainsTest {

    @Test
    void getChainIdForKnownChains() {
        assertEquals(1L, WDKChains.getChainId("ethereum"));
        assertEquals(42161L, WDKChains.getChainId("arbitrum"));
        assertEquals(8453L, WDKChains.getChainId("base"));
    }

    @Test
    void getChainIdIsCaseInsensitive() {
        assertEquals(WDKChains.getChainId("ethereum"), WDKChains.getChainId("ETHEREUM"));
        assertEquals(WDKChains.getChainId("arbitrum"), WDKChains.getChainId("Arbitrum"));
    }

    @Test
    void getChainIdReturnsNullForUnknown() {
        assertNull(WDKChains.getChainId("unknown"));
    }

    @Test
    void getNetworkFromChain() {
        assertEquals("eip155:1", WDKChains.getNetworkFromChain("ethereum"));
        assertEquals("eip155:42161", WDKChains.getNetworkFromChain("arbitrum"));
        assertEquals("eip155:8453", WDKChains.getNetworkFromChain("base"));
    }

    @Test
    void getChainFromNetwork() {
        assertEquals("ethereum", WDKChains.getChainFromNetwork("eip155:1"));
        assertEquals("arbitrum", WDKChains.getChainFromNetwork("eip155:42161"));
        assertEquals("base", WDKChains.getChainFromNetwork("eip155:8453"));
    }

    @Test
    void getUsdt0Address() {
        assertNotNull(WDKChains.getUsdt0Address("ethereum"));
        assertNotNull(WDKChains.getUsdt0Address("arbitrum"));
        assertTrue(WDKChains.getUsdt0Address("ethereum").startsWith("0x"));
    }

    @Test
    void getUsdcAddress() {
        assertNotNull(WDKChains.getUsdcAddress("ethereum"));
        assertNotNull(WDKChains.getUsdcAddress("arbitrum"));
        assertTrue(WDKChains.getUsdcAddress("ethereum").startsWith("0x"));
    }

    @Test
    void getUsdt0Chains() {
        Set<String> chains = WDKChains.getUsdt0Chains();

        assertFalse(chains.isEmpty());
        assertTrue(chains.contains("ethereum"));
        assertTrue(chains.contains("arbitrum"));
    }

    @Test
    void getSupportedChains() {
        Set<String> chains = WDKChains.getSupportedChains();

        assertFalse(chains.isEmpty());
        assertTrue(chains.contains("ethereum"));
        assertTrue(chains.contains("arbitrum"));
        assertTrue(chains.contains("sepolia")); // Testnet
    }

    @Test
    void isTestnet() {
        assertTrue(WDKChains.isTestnet("sepolia"));
        assertTrue(WDKChains.isTestnet("arbitrum-sepolia"));
        assertTrue(WDKChains.isTestnet("base-sepolia"));
        assertFalse(WDKChains.isTestnet("ethereum"));
        assertFalse(WDKChains.isTestnet("arbitrum"));
    }

    @Test
    void getTokenAddress() {
        assertNotNull(WDKChains.getTokenAddress("ethereum", "USDT0"));
        assertNotNull(WDKChains.getTokenAddress("ethereum", "USDC"));
        assertEquals(
            WDKChains.getUsdt0Address("ethereum"),
            WDKChains.getTokenAddress("ethereum", "USDT0")
        );
        assertEquals(
            WDKChains.getUsdcAddress("ethereum"),
            WDKChains.getTokenAddress("ethereum", "USDC")
        );
    }

    @Test
    void getTokenAddressIsCaseInsensitive() {
        assertEquals(
            WDKChains.getTokenAddress("ethereum", "usdt0"),
            WDKChains.getTokenAddress("ethereum", "USDT0")
        );
    }

    @Test
    void getTokenAddressReturnsNullForUnknown() {
        assertNull(WDKChains.getTokenAddress("ethereum", "UNKNOWN"));
    }
}
