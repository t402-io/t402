package io.t402.schemes.stacks.exact_direct;

import io.t402.schemes.stacks.*;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests for Stacks exact-direct scheme implementations.
 */
@DisplayName("Exact-Direct Stacks Schemes")
class ExactDirectStacksSchemeTest {

    // Valid Stacks principal addresses
    private static final String SENDER_ADDRESS =
        "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K";
    private static final String RECIPIENT_ADDRESS =
        "SP1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

    // Testnet addresses
    private static final String TESTNET_SENDER =
        "ST3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K";
    private static final String TESTNET_RECIPIENT =
        "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

    // Valid transaction ID (0x + 64 hex chars)
    private static final String SAMPLE_TX_ID =
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

    @Nested
    @DisplayName("StacksConstants")
    class ConstantsTest {

        @Test
        @DisplayName("should have correct network identifiers")
        void testNetworkConstants() {
            assertEquals("stacks:1", StacksConstants.MAINNET_CAIP2);
            assertEquals("stacks:2147483648", StacksConstants.TESTNET_CAIP2);
            assertEquals("stacks", StacksConstants.CAIP2_NAMESPACE);
            assertEquals("stacks:*", StacksConstants.CAIP_FAMILY);
        }

        @Test
        @DisplayName("should have correct token constants")
        void testTokenConstants() {
            assertEquals("SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                StacksConstants.MAINNET_SUSDC_CONTRACT);
            assertEquals("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
                StacksConstants.TESTNET_SUSDC_CONTRACT);
            assertEquals(6, StacksConstants.SUSDC_DECIMALS);
            assertEquals("sUSDC", StacksConstants.SUSDC_SYMBOL);
        }

        @Test
        @DisplayName("should validate correct principal addresses")
        void testValidPrincipals() {
            assertTrue(StacksConstants.isValidPrincipal(SENDER_ADDRESS));
            assertTrue(StacksConstants.isValidPrincipal(RECIPIENT_ADDRESS));
            assertTrue(StacksConstants.isValidPrincipal(TESTNET_SENDER));
            assertTrue(StacksConstants.isValidPrincipal(TESTNET_RECIPIENT));
            // Contract principal
            assertTrue(StacksConstants.isValidPrincipal(
                "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"));
        }

        @Test
        @DisplayName("should reject invalid principal addresses")
        void testInvalidPrincipals() {
            assertFalse(StacksConstants.isValidPrincipal(null));
            assertFalse(StacksConstants.isValidPrincipal(""));
            assertFalse(StacksConstants.isValidPrincipal("short"));
            assertFalse(StacksConstants.isValidPrincipal("0x1234567890abcdef")); // Ethereum-style
            assertFalse(StacksConstants.isValidPrincipal("XX3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K")); // Wrong prefix
        }

        @Test
        @DisplayName("should validate correct transaction IDs")
        void testValidTxIds() {
            assertTrue(StacksConstants.isValidTxId(SAMPLE_TX_ID));
            assertTrue(StacksConstants.isValidTxId(
                "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"));
        }

        @Test
        @DisplayName("should reject invalid transaction IDs")
        void testInvalidTxIds() {
            assertFalse(StacksConstants.isValidTxId(null));
            assertFalse(StacksConstants.isValidTxId(""));
            assertFalse(StacksConstants.isValidTxId("not-a-txid"));
            assertFalse(StacksConstants.isValidTxId("0x123")); // Too short
            assertFalse(StacksConstants.isValidTxId(
                "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")); // Missing 0x
        }

        @Test
        @DisplayName("should identify Stacks networks")
        void testIsStacksNetwork() {
            assertTrue(StacksConstants.isStacksNetwork(StacksConstants.MAINNET_CAIP2));
            assertTrue(StacksConstants.isStacksNetwork(StacksConstants.TESTNET_CAIP2));
            assertTrue(StacksConstants.isStacksNetwork("stacks:custom"));
            assertFalse(StacksConstants.isStacksNetwork("eip155:1"));
            assertFalse(StacksConstants.isStacksNetwork("polkadot:abc"));
            assertFalse(StacksConstants.isStacksNetwork(null));
        }

        @Test
        @DisplayName("should identify supported networks")
        void testIsSupportedNetwork() {
            assertTrue(StacksConstants.isSupportedNetwork(StacksConstants.MAINNET_CAIP2));
            assertTrue(StacksConstants.isSupportedNetwork(StacksConstants.TESTNET_CAIP2));
            assertFalse(StacksConstants.isSupportedNetwork("stacks:custom"));
            assertFalse(StacksConstants.isSupportedNetwork("eip155:1"));
        }

        @Test
        @DisplayName("should normalize network identifiers")
        void testNormalizeNetwork() {
            assertEquals(StacksConstants.MAINNET_CAIP2, StacksConstants.normalizeNetwork("stacks"));
            assertEquals(StacksConstants.MAINNET_CAIP2, StacksConstants.normalizeNetwork("mainnet"));
            assertEquals(StacksConstants.TESTNET_CAIP2, StacksConstants.normalizeNetwork("testnet"));
            assertEquals(StacksConstants.MAINNET_CAIP2, StacksConstants.normalizeNetwork(null));
            assertEquals("stacks:custom", StacksConstants.normalizeNetwork("stacks:custom"));
        }

        @Test
        @DisplayName("should get default contracts")
        void testGetDefaultContract() {
            assertEquals(StacksConstants.MAINNET_SUSDC_CONTRACT,
                StacksConstants.getDefaultContract(StacksConstants.MAINNET_CAIP2));
            assertEquals(StacksConstants.TESTNET_SUSDC_CONTRACT,
                StacksConstants.getDefaultContract(StacksConstants.TESTNET_CAIP2));
            assertThrows(IllegalArgumentException.class, () ->
                StacksConstants.getDefaultContract("stacks:unknown"));
        }

        @Test
        @DisplayName("should get API URLs")
        void testGetApiUrl() {
            assertEquals(StacksConstants.MAINNET_API_URL,
                StacksConstants.getApiUrl(StacksConstants.MAINNET_CAIP2));
            assertEquals(StacksConstants.TESTNET_API_URL,
                StacksConstants.getApiUrl(StacksConstants.TESTNET_CAIP2));
            assertThrows(IllegalArgumentException.class, () ->
                StacksConstants.getApiUrl("stacks:unknown"));
        }

        @Test
        @DisplayName("should compare principals case-insensitively")
        void testComparePrincipals() {
            assertTrue(StacksConstants.comparePrincipals(SENDER_ADDRESS, SENDER_ADDRESS));
            assertTrue(StacksConstants.comparePrincipals(
                SENDER_ADDRESS, SENDER_ADDRESS.toLowerCase()));
            assertFalse(StacksConstants.comparePrincipals(SENDER_ADDRESS, RECIPIENT_ADDRESS));
            assertFalse(StacksConstants.comparePrincipals(null, SENDER_ADDRESS));
            assertFalse(StacksConstants.comparePrincipals(SENDER_ADDRESS, null));
        }

        @Test
        @DisplayName("should identify testnet")
        void testIsTestnet() {
            assertTrue(StacksConstants.isTestnet(StacksConstants.TESTNET_CAIP2));
            assertFalse(StacksConstants.isTestnet(StacksConstants.MAINNET_CAIP2));
        }

        @Test
        @DisplayName("should get correct address prefix")
        void testGetAddressPrefix() {
            assertEquals("SP", StacksConstants.getAddressPrefix(StacksConstants.MAINNET_CAIP2));
            assertEquals("ST", StacksConstants.getAddressPrefix(StacksConstants.TESTNET_CAIP2));
        }
    }

    @Nested
    @DisplayName("ExactDirectPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build and serialize payload")
        void testBuildPayload() {
            ExactDirectPayload payload = ExactDirectPayload.builder()
                .txId(SAMPLE_TX_ID)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1000000")
                .contractAddress(StacksConstants.MAINNET_SUSDC_CONTRACT)
                .build();

            assertEquals(SAMPLE_TX_ID, payload.getTxId());
            assertEquals(SENDER_ADDRESS, payload.getFrom());
            assertEquals(RECIPIENT_ADDRESS, payload.getTo());
            assertEquals("1000000", payload.getAmount());
            assertEquals(StacksConstants.MAINNET_SUSDC_CONTRACT, payload.getContractAddress());
        }

        @Test
        @DisplayName("should convert to/from map")
        void testToFromMap() {
            ExactDirectPayload original = ExactDirectPayload.builder()
                .txId(SAMPLE_TX_ID)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1500000")
                .contractAddress(StacksConstants.MAINNET_SUSDC_CONTRACT)
                .build();

            Map<String, Object> map = original.toMap();
            assertEquals(SAMPLE_TX_ID, map.get("txId"));
            assertEquals(SENDER_ADDRESS, map.get("from"));
            assertEquals(RECIPIENT_ADDRESS, map.get("to"));
            assertEquals("1500000", map.get("amount"));
            assertEquals(StacksConstants.MAINNET_SUSDC_CONTRACT, map.get("contractAddress"));

            ExactDirectPayload restored = ExactDirectPayload.fromMap(map);
            assertEquals(original.getTxId(), restored.getTxId());
            assertEquals(original.getFrom(), restored.getFrom());
            assertEquals(original.getTo(), restored.getTo());
            assertEquals(original.getAmount(), restored.getAmount());
            assertEquals(original.getContractAddress(), restored.getContractAddress());
        }

        @Test
        @DisplayName("should reject missing required fields")
        void testMissingFields() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .from(SENDER_ADDRESS)
                    .to(RECIPIENT_ADDRESS)
                    .amount("1000000")
                    .build()); // Missing txId

            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txId(SAMPLE_TX_ID)
                    .to(RECIPIENT_ADDRESS)
                    .amount("1000000")
                    .build()); // Missing from

            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txId(SAMPLE_TX_ID)
                    .from(SENDER_ADDRESS)
                    .amount("1000000")
                    .build()); // Missing to

            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txId(SAMPLE_TX_ID)
                    .from(SENDER_ADDRESS)
                    .to(RECIPIENT_ADDRESS)
                    .build()); // Missing amount
        }
    }

    @Nested
    @DisplayName("ExactDirectStacksServerScheme")
    class ServerSchemeTest {

        private ExactDirectStacksServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactDirectStacksServerScheme();
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50", StacksConstants.MAINNET_CAIP2);

            assertEquals("1500000", result.get("amount"));
            assertEquals(StacksConstants.MAINNET_SUSDC_CONTRACT, result.get("contractAddress"));
            assertEquals(6, result.get("decimals"));
            assertEquals("sUSDC", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse dollar-prefixed price")
        void testParsePriceDollar() {
            Map<String, Object> result = scheme.parsePrice("$0.10", StacksConstants.MAINNET_CAIP2);

            assertEquals("100000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse atomic amount")
        void testParsePriceAtomic() {
            Map<String, Object> result = scheme.parsePrice("1500000", StacksConstants.MAINNET_CAIP2);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse price with suffix")
        void testParsePriceWithSuffix() {
            Map<String, Object> result = scheme.parsePrice("2.00 sUSDC", StacksConstants.MAINNET_CAIP2);

            assertEquals("2000000", result.get("amount"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "eip155:1"));
        }

        @Test
        @DisplayName("should create payment requirements")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                StacksConstants.MAINNET_CAIP2,
                RECIPIENT_ADDRESS,
                "1000000",
                null,
                300
            );

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(StacksConstants.MAINNET_CAIP2, requirements.get("network"));
            assertEquals(RECIPIENT_ADDRESS, requirements.get("payTo"));
            assertEquals("1000000", requirements.get("maxAmountRequired"));
            assertEquals(300, requirements.get("maxTimeoutSeconds"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertNotNull(extra);
            assertEquals(StacksConstants.MAINNET_SUSDC_CONTRACT, extra.get("contractAddress"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact-direct");
            valid.put("network", StacksConstants.MAINNET_CAIP2);
            valid.put("payTo", RECIPIENT_ADDRESS);

            assertTrue(scheme.validateRequirements(valid));

            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "exact");
            wrongScheme.put("network", StacksConstants.MAINNET_CAIP2);
            wrongScheme.put("payTo", RECIPIENT_ADDRESS);
            assertFalse(scheme.validateRequirements(wrongScheme));

            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact-direct");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", RECIPIENT_ADDRESS);
            assertFalse(scheme.validateRequirements(wrongNetwork));
        }

        @Test
        @DisplayName("should get payment requirements with description")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", RECIPIENT_ADDRESS, "Test API"
            );

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(StacksConstants.MAINNET_CAIP2, requirements.get("network"));
            assertEquals(RECIPIENT_ADDRESS, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertEquals("Test API", requirements.get("resource"));

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
            assertNotNull(extra);
            assertEquals(StacksConstants.MAINNET_SUSDC_CONTRACT, extra.get("contractAddress"));
            assertEquals("sUSDC", extra.get("assetSymbol"));
            assertEquals(6, extra.get("assetDecimals"));
        }

        @Test
        @DisplayName("should use Testnet network")
        void testTestnetNetwork() {
            ExactDirectStacksServerScheme testnetScheme =
                new ExactDirectStacksServerScheme(StacksConstants.TESTNET_CAIP2);

            assertEquals(StacksConstants.TESTNET_CAIP2, testnetScheme.getDefaultNetwork());
        }
    }

    @Nested
    @DisplayName("ExactDirectStacksClientScheme")
    class ClientSchemeTest {

        private MockClientStacksSigner mockSigner;
        private ExactDirectStacksClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientStacksSigner(SENDER_ADDRESS);
            scheme = new ExactDirectStacksClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SENDER_ADDRESS, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () -> new ExactDirectStacksClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePayloadSync() {
            Map<String, Object> requirements = createClientRequirements();

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("exact-direct", result.get("scheme"));
            assertEquals(StacksConstants.MAINNET_CAIP2, result.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.get("payload");
            assertNotNull(payload);
            assertEquals(SAMPLE_TX_ID, payload.get("txId"));
            assertEquals(SENDER_ADDRESS, payload.get("from"));
            assertEquals(RECIPIENT_ADDRESS, payload.get("to"));
            assertEquals("1000000", payload.get("amount"));
            assertEquals(StacksConstants.MAINNET_SUSDC_CONTRACT, payload.get("contractAddress"));
        }

        @Test
        @DisplayName("should reject invalid requirements")
        void testInvalidRequirements() {
            Map<String, Object> noPayTo = new HashMap<>();
            noPayTo.put("network", StacksConstants.MAINNET_CAIP2);
            noPayTo.put("maxAmountRequired", "1000000");
            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(noPayTo));

            Map<String, Object> badNetwork = new HashMap<>();
            badNetwork.put("network", "eip155:1");
            badNetwork.put("payTo", RECIPIENT_ADDRESS);
            badNetwork.put("maxAmountRequired", "1000000");
            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(badNetwork));

            Map<String, Object> zeroAmount = new HashMap<>();
            zeroAmount.put("network", StacksConstants.MAINNET_CAIP2);
            zeroAmount.put("payTo", RECIPIENT_ADDRESS);
            zeroAmount.put("maxAmountRequired", "0");
            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(zeroAmount));
        }

        @Test
        @DisplayName("should resolve contract from extra")
        void testResolveContractFromExtra() {
            Map<String, Object> requirements = createClientRequirements();
            Map<String, Object> extra = new HashMap<>();
            extra.put("contractAddress", "SP_CUSTOM.custom-token");
            requirements.put("extra", extra);

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.get("payload");
            assertEquals("SP_CUSTOM.custom-token", payload.get("contractAddress"));
        }

        private Map<String, Object> createClientRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", StacksConstants.MAINNET_CAIP2);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            return requirements;
        }
    }

    @Nested
    @DisplayName("ExactDirectStacksFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorStacksSigner mockSigner;
        private ExactDirectStacksFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorStacksSigner();
            Map<String, List<String>> addresses = new HashMap<>();
            addresses.put(StacksConstants.MAINNET_CAIP2, List.of(RECIPIENT_ADDRESS));
            scheme = new ExactDirectStacksFacilitatorScheme(mockSigner, addresses, 0); // Disable age check for tests
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class, () ->
                new ExactDirectStacksFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(StacksConstants.MAINNET_CAIP2);
            assertEquals(1, signers.size());
            assertEquals(RECIPIENT_ADDRESS, signers.get(0));

            List<String> noSigners = scheme.getSigners("stacks:unknown");
            assertTrue(noSigners.isEmpty());
        }

        @Test
        @DisplayName("should get extra with token metadata")
        void testGetExtra() {
            Map<String, Object> extra = scheme.getExtra(StacksConstants.MAINNET_CAIP2);
            assertNotNull(extra);
            assertEquals(StacksConstants.MAINNET_SUSDC_CONTRACT, extra.get("contractAddress"));
            assertEquals("sUSDC", extra.get("assetSymbol"));
            assertEquals(6, extra.get("assetDecimals"));
        }

        @Test
        @DisplayName("should return null extra for unsupported network")
        void testGetExtraUnsupported() {
            Map<String, Object> extra = scheme.getExtra("stacks:unknown");
            assertNull(extra);
        }

        @Test
        @DisplayName("should verify valid payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setTransactionData(createSuccessfulTransaction());

            ExactDirectStacksFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.isValid);
            assertNull(result.invalidReason);
            assertEquals(SENDER_ADDRESS, result.payer);
        }

        @Test
        @DisplayName("should reject invalid payload structure")
        void testVerifyInvalidPayloadStructure() {
            Map<String, Object> payload = new HashMap<>();
            // Missing "payload" key

            Map<String, Object> requirements = createValidRequirements();

            ExactDirectStacksFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_payload_structure", result.invalidReason);
        }

        @Test
        @DisplayName("should reject transaction not found")
        void testVerifyTransactionNotFound() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setTransactionData(null);

            ExactDirectStacksFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("transaction_not_found", result.invalidReason);
        }

        @Test
        @DisplayName("should reject failed transaction")
        void testVerifyFailedTransaction() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            Map<String, Object> failedTx = createSuccessfulTransaction();
            failedTx.put("tx_status", "abort_by_post_condition");
            mockSigner.setTransactionData(failedTx);

            ExactDirectStacksFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("transaction_failed"));
        }

        @Test
        @DisplayName("should reject wrong transaction type")
        void testVerifyWrongTxType() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            Map<String, Object> wrongType = createSuccessfulTransaction();
            wrongType.put("tx_type", "token_transfer");
            mockSigner.setTransactionData(wrongType);

            ExactDirectStacksFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("invalid_tx_type"));
        }

        @Test
        @DisplayName("should reject sender mismatch")
        void testVerifySenderMismatch() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            Map<String, Object> wrongSender = createSuccessfulTransaction();
            wrongSender.put("sender_address", "SP_WRONG_SENDER_ADDRESS_ABCDEFG1234567");
            mockSigner.setTransactionData(wrongSender);

            ExactDirectStacksFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("sender_mismatch"));
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than transferred

            mockSigner.setTransactionData(createSuccessfulTransaction());

            ExactDirectStacksFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("amount_insufficient"));
        }

        @Test
        @DisplayName("should reject recipient mismatch")
        void testVerifyRecipientMismatch() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo", "SP_DIFFERENT_RECIPIENT_ABCDEFGHIJKLMNOP");

            mockSigner.setTransactionData(createSuccessfulTransaction());

            ExactDirectStacksFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertTrue(result.invalidReason.contains("recipient_mismatch"));
        }

        @Test
        @DisplayName("should reject replay attack")
        void testVerifyReplayAttack() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setTransactionData(createSuccessfulTransaction());

            // First verification should pass
            ExactDirectStacksFacilitatorScheme.VerificationResult result1 =
                scheme.verifySync(payload, requirements);
            assertTrue(result1.isValid);

            // Second verification with same txId should fail
            ExactDirectStacksFacilitatorScheme.VerificationResult result2 =
                scheme.verifySync(payload, requirements);
            assertFalse(result2.isValid);
            assertEquals("transaction_already_used", result2.invalidReason);
        }

        @Test
        @DisplayName("should reject invalid tx ID format")
        void testVerifyInvalidTxIdFormat() {
            Map<String, Object> inner = new HashMap<>();
            inner.put("txId", "not-a-valid-tx-id");
            inner.put("from", SENDER_ADDRESS);
            inner.put("to", RECIPIENT_ADDRESS);
            inner.put("amount", "1000000");

            Map<String, Object> payload = new HashMap<>();
            payload.put("payload", inner);

            Map<String, Object> requirements = createValidRequirements();

            ExactDirectStacksFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.isValid);
            assertEquals("invalid_tx_id_format", result.invalidReason);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            mockSigner.setTransactionData(createSuccessfulTransaction());

            ExactDirectStacksFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertTrue(result.success);
            assertEquals(SAMPLE_TX_ID, result.transaction);
            assertEquals(SENDER_ADDRESS, result.payer);
            assertEquals(StacksConstants.MAINNET_CAIP2, result.network);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = new HashMap<>(); // Missing payload key
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectStacksFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertFalse(result.success);
            assertNotNull(result.errorReason);
        }

        @Test
        @DisplayName("should convert results to maps")
        void testResultToMap() {
            ExactDirectStacksFacilitatorScheme.VerificationResult validResult =
                ExactDirectStacksFacilitatorScheme.VerificationResult.valid(SENDER_ADDRESS);
            Map<String, Object> validMap = validResult.toMap();
            assertEquals(true, validMap.get("isValid"));
            assertNull(validMap.get("invalidReason"));
            assertEquals(SENDER_ADDRESS, validMap.get("payer"));

            ExactDirectStacksFacilitatorScheme.SettlementResult settlementResult =
                ExactDirectStacksFacilitatorScheme.SettlementResult.success(
                    StacksConstants.MAINNET_CAIP2, SAMPLE_TX_ID, SENDER_ADDRESS);
            Map<String, Object> settlementMap = settlementResult.toMap();
            assertEquals(true, settlementMap.get("success"));
            assertEquals(StacksConstants.MAINNET_CAIP2, settlementMap.get("network"));
            assertEquals(SAMPLE_TX_ID, settlementMap.get("transaction"));
        }

        private Map<String, Object> createValidPayload() {
            Map<String, Object> inner = new HashMap<>();
            inner.put("txId", SAMPLE_TX_ID);
            inner.put("from", SENDER_ADDRESS);
            inner.put("to", RECIPIENT_ADDRESS);
            inner.put("amount", "1000000");
            inner.put("contractAddress", StacksConstants.MAINNET_SUSDC_CONTRACT);

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact-direct");
            payload.put("network", StacksConstants.MAINNET_CAIP2);
            payload.put("payload", inner);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact-direct");
            requirements.put("network", StacksConstants.MAINNET_CAIP2);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");

            Map<String, Object> extra = new HashMap<>();
            extra.put("contractAddress", StacksConstants.MAINNET_SUSDC_CONTRACT);
            requirements.put("extra", extra);

            return requirements;
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> createSuccessfulTransaction() {
            // Build function args for SIP-010 transfer
            List<Map<String, Object>> functionArgs = new ArrayList<>();

            Map<String, Object> amountArg = new HashMap<>();
            amountArg.put("name", "amount");
            amountArg.put("repr", "u1000000");
            amountArg.put("type", "uint");
            functionArgs.add(amountArg);

            Map<String, Object> recipientArg = new HashMap<>();
            recipientArg.put("name", "recipient");
            recipientArg.put("repr", "'" + RECIPIENT_ADDRESS);
            recipientArg.put("type", "principal");
            functionArgs.add(recipientArg);

            Map<String, Object> memoArg = new HashMap<>();
            memoArg.put("name", "memo");
            memoArg.put("repr", "none");
            memoArg.put("type", "(optional (buff 34))");
            functionArgs.add(memoArg);

            Map<String, Object> contractCall = new HashMap<>();
            contractCall.put("contract_id", StacksConstants.MAINNET_SUSDC_CONTRACT);
            contractCall.put("function_name", "transfer");
            contractCall.put("function_args", functionArgs);

            Map<String, Object> tx = new HashMap<>();
            tx.put("tx_id", SAMPLE_TX_ID);
            tx.put("tx_status", "success");
            tx.put("tx_type", "contract_call");
            tx.put("sender_address", SENDER_ADDRESS);
            tx.put("burn_block_time", System.currentTimeMillis() / 1000); // Current time
            tx.put("contract_call", contractCall);

            return tx;
        }
    }

    @Nested
    @DisplayName("StacksSchemes Factory")
    class StacksSchemesTest {

        @Test
        @DisplayName("should create client scheme")
        void testCreateClient() {
            MockClientStacksSigner signer = new MockClientStacksSigner(SENDER_ADDRESS);
            ExactDirectStacksClientScheme client = StacksSchemes.createClient(signer);
            assertNotNull(client);
            assertEquals(SENDER_ADDRESS, client.getAddress());
        }

        @Test
        @DisplayName("should create server scheme")
        void testCreateServer() {
            ExactDirectStacksServerScheme server = StacksSchemes.createServer();
            assertNotNull(server);
            assertEquals(StacksConstants.MAINNET_CAIP2, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create server scheme with custom network")
        void testCreateServerWithNetwork() {
            ExactDirectStacksServerScheme server = StacksSchemes.createServer(StacksConstants.TESTNET_CAIP2);
            assertNotNull(server);
            assertEquals(StacksConstants.TESTNET_CAIP2, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create facilitator scheme")
        void testCreateFacilitator() {
            MockFacilitatorStacksSigner signer = new MockFacilitatorStacksSigner();
            ExactDirectStacksFacilitatorScheme facilitator = StacksSchemes.createFacilitator(signer);
            assertNotNull(facilitator);
        }

        @Test
        @DisplayName("should return correct scheme identifier")
        void testGetScheme() {
            assertEquals("exact-direct", StacksSchemes.getScheme());
        }

        @Test
        @DisplayName("should validate networks")
        void testIsValidNetwork() {
            assertTrue(StacksSchemes.isValidNetwork("stacks:1"));
            assertTrue(StacksSchemes.isValidNetwork("stacks:2147483648"));
            assertFalse(StacksSchemes.isValidNetwork("eip155:1"));
        }

        @Test
        @DisplayName("should list supported networks")
        void testSupportedNetworks() {
            assertEquals(2, StacksSchemes.SUPPORTED_NETWORKS.size());
            assertTrue(StacksSchemes.SUPPORTED_NETWORKS.contains(StacksConstants.MAINNET_CAIP2));
            assertTrue(StacksSchemes.SUPPORTED_NETWORKS.contains(StacksConstants.TESTNET_CAIP2));
        }
    }

    // ============================================================
    // Mock implementations
    // ============================================================

    static class MockClientStacksSigner implements ClientStacksSigner {
        private final String address;

        MockClientStacksSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> transferToken(
                String contractAddress, String to, BigInteger amount) {
            return CompletableFuture.completedFuture(SAMPLE_TX_ID);
        }
    }

    static class MockFacilitatorStacksSigner implements FacilitatorStacksSigner {
        private Map<String, Object> transactionData;

        void setTransactionData(Map<String, Object> data) {
            this.transactionData = data;
        }

        @Override
        public List<String> getAddresses(String network) {
            return List.of(RECIPIENT_ADDRESS);
        }

        @Override
        public CompletableFuture<Map<String, Object>> queryTransaction(String txId) {
            return CompletableFuture.completedFuture(transactionData);
        }
    }
}
