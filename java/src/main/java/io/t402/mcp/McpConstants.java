package io.t402.mcp;

import io.t402.mcp.McpTypes.ServerConfig;
import io.t402.mcp.McpTypes.SupportedNetwork;
import io.t402.mcp.McpTypes.SupportedToken;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Constants for MCP server including chain IDs, token addresses, and RPC URLs.
 */
public final class McpConstants {

    private McpConstants() {}

    /** Standard decimal count for stablecoins. */
    public static final int TOKEN_DECIMALS = 6;

    /** Standard decimal count for native tokens. */
    public static final int NATIVE_DECIMALS = 18;

    /** LayerZero Scan URL for tracking bridge messages. */
    public static final String LAYERZERO_SCAN_URL = "https://layerzeroscan.com/tx/";

    // Chain IDs for supported networks
    public static final Map<SupportedNetwork, Long> CHAIN_IDS = new EnumMap<>(SupportedNetwork.class);
    static {
        CHAIN_IDS.put(SupportedNetwork.ETHEREUM, 1L);
        CHAIN_IDS.put(SupportedNetwork.BASE, 8453L);
        CHAIN_IDS.put(SupportedNetwork.ARBITRUM, 42161L);
        CHAIN_IDS.put(SupportedNetwork.OPTIMISM, 10L);
        CHAIN_IDS.put(SupportedNetwork.POLYGON, 137L);
        CHAIN_IDS.put(SupportedNetwork.AVALANCHE, 43114L);
        CHAIN_IDS.put(SupportedNetwork.INK, 57073L);
        CHAIN_IDS.put(SupportedNetwork.BERACHAIN, 80094L);
        CHAIN_IDS.put(SupportedNetwork.UNICHAIN, 130L);
    }

    // Native token symbols for each network
    public static final Map<SupportedNetwork, String> NATIVE_SYMBOLS = new EnumMap<>(SupportedNetwork.class);
    static {
        NATIVE_SYMBOLS.put(SupportedNetwork.ETHEREUM, "ETH");
        NATIVE_SYMBOLS.put(SupportedNetwork.BASE, "ETH");
        NATIVE_SYMBOLS.put(SupportedNetwork.ARBITRUM, "ETH");
        NATIVE_SYMBOLS.put(SupportedNetwork.OPTIMISM, "ETH");
        NATIVE_SYMBOLS.put(SupportedNetwork.POLYGON, "MATIC");
        NATIVE_SYMBOLS.put(SupportedNetwork.AVALANCHE, "AVAX");
        NATIVE_SYMBOLS.put(SupportedNetwork.INK, "ETH");
        NATIVE_SYMBOLS.put(SupportedNetwork.BERACHAIN, "BERA");
        NATIVE_SYMBOLS.put(SupportedNetwork.UNICHAIN, "ETH");
    }

    // Block explorer URLs for each network
    public static final Map<SupportedNetwork, String> EXPLORER_URLS = new EnumMap<>(SupportedNetwork.class);
    static {
        EXPLORER_URLS.put(SupportedNetwork.ETHEREUM, "https://etherscan.io");
        EXPLORER_URLS.put(SupportedNetwork.BASE, "https://basescan.org");
        EXPLORER_URLS.put(SupportedNetwork.ARBITRUM, "https://arbiscan.io");
        EXPLORER_URLS.put(SupportedNetwork.OPTIMISM, "https://optimistic.etherscan.io");
        EXPLORER_URLS.put(SupportedNetwork.POLYGON, "https://polygonscan.com");
        EXPLORER_URLS.put(SupportedNetwork.AVALANCHE, "https://snowtrace.io");
        EXPLORER_URLS.put(SupportedNetwork.INK, "https://explorer.ink.xyz");
        EXPLORER_URLS.put(SupportedNetwork.BERACHAIN, "https://berascan.com");
        EXPLORER_URLS.put(SupportedNetwork.UNICHAIN, "https://uniscan.xyz");
    }

    // Default RPC URLs for each network
    public static final Map<SupportedNetwork, String> DEFAULT_RPC_URLS = new EnumMap<>(SupportedNetwork.class);
    static {
        DEFAULT_RPC_URLS.put(SupportedNetwork.ETHEREUM, "https://eth.llamarpc.com");
        DEFAULT_RPC_URLS.put(SupportedNetwork.BASE, "https://mainnet.base.org");
        DEFAULT_RPC_URLS.put(SupportedNetwork.ARBITRUM, "https://arb1.arbitrum.io/rpc");
        DEFAULT_RPC_URLS.put(SupportedNetwork.OPTIMISM, "https://mainnet.optimism.io");
        DEFAULT_RPC_URLS.put(SupportedNetwork.POLYGON, "https://polygon-rpc.com");
        DEFAULT_RPC_URLS.put(SupportedNetwork.AVALANCHE, "https://api.avax.network/ext/bc/C/rpc");
        DEFAULT_RPC_URLS.put(SupportedNetwork.INK, "https://rpc-qnd.ink.xyz");
        DEFAULT_RPC_URLS.put(SupportedNetwork.BERACHAIN, "https://artio.rpc.berachain.com");
        DEFAULT_RPC_URLS.put(SupportedNetwork.UNICHAIN, "https://mainnet.unichain.org");
    }

    // USDC contract addresses by network
    public static final Map<SupportedNetwork, String> USDC_ADDRESSES = new EnumMap<>(SupportedNetwork.class);
    static {
        USDC_ADDRESSES.put(SupportedNetwork.ETHEREUM, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
        USDC_ADDRESSES.put(SupportedNetwork.BASE, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
        USDC_ADDRESSES.put(SupportedNetwork.ARBITRUM, "0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
        USDC_ADDRESSES.put(SupportedNetwork.OPTIMISM, "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85");
        USDC_ADDRESSES.put(SupportedNetwork.POLYGON, "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359");
        USDC_ADDRESSES.put(SupportedNetwork.AVALANCHE, "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E");
        USDC_ADDRESSES.put(SupportedNetwork.INK, "0x0200C29006150606B650577BBE7B6248F58470c1");
        USDC_ADDRESSES.put(SupportedNetwork.BERACHAIN, "0x779Ded0c9e1022225f8E0630b35a9b54bE713736");
        USDC_ADDRESSES.put(SupportedNetwork.UNICHAIN, "0x588ce4F028D8e7B53B687865d6A67b3A54C75518");
    }

    // USDT contract addresses by network
    public static final Map<SupportedNetwork, String> USDT_ADDRESSES = new EnumMap<>(SupportedNetwork.class);
    static {
        USDT_ADDRESSES.put(SupportedNetwork.ETHEREUM, "0xdAC17F958D2ee523a2206206994597C13D831ec7");
        USDT_ADDRESSES.put(SupportedNetwork.ARBITRUM, "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
        USDT_ADDRESSES.put(SupportedNetwork.OPTIMISM, "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58");
        USDT_ADDRESSES.put(SupportedNetwork.POLYGON, "0xc2132D05D31c914a87C6611C10748AEb04B58e8F");
        USDT_ADDRESSES.put(SupportedNetwork.AVALANCHE, "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7");
    }

    // USDT0 OFT contract addresses (LayerZero bridgeable)
    public static final Map<SupportedNetwork, String> USDT0_ADDRESSES = new EnumMap<>(SupportedNetwork.class);
    static {
        USDT0_ADDRESSES.put(SupportedNetwork.ETHEREUM, "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee");
        USDT0_ADDRESSES.put(SupportedNetwork.ARBITRUM, "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9");
        USDT0_ADDRESSES.put(SupportedNetwork.INK, "0x0200C29006150606B650577BBE7B6248F58470c1");
        USDT0_ADDRESSES.put(SupportedNetwork.BERACHAIN, "0x779Ded0c9e1022225f8E0630b35a9b54bE713736");
        USDT0_ADDRESSES.put(SupportedNetwork.UNICHAIN, "0x588ce4F028D8e7B53B687865d6A67b3A54C75518");
    }

    // Networks that support USDT0 bridging via LayerZero
    public static final Set<SupportedNetwork> BRIDGEABLE_CHAINS = new HashSet<>(Arrays.asList(
        SupportedNetwork.ETHEREUM,
        SupportedNetwork.ARBITRUM,
        SupportedNetwork.INK,
        SupportedNetwork.BERACHAIN,
        SupportedNetwork.UNICHAIN
    ));

    // Networks that support ERC-4337 gasless payments
    public static final Set<SupportedNetwork> GASLESS_NETWORKS = new HashSet<>(Arrays.asList(
        SupportedNetwork.ETHEREUM,
        SupportedNetwork.BASE,
        SupportedNetwork.ARBITRUM,
        SupportedNetwork.OPTIMISM,
        SupportedNetwork.POLYGON,
        SupportedNetwork.AVALANCHE
    ));

    // LayerZero endpoint IDs for bridging
    public static final Map<SupportedNetwork, Integer> LAYERZERO_ENDPOINT_IDS = new EnumMap<>(SupportedNetwork.class);
    static {
        LAYERZERO_ENDPOINT_IDS.put(SupportedNetwork.ETHEREUM, 30101);
        LAYERZERO_ENDPOINT_IDS.put(SupportedNetwork.ARBITRUM, 30110);
        LAYERZERO_ENDPOINT_IDS.put(SupportedNetwork.INK, 30291);
        LAYERZERO_ENDPOINT_IDS.put(SupportedNetwork.BERACHAIN, 30362);
        LAYERZERO_ENDPOINT_IDS.put(SupportedNetwork.UNICHAIN, 30320);
    }

    /**
     * Returns all supported networks.
     */
    public static List<SupportedNetwork> getAllNetworks() {
        return Arrays.asList(SupportedNetwork.values());
    }

    /**
     * Checks if a network string is valid.
     */
    public static boolean isValidNetwork(String network) {
        return SupportedNetwork.fromString(network) != null;
    }

    /**
     * Checks if a network supports USDT0 bridging.
     */
    public static boolean isBridgeableChain(String network) {
        SupportedNetwork net = SupportedNetwork.fromString(network);
        return net != null && BRIDGEABLE_CHAINS.contains(net);
    }

    /**
     * Checks if a network supports ERC-4337 gasless payments.
     */
    public static boolean isGaslessNetwork(String network) {
        SupportedNetwork net = SupportedNetwork.fromString(network);
        return net != null && GASLESS_NETWORKS.contains(net);
    }

    /**
     * Returns the token contract address for a network.
     */
    public static String getTokenAddress(SupportedNetwork network, SupportedToken token) {
        switch (token) {
            case USDC:
                return USDC_ADDRESSES.get(network);
            case USDT:
                return USDT_ADDRESSES.get(network);
            case USDT0:
                return USDT0_ADDRESSES.get(network);
            default:
                return null;
        }
    }

    /**
     * Returns the explorer URL for a transaction.
     */
    public static String getExplorerTxUrl(SupportedNetwork network, String txHash) {
        String baseUrl = EXPLORER_URLS.get(network);
        if (baseUrl == null) {
            return "";
        }
        return baseUrl + "/tx/" + txHash;
    }

    /**
     * Returns the RPC URL for a network, using config override if available.
     */
    public static String getRpcUrl(ServerConfig config, SupportedNetwork network) {
        if (config != null && config.getRpcUrls() != null) {
            String url = config.getRpcUrls().get(network.getValue());
            if (url != null && !url.isEmpty()) {
                return url;
            }
        }
        return DEFAULT_RPC_URLS.get(network);
    }

    /**
     * Formats a raw token amount with decimals to human-readable string.
     */
    public static String formatTokenAmount(BigInteger amount, int decimals) {
        if (amount == null || amount.compareTo(BigInteger.ZERO) == 0) {
            return "0";
        }

        BigDecimal divisor = BigDecimal.TEN.pow(decimals);
        BigDecimal result = new BigDecimal(amount).divide(divisor, decimals, RoundingMode.DOWN);

        // Remove trailing zeros
        String str = result.stripTrailingZeros().toPlainString();
        return str;
    }

    /**
     * Parses a human-readable amount string to raw token units.
     */
    public static BigInteger parseTokenAmount(String amount, int decimals) {
        if (amount == null || amount.isEmpty()) {
            throw new IllegalArgumentException("Amount cannot be null or empty");
        }

        try {
            BigDecimal decimal = new BigDecimal(amount);
            BigDecimal multiplier = BigDecimal.TEN.pow(decimals);
            return decimal.multiply(multiplier).toBigInteger();
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid amount: " + amount, e);
        }
    }

    /**
     * Truncates a hash for display.
     */
    public static String truncateHash(String hash) {
        if (hash == null || hash.length() <= 16) {
            return hash;
        }
        return hash.substring(0, 8) + "..." + hash.substring(hash.length() - 6);
    }
}
