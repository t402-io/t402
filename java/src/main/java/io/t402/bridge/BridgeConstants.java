package io.t402.bridge;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Constants for USDT0 cross-chain bridging via LayerZero.
 */
public final class BridgeConstants {

    private BridgeConstants() {
        // Utility class
    }

    /** LayerZero Scan API base URL. */
    public static final String LAYERZERO_SCAN_BASE_URL = "https://api.layerzero.scan/v1";

    /** Default slippage tolerance (0.5%). */
    public static final double DEFAULT_SLIPPAGE = 0.005;

    /** Estimated bridge time in seconds. */
    public static final int ESTIMATED_BRIDGE_TIME_SECONDS = 300;

    /** Default extra options for LayerZero. */
    public static final byte[] DEFAULT_EXTRA_OPTIONS = new byte[0];

    /** OFTSent event topic for message GUID extraction. */
    public static final String OFT_SENT_EVENT_TOPIC =
        "0x85496b760a4b7f8d66384b9df21b381f5d1b1e79f229a47aaf4c232edc2fe59a";

    // LayerZero Endpoint IDs (v2)
    private static final Map<String, Integer> ENDPOINT_IDS = new HashMap<>();

    static {
        ENDPOINT_IDS.put("ethereum", 30101);
        ENDPOINT_IDS.put("arbitrum", 30110);
        ENDPOINT_IDS.put("optimism", 30111);
        ENDPOINT_IDS.put("polygon", 30109);
        ENDPOINT_IDS.put("bsc", 30102);
        ENDPOINT_IDS.put("avalanche", 30106);
        ENDPOINT_IDS.put("base", 30184);
        ENDPOINT_IDS.put("ink", 30291);
        ENDPOINT_IDS.put("celo", 30125);
        ENDPOINT_IDS.put("mantle", 30181);
        ENDPOINT_IDS.put("berachain", 30362);
        ENDPOINT_IDS.put("unichain", 30320);
        ENDPOINT_IDS.put("tron", 30420);
        ENDPOINT_IDS.put("ton", 30312);
    }

    // USDT0 OFT contract addresses
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
        USDT0_ADDRESSES.put("berachain", "0x779877A7B0D9E8603169DdbD7836e478b4624789");
        USDT0_ADDRESSES.put("unichain", "0x6d3F3C7093bb3cBc93cbdf5c06D4F855F5B14D3B");
    }

    // Network to chain name mapping
    private static final Map<String, String> NETWORK_TO_CHAIN = new HashMap<>();

    static {
        NETWORK_TO_CHAIN.put("eip155:1", "ethereum");
        NETWORK_TO_CHAIN.put("eip155:42161", "arbitrum");
        NETWORK_TO_CHAIN.put("eip155:10", "optimism");
        NETWORK_TO_CHAIN.put("eip155:137", "polygon");
        NETWORK_TO_CHAIN.put("eip155:56", "bsc");
        NETWORK_TO_CHAIN.put("eip155:43114", "avalanche");
        NETWORK_TO_CHAIN.put("eip155:8453", "base");
        NETWORK_TO_CHAIN.put("eip155:57073", "ink");
        NETWORK_TO_CHAIN.put("eip155:42220", "celo");
        NETWORK_TO_CHAIN.put("eip155:5000", "mantle");
    }

    /**
     * Get LayerZero endpoint ID for a chain.
     *
     * @param chain Chain name (e.g., "ethereum", "arbitrum")
     * @return Endpoint ID or null if not supported
     */
    public static Integer getEndpointId(String chain) {
        return ENDPOINT_IDS.get(chain.toLowerCase());
    }

    /**
     * Get LayerZero endpoint ID from network identifier.
     *
     * @param network Network identifier (e.g., "eip155:1")
     * @return Endpoint ID or null if not supported
     */
    public static Integer getEndpointIdFromNetwork(String network) {
        String chain = NETWORK_TO_CHAIN.get(network.toLowerCase());
        return chain != null ? getEndpointId(chain) : null;
    }

    /**
     * Get USDT0 OFT contract address for a chain.
     *
     * @param chain Chain name
     * @return Contract address or null if not supported
     */
    public static String getUsdt0OftAddress(String chain) {
        return USDT0_ADDRESSES.get(chain.toLowerCase());
    }

    /**
     * Check if a chain supports USDT0 bridging.
     *
     * @param chain Chain name
     * @return true if supported
     */
    public static boolean supportsBridging(String chain) {
        return USDT0_ADDRESSES.containsKey(chain.toLowerCase());
    }

    /**
     * Get all chains that support USDT0 bridging.
     *
     * @return Set of chain names
     */
    public static Set<String> getBridgeableChains() {
        return USDT0_ADDRESSES.keySet();
    }

    /**
     * Convert an address to bytes32 format for LayerZero.
     *
     * @param address 0x-prefixed Ethereum address
     * @return 32-byte address (zero-padded)
     */
    public static byte[] addressToBytes32(String address) {
        String hex = address.startsWith("0x") ? address.substring(2) : address;
        byte[] addressBytes = hexDecode(hex);
        byte[] result = new byte[32];
        System.arraycopy(addressBytes, 0, result, 12, 20);
        return result;
    }

    /**
     * Convert bytes32 back to an address.
     *
     * @param bytes32 32-byte address
     * @return 0x-prefixed Ethereum address
     */
    public static String bytes32ToAddress(byte[] bytes32) {
        if (bytes32.length != 32) {
            throw new IllegalArgumentException("bytes32 must be 32 bytes");
        }
        byte[] addressBytes = new byte[20];
        System.arraycopy(bytes32, 12, addressBytes, 0, 20);
        return "0x" + hexEncode(addressBytes);
    }

    /**
     * Get chain name from network identifier.
     *
     * @param network Network identifier (e.g., "eip155:1")
     * @return Chain name or null
     */
    public static String networkToChain(String network) {
        return NETWORK_TO_CHAIN.get(network.toLowerCase());
    }

    private static byte[] hexDecode(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                                + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }

    private static String hexEncode(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b & 0xFF));
        }
        return sb.toString();
    }
}
