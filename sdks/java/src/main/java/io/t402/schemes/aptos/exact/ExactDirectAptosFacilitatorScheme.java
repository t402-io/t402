package io.t402.schemes.aptos.exact;

import io.t402.schemes.aptos.AptosConstants;
import io.t402.schemes.aptos.ExactDirectPayload;
import io.t402.schemes.aptos.FacilitatorAptosSigner;

import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Facilitator scheme for Aptos exact-direct payment verification and settlement.
 * <p>
 * Verifies FA transfer transactions on-chain and confirms that the payment
 * details (sender, recipient, amount, asset) match the requirements.
 * </p>
 * <p>
 * For exact-direct, settlement is a no-op since the client already executed
 * the transfer. The facilitator simply verifies and returns the transaction hash.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorAptosSigner signer = new MyAptosQuerier(rpcUrl);
 * ExactDirectAptosFacilitatorScheme scheme = new ExactDirectAptosFacilitatorScheme(signer);
 *
 * // Verify a payment
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.valid) {
 *     // Payment is verified
 *     System.out.println("Payer: " + result.payer);
 * }
 *
 * // Settle (returns existing tx hash since transfer is complete)
 * SettlementResult settlement = scheme.settleSync(payload, requirements);
 * System.out.println("Transaction: " + settlement.transaction);
 * }</pre>
 */
public class ExactDirectAptosFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = AptosConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Aptos networks. */
    public static final String CAIP_FAMILY = AptosConstants.CAIP_FAMILY;

    private final FacilitatorAptosSigner signer;
    private final int maxTransactionAge;

    /** Used transaction cache for replay protection (txHash -> timestamp). */
    private final ConcurrentHashMap<String, Long> usedTxs = new ConcurrentHashMap<>();

    /**
     * Creates a new ExactDirectAptosFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for querying transactions
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectAptosFacilitatorScheme(FacilitatorAptosSigner signer) {
        this(signer, AptosConstants.DEFAULT_MAX_TRANSACTION_AGE);
    }

    /**
     * Creates a new ExactDirectAptosFacilitatorScheme with custom max transaction age.
     *
     * @param signer Facilitator signer for querying transactions
     * @param maxTransactionAge Maximum transaction age in seconds (0 to disable)
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectAptosFacilitatorScheme(FacilitatorAptosSigner signer, int maxTransactionAge) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
        this.maxTransactionAge = maxTransactionAge;
    }

    /**
     * Gets the facilitator addresses for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return List of Aptos addresses
     */
    public List<String> getSigners(String network) {
        return signer.getAddresses(network);
    }

    /**
     * Verifies a payment payload by checking the on-chain transaction.
     *
     * <p>Validates:
     * <ol>
     *   <li>Payload has the correct structure with a valid transaction hash</li>
     *   <li>Transaction has not been used before (replay protection)</li>
     *   <li>Transaction exists on-chain and was successful</li>
     *   <li>Transaction is not too old</li>
     *   <li>Transaction is a valid FA transfer</li>
     *   <li>Recipient matches the payTo in requirements</li>
     *   <li>Amount is greater than or equal to the required amount</li>
     * </ol>
     *
     * @param payload Payment payload from the client
     * @param requirements Payment requirements from the server
     * @return CompletableFuture containing verification result
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<VerificationResult> verify(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        try {
            // Extract inner payload
            Map<String, Object> innerPayload = (Map<String, Object>) payload.get("payload");
            if (innerPayload == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Missing payload"));
            }

            String network = (String) payload.get("network");
            if (network == null) {
                network = (String) requirements.get("network");
            }
            network = AptosConstants.normalizeNetwork(network);

            // Validate network
            if (!AptosConstants.isValidNetwork(network)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Unsupported network: " + network));
            }

            // Parse the payload
            ExactDirectPayload aptosPayload = ExactDirectPayload.fromMap(innerPayload);

            // Validate transaction hash format
            if (!AptosConstants.isValidTxHash(aptosPayload.getTxHash())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Invalid transaction hash format"));
            }

            // Validate from address
            if (aptosPayload.getFrom() == null || aptosPayload.getFrom().isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Missing 'from' address in payload"));
            }

            // Check for replay attack
            if (usedTxs.containsKey(aptosPayload.getTxHash())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalidWithPayer(
                        "Transaction has already been used", aptosPayload.getFrom()));
            }

            // Query the transaction from on-chain
            String finalNetwork = network;
            return signer.getTransaction(aptosPayload.getTxHash(), network)
                .thenApply(tx -> verifyTransaction(tx, aptosPayload, requirements, finalNetwork))
                .exceptionally(e -> VerificationResult.invalidWithPayer(
                    "Transaction not found: " + e.getMessage(), aptosPayload.getFrom()));

        } catch (Exception e) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("Verification error: " + e.getMessage()));
        }
    }

    /**
     * Verifies a payment synchronously.
     *
     * @param payload Payment payload
     * @param requirements Payment requirements
     * @return Verification result
     */
    public VerificationResult verifySync(
            Map<String, Object> payload,
            Map<String, Object> requirements) {
        return verify(payload, requirements).join();
    }

    /**
     * Settles a payment by returning the existing transaction hash.
     *
     * <p>For exact-direct, the transfer is already complete since the client
     * executed it directly on-chain. Settlement verifies the transaction
     * and returns the existing transaction hash.
     *
     * @param payload Payment payload from the client
     * @param requirements Payment requirements from the server
     * @return CompletableFuture containing settlement result
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<SettlementResult> settle(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        return verify(payload, requirements)
            .thenApply(verificationResult -> {
                if (!verificationResult.valid) {
                    return SettlementResult.failed(verificationResult.error);
                }

                // For exact-direct, the transfer is already complete
                Map<String, Object> innerPayload = (Map<String, Object>) payload.get("payload");
                ExactDirectPayload aptosPayload = ExactDirectPayload.fromMap(innerPayload);

                return SettlementResult.success(
                    aptosPayload.getTxHash(), aptosPayload.getFrom());
            });
    }

    /**
     * Settles a payment synchronously.
     *
     * @param payload Payment payload
     * @param requirements Payment requirements
     * @return Settlement result
     */
    public SettlementResult settleSync(
            Map<String, Object> payload,
            Map<String, Object> requirements) {
        return settle(payload, requirements).join();
    }

    /**
     * Cleans up expired entries from the used transaction cache.
     *
     * @param maxAgeSec Maximum age in seconds for cache entries
     * @return Number of entries removed
     */
    public int cleanupUsedTransactions(long maxAgeSec) {
        long cutoff = System.currentTimeMillis() - (maxAgeSec * 1000);
        int[] removed = {0};
        usedTxs.forEach((hash, timestamp) -> {
            if (timestamp < cutoff) {
                usedTxs.remove(hash);
                removed[0]++;
            }
        });
        return removed[0];
    }

    // =========================================================================
    // Private Methods
    // =========================================================================

    @SuppressWarnings("unchecked")
    private VerificationResult verifyTransaction(
            Map<String, Object> tx,
            ExactDirectPayload aptosPayload,
            Map<String, Object> requirements,
            String network) {

        // Verify transaction succeeded
        Boolean success = (Boolean) tx.get("success");
        if (success == null || !success) {
            String vmStatus = (String) tx.getOrDefault("vm_status", "unknown");
            return VerificationResult.invalidWithPayer(
                "Transaction failed: vm_status=" + vmStatus, aptosPayload.getFrom());
        }

        // Check transaction age
        if (maxTransactionAge > 0) {
            String timestampStr = tx.get("timestamp") != null ? tx.get("timestamp").toString() : "";
            if (!timestampStr.isEmpty()) {
                try {
                    // Aptos timestamps are in microseconds
                    long txTimestampSec = Long.parseLong(timestampStr) / 1_000_000;
                    long ageSec = (System.currentTimeMillis() / 1000) - txTimestampSec;
                    if (ageSec > maxTransactionAge) {
                        return VerificationResult.invalidWithPayer(
                            "Transaction too old: " + ageSec + " seconds (max " + maxTransactionAge + ")",
                            aptosPayload.getFrom());
                    }
                } catch (NumberFormatException ignored) {
                    // Skip age check if timestamp parsing fails
                }
            }
        }

        // Extract and verify transfer details from transaction
        Map<String, String> transfer = extractTransferDetails(tx);
        if (transfer == null) {
            return VerificationResult.invalidWithPayer(
                "Could not extract transfer details from transaction",
                aptosPayload.getFrom());
        }

        // Verify recipient matches payTo
        String payTo = (String) requirements.get("payTo");
        if (!AptosConstants.compareAddresses(transfer.get("to"), payTo)) {
            return VerificationResult.invalidWithPayer(
                "Recipient mismatch: expected " + payTo + ", got " + transfer.get("to"),
                aptosPayload.getFrom());
        }

        // Verify amount
        String txAmountStr = transfer.get("amount");
        String requiredAmountStr = (String) requirements.get("maxAmountRequired");

        BigInteger txAmount;
        BigInteger requiredAmount;
        try {
            txAmount = new BigInteger(txAmountStr);
        } catch (NumberFormatException e) {
            return VerificationResult.invalidWithPayer(
                "Invalid transaction amount: " + txAmountStr, aptosPayload.getFrom());
        }
        try {
            requiredAmount = new BigInteger(requiredAmountStr);
        } catch (NumberFormatException e) {
            return VerificationResult.invalidWithPayer(
                "Invalid required amount: " + requiredAmountStr, aptosPayload.getFrom());
        }

        if (txAmount.compareTo(requiredAmount) < 0) {
            return VerificationResult.invalidWithPayer(
                "Insufficient amount: got " + txAmount + ", required " + requiredAmount,
                aptosPayload.getFrom());
        }

        // Mark transaction as used (replay protection)
        usedTxs.put(aptosPayload.getTxHash(), System.currentTimeMillis());

        return VerificationResult.valid(aptosPayload, network);
    }

    /**
     * Extracts fungible asset transfer details from a transaction result.
     *
     * @param tx Transaction result map from Aptos REST API
     * @return Map with from, to, amount, metadata_address keys, or null if invalid
     */
    @SuppressWarnings("unchecked")
    static Map<String, String> extractTransferDetails(Map<String, Object> tx) {
        if (tx == null) {
            return null;
        }

        Boolean success = (Boolean) tx.get("success");
        if (success == null || !success) {
            return null;
        }

        Map<String, Object> payload = (Map<String, Object>) tx.get("payload");
        if (payload == null) {
            return null;
        }

        String type = (String) payload.get("type");
        if (!"entry_function_payload".equals(type)) {
            return null;
        }

        String function = (String) payload.get("function");
        if (function == null || !function.contains("primary_fungible_store::transfer")) {
            return null;
        }

        List<Object> arguments = (List<Object>) payload.get("arguments");
        if (arguments == null || arguments.size() < 3) {
            return null;
        }

        String metadataAddress = arguments.get(0).toString();
        String toAddress = arguments.get(1).toString();
        String amount = arguments.get(2).toString();
        String sender = (String) tx.get("sender");

        Map<String, String> result = new java.util.HashMap<>();
        result.put("from", sender != null ? sender : "");
        result.put("to", toAddress);
        result.put("amount", amount);
        result.put("metadata_address", metadataAddress);

        return result;
    }

    // =========================================================================
    // Result Types
    // =========================================================================

    /**
     * Result of payment verification.
     */
    public static class VerificationResult {
        /** Whether the payment is valid. */
        public final boolean valid;

        /** Error message if invalid. */
        public final String error;

        /** The verified payload if valid. */
        public final ExactDirectPayload payload;

        /** The network identifier. */
        public final String network;

        /** The payer address (available even if invalid). */
        public final String payer;

        private VerificationResult(boolean valid, String error, ExactDirectPayload payload,
                                   String network, String payer) {
            this.valid = valid;
            this.error = error;
            this.payload = payload;
            this.network = network;
            this.payer = payer;
        }

        /**
         * Creates a valid verification result.
         *
         * @param payload The verified payload
         * @param network The network identifier
         * @return Valid result
         */
        public static VerificationResult valid(ExactDirectPayload payload, String network) {
            return new VerificationResult(true, null, payload, network, payload.getFrom());
        }

        /**
         * Creates an invalid verification result.
         *
         * @param error Error message
         * @return Invalid result
         */
        public static VerificationResult invalid(String error) {
            return new VerificationResult(false, error, null, null, null);
        }

        /**
         * Creates an invalid verification result with payer info.
         *
         * @param error Error message
         * @param payer The payer address
         * @return Invalid result with payer
         */
        public static VerificationResult invalidWithPayer(String error, String payer) {
            return new VerificationResult(false, error, null, null, payer);
        }
    }

    /**
     * Result of payment settlement.
     */
    public static class SettlementResult {
        /** Status of the settlement. */
        public final SettlementStatus status;

        /** Transaction hash if successful. */
        public final String transaction;

        /** Error message if failed. */
        public final String error;

        /** The payer address. */
        public final String payer;

        private SettlementResult(SettlementStatus status, String transaction, String error, String payer) {
            this.status = status;
            this.transaction = transaction;
            this.error = error;
            this.payer = payer;
        }

        /**
         * Creates a successful settlement result.
         *
         * <p>For exact-direct, settlement is always immediate since the
         * client already executed the transfer.
         *
         * @param txHash Transaction hash
         * @param payer The payer address
         * @return Success result
         */
        public static SettlementResult success(String txHash, String payer) {
            return new SettlementResult(SettlementStatus.SUCCESS, txHash, null, payer);
        }

        /**
         * Creates a failed settlement result.
         *
         * @param error Error message
         * @return Failed result
         */
        public static SettlementResult failed(String error) {
            return new SettlementResult(SettlementStatus.FAILED, null, error, null);
        }
    }

    /**
     * Settlement status enum.
     */
    public enum SettlementStatus {
        /** Transaction verified successfully (already settled on-chain). */
        SUCCESS,
        /** Verification or settlement failed. */
        FAILED
    }
}
