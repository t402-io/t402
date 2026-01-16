package io.t402.erc4337;

import java.math.BigInteger;

/**
 * ERC-4337 UserOperation structure (v0.7).
 *
 * <p>Represents a transaction intent that can be executed by a smart contract wallet
 * through the EntryPoint contract.
 */
public class UserOperation {

    private final String sender;
    private final BigInteger nonce;
    private final String initCode;
    private final String callData;
    private final BigInteger verificationGasLimit;
    private final BigInteger callGasLimit;
    private final BigInteger preVerificationGas;
    private final BigInteger maxPriorityFeePerGas;
    private final BigInteger maxFeePerGas;
    private final String paymasterAndData;
    private final String signature;

    private UserOperation(Builder builder) {
        this.sender = builder.sender;
        this.nonce = builder.nonce;
        this.initCode = builder.initCode;
        this.callData = builder.callData;
        this.verificationGasLimit = builder.verificationGasLimit;
        this.callGasLimit = builder.callGasLimit;
        this.preVerificationGas = builder.preVerificationGas;
        this.maxPriorityFeePerGas = builder.maxPriorityFeePerGas;
        this.maxFeePerGas = builder.maxFeePerGas;
        this.paymasterAndData = builder.paymasterAndData;
        this.signature = builder.signature;
    }

    public String getSender() {
        return sender;
    }

    public BigInteger getNonce() {
        return nonce;
    }

    public String getInitCode() {
        return initCode;
    }

    public String getCallData() {
        return callData;
    }

    public BigInteger getVerificationGasLimit() {
        return verificationGasLimit;
    }

    public BigInteger getCallGasLimit() {
        return callGasLimit;
    }

    public BigInteger getPreVerificationGas() {
        return preVerificationGas;
    }

    public BigInteger getMaxPriorityFeePerGas() {
        return maxPriorityFeePerGas;
    }

    public BigInteger getMaxFeePerGas() {
        return maxFeePerGas;
    }

    public String getPaymasterAndData() {
        return paymasterAndData;
    }

    public String getSignature() {
        return signature;
    }

    /**
     * Creates a new builder with copied values from this UserOperation.
     */
    public Builder toBuilder() {
        return new Builder()
            .sender(sender)
            .nonce(nonce)
            .initCode(initCode)
            .callData(callData)
            .verificationGasLimit(verificationGasLimit)
            .callGasLimit(callGasLimit)
            .preVerificationGas(preVerificationGas)
            .maxPriorityFeePerGas(maxPriorityFeePerGas)
            .maxFeePerGas(maxFeePerGas)
            .paymasterAndData(paymasterAndData)
            .signature(signature);
    }

    /**
     * Creates a new builder for UserOperation.
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for UserOperation.
     */
    public static class Builder {
        private String sender;
        private BigInteger nonce = BigInteger.ZERO;
        private String initCode = "0x";
        private String callData = "0x";
        private BigInteger verificationGasLimit = BigInteger.valueOf(200000);
        private BigInteger callGasLimit = BigInteger.valueOf(100000);
        private BigInteger preVerificationGas = BigInteger.valueOf(50000);
        private BigInteger maxPriorityFeePerGas = BigInteger.valueOf(1500000000L); // 1.5 gwei
        private BigInteger maxFeePerGas = BigInteger.valueOf(30000000000L); // 30 gwei
        private String paymasterAndData = "0x";
        private String signature = "0x";

        public Builder sender(String sender) {
            this.sender = sender;
            return this;
        }

        public Builder nonce(BigInteger nonce) {
            this.nonce = nonce;
            return this;
        }

        public Builder initCode(String initCode) {
            this.initCode = initCode;
            return this;
        }

        public Builder callData(String callData) {
            this.callData = callData;
            return this;
        }

        public Builder verificationGasLimit(BigInteger verificationGasLimit) {
            this.verificationGasLimit = verificationGasLimit;
            return this;
        }

        public Builder callGasLimit(BigInteger callGasLimit) {
            this.callGasLimit = callGasLimit;
            return this;
        }

        public Builder preVerificationGas(BigInteger preVerificationGas) {
            this.preVerificationGas = preVerificationGas;
            return this;
        }

        public Builder maxPriorityFeePerGas(BigInteger maxPriorityFeePerGas) {
            this.maxPriorityFeePerGas = maxPriorityFeePerGas;
            return this;
        }

        public Builder maxFeePerGas(BigInteger maxFeePerGas) {
            this.maxFeePerGas = maxFeePerGas;
            return this;
        }

        public Builder paymasterAndData(String paymasterAndData) {
            this.paymasterAndData = paymasterAndData;
            return this;
        }

        public Builder signature(String signature) {
            this.signature = signature;
            return this;
        }

        public UserOperation build() {
            if (sender == null || sender.isEmpty()) {
                throw new IllegalArgumentException("sender is required");
            }
            if (callData == null) {
                throw new IllegalArgumentException("callData is required");
            }
            return new UserOperation(this);
        }
    }
}
