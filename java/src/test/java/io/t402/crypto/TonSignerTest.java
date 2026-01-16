package io.t402.crypto;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Tests for TonSigner.
 */
class TonSignerTest {

    // Test private key (64 bytes: 32 seed + 32 public key)
    private static final byte[] TEST_PRIVATE_KEY = new byte[64];
    static {
        for (int i = 0; i < 64; i++) {
            TEST_PRIVATE_KEY[i] = (byte) (i + 1);
        }
    }

    @Test
    void constructorWithMainnet() {
        TonSigner signer = new TonSigner(TEST_PRIVATE_KEY, TonSigner.MAINNET);
        assertNotNull(signer);
        assertEquals(TonSigner.MAINNET, signer.getNetwork());
    }

    @Test
    void constructorWithTestnet() {
        TonSigner signer = new TonSigner(TEST_PRIVATE_KEY, TonSigner.TESTNET);
        assertNotNull(signer);
        assertEquals(TonSigner.TESTNET, signer.getNetwork());
    }

    @Test
    void constructorRejectsNullPrivateKey() {
        assertThrows(IllegalArgumentException.class, () ->
            new TonSigner(null, TonSigner.MAINNET)
        );
    }

    @Test
    void constructorRejectsWrongSizePrivateKey() {
        assertThrows(IllegalArgumentException.class, () ->
            new TonSigner(new byte[32], TonSigner.MAINNET)
        );
    }

    @Test
    void constructorRejectsInvalidNetwork() {
        assertThrows(IllegalArgumentException.class, () ->
            new TonSigner(TEST_PRIVATE_KEY, "invalid:network")
        );
    }

    @Test
    void signWithValidPayload() throws CryptoSignException {
        TonSigner signer = new TonSigner(TEST_PRIVATE_KEY, TonSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("sender", "EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA");
        payload.put("recipient", "EQDKbjIcfM6evt3NocSY_UzoHrB2z0KtOnM-TTqWiRhKzCy0");
        payload.put("amount", "1000000000");
        payload.put("nonce", "12345");

        String signature = signer.sign(payload);

        assertNotNull(signature);
        assertFalse(signature.isEmpty());
        // TON signatures are Base64 encoded
    }

    @Test
    void signRejectsMissingSender() {
        TonSigner signer = new TonSigner(TEST_PRIVATE_KEY, TonSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("recipient", "EQDKbjIcfM6evt3NocSY_UzoHrB2z0KtOnM-TTqWiRhKzCy0");
        payload.put("amount", "1000000000");
        payload.put("nonce", "12345");

        assertThrows(IllegalArgumentException.class, () ->
            signer.sign(payload)
        );
    }

    @Test
    void signRejectsMissingRecipient() {
        TonSigner signer = new TonSigner(TEST_PRIVATE_KEY, TonSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("sender", "EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA");
        payload.put("amount", "1000000000");
        payload.put("nonce", "12345");

        assertThrows(IllegalArgumentException.class, () ->
            signer.sign(payload)
        );
    }

    @Test
    void signWithOptionalFields() throws CryptoSignException {
        TonSigner signer = new TonSigner(TEST_PRIVATE_KEY, TonSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("sender", "EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA");
        payload.put("recipient", "EQDKbjIcfM6evt3NocSY_UzoHrB2z0KtOnM-TTqWiRhKzCy0");
        payload.put("amount", "1000000000");
        payload.put("nonce", "12345");
        payload.put("token", "USDT");
        payload.put("validUntil", "1800000000");

        String signature = signer.sign(payload);
        assertNotNull(signature);
    }

    @Test
    void isValidNetworkWithValidNetworks() {
        assertTrue(TonSigner.isValidNetwork(TonSigner.MAINNET));
        assertTrue(TonSigner.isValidNetwork(TonSigner.TESTNET));
    }

    @Test
    void isValidNetworkWithInvalidNetworks() {
        assertFalse(TonSigner.isValidNetwork("invalid"));
        assertFalse(TonSigner.isValidNetwork("ton:invalid"));
        assertFalse(TonSigner.isValidNetwork(null));
    }

    @Test
    void isValidAddressWithRawFormat() {
        // Raw format: workchain:hash
        // Need valid 32-byte hash in hex
        String rawAddress = "0:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        assertTrue(TonSigner.isValidAddress(rawAddress));
    }

    @Test
    void isValidAddressWithUserFriendlyFormat() {
        // User-friendly format: 48 chars Base64
        assertTrue(TonSigner.isValidAddress("EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA"));
    }

    @Test
    void isValidAddressWithInvalidAddress() {
        assertFalse(TonSigner.isValidAddress(null));
        assertFalse(TonSigner.isValidAddress(""));
        assertFalse(TonSigner.isValidAddress("invalid"));
        assertFalse(TonSigner.isValidAddress("0x1234")); // EVM format
    }

    @Test
    void getPublicKeyHexReturnsHex() {
        TonSigner signer = new TonSigner(TEST_PRIVATE_KEY, TonSigner.MAINNET);
        String publicKeyHex = signer.getPublicKeyHex();

        assertNotNull(publicKeyHex);
        assertEquals(64, publicKeyHex.length()); // 32 bytes = 64 hex chars
        assertTrue(publicKeyHex.matches("[0-9a-f]+"));
    }

    @Test
    void signatureIsDeterministic() throws CryptoSignException {
        TonSigner signer = new TonSigner(TEST_PRIVATE_KEY, TonSigner.MAINNET);

        Map<String, Object> payload = new HashMap<>();
        payload.put("sender", "EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA");
        payload.put("recipient", "EQDKbjIcfM6evt3NocSY_UzoHrB2z0KtOnM-TTqWiRhKzCy0");
        payload.put("amount", "1000000000");
        payload.put("nonce", "12345");
        payload.put("validUntil", "9999999999");

        String sig1 = signer.sign(payload);
        String sig2 = signer.sign(payload);

        assertEquals(sig1, sig2);
    }
}
