package io.t402.schemes.polkadot.exact_direct;

import io.t402.schemes.polkadot.ClientPolkadotSigner;
import io.t402.schemes.polkadot.ExactDirectPayload;
import io.t402.schemes.polkadot.PolkadotConstants;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for Polkadot exact-direct payments using Asset Hub transfers.
 *
 * <p>In the exact-direct scheme, the client directly executes the
 * assets.transfer_keep_alive extrinsic on-chain and provides the extrinsic
 * hash as proof of payment.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientPolkadotSigner signer = new MyPolkadotSigner(keypair, rpcUrl);
 * ExactDirectPolkadotClientScheme scheme = new ExactDirectPolkadotClientScheme(signer);
 *
 * Map<String, Object> requirements = Map.of(
 *     "scheme", "exact-direct",
 *     "network", "polkadot:68d56f15f85d3136970ec16946040bc1",
 *     "payTo", "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
 *     "maxAmountRequired", "1000000",
 *     "asset", "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984"
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactDirectPolkadotClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = PolkadotConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Polkadot networks. */
    public static final String CAIP_FAMILY = PolkadotConstants.CAIP_FAMILY;

    private final ClientPolkadotSigner signer;

    /**
     * Creates a new ExactDirectPolkadotClientScheme with the given signer.
     *
     * @param signer Client signer for asset transfers
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectPolkadotClientScheme(ClientPolkadotSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's SS58-encoded address.
     *
     * @return SS58 address
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload by executing an asset transfer on-chain.
     *
     * <p>This method:
     * <ol>
     *   <li>Validates the payment requirements</li>
     *   <li>Resolves the asset ID from requirements</li>
     *   <li>Builds and submits the assets.transfer_keep_alive extrinsic</li>
     *   <li>Returns a payload containing the extrinsic hash as proof</li>
     * </ol>
     *
     * @param requirements Payment requirements map
     * @return CompletableFuture containing payment payload map
     * @throws IllegalArgumentException if requirements are invalid
     */
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        // Extract fields
        String network = (String) requirements.getOrDefault("network", PolkadotConstants.POLKADOT_ASSET_HUB);
        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String amount = (String) requirements.get("maxAmountRequired");
        if (amount == null) {
            amount = (String) requirements.get("amount");
        }
        String asset = (String) requirements.get("asset");

        // Validate
        if (!PolkadotConstants.isValidNetwork(network)) {
            throw new IllegalArgumentException("Invalid Polkadot network: " + network);
        }
        if (payTo == null || payTo.isEmpty()) {
            throw new IllegalArgumentException("PayTo address is required");
        }
        if (!PolkadotConstants.isValidSS58Address(payTo)) {
            throw new IllegalArgumentException("Invalid payTo SS58 address: " + payTo);
        }
        if (amount == null || amount.isEmpty()) {
            throw new IllegalArgumentException("Amount is required");
        }
        try {
            long amountLong = Long.parseLong(amount);
            if (amountLong <= 0) {
                throw new IllegalArgumentException("Amount must be positive: " + amount);
            }
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid amount format: " + amount);
        }

        // Resolve asset ID
        int assetId = resolveAssetId(asset, requirements);

        // Get sender address
        String fromAddress = signer.getAddress();
        if (fromAddress == null || fromAddress.isEmpty()) {
            throw new IllegalArgumentException("Signer address is empty");
        }

        // Build the extrinsic call (assets.transfer_keep_alive)
        Map<String, Object> call = new HashMap<>();
        call.put("assetId", assetId);
        call.put("target", payTo);
        call.put("amount", amount);

        String finalNetwork = network;
        String finalAmount = amount;

        // Sign and submit the extrinsic
        return signer.signAndSubmit(call, finalNetwork)
            .thenApply(result -> {
                String extrinsicHash = (String) result.getOrDefault("extrinsicHash", "");
                String blockHash = (String) result.getOrDefault("blockHash", "");
                Object indexObj = result.getOrDefault("extrinsicIndex", 0);
                int extrinsicIndex = indexObj instanceof Number
                    ? ((Number) indexObj).intValue() : 0;

                // Build the payload
                ExactDirectPayload payload = ExactDirectPayload.builder()
                    .extrinsicHash(extrinsicHash)
                    .blockHash(blockHash)
                    .extrinsicIndex(extrinsicIndex)
                    .from(fromAddress)
                    .to(payTo)
                    .amount(finalAmount)
                    .assetId(assetId)
                    .build();

                // Build result map
                Map<String, Object> payloadResult = new HashMap<>();
                payloadResult.put("t402Version", t402Version);
                payloadResult.put("scheme", SCHEME);
                payloadResult.put("network", finalNetwork);
                payloadResult.put("payload", payload.toMap());

                return payloadResult;
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
     * Resolves the asset ID from requirements.
     *
     * <p>Tries to determine the asset ID from:
     * <ol>
     *   <li>The extra.assetId field</li>
     *   <li>The CAIP-19 asset identifier</li>
     *   <li>The default USDT asset ID</li>
     * </ol>
     */
    @SuppressWarnings("unchecked")
    private int resolveAssetId(String asset, Map<String, Object> requirements) {
        // Try extra.assetId first
        Object extraObj = requirements.get("extra");
        if (extraObj instanceof Map) {
            Map<String, Object> extra = (Map<String, Object>) extraObj;
            Object assetIdVal = extra.get("assetId");
            if (assetIdVal instanceof Number) {
                return ((Number) assetIdVal).intValue();
            } else if (assetIdVal instanceof String) {
                try {
                    return Integer.parseInt((String) assetIdVal);
                } catch (NumberFormatException e) {
                    // Fall through
                }
            }
        }

        // Try parsing CAIP-19 asset identifier
        if (asset != null && !asset.isEmpty()) {
            int parsed = PolkadotConstants.parseAssetIdentifier(asset);
            if (parsed >= 0) {
                return parsed;
            }
        }

        // Fall back to default
        return PolkadotConstants.USDT_ASSET_ID;
    }
}
