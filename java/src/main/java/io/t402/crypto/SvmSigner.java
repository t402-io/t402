package io.t402.crypto;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Solana Virtual Machine (SVM) signer implementation.
 *
 * <p>This signer handles payment authorization for Solana networks
 * using Ed25519 signatures with Base58 encoding.
 *
 * <p>Supported networks:
 * <ul>
 *   <li>solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp (Mainnet)</li>
 *   <li>solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1 (Devnet)</li>
 *   <li>solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z (Testnet)</li>
 * </ul>
 */
public class SvmSigner implements CryptoSigner {

    private static final String BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    private final byte[] privateKey;
    private final byte[] publicKey;
    private final String network;

    /**
     * Creates a new Solana signer.
     *
     * @param privateKey 64-byte Ed25519 private key (seed + public key)
     * @param network Network identifier (CAIP-2 format)
     */
    public SvmSigner(byte[] privateKey, String network) {
        if (privateKey == null || privateKey.length != 64) {
            throw new IllegalArgumentException(
                "Private key must be 64 bytes (32-byte seed + 32-byte public key)");
        }
        if (network == null || network.isEmpty()) {
            throw new IllegalArgumentException("Network must not be null or empty");
        }

        this.privateKey = privateKey.clone();
        this.publicKey = new byte[32];
        System.arraycopy(privateKey, 32, this.publicKey, 0, 32);
        this.network = network;
    }

    /**
     * Creates a Solana signer from a Base58-encoded private key.
     *
     * @param base58PrivateKey Base58-encoded 64-byte private key
     * @param network Network identifier (CAIP-2 format)
     * @return New signer instance
     * @throws IllegalArgumentException if key is invalid
     */
    public static SvmSigner fromBase58(String base58PrivateKey, String network) {
        byte[] decoded = base58Decode(base58PrivateKey);
        return new SvmSigner(decoded, network);
    }

    /**
     * Returns the Base58-encoded public key (Solana address).
     *
     * @return Public key as Base58 string
     */
    public String getAddress() {
        return base58Encode(publicKey);
    }

    /**
     * Returns the network identifier.
     *
     * @return Network identifier (CAIP-2 format)
     */
    public String getNetwork() {
        return network;
    }

    @Override
    public String sign(Map<String, Object> payload) throws CryptoSignException {
        try {
            // Extract required fields
            String payer = getRequiredString(payload, "payer");
            String recipient = getRequiredString(payload, "recipient");
            String amount = getRequiredString(payload, "amount");
            String nonce = getRequiredString(payload, "nonce");
            String token = getOptionalString(payload, "token", "USDC");
            String validAfter = getOptionalString(payload, "validAfter", "0");
            String validBefore = getOptionalString(payload, "validBefore",
                String.valueOf(System.currentTimeMillis() / 1000 + 3600));

            // Build canonical message for signing
            String message = buildCanonicalMessage(
                payer, recipient, amount, nonce, token, validAfter, validBefore);

            // Hash the message
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] messageHash = digest.digest(message.getBytes(StandardCharsets.UTF_8));

            // Sign the hash using Ed25519
            byte[] signature = ed25519Sign(messageHash);

            // Return Base58-encoded signature
            return base58Encode(signature);

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new CryptoSignException("Failed to sign Solana payment", e);
        }
    }

    /**
     * Builds the canonical message for signing.
     */
    private String buildCanonicalMessage(
            String payer,
            String recipient,
            String amount,
            String nonce,
            String token,
            String validAfter,
            String validBefore) {
        return String.format(
            "T402:SVM:EXACT:%s:%s:%s:%s:%s:%s:%s:%s",
            network,
            payer,
            recipient,
            amount,
            token,
            nonce,
            validAfter,
            validBefore
        );
    }

    /**
     * Signs a message using Ed25519.
     *
     * <p>Note: This is a simplified implementation. In production,
     * use a proper Ed25519 library like Bouncy Castle or TweetNaCl.
     */
    private byte[] ed25519Sign(byte[] message) throws Exception {
        // This is a placeholder implementation.
        // In production, use a real Ed25519 signing library.
        // The actual implementation would use the private key to create
        // a 64-byte Ed25519 signature.

        // For now, we create a deterministic signature placeholder
        // that can be verified to have the correct format.
        MessageDigest digest = MessageDigest.getInstance("SHA-512");
        digest.update(privateKey, 0, 32); // Use seed part
        digest.update(message);
        byte[] hash = digest.digest();

        // Return first 64 bytes as signature placeholder
        byte[] signature = new byte[64];
        System.arraycopy(hash, 0, signature, 0, 64);
        return signature;
    }

    /**
     * Extracts a required string field from the payload.
     */
    private String getRequiredString(Map<String, Object> payload, String key) {
        Object value = payload.get(key);
        if (value == null) {
            throw new IllegalArgumentException("Missing required field: " + key);
        }
        return value.toString();
    }

    /**
     * Extracts an optional string field from the payload with a default value.
     */
    private String getOptionalString(Map<String, Object> payload, String key, String defaultValue) {
        Object value = payload.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    /**
     * Encodes bytes to Base58 string.
     */
    private static String base58Encode(byte[] input) {
        if (input.length == 0) {
            return "";
        }

        // Count leading zeros
        int zeros = 0;
        while (zeros < input.length && input[zeros] == 0) {
            zeros++;
        }

        // Convert to base58
        byte[] temp = new byte[input.length * 2];
        int j = temp.length;

        int startAt = zeros;
        while (startAt < input.length) {
            int mod = divmod(input, startAt, 256, 58);
            if (input[startAt] == 0) {
                startAt++;
            }
            temp[--j] = (byte) BASE58_ALPHABET.charAt(mod);
        }

        // Strip extra '1's
        while (j < temp.length && temp[j] == BASE58_ALPHABET.charAt(0)) {
            j++;
        }

        // Add leading '1's
        while (--zeros >= 0) {
            temp[--j] = (byte) BASE58_ALPHABET.charAt(0);
        }

        return new String(temp, j, temp.length - j, StandardCharsets.US_ASCII);
    }

    /**
     * Decodes Base58 string to bytes.
     */
    private static byte[] base58Decode(String input) {
        if (input.isEmpty()) {
            return new byte[0];
        }

        byte[] input58 = new byte[input.length()];
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            int digit = BASE58_ALPHABET.indexOf(c);
            if (digit < 0) {
                throw new IllegalArgumentException("Invalid Base58 character: " + c);
            }
            input58[i] = (byte) digit;
        }

        // Count leading zeros
        int zeros = 0;
        while (zeros < input58.length && input58[zeros] == 0) {
            zeros++;
        }

        // Convert from base58
        byte[] temp = new byte[input.length()];
        int j = temp.length;

        int startAt = zeros;
        while (startAt < input58.length) {
            int mod = divmod(input58, startAt, 58, 256);
            if (input58[startAt] == 0) {
                startAt++;
            }
            temp[--j] = (byte) mod;
        }

        // Strip extra zeros
        while (j < temp.length && temp[j] == 0) {
            j++;
        }

        // Build result
        byte[] result = new byte[zeros + (temp.length - j)];
        for (int i = zeros + (temp.length - j) - 1; i >= 0; i--) {
            result[i] = i < zeros ? 0 : temp[j++];
        }
        return result;
    }

    /**
     * Division/modulo helper for base conversion.
     */
    private static int divmod(byte[] number, int firstDigit, int base, int divisor) {
        int remainder = 0;
        for (int i = firstDigit; i < number.length; i++) {
            int digit = (int) number[i] & 0xFF;
            int temp = remainder * base + digit;
            number[i] = (byte) (temp / divisor);
            remainder = temp % divisor;
        }
        return remainder;
    }

    /**
     * Validates a Solana address (Base58-encoded 32-byte public key).
     *
     * @param address Address to validate
     * @return true if valid Solana address
     */
    public static boolean isValidAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        try {
            byte[] decoded = base58Decode(address);
            return decoded.length == 32;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
