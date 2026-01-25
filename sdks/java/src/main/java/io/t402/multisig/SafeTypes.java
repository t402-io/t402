package io.t402.multisig;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Types for Safe multi-sig smart account operations.
 */
public final class SafeTypes {

    private SafeTypes() {
        // Utility class
    }

    /**
     * Signature type for Safe transactions.
     */
    public enum SignatureType {
        /** Standard EOA signature */
        EOA(0),
        /** EIP-1271 contract signature */
        CONTRACT(1),
        /** Pre-approved hash */
        APPROVED_HASH(4);

        private final int value;

        SignatureType(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }

    /**
     * Operation type for Safe transactions.
     */
    public enum OperationType {
        /** Regular call */
        CALL(0),
        /** Delegate call */
        DELEGATE_CALL(1);

        private final int value;

        OperationType(int value) {
            this.value = value;
        }

        public int getValue() {
            return value;
        }
    }

    /**
     * Configuration for a Safe multi-sig account.
     */
    public static class SafeConfig {
        private final String address;
        private final String rpcUrl;
        private final Long chainId;

        public SafeConfig(String address, String rpcUrl) {
            this(address, rpcUrl, null);
        }

        public SafeConfig(String address, String rpcUrl, Long chainId) {
            this.address = address;
            this.rpcUrl = rpcUrl;
            this.chainId = chainId;
        }

        public String getAddress() {
            return address;
        }

        public String getRpcUrl() {
            return rpcUrl;
        }

        public Long getChainId() {
            return chainId;
        }
    }

    /**
     * Represents an owner of a Safe account.
     */
    public static class SafeOwner {
        private final String address;
        private final int index;

        public SafeOwner(String address, int index) {
            this.address = address;
            this.index = index;
        }

        public String getAddress() {
            return address;
        }

        public int getIndex() {
            return index;
        }
    }

    /**
     * Represents a Safe transaction.
     */
    public static class SafeTransaction {
        private final String to;
        private final BigInteger value;
        private final byte[] data;
        private final OperationType operation;
        private final BigInteger safeTxGas;
        private final BigInteger baseGas;
        private final BigInteger gasPrice;
        private final String gasToken;
        private final String refundReceiver;
        private BigInteger nonce;

        public SafeTransaction(String to) {
            this(to, BigInteger.ZERO, new byte[0], OperationType.CALL,
                    BigInteger.ZERO, BigInteger.ZERO, BigInteger.ZERO,
                    "0x0000000000000000000000000000000000000000",
                    "0x0000000000000000000000000000000000000000",
                    null);
        }

        public SafeTransaction(
                String to,
                BigInteger value,
                byte[] data,
                OperationType operation,
                BigInteger safeTxGas,
                BigInteger baseGas,
                BigInteger gasPrice,
                String gasToken,
                String refundReceiver,
                BigInteger nonce) {
            this.to = to;
            this.value = value;
            this.data = data != null ? data.clone() : new byte[0];
            this.operation = operation;
            this.safeTxGas = safeTxGas;
            this.baseGas = baseGas;
            this.gasPrice = gasPrice;
            this.gasToken = gasToken;
            this.refundReceiver = refundReceiver;
            this.nonce = nonce;
        }

        public String getTo() {
            return to;
        }

        public BigInteger getValue() {
            return value;
        }

        public byte[] getData() {
            return data.clone();
        }

        public OperationType getOperation() {
            return operation;
        }

        public BigInteger getSafeTxGas() {
            return safeTxGas;
        }

        public BigInteger getBaseGas() {
            return baseGas;
        }

        public BigInteger getGasPrice() {
            return gasPrice;
        }

        public String getGasToken() {
            return gasToken;
        }

        public String getRefundReceiver() {
            return refundReceiver;
        }

        public BigInteger getNonce() {
            return nonce;
        }

        public void setNonce(BigInteger nonce) {
            this.nonce = nonce;
        }
    }

    /**
     * Holds a signature from a Safe owner.
     */
    public static class SafeSignature {
        private final String signer;
        private final byte[] signature;
        private final SignatureType signatureType;

        public SafeSignature(String signer, byte[] signature) {
            this(signer, signature, SignatureType.EOA);
        }

        public SafeSignature(String signer, byte[] signature, SignatureType signatureType) {
            this.signer = signer;
            this.signature = signature != null ? signature.clone() : new byte[0];
            this.signatureType = signatureType;
        }

        public String getSigner() {
            return signer;
        }

        public byte[] getSignature() {
            return signature.clone();
        }

        public SignatureType getSignatureType() {
            return signatureType;
        }
    }

    /**
     * Represents a multi-sig transaction awaiting signatures.
     */
    public static class TransactionRequest {
        private final String id;
        private final String safeAddress;
        private final SafeTransaction transaction;
        private final String transactionHash;
        private final Map<String, SafeSignature> signatures;
        private final int threshold;
        private final long createdAt;
        private final long expiresAt;

        public TransactionRequest(
                String id,
                String safeAddress,
                SafeTransaction transaction,
                String transactionHash,
                int threshold,
                long createdAt,
                long expiresAt) {
            this.id = id;
            this.safeAddress = safeAddress;
            this.transaction = transaction;
            this.transactionHash = transactionHash;
            this.signatures = new HashMap<>();
            this.threshold = threshold;
            this.createdAt = createdAt;
            this.expiresAt = expiresAt;
        }

        public String getId() {
            return id;
        }

        public String getSafeAddress() {
            return safeAddress;
        }

        public SafeTransaction getTransaction() {
            return transaction;
        }

        public String getTransactionHash() {
            return transactionHash;
        }

        public Map<String, SafeSignature> getSignatures() {
            return signatures;
        }

        public int getThreshold() {
            return threshold;
        }

        public long getCreatedAt() {
            return createdAt;
        }

        public long getExpiresAt() {
            return expiresAt;
        }

        /**
         * Check if enough signatures have been collected.
         */
        public boolean isReady() {
            return signatures.size() >= threshold;
        }

        /**
         * Get the number of signatures collected.
         */
        public int getCollectedCount() {
            return signatures.size();
        }

        /**
         * Add a signature.
         */
        public void addSignature(SafeSignature signature) {
            signatures.put(signature.getSigner().toLowerCase(), signature);
        }
    }

    /**
     * Information about a Safe account.
     */
    public static class SafeInfo {
        private final String address;
        private final List<String> owners;
        private final int threshold;
        private final BigInteger nonce;
        private final String version;
        private final Long chainId;

        public SafeInfo(
                String address,
                List<String> owners,
                int threshold,
                BigInteger nonce,
                String version,
                Long chainId) {
            this.address = address;
            this.owners = owners;
            this.threshold = threshold;
            this.nonce = nonce;
            this.version = version;
            this.chainId = chainId;
        }

        public String getAddress() {
            return address;
        }

        public List<String> getOwners() {
            return owners;
        }

        public int getThreshold() {
            return threshold;
        }

        public BigInteger getNonce() {
            return nonce;
        }

        public String getVersion() {
            return version;
        }

        public Long getChainId() {
            return chainId;
        }
    }

    /**
     * Result of executing a Safe transaction.
     */
    public static class ExecutionResult {
        private final String txHash;
        private final boolean success;
        private final long gasUsed;
        private final long blockNumber;

        public ExecutionResult(String txHash, boolean success) {
            this(txHash, success, 0, 0);
        }

        public ExecutionResult(String txHash, boolean success, long gasUsed, long blockNumber) {
            this.txHash = txHash;
            this.success = success;
            this.gasUsed = gasUsed;
            this.blockNumber = blockNumber;
        }

        public String getTxHash() {
            return txHash;
        }

        public boolean isSuccess() {
            return success;
        }

        public long getGasUsed() {
            return gasUsed;
        }

        public long getBlockNumber() {
            return blockNumber;
        }
    }
}
