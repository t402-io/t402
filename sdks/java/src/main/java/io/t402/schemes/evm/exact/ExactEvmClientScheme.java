package io.t402.schemes.evm.exact;

import io.t402.schemes.evm.ClientEvmSigner;
import io.t402.schemes.evm.EvmAuthorization;
import io.t402.schemes.evm.EvmConstants;
import io.t402.schemes.evm.ExactEvmPayload;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating EVM payment payloads using EIP-3009 TransferWithAuthorization.
 *
 * <p>Handles creation of signed payment authorization messages
 * for the exact payment scheme on EVM-compatible chains.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientEvmSigner signer = new MyEvmWalletSigner(privateKey, chainId, tokenAddress);
 * ExactEvmClientScheme scheme = new ExactEvmClientScheme(signer);
 *
 * // Create payment payload
 * Map<String, Object> requirements = Map.of(
 *     "network", "eip155:8453",
 *     "payTo", "0xRecipient...",
 *     "maxAmountRequired", "1000000",
 *     "asset", "0xTokenAddress..."
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactEvmClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = EvmConstants.SCHEME_EXACT;

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = EvmConstants.CAIP_FAMILY;

    private final ClientEvmSigner signer;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Creates a new ExactEvmClientScheme with the given signer.
     *
     * @param signer Client signer for EIP-712 payment signing
     * @throws IllegalArgumentException if signer is null
     */
    public ExactEvmClientScheme(ClientEvmSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's Ethereum address.
     *
     * @return 0x-prefixed Ethereum address
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload for the given requirements.
     *
     * <p>This method:
     * <ol>
     *   <li>Extracts payment parameters from requirements</li>
     *   <li>Generates a random 32-byte nonce</li>
     *   <li>Calculates a validity window with clock skew tolerance</li>
     *   <li>Constructs an EIP-3009 TransferWithAuthorization message</li>
     *   <li>Signs it using EIP-712 typed data signing</li>
     *   <li>Returns the payload ready for transmission</li>
     * </ol>
     *
     * @param requirements Payment requirements map containing:
     *   <ul>
     *     <li>{@code network} - EVM network (CAIP-2 format, e.g., "eip155:8453")</li>
     *     <li>{@code payTo} - Recipient Ethereum address</li>
     *     <li>{@code maxAmountRequired} - Amount in atomic units</li>
     *     <li>{@code asset} - Token contract address (optional, defaults based on network)</li>
     *     <li>{@code maxTimeoutSeconds} - Maximum validity duration in seconds</li>
     *     <li>{@code t402Version} - Protocol version (default 2)</li>
     *   </ul>
     * @return CompletableFuture containing payment payload map
     */
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        String network = (String) requirements.getOrDefault("network", EvmConstants.ETHEREUM_MAINNET);

        if (!EvmConstants.isEvmNetwork(network)) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("Not an EVM network: " + network));
        }

        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String amount = (String) requirements.get("maxAmountRequired");
        int maxTimeout = ((Number) requirements.getOrDefault("maxTimeoutSeconds",
            EvmConstants.DEFAULT_VALIDITY_DURATION)).intValue();

        if (payTo == null || payTo.isEmpty()) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("payTo address is required"));
        }
        if (amount == null || amount.isEmpty()) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("maxAmountRequired is required"));
        }

        // Generate unique 32-byte nonce
        String nonce = generateNonce();

        // Calculate validity window
        long now = System.currentTimeMillis() / 1000;
        long validAfter = now - EvmConstants.CLOCK_SKEW_TOLERANCE;
        long validBefore = now + maxTimeout;

        // Create authorization
        EvmAuthorization authorization = EvmAuthorization.builder()
            .from(signer.getAddress())
            .to(payTo)
            .value(amount)
            .nonce(nonce)
            .validAfter(validAfter)
            .validBefore(validBefore)
            .build();

        // Sign the authorization
        return signer.signPayment(authorization, network)
            .thenApply(signature -> {
                // Create payload
                ExactEvmPayload payload = ExactEvmPayload.builder()
                    .signature(signature)
                    .authorization(authorization)
                    .build();

                // Build result map
                Map<String, Object> result = new HashMap<>();
                result.put("t402Version", t402Version);
                result.put("scheme", SCHEME);
                result.put("network", network);
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
     * Generates a unique 32-byte random nonce for the payment.
     *
     * @return 0x-prefixed hex-encoded 32-byte nonce
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
