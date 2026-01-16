package io.t402.erc4337;

import java.math.BigInteger;

/**
 * Gas estimate for a UserOperation.
 *
 * <p>Contains all gas-related values needed for a UserOperation.
 */
public class GasEstimate {

    private final BigInteger verificationGasLimit;
    private final BigInteger callGasLimit;
    private final BigInteger preVerificationGas;
    private final BigInteger paymasterVerificationGasLimit;
    private final BigInteger paymasterPostOpGasLimit;

    /**
     * Creates a new gas estimate.
     *
     * @param verificationGasLimit Gas for verification
     * @param callGasLimit Gas for call execution
     * @param preVerificationGas Pre-verification gas
     */
    public GasEstimate(
            BigInteger verificationGasLimit,
            BigInteger callGasLimit,
            BigInteger preVerificationGas) {
        this(verificationGasLimit, callGasLimit, preVerificationGas, null, null);
    }

    /**
     * Creates a new gas estimate with paymaster gas.
     *
     * @param verificationGasLimit Gas for verification
     * @param callGasLimit Gas for call execution
     * @param preVerificationGas Pre-verification gas
     * @param paymasterVerificationGasLimit Gas for paymaster verification
     * @param paymasterPostOpGasLimit Gas for paymaster post-op
     */
    public GasEstimate(
            BigInteger verificationGasLimit,
            BigInteger callGasLimit,
            BigInteger preVerificationGas,
            BigInteger paymasterVerificationGasLimit,
            BigInteger paymasterPostOpGasLimit) {
        this.verificationGasLimit = verificationGasLimit;
        this.callGasLimit = callGasLimit;
        this.preVerificationGas = preVerificationGas;
        this.paymasterVerificationGasLimit = paymasterVerificationGasLimit;
        this.paymasterPostOpGasLimit = paymasterPostOpGasLimit;
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

    public BigInteger getPaymasterVerificationGasLimit() {
        return paymasterVerificationGasLimit;
    }

    public BigInteger getPaymasterPostOpGasLimit() {
        return paymasterPostOpGasLimit;
    }

    /**
     * Creates default gas estimate.
     */
    public static GasEstimate defaults() {
        return new GasEstimate(
            BigInteger.valueOf(200000),
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000),
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000)
        );
    }
}
