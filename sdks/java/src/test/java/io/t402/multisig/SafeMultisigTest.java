package io.t402.multisig;

import io.t402.multisig.SafeTypes.*;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for Safe multi-sig SDK.
 */
class SafeMultisigTest {

    @Test
    void testTransactionBuilder() {
        String to = "0x1234567890123456789012345678901234567890";
        BigInteger value = BigInteger.valueOf(1000000);
        byte[] data = new byte[]{(byte) 0xa9, 0x05, (byte) 0x9c, (byte) 0xbb};

        SafeTransaction tx = new SafeTransactionBuilder()
                .to(to)
                .value(value)
                .data(data)
                .build();

        assertEquals(to, tx.getTo());
        assertEquals(value, tx.getValue());
        assertArrayEquals(data, tx.getData());
        assertEquals(OperationType.CALL, tx.getOperation());
    }

    @Test
    void testTransactionBuilderDelegateCall() {
        SafeTransaction tx = new SafeTransactionBuilder()
                .to("0x1234567890123456789012345678901234567890")
                .delegateCall()
                .build();

        assertEquals(OperationType.DELEGATE_CALL, tx.getOperation());
    }

    @Test
    void testTransactionBuilderGasSettings() {
        SafeTransaction tx = new SafeTransactionBuilder()
                .to("0x1234567890123456789012345678901234567890")
                .safeTxGas(BigInteger.valueOf(100000))
                .baseGas(BigInteger.valueOf(50000))
                .gasPrice(BigInteger.valueOf(20000000000L))
                .build();

        assertEquals(BigInteger.valueOf(100000), tx.getSafeTxGas());
        assertEquals(BigInteger.valueOf(50000), tx.getBaseGas());
        assertEquals(BigInteger.valueOf(20000000000L), tx.getGasPrice());
    }

    @Test
    void testErc20Transfer() {
        String token = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
        String to = "0x1234567890123456789012345678901234567890";
        BigInteger amount = BigInteger.valueOf(1000000);

        SafeTransaction tx = SafeTransactionBuilder.erc20Transfer(token, to, amount);

        assertEquals(token, tx.getTo());
        // Check transfer selector
        byte[] data = tx.getData();
        assertEquals((byte) 0xa9, data[0]);
        assertEquals((byte) 0x05, data[1]);
        assertEquals((byte) 0x9c, data[2]);
        assertEquals((byte) 0xbb, data[3]);
    }

    @Test
    void testEthTransfer() {
        String to = "0x1234567890123456789012345678901234567890";
        BigInteger amount = new BigInteger("1000000000000000000"); // 1 ETH

        SafeTransaction tx = SafeTransactionBuilder.ethTransfer(to, amount);

        assertEquals(to, tx.getTo());
        assertEquals(amount, tx.getValue());
        assertEquals(0, tx.getData().length);
    }

    @Test
    void testBatchBuilder() {
        String token = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
        String to1 = "0x1111111111111111111111111111111111111111";
        String to2 = "0x2222222222222222222222222222222222222222";
        BigInteger amount = BigInteger.valueOf(1000000);

        List<SafeTransaction> txs = SafeTransactionBuilder.batch()
                .addTransfer(token, to1, amount)
                .addTransfer(token, to2, amount)
                .build();

        assertEquals(2, txs.size());
    }

    @Test
    void testBatchMultiSend() {
        String token = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
        String to1 = "0x1111111111111111111111111111111111111111";
        String to2 = "0x2222222222222222222222222222222222222222";
        BigInteger amount = BigInteger.valueOf(1000000);

        SafeTransaction multiSendTx = SafeTransactionBuilder.batch()
                .addTransfer(token, to1, amount)
                .addTransfer(token, to2, amount)
                .buildMultiSend();

        assertEquals(SafeConstants.SAFE_MULTISEND, multiSendTx.getTo());
        assertEquals(OperationType.DELEGATE_CALL, multiSendTx.getOperation());
        // Check multiSend selector
        byte[] data = multiSendTx.getData();
        assertEquals((byte) 0x8d, data[0]);
        assertEquals((byte) 0x80, data[1]);
        assertEquals((byte) 0xff, data[2]);
        assertEquals((byte) 0x0a, data[3]);
    }

    @Test
    void testSignatureCollectorCreateRequest() {
        SignatureCollector collector = new SignatureCollector();

        String safeAddr = "0x1234567890123456789012345678901234567890";
        SafeTransaction tx = new SafeTransactionBuilder()
                .to("0xabcdef1234567890123456789012345678901234")
                .build();
        String txHash = "0x" + "12".repeat(32);
        List<String> owners = Arrays.asList(
                "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
        );
        int threshold = 2;

        TransactionRequest request = collector.createRequest(safeAddr, tx, txHash, owners, threshold);

        assertTrue(request.getId().startsWith("msig_"));
        assertEquals(threshold, request.getThreshold());
        assertFalse(request.isReady());
    }

    @Test
    void testSignatureCollectorAddSignature() {
        SignatureCollector collector = new SignatureCollector();

        String safeAddr = "0x1234567890123456789012345678901234567890";
        SafeTransaction tx = new SafeTransactionBuilder().build();
        String txHash = "0x" + "12".repeat(32);
        List<String> owners = Arrays.asList(
                "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
        );

        TransactionRequest request = collector.createRequest(safeAddr, tx, txHash, owners, 2);

        // Add first signature
        SafeSignature sig1 = new SafeSignature(
                owners.get(0),
                new byte[65],
                SignatureType.EOA
        );
        collector.addSignature(request.getId(), sig1);

        TransactionRequest req = collector.getRequest(request.getId());
        assertNotNull(req);
        assertEquals(1, req.getCollectedCount());
        assertFalse(req.isReady());

        // Add second signature
        SafeSignature sig2 = new SafeSignature(
                owners.get(1),
                new byte[65],
                SignatureType.EOA
        );
        collector.addSignature(request.getId(), sig2);

        req = collector.getRequest(request.getId());
        assertNotNull(req);
        assertEquals(2, req.getCollectedCount());
        assertTrue(req.isReady());
    }

    @Test
    void testSignatureCollectorDuplicateSignature() {
        SignatureCollector collector = new SignatureCollector();

        String safeAddr = "0x1234567890123456789012345678901234567890";
        SafeTransaction tx = new SafeTransactionBuilder().build();
        String txHash = "0x" + "12".repeat(32);
        List<String> owners = Arrays.asList("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

        TransactionRequest request = collector.createRequest(safeAddr, tx, txHash, owners, 1);

        SafeSignature sig = new SafeSignature(
                owners.get(0),
                new byte[65],
                SignatureType.EOA
        );

        // First should succeed
        collector.addSignature(request.getId(), sig);

        // Second should fail
        assertThrows(IllegalArgumentException.class, () ->
                collector.addSignature(request.getId(), sig));
    }

    @Test
    void testTransactionRequestIsReady() {
        // Test cases: (signatureCount, threshold, expected)
        int[][] testCases = {
                {0, 2, 0},  // 0 = false
                {1, 2, 0},
                {2, 2, 1},  // 1 = true
                {3, 2, 1},
                {1, 1, 1}
        };

        for (int[] tc : testCases) {
            int sigCount = tc[0];
            int threshold = tc[1];
            boolean expected = tc[2] == 1;

            TransactionRequest request = new TransactionRequest(
                    "test",
                    "0x0000000000000000000000000000000000000000",
                    new SafeTransaction("0x0000000000000000000000000000000000000000"),
                    "0x" + "00".repeat(32),
                    threshold,
                    0,
                    Long.MAX_VALUE
            );

            for (int i = 0; i < sigCount; i++) {
                request.addSignature(new SafeSignature(
                        String.format("0x%040d", i),
                        new byte[65]
                ));
            }

            assertEquals(expected, request.isReady(),
                    String.format("sigCount=%d, threshold=%d", sigCount, threshold));
        }
    }

    @Test
    void testIsValidThreshold() {
        assertFalse(SignatureCollector.isValidThreshold(0, 3));
        assertTrue(SignatureCollector.isValidThreshold(1, 3));
        assertTrue(SignatureCollector.isValidThreshold(2, 3));
        assertTrue(SignatureCollector.isValidThreshold(3, 3));
        assertFalse(SignatureCollector.isValidThreshold(4, 3));
        assertTrue(SignatureCollector.isValidThreshold(1, 1));
        assertFalse(SignatureCollector.isValidThreshold(0, 1));
    }

    @Test
    void testAreAddressesUnique() {
        String addr1 = "0x1111111111111111111111111111111111111111";
        String addr2 = "0x2222222222222222222222222222222222222222";
        String addr3 = "0x3333333333333333333333333333333333333333";

        assertTrue(SignatureCollector.areAddressesUnique(Arrays.asList()));
        assertTrue(SignatureCollector.areAddressesUnique(Arrays.asList(addr1)));
        assertTrue(SignatureCollector.areAddressesUnique(Arrays.asList(addr1, addr2, addr3)));
        assertFalse(SignatureCollector.areAddressesUnique(Arrays.asList(addr1, addr2, addr1)));
        assertFalse(SignatureCollector.areAddressesUnique(Arrays.asList(addr1, addr1, addr1)));
    }

    @Test
    void testGetOwnerIndex() {
        List<String> owners = Arrays.asList(
                "0x1111111111111111111111111111111111111111",
                "0x2222222222222222222222222222222222222222",
                "0x3333333333333333333333333333333333333333"
        );

        assertEquals(0, SignatureCollector.getOwnerIndex(owners.get(0), owners));
        assertEquals(1, SignatureCollector.getOwnerIndex(owners.get(1), owners));
        assertEquals(2, SignatureCollector.getOwnerIndex(owners.get(2), owners));
        assertEquals(-1, SignatureCollector.getOwnerIndex(
                "0x4444444444444444444444444444444444444444", owners));
    }

    @Test
    void testSortAddresses() {
        List<String> addrs = Arrays.asList(
                "0x3333333333333333333333333333333333333333",
                "0x1111111111111111111111111111111111111111",
                "0x2222222222222222222222222222222222222222"
        );

        List<String> sorted = SignatureCollector.sortAddresses(addrs);

        assertTrue(sorted.get(0).compareToIgnoreCase(sorted.get(1)) < 0);
        assertTrue(sorted.get(1).compareToIgnoreCase(sorted.get(2)) < 0);
    }

    @Test
    void testCombineSignatures() {
        String addr1 = "0x1111111111111111111111111111111111111111";
        String addr2 = "0x2222222222222222222222222222222222222222";

        byte[] sig1 = new byte[65];
        sig1[0] = 0x11;
        byte[] sig2 = new byte[65];
        sig2[0] = 0x22;

        Map<String, SafeSignature> sigs = new HashMap<>();
        // Add out of order to test sorting
        sigs.put(addr2.toLowerCase(), new SafeSignature(addr2, sig2));
        sigs.put(addr1.toLowerCase(), new SafeSignature(addr1, sig1));

        byte[] combined = SignatureCollector.combineSignatures(sigs);

        // Should be sorted by address
        assertEquals(130, combined.length);
        // First signature should be addr1's (0x11)
        assertEquals(0x11, combined[0]);
        // Second signature should be addr2's (0x22)
        assertEquals(0x22, combined[65]);
    }

    @Test
    void testConstants() {
        // Verify Safe contract addresses are valid
        assertTrue(SafeConstants.SAFE_4337_MODULE.startsWith("0x"));
        assertEquals(42, SafeConstants.SAFE_4337_MODULE.length());

        assertTrue(SafeConstants.SAFE_MODULE_SETUP.startsWith("0x"));
        assertEquals(42, SafeConstants.SAFE_MODULE_SETUP.length());

        assertTrue(SafeConstants.SAFE_SINGLETON.startsWith("0x"));
        assertEquals(42, SafeConstants.SAFE_SINGLETON.length());

        assertTrue(SafeConstants.ENTRYPOINT_V07.startsWith("0x"));
        assertEquals(42, SafeConstants.ENTRYPOINT_V07.length());

        // Verify selectors are 4 bytes
        assertEquals(4, SafeConstants.GET_OWNERS_SELECTOR.length);
        assertEquals(4, SafeConstants.GET_THRESHOLD_SELECTOR.length);
        assertEquals(4, SafeConstants.NONCE_SELECTOR.length);
        assertEquals(4, SafeConstants.EXEC_TRANSACTION_SELECTOR.length);
    }

    @Test
    void testSignatureTypes() {
        assertEquals(0, SignatureType.EOA.getValue());
        assertEquals(1, SignatureType.CONTRACT.getValue());
        assertEquals(4, SignatureType.APPROVED_HASH.getValue());
    }

    @Test
    void testOperationTypes() {
        assertEquals(0, OperationType.CALL.getValue());
        assertEquals(1, OperationType.DELEGATE_CALL.getValue());
    }

    @Test
    void testMinThreshold() {
        assertEquals(1, SafeConstants.MIN_THRESHOLD);
    }
}
