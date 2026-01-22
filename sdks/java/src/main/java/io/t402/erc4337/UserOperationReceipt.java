package io.t402.erc4337;

import java.math.BigInteger;

/**
 * Receipt for a confirmed UserOperation.
 */
public class UserOperationReceipt {

    private final String userOpHash;
    private final String sender;
    private final BigInteger nonce;
    private final String paymaster;
    private final BigInteger actualGasCost;
    private final BigInteger actualGasUsed;
    private final boolean success;
    private final String reason;
    private final String transactionHash;
    private final BigInteger blockNumber;
    private final String blockHash;

    public UserOperationReceipt(
            String userOpHash,
            String sender,
            BigInteger nonce,
            String paymaster,
            BigInteger actualGasCost,
            BigInteger actualGasUsed,
            boolean success,
            String reason,
            String transactionHash,
            BigInteger blockNumber,
            String blockHash) {
        this.userOpHash = userOpHash;
        this.sender = sender;
        this.nonce = nonce;
        this.paymaster = paymaster;
        this.actualGasCost = actualGasCost;
        this.actualGasUsed = actualGasUsed;
        this.success = success;
        this.reason = reason;
        this.transactionHash = transactionHash;
        this.blockNumber = blockNumber;
        this.blockHash = blockHash;
    }

    public String getUserOpHash() {
        return userOpHash;
    }

    public String getSender() {
        return sender;
    }

    public BigInteger getNonce() {
        return nonce;
    }

    public String getPaymaster() {
        return paymaster;
    }

    public BigInteger getActualGasCost() {
        return actualGasCost;
    }

    public BigInteger getActualGasUsed() {
        return actualGasUsed;
    }

    public boolean isSuccess() {
        return success;
    }

    public String getReason() {
        return reason;
    }

    public String getTransactionHash() {
        return transactionHash;
    }

    public BigInteger getBlockNumber() {
        return blockNumber;
    }

    public String getBlockHash() {
        return blockHash;
    }
}
