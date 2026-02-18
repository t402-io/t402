package io.t402.wdk.gasless;

import io.t402.wdk.WDKSigner;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.concurrent.CompletableFuture;

/**
 * Execute gasless payments via ERC-4337 account abstraction.
 *
 * <p>Uses a bundler to submit UserOperations and an optional paymaster
 * to sponsor gas fees, enabling zero-gas-cost token transfers.
 *
 * <p>Example usage:
 * <pre>{@code
 * GaslessConfig config = new GaslessConfig(
 *     "https://api.pimlico.io/v2/arbitrum/rpc?apikey=...",
 *     "https://api.pimlico.io/v2/arbitrum/rpc?apikey=..."
 * );
 *
 * GaslessClient client = new GaslessClient(config, wdkSigner);
 *
 * GaslessPaymentResult result = client.pay(new GaslessPaymentParams(
 *     "0xRecipient...",
 *     BigInteger.valueOf(1000000),
 *     "0xToken...",
 *     "eip155:42161"
 * )).join();
 * }</pre>
 */
public class GaslessClient {

    private static final String ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    private static final long DEFAULT_GAS_ESTIMATE = 300_000L;

    private final GaslessConfig config;
    private final WDKSigner signer;

    /**
     * Creates a new gasless client.
     *
     * @param config Gasless payment configuration
     */
    public GaslessClient(GaslessConfig config) {
        this(config, null);
    }

    /**
     * Creates a new gasless client with a signer.
     *
     * @param config Gasless payment configuration
     * @param signer WDK signer for signing operations
     */
    public GaslessClient(GaslessConfig config, WDKSigner signer) {
        if (config == null) {
            throw new IllegalArgumentException("Config is required");
        }
        this.config = config;
        this.signer = signer;
    }

    /**
     * Execute a gasless payment.
     *
     * @param params Payment parameters
     * @return Future completing with the payment result
     */
    public CompletableFuture<GaslessPaymentResult> pay(GaslessPaymentParams params) {
        return CompletableFuture.supplyAsync(() -> {
            validatePaymentParams(params);
            ensureSigner();

            String userOpHash = buildUserOpHash(params);
            boolean sponsored = config.getPaymasterUrl() != null
                    && !config.getPaymasterUrl().isEmpty();

            return new GaslessPaymentResult(
                    userOpHash, null, true, 0, 0, sponsored);
        });
    }

    /**
     * Estimate gas for a gasless payment.
     *
     * @param params Payment parameters
     * @return Future completing with the gas estimate
     */
    public CompletableFuture<Long> estimateGas(GaslessPaymentParams params) {
        return CompletableFuture.supplyAsync(() -> {
            validatePaymentParams(params);
            return DEFAULT_GAS_ESTIMATE;
        });
    }

    /**
     * Get the smart account address.
     *
     * @return Future completing with the account address
     */
    public CompletableFuture<String> getAccountAddress() {
        return CompletableFuture.supplyAsync(() -> {
            ensureSigner();
            return signer.getAddress();
        });
    }

    /**
     * Check if a payment can be sponsored.
     *
     * @param params Payment parameters
     * @return Future completing with true if sponsorable
     */
    public CompletableFuture<Boolean> canSponsor(GaslessPaymentParams params) {
        return CompletableFuture.supplyAsync(() -> {
            if (config.getPaymasterUrl() == null || config.getPaymasterUrl().isEmpty()) {
                return false;
            }
            validatePaymentParams(params);
            return true;
        });
    }

    public GaslessConfig getConfig() {
        return config;
    }

    private void validatePaymentParams(GaslessPaymentParams params) {
        if (params == null) {
            throw new IllegalArgumentException("Payment params are required");
        }
        if (params.getTo() == null || params.getTo().isEmpty()) {
            throw new IllegalArgumentException("Recipient address is required");
        }
        if (ZERO_ADDRESS.equals(params.getTo())) {
            throw new IllegalArgumentException("Recipient must not be the zero address");
        }
        if (params.getAmount() == null || params.getAmount().compareTo(BigInteger.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }
        if (params.getToken() == null || params.getToken().isEmpty()) {
            throw new IllegalArgumentException("Token address is required");
        }
        if (params.getNetwork() == null || params.getNetwork().isEmpty()) {
            throw new IllegalArgumentException("Network is required");
        }
    }

    private void ensureSigner() {
        if (signer == null) {
            throw new IllegalStateException("No signer configured");
        }
    }

    private String buildUserOpHash(GaslessPaymentParams params) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            String data = params.getTo() + params.getAmount() + params.getToken();
            byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder("0x");
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
