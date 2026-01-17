package io.t402.schemes.svm;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Constants for Solana SVM networks and tokens.
 */
public final class SvmConstants {

    private SvmConstants() {}

    /** The scheme identifier for exact payments. */
    public static final String SCHEME_EXACT = "exact";

    /** Default token decimals (USDC). */
    public static final int DEFAULT_DECIMALS = 6;

    // =========================================================================
    // CAIP-2 Network Identifiers
    // =========================================================================

    /** Solana Mainnet CAIP-2 identifier. */
    public static final String SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

    /** Solana Devnet CAIP-2 identifier. */
    public static final String SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

    /** Solana Testnet CAIP-2 identifier. */
    public static final String SOLANA_TESTNET = "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z";

    // =========================================================================
    // Legacy Network Identifiers (V1)
    // =========================================================================

    /** Legacy Solana Mainnet identifier. */
    public static final String SOLANA_MAINNET_V1 = "solana";

    /** Legacy Solana Devnet identifier. */
    public static final String SOLANA_DEVNET_V1 = "solana-devnet";

    /** Legacy Solana Testnet identifier. */
    public static final String SOLANA_TESTNET_V1 = "solana-testnet";

    /** V1 to V2 network mapping. */
    public static final Map<String, String> V1_TO_V2_NETWORK_MAP = Map.of(
        SOLANA_MAINNET_V1, SOLANA_MAINNET,
        SOLANA_DEVNET_V1, SOLANA_DEVNET,
        SOLANA_TESTNET_V1, SOLANA_TESTNET
    );

    /** All supported CAIP-2 networks. */
    public static final Set<String> SUPPORTED_NETWORKS = Set.of(
        SOLANA_MAINNET,
        SOLANA_DEVNET,
        SOLANA_TESTNET
    );

    // =========================================================================
    // Program Addresses
    // =========================================================================

    /** SPL Token program address. */
    public static final String TOKEN_PROGRAM_ADDRESS = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

    /** SPL Token-2022 program address. */
    public static final String TOKEN_2022_PROGRAM_ADDRESS = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

    /** Compute Budget program address. */
    public static final String COMPUTE_BUDGET_PROGRAM_ADDRESS = "ComputeBudget111111111111111111111111111111";

    // =========================================================================
    // USDC Token Addresses
    // =========================================================================

    /** USDC mint address on Mainnet. */
    public static final String USDC_MAINNET_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    /** USDC mint address on Devnet. */
    public static final String USDC_DEVNET_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

    /** USDC mint address on Testnet. */
    public static final String USDC_TESTNET_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

    // =========================================================================
    // RPC URLs
    // =========================================================================

    /** Default Mainnet RPC URL. */
    public static final String MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

    /** Default Devnet RPC URL. */
    public static final String DEVNET_RPC_URL = "https://api.devnet.solana.com";

    /** Default Testnet RPC URL. */
    public static final String TESTNET_RPC_URL = "https://api.testnet.solana.com";

    /** Default Mainnet WebSocket URL. */
    public static final String MAINNET_WS_URL = "wss://api.mainnet-beta.solana.com";

    /** Default Devnet WebSocket URL. */
    public static final String DEVNET_WS_URL = "wss://api.devnet.solana.com";

    /** Default Testnet WebSocket URL. */
    public static final String TESTNET_WS_URL = "wss://api.testnet.solana.com";

    // =========================================================================
    // Transaction Configuration
    // =========================================================================

    /** Default compute unit price in microlamports. */
    public static final long DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS = 1L;

    /** Maximum compute unit price in microlamports. */
    public static final long MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS = 5_000_000L;

    /** Default compute unit limit. */
    public static final int DEFAULT_COMPUTE_UNIT_LIMIT = 6500;

    /** Default validity duration in seconds. */
    public static final int DEFAULT_VALIDITY_DURATION = 3600;

    /** Minimum validity buffer in seconds. */
    public static final int MIN_VALIDITY_BUFFER = 30;

    // =========================================================================
    // Utility Methods
    // =========================================================================

    /**
     * Gets the USDC mint address for a network.
     *
     * @param network network identifier (CAIP-2 or legacy)
     * @return USDC mint address
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getUsdcAddress(String network) {
        String normalized = normalizeNetwork(network);
        return switch (normalized) {
            case SOLANA_MAINNET -> USDC_MAINNET_ADDRESS;
            case SOLANA_DEVNET, SOLANA_TESTNET -> USDC_DEVNET_ADDRESS;
            default -> throw new IllegalArgumentException("Unsupported Solana network: " + network);
        };
    }

    /**
     * Gets the RPC URL for a network.
     *
     * @param network network identifier (CAIP-2 or legacy)
     * @return RPC URL
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getRpcUrl(String network) {
        String normalized = normalizeNetwork(network);
        return switch (normalized) {
            case SOLANA_MAINNET -> MAINNET_RPC_URL;
            case SOLANA_DEVNET -> DEVNET_RPC_URL;
            case SOLANA_TESTNET -> TESTNET_RPC_URL;
            default -> throw new IllegalArgumentException("Unsupported Solana network: " + network);
        };
    }

    /**
     * Gets the WebSocket URL for a network.
     *
     * @param network network identifier (CAIP-2 or legacy)
     * @return WebSocket URL
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getWsUrl(String network) {
        String normalized = normalizeNetwork(network);
        return switch (normalized) {
            case SOLANA_MAINNET -> MAINNET_WS_URL;
            case SOLANA_DEVNET -> DEVNET_WS_URL;
            case SOLANA_TESTNET -> TESTNET_WS_URL;
            default -> throw new IllegalArgumentException("Unsupported Solana network: " + network);
        };
    }

    /**
     * Normalizes a network identifier to CAIP-2 format.
     *
     * @param network network identifier (V1 or V2)
     * @return CAIP-2 format network identifier
     */
    public static String normalizeNetwork(String network) {
        if (V1_TO_V2_NETWORK_MAP.containsKey(network)) {
            return V1_TO_V2_NETWORK_MAP.get(network);
        }
        return network;
    }

    /**
     * Checks if a network is supported.
     *
     * @param network network identifier
     * @return true if supported
     */
    public static boolean isValidNetwork(String network) {
        String normalized = normalizeNetwork(network);
        return SUPPORTED_NETWORKS.contains(normalized);
    }

    /**
     * Checks if a network is a Solana SVM network.
     *
     * @param network network identifier
     * @return true if it's a Solana network
     */
    public static boolean isSvmNetwork(String network) {
        return network.startsWith("solana:") || V1_TO_V2_NETWORK_MAP.containsKey(network);
    }

    /**
     * Checks if a network is a testnet/devnet.
     *
     * @param network network identifier
     * @return true if testnet/devnet
     */
    public static boolean isTestnet(String network) {
        String normalized = normalizeNetwork(network);
        return SOLANA_DEVNET.equals(normalized) || SOLANA_TESTNET.equals(normalized);
    }
}
