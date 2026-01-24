package io.t402.schemes.evm.exact_legacy;

import io.t402.schemes.evm.EvmConstants;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating EVM payment payloads using LegacyTransferAuthorization.
 *
 * <p>This scheme is for legacy EVM tokens (like USDT on Ethereum mainnet) that
 * do NOT support EIP-3009. It uses EIP-712 typed data signing with a
 * {@code LegacyTransferAuthorization} message that includes a {@code spender}
 * field (the facilitator address). The facilitator then calls {@code transferFrom}
 * after verifying the signature.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientLegacyEvmSigner signer = new MyLegacyEvmWalletSigner(privateKey);
 * ExactLegacyEvmClientScheme scheme = new ExactLegacyEvmClientScheme(signer);
 *
 * // Create payment payload
 * Map<String, Object> requirements = new HashMap<>();
 * requirements.put("network", "eip155:1");
 * requirements.put("payTo", "0xRecipient...");
 * requirements.put("maxAmountRequired", "1000000");
 * requirements.put("extra", Map.of(
 *     "spender", "0xFacilitator...",
 *     "name", "T402LegacyTransfer",
 *     "version", "1"
 * ));
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactLegacyEvmClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = "exact-legacy";

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = EvmConstants.CAIP_FAMILY;

    /** Default EIP-712 domain name for legacy transfers. */
    public static final String DEFAULT_DOMAIN_NAME = "T402LegacyTransfer";

    /** Default EIP-712 domain version for legacy transfers. */
    public static final String DEFAULT_DOMAIN_VERSION = "1";

    /** EIP-712 primary type for legacy authorization. */
    public static final String PRIMARY_TYPE = "LegacyTransferAuthorization";

    private final ClientLegacyEvmSigner signer;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Creates a new ExactLegacyEvmClientScheme with the given signer.
     *
     * @param signer Client signer for EIP-712 legacy payment signing
     * @throws IllegalArgumentException if signer is null
     */
    public ExactLegacyEvmClientScheme(ClientLegacyEvmSigner signer) {
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
     *   <li>Gets the spender (facilitator) address from requirements extra</li>
     *   <li>Generates a random 32-byte nonce</li>
     *   <li>Calculates a validity window with clock skew tolerance</li>
     *   <li>Constructs a LegacyTransferAuthorization message</li>
     *   <li>Signs it using EIP-712 typed data signing</li>
     *   <li>Returns the payload ready for transmission</li>
     * </ol>
     *
     * @param requirements Payment requirements map containing:
     *   <ul>
     *     <li>{@code network} - EVM network (CAIP-2 format, e.g., "eip155:1")</li>
     *     <li>{@code payTo} - Recipient Ethereum address</li>
     *     <li>{@code maxAmountRequired} - Amount in atomic units</li>
     *     <li>{@code maxTimeoutSeconds} - Maximum validity duration in seconds</li>
     *     <li>{@code extra.spender} - Facilitator address (required)</li>
     *     <li>{@code extra.name} - EIP-712 domain name (default: "T402LegacyTransfer")</li>
     *     <li>{@code extra.version} - EIP-712 domain version (default: "1")</li>
     *     <li>{@code t402Version} - Protocol version (default 2)</li>
     *   </ul>
     * @return CompletableFuture containing payment payload map
     */
    @SuppressWarnings("unchecked")
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

        // Get extra data
        Map<String, Object> extra = (Map<String, Object>) requirements.getOrDefault("extra", new HashMap<>());

        // Get spender (facilitator address) - required for exact-legacy
        String spender = (String) extra.get("spender");
        if (spender == null || spender.isEmpty()) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("extra.spender (facilitator address) is required for exact-legacy scheme"));
        }

        // Generate unique 32-byte nonce
        String nonce = generateNonce();

        // Calculate validity window
        long now = System.currentTimeMillis() / 1000;
        long validAfter = now - EvmConstants.CLOCK_SKEW_TOLERANCE;
        long validBefore = now + maxTimeout;

        // Create legacy authorization
        LegacyEvmAuthorization authorization = LegacyEvmAuthorization.builder()
            .from(signer.getAddress())
            .to(payTo)
            .value(amount)
            .nonce(nonce)
            .validAfter(validAfter)
            .validBefore(validBefore)
            .spender(spender)
            .build();

        // Sign the authorization
        return signer.signLegacyPayment(authorization, network)
            .thenApply(signature -> {
                // Create payload
                ExactLegacyEvmPayload payload = ExactLegacyEvmPayload.builder()
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
