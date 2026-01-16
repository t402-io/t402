package io.t402.erc4337;

import java.math.BigInteger;

/**
 * Paymaster data for gas sponsorship.
 */
public class PaymasterData {

    private final String paymaster;
    private final BigInteger paymasterVerificationGasLimit;
    private final BigInteger paymasterPostOpGasLimit;
    private final String paymasterData;

    public PaymasterData(
            String paymaster,
            BigInteger paymasterVerificationGasLimit,
            BigInteger paymasterPostOpGasLimit,
            String paymasterData) {
        this.paymaster = paymaster;
        this.paymasterVerificationGasLimit = paymasterVerificationGasLimit;
        this.paymasterPostOpGasLimit = paymasterPostOpGasLimit;
        this.paymasterData = paymasterData;
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
     * Encodes paymaster data for inclusion in UserOperation.
     * Format: paymaster (20 bytes) + verification gas (16 bytes) + postOp gas (16 bytes) + data
     */
    public String encode() {
        StringBuilder sb = new StringBuilder();

        // Remove 0x prefix and pad to 40 chars (20 bytes)
        String addr = paymaster.startsWith("0x") ? paymaster.substring(2) : paymaster;
        sb.append(addr.toLowerCase());

        // Pad gas values to 32 chars (16 bytes)
        sb.append(padHex(paymasterVerificationGasLimit, 32));
        sb.append(padHex(paymasterPostOpGasLimit, 32));

        // Append paymaster data (without 0x prefix)
        if (paymasterData != null && !paymasterData.equals("0x")) {
            String data = paymasterData.startsWith("0x") ? paymasterData.substring(2) : paymasterData;
            sb.append(data);
        }

        return "0x" + sb.toString();
    }

    /**
     * Decodes paymaster and data from a hex string.
     */
    public static PaymasterData decode(String paymasterAndData) {
        if (paymasterAndData == null || paymasterAndData.equals("0x") || paymasterAndData.length() < 106) {
            return null;
        }

        String hex = paymasterAndData.startsWith("0x") ? paymasterAndData.substring(2) : paymasterAndData;

        // 20 bytes address + 16 bytes verification gas + 16 bytes postOp gas = 52 bytes = 104 hex chars
        String paymaster = "0x" + hex.substring(0, 40);
        BigInteger verificationGas = new BigInteger(hex.substring(40, 72), 16);
        BigInteger postOpGas = new BigInteger(hex.substring(72, 104), 16);
        String data = hex.length() > 104 ? "0x" + hex.substring(104) : "0x";

        return new PaymasterData(paymaster, verificationGas, postOpGas, data);
    }

    private static String padHex(BigInteger value, int length) {
        String hex = value.toString(16);
        while (hex.length() < length) {
            hex = "0" + hex;
        }
        return hex;
    }
}
