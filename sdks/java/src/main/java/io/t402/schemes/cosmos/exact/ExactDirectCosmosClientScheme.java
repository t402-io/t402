package io.t402.schemes.cosmos.exact;

import io.t402.schemes.cosmos.ClientCosmosSigner;
import io.t402.schemes.cosmos.CosmosConstants;
import io.t402.schemes.cosmos.ExactDirectPayload;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating Cosmos exact-direct payment payloads.
 *
 * <p>In the exact-direct scheme, the client executes the bank MsgSend
 * directly on-chain and provides the transaction hash as proof of payment.
 * This differs from the standard exact scheme where the facilitator executes
 * the transfer.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientCosmosSigner signer = new MyCosmosWalletSigner(keyPair);
 * ExactDirectCosmosClientScheme scheme = new ExactDirectCosmosClientScheme(signer);
 *
 * // Create payment payload by executing bank send on-chain
 * Map<String, Object> requirements = Map.of(
 *     "network", "cosmos:noble-1",
 *     "payTo", "noble1merchant...",
 *     "maxAmountRequired", "1000000",
 *     "asset", "uusdc"
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactDirectCosmosClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = CosmosConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Cosmos networks. */
    public static final String CAIP_FAMILY = CosmosConstants.CAIP_FAMILY;

    private final ClientCosmosSigner signer;

    /**
     * Creates a new ExactDirectCosmosClientScheme with the given signer.
     *
     * @param signer Client signer for transaction signing and sending
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectCosmosClientScheme(ClientCosmosSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's Cosmos address.
     *
     * @return Cosmos bech32 address
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload by executing a bank send on-chain.
     *
     * <p>Executes a MsgSend to the specified recipient and returns
     * the transaction hash as proof of payment.
     *
     * @param requirements Payment requirements map
     * @return CompletableFuture containing payment payload map
     * @throws IllegalArgumentException if requirements are invalid
     */
    public CompletableFuture<Map<String, Object>> createPaymentPayload(
            Map<String, Object> requirements) {

        String network = (String) requirements.getOrDefault("network",
            CosmosConstants.NOBLE_MAINNET);
        String normalizedNetwork = CosmosConstants.normalizeNetwork(network);

        if (!CosmosConstants.isValidNetwork(normalizedNetwork)) {
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
        if (amount == null || amount.isEmpty()) {
            throw new IllegalArgumentException("maxAmountRequired is required");
        }

        // Validate bech32 address
        if (!CosmosConstants.isValidAddress(payTo)) {
            throw new IllegalArgumentException("Invalid recipient address: " + payTo);
        }

        // Determine denom - use asset if provided, otherwise default to USDC
        final String denom;
        if (asset != null && !asset.isEmpty()) {
            // If asset is "USDC", use the denom; otherwise treat as denom directly
            if ("USDC".equals(asset)) {
                denom = CosmosConstants.USDC_DENOM;
            } else {
                denom = asset;
            }
        } else {
            denom = CosmosConstants.USDC_DENOM;
        }

        String senderAddress = signer.getAddress();

        // Execute the transfer via the signer
        final String finalNetwork = normalizedNetwork;
        return signer.sendTokens(finalNetwork, payTo, amount, denom)
            .thenApply(txHash -> {
                // Build the payload
                ExactDirectPayload payload = ExactDirectPayload.builder()
                    .txHash(txHash)
                    .from(senderAddress)
                    .to(payTo)
                    .amount(amount)
                    .denom(denom)
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
}
