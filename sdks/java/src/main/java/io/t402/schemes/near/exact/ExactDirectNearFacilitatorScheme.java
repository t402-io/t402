package io.t402.schemes.near.exact;

import io.t402.schemes.near.ExactDirectPayload;
import io.t402.schemes.near.FacilitatorNearSigner;
import io.t402.schemes.near.NearConstants;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Facilitator scheme for NEAR exact-direct payment verification and settlement.
 * <p>
 * Handles verification of on-chain transactions for the exact-direct payment scheme.
 * Since the client already executed the ft_transfer, the facilitator verifies the
 * transaction was successful with the correct parameters and marks it as settled.
 * </p>
 *
 * <p>Features:
 * <ul>
 *   <li>Replay protection via concurrent transaction hash cache</li>
 *   <li>Validates transaction status, recipient, token contract, and amount</li>
 *   <li>Parses base64-encoded ft_transfer arguments from on-chain transactions</li>
 * </ul>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorNearSigner signer = new MyNearFacilitatorSigner(rpcClient);
 * ExactDirectNearFacilitatorScheme scheme = new ExactDirectNearFacilitatorScheme(signer);
 *
 * // Verify a payment
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.valid) {
 *     // Payment is valid, proceed to settle
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 *     System.out.println("Transaction hash: " + settlement.transaction);
 * }
 * }</pre>
 */
public class ExactDirectNearFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = NearConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for NEAR networks. */
    public static final String CAIP_FAMILY = NearConstants.CAIP_FAMILY;

    private final FacilitatorNearSigner signer;

    /** Used transaction cache for replay protection. Key: txHash, Value: timestamp. */
    private final ConcurrentHashMap<String, Long> usedTransactions = new ConcurrentHashMap<>();

    /**
     * Creates a new ExactDirectNearFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for transaction queries
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectNearFacilitatorScheme(FacilitatorNearSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the facilitator account IDs for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return List of NEAR account IDs
     */
    public List<String> getSigners(String network) {
        return signer.getAddresses(network);
    }

    /**
     * Gets extra metadata for the supported kinds response.
     *
     * @param network Network identifier
     * @return Map with assetSymbol and assetDecimals
     */
    public Map<String, Object> getExtra(String network) {
        Map<String, Object> extra = new java.util.HashMap<>();
        extra.put("assetSymbol", NearConstants.DEFAULT_TOKEN);
        extra.put("assetDecimals", NearConstants.USDT_DECIMALS);
        return extra;
    }

    /**
     * Verifies a payment payload by checking the on-chain transaction.
     *
     * <p>Validates:
     * <ol>
     *   <li>Payload has correct structure with txHash and from fields</li>
     *   <li>Transaction has not been used before (replay protection)</li>
     *   <li>Transaction was successful on-chain</li>
     *   <li>Transaction was sent to the correct token contract</li>
     *   <li>The ft_transfer action has the correct recipient</li>
     *   <li>The transfer amount is &gt;= the required amount</li>
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
                    VerificationResult.invalid("Missing payload")
                );
            }

            // Determine network
            String network = (String) payload.get("network");
            if (network == null) {
                network = (String) requirements.get("network");
            }
            network = NearConstants.normalizeNetwork(network);

            if (!NearConstants.isValidNetwork(network)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Unsupported network: " + network)
                );
            }

            // Parse the exact-direct payload
            ExactDirectPayload nearPayload;
            try {
                nearPayload = ExactDirectPayload.fromMap(innerPayload);
            } catch (IllegalArgumentException e) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Invalid payload: " + e.getMessage())
                );
            }

            // Check replay protection
            if (usedTransactions.containsKey(nearPayload.getTxHash())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Transaction has already been used",
                        nearPayload.getFrom())
                );
            }

            // Validate required amount
            String requiredAmount = (String) requirements.get("maxAmountRequired");
            if (requiredAmount == null) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Missing maxAmountRequired in requirements")
                );
            }

            // Validate payTo
            String payTo = (String) requirements.get("payTo");
            if (payTo == null || payTo.isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Missing payTo in requirements")
                );
            }

            // Validate asset (token contract)
            String requiredAsset = (String) requirements.get("asset");
            if (requiredAsset == null || requiredAsset.isEmpty()) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Missing asset in requirements")
                );
            }

            // Query the transaction from the NEAR RPC
            String finalNetwork = network;
            return signer.queryTransaction(nearPayload.getTxHash(), nearPayload.getFrom(), network)
                .thenApply(txResult -> verifyTransactionResult(
                    txResult, nearPayload, requiredAmount, payTo, requiredAsset, finalNetwork))
                .exceptionally(e -> VerificationResult.invalid(
                    "Transaction not found: " + e.getMessage(), nearPayload.getFrom()));

        } catch (Exception e) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("Verification error: " + e.getMessage())
            );
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
     * Settles a verified payment.
     *
     * <p>For exact-direct, the transfer was already executed by the client,
     * so settlement simply verifies the transaction and returns the tx hash.
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

                // For exact-direct, the transaction is already on-chain
                Map<String, Object> innerPayload =
                    (Map<String, Object>) payload.get("payload");
                String txHash = (String) innerPayload.get("txHash");

                return SettlementResult.success(txHash);
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
     * Verifies the on-chain transaction result against requirements.
     */
    @SuppressWarnings("unchecked")
    private VerificationResult verifyTransactionResult(
            Map<String, Object> txResult,
            ExactDirectPayload nearPayload,
            String requiredAmount,
            String payTo,
            String requiredAsset,
            String network) {

        if (txResult == null) {
            return VerificationResult.invalid("Empty transaction result",
                nearPayload.getFrom());
        }

        // Verify transaction succeeded
        Map<String, Object> status = (Map<String, Object>) txResult.get("status");
        if (status == null) {
            return VerificationResult.invalid("Missing status in transaction",
                nearPayload.getFrom());
        }

        if (status.containsKey("Failure") && status.get("Failure") != null) {
            return VerificationResult.invalid("Transaction failed on-chain",
                nearPayload.getFrom());
        }

        if (!status.containsKey("SuccessValue")) {
            return VerificationResult.invalid("Transaction did not succeed",
                nearPayload.getFrom());
        }

        // Verify the transaction receiver is the token contract
        Map<String, Object> transaction =
            (Map<String, Object>) txResult.get("transaction");
        if (transaction == null) {
            return VerificationResult.invalid("Missing transaction data",
                nearPayload.getFrom());
        }

        String receiverId = (String) transaction.get("receiver_id");
        if (!requiredAsset.equals(receiverId)) {
            return VerificationResult.invalid(
                "Wrong token contract: expected " + requiredAsset + ", got " + receiverId,
                nearPayload.getFrom());
        }

        // Find and verify ft_transfer action
        List<Map<String, Object>> actions =
            (List<Map<String, Object>>) transaction.get("actions");
        if (actions == null || actions.isEmpty()) {
            return VerificationResult.invalid("No actions in transaction",
                nearPayload.getFrom());
        }

        Map<String, Object> ftTransferArgs = findFtTransferArgs(actions);
        if (ftTransferArgs == null) {
            return VerificationResult.invalid(
                "No ft_transfer action found in transaction",
                nearPayload.getFrom());
        }

        // Verify recipient
        String txReceiverId = (String) ftTransferArgs.get("receiver_id");
        if (!payTo.equals(txReceiverId)) {
            return VerificationResult.invalid(
                "Wrong recipient: expected " + payTo + ", got " + txReceiverId,
                nearPayload.getFrom());
        }

        // Verify amount
        String txAmountStr = (String) ftTransferArgs.get("amount");
        try {
            BigInteger txAmount = new BigInteger(txAmountStr);
            BigInteger required = new BigInteger(requiredAmount);
            if (txAmount.compareTo(required) < 0) {
                return VerificationResult.invalid(
                    "Insufficient amount: expected " + required + ", got " + txAmount,
                    nearPayload.getFrom());
            }
        } catch (NumberFormatException e) {
            return VerificationResult.invalid(
                "Invalid amount format: " + txAmountStr,
                nearPayload.getFrom());
        }

        // Mark transaction as used (replay protection)
        usedTransactions.put(nearPayload.getTxHash(), System.currentTimeMillis());

        return VerificationResult.valid(nearPayload, network);
    }

    /**
     * Finds and parses ft_transfer arguments from transaction actions.
     *
     * @param actions List of transaction actions
     * @return Parsed ft_transfer arguments map, or null if not found
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> findFtTransferArgs(List<Map<String, Object>> actions) {
        for (Map<String, Object> action : actions) {
            Map<String, Object> funcCall =
                (Map<String, Object>) action.get("FunctionCall");
            if (funcCall == null) {
                continue;
            }

            String methodName = (String) funcCall.get("method_name");
            if (!NearConstants.FUNCTION_FT_TRANSFER.equals(methodName)) {
                continue;
            }

            Object argsObj = funcCall.get("args");
            if (argsObj == null) {
                continue;
            }

            String argsStr = argsObj.toString();

            // Try base64 decode first (NEAR RPC format)
            try {
                byte[] decoded = Base64.getDecoder().decode(argsStr);
                String json = new String(decoded, StandardCharsets.UTF_8);
                return parseSimpleJson(json);
            } catch (IllegalArgumentException e) {
                // Not base64, try direct JSON parse
                try {
                    return parseSimpleJson(argsStr);
                } catch (Exception ex) {
                    continue;
                }
            }
        }
        return null;
    }

    /**
     * Parses a simple JSON object into a map.
     *
     * <p>Handles basic JSON format: {"key": "value", "key2": "value2"}.
     *
     * @param json JSON string to parse
     * @return Map of key-value pairs
     */
    private Map<String, Object> parseSimpleJson(String json) {
        Map<String, Object> result = new java.util.HashMap<>();
        String trimmed = json.trim();
        if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
            throw new IllegalArgumentException("Not a JSON object");
        }

        String inner = trimmed.substring(1, trimmed.length() - 1).trim();
        if (inner.isEmpty()) {
            return result;
        }

        // Simple key-value parser for flat JSON objects
        int pos = 0;
        while (pos < inner.length()) {
            // Skip whitespace
            while (pos < inner.length() && Character.isWhitespace(inner.charAt(pos))) {
                pos++;
            }
            if (pos >= inner.length()) {
                break;
            }

            // Parse key
            if (inner.charAt(pos) != '"') {
                break;
            }
            pos++;
            int keyEnd = inner.indexOf('"', pos);
            if (keyEnd < 0) {
                break;
            }
            String key = inner.substring(pos, keyEnd);
            pos = keyEnd + 1;

            // Skip colon and whitespace
            while (pos < inner.length()
                    && (inner.charAt(pos) == ':' || Character.isWhitespace(inner.charAt(pos)))) {
                pos++;
            }

            // Parse value
            if (pos >= inner.length()) {
                break;
            }

            if (inner.charAt(pos) == '"') {
                // String value
                pos++;
                int valEnd = inner.indexOf('"', pos);
                if (valEnd < 0) {
                    break;
                }
                result.put(key, inner.substring(pos, valEnd));
                pos = valEnd + 1;
            } else if (inner.charAt(pos) == 'n') {
                // null
                result.put(key, null);
                pos += 4;
            } else {
                // Number or boolean
                int valEnd = pos;
                while (valEnd < inner.length()
                        && inner.charAt(valEnd) != ','
                        && inner.charAt(valEnd) != '}') {
                    valEnd++;
                }
                result.put(key, inner.substring(pos, valEnd).trim());
                pos = valEnd;
            }

            // Skip comma
            while (pos < inner.length()
                    && (inner.charAt(pos) == ',' || Character.isWhitespace(inner.charAt(pos)))) {
                pos++;
            }
        }

        return result;
    }

    /**
     * Clears expired entries from the used transaction cache.
     *
     * @param maxAgeMillis Maximum age in milliseconds
     */
    public void cleanupUsedTransactions(long maxAgeMillis) {
        long cutoff = System.currentTimeMillis() - maxAgeMillis;
        usedTransactions.entrySet().removeIf(entry -> entry.getValue() < cutoff);
    }

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

        /** The payer's NEAR account ID. */
        public final String payer;

        private VerificationResult(boolean valid, String error,
                ExactDirectPayload payload, String network, String payer) {
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
         * Creates an invalid verification result with payer information.
         *
         * @param error Error message
         * @param payer The payer's NEAR account ID
         * @return Invalid result
         */
        public static VerificationResult invalid(String error, String payer) {
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

        private SettlementResult(SettlementStatus status, String transaction, String error) {
            this.status = status;
            this.transaction = transaction;
            this.error = error;
        }

        /**
         * Creates a successful settlement result.
         *
         * @param txHash Transaction hash
         * @return Success result
         */
        public static SettlementResult success(String txHash) {
            return new SettlementResult(SettlementStatus.SUCCESS, txHash, null);
        }

        /**
         * Creates a failed settlement result.
         *
         * @param error Error message
         * @return Failed result
         */
        public static SettlementResult failed(String error) {
            return new SettlementResult(SettlementStatus.FAILED, null, error);
        }
    }

    /**
     * Settlement status enum.
     */
    public enum SettlementStatus {
        /** Transaction confirmed successfully (already on-chain for exact-direct). */
        SUCCESS,
        /** Transaction failed verification. */
        FAILED
    }
}
