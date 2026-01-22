package io.t402.schemes.svm;

import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters;
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters;
import org.bouncycastle.crypto.signers.Ed25519Signer;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Reference implementation of ClientSvmSigner using BouncyCastle Ed25519.
 * <p>
 * Provides client-side transaction signing for Solana payments.
 * Uses the same signing approach as SolanajFacilitatorSigner for consistency.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * // From Base58 private key
 * SolanajClientSigner signer = SolanajClientSigner.fromBase58(
 *     "your-base58-private-key"
 * );
 *
 * // Or from raw bytes (32-byte seed or 64-byte keypair)
 * SolanajClientSigner signer = new SolanajClientSigner(privateKeyBytes);
 *
 * // Or from Solana CLI JSON format
 * SolanajClientSigner signer = SolanajClientSigner.fromJson(
 *     "[1,2,3,...64 numbers]"
 * );
 *
 * // Use with ExactSvmClientScheme
 * ExactSvmClientScheme scheme = new ExactSvmClientScheme(signer);
 *
 * // Create payment payload
 * Map<String, Object> requirements = ...;
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(
 *     requirements,
 *     () -> buildTransferTransaction(...)
 * );
 * }</pre>
 *
 * @see ClientSvmSigner
 */
public class SolanajClientSigner implements ClientSvmSigner {

    private static final int SIGNATURE_LENGTH = 64;

    private final Ed25519PrivateKeyParameters privateKey;
    private final Ed25519PublicKeyParameters publicKey;
    private final String address;
    private final Executor executor;

    /**
     * Creates a new SolanajClientSigner from raw private key bytes.
     *
     * @param secretKey Private key bytes (32-byte seed or 64-byte full keypair)
     */
    public SolanajClientSigner(byte[] secretKey) {
        this(secretKey, Executors.newCachedThreadPool());
    }

    /**
     * Creates a new SolanajClientSigner with a custom executor.
     *
     * @param secretKey Private key bytes
     * @param executor Executor for async operations
     */
    public SolanajClientSigner(byte[] secretKey, Executor executor) {
        if (secretKey == null) {
            throw new IllegalArgumentException("Secret key cannot be null");
        }

        byte[] seed;
        if (secretKey.length == 64) {
            // Full keypair: first 32 bytes are seed
            seed = Arrays.copyOfRange(secretKey, 0, 32);
        } else if (secretKey.length == 32) {
            seed = secretKey;
        } else {
            throw new IllegalArgumentException(
                "Invalid key length: expected 32 or 64, got " + secretKey.length);
        }

        this.privateKey = new Ed25519PrivateKeyParameters(seed, 0);
        this.publicKey = privateKey.generatePublicKey();
        this.address = SvmUtils.base58Encode(publicKey.getEncoded());
        this.executor = executor;
    }

    /**
     * Creates a SolanajClientSigner from a Base58-encoded private key.
     *
     * @param base58SecretKey Base58-encoded secret key
     * @return New SolanajClientSigner instance
     */
    public static SolanajClientSigner fromBase58(String base58SecretKey) {
        byte[] secretKey = SvmUtils.base58Decode(base58SecretKey);
        return new SolanajClientSigner(secretKey);
    }

    /**
     * Creates a SolanajClientSigner from a Base58-encoded private key with custom executor.
     *
     * @param base58SecretKey Base58-encoded secret key
     * @param executor Executor for async operations
     * @return New SolanajClientSigner instance
     */
    public static SolanajClientSigner fromBase58(String base58SecretKey, Executor executor) {
        byte[] secretKey = SvmUtils.base58Decode(base58SecretKey);
        return new SolanajClientSigner(secretKey, executor);
    }

    /**
     * Creates a SolanajClientSigner from a JSON array (Solana CLI format).
     * <p>
     * Solana CLI stores keypairs as JSON arrays of 64 integers.
     *
     * @param jsonArray JSON array string like "[1,2,3,...64 numbers]"
     * @return New SolanajClientSigner instance
     */
    public static SolanajClientSigner fromJson(String jsonArray) {
        String trimmed = jsonArray.trim();
        if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
            throw new IllegalArgumentException("Invalid JSON array format");
        }

        String inner = trimmed.substring(1, trimmed.length() - 1);
        String[] parts = inner.split(",");
        byte[] secretKey = new byte[parts.length];

        for (int i = 0; i < parts.length; i++) {
            secretKey[i] = (byte) Integer.parseInt(parts[i].trim());
        }

        return new SolanajClientSigner(secretKey);
    }

    @Override
    public String getAddress() {
        return address;
    }

    @Override
    public CompletableFuture<String> signTransaction(String txBase64, String network) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                byte[] txBytes = Base64.getDecoder().decode(txBase64);
                byte[] signedTx = addSignature(txBytes);
                return Base64.getEncoder().encodeToString(signedTx);
            } catch (Exception e) {
                throw new SvmTransactionException("Failed to sign transaction: " + e.getMessage(), e);
            }
        }, executor);
    }

    /**
     * Signs a transaction synchronously.
     *
     * @param txBase64 Base64-encoded unsigned transaction
     * @param network Network identifier (for compatibility, not used in signing)
     * @return Base64-encoded signed transaction
     */
    public String signTransactionSync(String txBase64, String network) {
        return signTransaction(txBase64, network).join();
    }

    /**
     * Adds this signer's signature to a transaction.
     * <p>
     * Finds the appropriate signature slot based on the signer's public key
     * position in the transaction's account list.
     */
    private byte[] addSignature(byte[] txBytes) {
        // Parse transaction structure
        int offset = 0;
        int sigCount = readCompactU16(txBytes, offset);
        offset += compactU16Size(sigCount);

        int signaturesStart = offset;
        offset += sigCount * SIGNATURE_LENGTH;

        // Extract message
        int messageStart = offset;
        byte[] message = Arrays.copyOfRange(txBytes, messageStart, txBytes.length);

        // Find our public key in the accounts list
        // Message format: [header (3 bytes), account count, accounts...]
        int msgOffset = 3; // Skip header
        int accountCount = readCompactU16(message, msgOffset);
        msgOffset += compactU16Size(accountCount);

        int signerIndex = -1;
        byte[] ourPubKey = publicKey.getEncoded();

        for (int i = 0; i < accountCount; i++) {
            byte[] account = Arrays.copyOfRange(message, msgOffset + i * 32, msgOffset + (i + 1) * 32);
            if (Arrays.equals(account, ourPubKey)) {
                signerIndex = i;
                break;
            }
        }

        if (signerIndex == -1) {
            throw new SvmTransactionException(
                "Signer " + address + " not found in transaction accounts");
        }

        // Sign the message
        Ed25519Signer signer = new Ed25519Signer();
        signer.init(true, privateKey);
        signer.update(message, 0, message.length);
        byte[] signature = signer.generateSignature();

        // Insert signature at the correct position
        ByteBuffer result = ByteBuffer.allocate(txBytes.length);
        result.order(ByteOrder.LITTLE_ENDIAN);

        // Copy everything up to signatures
        result.put(txBytes, 0, signaturesStart);

        // Copy signatures, replacing the one at signerIndex
        for (int i = 0; i < sigCount; i++) {
            if (i == signerIndex) {
                result.put(signature);
            } else {
                result.put(txBytes, signaturesStart + i * SIGNATURE_LENGTH, SIGNATURE_LENGTH);
            }
        }

        // Copy message
        result.put(message);

        return Arrays.copyOf(result.array(), result.position());
    }

    private int readCompactU16(byte[] data, int offset) {
        int val = data[offset] & 0xFF;
        if (val < 0x80) {
            return val;
        }
        val = (val & 0x7F) | ((data[offset + 1] & 0xFF) << 7);
        if (val < 0x4000) {
            return val;
        }
        return (val & 0x3FFF) | ((data[offset + 2] & 0xFF) << 14);
    }

    private int compactU16Size(int value) {
        if (value < 0x80) {
            return 1;
        }
        if (value < 0x4000) {
            return 2;
        }
        return 3;
    }

    /**
     * Gets the public key bytes.
     *
     * @return 32-byte Ed25519 public key
     */
    public byte[] getPublicKeyBytes() {
        return publicKey.getEncoded();
    }
}
