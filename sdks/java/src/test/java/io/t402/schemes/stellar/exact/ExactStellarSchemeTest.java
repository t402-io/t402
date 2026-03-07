package io.t402.schemes.stellar.exact;

import io.t402.schemes.stellar.*;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for Exact Stellar scheme implementations.
 */
@DisplayName("Exact Stellar Schemes")
class ExactStellarSchemeTest {

    // 56-char G-addresses for testing
    private static final String SAMPLE_ADDRESS_1 =
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    private static final String SAMPLE_ADDRESS_2 =
        "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    private static final String FACILITATOR_ADDRESS =
        "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

    // Sample signature (Base64-encoded)
    private static final String MOCK_SIGNATURE = "dGVzdC1zaWduYXR1cmU=";

    @Nested
    @DisplayName("StellarConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should have correct network identifiers")
        void testNetworkIds() {
            assertEquals("stellar:pubnet", StellarConstants.STELLAR_PUBNET);
            assertEquals("stellar:testnet", StellarConstants.STELLAR_TESTNET);
        }

        @Test
        @DisplayName("should have correct USDC addresses")
        void testUsdcAddresses() {
            assertEquals("CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI",
                StellarConstants.USDC_PUBNET);
            assertEquals("CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
                StellarConstants.USDC_TESTNET);
        }

        @Test
        @DisplayName("should have correct decimals")
        void testDecimals() {
            assertEquals(7, StellarConstants.USDC_DECIMALS);
        }

        @Test
        @DisplayName("should have correct network passphrases")
        void testPassphrases() {
            assertEquals("Public Global Stellar Network ; September 2015",
                StellarConstants.PUBNET_PASSPHRASE);
            assertEquals("Test SDF Network ; September 2015",
                StellarConstants.TESTNET_PASSPHRASE);
        }

        @Test
        @DisplayName("should validate networks")
        void testIsValidNetwork() {
            assertTrue(StellarConstants.isValidNetwork(StellarConstants.STELLAR_PUBNET));
            assertTrue(StellarConstants.isValidNetwork(StellarConstants.STELLAR_TESTNET));
            assertFalse(StellarConstants.isValidNetwork("eip155:1"));
            assertFalse(StellarConstants.isValidNetwork("stellar:unknown"));
        }

        @Test
        @DisplayName("should normalize network identifiers")
        void testNormalizeNetwork() {
            assertEquals(StellarConstants.STELLAR_PUBNET,
                StellarConstants.normalizeNetwork("pubnet"));
            assertEquals(StellarConstants.STELLAR_PUBNET,
                StellarConstants.normalizeNetwork("mainnet"));
            assertEquals(StellarConstants.STELLAR_TESTNET,
                StellarConstants.normalizeNetwork("testnet"));
            assertEquals(StellarConstants.STELLAR_PUBNET,
                StellarConstants.normalizeNetwork(null));
        }

        @Test
        @DisplayName("should get USDC address by network")
        void testGetUsdcAddress() {
            assertEquals(StellarConstants.USDC_PUBNET,
                StellarConstants.getUsdcAddress(StellarConstants.STELLAR_PUBNET));
            assertEquals(StellarConstants.USDC_TESTNET,
                StellarConstants.getUsdcAddress(StellarConstants.STELLAR_TESTNET));
        }

        @Test
        @DisplayName("should throw for unsupported network USDC lookup")
        void testGetUsdcAddressInvalid() {
            assertThrows(IllegalArgumentException.class,
                () -> StellarConstants.getUsdcAddress("stellar:unknown"));
        }

        @Test
        @DisplayName("should get network passphrase")
        void testGetNetworkPassphrase() {
            assertEquals(StellarConstants.PUBNET_PASSPHRASE,
                StellarConstants.getNetworkPassphrase(StellarConstants.STELLAR_PUBNET));
            assertEquals(StellarConstants.TESTNET_PASSPHRASE,
                StellarConstants.getNetworkPassphrase(StellarConstants.STELLAR_TESTNET));
        }

        @Test
        @DisplayName("should calculate max ledger")
        void testCalculateMaxLedger() {
            // 60 seconds / 5 seconds per ledger = 12 ledgers
            assertEquals(1012, StellarConstants.calculateMaxLedger(1000, 60));
            // 7 seconds / 5 = ceil(1.4) = 2 ledgers
            assertEquals(1002, StellarConstants.calculateMaxLedger(1000, 7));
        }
    }

    @Nested
    @DisplayName("ExactStellarServerScheme")
    class ServerSchemeTest {

        private ExactStellarServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactStellarServerScheme();
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50",
                StellarConstants.STELLAR_PUBNET);

            assertEquals("15000000", result.get("amount")); // 1.50 * 10^7
            assertEquals(StellarConstants.USDC_PUBNET, result.get("asset"));
            assertEquals(7, result.get("decimals"));
            assertEquals("USDC", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("15000000",
                StellarConstants.STELLAR_PUBNET);

            assertEquals("15000000", result.get("amount"));
        }

        @Test
        @DisplayName("should normalize legacy network identifiers")
        void testParsePriceLegacyNetwork() {
            Map<String, Object> result = scheme.parsePrice("1.00", "pubnet");

            assertEquals("10000000", result.get("amount")); // 1.00 * 10^7
            assertEquals(StellarConstants.USDC_PUBNET, result.get("asset"));
        }

        @Test
        @DisplayName("should use testnet USDC for testnet")
        void testParsePriceTestnet() {
            Map<String, Object> result = scheme.parsePrice("1.00",
                StellarConstants.STELLAR_TESTNET);

            assertEquals(StellarConstants.USDC_TESTNET, result.get("asset"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "invalid-network"));
        }

        @Test
        @DisplayName("should create complete payment requirements")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50",
                SAMPLE_ADDRESS_2,
                "API Access"
            );

            assertEquals("exact", requirements.get("scheme"));
            assertEquals(StellarConstants.STELLAR_PUBNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("15000000", requirements.get("maxAmountRequired"));
            assertEquals(StellarConstants.USDC_PUBNET, requirements.get("asset"));
            assertEquals(StellarConstants.DEFAULT_TIMEOUT_SECONDS,
                requirements.get("maxTimeoutSeconds"));
            assertEquals("API Access", requirements.get("resource"));
        }

        @Test
        @DisplayName("should create requirements with custom network")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                StellarConstants.STELLAR_TESTNET,
                SAMPLE_ADDRESS_2,
                "10000000",
                null,
                120
            );

            assertEquals("exact", requirements.get("scheme"));
            assertEquals(StellarConstants.STELLAR_TESTNET, requirements.get("network"));
            assertEquals(SAMPLE_ADDRESS_2, requirements.get("payTo"));
            assertEquals("10000000", requirements.get("maxAmountRequired"));
            assertEquals(StellarConstants.USDC_TESTNET, requirements.get("asset"));
            assertEquals(120, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact");
            valid.put("network", StellarConstants.STELLAR_PUBNET);
            valid.put("payTo", SAMPLE_ADDRESS_2);

            assertTrue(scheme.validateRequirements(valid));

            // Missing scheme
            Map<String, Object> noScheme = new HashMap<>();
            noScheme.put("network", StellarConstants.STELLAR_PUBNET);
            noScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(noScheme));

            // Wrong scheme
            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "upto");
            wrongScheme.put("network", StellarConstants.STELLAR_PUBNET);
            wrongScheme.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-Stellar network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", SAMPLE_ADDRESS_2);
            assertFalse(scheme.validateRequirements(wrongNetwork));
        }
    }

    @Nested
    @DisplayName("ExactStellarClientScheme")
    class ClientSchemeTest {

        private MockClientSigner mockSigner;
        private ExactStellarClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientSigner(SAMPLE_ADDRESS_1);
            scheme = new ExactStellarClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SAMPLE_ADDRESS_1, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class,
                () -> new ExactStellarClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", StellarConstants.STELLAR_PUBNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "10000000");
            requirements.put("asset", StellarConstants.USDC_PUBNET);
            requirements.put("maxTimeoutSeconds", 60);

            Map<String, Object> payload = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, payload.get("t402Version"));
            assertEquals("exact", payload.get("scheme"));
            assertEquals(StellarConstants.STELLAR_PUBNET, payload.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            assertNotNull(payloadData);
            assertEquals(MOCK_SIGNATURE, payloadData.get("signature"));

            @SuppressWarnings("unchecked")
            Map<String, Object> auth = (Map<String, Object>) payloadData.get("authorization");
            assertNotNull(auth);
            assertEquals(SAMPLE_ADDRESS_1, auth.get("sender"));
            assertEquals(SAMPLE_ADDRESS_2, auth.get("recipient"));
            assertEquals("10000000", auth.get("amount"));
            assertEquals(StellarConstants.USDC_PUBNET, auth.get("tokenContract"));
        }

        @Test
        @DisplayName("should create payment payload async")
        void testCreatePayloadAsync() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", StellarConstants.STELLAR_PUBNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "10000000");

            CompletableFuture<Map<String, Object>> future =
                scheme.createPaymentPayload(requirements);

            Map<String, Object> payload = future.join();

            assertEquals("exact", payload.get("scheme"));
            assertEquals(StellarConstants.STELLAR_PUBNET, payload.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData = (Map<String, Object>) payload.get("payload");
            assertNotNull(payloadData.get("signature"));
        }
    }

    @Nested
    @DisplayName("ExactStellarFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorSigner mockSigner;
        private ExactStellarFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorSigner(Arrays.asList(FACILITATOR_ADDRESS));
            scheme = new ExactStellarFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class,
                () -> new ExactStellarFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(StellarConstants.STELLAR_PUBNET);
            assertEquals(1, signers.size());
            assertEquals(FACILITATOR_ADDRESS, signers.get(0));
        }

        @Test
        @DisplayName("should get extra with facilitator")
        void testGetExtra() {
            Map<String, Object> extra = scheme.getExtra(StellarConstants.STELLAR_PUBNET);
            assertNotNull(extra);
            assertEquals(FACILITATOR_ADDRESS, extra.get("facilitator"));
        }

        @Test
        @DisplayName("should reject invalid payload structure")
        void testVerifyInvalidPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "exact");
            payload.put("network", StellarConstants.STELLAR_PUBNET);

            Map<String, Object> requirements = createValidRequirements();

            ExactStellarFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        @Test
        @DisplayName("should reject scheme mismatch")
        void testVerifySchemeMismatch() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "upto");

            Map<String, Object> requirements = createValidRequirements();

            ExactStellarFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("unsupported_scheme", result.invalidReason);
        }

        @Test
        @DisplayName("should reject network mismatch")
        void testVerifyNetworkMismatch() {
            Map<String, Object> payload = createValidPayload();
            payload.put("network", StellarConstants.STELLAR_TESTNET);

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("network", StellarConstants.STELLAR_PUBNET);

            ExactStellarFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("network_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject recipient mismatch")
        void testVerifyRecipientMismatch() {
            Map<String, Object> payload = createValidPayload();

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo",
                "GDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD");

            ExactStellarFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("recipient_mismatch", result.invalidReason);
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyAmountInsufficient() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "20000000");

            ExactStellarFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("amount_insufficient", result.invalidReason);
        }

        @Test
        @DisplayName("should reject expired authorization")
        void testVerifyAuthorizationExpired() {
            Map<String, Object> payload = createValidPayload();

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadData =
                (Map<String, Object>) payload.get("payload");
            @SuppressWarnings("unchecked")
            Map<String, Object> auth =
                (Map<String, Object>) payloadData.get("authorization");
            auth.put("validUntil", System.currentTimeMillis() / 1000 - 1000);

            Map<String, Object> requirements = createValidRequirements();

            ExactStellarFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("authorization_expired", result.invalidReason);
        }

        @Test
        @DisplayName("should verify valid payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactStellarFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactStellarFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertNotNull(result.transaction);
            assertEquals(SAMPLE_ADDRESS_1, result.payer);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();
            payload.put("scheme", "upto");

            Map<String, Object> requirements = createValidRequirements();

            ExactStellarFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertEquals("unsupported_scheme", result.errorReason);
        }

        private Map<String, Object> createValidPayload() {
            long validUntil = System.currentTimeMillis() / 1000 + 300;

            Map<String, Object> auth = new HashMap<>();
            auth.put("sender", SAMPLE_ADDRESS_1);
            auth.put("recipient", SAMPLE_ADDRESS_2);
            auth.put("amount", "10000000");
            auth.put("tokenContract", StellarConstants.USDC_PUBNET);
            auth.put("nonce", "test-nonce-123");
            auth.put("maxLedger", 1100);
            auth.put("validUntil", validUntil);

            Map<String, Object> payloadData = new HashMap<>();
            payloadData.put("signature", MOCK_SIGNATURE);
            payloadData.put("authorization", auth);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact");
            payload.put("network", StellarConstants.STELLAR_PUBNET);
            payload.put("payload", payloadData);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact");
            requirements.put("network", StellarConstants.STELLAR_PUBNET);
            requirements.put("payTo", SAMPLE_ADDRESS_2);
            requirements.put("maxAmountRequired", "10000000");
            requirements.put("asset", StellarConstants.USDC_PUBNET);
            requirements.put("maxTimeoutSeconds", 60);

            return requirements;
        }
    }

    @Nested
    @DisplayName("StellarSchemes factory")
    class SchemesFactoryTest {

        @Test
        @DisplayName("should create server scheme")
        void testCreateServer() {
            ExactStellarServerScheme server = StellarSchemes.createServer();
            assertNotNull(server);
            assertEquals(StellarConstants.STELLAR_PUBNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create server with custom network")
        void testCreateServerWithNetwork() {
            ExactStellarServerScheme server =
                StellarSchemes.createServer(StellarConstants.STELLAR_TESTNET);
            assertNotNull(server);
            assertEquals(StellarConstants.STELLAR_TESTNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should have correct supported networks")
        void testSupportedNetworks() {
            assertEquals(2, StellarSchemes.SUPPORTED_NETWORKS.size());
            assertTrue(StellarSchemes.SUPPORTED_NETWORKS.contains(
                StellarConstants.STELLAR_PUBNET));
            assertTrue(StellarSchemes.SUPPORTED_NETWORKS.contains(
                StellarConstants.STELLAR_TESTNET));
        }

        @Test
        @DisplayName("should validate networks")
        void testIsValidNetwork() {
            assertTrue(StellarSchemes.isValidNetwork(StellarConstants.STELLAR_PUBNET));
            assertFalse(StellarSchemes.isValidNetwork("eip155:1"));
        }
    }

    // Mock implementations for testing

    static class MockClientSigner implements ClientStellarSigner {
        private final String address;

        MockClientSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> signPayment(
                StellarAuthorization authorization, String network) {
            return CompletableFuture.completedFuture(MOCK_SIGNATURE);
        }
    }

    static class MockFacilitatorSigner implements FacilitatorStellarSigner {
        private final List<String> addresses;
        private int txCount = 0;

        MockFacilitatorSigner(List<String> addresses) {
            this.addresses = addresses;
        }

        @Override
        public List<String> getAddresses() {
            return addresses;
        }

        @Override
        public CompletableFuture<Boolean> verifySignature(
                StellarAuthorization authorization, String signature, String network) {
            return CompletableFuture.completedFuture(MOCK_SIGNATURE.equals(signature));
        }

        @Override
        public CompletableFuture<String> sendTransaction(
                StellarAuthorization authorization, String signature, String network) {
            txCount++;
            return CompletableFuture.completedFuture("MockStellarTxHash" + txCount);
        }

        @Override
        public CompletableFuture<Boolean> confirmTransaction(String txHash, String network) {
            return CompletableFuture.completedFuture(true);
        }

        @Override
        public CompletableFuture<String> getBalance(
                String address, String tokenContract, String network) {
            return CompletableFuture.completedFuture("100000000000");
        }
    }
}
