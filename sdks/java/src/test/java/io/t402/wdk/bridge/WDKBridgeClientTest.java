package io.t402.wdk.bridge;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for WDKBridgeClient.
 */
class WDKBridgeClientTest {

    private static final String RECIPIENT = "0x" + "1".repeat(40);

    @Test
    void configDefaultValues() {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        assertTrue(config.getRpcUrls().isEmpty());
        assertEquals(0.5, config.getDefaultSlippage());
        assertEquals(600_000, config.getTimeoutMs());
    }

    @Test
    void configCustomValues() {
        WDKBridgeConfig config = new WDKBridgeConfig(
                Map.of("arbitrum", "https://arb1.arbitrum.io/rpc"),
                1.0, 300_000);
        assertEquals(1, config.getRpcUrls().size());
        assertEquals(1.0, config.getDefaultSlippage());
    }

    @Test
    void configNullRpcUrls() {
        WDKBridgeConfig config = new WDKBridgeConfig(null);
        assertNotNull(config.getRpcUrls());
        assertTrue(config.getRpcUrls().isEmpty());
    }

    @Test
    void createClient() {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);
        assertNotNull(client);
        assertEquals(config, client.getConfig());
    }

    @Test
    void createClientRequiresConfig() {
        assertThrows(IllegalArgumentException.class, () ->
                new WDKBridgeClient(null));
    }

    @Test
    void getSupportedChains() {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);
        List<String> chains = client.getSupportedChains();
        assertNotNull(chains);
        assertFalse(chains.isEmpty());
        assertTrue(chains.contains("ethereum"));
        assertTrue(chains.contains("arbitrum"));
    }

    @Test
    void bridgeRequiresSigner() {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);
        WDKBridgeParams params = new WDKBridgeParams(
                "eip155:42161", "eip155:1",
                BigInteger.valueOf(100_000000), RECIPIENT);

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.bridge(params).get());
        assertTrue(ex.getCause() instanceof IllegalStateException);
        assertTrue(ex.getCause().getMessage().contains("No signer"));
    }

    @Test
    void bridgeValidatesSameNetwork() {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);
        WDKBridgeParams params = new WDKBridgeParams(
                "eip155:42161", "eip155:42161",
                BigInteger.valueOf(100_000000), RECIPIENT);

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.bridge(params).get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("must be different"));
    }

    @Test
    void bridgeValidatesZeroAmount() {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);
        WDKBridgeParams params = new WDKBridgeParams(
                "eip155:42161", "eip155:1",
                BigInteger.ZERO, RECIPIENT);

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.bridge(params).get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("greater than zero"));
    }

    @Test
    void bridgeValidatesZeroAddress() {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);
        WDKBridgeParams params = new WDKBridgeParams(
                "eip155:42161", "eip155:1",
                BigInteger.valueOf(100_000000),
                "0x" + "0".repeat(40));

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.bridge(params).get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("zero address"));
    }

    @Test
    void bridgeValidatesEmptyRecipient() {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);
        WDKBridgeParams params = new WDKBridgeParams(
                "eip155:42161", "eip155:1",
                BigInteger.valueOf(100_000000), "");

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.bridge(params).get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("Recipient"));
    }

    @Test
    void getBridgeFee() throws Exception {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);
        WDKBridgeParams params = new WDKBridgeParams(
                "eip155:42161", "eip155:1",
                BigInteger.valueOf(100_000000), RECIPIENT);

        BigInteger fee = client.getBridgeFee(params).get();
        assertNotNull(fee);
        assertEquals(0, fee.compareTo(BigInteger.ZERO));
    }

    @Test
    void getBridgeStatusRequiresGuid() {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.getBridgeStatus("").get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
    }

    @Test
    void getBridgeStatus() throws Exception {
        WDKBridgeConfig config = new WDKBridgeConfig(Map.of());
        WDKBridgeClient client = new WDKBridgeClient(config);

        String status = client.getBridgeStatus("some-guid").get();
        assertEquals("UNKNOWN", status);
    }

    @Test
    void bridgeResultFields() {
        WDKBridgeResult result = new WDKBridgeResult(
                "0xhash", "guid-123", 120,
                "eip155:42161", "eip155:1",
                BigInteger.valueOf(100_000000));
        assertEquals("0xhash", result.getTxHash());
        assertEquals("guid-123", result.getMessageGuid());
        assertEquals(120, result.getEstimatedTime());
        assertEquals("eip155:42161", result.getFromNetwork());
        assertEquals("eip155:1", result.getToNetwork());
        assertEquals(BigInteger.valueOf(100_000000), result.getAmountSent());
    }
}
