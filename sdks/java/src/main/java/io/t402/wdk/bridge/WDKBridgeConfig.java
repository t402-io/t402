package io.t402.wdk.bridge;

import java.util.Collections;
import java.util.Map;

/**
 * Configuration for cross-chain USDT0 bridging.
 */
public class WDKBridgeConfig {

    private final Map<String, String> rpcUrls;
    private final double defaultSlippage;
    private final long timeoutMs;

    public WDKBridgeConfig(Map<String, String> rpcUrls) {
        this(rpcUrls, 0.5, 600_000);
    }

    public WDKBridgeConfig(Map<String, String> rpcUrls, double defaultSlippage, long timeoutMs) {
        this.rpcUrls = rpcUrls != null ? Collections.unmodifiableMap(rpcUrls) : Collections.emptyMap();
        this.defaultSlippage = defaultSlippage;
        this.timeoutMs = timeoutMs;
    }

    public Map<String, String> getRpcUrls() {
        return rpcUrls;
    }

    public double getDefaultSlippage() {
        return defaultSlippage;
    }

    public long getTimeoutMs() {
        return timeoutMs;
    }
}
