package io.t402.schemes.evm;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("EVM Constants")
class EvmConstantsTest {

    @Test
    @DisplayName("scheme identifiers are correct")
    void schemeIdentifiers() {
        assertEquals("exact", EvmConstants.SCHEME_EXACT);
        assertEquals("exact-legacy", EvmConstants.SCHEME_EXACT_LEGACY);
        assertEquals("upto", EvmConstants.SCHEME_UPTO);
    }

    @Test
    @DisplayName("CAIP family pattern is eip155:*")
    void caipFamily() {
        assertEquals("eip155:*", EvmConstants.CAIP_FAMILY);
    }

    @Test
    @DisplayName("key EVM network IDs are correct")
    void networkIdentifiers() {
        assertEquals("eip155:1", EvmConstants.ETHEREUM_MAINNET);
        assertEquals("eip155:8453", EvmConstants.BASE_MAINNET);
        assertEquals("eip155:42161", EvmConstants.ARBITRUM_ONE);
        assertEquals("eip155:10", EvmConstants.OPTIMISM_MAINNET);
        assertEquals("eip155:137", EvmConstants.POLYGON_MAINNET);
        assertEquals("eip155:56", EvmConstants.BSC_MAINNET);
    }

    @Test
    @DisplayName("USDT legacy addresses include BSC")
    void usdtLegacyAddresses() {
        assertNotNull(EvmConstants.USDT_LEGACY_ADDRESSES);
        assertTrue(EvmConstants.USDT_LEGACY_ADDRESSES.containsKey(EvmConstants.BSC_MAINNET));
    }

    @Test
    @DisplayName("USDT0 addresses include Ethereum and Arbitrum")
    void usdt0Addresses() {
        assertNotNull(EvmConstants.USDT0_ADDRESSES);
        assertTrue(EvmConstants.USDT0_ADDRESSES.containsKey(EvmConstants.ETHEREUM_MAINNET));
        assertTrue(EvmConstants.USDT0_ADDRESSES.containsKey(EvmConstants.ARBITRUM_ONE));
    }

    @Test
    @DisplayName("transfer methods are defined")
    void transferMethods() {
        assertEquals("permit", EvmConstants.TRANSFER_METHOD_PERMIT);
        assertEquals("permit2", EvmConstants.TRANSFER_METHOD_PERMIT2);
        assertEquals("approve", EvmConstants.TRANSFER_METHOD_APPROVE);
    }
}
