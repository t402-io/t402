package io.t402.erc4337;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.math.BigInteger;

/**
 * Tests for UserOperation.
 */
class UserOperationTest {

    @Test
    void builderWithMinimalFields() {
        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .callData("0xabcd")
            .build();

        assertEquals("0x1234567890abcdef1234567890abcdef12345678", op.getSender());
        assertEquals("0xabcd", op.getCallData());
        assertEquals(BigInteger.ZERO, op.getNonce());
        assertEquals("0x", op.getInitCode());
        assertEquals("0x", op.getPaymasterAndData());
        assertEquals("0x", op.getSignature());
    }

    @Test
    void builderWithAllFields() {
        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .nonce(BigInteger.valueOf(5))
            .initCode("0xdeadbeef")
            .callData("0xabcd")
            .verificationGasLimit(BigInteger.valueOf(300000))
            .callGasLimit(BigInteger.valueOf(150000))
            .preVerificationGas(BigInteger.valueOf(60000))
            .maxPriorityFeePerGas(BigInteger.valueOf(2000000000L))
            .maxFeePerGas(BigInteger.valueOf(50000000000L))
            .paymasterAndData("0xpaymaster")
            .signature("0xsignature")
            .build();

        assertEquals("0x1234567890abcdef1234567890abcdef12345678", op.getSender());
        assertEquals(BigInteger.valueOf(5), op.getNonce());
        assertEquals("0xdeadbeef", op.getInitCode());
        assertEquals("0xabcd", op.getCallData());
        assertEquals(BigInteger.valueOf(300000), op.getVerificationGasLimit());
        assertEquals(BigInteger.valueOf(150000), op.getCallGasLimit());
        assertEquals(BigInteger.valueOf(60000), op.getPreVerificationGas());
        assertEquals(BigInteger.valueOf(2000000000L), op.getMaxPriorityFeePerGas());
        assertEquals(BigInteger.valueOf(50000000000L), op.getMaxFeePerGas());
        assertEquals("0xpaymaster", op.getPaymasterAndData());
        assertEquals("0xsignature", op.getSignature());
    }

    @Test
    void builderRejectsNullSender() {
        assertThrows(IllegalArgumentException.class, () ->
            UserOperation.builder()
                .callData("0xabcd")
                .build()
        );
    }

    @Test
    void builderRejectsEmptySender() {
        assertThrows(IllegalArgumentException.class, () ->
            UserOperation.builder()
                .sender("")
                .callData("0xabcd")
                .build()
        );
    }

    @Test
    void toBuilderPreservesAllFields() {
        UserOperation original = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .nonce(BigInteger.valueOf(10))
            .callData("0xabcd")
            .signature("0xsig")
            .build();

        UserOperation copy = original.toBuilder()
            .nonce(BigInteger.valueOf(11))
            .build();

        assertEquals(BigInteger.valueOf(11), copy.getNonce());
        assertEquals("0xsig", copy.getSignature());
        assertEquals("0x1234567890abcdef1234567890abcdef12345678", copy.getSender());
    }

    @Test
    void defaultGasValues() {
        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .callData("0x")
            .build();

        assertEquals(BigInteger.valueOf(200000), op.getVerificationGasLimit());
        assertEquals(BigInteger.valueOf(100000), op.getCallGasLimit());
        assertEquals(BigInteger.valueOf(50000), op.getPreVerificationGas());
        assertEquals(BigInteger.valueOf(1500000000L), op.getMaxPriorityFeePerGas());
        assertEquals(BigInteger.valueOf(30000000000L), op.getMaxFeePerGas());
    }

    @Test
    void v07FactoryAndFactoryData() {
        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .factory("0xabcdef1234567890abcdef1234567890abcdef12")
            .factoryData("0x1234")
            .callData("0x")
            .build();

        assertEquals("0xabcdef1234567890abcdef1234567890abcdef12", op.getFactory());
        assertEquals("0x1234", op.getFactoryData());
        // getInitCode should combine them
        assertEquals("0xabcdef1234567890abcdef1234567890abcdef121234", op.getInitCode());
    }

    @Test
    void v07PaymasterFields() {
        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .callData("0x")
            .paymaster("0xabcdef1234567890abcdef1234567890abcdef12")
            .paymasterVerificationGasLimit(BigInteger.valueOf(50000))
            .paymasterPostOpGasLimit(BigInteger.valueOf(25000))
            .paymasterData("0xdeadbeef")
            .build();

        assertEquals("0xabcdef1234567890abcdef1234567890abcdef12", op.getPaymaster());
        assertEquals(BigInteger.valueOf(50000), op.getPaymasterVerificationGasLimit());
        assertEquals(BigInteger.valueOf(25000), op.getPaymasterPostOpGasLimit());
        assertEquals("0xdeadbeef", op.getPaymasterData());

        // getPaymasterAndData should combine them
        String paymasterAndData = op.getPaymasterAndData();
        assertTrue(paymasterAndData.startsWith("0xabcdef1234567890abcdef1234567890abcdef12"));
        assertTrue(paymasterAndData.endsWith("deadbeef"));
    }

    @Test
    void initCodeBackwardCompatibility() {
        // Full initCode should be split into factory + factoryData
        String fullInitCode = "0xabcdef1234567890abcdef1234567890abcdef121234567890";

        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .initCode(fullInitCode)
            .callData("0x")
            .build();

        assertEquals("0xabcdef1234567890abcdef1234567890abcdef12", op.getFactory());
        assertEquals("0x1234567890", op.getFactoryData());
        assertEquals(fullInitCode, op.getInitCode());
    }

    @Test
    void paymasterAndDataBackwardCompatibility() {
        // Full paymasterAndData with v0.7 format
        // paymaster (40 hex) + verificationGas (32 hex) + postOpGas (32 hex) + data
        String paymaster = "abcdef1234567890abcdef1234567890abcdef12";
        String verificationGas = "00000000000000000000000000000000" + "000000000000c350"; // 50000
        String postOpGas = "00000000000000000000000000000000" + "0000000000006198"; // 25000
        String data = "deadbeef";
        String fullPaymasterAndData = "0x" + paymaster + verificationGas.substring(32) + postOpGas.substring(32) + data;

        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .paymasterAndData(fullPaymasterAndData)
            .callData("0x")
            .build();

        assertEquals("0x" + paymaster, op.getPaymaster());
    }

    @Test
    void getUserOpHash() {
        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .nonce(BigInteger.ONE)
            .callData("0xabcd")
            .build();

        byte[] hash = op.getUserOpHash(8453);

        assertNotNull(hash);
        assertEquals(32, hash.length);
    }

    @Test
    void packUserOperation() {
        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .nonce(BigInteger.ONE)
            .callData("0xabcd")
            .verificationGasLimit(BigInteger.valueOf(200000))
            .callGasLimit(BigInteger.valueOf(100000))
            .build();

        UserOperation.PackedUserOperation packed = op.pack();

        assertNotNull(packed);
        assertEquals("0x1234567890abcdef1234567890abcdef12345678", packed.sender);
        assertEquals(BigInteger.ONE, packed.nonce);
        assertEquals("0xabcd", packed.callData);
        assertNotNull(packed.accountGasLimits);
        assertNotNull(packed.gasFees);
    }

    @Test
    void gasEstimateBuilder() {
        GasEstimate estimate = new GasEstimate(
            BigInteger.valueOf(300000),
            BigInteger.valueOf(150000),
            BigInteger.valueOf(75000),
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000)
        );

        UserOperation op = UserOperation.builder()
            .sender("0x1234567890abcdef1234567890abcdef12345678")
            .callData("0x")
            .gasEstimate(estimate)
            .build();

        assertEquals(BigInteger.valueOf(300000), op.getVerificationGasLimit());
        assertEquals(BigInteger.valueOf(150000), op.getCallGasLimit());
        assertEquals(BigInteger.valueOf(75000), op.getPreVerificationGas());
        assertEquals(BigInteger.valueOf(100000), op.getPaymasterVerificationGasLimit());
        assertEquals(BigInteger.valueOf(50000), op.getPaymasterPostOpGasLimit());
    }

    @Test
    void entryPointConstant() {
        assertEquals("0x0000000071727De22E5E9d8BAf0edAc6f37da032", UserOperation.ENTRYPOINT_V07);
    }
}
