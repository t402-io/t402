package io.t402.schemes.tron;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TRON Constants")
class TronConstantsTest {

    @Test
    @DisplayName("network identifiers use CAIP-2 format")
    void networkIdentifiers() {
        assertEquals("tron:mainnet", TronConstants.TRON_MAINNET);
        assertEquals("tron:nile", TronConstants.TRON_NILE);
        assertEquals("tron:shasta", TronConstants.TRON_SHASTA);
    }

    @Test
    @DisplayName("USDT mainnet address is correct")
    void usdtMainnetAddress() {
        assertEquals("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", TronConstants.USDT_MAINNET);
    }

    @Test
    @DisplayName("scheme name is 'exact'")
    void schemeName() {
        assertEquals("exact", TronConstants.SCHEME_EXACT);
    }

    @Test
    @DisplayName("CAIP family is tron:*")
    void caipFamily() {
        assertEquals("tron:*", TronConstants.CAIP_FAMILY);
    }
}
