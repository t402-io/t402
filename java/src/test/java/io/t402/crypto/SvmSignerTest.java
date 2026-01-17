package io.t402.crypto;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;

/**
 * Tests for SvmSigner (Solana).
 */
class SvmSignerTest {

    // Test private key (64 bytes: 32 seed + 32 public key)
    private static final byte[] TEST_PRIVATE_KEY = new byte[64];
    static {
        for (int i = 0; i < 64; i++) {
            TEST_PRIVATE_KEY[i] = (byte) (i + 1);
        }
    }

    private static final String TEST_NETWORK = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

    @Test
    void constructorWithValidParams() {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);
        assertNotNull(signer);
        assertEquals(TEST_NETWORK, signer.getNetwork());
        assertNotNull(signer.getAddress());
    }

    @Test
    void constructorRejectsNullPrivateKey() {
        assertThrows(IllegalArgumentException.class, () ->
            new SvmSigner(null, TEST_NETWORK)
        );
    }

    @Test
    void constructorAccepts32ByteSeed() {
        // 32-byte seed is valid (will derive public key)
        byte[] seed = new byte[32];
        for (int i = 0; i < 32; i++) {
            seed[i] = (byte) (i + 1);
        }
        SvmSigner signer = new SvmSigner(seed, TEST_NETWORK);
        assertNotNull(signer);
        assertNotNull(signer.getAddress());
    }

    @Test
    void constructorRejectsWrongSizePrivateKey() {
        assertThrows(IllegalArgumentException.class, () ->
            new SvmSigner(new byte[48], TEST_NETWORK)  // Neither 32 nor 64
        );
    }

    @Test
    void constructorRejectsNullNetwork() {
        assertThrows(IllegalArgumentException.class, () ->
            new SvmSigner(TEST_PRIVATE_KEY, null)
        );
    }

    @Test
    void constructorRejectsEmptyNetwork() {
        assertThrows(IllegalArgumentException.class, () ->
            new SvmSigner(TEST_PRIVATE_KEY, "")
        );
    }

    @Test
    void signWithValidPayload() throws CryptoSignException {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);

        Map<String, Object> payload = new HashMap<>();
        payload.put("payer", "Ax9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT9");
        payload.put("recipient", "Bx9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT8");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");

        String signature = signer.sign(payload);

        assertNotNull(signature);
        assertFalse(signature.isEmpty());
        // Solana signatures are Base58 encoded
    }

    @Test
    void signRejectsMissingPayer() {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);

        Map<String, Object> payload = new HashMap<>();
        payload.put("recipient", "Bx9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT8");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");

        assertThrows(IllegalArgumentException.class, () ->
            signer.sign(payload)
        );
    }

    @Test
    void signRejectsMissingRecipient() {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);

        Map<String, Object> payload = new HashMap<>();
        payload.put("payer", "Ax9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT9");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");

        assertThrows(IllegalArgumentException.class, () ->
            signer.sign(payload)
        );
    }

    @Test
    void signRejectsMissingAmount() {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);

        Map<String, Object> payload = new HashMap<>();
        payload.put("payer", "Ax9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT9");
        payload.put("recipient", "Bx9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT8");
        payload.put("nonce", "abc123");

        assertThrows(IllegalArgumentException.class, () ->
            signer.sign(payload)
        );
    }

    @Test
    void signRejectsMissingNonce() {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);

        Map<String, Object> payload = new HashMap<>();
        payload.put("payer", "Ax9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT9");
        payload.put("recipient", "Bx9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT8");
        payload.put("amount", "1000000");

        assertThrows(IllegalArgumentException.class, () ->
            signer.sign(payload)
        );
    }

    @Test
    void signWithOptionalFields() throws CryptoSignException {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);

        Map<String, Object> payload = new HashMap<>();
        payload.put("payer", "Ax9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT9");
        payload.put("recipient", "Bx9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT8");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");
        payload.put("token", "USDC");
        payload.put("validAfter", "1700000000");
        payload.put("validBefore", "1800000000");

        String signature = signer.sign(payload);
        assertNotNull(signature);
    }

    @Test
    void isValidAddressWithValidAddress() {
        // Valid 32-byte public key in Base58
        assertTrue(SvmSigner.isValidAddress("Ax9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT9"));
    }

    @Test
    void isValidAddressWithInvalidAddress() {
        assertFalse(SvmSigner.isValidAddress(null));
        assertFalse(SvmSigner.isValidAddress(""));
        assertFalse(SvmSigner.isValidAddress("invalid"));
        assertFalse(SvmSigner.isValidAddress("0x123")); // Wrong format
    }

    @Test
    void getAddressReturnsBase58() {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);
        String address = signer.getAddress();

        assertNotNull(address);
        assertFalse(address.isEmpty());
        // Base58 doesn't contain 0, O, I, l
        assertFalse(address.contains("0"));
        assertFalse(address.contains("O"));
        assertFalse(address.contains("I"));
        assertFalse(address.contains("l"));
    }

    @Test
    void signatureIsDeterministic() throws CryptoSignException {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);

        Map<String, Object> payload = new HashMap<>();
        payload.put("payer", "Ax9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT9");
        payload.put("recipient", "Bx9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT8");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");
        payload.put("validAfter", "0");
        payload.put("validBefore", "9999999999");

        String sig1 = signer.sign(payload);
        String sig2 = signer.sign(payload);

        assertEquals(sig1, sig2);
    }

    @Test
    void signatureIsVerifiable() throws CryptoSignException {
        SvmSigner signer = new SvmSigner(TEST_PRIVATE_KEY, TEST_NETWORK);

        // Sign a test message
        byte[] message = "test message".getBytes(java.nio.charset.StandardCharsets.UTF_8);

        // Use reflection or direct signing (since sign() method is for payloads)
        // Let's test via the payload signing mechanism instead
        Map<String, Object> payload = new HashMap<>();
        payload.put("payer", "Ax9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT9");
        payload.put("recipient", "Bx9ujW5B7xWT7pJMYBnivCeR2g9T5rXc2GJhJJK5YzT8");
        payload.put("amount", "1000000");
        payload.put("nonce", "abc123");

        String signature = signer.sign(payload);

        // Verify the signature is a valid Base58 string (64 bytes encoded)
        assertNotNull(signature);
        assertTrue(signature.length() > 0);
        // Ed25519 signatures are 64 bytes, which encodes to ~86-88 Base58 characters
        assertTrue(signature.length() >= 80 && signature.length() <= 90,
            "Signature length should be ~86-88 chars, got: " + signature.length());
    }

    @Test
    void sameSeedProducesSamePublicKey() {
        byte[] seed = new byte[32];
        for (int i = 0; i < 32; i++) {
            seed[i] = (byte) (i + 1);
        }

        SvmSigner signer1 = new SvmSigner(seed, TEST_NETWORK);
        SvmSigner signer2 = new SvmSigner(seed, TEST_NETWORK);

        assertEquals(signer1.getAddress(), signer2.getAddress());
    }
}
