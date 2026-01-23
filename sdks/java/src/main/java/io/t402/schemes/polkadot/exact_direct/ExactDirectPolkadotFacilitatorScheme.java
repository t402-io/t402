package io.t402.schemes.polkadot.exact_direct;

import io.t402.schemes.polkadot.ExactDirectPayload;
import io.t402.schemes.polkadot.FacilitatorPolkadotSigner;
import io.t402.schemes.polkadot.PolkadotConstants;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Facilitator scheme for Polkadot exact-direct payment verification and settlement.
 *
 * <p>In the exact-direct scheme, the client has already executed the asset transfer
 * on-chain. The facilitator's role is to verify the extrinsic by querying the
 * Polkadot blockchain and confirming that the transfer matches the payment requirements.
 *
 * <p>Verification checks:
 * <ol>
 *   <li>Extrinsic exists and was successful</li>
 *   <li>It is an assets.transfer or assets.transfer_keep_alive call</li>
 *   <li>Sender matches the payload's "from" field</li>
 *   <li>Recipient matches the requirements' "payTo" address</li>
 *   <li>Amount is &gt;= the required amount</li>
 *   <li>Asset ID matches</li>
 * </ol>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * FacilitatorPolkadotSigner signer = new MyPolkadotQuerier(indexerUrl);
 * ExactDirectPolkadotFacilitatorScheme scheme = new ExactDirectPolkadotFacilitatorScheme(signer);
 *
 * VerificationResult result = scheme.verifySync(payload, requirements);
 * if (result.isValid) {
 *     SettlementResult settlement = scheme.settleSync(payload, requirements);
 *     System.out.println("Extrinsic hash: " + settlement.transaction);
 * }
 * }</pre>
 */
public class ExactDirectPolkadotFacilitatorScheme {

    /** The scheme identifier. */
    public static final String SCHEME = PolkadotConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Polkadot networks. */
    public static final String CAIP_FAMILY = PolkadotConstants.CAIP_FAMILY;

    private final FacilitatorPolkadotSigner signer;
    private final Map<String, List<String>> addresses;

    /**
     * Creates a new ExactDirectPolkadotFacilitatorScheme with the given signer.
     *
     * @param signer Facilitator signer for querying extrinsics
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectPolkadotFacilitatorScheme(FacilitatorPolkadotSigner signer) {
        this(signer, new HashMap<>());
    }

    /**
     * Creates a new ExactDirectPolkadotFacilitatorScheme with signer and addresses.
     *
     * @param signer Facilitator signer for querying extrinsics
     * @param addresses Mapping of network to list of facilitator SS58 addresses
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectPolkadotFacilitatorScheme(
            FacilitatorPolkadotSigner signer,
            Map<String, List<String>> addresses) {
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
     * @return Map with asset metadata for the network
     */
    public Map<String, Object> getExtra(String network) {
        if (!PolkadotConstants.isSupportedNetwork(network)) {
            return null;
        }
        Map<String, Object> extra = new HashMap<>();
        extra.put("assetId", PolkadotConstants.USDT_ASSET_ID);
        extra.put("assetSymbol", PolkadotConstants.DEFAULT_TOKEN);
        extra.put("assetDecimals", PolkadotConstants.USDT_DECIMALS);
        return extra;
    }

    /**
     * Gets signer addresses for this facilitator on a given network.
     *
     * @param network Network identifier
     * @return List of facilitator SS58 addresses for the network
     */
    public List<String> getSigners(String network) {
        return addresses.getOrDefault(network, List.of());
    }

    /**
     * Verifies a payment payload by querying the extrinsic on-chain.
     *
     * @param payload Payment payload map (containing "payload" with extrinsic details)
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

            String extrinsicHash = exactPayload.getExtrinsicHash();
            String fromAddress = exactPayload.getFrom();

            // Validate extrinsic hash format
            if (!PolkadotConstants.isValidHash(extrinsicHash)) {
                return CompletableFuture.completedFuture(
                    VerificationResult.invalid("invalid_extrinsic_hash_format", fromAddress));
            }

            // Get required fields from requirements
            String reqNetwork = (String) requirements.get("network");
            String reqPayTo = (String) requirements.get("payTo");
            String reqAmount = (String) requirements.get("maxAmountRequired");
            if (reqAmount == null) {
                reqAmount = (String) requirements.get("amount");
            }
            String reqAsset = (String) requirements.get("asset");

            // Resolve expected asset ID
            int expectedAssetId = resolveExpectedAssetId(reqAsset, requirements);

            String finalReqPayTo = reqPayTo;
            String finalReqAmount = reqAmount;

            // Query the extrinsic on-chain
            return signer.getExtrinsic(extrinsicHash, reqNetwork)
                .thenApply(extrinsicData -> {
                    if (extrinsicData == null) {
                        return VerificationResult.invalid("extrinsic_not_found", fromAddress);
                    }

                    // Check success
                    Boolean success = (Boolean) extrinsicData.get("success");
                    if (success == null || !success) {
                        return VerificationResult.invalid("extrinsic_failed", fromAddress);
                    }

                    // Check module (Assets)
                    String module = (String) extrinsicData.getOrDefault("call_module",
                        extrinsicData.get("module"));
                    if (module == null || !module.equalsIgnoreCase("assets")) {
                        return VerificationResult.invalid(
                            "invalid_module: expected Assets, got " + module, fromAddress);
                    }

                    // Check call (transfer or transfer_keep_alive)
                    String call = (String) extrinsicData.getOrDefault("call_module_function",
                        extrinsicData.get("call"));
                    if (call == null) {
                        return VerificationResult.invalid("missing_call_function", fromAddress);
                    }
                    String callLower = call.toLowerCase();
                    if (!callLower.equals("transfer") && !callLower.equals("transfer_keep_alive")) {
                        return VerificationResult.invalid(
                            "invalid_call: expected transfer/transfer_keep_alive, got " + call,
                            fromAddress);
                    }

                    // Check signer matches from address
                    String signerAddress = (String) extrinsicData.getOrDefault("account_id",
                        extrinsicData.get("signer"));
                    if (signerAddress != null && !signerAddress.equals(fromAddress)) {
                        return VerificationResult.invalid(
                            "sender_mismatch: expected " + fromAddress + ", got " + signerAddress,
                            fromAddress);
                    }

                    // Extract transfer parameters
                    Map<String, Object> transferDetails = extractTransferParams(extrinsicData);
                    if (transferDetails == null) {
                        return VerificationResult.invalid("failed_to_parse_transfer_params", fromAddress);
                    }

                    // Verify recipient
                    if (finalReqPayTo != null && !finalReqPayTo.isEmpty()) {
                        String transferTo = (String) transferDetails.get("target");
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

                    // Verify asset ID
                    int transferAssetId = (int) transferDetails.get("assetId");
                    if (expectedAssetId >= 0 && transferAssetId != expectedAssetId) {
                        return VerificationResult.invalid(
                            "asset_id_mismatch: expected " + expectedAssetId + ", got " + transferAssetId,
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
     * Settles a payment by verifying the extrinsic on-chain.
     *
     * <p>In the exact-direct scheme, the transfer has already been executed by the client.
     * Settlement confirms verification and returns the extrinsic hash.
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

                // Extract extrinsic hash from payload
                Map<String, Object> innerPayload = (Map<String, Object>) payload.get("payload");
                String extrinsicHash = (String) innerPayload.getOrDefault("extrinsicHash",
                    innerPayload.get("extrinsic_hash"));

                return SettlementResult.success(network, extrinsicHash, verifyResult.payer);
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
     * Resolves the expected asset ID from requirements.
     */
    @SuppressWarnings("unchecked")
    private int resolveExpectedAssetId(String asset, Map<String, Object> requirements) {
        // Try CAIP-19 identifier
        if (asset != null && !asset.isEmpty()) {
            int parsed = PolkadotConstants.parseAssetIdentifier(asset);
            if (parsed >= 0) {
                return parsed;
            }
        }

        // Try extra.assetId
        Object extraObj = requirements.get("extra");
        if (extraObj instanceof Map) {
            Map<String, Object> extra = (Map<String, Object>) extraObj;
            Object assetIdVal = extra.get("assetId");
            if (assetIdVal instanceof Number) {
                return ((Number) assetIdVal).intValue();
            }
        }

        // Default
        return PolkadotConstants.USDT_ASSET_ID;
    }

    /**
     * Extracts asset transfer parameters from an extrinsic result.
     *
     * <p>Looks for params with names: id/asset_id, target/dest, amount.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> extractTransferParams(Map<String, Object> extrinsicData) {
        Object paramsObj = extrinsicData.get("params");
        if (!(paramsObj instanceof List)) {
            return null;
        }

        List<Map<String, Object>> params = (List<Map<String, Object>>) paramsObj;

        Integer assetId = null;
        String target = null;
        String amount = null;

        for (Object paramObj : params) {
            if (!(paramObj instanceof Map)) {
                continue;
            }
            Map<String, Object> param = (Map<String, Object>) paramObj;
            String name = (String) param.get("name");
            Object value = param.get("value");

            if (name == null) {
                continue;
            }

            switch (name) {
                case "id":
                case "asset_id":
                    if (value instanceof Number) {
                        assetId = ((Number) value).intValue();
                    } else if (value instanceof String) {
                        try {
                            assetId = Integer.parseInt((String) value);
                        } catch (NumberFormatException e) {
                            // ignore
                        }
                    }
                    break;
                case "target":
                case "dest":
                    if (value instanceof String) {
                        target = (String) value;
                    } else if (value instanceof Map) {
                        // Handle MultiAddress enum: {"Id": "address"}
                        Map<String, Object> addrMap = (Map<String, Object>) value;
                        target = (String) addrMap.getOrDefault("Id", addrMap.get("id"));
                    }
                    break;
                case "amount":
                    if (value instanceof String) {
                        amount = (String) value;
                    } else if (value instanceof Number) {
                        amount = String.valueOf(((Number) value).longValue());
                    }
                    break;
                default:
                    break;
            }
        }

        if (assetId == null || target == null || amount == null) {
            return null;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("assetId", assetId);
        result.put("target", target);
        result.put("amount", amount);
        return result;
    }

    /**
     * Result of payment verification.
     */
    public static class VerificationResult {
        /** Whether the payment is valid. */
        public final boolean isValid;
        /** Reason if invalid. */
        public final String invalidReason;
        /** The payer's SS58 address. */
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
        /** Extrinsic hash (transaction). */
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
