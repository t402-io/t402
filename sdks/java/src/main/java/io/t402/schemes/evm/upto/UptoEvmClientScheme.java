package io.t402.schemes.evm.upto;

import io.t402.schemes.evm.EvmConstants;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Client scheme for creating EVM payment payloads using EIP-2612 Permit.
 *
 * <p>Handles creation of signed permit authorization messages for the
 * up-to payment scheme on EVM-compatible chains. Unlike the exact scheme
 * (EIP-3009), the permit scheme allows partial settlement where the
 * facilitator can transfer up to the permitted amount.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ClientUptoEvmSigner signer = new MyUptoEvmWalletSigner(privateKey, chainId, tokenAddress);
 * UptoEvmClientScheme scheme = new UptoEvmClientScheme(signer);
 *
 * // Create payment payload
 * Map<String, Object> requirements = Map.of(
 *     "network", "eip155:8453",
 *     "payTo", "0xRecipient...",
 *     "maxAmountRequired", "1000000",
 *     "asset", "0xTokenAddress...",
 *     "extra", Map.of(
 *         "name", "USD Coin",
 *         "version", "2"
 *     )
 * );
 *
 * Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h2>Key Differences from Exact Scheme</h2>
 * <ul>
 *   <li>Uses EIP-2612 Permit (approve + transferFrom) instead of EIP-3009 TransferWithAuthorization</li>
 *   <li>The spender is the facilitator address, not the final recipient</li>
 *   <li>Nonce is a sequential counter from the token contract, not a random bytes32</li>
 *   <li>Signature is split into v, r, s components (not a single hex string)</li>
 *   <li>Allows partial settlement (settleAmount &lt;= permitted value)</li>
 * </ul>
 */
public class UptoEvmClientScheme {

    /** The scheme identifier. */
    public static final String SCHEME = EvmConstants.SCHEME_UPTO;

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = EvmConstants.CAIP_FAMILY;

    private final ClientUptoEvmSigner signer;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Creates a new UptoEvmClientScheme with the given signer.
     *
     * @param signer Client signer for EIP-712 Permit signing
     * @throws IllegalArgumentException if signer is null
     */
    public UptoEvmClientScheme(ClientUptoEvmSigner signer) {
        if (signer == null) {
            throw new IllegalArgumentException("Signer cannot be null");
        }
        this.signer = signer;
    }

    /**
     * Gets the signer's Ethereum address.
     *
     * @return 0x-prefixed Ethereum address
     */
    public String getAddress() {
        return signer.getAddress();
    }

    /**
     * Creates a payment payload for the given requirements.
     *
     * <p>This method:
     * <ol>
     *   <li>Extracts payment parameters from requirements</li>
     *   <li>Resolves the facilitator (spender) address from extra or uses payTo</li>
     *   <li>Queries the current permit nonce from the token contract</li>
     *   <li>Calculates a deadline with clock skew tolerance</li>
     *   <li>Constructs an EIP-2612 Permit message</li>
     *   <li>Signs it using EIP-712 typed data signing</li>
     *   <li>Returns the payload ready for transmission</li>
     * </ol>
     *
     * @param requirements Payment requirements map containing:
     *   <ul>
     *     <li>{@code network} - EVM network (CAIP-2 format, e.g., "eip155:8453")</li>
     *     <li>{@code payTo} - Final recipient Ethereum address (0x-prefixed)</li>
     *     <li>{@code maxAmountRequired} - Maximum amount in atomic units</li>
     *     <li>{@code asset} - Token contract address (optional, defaults based on network)</li>
     *     <li>{@code maxTimeoutSeconds} - Maximum validity duration in seconds</li>
     *     <li>{@code t402Version} - Protocol version (default 2)</li>
     *     <li>{@code extra} - Map with optional fields:
     *       <ul>
     *         <li>{@code routerAddress} - Spender address (facilitator/router)</li>
     *       </ul>
     *     </li>
     *   </ul>
     * @return CompletableFuture containing payment payload map
     */
    @SuppressWarnings("unchecked")
    public CompletableFuture<Map<String, Object>> createPaymentPayload(Map<String, Object> requirements) {
        String network = (String) requirements.getOrDefault("network", EvmConstants.ETHEREUM_MAINNET);

        if (!EvmConstants.isEvmNetwork(network)) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("Not an EVM network: " + network));
        }

        int t402Version = ((Number) requirements.getOrDefault("t402Version", 2)).intValue();
        String payTo = (String) requirements.get("payTo");
        String amount = (String) requirements.get("maxAmountRequired");
        int maxTimeout = ((Number) requirements.getOrDefault("maxTimeoutSeconds",
            EvmConstants.DEFAULT_VALIDITY_DURATION)).intValue();

        if (payTo == null || payTo.isEmpty()) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("payTo address is required"));
        }
        if (amount == null || amount.isEmpty()) {
            return CompletableFuture.failedFuture(
                new IllegalArgumentException("maxAmountRequired is required"));
        }

        // Determine spender (router/facilitator address)
        String spender = payTo; // Default to payTo if no router specified
        Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
        if (extra != null && extra.get("routerAddress") instanceof String) {
            spender = (String) extra.get("routerAddress");
        }

        // Determine token address
        String tokenAddress;
        String asset = (String) requirements.get("asset");
        if (asset != null && !asset.isEmpty()) {
            tokenAddress = asset;
        } else {
            tokenAddress = EvmConstants.getDefaultTokenAddress(network);
        }

        // Calculate deadline
        long now = System.currentTimeMillis() / 1000;
        long deadline = now + maxTimeout;

        // Generate a unique payment nonce for replay protection
        String paymentNonce = generatePaymentNonce();

        // Query the permit nonce from the token contract
        String finalSpender = spender;
        String finalTokenAddress = tokenAddress;

        return signer.getNonce(tokenAddress, network)
            .thenCompose(nonce -> {
                // Create permit authorization
                PermitAuthorization authorization = PermitAuthorization.builder()
                    .owner(signer.getAddress())
                    .spender(finalSpender)
                    .value(amount)
                    .deadline(String.valueOf(deadline))
                    .nonce(nonce)
                    .build();

                // Sign the permit
                return signer.signPermit(authorization, network)
                    .thenApply(signature -> {
                        // Create the payload
                        UptoEIP2612Payload uptoPayload = UptoEIP2612Payload.builder()
                            .signature(signature)
                            .authorization(authorization)
                            .paymentNonce(paymentNonce)
                            .build();

                        // Build result map
                        Map<String, Object> result = new HashMap<>();
                        result.put("t402Version", t402Version);
                        result.put("scheme", SCHEME);
                        result.put("network", network);
                        result.put("payload", uptoPayload.toMap());

                        return result;
                    });
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
     * Generates a unique 32-byte random payment nonce for replay protection.
     *
     * <p>This nonce is separate from the EIP-2612 permit nonce (which is a
     * sequential counter). The payment nonce prevents the same permit from
     * being submitted to the facilitator multiple times.</p>
     *
     * @return 0x-prefixed hex-encoded 32-byte nonce
     */
    private String generatePaymentNonce() {
        byte[] nonceBytes = new byte[32];
        secureRandom.nextBytes(nonceBytes);
        StringBuilder sb = new StringBuilder("0x");
        for (byte b : nonceBytes) {
            sb.append(String.format("%02x", b & 0xFF));
        }
        return sb.toString();
    }
}
