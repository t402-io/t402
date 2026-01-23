package io.t402.schemes.near.exact;

import io.t402.schemes.near.*;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for Exact-Direct NEAR scheme implementations.
 */
@DisplayName("Exact-Direct NEAR Schemes")
class ExactDirectNearSchemeTest {

    private static final String SENDER_ACCOUNT = "alice.near";
    private static final String RECIPIENT_ACCOUNT = "merchant.near";
    private static final String TOKEN_CONTRACT = "usdt.tether-token.near";
    private static final String SAMPLE_TX_HASH = "9FbNk5XzYTa1BRuesGjCZ5uWY8TV9KFesh3PFjDEB4jQ";

    @Nested
    @DisplayName("NearConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should validate named account IDs")
        void testValidNamedAccounts() {
            assertTrue(NearConstants.isValidAccountId("alice.near"));
            assertTrue(NearConstants.isValidAccountId("bob.testnet"));
            assertTrue(NearConstants.isValidAccountId("usdt.tether-token.near"));
            assertTrue(NearConstants.isValidAccountId("sub.alice.near"));
            assertTrue(NearConstants.isValidAccountId("my-account.near"));
            assertTrue(NearConstants.isValidAccountId("usdt.fakes.testnet"));
        }

        @Test
        @DisplayName("should validate implicit account IDs")
        void testValidImplicitAccounts() {
            assertTrue(NearConstants.isValidAccountId(
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"));
        }

        @Test
        @DisplayName("should reject invalid account IDs")
        void testInvalidAccounts() {
            assertFalse(NearConstants.isValidAccountId(null));
            assertFalse(NearConstants.isValidAccountId(""));
            assertFalse(NearConstants.isValidAccountId("a")); // Too short
            assertFalse(NearConstants.isValidAccountId("ALICE.near")); // Uppercase
            assertFalse(NearConstants.isValidAccountId("alice near")); // Space
            assertFalse(NearConstants.isValidAccountId(".alice.near")); // Leading dot
        }

        @Test
        @DisplayName("should normalize networks")
        void testNormalizeNetwork() {
            assertEquals(NearConstants.NEAR_MAINNET, NearConstants.normalizeNetwork("mainnet"));
            assertEquals(NearConstants.NEAR_MAINNET, NearConstants.normalizeNetwork("near-mainnet"));
            assertEquals(NearConstants.NEAR_TESTNET, NearConstants.normalizeNetwork("testnet"));
            assertEquals(NearConstants.NEAR_TESTNET, NearConstants.normalizeNetwork("near-testnet"));
            assertEquals(NearConstants.NEAR_MAINNET, NearConstants.normalizeNetwork(null));
            assertEquals("near:mainnet", NearConstants.normalizeNetwork("near:mainnet"));
        }

        @Test
        @DisplayName("should validate networks")
        void testIsValidNetwork() {
            assertTrue(NearConstants.isValidNetwork("near:mainnet"));
            assertTrue(NearConstants.isValidNetwork("near:testnet"));
            assertTrue(NearConstants.isValidNetwork("mainnet"));
            assertFalse(NearConstants.isValidNetwork("near:devnet"));
            assertFalse(NearConstants.isValidNetwork("eip155:1"));
        }

        @Test
        @DisplayName("should get USDT address by network")
        void testGetUsdtAddress() {
            assertEquals("usdt.tether-token.near",
                NearConstants.getUsdtAddress("near:mainnet"));
            assertEquals("usdt.fakes.testnet",
                NearConstants.getUsdtAddress("near:testnet"));
        }

        @Test
        @DisplayName("should throw for unsupported network USDT lookup")
        void testGetUsdtAddressUnsupported() {
            assertThrows(IllegalArgumentException.class,
                () -> NearConstants.getUsdtAddress("near:devnet"));
        }

        @Test
        @DisplayName("should get RPC URL by network")
        void testGetRpcUrl() {
            assertEquals("https://rpc.mainnet.near.org",
                NearConstants.getRpcUrl("near:mainnet"));
            assertEquals("https://rpc.testnet.near.org",
                NearConstants.getRpcUrl("near:testnet"));
        }
    }

    @Nested
    @DisplayName("ExactDirectPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build a valid payload")
        void testBuildPayload() {
            ExactDirectPayload payload = ExactDirectPayload.builder()
                .txHash(SAMPLE_TX_HASH)
                .from(SENDER_ACCOUNT)
                .to(RECIPIENT_ACCOUNT)
                .amount("1000000")
                .build();

            assertEquals(SAMPLE_TX_HASH, payload.getTxHash());
            assertEquals(SENDER_ACCOUNT, payload.getFrom());
            assertEquals(RECIPIENT_ACCOUNT, payload.getTo());
            assertEquals("1000000", payload.getAmount());
        }

        @Test
        @DisplayName("should convert payload to map and back")
        void testPayloadRoundTrip() {
            ExactDirectPayload original = ExactDirectPayload.builder()
                .txHash(SAMPLE_TX_HASH)
                .from(SENDER_ACCOUNT)
                .to(RECIPIENT_ACCOUNT)
                .amount("1500000")
                .build();

            Map<String, Object> map = original.toMap();
            assertEquals(SAMPLE_TX_HASH, map.get("txHash"));
            assertEquals(SENDER_ACCOUNT, map.get("from"));
            assertEquals(RECIPIENT_ACCOUNT, map.get("to"));
            assertEquals("1500000", map.get("amount"));

            ExactDirectPayload restored = ExactDirectPayload.fromMap(map);
            assertEquals(original.getTxHash(), restored.getTxHash());
            assertEquals(original.getFrom(), restored.getFrom());
            assertEquals(original.getTo(), restored.getTo());
            assertEquals(original.getAmount(), restored.getAmount());
        }

        @Test
        @DisplayName("should throw for missing txHash")
        void testMissingTxHash() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .from(SENDER_ACCOUNT)
                    .to(RECIPIENT_ACCOUNT)
                    .amount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should throw for missing from")
        void testMissingFrom() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .to(RECIPIENT_ACCOUNT)
                    .amount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should throw for null map")
        void testFromNullMap() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.fromMap(null));
        }
    }

    @Nested
    @DisplayName("ExactDirectNearServerScheme")
    class ServerSchemeTest {

        private ExactDirectNearServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactDirectNearServerScheme();
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", NearConstants.NEAR_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertEquals(NearConstants.USDT_MAINNET, result.get("asset"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDT", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("1500000", NearConstants.NEAR_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse price for testnet")
        void testParsePriceTestnet() {
            Map<String, Object> result = scheme.parsePrice("1.00", NearConstants.NEAR_TESTNET);

            assertEquals("1000000", result.get("amount"));
            assertEquals(NearConstants.USDT_TESTNET, result.get("asset"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "near:devnet"));
        }

        @Test
        @DisplayName("should create complete payment requirements")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", "near:mainnet", RECIPIENT_ACCOUNT, "API Access");

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals("near:mainnet", requirements.get("network"));
            assertEquals(RECIPIENT_ACCOUNT, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertEquals(NearConstants.USDT_MAINNET, requirements.get("asset"));
            assertEquals(NearConstants.DEFAULT_VALIDITY_DURATION, requirements.get("maxTimeoutSeconds"));
            assertEquals("API Access", requirements.get("resource"));
            assertEquals(2, requirements.get("t402Version"));
        }

        @Test
        @DisplayName("should create requirements with custom network")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                NearConstants.NEAR_TESTNET,
                RECIPIENT_ACCOUNT,
                "2000000",
                null,
                600
            );

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(NearConstants.NEAR_TESTNET, requirements.get("network"));
            assertEquals(RECIPIENT_ACCOUNT, requirements.get("payTo"));
            assertEquals("2000000", requirements.get("maxAmountRequired"));
            assertEquals(NearConstants.USDT_TESTNET, requirements.get("asset"));
            assertEquals(600, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should use custom asset when provided")
        void testCreatePaymentRequirementsCustomAsset() {
            String customToken = "custom-token.near";
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                NearConstants.NEAR_MAINNET,
                RECIPIENT_ACCOUNT,
                "1000000",
                customToken,
                300
            );

            assertEquals(customToken, requirements.get("asset"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact-direct");
            valid.put("network", NearConstants.NEAR_MAINNET);
            valid.put("payTo", RECIPIENT_ACCOUNT);

            assertTrue(scheme.validateRequirements(valid));

            // Missing scheme
            Map<String, Object> noScheme = new HashMap<>();
            noScheme.put("network", NearConstants.NEAR_MAINNET);
            noScheme.put("payTo", RECIPIENT_ACCOUNT);
            assertFalse(scheme.validateRequirements(noScheme));

            // Wrong scheme
            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "exact");
            wrongScheme.put("network", NearConstants.NEAR_MAINNET);
            wrongScheme.put("payTo", RECIPIENT_ACCOUNT);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-NEAR network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact-direct");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", RECIPIENT_ACCOUNT);
            assertFalse(scheme.validateRequirements(wrongNetwork));

            // Null requirements
            assertFalse(scheme.validateRequirements(null));
        }

        @Test
        @DisplayName("should use default network")
        void testDefaultNetwork() {
            assertEquals(NearConstants.NEAR_MAINNET, scheme.getDefaultNetwork());

            ExactDirectNearServerScheme testnetScheme =
                new ExactDirectNearServerScheme(NearConstants.NEAR_TESTNET);
            assertEquals(NearConstants.NEAR_TESTNET, testnetScheme.getDefaultNetwork());
        }
    }

    @Nested
    @DisplayName("ExactDirectNearClientScheme")
    class ClientSchemeTest {

        private MockClientSigner mockSigner;
        private ExactDirectNearClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientSigner(SENDER_ACCOUNT);
            scheme = new ExactDirectNearClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get account ID from signer")
        void testGetAccountId() {
            assertEquals(SENDER_ACCOUNT, scheme.getAccountId());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class,
                () -> new ExactDirectNearClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", NearConstants.NEAR_MAINNET);
            requirements.put("payTo", RECIPIENT_ACCOUNT);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TOKEN_CONTRACT);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("exact-direct", result.get("scheme"));
            assertEquals(NearConstants.NEAR_MAINNET, result.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.get("payload");
            assertNotNull(payload);
            assertNotNull(payload.get("txHash"));
            assertEquals(SENDER_ACCOUNT, payload.get("from"));
            assertEquals(RECIPIENT_ACCOUNT, payload.get("to"));
            assertEquals("1000000", payload.get("amount"));
        }

        @Test
        @DisplayName("should throw for missing payTo")
        void testMissingPayTo() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", NearConstants.NEAR_MAINNET);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TOKEN_CONTRACT);

            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should throw for missing asset")
        void testMissingAsset() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", NearConstants.NEAR_MAINNET);
            requirements.put("payTo", RECIPIENT_ACCOUNT);
            requirements.put("maxAmountRequired", "1000000");

            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should throw for invalid recipient")
        void testInvalidRecipient() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", NearConstants.NEAR_MAINNET);
            requirements.put("payTo", "INVALID");
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TOKEN_CONTRACT);

            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testUnsupportedNetwork() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", "near:devnet");
            requirements.put("payTo", RECIPIENT_ACCOUNT);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TOKEN_CONTRACT);

            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should pass correct actions to signer")
        void testSignerActions() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", NearConstants.NEAR_MAINNET);
            requirements.put("payTo", RECIPIENT_ACCOUNT);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TOKEN_CONTRACT);

            scheme.createPaymentPayloadSync(requirements);

            // Verify the signer was called with correct parameters
            assertEquals(TOKEN_CONTRACT, mockSigner.lastReceiverId);
            assertEquals(NearConstants.NEAR_MAINNET, mockSigner.lastNetwork);
            assertNotNull(mockSigner.lastActions);
            assertEquals(1, mockSigner.lastActions.size());

            @SuppressWarnings("unchecked")
            Map<String, Object> action = mockSigner.lastActions.get(0);
            @SuppressWarnings("unchecked")
            Map<String, Object> funcCall = (Map<String, Object>) action.get("FunctionCall");
            assertEquals("ft_transfer", funcCall.get("method_name"));
            assertEquals(NearConstants.DEFAULT_GAS, funcCall.get("gas"));
            assertEquals("1", funcCall.get("deposit"));

            String argsJson = (String) funcCall.get("args");
            assertTrue(argsJson.contains("\"receiver_id\":\"" + RECIPIENT_ACCOUNT + "\""));
            assertTrue(argsJson.contains("\"amount\":\"1000000\""));
        }
    }

    @Nested
    @DisplayName("ExactDirectNearFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorSigner mockSigner;
        private ExactDirectNearFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorSigner();
            scheme = new ExactDirectNearFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class,
                () -> new ExactDirectNearFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(NearConstants.NEAR_MAINNET);
            assertEquals(1, signers.size());
            assertEquals("facilitator.near", signers.get(0));
        }

        @Test
        @DisplayName("should get extra metadata")
        void testGetExtra() {
            Map<String, Object> extra = scheme.getExtra(NearConstants.NEAR_MAINNET);
            assertEquals("USDT", extra.get("assetSymbol"));
            assertEquals(6, extra.get("assetDecimals"));
        }

        @Test
        @DisplayName("should reject missing payload")
        void testVerifyMissingPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "exact-direct");
            payload.put("network", NearConstants.NEAR_MAINNET);

            Map<String, Object> requirements = createValidRequirements();

            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertEquals("Missing payload", result.error);
        }

        @Test
        @DisplayName("should reject unsupported network")
        void testVerifyUnsupportedNetwork() {
            Map<String, Object> payload = createValidPayload();
            payload.put("network", "near:devnet");

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("network", "near:devnet");

            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Unsupported network"));
        }

        @Test
        @DisplayName("should reject wrong token contract")
        void testVerifyWrongTokenContract() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // Set a different asset than what's in the mock transaction
            requirements.put("asset", "wrong-token.near");

            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Wrong token contract"));
        }

        @Test
        @DisplayName("should reject wrong recipient")
        void testVerifyWrongRecipient() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo", "other-merchant.near");

            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Wrong recipient"));
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than the 1000000 in mock

            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Insufficient amount"));
        }

        @Test
        @DisplayName("should reject failed transactions")
        void testVerifyFailedTransaction() {
            mockSigner.setTransactionFailed(true);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("failed on-chain"));
        }

        @Test
        @DisplayName("should reject replayed transactions")
        void testReplayProtection() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // First verification should succeed
            ExactDirectNearFacilitatorScheme.VerificationResult first =
                scheme.verifySync(payload, requirements);
            assertTrue(first.valid);

            // Second verification of same tx should fail
            ExactDirectNearFacilitatorScheme.VerificationResult second =
                scheme.verifySync(payload, requirements);
            assertFalse(second.valid);
            assertTrue(second.error.contains("already been used"));
        }

        @Test
        @DisplayName("should verify valid payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
            assertNull(result.error);
            assertEquals(SENDER_ACCOUNT, result.payer);
            assertEquals(NearConstants.NEAR_MAINNET, result.network);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectNearFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertEquals(ExactDirectNearFacilitatorScheme.SettlementStatus.SUCCESS, result.status);
            assertEquals(SAMPLE_TX_HASH, result.transaction);
            assertNull(result.error);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "999999999"); // Too much

            ExactDirectNearFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertEquals(ExactDirectNearFacilitatorScheme.SettlementStatus.FAILED, result.status);
            assertNull(result.transaction);
            assertNotNull(result.error);
        }

        @Test
        @DisplayName("should accept amount greater than required")
        void testVerifyExcessAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "500000"); // Less than the 1000000 in mock

            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
        }

        @Test
        @DisplayName("should handle transaction not found")
        void testTransactionNotFound() {
            mockSigner.setThrowOnQuery(true);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Transaction not found"));
        }

        @Test
        @DisplayName("should cleanup used transactions")
        void testCleanupUsedTransactions() throws InterruptedException {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // Verify the first time
            scheme.verifySync(payload, requirements);

            // Wait a moment so the entry has a past timestamp
            Thread.sleep(50);

            // Cleanup with 1ms threshold (removes entries older than 1ms)
            scheme.cleanupUsedTransactions(1);

            // Should be able to verify again after cleanup
            ExactDirectNearFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);
            assertTrue(result.valid);
        }

        private Map<String, Object> createValidPayload() {
            Map<String, Object> innerPayload = new HashMap<>();
            innerPayload.put("txHash", SAMPLE_TX_HASH);
            innerPayload.put("from", SENDER_ACCOUNT);
            innerPayload.put("to", RECIPIENT_ACCOUNT);
            innerPayload.put("amount", "1000000");

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact-direct");
            payload.put("network", NearConstants.NEAR_MAINNET);
            payload.put("payload", innerPayload);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact-direct");
            requirements.put("network", NearConstants.NEAR_MAINNET);
            requirements.put("payTo", RECIPIENT_ACCOUNT);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", TOKEN_CONTRACT);
            requirements.put("maxTimeoutSeconds", 300);

            return requirements;
        }
    }

    @Nested
    @DisplayName("NearSchemes Factory")
    class NearSchemesTest {

        @Test
        @DisplayName("should create client scheme")
        void testCreateClient() {
            ClientNearSigner signer = new MockClientSigner(SENDER_ACCOUNT);
            ExactDirectNearClientScheme client = NearSchemes.createClient(signer);
            assertEquals(SENDER_ACCOUNT, client.getAccountId());
        }

        @Test
        @DisplayName("should create server scheme with default network")
        void testCreateServer() {
            ExactDirectNearServerScheme server = NearSchemes.createServer();
            assertEquals(NearConstants.NEAR_MAINNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create server scheme with custom network")
        void testCreateServerWithNetwork() {
            ExactDirectNearServerScheme server = NearSchemes.createServer("near:testnet");
            assertEquals(NearConstants.NEAR_TESTNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create facilitator scheme")
        void testCreateFacilitator() {
            FacilitatorNearSigner signer = new MockFacilitatorSigner();
            ExactDirectNearFacilitatorScheme facilitator = NearSchemes.createFacilitator(signer);
            assertNotNull(facilitator);
        }

        @Test
        @DisplayName("should return correct scheme identifier")
        void testGetScheme() {
            assertEquals("exact-direct", NearSchemes.getScheme());
        }

        @Test
        @DisplayName("should validate networks")
        void testIsValidNetwork() {
            assertTrue(NearSchemes.isValidNetwork("near:mainnet"));
            assertTrue(NearSchemes.isValidNetwork("near:testnet"));
            assertFalse(NearSchemes.isValidNetwork("eip155:1"));
        }

        @Test
        @DisplayName("should get USDT address")
        void testGetUsdtAddress() {
            assertEquals("usdt.tether-token.near", NearSchemes.getUsdtAddress("near:mainnet"));
        }

        @Test
        @DisplayName("should provide supported networks list")
        void testSupportedNetworks() {
            assertEquals(2, NearSchemes.SUPPORTED_NETWORKS.size());
            assertTrue(NearSchemes.SUPPORTED_NETWORKS.contains("near:mainnet"));
            assertTrue(NearSchemes.SUPPORTED_NETWORKS.contains("near:testnet"));
        }
    }

    // =========================================================================
    // Mock implementations for testing
    // =========================================================================

    /**
     * Mock client signer for testing.
     */
    static class MockClientSigner implements ClientNearSigner {
        private final String accountId;
        String lastReceiverId;
        List<Map<String, Object>> lastActions;
        String lastNetwork;
        private int txCounter = 0;

        MockClientSigner(String accountId) {
            this.accountId = accountId;
        }

        @Override
        public String getAccountId() {
            return accountId;
        }

        @Override
        public CompletableFuture<String> signAndSendTransaction(
                String receiverId,
                List<Map<String, Object>> actions,
                String network) {
            this.lastReceiverId = receiverId;
            this.lastActions = actions;
            this.lastNetwork = network;
            txCounter++;
            return CompletableFuture.completedFuture("MockTxHash" + txCounter);
        }
    }

    /**
     * Mock facilitator signer for testing.
     */
    static class MockFacilitatorSigner implements FacilitatorNearSigner {
        private boolean transactionFailed = false;
        private boolean throwOnQuery = false;

        @Override
        public List<String> getAddresses(String network) {
            return List.of("facilitator.near");
        }

        /**
         * Sets whether the mock should return failed transactions.
         *
         * @param failed true to return failed transactions
         */
        void setTransactionFailed(boolean failed) {
            this.transactionFailed = failed;
        }

        /**
         * Sets whether the mock should throw on query.
         *
         * @param throwOnQuery true to throw on query
         */
        void setThrowOnQuery(boolean throwOnQuery) {
            this.throwOnQuery = throwOnQuery;
        }

        @Override
        public CompletableFuture<Map<String, Object>> queryTransaction(
                String txHash, String senderId, String network) {

            if (throwOnQuery) {
                CompletableFuture<Map<String, Object>> future = new CompletableFuture<>();
                future.completeExceptionally(
                    new NearTransactionException("Transaction not found"));
                return future;
            }

            // Build mock transaction result
            Map<String, Object> status = new HashMap<>();
            if (transactionFailed) {
                status.put("Failure", Map.of("error", "mock_error"));
            } else {
                status.put("SuccessValue", "");
            }

            // Build ft_transfer args as base64-encoded JSON
            String argsJson = "{\"receiver_id\":\"" + RECIPIENT_ACCOUNT
                + "\",\"amount\":\"1000000\"}";
            String argsBase64 = Base64.getEncoder().encodeToString(
                argsJson.getBytes(StandardCharsets.UTF_8));

            Map<String, Object> funcCall = new HashMap<>();
            funcCall.put("method_name", "ft_transfer");
            funcCall.put("args", argsBase64);
            funcCall.put("gas", NearConstants.DEFAULT_GAS);
            funcCall.put("deposit", "1");

            Map<String, Object> action = new HashMap<>();
            action.put("FunctionCall", funcCall);

            List<Map<String, Object>> actions = new ArrayList<>();
            actions.add(action);

            Map<String, Object> transaction = new HashMap<>();
            transaction.put("hash", txHash);
            transaction.put("signer_id", senderId);
            transaction.put("receiver_id", TOKEN_CONTRACT);
            transaction.put("actions", actions);

            Map<String, Object> result = new HashMap<>();
            result.put("status", status);
            result.put("transaction", transaction);

            return CompletableFuture.completedFuture(result);
        }
    }
}
