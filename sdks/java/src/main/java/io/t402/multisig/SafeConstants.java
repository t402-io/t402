package io.t402.multisig;

/**
 * Constants for Safe multi-sig smart accounts.
 *
 * Safe 4337 module addresses (v0.3.0) deployed on all major EVM chains.
 */
public final class SafeConstants {

    private SafeConstants() {
        // Utility class
    }

    // Safe 4337 Module address
    public static final String SAFE_4337_MODULE = "0xa581c4A4DB7175302464fF3C06380BC3270b4037";

    // Safe Module Setup address
    public static final String SAFE_MODULE_SETUP = "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47";

    // Safe Singleton address
    public static final String SAFE_SINGLETON = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762";

    // Safe Proxy Factory address
    public static final String SAFE_PROXY_FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";

    // Safe Fallback Handler address
    public static final String SAFE_FALLBACK_HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99";

    // Add Modules Lib address
    public static final String SAFE_ADD_MODULES_LIB = "0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb";

    // MultiSend library address
    public static final String SAFE_MULTISEND = "0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526";

    // ERC-4337 EntryPoint v0.7 address
    public static final String ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

    // Default configuration values
    public static final int DEFAULT_REQUEST_EXPIRATION_SECONDS = 3600; // 1 hour
    public static final int DEFAULT_SALT_NONCE = 0;
    public static final int MAX_OWNERS = 10;
    public static final int MIN_THRESHOLD = 1;

    // Safe ABI method selectors (function selectors)
    public static final byte[] GET_OWNERS_SELECTOR = hexToBytes("a0e67e2b");
    public static final byte[] GET_THRESHOLD_SELECTOR = hexToBytes("e75b2357");
    public static final byte[] NONCE_SELECTOR = hexToBytes("affed0e0");
    public static final byte[] EXEC_TRANSACTION_SELECTOR = hexToBytes("6a761202");
    public static final byte[] GET_TRANSACTION_HASH_SELECTOR = hexToBytes("d8d11f78");

    // ERC20 transfer selector
    public static final byte[] ERC20_TRANSFER_SELECTOR = hexToBytes("a9059cbb");

    // MultiSend selector
    public static final byte[] MULTISEND_SELECTOR = hexToBytes("8d80ff0a");

    // EIP-712 domain type hash for Safe
    public static final String SAFE_DOMAIN_SEPARATOR_TYPEHASH =
            "EIP712Domain(uint256 chainId,address verifyingContract)";

    // Safe transaction type hash
    public static final String SAFE_TX_TYPEHASH =
            "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas," +
                    "uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)";

    /**
     * Convert hex string to byte array.
     */
    private static byte[] hexToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}
