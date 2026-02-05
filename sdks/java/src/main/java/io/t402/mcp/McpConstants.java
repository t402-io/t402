package io.t402.mcp;

import io.t402.mcp.McpTypes.ServerConfig;
import io.t402.mcp.McpTypes.SupportedNetwork;
import io.t402.mcp.McpTypes.SupportedSvmNetwork;
import io.t402.mcp.McpTypes.SupportedToken;
import io.t402.mcp.McpTypes.SupportedTonNetwork;
import io.t402.mcp.McpTypes.SupportedTronNetwork;
import io.t402.mcp.McpTypes.SupportedNearNetwork;
import io.t402.mcp.McpTypes.SupportedAptosNetwork;
import io.t402.mcp.McpTypes.SupportedTezosNetwork;

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
        DEFAULT_RPC_URLS.put(SupportedNetwork.INK, "https://rpc-gel.inkonchain.com");
        DEFAULT_RPC_URLS.put(SupportedNetwork.BERACHAIN, "https://rpc.berachain.com");
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
        USDT0_ADDRESSES.put(SupportedNetwork.UNICHAIN, "0x9151434b16b9763660705744891fA906F660EcC5");
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

    // =========================================================================
    // NEAR Network Constants
    // =========================================================================

    /** Native token symbol for NEAR. */
    public static final String NEAR_SYMBOL = "NEAR";

    /** Standard decimal count for NEAR native token. */
    public static final int NEAR_DECIMALS = 24;

    /** Standard decimal count for USDT on NEAR. */
    public static final int NEAR_USDT_DECIMALS = 6;

    // NEAR Explorer URLs
    public static final Map<SupportedNearNetwork, String> NEAR_EXPLORER_URLS = new EnumMap<>(SupportedNearNetwork.class);
    static {
        NEAR_EXPLORER_URLS.put(SupportedNearNetwork.NEAR_MAINNET, "https://nearblocks.io");
        NEAR_EXPLORER_URLS.put(SupportedNearNetwork.NEAR_TESTNET, "https://testnet.nearblocks.io");
    }

    // NEAR RPC URLs
    public static final Map<SupportedNearNetwork, String> NEAR_RPC_URLS = new EnumMap<>(SupportedNearNetwork.class);
    static {
        NEAR_RPC_URLS.put(SupportedNearNetwork.NEAR_MAINNET, "https://rpc.mainnet.near.org");
        NEAR_RPC_URLS.put(SupportedNearNetwork.NEAR_TESTNET, "https://rpc.testnet.near.org");
    }

    // NEAR USDT addresses (NEP-141)
    public static final Map<SupportedNearNetwork, String> NEAR_USDT_ADDRESSES = new EnumMap<>(SupportedNearNetwork.class);
    static {
        NEAR_USDT_ADDRESSES.put(SupportedNearNetwork.NEAR_MAINNET, "usdt.tether-token.near");
        NEAR_USDT_ADDRESSES.put(SupportedNearNetwork.NEAR_TESTNET, "usdt.fakes.testnet");
    }

    /** NEAR address pattern (implicit 64 hex or named account). */
    public static final String NEAR_ADDRESS_PATTERN = "^([a-z\\d]+[-_])*[a-z\\d]+(\\.([a-z\\d]+[-_])*[a-z\\d]+)*$|^[0-9a-f]{64}$";

    // =========================================================================
    // NEAR Utility Methods
    // =========================================================================

    /**
     * Returns all supported NEAR networks.
     */
    public static List<SupportedNearNetwork> getAllNearNetworks() {
        return Arrays.asList(SupportedNearNetwork.values());
    }

    /**
     * Checks if a NEAR network string is valid.
     */
    public static boolean isValidNearNetwork(String network) {
        return SupportedNearNetwork.fromString(network) != null;
    }

    /**
     * Returns the explorer URL for a NEAR transaction.
     */
    public static String getNearExplorerTxUrl(SupportedNearNetwork network, String txHash) {
        String baseUrl = NEAR_EXPLORER_URLS.get(network);
        if (baseUrl == null) {
            return "";
        }
        return baseUrl + "/txns/" + txHash;
    }

    /**
     * Returns the RPC URL for a NEAR network, using config override if available.
     */
    public static String getNearRpcUrl(ServerConfig config, SupportedNearNetwork network) {
        if (config != null && config.getRpcUrls() != null) {
            String url = config.getRpcUrls().get(network.getValue());
            if (url != null && !url.isEmpty()) {
                return url;
            }
        }
        return NEAR_RPC_URLS.get(network);
    }

    /**
     * Returns the USDT NEP-141 address for a NEAR network.
     */
    public static String getNearUsdtAddress(SupportedNearNetwork network) {
        return NEAR_USDT_ADDRESSES.get(network);
    }

    /**
     * Validates a NEAR address format (implicit or named account).
     */
    public static boolean isValidNearAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return address.matches(NEAR_ADDRESS_PATTERN);
    }

    // =========================================================================
    // Aptos Network Constants
    // =========================================================================

    /** Native token symbol for Aptos. */
    public static final String APT_SYMBOL = "APT";

    /** Standard decimal count for APT native token. */
    public static final int APT_DECIMALS = 8;

    /** Standard decimal count for USDT on Aptos. */
    public static final int APTOS_USDT_DECIMALS = 6;

    // Aptos Explorer URLs
    public static final Map<SupportedAptosNetwork, String> APTOS_EXPLORER_URLS = new EnumMap<>(SupportedAptosNetwork.class);
    static {
        APTOS_EXPLORER_URLS.put(SupportedAptosNetwork.APTOS_MAINNET, "https://explorer.aptoslabs.com");
        APTOS_EXPLORER_URLS.put(SupportedAptosNetwork.APTOS_TESTNET, "https://explorer.aptoslabs.com");
        APTOS_EXPLORER_URLS.put(SupportedAptosNetwork.APTOS_DEVNET, "https://explorer.aptoslabs.com");
    }

    // Aptos RPC URLs
    public static final Map<SupportedAptosNetwork, String> APTOS_RPC_URLS = new EnumMap<>(SupportedAptosNetwork.class);
    static {
        APTOS_RPC_URLS.put(SupportedAptosNetwork.APTOS_MAINNET, "https://fullnode.mainnet.aptoslabs.com/v1");
        APTOS_RPC_URLS.put(SupportedAptosNetwork.APTOS_TESTNET, "https://fullnode.testnet.aptoslabs.com/v1");
        APTOS_RPC_URLS.put(SupportedAptosNetwork.APTOS_DEVNET, "https://fullnode.devnet.aptoslabs.com/v1");
    }

    // Aptos USDT addresses (Fungible Asset metadata)
    public static final Map<SupportedAptosNetwork, String> APTOS_USDT_ADDRESSES = new EnumMap<>(SupportedAptosNetwork.class);
    static {
        APTOS_USDT_ADDRESSES.put(SupportedAptosNetwork.APTOS_MAINNET, "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb");
        // Testnet/devnet may not have USDT, using placeholder
        APTOS_USDT_ADDRESSES.put(SupportedAptosNetwork.APTOS_TESTNET, "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb");
        APTOS_USDT_ADDRESSES.put(SupportedAptosNetwork.APTOS_DEVNET, "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb");
    }

    /** Aptos address pattern (0x-prefixed hex, up to 64 chars). */
    public static final String APTOS_ADDRESS_PATTERN = "^0x[a-fA-F0-9]{1,64}$";

    // =========================================================================
    // Aptos Utility Methods
    // =========================================================================

    /**
     * Returns all supported Aptos networks.
     */
    public static List<SupportedAptosNetwork> getAllAptosNetworks() {
        return Arrays.asList(SupportedAptosNetwork.values());
    }

    /**
     * Checks if an Aptos network string is valid.
     */
    public static boolean isValidAptosNetwork(String network) {
        return SupportedAptosNetwork.fromString(network) != null;
    }

    /**
     * Returns the explorer URL for an Aptos transaction.
     */
    public static String getAptosExplorerTxUrl(SupportedAptosNetwork network, String txHash) {
        String baseUrl = APTOS_EXPLORER_URLS.get(network);
        if (baseUrl == null) {
            return "";
        }
        String networkSuffix = "";
        switch (network) {
            case APTOS_TESTNET:
                networkSuffix = "?network=testnet";
                break;
            case APTOS_DEVNET:
                networkSuffix = "?network=devnet";
                break;
            default:
                break;
        }
        return baseUrl + "/txn/" + txHash + networkSuffix;
    }

    /**
     * Returns the RPC URL for an Aptos network, using config override if available.
     */
    public static String getAptosRpcUrl(ServerConfig config, SupportedAptosNetwork network) {
        if (config != null && config.getRpcUrls() != null) {
            String url = config.getRpcUrls().get(network.getValue());
            if (url != null && !url.isEmpty()) {
                return url;
            }
        }
        return APTOS_RPC_URLS.get(network);
    }

    /**
     * Returns the USDT Fungible Asset address for an Aptos network.
     */
    public static String getAptosUsdtAddress(SupportedAptosNetwork network) {
        return APTOS_USDT_ADDRESSES.get(network);
    }

    /**
     * Validates an Aptos address format (0x-prefixed hex).
     */
    public static boolean isValidAptosAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return address.matches(APTOS_ADDRESS_PATTERN);
    }

    // =========================================================================
    // Tezos Network Constants
    // =========================================================================

    /** Native token symbol for Tezos. */
    public static final String XTZ_SYMBOL = "XTZ";

    /** Standard decimal count for XTZ native token. */
    public static final int XTZ_DECIMALS = 6;

    /** Standard decimal count for USDt on Tezos. */
    public static final int TEZOS_USDT_DECIMALS = 6;

    // Tezos Explorer URLs
    public static final Map<SupportedTezosNetwork, String> TEZOS_EXPLORER_URLS = new EnumMap<>(SupportedTezosNetwork.class);
    static {
        TEZOS_EXPLORER_URLS.put(SupportedTezosNetwork.TEZOS_MAINNET, "https://tzkt.io");
        TEZOS_EXPLORER_URLS.put(SupportedTezosNetwork.TEZOS_GHOSTNET, "https://ghostnet.tzkt.io");
    }

    // Tezos RPC URLs
    public static final Map<SupportedTezosNetwork, String> TEZOS_RPC_URLS = new EnumMap<>(SupportedTezosNetwork.class);
    static {
        TEZOS_RPC_URLS.put(SupportedTezosNetwork.TEZOS_MAINNET, "https://mainnet.api.tez.ie");
        TEZOS_RPC_URLS.put(SupportedTezosNetwork.TEZOS_GHOSTNET, "https://ghostnet.tezos.marigold.dev");
    }

    // Tezos USDt addresses (FA2 contract)
    public static final Map<SupportedTezosNetwork, String> TEZOS_USDT_ADDRESSES = new EnumMap<>(SupportedTezosNetwork.class);
    static {
        TEZOS_USDT_ADDRESSES.put(SupportedTezosNetwork.TEZOS_MAINNET, "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o");
        // Ghostnet may not have USDt, using placeholder
        TEZOS_USDT_ADDRESSES.put(SupportedTezosNetwork.TEZOS_GHOSTNET, "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o");
    }

    /** Tezos address pattern (tz1/tz2/tz3/KT1 prefix, 36 chars). */
    public static final String TEZOS_ADDRESS_PATTERN = "^(tz1|tz2|tz3|KT1)[1-9A-HJ-NP-Za-km-z]{33}$";

    // =========================================================================
    // Tezos Utility Methods
    // =========================================================================

    /**
     * Returns all supported Tezos networks.
     */
    public static List<SupportedTezosNetwork> getAllTezosNetworks() {
        return Arrays.asList(SupportedTezosNetwork.values());
    }

    /**
     * Checks if a Tezos network string is valid.
     */
    public static boolean isValidTezosNetwork(String network) {
        return SupportedTezosNetwork.fromString(network) != null;
    }

    /**
     * Returns the explorer URL for a Tezos transaction.
     */
    public static String getTezosExplorerTxUrl(SupportedTezosNetwork network, String opHash) {
        String baseUrl = TEZOS_EXPLORER_URLS.get(network);
        if (baseUrl == null) {
            return "";
        }
        return baseUrl + "/" + opHash;
    }

    /**
     * Returns the RPC URL for a Tezos network, using config override if available.
     */
    public static String getTezosRpcUrl(ServerConfig config, SupportedTezosNetwork network) {
        if (config != null && config.getRpcUrls() != null) {
            String url = config.getRpcUrls().get(network.getValue());
            if (url != null && !url.isEmpty()) {
                return url;
            }
        }
        return TEZOS_RPC_URLS.get(network);
    }

    /**
     * Returns the USDt FA2 contract address for a Tezos network.
     */
    public static String getTezosUsdtAddress(SupportedTezosNetwork network) {
        return TEZOS_USDT_ADDRESSES.get(network);
    }

    /**
     * Validates a Tezos address format (tz1/tz2/tz3/KT1 prefix).
     */
    public static boolean isValidTezosAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return address.matches(TEZOS_ADDRESS_PATTERN);
    }
}
