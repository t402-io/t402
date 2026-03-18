package io.t402.schemes.evm.erc7710;

import java.math.BigInteger;

/**
 * Utility class for encoding ERC-7579 single execution calldata.
 *
 * <p>Encodes an ERC-20 {@code transfer(address,uint256)} call wrapped in
 * the ERC-7579 single execution format:
 * {@code target (20 bytes) + value (32 bytes) + calldata}.</p>
 *
 * <p>Used by the ERC-7710 facilitator scheme to construct the
 * {@code _executionCallDatas} parameter for
 * {@code DelegationManager.redeemDelegations()}.</p>
 */
public final class ERC7579ExecutionEncoder {

    private ERC7579ExecutionEncoder() {
        // Utility class
    }

    /**
     * ERC-20 transfer function selector: {@code keccak256("transfer(address,uint256)")[:4]}.
     */
    public static final byte[] ERC20_TRANSFER_SELECTOR = new byte[]{
        (byte) 0xa9, (byte) 0x05, (byte) 0x9c, (byte) 0xbb
    };

    /**
     * ERC-7579 single call mode (32 zero bytes).
     * Mode encoding: 1 byte callType (0x00=single) + 1 byte execType (0x00=default)
     * + 4 bytes unused + 22 bytes modePayload.
     */
    public static final byte[] SINGLE_CALL_MODE = new byte[32];

    /**
     * Encodes an ERC-20 transfer in ERC-7579 single execution format.
     *
     * <p>Output format: target (20 bytes) + value (32 bytes, zero) + calldata.
     * The calldata is {@code transfer(address,uint256)} with the given recipient and amount.</p>
     *
     * @param tokenAddress 0x-prefixed ERC-20 token contract address
     * @param recipient 0x-prefixed recipient address
     * @param amount Transfer amount in atomic units
     * @return Encoded execution calldata bytes
     * @throws IllegalArgumentException if addresses are invalid or amount is negative
     */
    public static byte[] encodeERC20Transfer(String tokenAddress, String recipient, BigInteger amount) {
        if (amount.signum() < 0) {
            throw new IllegalArgumentException("Amount cannot be negative");
        }

        byte[] tokenAddr = hexToAddress(tokenAddress);
        byte[] recipientAddr = hexToAddress(recipient);

        // ERC-20 transfer calldata: selector (4) + address (32) + uint256 (32) = 68 bytes
        byte[] transferCallData = new byte[4 + 32 + 32];
        System.arraycopy(ERC20_TRANSFER_SELECTOR, 0, transferCallData, 0, 4);

        // Recipient address left-padded to 32 bytes (12 zero bytes + 20 address bytes)
        System.arraycopy(recipientAddr, 0, transferCallData, 4 + 12, 20);

        // Amount left-padded to 32 bytes
        byte[] amountBytes = amount.toByteArray();
        // BigInteger.toByteArray() may include a leading zero byte for positive numbers
        int amountLen = amountBytes.length;
        if (amountLen > 32) {
            // Strip leading zero if present
            if (amountBytes[0] == 0 && amountLen == 33) {
                System.arraycopy(amountBytes, 1, transferCallData, 4 + 32, 32);
            } else {
                throw new IllegalArgumentException("Amount too large for uint256");
            }
        } else {
            System.arraycopy(amountBytes, 0, transferCallData, 4 + 32 + (32 - amountLen), amountLen);
        }

        // ERC-7579 single execution: target (20) + value (32, zero) + calldata
        byte[] executionCallData = new byte[20 + 32 + transferCallData.length];
        System.arraycopy(tokenAddr, 0, executionCallData, 0, 20);
        // value = 0 (no ETH), 32 zero bytes are already default
        System.arraycopy(transferCallData, 0, executionCallData, 20 + 32, transferCallData.length);

        return executionCallData;
    }

    /**
     * Converts a hex-encoded string to a byte array.
     *
     * @param hex Hex string with or without 0x prefix
     * @return Decoded bytes
     * @throws IllegalArgumentException if hex string is invalid
     */
    public static byte[] hexToBytes(String hex) {
        if (hex == null) {
            throw new IllegalArgumentException("Hex string cannot be null");
        }
        String s = hex.startsWith("0x") || hex.startsWith("0X") ? hex.substring(2) : hex;
        if (s.length() % 2 != 0) {
            s = "0" + s;
        }
        byte[] result = new byte[s.length() / 2];
        for (int i = 0; i < result.length; i++) {
            int high = Character.digit(s.charAt(i * 2), 16);
            int low = Character.digit(s.charAt(i * 2 + 1), 16);
            if (high < 0 || low < 0) {
                throw new IllegalArgumentException("Invalid hex character in: " + hex);
            }
            result[i] = (byte) ((high << 4) | low);
        }
        return result;
    }

    /**
     * Converts a hex-encoded Ethereum address to a 20-byte array.
     *
     * @param address 0x-prefixed Ethereum address
     * @return 20-byte address
     * @throws IllegalArgumentException if address is not 20 bytes
     */
    static byte[] hexToAddress(String address) {
        byte[] bytes = hexToBytes(address);
        if (bytes.length != 20) {
            throw new IllegalArgumentException(
                "Address must be 20 bytes, got " + bytes.length + ": " + address);
        }
        return bytes;
    }

    /**
     * Converts a byte array to a lowercase hex string with 0x prefix.
     *
     * @param bytes Byte array
     * @return 0x-prefixed hex string
     */
    public static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder("0x");
        for (byte b : bytes) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }
}
