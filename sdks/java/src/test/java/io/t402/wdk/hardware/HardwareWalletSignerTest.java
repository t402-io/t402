package io.t402.wdk.hardware;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for HardwareWalletSigner.
 */
class HardwareWalletSignerTest {

    @Test
    void hardwareWalletTypeValues() {
        assertEquals("ledger", HardwareWalletType.LEDGER.getValue());
        assertEquals("trezor", HardwareWalletType.TREZOR.getValue());
    }

    @Test
    void configDefaultValues() {
        HardwareWalletConfig config = new HardwareWalletConfig(HardwareWalletType.LEDGER);
        assertEquals(HardwareWalletType.LEDGER, config.getWalletType());
        assertEquals(HardwareWalletConfig.DEFAULT_DERIVATION_PATH, config.getDerivationPath());
        assertEquals(1, config.getChainId());
    }

    @Test
    void configCustomValues() {
        HardwareWalletConfig config = new HardwareWalletConfig(
                HardwareWalletType.TREZOR, "m/44'/60'/0'/0/1", 42161);
        assertEquals(HardwareWalletType.TREZOR, config.getWalletType());
        assertEquals(42161, config.getChainId());
    }

    @Test
    void configRequiresWalletType() {
        assertThrows(IllegalArgumentException.class, () ->
                new HardwareWalletConfig(null));
    }

    @Test
    void createSigner() {
        HardwareWalletConfig config = new HardwareWalletConfig(HardwareWalletType.LEDGER);
        HardwareWalletSigner signer = new HardwareWalletSigner(config);
        assertNotNull(signer);
        assertFalse(signer.isConnected());
        assertEquals(HardwareWalletType.LEDGER, signer.getWalletType());
    }

    @Test
    void createSignerRequiresConfig() {
        assertThrows(IllegalArgumentException.class, () ->
                new HardwareWalletSigner(null));
    }

    @Test
    void connect() throws Exception {
        HardwareWalletSigner signer = createSigner(HardwareWalletType.LEDGER);
        Boolean result = signer.connect().get();
        assertTrue(result);
        assertTrue(signer.isConnected());
    }

    @Test
    void getAddress() throws Exception {
        HardwareWalletSigner signer = createSigner(HardwareWalletType.LEDGER);
        signer.connect().get();

        String address = signer.getAddress().get();
        assertNotNull(address);
        assertTrue(address.startsWith("0x"));
    }

    @Test
    void getAddressNotConnected() {
        HardwareWalletSigner signer = createSigner(HardwareWalletType.LEDGER);
        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                signer.getAddress().get());
        assertTrue(ex.getCause() instanceof IllegalStateException);
        assertTrue(ex.getCause().getMessage().contains("not connected"));
    }

    @Test
    void signMessage() throws Exception {
        HardwareWalletSigner signer = createSigner(HardwareWalletType.LEDGER);
        signer.connect().get();

        byte[] signature = signer.signMessage("Hello, T402!".getBytes()).get();
        assertNotNull(signature);
        assertEquals(65, signature.length);
    }

    @Test
    void signMessageNotConnected() {
        HardwareWalletSigner signer = createSigner(HardwareWalletType.LEDGER);
        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                signer.signMessage("Hello".getBytes()).get());
        assertTrue(ex.getCause() instanceof IllegalStateException);
        assertTrue(ex.getCause().getMessage().contains("not connected"));
    }

    @Test
    void signMessageEmpty() throws Exception {
        HardwareWalletSigner signer = createSigner(HardwareWalletType.LEDGER);
        signer.connect().get();

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                signer.signMessage(new byte[0]).get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("empty"));
    }

    @Test
    void signTypedData() throws Exception {
        HardwareWalletSigner signer = createSigner(HardwareWalletType.LEDGER);
        signer.connect().get();

        byte[] signature = signer.signTypedData(
                Map.of("name", "Test", "version", "1"),
                Map.of("Message", Map.of("content", "string")),
                Map.of("content", "Hello")).get();
        assertNotNull(signature);
        assertEquals(65, signature.length);
    }

    @Test
    void disconnect() throws Exception {
        HardwareWalletSigner signer = createSigner(HardwareWalletType.LEDGER);
        signer.connect().get();
        assertTrue(signer.isConnected());

        signer.disconnect().get();
        assertFalse(signer.isConnected());
    }

    @Test
    void disconnectClearsAddress() throws Exception {
        HardwareWalletSigner signer = createSigner(HardwareWalletType.LEDGER);
        signer.connect().get();
        signer.getAddress().get(); // Cache the address
        signer.disconnect().get();
        signer.connect().get();

        // Address should be re-derived after reconnect
        String address = signer.getAddress().get();
        assertNotNull(address);
    }

    private HardwareWalletSigner createSigner(HardwareWalletType type) {
        HardwareWalletConfig config = new HardwareWalletConfig(type);
        return new HardwareWalletSigner(config);
    }
}
