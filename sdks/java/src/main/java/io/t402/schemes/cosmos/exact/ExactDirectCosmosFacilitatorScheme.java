package io.t402.schemes.cosmos.exact;

import io.t402.schemes.cosmos.CosmosConstants;
import io.t402.schemes.cosmos.CosmosTransactionResult;
import io.t402.schemes.cosmos.ExactDirectPayload;
import io.t402.schemes.cosmos.FacilitatorCosmosSigner;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Facilitator scheme for Cosmos exact-direct payment verification and settlement.
 * <p>
 * Handles verification of on-chain transactions for the exact-direct payment scheme.
 * Since the client already executed the bank MsgSend, the facilitator verifies the
 * transaction was successful with the correct parameters and marks it as settled.
 * </p>
 *
 * <p>Features:
 * <ul>
 *   <li>Replay protection via concurrent transaction hash cache</li>
 *   <li>Validates transaction success (code == 0), recipient, denom, and amount</li>
 *   <li>Parses MsgSend messages from Cosmos transaction results</li>
 * </ul>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorCosmosSigner signer = new MyCosmosRpcFacilitator(restClient);
 * ExactDirectCosmosFacilitatorScheme scheme = new ExactDirectCosmosFacilitatorScheme(signer);
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
public class ExactDirectCosmosFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = CosmosConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Cosmos networks. */
    public static final String CAIP_FAMILY = CosmosConstants.CAIP_FAMILY;

    private final FacilitatorCosmosSigner signer;

    /** Used transaction cache for replay protection. Key: txHash, Value: timestamp. */
    private final ConcurrentHashMap<String, Long> usedTransactions = new ConcurrentHashMap<>();

    /**
     * Creates a new ExactDirectCosmosFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for transaction queries
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectCosmosFacilitatorScheme(FacilitatorCosmosSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the facilitator addresses for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return List of bech32 addresses
     */
    public List<String> getSigners(String network) {
        return signer.getAddresses(network);
    }

    /**
     * Gets extra metadata for the supported kinds response.
     *
     * @param network Network identifier
     * @return Map with assetSymbol, assetDecimals, and assetDenom
     */
    public Map<String, Object> getExtra(String network) {
        Map<String, Object> extra = new HashMap<>();
        extra.put("assetSymbol", CosmosConstants.USDC_SYMBOL);
        extra.put("assetDecimals", CosmosConstants.USDC_DECIMALS);
        extra.put("assetDenom", CosmosConstants.USDC_DENOM);
        return extra;
    }

    /**
     * Verifies a payment payload by checking the on-chain transaction.
     *
     * <p>Validates:
     * <ol>
     *   <li>Payload has correct structure with txHash and from fields</li>
     *   <li>Network is supported</li>
     *   <li>Sender address has valid bech32 format</li>
     *   <li>Transaction has not been used before (replay protection)</li>
     *   <li>Transaction was successful on-chain (code == 0)</li>
     *   <li>Transaction contains a MsgSend to the correct recipient</li>
     *   <li>The transfer amount is &gt;= the required amount</li>
     *   <li>The correct denom was used</li>
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
            network = CosmosConstants.normalizeNetwork(network);

            if (!CosmosConstants.isValidNetwork(network)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Unsupported network: " + network)
                );
            }

            // Parse the exact-direct payload
            ExactDirectPayload cosmosPayload;
            try {
                cosmosPayload = ExactDirectPayload.fromMap(innerPayload);
            } catch (IllegalArgumentException e) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Invalid payload: " + e.getMessage())
                );
            }

            // Validate sender address format
            if (!CosmosConstants.isValidAddress(cosmosPayload.getFrom())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Invalid sender address: "
                        + cosmosPayload.getFrom(), cosmosPayload.getFrom())
                );
            }

            // Check replay protection
            if (usedTransactions.containsKey(cosmosPayload.getTxHash())) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("Transaction has already been used",
                        cosmosPayload.getFrom())
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

            // Determine expected denom
            String asset = (String) requirements.get("asset");
            final String expectedDenom;
            if (asset != null && !asset.isEmpty() && !"USDC".equals(asset)) {
                expectedDenom = asset;
            } else {
                expectedDenom = CosmosConstants.USDC_DENOM;
            }

            // Query the transaction from the Cosmos REST API
            final String finalNetwork = network;
            return signer.queryTransaction(network, cosmosPayload.getTxHash())
                .thenApply(txResult -> verifyTransactionResult(
                    txResult, cosmosPayload, requiredAmount, payTo,
                    expectedDenom, finalNetwork))
                .exceptionally(e -> VerificationResult.invalid(
                    "Transaction not found: " + e.getMessage(), cosmosPayload.getFrom()));

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
     *
     * @param txResult Transaction result from the REST API
     * @param cosmosPayload Parsed payload
     * @param requiredAmount Required amount in atomic units
     * @param payTo Expected recipient address
     * @param expectedDenom Expected token denomination
     * @param network Network identifier
     * @return Verification result
     */
    @SuppressWarnings("unchecked")
    private VerificationResult verifyTransactionResult(
            CosmosTransactionResult txResult,
            ExactDirectPayload cosmosPayload,
            String requiredAmount,
            String payTo,
            String expectedDenom,
            String network) {

        if (txResult == null) {
            return VerificationResult.invalid("Empty transaction result",
                cosmosPayload.getFrom());
        }

        // Verify transaction succeeded (code == 0)
        if (!txResult.isSuccess()) {
            return VerificationResult.invalid(
                "Transaction failed on-chain (code: " + txResult.getCode() + ")",
                cosmosPayload.getFrom());
        }

        // Find MsgSend in transaction messages
        List<Map<String, Object>> messages = txResult.getMessages();
        if (messages == null || messages.isEmpty()) {
            return VerificationResult.invalid("No messages in transaction",
                cosmosPayload.getFrom());
        }

        Map<String, Object> msgSend = findMsgSend(messages);
        if (msgSend == null) {
            return VerificationResult.invalid(
                "No bank send message found in transaction",
                cosmosPayload.getFrom());
        }

        // Verify sender matches
        String fromAddress = (String) msgSend.get("from_address");
        if (!cosmosPayload.getFrom().equals(fromAddress)) {
            return VerificationResult.invalid(
                "Sender mismatch: expected " + cosmosPayload.getFrom()
                    + ", got " + fromAddress,
                cosmosPayload.getFrom());
        }

        // Verify recipient
        String toAddress = (String) msgSend.get("to_address");
        if (!payTo.equals(toAddress)) {
            return VerificationResult.invalid(
                "Wrong recipient: expected " + payTo + ", got " + toAddress,
                cosmosPayload.getFrom());
        }

        // Find amount for expected denom
        String txAmount = getAmountByDenom(msgSend, expectedDenom);
        if (txAmount == null || txAmount.isEmpty()) {
            return VerificationResult.invalid(
                "Expected denom " + expectedDenom + " not found in transaction",
                cosmosPayload.getFrom());
        }

        // Verify amount using BigInteger comparison
        try {
            BigInteger txAmountBig = new BigInteger(txAmount);
            BigInteger required = new BigInteger(requiredAmount);
            if (txAmountBig.compareTo(required) < 0) {
                return VerificationResult.invalid(
                    "Insufficient amount: expected " + required + ", got " + txAmountBig,
                    cosmosPayload.getFrom());
            }
        } catch (NumberFormatException e) {
            return VerificationResult.invalid(
                "Invalid amount format: " + txAmount,
                cosmosPayload.getFrom());
        }

        // Mark transaction as used (replay protection)
        usedTransactions.put(cosmosPayload.getTxHash(), System.currentTimeMillis());

        return VerificationResult.valid(cosmosPayload, network);
    }

    /**
     * Finds a MsgSend message in the list of transaction messages.
     *
     * @param messages List of message maps
     * @return The first MsgSend message, or null if not found
     */
    private Map<String, Object> findMsgSend(List<Map<String, Object>> messages) {
        for (Map<String, Object> msg : messages) {
            String type = (String) msg.get("@type");
            if (CosmosConstants.MSG_TYPE_SEND.equals(type)) {
                return msg;
            }
        }
        return null;
    }

    /**
     * Gets the amount for a specific denom from a MsgSend message.
     *
     * @param msgSend MsgSend message map
     * @param denom Token denomination to find
     * @return Amount string, or null if denom not found
     */
    @SuppressWarnings("unchecked")
    private String getAmountByDenom(Map<String, Object> msgSend, String denom) {
        Object amountObj = msgSend.get("amount");
        if (amountObj instanceof List) {
            List<Map<String, Object>> coins = (List<Map<String, Object>>) amountObj;
            for (Map<String, Object> coin : coins) {
                if (denom.equals(coin.get("denom"))) {
                    return (String) coin.get("amount");
                }
            }
        }
        return null;
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

        /** The payer's Cosmos address. */
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
         * @param payer The payer's Cosmos address
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
