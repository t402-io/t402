package io.t402.schemes.aptos.exact;

import io.t402.schemes.aptos.AptosConstants;
import io.t402.schemes.aptos.ClientAptosSigner;
import io.t402.schemes.aptos.ExactDirectPayload;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating Aptos exact-direct payment payloads.
 *
 * <p>Executes a Fungible Asset transfer on-chain via
 * {@code 0x1::primary_fungible_store::transfer} and returns the transaction
 * hash as proof of payment. The facilitator then verifies the transaction
 * details match the payment requirements.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientAptosSigner signer = new MyAptosSigner(account, client);
 * ExactDirectAptosClientScheme scheme = new ExactDirectAptosClientScheme(signer);
 *
 * // Create payment payload
 * Map<String, Object> requirements = Map.of(
 *     "network", "aptos:1",
 *     "payTo", "0x1234...abcd",
 *     "maxAmountRequired", "1000000",
 *     "asset", "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb"
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 */
public class ExactDirectAptosClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = AptosConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Aptos networks. */
    public static final String CAIP_FAMILY = AptosConstants.CAIP_FAMILY;

    private final ClientAptosSigner signer;

    /**
     * Creates a new ExactDirectAptosClientScheme with the given signer.
     *
     * @param signer Client signer for transaction signing and submission
     * @throws IllegalArgumentException if signer is null
     */
    public ExactDirectAptosClientScheme(ClientAptosSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's address.
     *
     * @return Aptos address
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload by executing the FA transfer on-chain.
     *
     * <p>This method:
     * <ol>
     *   <li>Validates the payment requirements</li>
     *   <li>Builds the FA transfer transaction payload</li>
     *   <li>Signs and submits the transaction via the signer</li>
     *   <li>Returns the transaction hash as proof of payment</li>
     * </ol>
     *
     * @param requirements Payment requirements map containing:
     *   <ul>
     *     <li>{@code network} - CAIP-2 network ID (e.g., "aptos:1")</li>
     *     <li>{@code payTo} - Recipient Aptos address</li>
     *     <li>{@code maxAmountRequired} - Amount in atomic units</li>
     *     <li>{@code asset} - FA metadata address</li>
     *   </ul>
     * @return CompletableFuture containing payment payload map
     */
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        try {
            // Extract and validate fields
            String network = (String) requirements.getOrDefault("network", AptosConstants.APTOS_MAINNET);
            String normalizedNetwork = AptosConstants.normalizeNetwork(network);

            int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
            String payTo = (String) requirements.get("payTo");
            String asset = (String) requirements.get("asset");
            String amount = (String) requirements.get("maxAmountRequired");

            // Validate network
            if (!normalizedNetwork.startsWith("aptos:")) {
                return CompletableFuture.failedFuture(
                    new IllegalArgumentException("Invalid network: " + network + " (expected aptos:* format)"));
            }
            if (!AptosConstants.isValidNetwork(normalizedNetwork)) {
                return CompletableFuture.failedFuture(
                    new IllegalArgumentException("Unsupported network: " + normalizedNetwork));
            }

            // Validate payTo
            if (payTo == null || payTo.isEmpty()) {
                return CompletableFuture.failedFuture(
                    new IllegalArgumentException("PayTo address is required"));
            }
            if (!AptosConstants.isValidAddress(payTo)) {
                return CompletableFuture.failedFuture(
                    new IllegalArgumentException("Invalid payTo address: " + payTo));
            }

            // Validate asset
            if (asset == null || asset.isEmpty()) {
                asset = AptosConstants.getUsdtMetadataAddress(normalizedNetwork);
            }
            if (!AptosConstants.isValidAddress(asset)) {
                return CompletableFuture.failedFuture(
                    new IllegalArgumentException("Invalid asset address: " + asset));
            }

            // Validate amount
            if (amount == null || amount.isEmpty()) {
                return CompletableFuture.failedFuture(
                    new IllegalArgumentException("Amount is required"));
            }
            try {
                long amountLong = Long.parseLong(amount);
                if (amountLong <= 0) {
                    return CompletableFuture.failedFuture(
                        new IllegalArgumentException("Amount must be positive, got: " + amount));
                }
            } catch (NumberFormatException e) {
                return CompletableFuture.failedFuture(
                    new IllegalArgumentException("Invalid amount: " + amount));
            }

            // Validate signer address
            String signerAddress = signer.getAddress();
            if (!AptosConstants.isValidAddress(signerAddress)) {
                return CompletableFuture.failedFuture(
                    new IllegalArgumentException("Invalid signer address: " + signerAddress));
            }

            // Build the FA transfer transaction payload
            List<Object> arguments = new ArrayList<>();
            arguments.add(asset);    // FA metadata address
            arguments.add(payTo);    // recipient address
            arguments.add(amount);   // amount (u64 as string)

            Map<String, Object> txPayload = new HashMap<>();
            txPayload.put("type", "entry_function_payload");
            txPayload.put("function", AptosConstants.FA_TRANSFER_FUNCTION);
            txPayload.put("type_arguments", new ArrayList<>());
            txPayload.put("arguments", arguments);

            // Sign and submit the transaction
            String finalAsset = asset;
            String finalNetwork = normalizedNetwork;

            return signer.signAndSubmit(txPayload, normalizedNetwork)
                .thenApply(txHash -> {
                    // Validate returned transaction hash
                    if (!AptosConstants.isValidTxHash(txHash)) {
                        throw new IllegalStateException(
                            "Signer returned invalid transaction hash: " + txHash);
                    }

                    // Build the exact-direct payload
                    ExactDirectPayload aptosPayload = ExactDirectPayload.builder()
                        .txHash(txHash)
                        .from(signerAddress)
                        .to(payTo)
                        .amount(amount)
                        .metadataAddress(finalAsset)
                        .build();

                    // Build result map
                    Map<String, Object> result = new HashMap<>();
                    result.put("t402Version", t402Version);
                    result.put("scheme", SCHEME);
                    result.put("network", finalNetwork);
                    result.put("payload", aptosPayload.toMap());

                    return result;
                });

        } catch (Exception e) {
            return CompletableFuture.failedFuture(e);
        }
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
