package io.t402.schemes.tezos.exact_direct;

import io.t402.schemes.tezos.ExactDirectPayload;
import io.t402.schemes.tezos.FacilitatorTezosSigner;
import io.t402.schemes.tezos.TezosConstants;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for Tezos exact-direct payment verification and settlement.
 *
 * <p>In the exact-direct scheme, the client has already executed the FA2 transfer
 * on-chain. The facilitator's role is to verify the operation by querying the
 * Tezos blockchain and confirming that the transfer matches the payment requirements.
 *
 * <p>Verification checks:
 * <ol>
 *   <li>Operation exists and has status "applied"</li>
 *   <li>Target contract matches the expected FA2 contract</li>
 *   <li>Entrypoint is "transfer"</li>
 *   <li>Sender matches the payload's "from" field</li>
 *   <li>Recipient matches the requirements' "payTo" address</li>
 *   <li>Amount is &gt;= the required amount</li>
 *   <li>Token ID matches</li>
 * </ol>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorTezosSigner signer = new MyTezosQuerier(indexerUrl);
 * ExactDirectTezosFacilitatorScheme scheme = new ExactDirectTezosFacilitatorScheme(signer);
 *
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 *     System.out.println("Operation hash: " + settlement.transaction);
 * }
 * }</pre>
 */
public class ExactDirectTezosFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = TezosConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Tezos networks. */
    public static final String CAIP_FAMILY = TezosConstants.CAIP_FAMILY;

    private final FacilitatorTezosSigner signer;
    private final Map<String, String> addresses;

    /**
     * Creates a new ExactDirectTezosFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for querying operations
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectTezosFacilitatorScheme(FacilitatorTezosSigner signer) {
        this(signer, new HashMap<>());
    }

    /**
     * Creates a new ExactDirectTezosFacilitatorScheme with signer and addresses.
     *
     * @param signer Facilitator signer for querying operations
     * @param addresses Mapping of network to facilitator Tezos address
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectTezosFacilitatorScheme(FacilitatorTezosSigner signer, Map<String, String> addresses) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
        this.addresses = addresses != null ? addresses : new HashMap<>();
    }

    /**
     * Gets mechanism-specific extra data for supported kinds.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return null (no extra data needed for exact-direct scheme)
     */
    public Map<String, Object> getExtra(String network) {
        return null;
    }

    /**
     * Gets signer addresses for this facilitator on a given network.
     *
     * @param network Network identifier
     * @return List of facilitator addresses for the network
     */
    public List<String> getSigners(String network) {
        String address = addresses.get(network);
        if (address != null) {
            return List.of(address);
        }
        return List.of();
    }

    /**
     * Verifies a payment payload by querying the operation on-chain.
     *
     * @param payload Payment payload map (containing "payload" with opHash and transfer details)
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

            String opHash = exactPayload.getOpHash();
            String fromAddress = exactPayload.getFrom();

            // Validate operation hash format
            if (!TezosConstants.isValidOperationHash(opHash)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_operation_hash_format", fromAddress));
            }

            // Validate from address
            if (!TezosConstants.isValidAddress(fromAddress)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_sender_address", fromAddress));
            }

            // Get required fields from requirements
            String reqNetwork = (String) requirements.get("network");
            String reqPayTo = (String) requirements.get("payTo");
            String reqAmount = (String) requirements.get("maxAmountRequired");
            if (reqAmount == null) {
                reqAmount = (String) requirements.get("amount");
            }
            String reqAsset = (String) requirements.get("asset");

            // Resolve expected contract and token ID from requirements
            String expectedContract = exactPayload.getContractAddress();
            int expectedTokenId = exactPayload.getTokenId();
            if (reqAsset != null && !reqAsset.isEmpty()) {
                try {
                    Map<String, Object> assetInfo = ExactDirectTezosClientScheme.parseAssetIdentifier(reqAsset);
                    expectedContract = (String) assetInfo.get("contractAddress");
                    expectedTokenId = (int) assetInfo.get("tokenId");
                } catch (IllegalArgumentException e) {
                    return CompletableFuture.completedFuture(
                        VerificationResult.invalid("invalid_asset_in_requirements: " + e.getMessage(), fromAddress));
                }
            }

            // Query the operation on-chain
            String finalReqPayTo = reqPayTo;
            String finalReqAmount = reqAmount;
            String finalExpectedContract = expectedContract;
            int finalExpectedTokenId = expectedTokenId;

            return signer.getOperation(opHash, reqNetwork)
                .thenApply(operation -> {
                    if (operation == null) {
                        return VerificationResult.invalid("operation_not_found: " + opHash, fromAddress);
                    }

                    // Check operation status
                    String status = (String) operation.get("status");
                    if (!"applied".equals(status)) {
                        return VerificationResult.invalid(
                            "operation_status_not_applied: " + status, fromAddress);
                    }

                    // Check entrypoint
                    String entrypoint = (String) operation.get("entrypoint");
                    if (!TezosConstants.FA2_TRANSFER_ENTRYPOINT.equals(entrypoint)) {
                        return VerificationResult.invalid(
                            "invalid_entrypoint: " + entrypoint, fromAddress);
                    }

                    // Check target contract
                    Object targetObj = operation.get("target");
                    String targetAddress = "";
                    if (targetObj instanceof Map) {
                        targetAddress = (String) ((Map<String, Object>) targetObj).get("address");
                    }
                    if (!finalExpectedContract.equals(targetAddress)) {
                        return VerificationResult.invalid(
                            "contract_mismatch: expected " + finalExpectedContract + ", got " + targetAddress,
                            fromAddress);
                    }

                    // Check sender
                    Object senderObj = operation.get("sender");
                    String senderAddress = "";
                    if (senderObj instanceof Map) {
                        senderAddress = (String) ((Map<String, Object>) senderObj).get("address");
                    }
                    if (!fromAddress.equals(senderAddress)) {
                        return VerificationResult.invalid(
                            "sender_mismatch: expected " + fromAddress + ", got " + senderAddress,
                            fromAddress);
                    }

                    // Extract and verify transfer parameters
                    Map<String, Object> transferDetails = extractTransferDetails(operation);
                    if (transferDetails == null) {
                        return VerificationResult.invalid("failed_to_parse_transfer_parameters", fromAddress);
                    }

                    // Verify recipient
                    if (finalReqPayTo != null && !finalReqPayTo.isEmpty()) {
                        String transferTo = (String) transferDetails.get("to");
                        if (!finalReqPayTo.equals(transferTo)) {
                            return VerificationResult.invalid(
                                "recipient_mismatch: expected " + finalReqPayTo + ", got " + transferTo,
                                fromAddress);
                        }
                    }

                    // Verify amount
                    if (finalReqAmount != null && !finalReqAmount.isEmpty()) {
                        try {
                            BigInteger required = new BigInteger(finalReqAmount);
                            BigInteger transferred = new BigInteger((String) transferDetails.get("amount"));
                            if (transferred.compareTo(required) < 0) {
                                return VerificationResult.invalid(
                                    "amount_insufficient: transferred " + transferred + " < required " + required,
                                    fromAddress);
                            }
                        } catch (NumberFormatException e) {
                            return VerificationResult.invalid("invalid_amount_format", fromAddress);
                        }
                    }

                    // Verify token ID
                    int transferTokenId = (int) transferDetails.get("tokenId");
                    if (transferTokenId != finalExpectedTokenId) {
                        return VerificationResult.invalid(
                            "token_id_mismatch: expected " + finalExpectedTokenId + ", got " + transferTokenId,
                            fromAddress);
                    }

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
     * Settles a payment by verifying the operation on-chain.
     *
     * <p>In the exact-direct scheme, the transfer has already been executed by the client.
     * Settlement confirms verification and returns the operation hash.
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

                // Extract operation hash from payload
                Map<String, Object> innerPayload = (Map<String, Object>) payload.get("payload");
                String opHash = (String) innerPayload.get("opHash");

                return SettlementResult.success(network, opHash, verifyResult.payer);
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
     * Extracts FA2 transfer details from an operation.
     *
     * <p>Parses the FA2 transfer parameter structure:
     * [{from_: "tz1...", txs: [{to_: "tz1...", token_id: 0, amount: "1000000"}]}]
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> extractTransferDetails(Map<String, Object> operation) {
        Object parameterObj = operation.get("parameter");
        if (parameterObj == null) {
            return null;
        }

        try {
            List<Map<String, Object>> params;
            if (parameterObj instanceof List) {
                params = (List<Map<String, Object>>) parameterObj;
            } else if (parameterObj instanceof Map) {
                Map<String, Object> paramMap = (Map<String, Object>) parameterObj;
                Object value = paramMap.getOrDefault("value", paramMap);
                if (value instanceof List) {
                    params = (List<Map<String, Object>>) value;
                } else {
                    params = List.of((Map<String, Object>) value);
                }
            } else {
                return null;
            }

            if (params.isEmpty()) {
                return null;
            }

            Map<String, Object> firstParam = params.get(0);
            List<Map<String, Object>> txs = (List<Map<String, Object>>) firstParam.get("txs");
            if (txs == null || txs.isEmpty()) {
                return null;
            }

            Map<String, Object> firstTx = txs.get(0);
            String toAddress = (String) firstTx.getOrDefault("to_", firstTx.get("to"));
            String amount = String.valueOf(firstTx.getOrDefault("amount", "0"));
            Object tokenIdObj = firstTx.getOrDefault("token_id", 0);
            int tokenId;
            if (tokenIdObj instanceof Number) {
                tokenId = ((Number) tokenIdObj).intValue();
            } else if (tokenIdObj instanceof String) {
                tokenId = Integer.parseInt((String) tokenIdObj);
            } else {
                tokenId = 0;
            }

            Map<String, Object> result = new HashMap<>();
            result.put("to", toAddress);
            result.put("amount", amount);
            result.put("tokenId", tokenId);
            return result;

        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Result of payment verification.
     */
    public static class VerificationResult {
        /** Whether the payment is valid. */
        public final boolean isValid;
        /** Reason if invalid. */
        public final String invalidReason;
        /** The payer's Tezos address. */
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
        /** Operation hash (transaction). */
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
