package io.t402.erc4337;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.math.BigInteger;

/**
 * Tests for PaymasterData.
 */
class PaymasterDataTest {

    @Test
    void encodeWithEmptyData() {
        PaymasterData data = new PaymasterData(
            "0x1234567890abcdef1234567890abcdef12345678",
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000),
            "0x"
        );

        String encoded = data.encode();

        assertTrue(encoded.startsWith("0x"));
        // 40 (address) + 32 (verification gas) + 32 (postOp gas) = 104 chars + 2 (0x) = 106
        assertEquals(106, encoded.length());
    }

    @Test
    void encodeWithData() {
        PaymasterData data = new PaymasterData(
            "0x1234567890abcdef1234567890abcdef12345678",
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000),
            "0xdeadbeef"
        );

        String encoded = data.encode();

        assertTrue(encoded.startsWith("0x"));
        // 40 (address) + 32 (verification gas) + 32 (postOp gas) + 8 (data) = 112 chars + 2 (0x) = 114
        assertEquals(114, encoded.length());
        assertTrue(encoded.endsWith("deadbeef"));
    }

    @Test
    void decodeNull() {
        assertNull(PaymasterData.decode(null));
    }

    @Test
    void decodeEmpty() {
        assertNull(PaymasterData.decode("0x"));
    }

    @Test
    void decodeTooShort() {
        assertNull(PaymasterData.decode("0x1234"));
    }

    @Test
    void decodeValidData() {
        // Create a valid encoded string
        PaymasterData original = new PaymasterData(
            "0x1234567890abcdef1234567890abcdef12345678",
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000),
            "0xdeadbeef"
        );

        String encoded = original.encode();
        PaymasterData decoded = PaymasterData.decode(encoded);

        assertNotNull(decoded);
        assertEquals(original.getPaymaster().toLowerCase(), decoded.getPaymaster().toLowerCase());
        assertEquals(original.getPaymasterVerificationGasLimit(), decoded.getPaymasterVerificationGasLimit());
        assertEquals(original.getPaymasterPostOpGasLimit(), decoded.getPaymasterPostOpGasLimit());
        assertEquals("0xdeadbeef", decoded.getPaymasterData());
    }

    @Test
    void roundTrip() {
        PaymasterData original = new PaymasterData(
            "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
            BigInteger.valueOf(200000),
            BigInteger.valueOf(100000),
            "0x12345678"
        );

        String encoded = original.encode();
        PaymasterData decoded = PaymasterData.decode(encoded);

        assertNotNull(decoded);
        assertEquals(original.getPaymasterVerificationGasLimit(), decoded.getPaymasterVerificationGasLimit());
        assertEquals(original.getPaymasterPostOpGasLimit(), decoded.getPaymasterPostOpGasLimit());
    }

    @Test
    void getters() {
        PaymasterData data = new PaymasterData(
            "0x1234567890abcdef1234567890abcdef12345678",
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000),
            "0xabcd"
        );

        assertEquals("0x1234567890abcdef1234567890abcdef12345678", data.getPaymaster());
        assertEquals(BigInteger.valueOf(100000), data.getPaymasterVerificationGasLimit());
        assertEquals(BigInteger.valueOf(50000), data.getPaymasterPostOpGasLimit());
        assertEquals("0xabcd", data.getPaymasterData());
    }
}
