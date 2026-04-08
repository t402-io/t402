package io.t402.schemes.svm;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("SVM Constants")
class SvmConstantsTest {

    @Test
    @DisplayName("Solana mainnet CAIP-2 identifier")
    void solanaMainnet() {
        assertEquals("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", SvmConstants.SOLANA_MAINNET);
    }

    @Test
    @DisplayName("default decimals is 6")
    void defaultDecimals() {
        assertEquals(6, SvmConstants.DEFAULT_DECIMALS);
    }
}
