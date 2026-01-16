package io.t402.bridge;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import io.t402.bridge.BridgeTypes.*;

import java.math.BigInteger;
import java.util.Set;

/**
 * Tests for Usdt0Bridge.
 */
class Usdt0BridgeTest {

    private static class MockBridgeSigner implements BridgeSigner {
        private final String address;

        MockBridgeSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public Object readContract(String contractAddress, String functionName, Object... args) {
            // Return mock fee
            return new Object[] { BigInteger.valueOf(1000000000L), BigInteger.ZERO };
        }

        @Override
        public String writeContract(String contractAddress, String functionName,
                                    BigInteger value, Object... args) {
            return "0xmocktxhash";
        }

        @Override
        public TransactionReceipt waitForTransactionReceipt(String txHash) {
            return new TransactionReceipt(txHash, 1, java.util.List.of());
        }
    }

    @Test
    void constructorWithValidChain() {
        MockBridgeSigner signer = new MockBridgeSigner("0x1234567890abcdef1234567890abcdef12345678");
        Usdt0Bridge bridge = new Usdt0Bridge(signer, "arbitrum");

        assertEquals("arbitrum", bridge.getChain());
    }

    @Test
    void constructorRejectsInvalidChain() {
        MockBridgeSigner signer = new MockBridgeSigner("0x1234567890abcdef1234567890abcdef12345678");

        assertThrows(IllegalArgumentException.class, () ->
            new Usdt0Bridge(signer, "unknown")
        );
    }

    @Test
    void getSupportedDestinations() {
        MockBridgeSigner signer = new MockBridgeSigner("0x1234567890abcdef1234567890abcdef12345678");
        Usdt0Bridge bridge = new Usdt0Bridge(signer, "arbitrum");

        Set<String> destinations = bridge.getSupportedDestinations();

        assertFalse(destinations.isEmpty());
        assertFalse(destinations.contains("arbitrum")); // Should not include source chain
        assertTrue(destinations.contains("ethereum"));
    }

    @Test
    void supportsDestination() {
        MockBridgeSigner signer = new MockBridgeSigner("0x1234567890abcdef1234567890abcdef12345678");
        Usdt0Bridge bridge = new Usdt0Bridge(signer, "arbitrum");

        assertTrue(bridge.supportsDestination("ethereum"));
        assertTrue(bridge.supportsDestination("base"));
        assertFalse(bridge.supportsDestination("arbitrum")); // Same chain
        assertFalse(bridge.supportsDestination("unknown"));
    }

    @Test
    void quoteRejectsChainMismatch() {
        MockBridgeSigner signer = new MockBridgeSigner("0x1234567890abcdef1234567890abcdef12345678");
        Usdt0Bridge bridge = new Usdt0Bridge(signer, "arbitrum");

        BridgeQuoteParams params = new BridgeQuoteParams(
            "ethereum", // Wrong source chain
            "base",
            BigInteger.valueOf(100_000000),
            "0xrecipient1234567890abcdef1234567890abcdef"
        );

        assertThrows(IllegalArgumentException.class, () -> bridge.quote(params));
    }

    @Test
    void quoteRejectsSameChain() {
        MockBridgeSigner signer = new MockBridgeSigner("0x1234567890abcdef1234567890abcdef12345678");
        Usdt0Bridge bridge = new Usdt0Bridge(signer, "arbitrum");

        BridgeQuoteParams params = new BridgeQuoteParams(
            "arbitrum",
            "arbitrum", // Same chain
            BigInteger.valueOf(100_000000),
            "0xrecipient1234567890abcdef1234567890abcdef"
        );

        assertThrows(IllegalArgumentException.class, () -> bridge.quote(params));
    }

    @Test
    void quoteRejectsZeroAmount() {
        MockBridgeSigner signer = new MockBridgeSigner("0x1234567890abcdef1234567890abcdef12345678");
        Usdt0Bridge bridge = new Usdt0Bridge(signer, "arbitrum");

        BridgeQuoteParams params = new BridgeQuoteParams(
            "arbitrum",
            "ethereum",
            BigInteger.ZERO, // Zero amount
            "0xrecipient1234567890abcdef1234567890abcdef"
        );

        assertThrows(IllegalArgumentException.class, () -> bridge.quote(params));
    }

    @Test
    void quoteRejectsNegativeAmount() {
        MockBridgeSigner signer = new MockBridgeSigner("0x1234567890abcdef1234567890abcdef12345678");
        Usdt0Bridge bridge = new Usdt0Bridge(signer, "arbitrum");

        BridgeQuoteParams params = new BridgeQuoteParams(
            "arbitrum",
            "ethereum",
            BigInteger.valueOf(-100), // Negative amount
            "0xrecipient1234567890abcdef1234567890abcdef"
        );

        assertThrows(IllegalArgumentException.class, () -> bridge.quote(params));
    }

    @Test
    void quoteRejectsUnsupportedDestination() {
        MockBridgeSigner signer = new MockBridgeSigner("0x1234567890abcdef1234567890abcdef12345678");
        Usdt0Bridge bridge = new Usdt0Bridge(signer, "arbitrum");

        BridgeQuoteParams params = new BridgeQuoteParams(
            "arbitrum",
            "unknown", // Unsupported destination
            BigInteger.valueOf(100_000000),
            "0xrecipient1234567890abcdef1234567890abcdef"
        );

        assertThrows(IllegalArgumentException.class, () -> bridge.quote(params));
    }
}
