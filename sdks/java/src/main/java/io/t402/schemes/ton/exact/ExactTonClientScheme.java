package io.t402.schemes.ton.exact;

import io.t402.schemes.ton.ClientTonSigner;
import io.t402.schemes.ton.ExactTonPayload;
import io.t402.schemes.ton.TonAuthorization;
import io.t402.schemes.ton.TonConstants;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating TON payment payloads.
 *
 * <p>Handles creation of signed payment authorization messages
 * for the exact payment scheme on TON.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientTonSigner signer = new MyTonWalletSigner(privateKey);
 * ExactTonClientScheme scheme = new ExactTonClientScheme(signer);
 *
 * // Create payment payload
 * Map<String, Object> requirements = Map.of(
 *     "network", "ton:mainnet",
 *     "payTo", "EQ...",
 *     "maxAmountRequired", "1000000",
 *     "asset", "USDT"
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactTonClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = TonConstants.SCHEME_EXACT;

    /** CAIP family pattern for TON networks. */
    public static final String CAIP_FAMILY = TonConstants.CAIP_FAMILY;

    private final ClientTonSigner signer;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Creates a new ExactTonClientScheme with the given signer.
     *
     * @param signer Client signer for payment signing
     */
    public ExactTonClientScheme(ClientTonSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's address.
     *
     * @return TON address
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
        String network = (String) requirements.getOrDefault("network", TonConstants.TON_MAINNET);
        String normalizedNetwork = TonConstants.normalizeNetwork(network);

        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String asset = (String) requirements.getOrDefault("asset", TonConstants.DEFAULT_TOKEN);
        String amount = (String) requirements.get("maxAmountRequired");
        int maxTimeout = ((Number) requirements.getOrDefault("maxTimeoutSeconds",
            TonConstants.DEFAULT_VALIDITY_DURATION)).intValue();

        // Generate unique nonce
        String nonce = generateNonce();

        // Calculate validity
        long validUntil = System.currentTimeMillis() / 1000 + maxTimeout;

        // Create authorization
        TonAuthorization authorization = TonAuthorization.builder()
            .sender(signer.getAddress())
            .recipient(payTo)
            .amount(amount)
            .nonce(nonce)
            .token(asset)
            .validUntil(validUntil)
            .build();

        // Sign the authorization
        return signer.signPayment(authorization, normalizedNetwork)
            .thenApply(signature -> {
                // Create payload
                ExactTonPayload payload = ExactTonPayload.builder()
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
