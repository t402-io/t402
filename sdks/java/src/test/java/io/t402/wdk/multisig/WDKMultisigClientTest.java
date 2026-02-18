package io.t402.wdk.multisig;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.List;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for WDKMultisigClient.
 */
class WDKMultisigClientTest {

    private static final String OWNER_1 = "0x" + "1".repeat(40);
    private static final String OWNER_2 = "0x" + "2".repeat(40);
    private static final String OWNER_3 = "0x" + "3".repeat(40);
    private static final String TOKEN = "0x" + "a".repeat(40);
    private static final String RECIPIENT = "0x" + "b".repeat(40);

    @Test
    void configValidValues() {
        WDKMultisigConfig config = new WDKMultisigConfig(
                "0x" + "f".repeat(40), 2,
                List.of(OWNER_1, OWNER_2, OWNER_3));
        assertEquals(2, config.getThreshold());
        assertEquals(3, config.getOwners().size());
        assertEquals(42161, config.getChainId());
    }

    @Test
    void configCustomChainId() {
        WDKMultisigConfig config = new WDKMultisigConfig(
                "0x" + "f".repeat(40), 1,
                List.of(OWNER_1), 8453);
        assertEquals(8453, config.getChainId());
    }

    @Test
    void configRejectsEmptySafeAddress() {
        assertThrows(IllegalArgumentException.class, () ->
                new WDKMultisigConfig("", 1, List.of(OWNER_1)));
    }

    @Test
    void configRejectsZeroThreshold() {
        assertThrows(IllegalArgumentException.class, () ->
                new WDKMultisigConfig("0x" + "f".repeat(40), 0, List.of(OWNER_1)));
    }

    @Test
    void configRejectsInsufficientOwners() {
        assertThrows(IllegalArgumentException.class, () ->
                new WDKMultisigConfig("0x" + "f".repeat(40), 3,
                        List.of(OWNER_1, OWNER_2)));
    }

    @Test
    void configRejectsDuplicateOwners() {
        assertThrows(IllegalArgumentException.class, () ->
                new WDKMultisigConfig("0x" + "f".repeat(40), 2,
                        List.of(OWNER_1, OWNER_1, OWNER_2)));
    }

    @Test
    void createClient() {
        WDKMultisigConfig config = new WDKMultisigConfig(
                "0x" + "f".repeat(40), 2,
                List.of(OWNER_1, OWNER_2, OWNER_3));
        WDKMultisigClient client = new WDKMultisigClient(config);
        assertNotNull(client);
        assertEquals(config, client.getConfig());
    }

    @Test
    void createClientRequiresConfig() {
        assertThrows(IllegalArgumentException.class, () ->
                new WDKMultisigClient(null));
    }

    @Test
    void proposePayment() throws Exception {
        WDKMultisigClient client = createClient(2);
        String proposalId = client.proposePayment(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN).get();
        assertNotNull(proposalId);
        assertFalse(proposalId.isEmpty());
    }

    @Test
    void proposePaymentValidatesRecipient() {
        WDKMultisigClient client = createClient(2);
        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.proposePayment(
                        "0x" + "0".repeat(40),
                        BigInteger.valueOf(1000000), TOKEN).get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("zero address"));
    }

    @Test
    void proposePaymentValidatesAmount() {
        WDKMultisigClient client = createClient(2);
        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.proposePayment(RECIPIENT, BigInteger.ZERO, TOKEN).get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("greater than zero"));
    }

    @Test
    void approvePayment() throws Exception {
        WDKMultisigClient client = createClient(2);
        String proposalId = client.proposePayment(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN).get();
        Boolean result = client.approvePayment(proposalId).get();
        assertTrue(result);
    }

    @Test
    void approvePaymentNotFound() {
        WDKMultisigClient client = createClient(2);
        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.approvePayment("nonexistent").get());
        assertTrue(ex.getCause() instanceof IllegalArgumentException);
        assertTrue(ex.getCause().getMessage().contains("not found"));
    }

    @Test
    void executePayment() throws Exception {
        WDKMultisigClient client = createClient(2);
        String proposalId = client.proposePayment(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN).get();

        client.approvePayment(proposalId).get();
        client.approvePayment(proposalId).get();

        String txHash = client.executePayment(proposalId).get();
        assertNotNull(txHash);
        assertTrue(txHash.startsWith("0x"));
    }

    @Test
    void executePaymentInsufficientSignatures() throws Exception {
        WDKMultisigClient client = createClient(2);
        String proposalId = client.proposePayment(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN).get();
        client.approvePayment(proposalId).get();

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.executePayment(proposalId).get());
        assertTrue(ex.getCause() instanceof IllegalStateException);
        assertTrue(ex.getCause().getMessage().contains("Insufficient"));
    }

    @Test
    void executePaymentAlreadyExecuted() throws Exception {
        WDKMultisigClient client = createClient(1);
        String proposalId = client.proposePayment(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN).get();
        client.approvePayment(proposalId).get();
        client.executePayment(proposalId).get();

        ExecutionException ex = assertThrows(ExecutionException.class, () ->
                client.executePayment(proposalId).get());
        assertTrue(ex.getCause() instanceof IllegalStateException);
        assertTrue(ex.getCause().getMessage().contains("already executed"));
    }

    @Test
    void getPendingProposals() throws Exception {
        WDKMultisigClient client = createClient(2);
        client.proposePayment(RECIPIENT, BigInteger.valueOf(1000000), TOKEN).get();
        client.proposePayment(RECIPIENT, BigInteger.valueOf(2000000), TOKEN).get();

        List<WDKMultisigClient.MultisigProposal> pending =
                client.getPendingProposals().get();
        assertEquals(2, pending.size());
    }

    @Test
    void isReady() throws Exception {
        WDKMultisigClient client = createClient(2);
        String proposalId = client.proposePayment(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN).get();

        assertFalse(client.isReady(proposalId));

        client.approvePayment(proposalId).get();
        assertFalse(client.isReady(proposalId));

        client.approvePayment(proposalId).get();
        assertTrue(client.isReady(proposalId));
    }

    @Test
    void getProposal() throws Exception {
        WDKMultisigClient client = createClient(2);
        String proposalId = client.proposePayment(
                RECIPIENT, BigInteger.valueOf(1000000), TOKEN).get();

        WDKMultisigClient.MultisigProposal proposal = client.getProposal(proposalId);
        assertNotNull(proposal);
        assertEquals(RECIPIENT, proposal.getTo());
        assertEquals(BigInteger.valueOf(1000000), proposal.getAmount());
        assertEquals(TOKEN, proposal.getToken());
        assertFalse(proposal.isExecuted());
        assertEquals(0, proposal.getSignatureCount());
    }

    private WDKMultisigClient createClient(int threshold) {
        WDKMultisigConfig config = new WDKMultisigConfig(
                "0x" + "f".repeat(40), threshold,
                List.of(OWNER_1, OWNER_2, OWNER_3));
        return new WDKMultisigClient(config);
    }
}
