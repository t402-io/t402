package io.t402.crypto;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Tests for TronSigner.
 */
class TronSignerTest {

    // Test private key (32 bytes for secp256k1)
    private static final byte[] TEST_PRIVATE_KEY = new byte[32];
    static {
        for (int i = 0; i < 32; i++) {
            TEST_PRIVATE_KEY[i] = (byte) (i + 1);
        }
    }

    @Test
    void constructorWithMainnet() {
        TronSigner signer = new TronSigner(TEST_PRIVATE_KEY, TronSigner.MAINNET);
        assertNotNull(signer);
        assertEquals(TronSigner.MAINNET, signer.getNetwork());
    }

    @Test
    void constructorWithNile() {
        TronSigner signer = new TronSigner(TEST_PRIVATE_KEY, TronSigner.NILE);
        assertNotNull(signer);
        assertEquals(TronSigner.NILE, signer.getNetwork());
    }

    @Test
    void constructorWithShasta() {
        TronSigner signer = new TronSigner(TEST_PRIVATE_KEY, TronSigner.SHASTA);
        assertNotNull(signer);
        assertEquals(TronSigner.SHASTA, signer.getNetwork());
    }

    @Test
    void constructorRejectsNullPrivateKey() {
        assertThrows(IllegalArgumentException.class, () ->
            new TronSigner(null, TronSigner.MAINNET)
        );
    }

    @Test
    void constructorRejectsWrongSizePrivateKey() {
        assertThrows(IllegalArgumentException.class, () ->
            new TronSigner(new byte[64], TronSigner.MAINNET)
        );
    }

    @Test
    void constructorRejectsInvalidNetwork() {
        assertThrows(IllegalArgumentException.class, () ->
            new TronSigner(TEST_PRIVATE_KEY, "invalid:network")
        );
    }

    @Test
    void signWithValidPayload() throws CryptoSignException {
        TronSigner signer = new TronSigner(TEST_PRIVATE_KEY, TronSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("from", "TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC");
        payload.put("to", "TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");

        String signature = signer.sign(payload);

        assertNotNull(signature);
        assertTrue(signature.startsWith("0x"));
        // ECDSA signatures are 65 bytes = 130 hex chars + "0x" = 132
        assertEquals(132, signature.length());
    }

    @Test
    void signRejectsMissingFrom() {
        TronSigner signer = new TronSigner(TEST_PRIVATE_KEY, TronSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("to", "TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");

        assertThrows(IllegalArgumentException.class, () ->
            signer.sign(payload)
        );
    }

    @Test
    void signRejectsMissingTo() {
        TronSigner signer = new TronSigner(TEST_PRIVATE_KEY, TronSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("from", "TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");

        assertThrows(IllegalArgumentException.class, () ->
            signer.sign(payload)
        );
    }

    @Test
    void signWithOptionalFields() throws CryptoSignException {
        TronSigner signer = new TronSigner(TEST_PRIVATE_KEY, TronSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("from", "TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC");
        payload.put("to", "TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");
        payload.put("token", "USDT");
        payload.put("validAfter", "1700000000");
        payload.put("validBefore", "1800000000");

        String signature = signer.sign(payload);
        assertNotNull(signature);
    }

    @Test
    void isValidNetworkWithValidNetworks() {
        assertTrue(TronSigner.isValidNetwork(TronSigner.MAINNET));
        assertTrue(TronSigner.isValidNetwork(TronSigner.NILE));
        assertTrue(TronSigner.isValidNetwork(TronSigner.SHASTA));
    }

    @Test
    void isValidNetworkWithInvalidNetworks() {
        assertFalse(TronSigner.isValidNetwork("invalid"));
        assertFalse(TronSigner.isValidNetwork("tron:invalid"));
        assertFalse(TronSigner.isValidNetwork(null));
    }

    @Test
    void isValidAddressWithValidAddress() {
        // Valid TRON addresses start with 'T' and are 34 chars
        assertTrue(TronSigner.isValidAddress("TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC"));
        assertTrue(TronSigner.isValidAddress("TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb"));
    }

    @Test
    void isValidAddressWithInvalidAddress() {
        assertFalse(TronSigner.isValidAddress(null));
        assertFalse(TronSigner.isValidAddress(""));
        assertFalse(TronSigner.isValidAddress("invalid"));
        assertFalse(TronSigner.isValidAddress("0x1234")); // EVM format
        assertFalse(TronSigner.isValidAddress("BJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC")); // Wrong prefix
        assertFalse(TronSigner.isValidAddress("TJRyWwFs9wTFGZg3JbrVriFbNfCug5")); // Too short
    }

    @Test
    void getAddressStartsWithT() {
        TronSigner signer = new TronSigner(TEST_PRIVATE_KEY, TronSigner.MAINNET);
        String address = signer.getAddress();

        assertNotNull(address);
        assertTrue(address.startsWith("T"));
        assertEquals(34, address.length());
    }

    @Test
    void signatureIsDeterministic() throws CryptoSignException {
        TronSigner signer = new TronSigner(TEST_PRIVATE_KEY, TronSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("from", "TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC");
        payload.put("to", "TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");
        payload.put("validAfter", "0");
        payload.put("validBefore", "9999999999");

        String sig1 = signer.sign(payload);
        String sig2 = signer.sign(payload);

        assertEquals(sig1, sig2);
    }

    @Test
    void fromHexCreatesValidSigner() {
        String hexKey = "0102030405060708091011121314151617181920212223242526272829303132";
        TronSigner signer = TronSigner.fromHex(hexKey, TronSigner.MAINNET);

        assertNotNull(signer);
        assertNotNull(signer.getAddress());
    }

    @Test
    void fromHexWithOxPrefix() {
        String hexKey = "0x0102030405060708091011121314151617181920212223242526272829303132";
        TronSigner signer = TronSigner.fromHex(hexKey, TronSigner.MAINNET);

        assertNotNull(signer);
    }
}
