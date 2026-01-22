package io.t402.schemes.svm.exact;

import io.t402.schemes.svm.ExactSvmPayload;
import io.t402.schemes.svm.FacilitatorSvmSigner;
import io.t402.schemes.svm.SvmAuthorization;
import io.t402.schemes.svm.SvmConstants;
import io.t402.schemes.svm.SvmTransactionException;
import io.t402.schemes.svm.SvmUtils;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for SVM payment verification and settlement.
 * <p>
 * Handles transaction validation, simulation, and settlement
 * for the exact payment scheme.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorSvmSigner signer = new MyFacilitatorSigner(keypairs, rpcClient);
 * ExactSvmFacilitatorScheme scheme = new ExactSvmFacilitatorScheme(signer);
 *
 * // Verify a payment
 * CompletableFuture<VerificationResult> result = scheme.verify(payload, requirements);
 *
 * // Settle a payment
 * CompletableFuture<SettlementResult> settlement = scheme.settle(payload, requirements);
 * }</pre>
 */
public class ExactSvmFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = SvmConstants.SCHEME_EXACT;

    /** CAIP family pattern for Solana networks. */
    public static final String CAIP_FAMILY = "solana:*";

    private final FacilitatorSvmSigner signer;
    private final Random random = new Random();

    /**
     * Creates a new ExactSvmFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for transaction operations
     */
    public ExactSvmFacilitatorScheme(FacilitatorSvmSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets mechanism-specific extra data for supported kinds.
     * <p>
     * Returns a randomly selected fee payer address to distribute load.
     *
     * @param network Network identifier (unused for SVM)
     * @return Map with feePayer address, or null if no signers available
     */
    public Map<String, Object> getExtra(String network) {
        List<String> addresses = signer.getAddresses();
        if (addresses == null || addresses.isEmpty()) {
            return null;
        }

        String feePayer = addresses.get(random.nextInt(addresses.size()));

        Map<String, Object> extra = new HashMap<>();
        extra.put("feePayer", feePayer);
        return extra;
    }

    /**
     * Gets all signer addresses for this facilitator.
     *
     * @param network Network identifier (unused for SVM)
     * @return List of fee payer addresses
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
        Map<String, Object> svmPayloadMap = (Map<String, Object>) payload.get("payload");
        if (svmPayloadMap == null) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("invalid_payload_structure", ""));
        }

        String txBase64 = (String) svmPayloadMap.get("transaction");
        if (txBase64 == null || txBase64.isEmpty()) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("invalid_payload_structure", ""));
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
        if (!SvmConstants.normalizeNetwork(acceptedNetwork)
                .equals(SvmConstants.normalizeNetwork(requiredNetwork))) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("network_mismatch", ""));
        }

        // Validate fee payer
        Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
        if (extra == null) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("invalid_exact_svm_payload_missing_fee_payer", ""));
        }

        String feePayer = (String) extra.get("feePayer");
        if (feePayer == null || feePayer.isEmpty()) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("invalid_exact_svm_payload_missing_fee_payer", ""));
        }

        // Verify fee payer is managed by this facilitator
        List<String> signerAddresses = signer.getAddresses();
        if (!signerAddresses.contains(feePayer)) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("fee_payer_not_managed_by_facilitator", ""));
        }

        // Extract payer from authorization if available
        String payer = "";
        Map<String, Object> authMap = (Map<String, Object>) svmPayloadMap.get("authorization");
        if (authMap != null) {
            SvmAuthorization auth = SvmAuthorization.fromMap(authMap);
            payer = auth.from;

            // Security: Verify facilitator's signers are not transferring their own funds
            if (signerAddresses.contains(payer)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid(
                        "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds", payer));
            }

            // Verify amount meets requirements
            String requiredAmount = (String) requirements.get("maxAmountRequired");
            if (requiredAmount != null && auth.amount != null) {
                BigInteger required = new BigInteger(requiredAmount);
                BigInteger provided = new BigInteger(auth.amount);
                if (provided.compareTo(required) < 0) {
                    return CompletableFuture.completedFuture(
                        VerificationResult.invalid("invalid_exact_svm_payload_amount_insufficient", payer));
                }
            }

            // Verify asset matches
            String requiredAsset = (String) requirements.get("asset");
            if (requiredAsset != null && !requiredAsset.equals(auth.mint)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_exact_svm_payload_mint_mismatch", payer));
            }
        }

        final String finalPayer = payer;

        // Sign and simulate transaction
        return signer.signTransaction(txBase64, feePayer, requiredNetwork)
            .thenCompose(signedTx ->
                signer.simulateTransaction(signedTx, requiredNetwork)
                    .thenApply(success -> VerificationResult.valid(finalPayer))
            )
            .exceptionally(ex ->
                VerificationResult.invalid("transaction_simulation_failed: " + ex.getMessage(), finalPayer)
            );
    }

    /**
     * Settles a payment by submitting the transaction.
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
        Map<String, Object> svmPayloadMap = (Map<String, Object>) payload.get("payload");

        if (svmPayloadMap == null) {
            return CompletableFuture.completedFuture(
                SettlementResult.failure(network, "", "invalid_payload_structure", ""));
        }

        String txBase64 = (String) svmPayloadMap.get("transaction");
        if (txBase64 == null || txBase64.isEmpty()) {
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

                Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
                String feePayer = (String) extra.get("feePayer");
                String requiredNetwork = (String) requirements.get("network");

                // Sign transaction
                return signer.signTransaction(txBase64, feePayer, requiredNetwork)
                    .thenCompose(signedTx ->
                        // Send and confirm
                        signer.sendAndConfirmTransaction(signedTx, requiredNetwork)
                            .thenApply(signature ->
                                SettlementResult.success(network, signature, verifyResult.payer)
                            )
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
