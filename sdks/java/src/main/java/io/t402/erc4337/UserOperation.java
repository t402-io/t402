package io.t402.erc4337;

import java.math.BigInteger;
import java.nio.ByteBuffer;

import org.web3j.crypto.Hash;
import org.web3j.utils.Numeric;

/**
 * ERC-4337 UserOperation structure (v0.7).
 *
 * <p>Represents a transaction intent that can be executed by a smart contract wallet
 * through the EntryPoint contract.
 *
 * <h3>v0.7 Changes</h3>
 * <ul>
 *   <li>initCode split into factory + factoryData</li>
 *   <li>paymasterAndData split into paymaster + paymasterVerificationGasLimit +
 *       paymasterPostOpGasLimit + paymasterData</li>
 *   <li>accountGasLimits packs verificationGasLimit + callGasLimit</li>
 *   <li>gasFees packs maxPriorityFeePerGas + maxFeePerGas</li>
 * </ul>
 *
 * @see <a href="https://eips.ethereum.org/EIPS/eip-4337">EIP-4337</a>
 */
public class UserOperation {

    /** EntryPoint v0.7 address (same on all chains). */
    public static final String ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

    private final String sender;
    private final BigInteger nonce;
    private final String factory;
    private final String factoryData;
    private final String callData;
    private final BigInteger verificationGasLimit;
    private final BigInteger callGasLimit;
    private final BigInteger preVerificationGas;
    private final BigInteger maxPriorityFeePerGas;
    private final BigInteger maxFeePerGas;
    private final String paymaster;
    private final BigInteger paymasterVerificationGasLimit;
    private final BigInteger paymasterPostOpGasLimit;
    private final String paymasterData;
    private final String signature;

    private UserOperation(Builder builder) {
        this.sender = builder.sender;
        this.nonce = builder.nonce;
        this.factory = builder.factory;
        this.factoryData = builder.factoryData;
        this.callData = builder.callData;
        this.verificationGasLimit = builder.verificationGasLimit;
        this.callGasLimit = builder.callGasLimit;
        this.preVerificationGas = builder.preVerificationGas;
        this.maxPriorityFeePerGas = builder.maxPriorityFeePerGas;
        this.maxFeePerGas = builder.maxFeePerGas;
        this.paymaster = builder.paymaster;
        this.paymasterVerificationGasLimit = builder.paymasterVerificationGasLimit;
        this.paymasterPostOpGasLimit = builder.paymasterPostOpGasLimit;
        this.paymasterData = builder.paymasterData;
        this.signature = builder.signature;
    }

    public String getSender() {
        return sender;
    }

    public BigInteger getNonce() {
        return nonce;
    }

    public String getFactory() {
        return factory;
    }

    public String getFactoryData() {
        return factoryData;
    }

    /**
     * Gets initCode for backward compatibility.
     * Combines factory + factoryData.
     */
    public String getInitCode() {
        if (factory == null || factory.equals("0x") || factory.isEmpty()) {
            return "0x";
        }
        // If factory is a full address (42 chars), combine with factoryData
        if (factory.length() >= 42) {
            String data = factoryData != null && !factoryData.equals("0x") ? factoryData.substring(2) : "";
            return factory + data;
        }
        // Short factory (backward compatibility) - return as-is
        return factory;
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

    public String getPaymaster() {
        return paymaster;
    }

    public BigInteger getPaymasterVerificationGasLimit() {
        return paymasterVerificationGasLimit;
    }

    public BigInteger getPaymasterPostOpGasLimit() {
        return paymasterPostOpGasLimit;
    }

    public String getPaymasterData() {
        return paymasterData;
    }

    /**
     * Gets paymasterAndData for backward compatibility.
     * Combines paymaster + gas limits + data.
     */
    public String getPaymasterAndData() {
        if (paymaster == null || paymaster.equals("0x") || paymaster.isEmpty()) {
            return "0x";
        }
        // If paymaster is a full address (42 chars), use v0.7 format
        if (paymaster.length() >= 42) {
            // Format: paymaster (20 bytes) + verificationGasLimit (16 bytes) + postOpGasLimit (16 bytes) + data
            StringBuilder sb = new StringBuilder();
            sb.append(paymaster.substring(2)); // Remove 0x
            sb.append(padHex(paymasterVerificationGasLimit, 32));
            sb.append(padHex(paymasterPostOpGasLimit, 32));
            if (paymasterData != null && !paymasterData.equals("0x")) {
                sb.append(paymasterData.substring(2));
            }
            return "0x" + sb.toString();
        }
        // Short paymaster (backward compatibility) - return as-is
        return paymaster;
    }

    public String getSignature() {
        return signature;
    }

    /**
     * Computes the UserOperation hash for signing.
     *
     * @param entryPoint EntryPoint contract address
     * @param chainId Chain ID
     * @return UserOperation hash (32 bytes)
     */
    public byte[] getUserOpHash(String entryPoint, long chainId) {
        // Pack UserOperation for hashing (excluding signature)
        byte[] packed = packForHash();
        byte[] userOpHash = Hash.sha3(packed);

        // Final hash: keccak256(userOpHash, entryPoint, chainId)
        ByteBuffer buffer = ByteBuffer.allocate(32 + 32 + 32);
        buffer.put(userOpHash);
        buffer.put(Numeric.toBytesPadded(new BigInteger(entryPoint.substring(2), 16), 32));
        buffer.put(Numeric.toBytesPadded(BigInteger.valueOf(chainId), 32));

        return Hash.sha3(buffer.array());
    }

    /**
     * Computes the UserOperation hash using default EntryPoint v0.7.
     */
    public byte[] getUserOpHash(long chainId) {
        return getUserOpHash(ENTRYPOINT_V07, chainId);
    }

    /**
     * Packs the UserOperation for v0.7 RPC format.
     */
    public PackedUserOperation pack() {
        return new PackedUserOperation(
            sender,
            nonce,
            getInitCode(),
            callData,
            packAccountGasLimits(),
            preVerificationGas,
            packGasFees(),
            getPaymasterAndData(),
            signature
        );
    }

    /**
     * Creates a new builder with copied values from this UserOperation.
     */
    public Builder toBuilder() {
        return new Builder()
            .sender(sender)
            .nonce(nonce)
            .factory(factory)
            .factoryData(factoryData)
            .callData(callData)
            .verificationGasLimit(verificationGasLimit)
            .callGasLimit(callGasLimit)
            .preVerificationGas(preVerificationGas)
            .maxPriorityFeePerGas(maxPriorityFeePerGas)
            .maxFeePerGas(maxFeePerGas)
            .paymaster(paymaster)
            .paymasterVerificationGasLimit(paymasterVerificationGasLimit)
            .paymasterPostOpGasLimit(paymasterPostOpGasLimit)
            .paymasterData(paymasterData)
            .signature(signature);
    }

    // Internal helpers

    private byte[] packForHash() {
        // Pack: sender, nonce, initCodeHash, callDataHash, accountGasLimits,
        //       preVerificationGas, gasFees, paymasterAndDataHash
        ByteBuffer buffer = ByteBuffer.allocate(32 * 8);

        // sender (address -> 32 bytes)
        buffer.put(Numeric.toBytesPadded(new BigInteger(sender.substring(2), 16), 32));

        // nonce
        buffer.put(Numeric.toBytesPadded(nonce, 32));

        // keccak256(initCode)
        buffer.put(Hash.sha3(Numeric.hexStringToByteArray(getInitCode())));

        // keccak256(callData)
        buffer.put(Hash.sha3(Numeric.hexStringToByteArray(callData)));

        // accountGasLimits
        buffer.put(Numeric.hexStringToByteArray(packAccountGasLimits()));

        // preVerificationGas
        buffer.put(Numeric.toBytesPadded(preVerificationGas, 32));

        // gasFees
        buffer.put(Numeric.hexStringToByteArray(packGasFees()));

        // keccak256(paymasterAndData)
        buffer.put(Hash.sha3(Numeric.hexStringToByteArray(getPaymasterAndData())));

        return buffer.array();
    }

    private String packAccountGasLimits() {
        // verificationGasLimit (16 bytes) + callGasLimit (16 bytes)
        return "0x" + padHex(verificationGasLimit, 32) + padHex(callGasLimit, 32);
    }

    private String packGasFees() {
        // maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
        return "0x" + padHex(maxPriorityFeePerGas, 32) + padHex(maxFeePerGas, 32);
    }

    private static String padHex(BigInteger value, int length) {
        String hex = value.toString(16);
        while (hex.length() < length) {
            hex = "0" + hex;
        }
        return hex;
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
        private String factory;
        private String factoryData = "0x";
        private String callData = "0x";
        private BigInteger verificationGasLimit = BigInteger.valueOf(200000);
        private BigInteger callGasLimit = BigInteger.valueOf(100000);
        private BigInteger preVerificationGas = BigInteger.valueOf(50000);
        private BigInteger maxPriorityFeePerGas = BigInteger.valueOf(1500000000L); // 1.5 gwei
        private BigInteger maxFeePerGas = BigInteger.valueOf(30000000000L); // 30 gwei
        private String paymaster;
        private BigInteger paymasterVerificationGasLimit = BigInteger.valueOf(100000);
        private BigInteger paymasterPostOpGasLimit = BigInteger.valueOf(50000);
        private String paymasterData = "0x";
        private String signature = "0x";

        public Builder sender(String sender) {
            this.sender = sender;
            return this;
        }

        public Builder nonce(BigInteger nonce) {
            this.nonce = nonce;
            return this;
        }

        public Builder factory(String factory) {
            this.factory = factory;
            return this;
        }

        public Builder factoryData(String factoryData) {
            this.factoryData = factoryData;
            return this;
        }

        /**
         * Sets initCode for backward compatibility.
         * Splits into factory (first 20 bytes) + factoryData (rest).
         */
        public Builder initCode(String initCode) {
            if (initCode == null || initCode.equals("0x") || initCode.isEmpty()) {
                this.factory = null;
                this.factoryData = "0x";
            } else if (initCode.length() < 42) {
                // Short initCode - treat entire value as factory with empty data
                // This preserves backward compatibility for test cases
                this.factory = initCode;
                this.factoryData = "0x";
            } else {
                this.factory = "0x" + initCode.substring(2, 42);
                this.factoryData = initCode.length() > 42 ? "0x" + initCode.substring(42) : "0x";
            }
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

        public Builder paymaster(String paymaster) {
            this.paymaster = paymaster;
            return this;
        }

        public Builder paymasterVerificationGasLimit(BigInteger limit) {
            this.paymasterVerificationGasLimit = limit;
            return this;
        }

        public Builder paymasterPostOpGasLimit(BigInteger limit) {
            this.paymasterPostOpGasLimit = limit;
            return this;
        }

        public Builder paymasterData(String paymasterData) {
            this.paymasterData = paymasterData;
            return this;
        }

        /**
         * Sets paymasterAndData for backward compatibility.
         * Splits into paymaster + gas limits + data.
         */
        public Builder paymasterAndData(String paymasterAndData) {
            if (paymasterAndData == null || paymasterAndData.equals("0x") || paymasterAndData.isEmpty()) {
                this.paymaster = null;
                this.paymasterVerificationGasLimit = BigInteger.valueOf(100000);
                this.paymasterPostOpGasLimit = BigInteger.valueOf(50000);
                this.paymasterData = "0x";
            } else if (paymasterAndData.length() < 42) {
                // Short paymasterAndData - treat entire value as paymaster (backward compatibility)
                this.paymaster = paymasterAndData;
                this.paymasterVerificationGasLimit = BigInteger.valueOf(100000);
                this.paymasterPostOpGasLimit = BigInteger.valueOf(50000);
                this.paymasterData = "0x";
            } else {
                String hex = paymasterAndData.substring(2);
                this.paymaster = "0x" + hex.substring(0, 40);
                if (hex.length() >= 104) {
                    this.paymasterVerificationGasLimit = new BigInteger(hex.substring(40, 72), 16);
                    this.paymasterPostOpGasLimit = new BigInteger(hex.substring(72, 104), 16);
                    this.paymasterData = hex.length() > 104 ? "0x" + hex.substring(104) : "0x";
                } else {
                    // Legacy format without gas limits
                    this.paymasterVerificationGasLimit = BigInteger.valueOf(100000);
                    this.paymasterPostOpGasLimit = BigInteger.valueOf(50000);
                    this.paymasterData = hex.length() > 40 ? "0x" + hex.substring(40) : "0x";
                }
            }
            return this;
        }

        public Builder signature(String signature) {
            this.signature = signature;
            return this;
        }

        /**
         * Applies gas estimates to this builder.
         */
        public Builder gasEstimate(GasEstimate estimate) {
            this.verificationGasLimit = estimate.getVerificationGasLimit();
            this.callGasLimit = estimate.getCallGasLimit();
            this.preVerificationGas = estimate.getPreVerificationGas();
            if (estimate.getPaymasterVerificationGasLimit() != null) {
                this.paymasterVerificationGasLimit = estimate.getPaymasterVerificationGasLimit();
            }
            if (estimate.getPaymasterPostOpGasLimit() != null) {
                this.paymasterPostOpGasLimit = estimate.getPaymasterPostOpGasLimit();
            }
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

    /**
     * Packed UserOperation for v0.7 RPC format.
     */
    public static class PackedUserOperation {
        public final String sender;
        public final BigInteger nonce;
        public final String initCode;
        public final String callData;
        public final String accountGasLimits;
        public final BigInteger preVerificationGas;
        public final String gasFees;
        public final String paymasterAndData;
        public final String signature;

        public PackedUserOperation(
                String sender,
                BigInteger nonce,
                String initCode,
                String callData,
                String accountGasLimits,
                BigInteger preVerificationGas,
                String gasFees,
                String paymasterAndData,
                String signature) {
            this.sender = sender;
            this.nonce = nonce;
            this.initCode = initCode;
            this.callData = callData;
            this.accountGasLimits = accountGasLimits;
            this.preVerificationGas = preVerificationGas;
            this.gasFees = gasFees;
            this.paymasterAndData = paymasterAndData;
            this.signature = signature;
        }
    }
}
