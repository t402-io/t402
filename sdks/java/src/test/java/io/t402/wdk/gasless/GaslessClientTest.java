package io.t402.wdk.gasless;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for GaslessClient.
 */
class GaslessClientTest {

    private static final String BUNDLER_URL = "https://bundler.example.com";
    private static final String PAYMASTER_URL = "https://paymaster.example.com";
    private static final String RECIPIENT = "0x" + "1".repeat(40);
    private static final String TOKEN = "0x" + "2".repeat(40);

    @Test
    void configDefaultValues() {
        GaslessConfig config = new GaslessConfig(BUNDLER_URL, PAYMASTER_URL);
        assertEquals(GaslessConfig.ENTRYPOINT_V07_ADDRESS, config.getEntryPoint());
        assertEquals(42161, config.getChainId());
        assertEquals(30000, config.getTimeoutMs());
    }

    @Test
    void configCustomValues() {
        GaslessConfig config = new GaslessConfig(
                BUNDLER_URL, PAYMASTER_URL, "0x1234", 8453, 60000);
        assertEquals(8453, config.getChainId());
        assertEquals(60000, config.getTimeoutMs());
    }

    @Test
    void configRequiresBundlerUrl() {
        assertThrows(IllegalArgumentException.class, () ->
                new GaslessConfig("", PAYMASTER_URL));
        assertThrows(IllegalArgumentException.class, () ->
                new GaslessConfig(null, PAYMASTER_URL));
    }

    @Test
    void createClient() {
        GaslessConfig config = new GaslessConfig(BUNDLER_URL, PAYMASTER_URL);
        GaslessClient client = new GaslessClient(config);
        assertNotNull(client);
        assertEquals(config, client.getConfig());
    }

    @Test
    void createClientRequiresConfig() {
        assertThrows(IllegalArgumentException.class, () ->
                new GaslessClient(null));
    }

    @Test
    void payRequiresSigner() {
        GaslessConfig config = new GaslessConfig(BUNDLER_URL, PAYMASTER_URL);
        GaslessClient client = new GaslessClient(config);
        GaslessPaymentParams params = new GaslessPaymentParams(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN, "eip155:42161");

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.pay(params).get());
        assertTrue(ex.getCause() instanceof IllegalStateException);
        assertTrue(ex.getCause().getMessage().contains("No signer"));
    }

    @Test
    void payValidatesZeroAddress() {
        GaslessConfig config = new GaslessConfig(BUNDLER_URL, PAYMASTER_URL);
        GaslessClient client = new GaslessClient(config);
        GaslessPaymentParams params = new GaslessPaymentParams(
                "0x" + "0".repeat(40), BigInteger.valueOf(1000000), TOKEN, "eip155:42161");

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.pay(params).get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("zero address"));
    }

    @Test
    void payValidatesZeroAmount() {
        GaslessConfig config = new GaslessConfig(BUNDLER_URL, PAYMASTER_URL);
        GaslessClient client = new GaslessClient(config);
        GaslessPaymentParams params = new GaslessPaymentParams(
                RECIPIENT, BigInteger.ZERO, TOKEN, "eip155:42161");

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.pay(params).get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("greater than zero"));
    }

    @Test
    void estimateGas() throws Exception {
        GaslessConfig config = new GaslessConfig(BUNDLER_URL, PAYMASTER_URL);
        GaslessClient client = new GaslessClient(config);
        GaslessPaymentParams params = new GaslessPaymentParams(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN, "eip155:42161");

        Long gas = client.estimateGas(params).get();
        assertNotNull(gas);
        assertTrue(gas > 0);
        assertEquals(300_000L, gas);
    }

    @Test
    void getAccountAddressRequiresSigner() {
        GaslessConfig config = new GaslessConfig(BUNDLER_URL, PAYMASTER_URL);
        GaslessClient client = new GaslessClient(config);

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.getAccountAddress().get());
        assertTrue(ex.getCause() instanceof IllegalStateException);
    }

    @Test
    void canSponsorWithoutPaymaster() throws Exception {
        GaslessConfig config = new GaslessConfig(BUNDLER_URL, "");
        GaslessClient client = new GaslessClient(config);
        GaslessPaymentParams params = new GaslessPaymentParams(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN, "eip155:42161");

        Boolean result = client.canSponsor(params).get();
        assertFalse(result);
    }

    @Test
    void canSponsorWithPaymaster() throws Exception {
        GaslessConfig config = new GaslessConfig(BUNDLER_URL, PAYMASTER_URL);
        GaslessClient client = new GaslessClient(config);
        GaslessPaymentParams params = new GaslessPaymentParams(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN, "eip155:42161");

        Boolean result = client.canSponsor(params).get();
        assertTrue(result);
    }

    @Test
    void paymentResultFields() {
        GaslessPaymentResult result = new GaslessPaymentResult(
                "0xhash", "0xtx", true, 150000, 100, true);
        assertEquals("0xhash", result.getUserOpHash());
        assertEquals("0xtx", result.getTxHash());
        assertTrue(result.isSuccess());
        assertEquals(150000, result.getGasUsed());
        assertEquals(100, result.getGasCost());
        assertTrue(result.isSponsored());
    }
}
