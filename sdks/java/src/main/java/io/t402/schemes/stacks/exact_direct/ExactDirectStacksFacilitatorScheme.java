package io.t402.schemes.stacks.exact_direct;

import io.t402.schemes.stacks.ExactDirectPayload;
import io.t402.schemes.stacks.FacilitatorStacksSigner;
import io.t402.schemes.stacks.StacksConstants;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Facilitator scheme for Stacks exact-direct payment verification and settlement.
 *
 * <p>In the exact-direct scheme, the client has already executed the SIP-010 token
 * transfer on-chain. The facilitator's role is to verify the transaction by querying
 * the Hiro API and confirming that the transfer matches the payment requirements.
 *
 * <p>Verification checks:
 * <ol>
 *   <li>Transaction exists and was successful (tx_status == "success")</li>
 *   <li>It is a contract_call transaction</li>
 *   <li>The called function is a SIP-010 transfer</li>
 *   <li>Recipient matches the requirements' "payTo" address</li>
 *   <li>Amount is &gt;= the required amount</li>
 *   <li>Contract address matches (if specified)</li>
 *   <li>Transaction has not been used before (replay protection)</li>
 * </ol>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorStacksSigner signer = new MyStacksQuerier(apiUrl);
 * ExactDirectStacksFacilitatorScheme scheme = new ExactDirectStacksFacilitatorScheme(signer);
 *
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 *     System.out.println("Transaction ID: " + settlement.transaction);
 * }
 * }</pre>
 */
public class ExactDirectStacksFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = StacksConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Stacks networks. */
    public static final String CAIP_FAMILY = StacksConstants.CAIP_FAMILY;

    private final FacilitatorStacksSigner signer;
    private final Map<String, List<String>> addresses;
    private final ConcurrentHashMap<String, Long> usedTransactions;
    private final int maxTransactionAge;

    /**
     * Creates a new ExactDirectStacksFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for querying transactions
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectStacksFacilitatorScheme(FacilitatorStacksSigner signer) {
        this(signer, new HashMap<>(), StacksConstants.DEFAULT_MAX_TRANSACTION_AGE);
    }

    /**
     * Creates a new ExactDirectStacksFacilitatorScheme with signer and addresses.
     *
     * @param signer Facilitator signer for querying transactions
     * @param addresses Mapping of network to list of facilitator principal addresses
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectStacksFacilitatorScheme(
            FacilitatorStacksSigner signer,
            Map<String, List<String>> addresses) {
        this(signer, addresses, StacksConstants.DEFAULT_MAX_TRANSACTION_AGE);
    }

    /**
     * Creates a new ExactDirectStacksFacilitatorScheme with signer, addresses, and max age.
     *
     * @param signer Facilitator signer for querying transactions
     * @param addresses Mapping of network to list of facilitator principal addresses
     * @param maxTransactionAge Maximum allowed transaction age in seconds (0 to disable)
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectStacksFacilitatorScheme(
            FacilitatorStacksSigner signer,
            Map<String, List<String>> addresses,
            int maxTransactionAge) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
        this.addresses = addresses != null ? addresses : new HashMap<>();
        this.usedTransactions = new ConcurrentHashMap<>();
        this.maxTransactionAge = maxTransactionAge;
    }

    /**
     * Gets mechanism-specific extra data for supported kinds.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return Map with token metadata for the network, or null if unsupported
     */
    public Map<String, Object> getExtra(String network) {
        if (!StacksConstants.isSupportedNetwork(network)) {
            return null;
        }
        Map<String, Object> extra = new HashMap<>();
        extra.put("contractAddress", StacksConstants.getDefaultContract(network));
        extra.put("assetSymbol", StacksConstants.SUSDC_SYMBOL);
        extra.put("assetDecimals", StacksConstants.SUSDC_DECIMALS);
        return extra;
    }

    /**
     * Gets signer addresses for this facilitator on a given network.
     *
     * @param network Network identifier
     * @return List of facilitator principal addresses for the network
     */
    public List<String> getSigners(String network) {
        return addresses.getOrDefault(network, List.of());
    }

    /**
     * Verifies a payment payload by querying the transaction on-chain.
     *
     * @param payload Payment payload map (containing "payload" with transaction details)
     * @param requirements Payment requirements map
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
                    VerificationResult.invalid("invalid_payload_structure", null));
            }

            // Parse the payload
            ExactDirectPayload exactPayload;
            try {
                exactPayload = ExactDirectPayload.fromMap(innerPayload);
            } catch (Exception e) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_payload_format: " + e.getMessage(), null));
            }

            String txId = exactPayload.getTxId();
            String fromAddress = exactPayload.getFrom();

            // Validate transaction ID format
            if (!StacksConstants.isValidTxId(txId)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_tx_id_format", fromAddress));
            }

            // Check for replay attack
            if (isTransactionUsed(txId)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("transaction_already_used", fromAddress));
            }

            // Get required fields from requirements
            String reqNetwork = (String) requirements.get("network");
            String reqPayTo = (String) requirements.get("payTo");
            String reqAmount = (String) requirements.get("maxAmountRequired");
            if (reqAmount == null) {
                reqAmount = (String) requirements.get("amount");
            }

            // Resolve expected contract address
            String expectedContract = resolveExpectedContract(requirements, exactPayload);

            String finalReqPayTo = reqPayTo;
            String finalReqAmount = reqAmount;
            String finalExpectedContract = expectedContract;

            // Query the transaction on-chain
            return signer.queryTransaction(txId)
                .thenApply(txData -> {
                    if (txData == null) {
                        return VerificationResult.invalid("transaction_not_found", fromAddress);
                    }

                    // Check transaction status
                    String txStatus = (String) txData.getOrDefault("tx_status",
                        txData.get("txStatus"));
                    if (txStatus == null || !txStatus.equals("success")) {
                        return VerificationResult.invalid(
                            "transaction_failed: status=" + txStatus, fromAddress);
                    }

                    // Check transaction type
                    String txType = (String) txData.getOrDefault("tx_type",
                        txData.get("txType"));
                    if (txType == null || !txType.equals("contract_call")) {
                        return VerificationResult.invalid(
                            "invalid_tx_type: expected contract_call, got " + txType, fromAddress);
                    }

                    // Check sender matches from address
                    String senderAddress = (String) txData.getOrDefault("sender_address",
                        txData.get("senderAddress"));
                    if (senderAddress != null && !StacksConstants.comparePrincipals(senderAddress, fromAddress)) {
                        return VerificationResult.invalid(
                            "sender_mismatch: expected " + fromAddress + ", got " + senderAddress,
                            fromAddress);
                    }

                    // Check transaction age
                    if (maxTransactionAge > 0) {
                        Object burnBlockTimeObj = txData.getOrDefault("burn_block_time",
                            txData.get("burnBlockTime"));
                        if (burnBlockTimeObj instanceof Number) {
                            long burnBlockTime = ((Number) burnBlockTimeObj).longValue();
                            long ageSeconds = (System.currentTimeMillis() / 1000) - burnBlockTime;
                            if (ageSeconds > maxTransactionAge) {
                                return VerificationResult.invalid(
                                    "transaction_too_old: " + ageSeconds + " seconds",
                                    fromAddress);
                            }
                        }
                    }

                    // Extract transfer details from contract_call
                    Map<String, Object> transferDetails = extractTransferDetails(txData);
                    if (transferDetails == null) {
                        // Fallback: try post_conditions
                        transferDetails = extractFromPostConditions(txData, finalExpectedContract);
                    }

                    if (transferDetails == null) {
                        return VerificationResult.invalid("not_token_transfer", fromAddress);
                    }

                    // Verify contract address
                    if (finalExpectedContract != null && !finalExpectedContract.isEmpty()) {
                        String txContract = (String) transferDetails.get("contractAddress");
                        if (txContract != null && !StacksConstants.comparePrincipals(txContract, finalExpectedContract)) {
                            return VerificationResult.invalid(
                                "contract_mismatch: expected " + finalExpectedContract + ", got " + txContract,
                                fromAddress);
                        }
                    }

                    // Verify recipient
                    if (finalReqPayTo != null && !finalReqPayTo.isEmpty()) {
                        String transferTo = (String) transferDetails.get("to");
                        if (!StacksConstants.comparePrincipals(transferTo, finalReqPayTo)) {
                            return VerificationResult.invalid(
                                "recipient_mismatch: expected " + finalReqPayTo + ", got " + transferTo,
                                fromAddress);
                        }
                    }

                    // Verify amount
                    if (finalReqAmount != null && !finalReqAmount.isEmpty()) {
                        try {
                            BigInteger required = new BigInteger(finalReqAmount);
                            BigInteger transferred = new BigInteger(
                                (String) transferDetails.get("amount"));
                            if (transferred.compareTo(required) < 0) {
                                return VerificationResult.invalid(
                                    "amount_insufficient: transferred " + transferred
                                        + " < required " + required,
                                    fromAddress);
                            }
                        } catch (NumberFormatException e) {
                            return VerificationResult.invalid("invalid_amount_format", fromAddress);
                        }
                    }

                    // Mark transaction as used (replay protection)
                    markTransactionUsed(txId);

                    // All checks passed
                    return VerificationResult.valid(fromAddress);
                })
                .exceptionally(ex ->
                    VerificationResult.invalid("verification_error: " + ex.getMessage(), fromAddress)
                );

        } catch (Exception e) {
            return CompletableFuture.completedFuture(
                VerificationResult.invalid("verification_error: " + e.getMessage(), null));
        }
    }

    /**
     * Settles a payment by verifying the transaction on-chain.
     *
     * <p>In the exact-direct scheme, the transfer has already been executed by the client.
     * Settlement confirms verification and returns the transaction ID.
     *
     * @param payload Payment payload map
     * @param requirements Payment requirements map
     * @return CompletableFuture containing settlement result
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<SettlementResult> settle(
            Map<String, Object> payload,
            Map<String, Object> requirements) {

        String network = (String) requirements.get("network");

        return verify(payload, requirements)
            .thenApply(verifyResult -> {
                if (!verifyResult.isValid) {
                    return SettlementResult.failure(network, null, verifyResult.invalidReason, verifyResult.payer);
                }

                // Extract transaction ID from payload
                Map<String, Object> innerPayload = (Map<String, Object>) payload.get("payload");
                String txId = (String) innerPayload.getOrDefault("txId",
                    innerPayload.get("tx_id"));

                return SettlementResult.success(network, txId, verifyResult.payer);
            })
            .exceptionally(ex ->
                SettlementResult.failure(network, null, "settlement_error: " + ex.getMessage(), null)
            );
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
     * Checks if a transaction has been used (replay protection).
     */
    private boolean isTransactionUsed(String txId) {
        return usedTransactions.containsKey(txId);
    }

    /**
     * Marks a transaction as used (replay protection).
     */
    private void markTransactionUsed(String txId) {
        usedTransactions.put(txId, System.currentTimeMillis());
    }

    /**
     * Cleans up expired transaction records from the used transactions map.
     *
     * @param maxAgeMillis Maximum age in milliseconds before a record is removed
     */
    public void cleanupUsedTransactions(long maxAgeMillis) {
        long cutoff = System.currentTimeMillis() - maxAgeMillis;
        usedTransactions.entrySet().removeIf(entry -> entry.getValue() < cutoff);
    }

    /**
     * Resolves the expected contract address from requirements.
     */
    @SuppressWarnings("unchecked")
    private String resolveExpectedContract(Map<String, Object> requirements, ExactDirectPayload payload) {
        // Try extra.contractAddress
        Object extraObj = requirements.get("extra");
        if (extraObj instanceof Map) {
            Map<String, Object> extra = (Map<String, Object>) extraObj;
            Object contractVal = extra.get("contractAddress");
            if (contractVal instanceof String && !((String) contractVal).isEmpty()) {
                return (String) contractVal;
            }
        }

        // Try the payload's contract address
        if (payload.getContractAddress() != null && !payload.getContractAddress().isEmpty()) {
            return payload.getContractAddress();
        }

        // Try default for network
        String network = (String) requirements.get("network");
        if (network != null && StacksConstants.isSupportedNetwork(network)) {
            return StacksConstants.getDefaultContract(network);
        }

        return null;
    }

    /**
     * Extracts transfer details from a contract_call transaction.
     *
     * <p>Looks for a SIP-010 transfer function call with function_args
     * containing the recipient and amount.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> extractTransferDetails(Map<String, Object> txData) {
        Object contractCallObj = txData.getOrDefault("contract_call",
            txData.get("contractCall"));
        if (!(contractCallObj instanceof Map)) {
            return null;
        }

        Map<String, Object> contractCall = (Map<String, Object>) contractCallObj;

        // Check function name is "transfer"
        String functionName = (String) contractCall.getOrDefault("function_name",
            contractCall.get("functionName"));
        if (functionName == null || !functionName.equals("transfer")) {
            return null;
        }

        // Get contract ID
        String contractId = (String) contractCall.getOrDefault("contract_id",
            contractCall.get("contractId"));

        // Parse function args
        Object argsObj = contractCall.getOrDefault("function_args",
            contractCall.get("functionArgs"));
        if (!(argsObj instanceof List)) {
            return null;
        }

        List<Map<String, Object>> args = (List<Map<String, Object>>) argsObj;

        String amount = null;
        String recipient = null;

        for (Object argObj : args) {
            if (!(argObj instanceof Map)) {
                continue;
            }
            Map<String, Object> arg = (Map<String, Object>) argObj;
            String name = (String) arg.get("name");
            String repr = (String) arg.get("repr");

            if (name == null) {
                continue;
            }

            switch (name) {
                case "amount":
                    // repr format is typically "u1000000" for uint
                    if (repr != null && repr.startsWith("u")) {
                        amount = repr.substring(1);
                    } else {
                        Object valueObj = arg.get("value");
                        if (valueObj != null) {
                            amount = String.valueOf(valueObj);
                        }
                    }
                    break;
                case "recipient":
                case "to":
                    // repr format is typically "'SP..." for principal
                    if (repr != null && repr.startsWith("'")) {
                        recipient = repr.substring(1);
                    } else {
                        Object valueObj = arg.get("value");
                        if (valueObj instanceof String) {
                            recipient = (String) valueObj;
                        }
                    }
                    break;
                default:
                    break;
            }
        }

        if (amount == null || recipient == null) {
            return null;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("contractAddress", contractId);
        result.put("to", recipient);
        result.put("amount", amount);
        return result;
    }

    /**
     * Extracts transfer details from post-conditions (fallback verification).
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> extractFromPostConditions(Map<String, Object> txData, String expectedContract) {
        Object postConditionsObj = txData.getOrDefault("post_conditions",
            txData.get("postConditions"));
        if (!(postConditionsObj instanceof List)) {
            return null;
        }

        List<Map<String, Object>> postConditions = (List<Map<String, Object>>) postConditionsObj;

        for (Object pcObj : postConditions) {
            if (!(pcObj instanceof Map)) {
                continue;
            }
            Map<String, Object> pc = (Map<String, Object>) pcObj;

            String type = (String) pc.get("type");
            if (!"fungible".equals(type)) {
                continue;
            }

            // Get amount
            Object amountObj = pc.get("amount");
            String amount = amountObj != null ? String.valueOf(amountObj) : null;

            // Get contract address from asset
            Object assetObj = pc.get("asset");
            String contractAddress = null;
            if (assetObj instanceof Map) {
                Map<String, Object> asset = (Map<String, Object>) assetObj;
                contractAddress = (String) asset.getOrDefault("contract_id",
                    asset.get("contractId"));
            }

            // Check if this matches the expected contract
            if (expectedContract != null && contractAddress != null
                && !StacksConstants.comparePrincipals(contractAddress, expectedContract)) {
                continue;
            }

            // Get principal (sender)
            String principal = (String) pc.getOrDefault("principal",
                pc.get("address"));

            if (amount != null) {
                // For post-conditions, we need to get the recipient from tx_result or events
                // Use the payTo from requirements as fallback
                Map<String, Object> result = new HashMap<>();
                result.put("contractAddress", contractAddress);
                result.put("amount", amount);
                result.put("to", ""); // Will be checked against requirements separately
                return result;
            }
        }

        return null;
    }

    /**
     * Result of payment verification.
     */
    public static class VerificationResult {
        /** Whether the payment is valid. */
        public final boolean isValid;
        /** Reason if invalid. */
        public final String invalidReason;
        /** The payer's principal address. */
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
        /** Whether settlement succeeded. */
        public final boolean success;
        /** Network identifier. */
        public final String network;
        /** Transaction ID. */
        public final String transaction;
        /** Error reason if failed. */
        public final String errorReason;
        /** The payer's address. */
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
