package io.t402.schemes.ton.exact;

import io.t402.schemes.ton.ExactTonPayload;
import io.t402.schemes.ton.FacilitatorTonSigner;
import io.t402.schemes.ton.TonAuthorization;
import io.t402.schemes.ton.TonConstants;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for TON payment verification and settlement.
 * <p>
 * Handles authorization validation, signature verification, and settlement
 * for the exact payment scheme on TON.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorTonSigner signer = new MyTonFacilitatorSigner(rpcClient);
 * ExactTonFacilitatorScheme scheme = new ExactTonFacilitatorScheme(signer);
 *
 * // Verify a payment
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     // Payment is valid, proceed with settlement
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 *     if (settlement.success) {
 *         System.out.println("Settled: " + settlement.transaction);
 *     }
 * }
 * }</pre>
 */
public class ExactTonFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = TonConstants.SCHEME_EXACT;

    /** CAIP family pattern for TON networks. */
    public static final String CAIP_FAMILY = TonConstants.CAIP_FAMILY;

    private final FacilitatorTonSigner signer;
    private final Random random = new Random();

    /**
     * Creates a new ExactTonFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for TON operations
     */
    public ExactTonFacilitatorScheme(FacilitatorTonSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets mechanism-specific extra data for supported kinds.
     * <p>
     * Returns a randomly selected facilitator address to distribute load.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return Map with facilitator address, or null if no signers available
     */
    public Map<String, Object> getExtra(String network) {
        List<String> addresses = signer.getAddresses();
        if (addresses == null || addresses.isEmpty()) {
            return null;
        }

        String facilitator = addresses.get(random.nextInt(addresses.size()));

        Map<String, Object> extra = new HashMap<>();
        extra.put("facilitator", facilitator);
        return extra;
    }

    /**
     * Gets all signer addresses for this facilitator.
     *
     * @param network Network identifier
     * @return List of facilitator addresses
     */
    public List<String> getSigners(String network) {
        return signer.getAddresses();
    }

    /**
     * Verifies a payment payload.
     *
     * @param payload Payment payload map
     * @param requirements Payment requirements map
     * @return CompletableFuture containing verification result
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<VerificationResult> verify(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        // Extract payload data
        Map<String, Object> tonPayloadMap = (Map<String, Object>) payload.get("payload");
        if (tonPayloadMap == null) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("invalid_payload_structure", ""));
        }

        String signature = (String) tonPayloadMap.get("signature");
        if (signature == null || signature.isEmpty()) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("invalid_payload_missing_signature", ""));
        }

        Map<String, Object> authMap = (Map<String, Object>) tonPayloadMap.get("authorization");
        if (authMap == null) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("invalid_payload_missing_authorization", ""));
        }

        // Validate scheme
        String payloadScheme = (String) payload.get("scheme");
        String requiredScheme = (String) requirements.get("scheme");
        if (!SCHEME.equals(payloadScheme) || !SCHEME.equals(requiredScheme)) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("unsupported_scheme", ""));
        }

        // Validate network
        String acceptedNetwork = (String) payload.get("network");
        String requiredNetwork = (String) requirements.get("network");
        if (!TonConstants.normalizeNetwork(acceptedNetwork)
                .equals(TonConstants.normalizeNetwork(requiredNetwork))) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("network_mismatch", ""));
        }

        // Parse authorization
        TonAuthorization authorization = parseAuthorization(authMap);
        String payer = authorization.getSender();

        // Verify recipient matches
        String requiredPayTo = (String) requirements.get("payTo");
        if (requiredPayTo != null && !requiredPayTo.equals(authorization.getRecipient())) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("recipient_mismatch", payer));
        }

        // Verify amount meets requirements
        String requiredAmount = (String) requirements.get("maxAmountRequired");
        if (requiredAmount != null && authorization.getAmount() != null) {
            BigInteger required = new BigInteger(requiredAmount);
            BigInteger provided = new BigInteger(authorization.getAmount());
            if (provided.compareTo(required) < 0) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("amount_insufficient", payer));
            }
        }

        // Verify validity period
        long now = System.currentTimeMillis() / 1000;
        if (authorization.getValidUntil() < now) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("authorization_expired", payer));
        }

        // Verify signature
        String normalizedNetwork = TonConstants.normalizeNetwork(requiredNetwork);
        return signer.verifySignature(authorization, signature, normalizedNetwork)
            .thenApply(valid -> {
                if (!valid) {
                    return VerificationResult.invalid("invalid_signature", payer);
                }
                return VerificationResult.valid(payer);
            })
            .exceptionally(ex ->
                VerificationResult.invalid("signature_verification_failed: " + ex.getMessage(), payer)
            );
    }

    /**
     * Settles a payment by sending the transaction.
     *
     * @param payload Payment payload map
     * @param requirements Payment requirements map
     * @return CompletableFuture containing settlement result
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<SettlementResult> settle(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        String network = (String) payload.get("network");
        Map<String, Object> tonPayloadMap = (Map<String, Object>) payload.get("payload");

        if (tonPayloadMap == null) {
            return CompletableFuture.completedFuture(
                SettlementResult.failure(network, "", "invalid_payload_structure", ""));
        }

        String signature = (String) tonPayloadMap.get("signature");
        Map<String, Object> authMap = (Map<String, Object>) tonPayloadMap.get("authorization");

        if (signature == null || authMap == null) {
            return CompletableFuture.completedFuture(
                SettlementResult.failure(network, "", "invalid_payload_structure", ""));
        }

        // Verify first
        return verify(payload, requirements)
            .thenCompose(verifyResult -> {
                if (!verifyResult.isValid) {
                    return CompletableFuture.completedFuture(
                        SettlementResult.failure(network, "", verifyResult.invalidReason, verifyResult.payer));
                }

                TonAuthorization authorization = parseAuthorization(authMap);
                String normalizedNetwork = TonConstants.normalizeNetwork(network);

                // Send and confirm transaction
                return signer.sendAndConfirmTransaction(authorization, signature, normalizedNetwork)
                    .thenApply(txHash ->
                        SettlementResult.success(network, txHash, verifyResult.payer)
                    )
                    .exceptionally(ex ->
                        SettlementResult.failure(network, "",
                            "transaction_failed: " + ex.getMessage(), verifyResult.payer)
                    );
            });
    }

    /**
     * Verifies a payment synchronously.
     *
     * @param payload Payment payload map
     * @param requirements Payment requirements map
     * @return Verification result
     */
    public VerificationResult verifySync(Map<String, Object> payload, Map<String, Object> requirements) {
        return verify(payload, requirements).join();
    }

    /**
     * Settles a payment synchronously.
     *
     * @param payload Payment payload map
     * @param requirements Payment requirements map
     * @return Settlement result
     */
    public SettlementResult settleSync(Map<String, Object> payload, Map<String, Object> requirements) {
        return settle(payload, requirements).join();
    }

    /**
     * Parses a map into a TonAuthorization.
     */
    private TonAuthorization parseAuthorization(Map<String, Object> authMap) {
        TonAuthorization.Builder builder = TonAuthorization.builder()
            .sender((String) authMap.get("sender"))
            .recipient((String) authMap.get("recipient"))
            .amount((String) authMap.get("amount"))
            .nonce((String) authMap.get("nonce"))
            .token((String) authMap.get("token"));

        Object validUntil = authMap.get("validUntil");
        if (validUntil instanceof Number) {
            builder.validUntil(((Number) validUntil).longValue());
        } else if (validUntil instanceof String) {
            builder.validUntil(Long.parseLong((String) validUntil));
        }

        return builder.build();
    }

    /**
     * Result of payment verification.
     */
    public static class VerificationResult {
        public final boolean isValid;
        public final String invalidReason;
        public final String payer;

        private VerificationResult(boolean isValid, String invalidReason, String payer) {
            this.isValid = isValid;
            this.invalidReason = invalidReason;
            this.payer = payer;
        }

        public static VerificationResult valid(String payer) {
            return new VerificationResult(true, null, payer);
        }

        public static VerificationResult invalid(String reason, String payer) {
            return new VerificationResult(false, reason, payer);
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("isValid", isValid);
            map.put("invalidReason", invalidReason);
            map.put("payer", payer);
            return map;
        }
    }

    /**
     * Result of payment settlement.
     */
    public static class SettlementResult {
        public final boolean success;
        public final String network;
        public final String transaction;
        public final String errorReason;
        public final String payer;

        private SettlementResult(boolean success, String network, String transaction,
                                 String errorReason, String payer) {
            this.success = success;
            this.network = network;
            this.transaction = transaction;
            this.errorReason = errorReason;
            this.payer = payer;
        }

        public static SettlementResult success(String network, String transaction, String payer) {
            return new SettlementResult(true, network, transaction, null, payer);
        }

        public static SettlementResult failure(String network, String transaction,
                                               String errorReason, String payer) {
            return new SettlementResult(false, network, transaction, errorReason, payer);
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("success", success);
            map.put("network", network);
            map.put("transaction", transaction);
            map.put("errorReason", errorReason);
            map.put("payer", payer);
            return map;
        }
    }
}
