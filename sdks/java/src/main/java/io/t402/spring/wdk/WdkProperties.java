package io.t402.spring.wdk;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Configuration properties for T402 WDK integration.
 *
 * <pre>{@code
 * t402:
 *   wdk:
 *     enabled: true
 *     gasless:
 *       bundler-url: https://api.pimlico.io/v2/arbitrum/rpc?apikey=...
 *       paymaster-url: https://api.pimlico.io/v2/arbitrum/rpc?apikey=...
 *       chain-id: 42161
 *     bridge:
 *       enabled: true
 *       rpc-urls:
 *         arbitrum: https://arb1.arbitrum.io/rpc
 *         ethereum: https://eth.llamarpc.com
 *     multisig:
 *       safe-address: "0x..."
 *       threshold: 2
 *       owners:
 *         - "0xOwner1..."
 *         - "0xOwner2..."
 * }</pre>
 */
@ConfigurationProperties(prefix = "t402.wdk")
public class WdkProperties {

    private boolean enabled = false;

    private final Gasless gasless = new Gasless();
    private final Bridge bridge = new Bridge();
    private final Multisig multisig = new Multisig();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Gasless getGasless() {
        return gasless;
    }

    public Bridge getBridge() {
        return bridge;
    }

    public Multisig getMultisig() {
        return multisig;
    }

    /**
     * Gasless payment configuration.
     */
    public static class Gasless {
        private String bundlerUrl;
        private String paymasterUrl;
        private int chainId = 42161;
        private long timeoutMs = 30000;

        public String getBundlerUrl() {
            return bundlerUrl;
        }

        public void setBundlerUrl(String bundlerUrl) {
            this.bundlerUrl = bundlerUrl;
        }

        public String getPaymasterUrl() {
            return paymasterUrl;
        }

        public void setPaymasterUrl(String paymasterUrl) {
            this.paymasterUrl = paymasterUrl;
        }

        public int getChainId() {
            return chainId;
        }

        public void setChainId(int chainId) {
            this.chainId = chainId;
        }

        public long getTimeoutMs() {
            return timeoutMs;
        }

        public void setTimeoutMs(long timeoutMs) {
            this.timeoutMs = timeoutMs;
        }
    }

    /**
     * Bridge configuration.
     */
    public static class Bridge {
        private boolean enabled = false;
        private Map<String, String> rpcUrls = new HashMap<>();
        private double defaultSlippage = 0.5;

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public Map<String, String> getRpcUrls() {
            return rpcUrls;
        }

        public void setRpcUrls(Map<String, String> rpcUrls) {
            this.rpcUrls = rpcUrls;
        }

        public double getDefaultSlippage() {
            return defaultSlippage;
        }

        public void setDefaultSlippage(double defaultSlippage) {
            this.defaultSlippage = defaultSlippage;
        }
    }

    /**
     * Multisig configuration.
     */
    public static class Multisig {
        private String safeAddress;
        private int threshold = 1;
        private List<String> owners;
        private int chainId = 42161;

        public String getSafeAddress() {
            return safeAddress;
        }

        public void setSafeAddress(String safeAddress) {
            this.safeAddress = safeAddress;
        }

        public int getThreshold() {
            return threshold;
        }

        public void setThreshold(int threshold) {
            this.threshold = threshold;
        }

        public List<String> getOwners() {
            return owners;
        }

        public void setOwners(List<String> owners) {
            this.owners = owners;
        }

        public int getChainId() {
            return chainId;
        }

        public void setChainId(int chainId) {
            this.chainId = chainId;
        }
    }
}
