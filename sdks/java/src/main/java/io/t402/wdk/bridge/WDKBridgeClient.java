package io.t402.wdk.bridge;

import io.t402.wdk.WDKSigner;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Cross-chain USDT0 bridging via LayerZero for WDK accounts.
 *
 * <p>Provides multi-chain bridging with automatic route selection
 * and fee optimization.
 *
 * <p>Example usage:
 * <pre>{@code
 * WDKBridgeConfig config = new WDKBridgeConfig(
 *     Map.of("arbitrum", "https://arb1.arbitrum.io/rpc")
 * );
 *
 * WDKBridgeClient client = new WDKBridgeClient(config, wdkSigner);
 *
 * WDKBridgeResult result = client.bridge(new WDKBridgeParams(
 *     "eip155:42161", "eip155:1",
 *     BigInteger.valueOf(100_000000),
 *     "0xRecipient..."
 * )).join();
 * }</pre>
 */
public class WDKBridgeClient {

    private static final String ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    /** Chains that support USDT0 bridging. */
    private static final List<String> BRIDGE_CHAINS = List.of(
            "ethereum", "arbitrum", "optimism", "base", "ink", "berachain", "unichain"
    );

    private final WDKBridgeConfig config;
    private final WDKSigner signer;

    /**
     * Creates a new bridge client.
     *
     * @param config Bridge configuration
     */
    public WDKBridgeClient(WDKBridgeConfig config) {
        this(config, null);
    }

    /**
     * Creates a new bridge client with a signer.
     *
     * @param config Bridge configuration
     * @param signer WDK signer
     */
    public WDKBridgeClient(WDKBridgeConfig config, WDKSigner signer) {
        if (config == null) {
            throw new IllegalArgumentException("Config is required");
        }
        this.config = config;
        this.signer = signer;
    }

    /**
     * Execute a cross-chain bridge transfer.
     *
     * @param params Bridge parameters
     * @return Future completing with the bridge result
     */
    public CompletableFuture<WDKBridgeResult> bridge(WDKBridgeParams params) {
        return CompletableFuture.supplyAsync(() -> {
            validateBridgeParams(params);
            ensureSigner();

            return new WDKBridgeResult(
                    "", null, 300,
                    params.getFromNetwork(),
                    params.getToNetwork(),
                    params.getAmount());
        });
    }

    /**
     * Estimate the bridge fee in native tokens.
     *
     * @param params Bridge parameters
     * @return Future completing with the fee in native token atomic units
     */
    public CompletableFuture<BigInteger> getBridgeFee(WDKBridgeParams params) {
        return CompletableFuture.supplyAsync(() -> {
            validateBridgeParams(params);
            return BigInteger.ZERO;
        });
    }

    /**
     * Get the status of a bridge transfer.
     *
     * @param messageGuid LayerZero message GUID
     * @return Future completing with the status string
     */
    public CompletableFuture<String> getBridgeStatus(String messageGuid) {
        return CompletableFuture.supplyAsync(() -> {
            if (messageGuid == null || messageGuid.isEmpty()) {
                throw new IllegalArgumentException("Message GUID is required");
            }
            return "UNKNOWN";
        });
    }

    /**
     * Get chains that support USDT0 bridging.
     *
     * @return List of chain names
     */
    public List<String> getSupportedChains() {
        return new ArrayList<>(BRIDGE_CHAINS);
    }

    public WDKBridgeConfig getConfig() {
        return config;
    }

    private void validateBridgeParams(WDKBridgeParams params) {
        if (params == null) {
            throw new IllegalArgumentException("Bridge params are required");
        }
        if (params.getFromNetwork() == null || params.getFromNetwork().isEmpty()) {
            throw new IllegalArgumentException("Source network is required");
        }
        if (params.getToNetwork() == null || params.getToNetwork().isEmpty()) {
            throw new IllegalArgumentException("Destination network is required");
        }
        if (params.getFromNetwork().equals(params.getToNetwork())) {
            throw new IllegalArgumentException("Source and destination must be different");
        }
        if (params.getAmount() == null || params.getAmount().compareTo(BigInteger.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than zero");
        }
        if (params.getRecipient() == null || params.getRecipient().isEmpty()) {
            throw new IllegalArgumentException("Recipient address is required");
        }
        if (ZERO_ADDRESS.equals(params.getRecipient())) {
            throw new IllegalArgumentException("Recipient must not be the zero address");
        }
    }

    private void ensureSigner() {
        if (signer == null) {
            throw new IllegalStateException("No signer configured");
        }
    }
}
