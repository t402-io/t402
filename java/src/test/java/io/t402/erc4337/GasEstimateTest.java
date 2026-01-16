package io.t402.erc4337;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.math.BigInteger;

/**
 * Tests for GasEstimate.
 */
class GasEstimateTest {

    @Test
    void basicConstructor() {
        GasEstimate estimate = new GasEstimate(
            BigInteger.valueOf(200000),
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000)
        );

        assertEquals(BigInteger.valueOf(200000), estimate.getVerificationGasLimit());
        assertEquals(BigInteger.valueOf(100000), estimate.getCallGasLimit());
        assertEquals(BigInteger.valueOf(50000), estimate.getPreVerificationGas());
        assertNull(estimate.getPaymasterVerificationGasLimit());
        assertNull(estimate.getPaymasterPostOpGasLimit());
    }

    @Test
    void fullConstructor() {
        GasEstimate estimate = new GasEstimate(
            BigInteger.valueOf(200000),
            BigInteger.valueOf(100000),
            BigInteger.valueOf(50000),
            BigInteger.valueOf(80000),
            BigInteger.valueOf(40000)
        );

        assertEquals(BigInteger.valueOf(200000), estimate.getVerificationGasLimit());
        assertEquals(BigInteger.valueOf(100000), estimate.getCallGasLimit());
        assertEquals(BigInteger.valueOf(50000), estimate.getPreVerificationGas());
        assertEquals(BigInteger.valueOf(80000), estimate.getPaymasterVerificationGasLimit());
        assertEquals(BigInteger.valueOf(40000), estimate.getPaymasterPostOpGasLimit());
    }

    @Test
    void defaults() {
        GasEstimate estimate = GasEstimate.defaults();

        assertNotNull(estimate.getVerificationGasLimit());
        assertNotNull(estimate.getCallGasLimit());
        assertNotNull(estimate.getPreVerificationGas());
        assertNotNull(estimate.getPaymasterVerificationGasLimit());
        assertNotNull(estimate.getPaymasterPostOpGasLimit());

        assertTrue(estimate.getVerificationGasLimit().compareTo(BigInteger.ZERO) > 0);
        assertTrue(estimate.getCallGasLimit().compareTo(BigInteger.ZERO) > 0);
        assertTrue(estimate.getPreVerificationGas().compareTo(BigInteger.ZERO) > 0);
    }
}
