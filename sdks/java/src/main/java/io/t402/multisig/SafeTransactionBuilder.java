package io.t402.multisig;

import io.t402.multisig.SafeTypes.OperationType;
import io.t402.multisig.SafeTypes.SafeTransaction;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Builder for Safe transactions.
 */
public class SafeTransactionBuilder {

    private String to = "0x0000000000000000000000000000000000000000";
    private BigInteger value = BigInteger.ZERO;
    private byte[] data = new byte[0];
    private OperationType operation = OperationType.CALL;
    private BigInteger safeTxGas = BigInteger.ZERO;
    private BigInteger baseGas = BigInteger.ZERO;
    private BigInteger gasPrice = BigInteger.ZERO;
    private String gasToken = "0x0000000000000000000000000000000000000000";
    private String refundReceiver = "0x0000000000000000000000000000000000000000";
    private BigInteger nonce = null;

    /**
     * Set the target address.
     */
    public SafeTransactionBuilder to(String address) {
        this.to = address;
        return this;
    }

    /**
     * Set the ETH value to send.
     */
    public SafeTransactionBuilder value(BigInteger value) {
        if (value != null) {
            this.value = value;
        }
        return this;
    }

    /**
     * Set the calldata.
     */
    public SafeTransactionBuilder data(byte[] data) {
        if (data != null) {
            this.data = data.clone();
        }
        return this;
    }

    /**
     * Set the operation type.
     */
    public SafeTransactionBuilder operation(OperationType operation) {
        this.operation = operation;
        return this;
    }

    /**
     * Set operation to delegate call.
     */
    public SafeTransactionBuilder delegateCall() {
        this.operation = OperationType.DELEGATE_CALL;
        return this;
    }

    /**
     * Set the Safe transaction gas.
     */
    public SafeTransactionBuilder safeTxGas(BigInteger gas) {
        if (gas != null) {
            this.safeTxGas = gas;
        }
        return this;
    }

    /**
     * Set the base gas.
     */
    public SafeTransactionBuilder baseGas(BigInteger gas) {
        if (gas != null) {
            this.baseGas = gas;
        }
        return this;
    }

    /**
     * Set the gas price for refund.
     */
    public SafeTransactionBuilder gasPrice(BigInteger price) {
        if (price != null) {
            this.gasPrice = price;
        }
        return this;
    }

    /**
     * Set the token for gas refund (zero address for ETH).
     */
    public SafeTransactionBuilder gasToken(String token) {
        this.gasToken = token;
        return this;
    }

    /**
     * Set the address to receive gas refund.
     */
    public SafeTransactionBuilder refundReceiver(String receiver) {
        this.refundReceiver = receiver;
        return this;
    }

    /**
     * Set the Safe nonce.
     */
    public SafeTransactionBuilder nonce(BigInteger nonce) {
        this.nonce = nonce;
        return this;
    }

    /**
     * Build the SafeTransaction.
     */
    public SafeTransaction build() {
        return new SafeTransaction(
                to,
                value,
                data,
                operation,
                safeTxGas,
                baseGas,
                gasPrice,
                gasToken,
                refundReceiver,
                nonce
        );
    }

    /**
     * Create a transaction for ERC20 token transfer.
     *
     * @param token  Token contract address
     * @param to     Recipient address
     * @param amount Amount in smallest units
     * @return SafeTransaction for the transfer
     */
    public static SafeTransaction erc20Transfer(String token, String to, BigInteger amount) {
        // Build calldata: transfer(address,uint256)
        byte[] toBytes = hexToBytes(to.substring(2));
        byte[] amountBytes = padTo32Bytes(amount.toByteArray());

        byte[] data = new byte[4 + 32 + 32];
        System.arraycopy(SafeConstants.ERC20_TRANSFER_SELECTOR, 0, data, 0, 4);
        // Pad address to 32 bytes (left-padded)
        System.arraycopy(toBytes, 0, data, 4 + 12, 20);
        System.arraycopy(amountBytes, 0, data, 4 + 32, 32);

        return new SafeTransactionBuilder()
                .to(token)
                .data(data)
                .build();
    }

    /**
     * Create a transaction for sending ETH.
     *
     * @param to     Recipient address
     * @param amount Amount in wei
     * @return SafeTransaction for the transfer
     */
    public static SafeTransaction ethTransfer(String to, BigInteger amount) {
        return new SafeTransactionBuilder()
                .to(to)
                .value(amount)
                .build();
    }

    /**
     * Create a transaction for calling a contract.
     *
     * @param target Target contract address
     * @param data   Calldata
     * @return SafeTransaction for the call
     */
    public static SafeTransaction contractCall(String target, byte[] data) {
        return new SafeTransactionBuilder()
                .to(target)
                .data(data)
                .build();
    }

    /**
     * Batch transaction builder for MultiSend.
     */
    public static class BatchBuilder {
        private final List<SafeTransaction> transactions = new ArrayList<>();

        /**
         * Add a transaction to the batch.
         */
        public BatchBuilder add(SafeTransaction tx) {
            transactions.add(tx);
            return this;
        }

        /**
         * Add an ERC20 transfer to the batch.
         */
        public BatchBuilder addTransfer(String token, String to, BigInteger amount) {
            return add(erc20Transfer(token, to, amount));
        }

        /**
         * Add an ETH transfer to the batch.
         */
        public BatchBuilder addEthTransfer(String to, BigInteger amount) {
            return add(ethTransfer(to, amount));
        }

        /**
         * Get all transactions in the batch.
         */
        public List<SafeTransaction> build() {
            return new ArrayList<>(transactions);
        }

        /**
         * Build a single transaction that executes all batch transactions via MultiSend.
         */
        public SafeTransaction buildMultiSend() {
            // Pack transactions for MultiSend
            ByteArrayOutputStream packedTxs = new ByteArrayOutputStream();

            for (SafeTransaction tx : transactions) {
                // Operation (1 byte)
                packedTxs.write(tx.getOperation().getValue());

                // To (20 bytes)
                byte[] toBytes = hexToBytes(tx.getTo().substring(2));
                packedTxs.write(toBytes, 0, 20);

                // Value (32 bytes)
                byte[] valueBytes = padTo32Bytes(tx.getValue().toByteArray());
                packedTxs.write(valueBytes, 0, 32);

                // Data length (32 bytes)
                byte[] dataLenBytes = padTo32Bytes(
                        BigInteger.valueOf(tx.getData().length).toByteArray());
                packedTxs.write(dataLenBytes, 0, 32);

                // Data
                byte[] data = tx.getData();
                if (data.length > 0) {
                    packedTxs.write(data, 0, data.length);
                }
            }

            byte[] packed = packedTxs.toByteArray();

            // Build MultiSend calldata
            // multiSend(bytes transactions)
            ByteArrayOutputStream calldata = new ByteArrayOutputStream();

            // Selector
            calldata.write(SafeConstants.MULTISEND_SELECTOR, 0, 4);

            // Offset (32 bytes) - points to data
            byte[] offset = padTo32Bytes(BigInteger.valueOf(32).toByteArray());
            calldata.write(offset, 0, 32);

            // Length (32 bytes)
            byte[] length = padTo32Bytes(BigInteger.valueOf(packed.length).toByteArray());
            calldata.write(length, 0, 32);

            // Data (padded to 32-byte boundary)
            calldata.write(packed, 0, packed.length);
            int padding = (32 - (packed.length % 32)) % 32;
            for (int i = 0; i < padding; i++) {
                calldata.write(0);
            }

            return new SafeTransactionBuilder()
                    .to(SafeConstants.SAFE_MULTISEND)
                    .data(calldata.toByteArray())
                    .delegateCall()
                    .build();
        }
    }

    /**
     * Create a new batch builder.
     */
    public static BatchBuilder batch() {
        return new BatchBuilder();
    }

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

    /**
     * Pad byte array to 32 bytes (left-padded with zeros).
     */
    private static byte[] padTo32Bytes(byte[] data) {
        if (data.length >= 32) {
            return Arrays.copyOfRange(data, data.length - 32, data.length);
        }
        byte[] padded = new byte[32];
        System.arraycopy(data, 0, padded, 32 - data.length, data.length);
        return padded;
    }
}
