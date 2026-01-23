package io.t402.schemes.near.exact;

import io.t402.schemes.near.ClientNearSigner;
import io.t402.schemes.near.ExactDirectPayload;
import io.t402.schemes.near.NearConstants;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating NEAR exact-direct payment payloads.
 *
 * <p>In the exact-direct scheme, the client executes the NEP-141 ft_transfer
 * directly on-chain and provides the transaction hash as proof of payment.
 * This differs from the standard exact scheme where the facilitator executes
 * the transfer.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientNearSigner signer = new MyNearWalletSigner(keyPair);
 * ExactDirectNearClientScheme scheme = new ExactDirectNearClientScheme(signer);
 *
 * // Create payment payload by executing ft_transfer on-chain
 * Map<String, Object> requirements = Map.of(
 *     "network", "near:mainnet",
 *     "payTo", "merchant.near",
 *     "maxAmountRequired", "1000000",
 *     "asset", "usdt.tether-token.near"
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactDirectNearClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = NearConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for NEAR networks. */
    public static final String CAIP_FAMILY = NearConstants.CAIP_FAMILY;

    private final ClientNearSigner signer;
    private final String memo;
    private final long gasAmount;

    /**
     * Creates a new ExactDirectNearClientScheme with the given signer.
     *
     * @param signer Client signer for transaction signing and sending
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectNearClientScheme(ClientNearSigner signer) {
        this(signer, null, NearConstants.DEFAULT_GAS);
    }

    /**
     * Creates a new ExactDirectNearClientScheme with configuration.
     *
     * @param signer Client signer for transaction signing and sending
     * @param memo Optional memo to include in the ft_transfer call
     * @param gasAmount Gas to attach to the ft_transfer call
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectNearClientScheme(ClientNearSigner signer, String memo, long gasAmount) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
        this.memo = memo;
        this.gasAmount = gasAmount;
    }

    /**
     * Gets the signer's NEAR account ID.
     *
     * @return NEAR account ID
     */
    public String getAccountId() {
        return signer.getAccountId();
    }

    /**
     * Creates a payment payload by executing ft_transfer on-chain.
     *
     * <p>Executes a NEP-141 ft_transfer to the specified recipient and returns
     * the transaction hash as proof of payment.
     *
     * @param requirements Payment requirements map
     * @return CompletableFuture containing payment payload map
     * @throws IllegalArgumentException if requirements are invalid
     */
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        String network = (String) requirements.getOrDefault("network", NearConstants.NEAR_MAINNET);
        String normalizedNetwork = NearConstants.normalizeNetwork(network);

        if (!NearConstants.isValidNetwork(normalizedNetwork)) {
            throw new IllegalArgumentException("Unsupported network: " + network);
        }

        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String asset = (String) requirements.get("asset");
        String amount = (String) requirements.get("maxAmountRequired");

        // Validate required fields
        if (payTo == null || payTo.isEmpty()) {
            throw new IllegalArgumentException("payTo address is required");
        }
        if (asset == null || asset.isEmpty()) {
            throw new IllegalArgumentException("Asset (token contract address) is required");
        }
        if (amount == null || amount.isEmpty()) {
            throw new IllegalArgumentException("maxAmountRequired is required");
        }

        // Validate account IDs
        if (!NearConstants.isValidAccountId(payTo)) {
            throw new IllegalArgumentException("Invalid recipient account ID: " + payTo);
        }
        String senderId = signer.getAccountId();
        if (!NearConstants.isValidAccountId(senderId)) {
            throw new IllegalArgumentException("Invalid sender account ID: " + senderId);
        }

        // Build ft_transfer arguments as JSON
        Map<String, Object> ftTransferArgs = new HashMap<>();
        ftTransferArgs.put("receiver_id", payTo);
        ftTransferArgs.put("amount", amount);
        if (memo != null && !memo.isEmpty()) {
            ftTransferArgs.put("memo", memo);
        }

        // Build the function call action
        Map<String, Object> functionCall = new HashMap<>();
        functionCall.put("method_name", NearConstants.FUNCTION_FT_TRANSFER);
        functionCall.put("args", toJson(ftTransferArgs));
        functionCall.put("gas", gasAmount);
        functionCall.put("deposit", NearConstants.STORAGE_DEPOSIT);

        Map<String, Object> action = new HashMap<>();
        action.put("FunctionCall", functionCall);

        List<Map<String, Object>> actions = new ArrayList<>();
        actions.add(action);

        // Execute the transfer via the signer
        String finalNetwork = normalizedNetwork;
        return signer.signAndSendTransaction(asset, actions, finalNetwork)
            .thenApply(txHash -> {
                // Build the payload
                ExactDirectPayload payload = ExactDirectPayload.builder()
                    .txHash(txHash)
                    .from(senderId)
                    .to(payTo)
                    .amount(amount)
                    .build();

                // Build result map
                Map<String, Object> result = new HashMap<>();
                result.put("t402Version", t402Version);
                result.put("scheme", SCHEME);
                result.put("network", finalNetwork);
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
     * Converts a map to a simple JSON string.
     *
     * @param map Map to serialize
     * @return JSON string representation
     */
    private String toJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first) {
                sb.append(",");
            }
            first = false;
            sb.append("\"").append(entry.getKey()).append("\":");
            Object value = entry.getValue();
            if (value instanceof String) {
                sb.append("\"").append(value).append("\"");
            } else {
                sb.append(value);
            }
        }
        sb.append("}");
        return sb.toString();
    }
}
