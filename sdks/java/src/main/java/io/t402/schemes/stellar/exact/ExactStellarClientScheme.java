package io.t402.schemes.stellar.exact;

import io.t402.schemes.stellar.ClientStellarSigner;
import io.t402.schemes.stellar.ExactStellarPayload;
import io.t402.schemes.stellar.StellarAuthorization;
import io.t402.schemes.stellar.StellarConstants;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating Stellar payment payloads.
 *
 * <p>Handles creation of signed payment authorization messages
 * for the exact payment scheme on Stellar using Soroban token transfers.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientStellarSigner signer = new MyStellarWalletSigner(keypair);
 * ExactStellarClientScheme scheme = new ExactStellarClientScheme(signer);
 *
 * Map<String, Object> requirements = Map.of(
 *     "network", "stellar:pubnet",
 *     "payTo", "GABC...",
 *     "maxAmountRequired", "10000000",
 *     "asset", "CCW67..."
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactStellarClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = StellarConstants.SCHEME_EXACT;

    /** CAIP family pattern for Stellar networks. */
    public static final String CAIP_FAMILY = StellarConstants.CAIP_FAMILY;

    private final ClientStellarSigner signer;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Creates a new ExactStellarClientScheme with the given signer.
     *
     * @param signer Client signer for payment signing
     */
    public ExactStellarClientScheme(ClientStellarSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's address.
     *
     * @return Stellar G-address
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
    public CompletableFuture<Map<String, Object>> createPaymentPayload(
            Map<String, Object> requirements) {
        String network = (String) requirements.getOrDefault("network",
            StellarConstants.STELLAR_PUBNET);
        String normalizedNetwork = StellarConstants.normalizeNetwork(network);

        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String asset = (String) requirements.getOrDefault("asset", StellarConstants.DEFAULT_TOKEN);
        String amount = (String) requirements.get("maxAmountRequired");
        int maxTimeout = ((Number) requirements.getOrDefault("maxTimeoutSeconds",
            StellarConstants.DEFAULT_TIMEOUT_SECONDS)).intValue();

        // Generate unique nonce
        String nonce = generateNonce();

        // Calculate validity
        long validUntil = System.currentTimeMillis() / 1000 + maxTimeout;

        // Create authorization
        StellarAuthorization authorization = StellarAuthorization.builder()
            .sender(signer.getAddress())
            .recipient(payTo)
            .amount(amount)
            .tokenContract(asset)
            .nonce(nonce)
            .validUntil(validUntil)
            .build();

        // Sign the authorization
        return signer.signPayment(authorization, normalizedNetwork)
            .thenApply(signature -> {
                // Create payload
                ExactStellarPayload payload = ExactStellarPayload.builder()
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
     * @return Base64-encoded random nonce
     */
    private String generateNonce() {
        byte[] nonceBytes = new byte[16];
        secureRandom.nextBytes(nonceBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(nonceBytes);
    }
}
