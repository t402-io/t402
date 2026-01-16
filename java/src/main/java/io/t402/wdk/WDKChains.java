package io.t402.wdk;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Chain configuration for T402 WDK.
 */
public final class WDKChains {

    private WDKChains() {
        // Utility class
    }

    // Chain IDs
    private static final Map<String, Long> CHAIN_IDS = new HashMap<>();

    static {
        CHAIN_IDS.put("ethereum", 1L);
        CHAIN_IDS.put("arbitrum", 42161L);
        CHAIN_IDS.put("optimism", 10L);
        CHAIN_IDS.put("polygon", 137L);
        CHAIN_IDS.put("bsc", 56L);
        CHAIN_IDS.put("avalanche", 43114L);
        CHAIN_IDS.put("base", 8453L);
        CHAIN_IDS.put("ink", 57073L);
        CHAIN_IDS.put("celo", 42220L);
        CHAIN_IDS.put("mantle", 5000L);
        // Testnets
        CHAIN_IDS.put("sepolia", 11155111L);
        CHAIN_IDS.put("arbitrum-sepolia", 421614L);
        CHAIN_IDS.put("base-sepolia", 84532L);
    }

    // USDT0 OFT addresses
    private static final Map<String, String> USDT0_ADDRESSES = new HashMap<>();

    static {
        USDT0_ADDRESSES.put("ethereum", "0x566b40bd3a5063628f2200dc2e49a709a0e4a8e6");
        USDT0_ADDRESSES.put("arbitrum", "0x3b0F096bd4CC59ce3dbD31bF4A0a28C81b5F5E60");
        USDT0_ADDRESSES.put("optimism", "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58");
        USDT0_ADDRESSES.put("polygon", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F");
        USDT0_ADDRESSES.put("bsc", "0x55d398326f99059fF775485246999027B3197955");
        USDT0_ADDRESSES.put("avalanche", "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7");
        USDT0_ADDRESSES.put("base", "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2");
        USDT0_ADDRESSES.put("ink", "0xbf8E2c5a71B1324C0bEDBaD35C8ED0BE0D22e4a0");
        USDT0_ADDRESSES.put("celo", "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e");
        USDT0_ADDRESSES.put("mantle", "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE");
    }

    // USDC addresses
    private static final Map<String, String> USDC_ADDRESSES = new HashMap<>();

    static {
        USDC_ADDRESSES.put("ethereum", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
        USDC_ADDRESSES.put("arbitrum", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
        USDC_ADDRESSES.put("optimism", "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85");
        USDC_ADDRESSES.put("polygon", "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
        USDC_ADDRESSES.put("bsc", "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d");
        USDC_ADDRESSES.put("avalanche", "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E");
        USDC_ADDRESSES.put("base", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    }

    // Chain to CAIP-2 network mapping
    private static final Map<String, String> CHAIN_TO_NETWORK = new HashMap<>();

    static {
        CHAIN_TO_NETWORK.put("ethereum", "eip155:1");
        CHAIN_TO_NETWORK.put("arbitrum", "eip155:42161");
        CHAIN_TO_NETWORK.put("optimism", "eip155:10");
        CHAIN_TO_NETWORK.put("polygon", "eip155:137");
        CHAIN_TO_NETWORK.put("bsc", "eip155:56");
        CHAIN_TO_NETWORK.put("avalanche", "eip155:43114");
        CHAIN_TO_NETWORK.put("base", "eip155:8453");
        CHAIN_TO_NETWORK.put("ink", "eip155:57073");
        CHAIN_TO_NETWORK.put("celo", "eip155:42220");
        CHAIN_TO_NETWORK.put("mantle", "eip155:5000");
    }

    // Network to chain mapping (reverse)
    private static final Map<String, String> NETWORK_TO_CHAIN = new HashMap<>();

    static {
        for (Map.Entry<String, String> entry : CHAIN_TO_NETWORK.entrySet()) {
            NETWORK_TO_CHAIN.put(entry.getValue().toLowerCase(), entry.getKey());
        }
    }

    /**
     * Get chain ID for a chain name.
     *
     * @param chain Chain name
     * @return Chain ID or null if unknown
     */
    public static Long getChainId(String chain) {
        return CHAIN_IDS.get(chain.toLowerCase());
    }

    /**
     * Get CAIP-2 network identifier for a chain.
     *
     * @param chain Chain name
     * @return Network identifier (e.g., "eip155:1")
     */
    public static String getNetworkFromChain(String chain) {
        return CHAIN_TO_NETWORK.get(chain.toLowerCase());
    }

    /**
     * Get chain name from network identifier.
     *
     * @param network Network identifier
     * @return Chain name or null
     */
    public static String getChainFromNetwork(String network) {
        return NETWORK_TO_CHAIN.get(network.toLowerCase());
    }

    /**
     * Get USDT0 token address for a chain.
     *
     * @param chain Chain name
     * @return USDT0 address or null
     */
    public static String getUsdt0Address(String chain) {
        return USDT0_ADDRESSES.get(chain.toLowerCase());
    }

    /**
     * Get USDC token address for a chain.
     *
     * @param chain Chain name
     * @return USDC address or null
     */
    public static String getUsdcAddress(String chain) {
        return USDC_ADDRESSES.get(chain.toLowerCase());
    }

    /**
     * Get all chains with USDT0 support.
     *
     * @return Set of chain names
     */
    public static Set<String> getUsdt0Chains() {
        return USDT0_ADDRESSES.keySet();
    }

    /**
     * Get all supported chain names.
     *
     * @return Set of chain names
     */
    public static Set<String> getSupportedChains() {
        return CHAIN_IDS.keySet();
    }

    /**
     * Check if a chain is a testnet.
     *
     * @param chain Chain name
     * @return true if testnet
     */
    public static boolean isTestnet(String chain) {
        String lowerChain = chain.toLowerCase();
        return lowerChain.contains("sepolia") ||
               lowerChain.contains("goerli") ||
               lowerChain.contains("testnet");
    }

    /**
     * Get token address by symbol.
     *
     * @param chain Chain name
     * @param symbol Token symbol (USDT0, USDC)
     * @return Token address or null
     */
    public static String getTokenAddress(String chain, String symbol) {
        switch (symbol.toUpperCase()) {
            case "USDT0":
            case "USDT":
                return getUsdt0Address(chain);
            case "USDC":
                return getUsdcAddress(chain);
            default:
                return null;
        }
    }
}
