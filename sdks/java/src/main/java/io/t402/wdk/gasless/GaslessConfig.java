package io.t402.wdk.gasless;

/**
 * Configuration for ERC-4337 gasless payments.
 */
public class GaslessConfig {

    /** ERC-4337 v0.7 EntryPoint address. */
    public static final String ENTRYPOINT_V07_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

    private final String bundlerUrl;
    private final String paymasterUrl;
    private final String entryPoint;
    private final int chainId;
    private final long timeoutMs;

    public GaslessConfig(String bundlerUrl, String paymasterUrl) {
        this(bundlerUrl, paymasterUrl, ENTRYPOINT_V07_ADDRESS, 42161, 30000);
    }

    public GaslessConfig(String bundlerUrl, String paymasterUrl, String entryPoint,
                         int chainId, long timeoutMs) {
        if (bundlerUrl == null || bundlerUrl.isEmpty()) {
            throw new IllegalArgumentException("Bundler URL is required");
        }
        this.bundlerUrl = bundlerUrl;
        this.paymasterUrl = paymasterUrl;
        this.entryPoint = entryPoint;
        this.chainId = chainId;
        this.timeoutMs = timeoutMs;
    }

    public String getBundlerUrl() {
        return bundlerUrl;
    }

    public String getPaymasterUrl() {
        return paymasterUrl;
    }

    public String getEntryPoint() {
        return entryPoint;
    }

    public int getChainId() {
        return chainId;
    }

    public long getTimeoutMs() {
        return timeoutMs;
    }
}
