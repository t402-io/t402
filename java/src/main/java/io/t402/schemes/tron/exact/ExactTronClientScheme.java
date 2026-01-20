package io.t402.schemes.tron.exact;

import io.t402.schemes.tron.ClientTronSigner;
import io.t402.schemes.tron.ExactTronPayload;
import io.t402.schemes.tron.TronAuthorization;
import io.t402.schemes.tron.TronConstants;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating TRON payment payloads.
 *
 * <p>Handles creation of signed payment authorization messages
 * for the exact payment scheme on TRON.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientTronSigner signer = new MyTronWalletSigner(privateKey);
 * ExactTronClientScheme scheme = new ExactTronClientScheme(signer);
 *
 * // Create payment payload
 * Map<String, Object> requirements = Map.of(
 *     "network", "tron:mainnet",
 *     "payTo", "TXyz...",
 *     "maxAmountRequired", "1000000",
 *     "asset", "USDT"
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactTronClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = TronConstants.SCHEME_EXACT;

    /** CAIP family pattern for TRON networks. */
    public static final String CAIP_FAMILY = TronConstants.CAIP_FAMILY;

    private final ClientTronSigner signer;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Creates a new ExactTronClientScheme with the given signer.
     *
     * @param signer Client signer for payment signing
     */
    public ExactTronClientScheme(ClientTronSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's address.
     *
     * @return TRON address
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload for the given requirements.
     *
     * @param requirements Payment requirements map
     * @return CompletableFuture containing payment payload map
     */
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        String network = (String) requirements.getOrDefault("network", TronConstants.TRON_MAINNET);
        String normalizedNetwork = TronConstants.normalizeNetwork(network);

        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String asset = (String) requirements.getOrDefault("asset", TronConstants.DEFAULT_TOKEN);
        String amount = (String) requirements.get("maxAmountRequired");
        int maxTimeout = ((Number) requirements.getOrDefault("maxTimeoutSeconds",
            TronConstants.DEFAULT_VALIDITY_DURATION)).intValue();

        // Generate unique nonce
        String nonce = generateNonce();

        // Calculate validity window
        long now = System.currentTimeMillis() / 1000;
        long validAfter = now - 60; // Allow 1 minute clock skew
        long validBefore = now + maxTimeout;

        // Create authorization
        TronAuthorization authorization = TronAuthorization.builder()
            .from(signer.getAddress())
            .to(payTo)
            .amount(amount)
            .nonce(nonce)
            .token(asset)
            .validAfter(validAfter)
            .validBefore(validBefore)
            .build();

        // Sign the authorization
        return signer.signPayment(authorization, normalizedNetwork)
            .thenApply(signature -> {
                // Create payload
                ExactTronPayload payload = ExactTronPayload.builder()
                    .signature(signature)
                    .authorization(authorization)
                    .build();

                // Build result map
                Map<String, Object> result = new HashMap<>();
                result.put("t402Version", t402Version);
                result.put("scheme", SCHEME);
                result.put("network", normalizedNetwork);
                result.put("payload", payload.toMap());

                return result;
            });
    }

    /**
     * Creates a payment payload synchronously.
     *
     * @param requirements Payment requirements map
     * @return Payment payload map
     */
    public Map<String, Object> createPaymentPayloadSync(Map<String, Object> requirements) {
        return createPaymentPayload(requirements).join();
    }

    /**
     * Generates a unique nonce for the payment.
     *
     * @return Hex-encoded random nonce with 0x prefix
     */
    private String generateNonce() {
        byte[] nonceBytes = new byte[32];
        secureRandom.nextBytes(nonceBytes);
        StringBuilder sb = new StringBuilder("0x");
        for (byte b : nonceBytes) {
            sb.append(String.format("%02x", b & 0xFF));
        }
        return sb.toString();
    }
}
