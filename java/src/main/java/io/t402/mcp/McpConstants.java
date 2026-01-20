package io.t402.mcp;

import io.t402.mcp.McpTypes.ServerConfig;
import io.t402.mcp.McpTypes.SupportedNetwork;
import io.t402.mcp.McpTypes.SupportedSvmNetwork;
import io.t402.mcp.McpTypes.SupportedToken;
import io.t402.mcp.McpTypes.SupportedTonNetwork;
import io.t402.mcp.McpTypes.SupportedTronNetwork;

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

    // =========================================================================
    // SVM (Solana) Network Constants
    // =========================================================================

    /** Native token symbol for Solana. */
    public static final String SOL_SYMBOL = "SOL";

    /** Standard decimal count for SOL native token. */
    public static final int SOL_DECIMALS = 9;

    // SVM Explorer URLs
    public static final Map<SupportedSvmNetwork, String> SVM_EXPLORER_URLS = new EnumMap<>(SupportedSvmNetwork.class);
    static {
        SVM_EXPLORER_URLS.put(SupportedSvmNetwork.SOLANA_MAINNET, "https://explorer.solana.com");
        SVM_EXPLORER_URLS.put(SupportedSvmNetwork.SOLANA_DEVNET, "https://explorer.solana.com?cluster=devnet");
        SVM_EXPLORER_URLS.put(SupportedSvmNetwork.SOLANA_TESTNET, "https://explorer.solana.com?cluster=testnet");
    }

    // SVM RPC URLs
    public static final Map<SupportedSvmNetwork, String> SVM_RPC_URLS = new EnumMap<>(SupportedSvmNetwork.class);
    static {
        SVM_RPC_URLS.put(SupportedSvmNetwork.SOLANA_MAINNET, "https://api.mainnet-beta.solana.com");
        SVM_RPC_URLS.put(SupportedSvmNetwork.SOLANA_DEVNET, "https://api.devnet.solana.com");
        SVM_RPC_URLS.put(SupportedSvmNetwork.SOLANA_TESTNET, "https://api.testnet.solana.com");
    }

    // SVM USDC addresses
    public static final Map<SupportedSvmNetwork, String> SVM_USDC_ADDRESSES = new EnumMap<>(SupportedSvmNetwork.class);
    static {
        SVM_USDC_ADDRESSES.put(SupportedSvmNetwork.SOLANA_MAINNET, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        SVM_USDC_ADDRESSES.put(SupportedSvmNetwork.SOLANA_DEVNET, "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
        SVM_USDC_ADDRESSES.put(SupportedSvmNetwork.SOLANA_TESTNET, "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    }

    /** Base58 address pattern for Solana addresses. */
    public static final String SOLANA_ADDRESS_PATTERN = "^[1-9A-HJ-NP-Za-km-z]{32,44}$";

    // =========================================================================
    // TON Network Constants
    // =========================================================================

    /** Native token symbol for TON. */
    public static final String TON_SYMBOL = "TON";

    /** Standard decimal count for TON native token. */
    public static final int TON_DECIMALS = 9;

    /** Standard decimal count for USDT on TON. */
    public static final int TON_USDT_DECIMALS = 6;

    // TON Explorer URLs
    public static final Map<SupportedTonNetwork, String> TON_EXPLORER_URLS = new EnumMap<>(SupportedTonNetwork.class);
    static {
        TON_EXPLORER_URLS.put(SupportedTonNetwork.TON_MAINNET, "https://tonviewer.com");
        TON_EXPLORER_URLS.put(SupportedTonNetwork.TON_TESTNET, "https://testnet.tonviewer.com");
    }

    // TON RPC URLs
    public static final Map<SupportedTonNetwork, String> TON_RPC_URLS = new EnumMap<>(SupportedTonNetwork.class);
    static {
        TON_RPC_URLS.put(SupportedTonNetwork.TON_MAINNET, "https://toncenter.com/api/v2");
        TON_RPC_URLS.put(SupportedTonNetwork.TON_TESTNET, "https://testnet.toncenter.com/api/v2");
    }

    // TON USDT addresses (jetton master)
    public static final Map<SupportedTonNetwork, String> TON_USDT_ADDRESSES = new EnumMap<>(SupportedTonNetwork.class);
    static {
        TON_USDT_ADDRESSES.put(SupportedTonNetwork.TON_MAINNET, "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs");
        TON_USDT_ADDRESSES.put(SupportedTonNetwork.TON_TESTNET, "EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA");
    }

    /** TON address pattern (raw or user-friendly format). */
    public static final String TON_ADDRESS_PATTERN = "^(EQ|UQ|0:|kQ|kf:|-1:)[A-Za-z0-9_-]{46,48}$";

    // =========================================================================
    // TRON Network Constants
    // =========================================================================

    /** Native token symbol for TRON. */
    public static final String TRX_SYMBOL = "TRX";

    /** Standard decimal count for TRX native token. */
    public static final int TRX_DECIMALS = 6;

    /** Standard decimal count for USDT on TRON. */
    public static final int TRON_USDT_DECIMALS = 6;

    // TRON Explorer URLs
    public static final Map<SupportedTronNetwork, String> TRON_EXPLORER_URLS = new EnumMap<>(SupportedTronNetwork.class);
    static {
        TRON_EXPLORER_URLS.put(SupportedTronNetwork.TRON_MAINNET, "https://tronscan.org");
        TRON_EXPLORER_URLS.put(SupportedTronNetwork.TRON_NILE, "https://nile.tronscan.org");
        TRON_EXPLORER_URLS.put(SupportedTronNetwork.TRON_SHASTA, "https://shasta.tronscan.org");
    }

    // TRON RPC URLs
    public static final Map<SupportedTronNetwork, String> TRON_RPC_URLS = new EnumMap<>(SupportedTronNetwork.class);
    static {
        TRON_RPC_URLS.put(SupportedTronNetwork.TRON_MAINNET, "https://api.trongrid.io");
        TRON_RPC_URLS.put(SupportedTronNetwork.TRON_NILE, "https://nile.trongrid.io");
        TRON_RPC_URLS.put(SupportedTronNetwork.TRON_SHASTA, "https://api.shasta.trongrid.io");
    }

    // TRON USDT addresses (TRC-20)
    public static final Map<SupportedTronNetwork, String> TRON_USDT_ADDRESSES = new EnumMap<>(SupportedTronNetwork.class);
    static {
        TRON_USDT_ADDRESSES.put(SupportedTronNetwork.TRON_MAINNET, "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
        TRON_USDT_ADDRESSES.put(SupportedTronNetwork.TRON_NILE, "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf");
        TRON_USDT_ADDRESSES.put(SupportedTronNetwork.TRON_SHASTA, "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs");
    }

    /** TRON address pattern (Base58Check format starting with T). */
    public static final String TRON_ADDRESS_PATTERN = "^T[1-9A-HJ-NP-Za-km-z]{33}$";

    /**
     * Returns all supported EVM networks.
     */
    public static List<SupportedNetwork> getAllNetworks() {
        return Arrays.asList(SupportedNetwork.values());
    }

    /**
     * Returns all supported SVM (Solana) networks.
     */
    public static List<SupportedSvmNetwork> getAllSvmNetworks() {
        return Arrays.asList(SupportedSvmNetwork.values());
    }

    /**
     * Checks if an EVM network string is valid.
     */
    public static boolean isValidNetwork(String network) {
        return SupportedNetwork.fromString(network) != null;
    }

    /**
     * Checks if a SVM network string is valid.
     */
    public static boolean isValidSvmNetwork(String network) {
        return SupportedSvmNetwork.fromString(network) != null;
    }

    /**
     * Returns all supported TON networks.
     */
    public static List<SupportedTonNetwork> getAllTonNetworks() {
        return Arrays.asList(SupportedTonNetwork.values());
    }

    /**
     * Checks if a TON network string is valid.
     */
    public static boolean isValidTonNetwork(String network) {
        return SupportedTonNetwork.fromString(network) != null;
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

    // =========================================================================
    // SVM Utility Methods
    // =========================================================================

    /**
     * Returns the explorer URL for a Solana transaction.
     */
    public static String getSvmExplorerTxUrl(SupportedSvmNetwork network, String txHash) {
        String baseUrl = SVM_EXPLORER_URLS.get(network);
        if (baseUrl == null) {
            return "";
        }
        if (baseUrl.contains("?")) {
            return baseUrl + "&tx=" + txHash;
        }
        return baseUrl + "/tx/" + txHash;
    }

    /**
     * Returns the RPC URL for a Solana network, using config override if available.
     */
    public static String getSvmRpcUrl(ServerConfig config, SupportedSvmNetwork network) {
        if (config != null && config.getRpcUrls() != null) {
            String url = config.getRpcUrls().get(network.getValue());
            if (url != null && !url.isEmpty()) {
                return url;
            }
        }
        return SVM_RPC_URLS.get(network);
    }

    /**
     * Returns the USDC token address for a Solana network.
     */
    public static String getSvmUsdcAddress(SupportedSvmNetwork network) {
        return SVM_USDC_ADDRESSES.get(network);
    }

    /**
     * Validates a Solana address format.
     */
    public static boolean isValidSolanaAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return address.matches(SOLANA_ADDRESS_PATTERN);
    }

    // =========================================================================
    // TON Utility Methods
    // =========================================================================

    /**
     * Returns the explorer URL for a TON transaction.
     */
    public static String getTonExplorerTxUrl(SupportedTonNetwork network, String txHash) {
        String baseUrl = TON_EXPLORER_URLS.get(network);
        if (baseUrl == null) {
            return "";
        }
        return baseUrl + "/transaction/" + txHash;
    }

    /**
     * Returns the RPC URL for a TON network, using config override if available.
     */
    public static String getTonRpcUrl(ServerConfig config, SupportedTonNetwork network) {
        if (config != null && config.getRpcUrls() != null) {
            String url = config.getRpcUrls().get(network.getValue());
            if (url != null && !url.isEmpty()) {
                return url;
            }
        }
        return TON_RPC_URLS.get(network);
    }

    /**
     * Returns the USDT jetton address for a TON network.
     */
    public static String getTonUsdtAddress(SupportedTonNetwork network) {
        return TON_USDT_ADDRESSES.get(network);
    }

    /**
     * Validates a TON address format.
     */
    public static boolean isValidTonAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return address.matches(TON_ADDRESS_PATTERN);
    }

    // =========================================================================
    // TRON Utility Methods
    // =========================================================================

    /**
     * Returns all supported TRON networks.
     */
    public static List<SupportedTronNetwork> getAllTronNetworks() {
        return Arrays.asList(SupportedTronNetwork.values());
    }

    /**
     * Checks if a TRON network string is valid.
     */
    public static boolean isValidTronNetwork(String network) {
        return SupportedTronNetwork.fromString(network) != null;
    }

    /**
     * Returns the explorer URL for a TRON transaction.
     */
    public static String getTronExplorerTxUrl(SupportedTronNetwork network, String txHash) {
        String baseUrl = TRON_EXPLORER_URLS.get(network);
        if (baseUrl == null) {
            return "";
        }
        return baseUrl + "/#/transaction/" + txHash;
    }

    /**
     * Returns the RPC URL for a TRON network, using config override if available.
     */
    public static String getTronRpcUrl(ServerConfig config, SupportedTronNetwork network) {
        if (config != null && config.getRpcUrls() != null) {
            String url = config.getRpcUrls().get(network.getValue());
            if (url != null && !url.isEmpty()) {
                return url;
            }
        }
        return TRON_RPC_URLS.get(network);
    }

    /**
     * Returns the USDT TRC-20 address for a TRON network.
     */
    public static String getTronUsdtAddress(SupportedTronNetwork network) {
        return TRON_USDT_ADDRESSES.get(network);
    }

    /**
     * Validates a TRON address format.
     */
    public static boolean isValidTronAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return address.matches(TRON_ADDRESS_PATTERN);
    }
}
