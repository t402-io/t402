package io.t402.erc4337.safe;

import org.junit.jupiter.api.Test;
import org.web3j.crypto.Credentials;

import java.math.BigInteger;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for SafeAccount.
 */
class SafeAccountTest {

    private static final String TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    private static final String TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    private static final String TEST_SAFE_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

    @Test
    void buildSafeAccount() {
        Credentials owner = Credentials.create(TEST_PRIVATE_KEY);

        SafeAccount safe = SafeAccount.builder()
            .safeAddress(TEST_SAFE_ADDRESS)
            .owner(owner)
            .chainId(8453)
            .build();

        assertEquals(TEST_SAFE_ADDRESS, safe.getSafeAddress());
        assertEquals(owner, safe.getOwner());
        assertEquals(8453, safe.getChainId());
    }

    @Test
    void encodeExecTransaction() {
        Credentials owner = Credentials.create(TEST_PRIVATE_KEY);

        SafeAccount safe = SafeAccount.builder()
            .safeAddress(TEST_SAFE_ADDRESS)
            .owner(owner)
            .chainId(8453)
            .build();

        String callData = safe.encodeExecTransaction(
            "0xabcdef1234567890abcdef1234567890abcdef12",
            BigInteger.ZERO,
            "0x",
            Operation.CALL
        );

        assertNotNull(callData);
        assertTrue(callData.startsWith("0x"));
        assertTrue(callData.length() > 10);
    }

    @Test
    void encodeExecuteUserOp() {
        Credentials owner = Credentials.create(TEST_PRIVATE_KEY);

        SafeAccount safe = SafeAccount.builder()
            .safeAddress(TEST_SAFE_ADDRESS)
            .owner(owner)
            .chainId(8453)
            .build();

        String callData = safe.encodeExecuteUserOp(
            "0xabcdef1234567890abcdef1234567890abcdef12",
            BigInteger.valueOf(1000000),
            "0xa9059cbb",  // transfer signature
            Operation.CALL
        );

        assertNotNull(callData);
        assertTrue(callData.startsWith("0x"));
    }

    @Test
    void encodeBatchCalls() {
        Credentials owner = Credentials.create(TEST_PRIVATE_KEY);

        SafeAccount safe = SafeAccount.builder()
            .safeAddress(TEST_SAFE_ADDRESS)
            .owner(owner)
            .chainId(8453)
            .build();

        List<SafeCall> calls = List.of(
            SafeCall.call("0xabcdef1234567890abcdef1234567890abcdef12", "0xa9059cbb"),
            SafeCall.callWithValue("0xabcdef1234567890abcdef1234567890abcdef13", BigInteger.ONE, "0x")
        );

        String callData = safe.encodeBatchCalls(calls);

        assertNotNull(callData);
        assertTrue(callData.startsWith("0x"));
    }

    @Test
    void operationValues() {
        assertEquals(0, Operation.CALL.getValue());
        assertEquals(1, Operation.DELEGATECALL.getValue());
        assertEquals(Operation.CALL, Operation.fromValue(0));
        assertEquals(Operation.DELEGATECALL, Operation.fromValue(1));
    }

    @Test
    void safeCallFactoryMethods() {
        SafeCall call1 = SafeCall.call("0xabcd", "0x1234");
        assertEquals("0xabcd", call1.getTo());
        assertEquals(BigInteger.ZERO, call1.getValue());
        assertEquals("0x1234", call1.getData());
        assertEquals(Operation.CALL, call1.getOperation());

        SafeCall call2 = SafeCall.callWithValue("0xabcd", BigInteger.TEN, "0x5678");
        assertEquals(BigInteger.TEN, call2.getValue());

        SafeCall call3 = SafeCall.delegateCall("0xabcd", "0x9012");
        assertEquals(Operation.DELEGATECALL, call3.getOperation());
    }

    @Test
    void builderRequiresOwner() {
        assertThrows(IllegalArgumentException.class, () ->
            SafeAccount.builder()
                .safeAddress(TEST_SAFE_ADDRESS)
                .chainId(8453)
                .build()
        );
    }

    @Test
    void createInitCode() {
        Credentials owner = Credentials.create(TEST_PRIVATE_KEY);

        SafeAccount safe = SafeAccount.builder()
            .safeAddress(TEST_SAFE_ADDRESS)
            .owner(owner)
            .chainId(8453)
            .build();

        List<String> owners = List.of(TEST_ADDRESS);
        String initCode = safe.createInitCode(owners, 1, BigInteger.ZERO);

        assertNotNull(initCode);
        // initCode = factory address (with 0x) + createProxy call data (without 0x)
        assertTrue(initCode.length() > 42);
        // Should start with the factory address
        assertTrue(initCode.toLowerCase().startsWith(
            SafeAccount.SAFE_PROXY_FACTORY.toLowerCase()));
    }
}
