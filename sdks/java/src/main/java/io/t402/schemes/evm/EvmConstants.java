package io.t402.schemes.evm;

import java.util.Map;
import java.util.Set;

/**
 * Constants for EVM payment schemes.
 *
 * <p>Defines network identifiers, token addresses, EIP-712 domain parameters,
 * and default values for EVM-based payments using EIP-3009 TransferWithAuthorization.</p>
 */
public final class EvmConstants {

    private EvmConstants() {
        // Utility class
    }

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact payment scheme identifier. */
    public static final String SCHEME_EXACT = "exact";

    /** Exact-Legacy payment scheme identifier (approve + transferFrom). */
    public static final String SCHEME_EXACT_LEGACY = "exact-legacy";

    /** Up-To payment scheme identifier. */
    public static final String SCHEME_UPTO = "upto";

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = "eip155:*";

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** Ethereum Mainnet. */
    public static final String ETHEREUM_MAINNET = "eip155:1";

    /** Arbitrum One. */
    public static final String ARBITRUM_ONE = "eip155:42161";

    /** Base Mainnet. */
    public static final String BASE_MAINNET = "eip155:8453";

    /** Base Sepolia Testnet. */
    public static final String BASE_SEPOLIA = "eip155:84532";

    /** Optimism Mainnet. */
    public static final String OPTIMISM_MAINNET = "eip155:10";

    /** Ink Mainnet. */
    public static final String INK_MAINNET = "eip155:57073";

    /** Berachain Mainnet. */
    public static final String BERACHAIN_MAINNET = "eip155:80094";

    /** Unichain Mainnet. */
    public static final String UNICHAIN_MAINNET = "eip155:130";

    /** Polygon PoS. */
    public static final String POLYGON_MAINNET = "eip155:137";

    /** Mantle Mainnet. */
    public static final String MANTLE_MAINNET = "eip155:5000";

    /** Plasma Mainnet. */
    public static final String PLASMA_MAINNET = "eip155:9745";

    /** Sei Mainnet. */
    public static final String SEI_MAINNET = "eip155:1329";

    /** Conflux eSpace. */
    public static final String CONFLUX_MAINNET = "eip155:1030";

    /** Sepolia Testnet. */
    public static final String SEPOLIA = "eip155:11155111";

    // ============================================================
    // USDT0 Token Addresses (EIP-3009 supported)
    // ============================================================

    /** USDT0 addresses indexed by network. */
    public static final Map<String, String> USDT0_ADDRESSES = Map.ofEntries(
        Map.entry(ETHEREUM_MAINNET, "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee"),
        Map.entry(ARBITRUM_ONE, "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"),
        Map.entry(INK_MAINNET, "0x0200C29006150606B650577BBE7B6248F58470c1"),
        Map.entry(BERACHAIN_MAINNET, "0x779Ded0c9e1022225f8E0630b35a9b54bE713736"),
        Map.entry(UNICHAIN_MAINNET, "0x9151434b16b9763660705744891fA906F660EcC5"),
        Map.entry(POLYGON_MAINNET, "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"),
        Map.entry(OPTIMISM_MAINNET, "0x01bFF41798a0BcF287b996046Ca68b395DbC1071"),
        Map.entry(MANTLE_MAINNET, "0x779Ded0c9e1022225f8E0630b35a9b54bE713736"),
        Map.entry(PLASMA_MAINNET, "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb"),
        Map.entry(SEI_MAINNET, "0x9151434b16b9763660705744891fA906F660EcC5"),
        Map.entry(CONFLUX_MAINNET, "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff")
    );

    // ============================================================
    // USAT Token Addresses (Tether America USD — no EIP-3009, has EIP-2612)
    // ============================================================

    /** USAT addresses indexed by network. */
    public static final Map<String, String> USAT_ADDRESSES = Map.of(
        ETHEREUM_MAINNET, "0x07041776f5007aca2a54844f50503a18a72a8b68"
    );

    // ============================================================
    // USDC Token Addresses (EIP-3009 supported)
    // ============================================================

    /** USDC addresses indexed by network. */
    public static final Map<String, String> USDC_ADDRESSES = Map.of(
        ETHEREUM_MAINNET, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        BASE_MAINNET, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        BASE_SEPOLIA, "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        SEPOLIA, "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        ARBITRUM_ONE, "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        POLYGON_MAINNET, "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
    );

    // ============================================================
    // EIP-712 Domain Parameters
    // ============================================================

    /** USDT0 EIP-712 domain name. */
    public static final String USDT0_TOKEN_NAME = "TetherToken";

    /** USDT0 EIP-712 domain version. */
    public static final String USDT0_TOKEN_VERSION = "1";

    /** USAT EIP-712 domain name. */
    public static final String USAT_TOKEN_NAME = "Tether America USD";

    /** USAT EIP-712 domain version. */
    public static final String USAT_TOKEN_VERSION = "1";

    /** USDC EIP-712 domain name. */
    public static final String USDC_TOKEN_NAME = "USD Coin";

    /** USDC EIP-712 domain version. */
    public static final String USDC_TOKEN_VERSION = "2";

    // ============================================================
    // Default Values
    // ============================================================

    /** Default token symbol. */
    public static final String DEFAULT_TOKEN = "USDT0";

    /** USDT/USDC decimals. */
    public static final int TOKEN_DECIMALS = 6;

    /** Default transaction validity duration in seconds (5 minutes). */
    public static final int DEFAULT_VALIDITY_DURATION = 300;

    /** Clock skew tolerance in seconds (1 minute). */
    public static final int CLOCK_SKEW_TOLERANCE = 60;

    /** Set of all supported EVM networks. */
    public static final Set<String> SUPPORTED_NETWORKS;

    static {
        SUPPORTED_NETWORKS = Set.of(
            ETHEREUM_MAINNET,
            ARBITRUM_ONE,
            BASE_MAINNET,
            BASE_SEPOLIA,
            OPTIMISM_MAINNET,
            INK_MAINNET,
            BERACHAIN_MAINNET,
            UNICHAIN_MAINNET,
            POLYGON_MAINNET,
            MANTLE_MAINNET,
            PLASMA_MAINNET,
            SEI_MAINNET,
            CONFLUX_MAINNET,
            SEPOLIA
        );
    }

    // ============================================================
    // Chain ID Mapping
    // ============================================================

    /** Maps CAIP-2 network identifier to numeric chain ID. */
    public static final Map<String, Long> CHAIN_IDS = Map.ofEntries(
        Map.entry(ETHEREUM_MAINNET, 1L),
        Map.entry(ARBITRUM_ONE, 42161L),
        Map.entry(BASE_MAINNET, 8453L),
        Map.entry(BASE_SEPOLIA, 84532L),
        Map.entry(OPTIMISM_MAINNET, 10L),
        Map.entry(INK_MAINNET, 57073L),
        Map.entry(BERACHAIN_MAINNET, 80094L),
        Map.entry(UNICHAIN_MAINNET, 130L),
        Map.entry(POLYGON_MAINNET, 137L),
        Map.entry(MANTLE_MAINNET, 5000L),
        Map.entry(PLASMA_MAINNET, 9745L),
        Map.entry(SEI_MAINNET, 1329L),
        Map.entry(CONFLUX_MAINNET, 1030L),
        Map.entry(SEPOLIA, 11155111L)
    );

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Gets the default USDT0 address for a given network.
     *
     * @param network Network identifier (CAIP-2 format, e.g., "eip155:1")
     * @return USDT0 contract address
     * @throws IllegalArgumentException if network is not supported for USDT0
     */
    public static String getUsdt0Address(String network) {
        String address = USDT0_ADDRESSES.get(network);
        if (address == null) {
            throw new IllegalArgumentException("USDT0 not available on network: " + network);
        }
        return address;
    }

    /**
     * Gets the USDC address for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDC contract address
     * @throws IllegalArgumentException if network is not supported for USDC
     */
    public static String getUsdcAddress(String network) {
        String address = USDC_ADDRESSES.get(network);
        if (address == null) {
            throw new IllegalArgumentException("USDC not available on network: " + network);
        }
        return address;
    }

    /**
     * Gets the USAT address for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USAT contract address
     * @throws IllegalArgumentException if network is not supported for USAT
     */
    public static String getUsatAddress(String network) {
        String address = USAT_ADDRESSES.get(network);
        if (address == null) {
            throw new IllegalArgumentException("USAT not available on network: " + network);
        }
        return address;
    }

    /**
     * Gets the default token address for a network, preferring USDT0.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return Token contract address (USDT0 if available, otherwise USDC)
     * @throws IllegalArgumentException if no supported token found on network
     */
    public static String getDefaultTokenAddress(String network) {
        String usdt0 = USDT0_ADDRESSES.get(network);
        if (usdt0 != null) {
            return usdt0;
        }
        String usdc = USDC_ADDRESSES.get(network);
        if (usdc != null) {
            return usdc;
        }
        throw new IllegalArgumentException("No supported token on network: " + network);
    }

    /**
     * Gets the EIP-712 token name for a given token address on a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @param tokenAddress Token contract address
     * @return EIP-712 domain name
     */
    public static String getTokenName(String network, String tokenAddress) {
        String usdt0 = USDT0_ADDRESSES.get(network);
        if (usdt0 != null && usdt0.equalsIgnoreCase(tokenAddress)) {
            return USDT0_TOKEN_NAME;
        }
        String usat = USAT_ADDRESSES.get(network);
        if (usat != null && usat.equalsIgnoreCase(tokenAddress)) {
            return USAT_TOKEN_NAME;
        }
        String usdc = USDC_ADDRESSES.get(network);
        if (usdc != null && usdc.equalsIgnoreCase(tokenAddress)) {
            return USDC_TOKEN_NAME;
        }
        return USDT0_TOKEN_NAME; // Default fallback
    }

    /**
     * Gets the EIP-712 token version for a given token address on a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @param tokenAddress Token contract address
     * @return EIP-712 domain version
     */
    public static String getTokenVersion(String network, String tokenAddress) {
        String usat = USAT_ADDRESSES.get(network);
        if (usat != null && usat.equalsIgnoreCase(tokenAddress)) {
            return USAT_TOKEN_VERSION;
        }
        String usdc = USDC_ADDRESSES.get(network);
        if (usdc != null && usdc.equalsIgnoreCase(tokenAddress)) {
            return USDC_TOKEN_VERSION;
        }
        return USDT0_TOKEN_VERSION; // USDT0 default
    }

    /**
     * Gets the chain ID for a network.
     *
     * @param network Network identifier (CAIP-2 format, e.g., "eip155:8453")
     * @return Numeric chain ID
     * @throws IllegalArgumentException if network format is invalid
     */
    public static long getChainId(String network) {
        Long chainId = CHAIN_IDS.get(network);
        if (chainId != null) {
            return chainId;
        }
        // Try to parse from CAIP-2 format: "eip155:<chainId>"
        if (network.startsWith("eip155:")) {
            try {
                return Long.parseLong(network.substring(7));
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid EVM network identifier: " + network);
            }
        }
        throw new IllegalArgumentException("Not an EVM network: " + network);
    }

    /**
     * Checks if a network identifier is a valid EVM network.
     *
     * @param network Network identifier
     * @return true if the network is an EVM (eip155) network
     */
    public static boolean isEvmNetwork(String network) {
        return network != null && network.startsWith("eip155:");
    }

    /**
     * Checks if a network is in the set of explicitly supported networks.
     *
     * @param network Network identifier
     * @return true if the network is explicitly supported
     */
    public static boolean isSupportedNetwork(String network) {
        return SUPPORTED_NETWORKS.contains(network);
    }
}
