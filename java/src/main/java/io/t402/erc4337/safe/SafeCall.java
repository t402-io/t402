package io.t402.erc4337.safe;

import java.math.BigInteger;

/**
 * Represents a single call in a Safe batch transaction.
 */
public class SafeCall {

    private final String to;
    private final BigInteger value;
    private final String data;
    private final Operation operation;

    /**
     * Creates a new SafeCall with CALL operation.
     *
     * @param to Destination address
     * @param value ETH value to send
     * @param data Call data
     */
    public SafeCall(String to, BigInteger value, String data) {
        this(to, value, data, Operation.CALL);
    }

    /**
     * Creates a new SafeCall.
     *
     * @param to Destination address
     * @param value ETH value to send
     * @param data Call data
     * @param operation Operation type
     */
    public SafeCall(String to, BigInteger value, String data, Operation operation) {
        this.to = to;
        this.value = value;
        this.data = data != null ? data : "0x";
        this.operation = operation;
    }

    public String getTo() {
        return to;
    }

    public BigInteger getValue() {
        return value;
    }

    public String getData() {
        return data;
    }

    public Operation getOperation() {
        return operation;
    }

    /**
     * Creates a call with no value.
     */
    public static SafeCall call(String to, String data) {
        return new SafeCall(to, BigInteger.ZERO, data, Operation.CALL);
    }

    /**
     * Creates a call with value.
     */
    public static SafeCall callWithValue(String to, BigInteger value, String data) {
        return new SafeCall(to, value, data, Operation.CALL);
    }

    /**
     * Creates a delegate call.
     */
    public static SafeCall delegateCall(String to, String data) {
        return new SafeCall(to, BigInteger.ZERO, data, Operation.DELEGATECALL);
    }
}
