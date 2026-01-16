package io.t402.crypto;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

/**
 * TON (The Open Network) signer implementation.
 *
 * <p>This signer handles payment authorization for TON networks
 * using Ed25519 signatures.
 *
 * <p>Supported networks:
 * <ul>
 *   <li>ton:mainnet (TON Mainnet)</li>
 *   <li>ton:testnet (TON Testnet)</li>
 * </ul>
 */
public class TonSigner implements CryptoSigner {

    /** TON Mainnet network identifier. */
    public static final String MAINNET = "ton:mainnet";

    /** TON Testnet network identifier. */
    public static final String TESTNET = "ton:testnet";

    private final byte[] privateKey;
    private final byte[] publicKey;
    private final String network;

    /**
     * Creates a new TON signer.
     *
     * @param privateKey 64-byte Ed25519 private key (seed + public key)
     * @param network Network identifier (e.g., "ton:mainnet")
     */
    public TonSigner(byte[] privateKey, String network) {
        if (privateKey == null || privateKey.length != 64) {
            throw new IllegalArgumentException(
                "Private key must be 64 bytes (32-byte seed + 32-byte public key)");
        }
        if (network == null || network.isEmpty()) {
            throw new IllegalArgumentException("Network must not be null or empty");
        }
        if (!isValidNetwork(network)) {
            throw new IllegalArgumentException("Invalid TON network: " + network);
        }

        this.privateKey = privateKey.clone();
        this.publicKey = new byte[32];
        System.arraycopy(privateKey, 32, this.publicKey, 0, 32);
        this.network = network;
    }

    /**
     * Creates a TON signer from a hex-encoded private key.
     *
     * @param hexPrivateKey Hex-encoded 64-byte private key
     * @param network Network identifier
     * @return New signer instance
     */
    public static TonSigner fromHex(String hexPrivateKey, String network) {
        byte[] decoded = hexDecode(hexPrivateKey);
        return new TonSigner(decoded, network);
    }

    /**
     * Returns the hex-encoded public key.
     *
     * @return Public key as hex string
     */
    public String getPublicKeyHex() {
        return hexEncode(publicKey);
    }

    /**
     * Returns the network identifier.
     *
     * @return Network identifier
     */
    public String getNetwork() {
        return network;
    }

    @Override
    public String sign(Map<String, Object> payload) throws CryptoSignException {
        try {
            // Extract required fields
            String sender = getRequiredString(payload, "sender");
            String recipient = getRequiredString(payload, "recipient");
            String amount = getRequiredString(payload, "amount");
            String nonce = getRequiredString(payload, "nonce");
            String token = getOptionalString(payload, "token", "USDT");
            String validUntil = getOptionalString(payload, "validUntil",
                String.valueOf(System.currentTimeMillis() / 1000 + 3600));

            // Build canonical message for signing
            String message = buildCanonicalMessage(
                sender, recipient, amount, nonce, token, validUntil);

            // Hash the message using SHA-256
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] messageHash = digest.digest(message.getBytes(StandardCharsets.UTF_8));

            // Sign the hash using Ed25519
            byte[] signature = ed25519Sign(messageHash);

            // Return Base64-encoded signature
            return Base64.getEncoder().encodeToString(signature);

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new CryptoSignException("Failed to sign TON payment", e);
        }
    }

    /**
     * Builds the canonical message for signing.
     */
    private String buildCanonicalMessage(
            String sender,
            String recipient,
            String amount,
            String nonce,
            String token,
            String validUntil) {
        return String.format(
            "T402:TON:EXACT:%s:%s:%s:%s:%s:%s:%s",
            network,
            sender,
            recipient,
            amount,
            token,
            nonce,
            validUntil
        );
    }

    /**
     * Signs a message using Ed25519.
     *
     * <p>Note: This is a simplified implementation. In production,
     * use a proper Ed25519 library.
     */
    private byte[] ed25519Sign(byte[] message) throws Exception {
        // Placeholder implementation - in production use real Ed25519
        MessageDigest digest = MessageDigest.getInstance("SHA-512");
        digest.update(privateKey, 0, 32);
        digest.update(message);
        byte[] hash = digest.digest();

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
     * Extracts an optional string field with a default value.
     */
    private String getOptionalString(Map<String, Object> payload, String key, String defaultValue) {
        Object value = payload.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    /**
     * Checks if a network identifier is valid for TON.
     *
     * @param network Network identifier
     * @return true if valid TON network
     */
    public static boolean isValidNetwork(String network) {
        return MAINNET.equals(network) || TESTNET.equals(network);
    }

    /**
     * Validates a TON address.
     *
     * <p>TON addresses can be in raw format (hex workchain:hash)
     * or user-friendly format (Base64).
     *
     * @param address Address to validate
     * @return true if potentially valid address format
     */
    public static boolean isValidAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }

        // Check for raw format (workchain:hash)
        if (address.contains(":")) {
            String[] parts = address.split(":");
            if (parts.length != 2) {
                return false;
            }
            try {
                Integer.parseInt(parts[0]);
                byte[] hash = hexDecode(parts[1]);
                return hash.length == 32;
            } catch (Exception e) {
                return false;
            }
        }

        // Check for user-friendly format (bounceable EQ... or non-bounceable UQ...)
        // These use URL-safe Base64 encoding and are 48 chars
        if (address.length() == 48 && (address.startsWith("EQ") || address.startsWith("UQ"))) {
            try {
                // URL-safe Base64 decode
                String normalized = address.replace('-', '+').replace('_', '/');
                byte[] decoded = Base64.getDecoder().decode(normalized);
                // Valid TON address decodes to 36 bytes (1 tag + 1 workchain + 32 hash + 2 crc)
                return decoded.length == 36;
            } catch (IllegalArgumentException e) {
                return false;
            }
        }

        // Check for standard Base64 format (48 chars)
        if (address.length() == 48) {
            try {
                byte[] decoded = Base64.getDecoder().decode(address);
                return decoded.length == 36;
            } catch (IllegalArgumentException e) {
                // Try URL-safe as fallback
                try {
                    String normalized = address.replace('-', '+').replace('_', '/');
                    byte[] decoded = Base64.getDecoder().decode(normalized);
                    return decoded.length == 36;
                } catch (IllegalArgumentException e2) {
                    return false;
                }
            }
        }

        return false;
    }

    /**
     * Encodes bytes to hex string.
     */
    private static String hexEncode(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b & 0xFF));
        }
        return sb.toString();
    }

    /**
     * Decodes hex string to bytes.
     */
    private static byte[] hexDecode(String hex) {
        String cleanHex = hex.startsWith("0x") ? hex.substring(2) : hex;
        int len = cleanHex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(cleanHex.charAt(i), 16) << 4)
                                + Character.digit(cleanHex.charAt(i + 1), 16));
        }
        return data;
    }
}
