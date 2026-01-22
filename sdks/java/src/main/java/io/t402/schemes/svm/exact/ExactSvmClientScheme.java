package io.t402.schemes.svm.exact;

import io.t402.schemes.svm.ClientSvmSigner;
import io.t402.schemes.svm.ExactSvmPayload;
import io.t402.schemes.svm.SvmAuthorization;
import io.t402.schemes.svm.SvmConstants;
import io.t402.schemes.svm.SvmUtils;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

/**
 * Client scheme for creating SVM payment payloads.
 * <p>
 * Handles creation of SPL token transfer transactions
 * for the exact payment scheme.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientSvmSigner signer = new MyWalletSigner(keypair);
 * ExactSvmClientScheme scheme = new ExactSvmClientScheme(signer);
 *
 * // Build transaction externally (using Solana SDK)
 * Supplier<CompletableFuture<String>> buildTx = () ->
 *     CompletableFuture.completedFuture(buildTransferTransaction(...));
 *
 * // Create payment payload
 * CompletableFuture<Map<String, Object>> payloadFuture =
 *     scheme.createPaymentPayload(requirements, buildTx);
 * }</pre>
 */
public class ExactSvmClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = SvmConstants.SCHEME_EXACT;

    /** CAIP family pattern for Solana networks. */
    public static final String CAIP_FAMILY = "solana:*";

    private final ClientSvmSigner signer;

    /**
     * Creates a new ExactSvmClientScheme with the given signer.
     *
     * @param signer Client signer for transaction signing
     */
    public ExactSvmClientScheme(ClientSvmSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's address.
     *
     * @return Base58-encoded public key
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload for the given requirements.
     *
     * @param requirements Payment requirements map
     * @param buildTransaction Supplier that builds and returns a base64-encoded unsigned transaction
     * @return CompletableFuture containing payment payload map
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<Map<String, Object>> createPaymentPayload(
            Map<String, Object> requirements,
            Supplier<CompletableFuture<String>> buildTransaction) {

        String network = (String) requirements.getOrDefault("network", SvmConstants.SOLANA_MAINNET);
        String normalizedNetwork = SvmConstants.normalizeNetwork(network);

        // Build the transaction
        return buildTransaction.get()
            .thenCompose(unsignedTx ->
                // Sign the transaction
                signer.signTransaction(unsignedTx, normalizedNetwork)
            )
            .thenApply(signedTx -> {
                // Build the payment payload
                int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
                String payTo = (String) requirements.get("payTo");
                String asset = (String) requirements.get("asset");
                String amount = (String) requirements.get("maxAmountRequired");
                int maxTimeout = ((Number) requirements.getOrDefault("maxTimeoutSeconds",
                    SvmConstants.DEFAULT_VALIDITY_DURATION)).intValue();

                // Get fee payer from extra if present
                String feePayer = null;
                if (requirements.get("extra") instanceof Map) {
                    Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
                    feePayer = (String) extra.get("feePayer");
                }

                // Calculate validity
                long validUntil = SvmUtils.calculateValidUntil(maxTimeout);

                // Create authorization
                SvmAuthorization authorization = SvmAuthorization.builder()
                    .from(signer.getAddress())
                    .to(payTo)
                    .mint(asset != null ? asset : SvmConstants.getUsdcAddress(normalizedNetwork))
                    .amount(amount)
                    .validUntil(validUntil)
                    .feePayer(feePayer)
                    .build();

                // Create payload
                ExactSvmPayload payload = ExactSvmPayload.builder()
                    .transaction(signedTx)
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
     * @param buildTransaction Supplier that builds and returns a base64-encoded unsigned transaction
     * @return Payment payload map
     */
    public Map<String, Object> createPaymentPayloadSync(
            Map<String, Object> requirements,
            Supplier<CompletableFuture<String>> buildTransaction) {
        return createPaymentPayload(requirements, buildTransaction).join();
    }

    /**
     * Creates a simple payment payload with a pre-built transaction.
     *
     * @param requirements Payment requirements map
     * @param signedTransaction Base64-encoded signed transaction
     * @return Payment payload map
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createPaymentPayloadFromTransaction(
            Map<String, Object> requirements,
            String signedTransaction) {

        String network = (String) requirements.getOrDefault("network", SvmConstants.SOLANA_MAINNET);
        String normalizedNetwork = SvmConstants.normalizeNetwork(network);

        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String asset = (String) requirements.get("asset");
        String amount = (String) requirements.get("maxAmountRequired");
        int maxTimeout = ((Number) requirements.getOrDefault("maxTimeoutSeconds",
            SvmConstants.DEFAULT_VALIDITY_DURATION)).intValue();

        // Get fee payer from extra if present
        String feePayer = null;
        if (requirements.get("extra") instanceof Map) {
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            feePayer = (String) extra.get("feePayer");
        }

        // Calculate validity
        long validUntil = SvmUtils.calculateValidUntil(maxTimeout);

        // Create authorization
        SvmAuthorization authorization = SvmAuthorization.builder()
            .from(signer.getAddress())
            .to(payTo)
            .mint(asset != null ? asset : SvmConstants.getUsdcAddress(normalizedNetwork))
            .amount(amount)
            .validUntil(validUntil)
            .feePayer(feePayer)
            .build();

        // Create payload
        ExactSvmPayload payload = ExactSvmPayload.builder()
            .transaction(signedTransaction)
            .authorization(authorization)
            .build();

        // Build result map
        Map<String, Object> result = new HashMap<>();
        result.put("t402Version", t402Version);
        result.put("scheme", SCHEME);
        result.put("network", normalizedNetwork);
        result.put("payload", payload.toMap());

        return result;
    }
}
