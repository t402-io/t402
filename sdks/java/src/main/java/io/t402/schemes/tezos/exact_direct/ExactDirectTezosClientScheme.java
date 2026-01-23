package io.t402.schemes.tezos.exact_direct;

import io.t402.schemes.tezos.ClientTezosSigner;
import io.t402.schemes.tezos.ExactDirectPayload;
import io.t402.schemes.tezos.TezosConstants;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for Tezos exact-direct payments using FA2 transfers.
 *
 * <p>In the exact-direct scheme, the client directly executes the FA2 transfer
 * on-chain and provides the operation hash as proof of payment. The facilitator
 * then verifies the operation status on-chain.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientTezosSigner signer = new MyTezosSigner(privateKey, rpcUrl);
 * ExactDirectTezosClientScheme scheme = new ExactDirectTezosClientScheme(signer);
 *
 * Map<String, Object> requirements = Map.of(
 *     "scheme", "exact-direct",
 *     "network", "tezos:NetXdQprcVkpaWU",
 *     "payTo", "tz1...",
 *     "maxAmountRequired", "1000000",
 *     "asset", "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0"
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactDirectTezosClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = TezosConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Tezos networks. */
    public static final String CAIP_FAMILY = TezosConstants.CAIP_FAMILY;

    private final ClientTezosSigner signer;

    /**
     * Creates a new ExactDirectTezosClientScheme with the given signer.
     *
     * @param signer Client signer for FA2 transfers
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectTezosClientScheme(ClientTezosSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's Tezos address.
     *
     * @return Tezos address (tz1/tz2/tz3 format)
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload by executing an FA2 transfer on-chain.
     *
     * <p>This method:
     * <ol>
     *   <li>Validates the payment requirements</li>
     *   <li>Parses the CAIP-19 asset identifier to get contract and token ID</li>
     *   <li>Executes the FA2 transfer on-chain via the signer</li>
     *   <li>Returns a payload containing the operation hash as proof</li>
     * </ol>
     *
     * @param requirements Payment requirements map
     * @return CompletableFuture containing payment payload map
     * @throws IllegalArgumentException if requirements are invalid
     */
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        // Extract fields
        String network = (String) requirements.getOrDefault("network", TezosConstants.TEZOS_MAINNET);
        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String amount = (String) requirements.get("maxAmountRequired");
        if (amount == null) {
            amount = (String) requirements.get("amount");
        }
        String asset = (String) requirements.get("asset");

        // Validate
        if (!TezosConstants.isValidNetwork(network)) {
            throw new IllegalArgumentException("Invalid Tezos network: " + network);
        }
        if (payTo == null || payTo.isEmpty()) {
            throw new IllegalArgumentException("PayTo address is required");
        }
        if (!TezosConstants.isValidAddress(payTo)) {
            throw new IllegalArgumentException("Invalid payTo address: " + payTo);
        }
        if (amount == null || amount.isEmpty()) {
            throw new IllegalArgumentException("Amount is required");
        }

        // Resolve contract address and token ID
        String contractAddress;
        int tokenId;
        if (asset != null && !asset.isEmpty()) {
            // Parse CAIP-19: tezos:{chainRef}/fa2:{contract}/{tokenId}
            Map<String, Object> assetInfo = parseAssetIdentifier(asset);
            contractAddress = (String) assetInfo.get("contractAddress");
            tokenId = (int) assetInfo.get("tokenId");
        } else {
            contractAddress = TezosConstants.USDT_MAINNET_CONTRACT;
            tokenId = TezosConstants.USDT_MAINNET_TOKEN_ID;
        }

        String finalAmount = amount;
        String finalNetwork = network;

        // Execute FA2 transfer on-chain
        return signer.transferFA2(contractAddress, tokenId, payTo, finalAmount, finalNetwork)
            .thenApply(opHash -> {
                // Build the payload
                ExactDirectPayload payload = ExactDirectPayload.builder()
                    .opHash(opHash)
                    .from(signer.getAddress())
                    .to(payTo)
                    .amount(finalAmount)
                    .contractAddress(contractAddress)
                    .tokenId(tokenId)
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
     * Parses a CAIP-19 asset identifier for Tezos FA2 tokens.
     *
     * <p>Supports formats:
     * <ul>
     *   <li>CAIP-19: tezos:{chainRef}/fa2:{contractAddress}/{tokenId}</li>
     *   <li>Simple: {contractAddress}/{tokenId} or just {contractAddress}</li>
     * </ul>
     *
     * @param asset The asset identifier string
     * @return Map with "contractAddress" and "tokenId"
     * @throws IllegalArgumentException if the format is unrecognized
     */
    static Map<String, Object> parseAssetIdentifier(String asset) {
        if (asset == null || asset.isEmpty()) {
            throw new IllegalArgumentException("Asset identifier is empty");
        }

        // Try CAIP-19 format: tezos:{chainRef}/fa2:{contract}/{tokenId}
        if (asset.startsWith("tezos:")) {
            String[] parts = asset.split("/");
            if (parts.length == 3 && parts[1].startsWith("fa2:")) {
                String contract = parts[1].substring(4); // Remove "fa2:" prefix
                int tokenId;
                try {
                    tokenId = Integer.parseInt(parts[2]);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("Invalid token ID in asset: " + asset);
                }
                Map<String, Object> result = new HashMap<>();
                result.put("contractAddress", contract);
                result.put("tokenId", tokenId);
                return result;
            }
        }

        // Try simple format: KT1.../tokenId or KT1...
        if (asset.startsWith("KT1")) {
            String[] parts = asset.split("/");
            String contract = parts[0];
            int tokenId = 0;
            if (parts.length == 2) {
                try {
                    tokenId = Integer.parseInt(parts[1]);
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("Invalid token ID in asset: " + asset);
                }
            }
            Map<String, Object> result = new HashMap<>();
            result.put("contractAddress", contract);
            result.put("tokenId", tokenId);
            return result;
        }

        throw new IllegalArgumentException("Unrecognized asset format: " + asset);
    }
}
