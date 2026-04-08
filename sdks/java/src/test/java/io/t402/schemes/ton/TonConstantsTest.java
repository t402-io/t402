package io.t402.schemes.ton;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("TON Constants")
class TonConstantsTest {

    @Test
    @DisplayName("network identifiers use CAIP-2 format")
    void networkIdentifiers() {
        assertEquals("ton:mainnet", TonConstants.TON_MAINNET);
        assertEquals("ton:testnet", TonConstants.TON_TESTNET);
    }

    @Test
    @DisplayName("USDT mainnet jetton address is correct")
    void usdtMainnetAddress() {
        assertEquals("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", TonConstants.USDT_MAINNET);
    }

    @Test
    @DisplayName("scheme name is 'exact'")
    void schemeName() {
        assertEquals("exact", TonConstants.SCHEME_EXACT);
    }

    @Test
    @DisplayName("USDT decimals is 6")
    void usdtDecimals() {
        assertEquals(6, TonConstants.USDT_DECIMALS);
    }
}
