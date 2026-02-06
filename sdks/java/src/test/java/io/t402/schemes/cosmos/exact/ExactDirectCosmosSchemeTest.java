package io.t402.schemes.cosmos.exact;

import io.t402.schemes.cosmos.*;

import static org.junit.jupiter.api.Assertions.*;

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
 * Tests for Exact-Direct Cosmos scheme implementations.
 */
@DisplayName("Exact-Direct Cosmos Schemes")
class ExactDirectCosmosSchemeTest {

    private static final String SENDER_ADDRESS = "noble1sender123abc";
    private static final String RECIPIENT_ADDRESS = "noble1merchant456def";
    private static final String SAMPLE_TX_HASH = "ABC123DEF456GHI789";

    @Nested
    @DisplayName("ExactDirectPayload")
    class PayloadTest {

        @Test
        @DisplayName("should build a valid payload")
        void testBuildPayload() {
            ExactDirectPayload payload = ExactDirectPayload.builder()
                .txHash(SAMPLE_TX_HASH)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1000000")
                .denom("uusdc")
                .build();

            assertEquals(SAMPLE_TX_HASH, payload.getTxHash());
            assertEquals(SENDER_ADDRESS, payload.getFrom());
            assertEquals(RECIPIENT_ADDRESS, payload.getTo());
            assertEquals("1000000", payload.getAmount());
            assertEquals("uusdc", payload.getDenom());
        }

        @Test
        @DisplayName("should build payload without denom")
        void testBuildPayloadWithoutDenom() {
            ExactDirectPayload payload = ExactDirectPayload.builder()
                .txHash(SAMPLE_TX_HASH)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1000000")
                .build();

            assertNull(payload.getDenom());
        }

        @Test
        @DisplayName("should convert payload to map and back")
        void testPayloadRoundTrip() {
            ExactDirectPayload original = ExactDirectPayload.builder()
                .txHash(SAMPLE_TX_HASH)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1500000")
                .denom("uusdc")
                .build();

            Map<String, Object> map = original.toMap();
            assertEquals(SAMPLE_TX_HASH, map.get("txHash"));
            assertEquals(SENDER_ADDRESS, map.get("from"));
            assertEquals(RECIPIENT_ADDRESS, map.get("to"));
            assertEquals("1500000", map.get("amount"));
            assertEquals("uusdc", map.get("denom"));

            ExactDirectPayload restored = ExactDirectPayload.fromMap(map);
            assertEquals(original.getTxHash(), restored.getTxHash());
            assertEquals(original.getFrom(), restored.getFrom());
            assertEquals(original.getTo(), restored.getTo());
            assertEquals(original.getAmount(), restored.getAmount());
            assertEquals(original.getDenom(), restored.getDenom());
        }

        @Test
        @DisplayName("should omit denom from map when null")
        void testToMapWithoutDenom() {
            ExactDirectPayload payload = ExactDirectPayload.builder()
                .txHash(SAMPLE_TX_HASH)
                .from(SENDER_ADDRESS)
                .to(RECIPIENT_ADDRESS)
                .amount("1000000")
                .build();

            Map<String, Object> map = payload.toMap();
            assertFalse(map.containsKey("denom"));
        }

        @Test
        @DisplayName("should throw for missing txHash")
        void testMissingTxHash() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .from(SENDER_ADDRESS)
                    .to(RECIPIENT_ADDRESS)
                    .amount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should throw for missing from")
        void testMissingFrom() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .to(RECIPIENT_ADDRESS)
                    .amount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should throw for missing to")
        void testMissingTo() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .from(SENDER_ADDRESS)
                    .amount("1000000")
                    .build());
        }

        @Test
        @DisplayName("should throw for missing amount")
        void testMissingAmount() {
            assertThrows(IllegalArgumentException.class, () ->
                ExactDirectPayload.builder()
                    .txHash(SAMPLE_TX_HASH)
                    .from(SENDER_ADDRESS)
                    .to(RECIPIENT_ADDRESS)
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
    @DisplayName("CosmosTransactionResult")
    class TransactionResultTest {

        @Test
        @DisplayName("should report success for code 0")
        void testIsSuccessTrue() {
            CosmosTransactionResult result = CosmosTransactionResult.builder()
                .txHash(SAMPLE_TX_HASH)
                .height("12345")
                .code(0)
                .build();

            assertTrue(result.isSuccess());
        }

        @Test
        @DisplayName("should report failure for non-zero code")
        void testIsSuccessFalse() {
            CosmosTransactionResult result = CosmosTransactionResult.builder()
                .txHash(SAMPLE_TX_HASH)
                .height("12345")
                .code(1)
                .build();

            assertFalse(result.isSuccess());
        }

        @Test
        @DisplayName("should store all fields")
        void testAllFields() {
            List<Map<String, Object>> messages = new ArrayList<>();
            CosmosTransactionResult result = CosmosTransactionResult.builder()
                .txHash(SAMPLE_TX_HASH)
                .height("12345")
                .code(0)
                .rawLog("[]")
                .gasWanted("200000")
                .gasUsed("150000")
                .timestamp("2026-01-26T00:00:00Z")
                .messages(messages)
                .build();

            assertEquals(SAMPLE_TX_HASH, result.getTxHash());
            assertEquals("12345", result.getHeight());
            assertEquals(0, result.getCode());
            assertEquals("[]", result.getRawLog());
            assertEquals("200000", result.getGasWanted());
            assertEquals("150000", result.getGasUsed());
            assertEquals("2026-01-26T00:00:00Z", result.getTimestamp());
            assertSame(messages, result.getMessages());
        }
    }

    @Nested
    @DisplayName("ExactDirectCosmosServerScheme")
    class ServerSchemeTest {

        private ExactDirectCosmosServerScheme scheme;

        @BeforeEach
        void setUp() {
            scheme = new ExactDirectCosmosServerScheme();
        }

        @Test
        @DisplayName("should parse decimal price")
        void testParsePriceDecimal() {
            Map<String, Object> result = scheme.parsePrice("1.50",
                CosmosConstants.NOBLE_MAINNET);

            assertEquals("1500000", result.get("amount"));
            assertEquals(CosmosConstants.USDC_DENOM, result.get("asset"));
            assertEquals(6, result.get("decimals"));
            assertEquals("USDC", result.get("symbol"));
        }

        @Test
        @DisplayName("should parse integer price as atomic units")
        void testParsePriceInteger() {
            Map<String, Object> result = scheme.parsePrice("1500000",
                CosmosConstants.NOBLE_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse dollar sign price")
        void testParsePriceDollarSign() {
            Map<String, Object> result = scheme.parsePrice("$1.50",
                CosmosConstants.NOBLE_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse numeric price")
        void testParsePriceNumber() {
            Map<String, Object> result = scheme.parsePrice(1.50,
                CosmosConstants.NOBLE_MAINNET);

            assertEquals("1500000", result.get("amount"));
        }

        @Test
        @DisplayName("should parse map price")
        void testParsePriceMap() {
            Map<String, Object> priceMap = new HashMap<>();
            priceMap.put("amount", "2000000");
            priceMap.put("asset", "uusdc");

            Map<String, Object> result = scheme.parsePrice(priceMap,
                CosmosConstants.NOBLE_MAINNET);

            assertEquals("2000000", result.get("amount"));
            assertEquals("uusdc", result.get("asset"));
        }

        @Test
        @DisplayName("should parse price for testnet")
        void testParsePriceTestnet() {
            Map<String, Object> result = scheme.parsePrice("1.00",
                CosmosConstants.NOBLE_TESTNET);

            assertEquals("1000000", result.get("amount"));
            assertEquals(CosmosConstants.USDC_DENOM, result.get("asset"));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testParsePriceInvalidNetwork() {
            assertThrows(IllegalArgumentException.class, () ->
                scheme.parsePrice("1.00", "cosmos:unknown"));
        }

        @Test
        @DisplayName("should create complete payment requirements")
        void testGetPaymentRequirements() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "1.50", "cosmos:noble-1", RECIPIENT_ADDRESS, "API Access");

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals("cosmos:noble-1", requirements.get("network"));
            assertEquals(RECIPIENT_ADDRESS, requirements.get("payTo"));
            assertEquals("1500000", requirements.get("maxAmountRequired"));
            assertEquals(CosmosConstants.USDC_DENOM, requirements.get("asset"));
            assertEquals(CosmosConstants.DEFAULT_VALIDITY_DURATION,
                requirements.get("maxTimeoutSeconds"));
            assertEquals("API Access", requirements.get("resource"));
            assertEquals(2, requirements.get("t402Version"));
        }

        @Test
        @DisplayName("should create requirements with simplified params")
        void testGetPaymentRequirementsSimple() {
            Map<String, Object> requirements = scheme.getPaymentRequirements(
                "2.00", RECIPIENT_ADDRESS, "Premium Content");

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(CosmosConstants.NOBLE_MAINNET, requirements.get("network"));
            assertEquals(RECIPIENT_ADDRESS, requirements.get("payTo"));
            assertEquals("2000000", requirements.get("maxAmountRequired"));
        }

        @Test
        @DisplayName("should create requirements with custom network")
        void testCreatePaymentRequirements() {
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                CosmosConstants.NOBLE_TESTNET,
                RECIPIENT_ADDRESS,
                "2000000",
                null,
                600
            );

            assertEquals("exact-direct", requirements.get("scheme"));
            assertEquals(CosmosConstants.NOBLE_TESTNET, requirements.get("network"));
            assertEquals(RECIPIENT_ADDRESS, requirements.get("payTo"));
            assertEquals("2000000", requirements.get("maxAmountRequired"));
            assertEquals(CosmosConstants.USDC_DENOM, requirements.get("asset"));
            assertEquals(600, requirements.get("maxTimeoutSeconds"));
        }

        @Test
        @DisplayName("should use custom asset when provided")
        void testCreatePaymentRequirementsCustomAsset() {
            String customDenom = "ibc/abc123";
            Map<String, Object> requirements = scheme.createPaymentRequirements(
                CosmosConstants.NOBLE_MAINNET,
                RECIPIENT_ADDRESS,
                "1000000",
                customDenom,
                300
            );

            assertEquals(customDenom, requirements.get("asset"));
        }

        @Test
        @DisplayName("should enhance payment requirements")
        void testEnhancePaymentRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact-direct");
            requirements.put("network", CosmosConstants.NOBLE_MAINNET);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "uusdc");

            Map<String, Object> supportedKind = new HashMap<>();
            Map<String, Object> kindExtra = new HashMap<>();
            kindExtra.put("assetSymbol", "USDC");
            kindExtra.put("assetDecimals", 6);
            supportedKind.put("extra", kindExtra);

            Map<String, Object> enhanced = scheme.enhancePaymentRequirements(
                requirements, supportedKind);

            @SuppressWarnings("unchecked")
            Map<String, Object> extra = (Map<String, Object>) enhanced.get("extra");
            assertNotNull(extra);
            assertEquals("noble-1", extra.get("chainId"));
            assertEquals("noble", extra.get("bech32Prefix"));
            assertEquals("uusdc", extra.get("denom"));
            assertEquals("USDC", extra.get("assetSymbol"));
            assertEquals(6, extra.get("assetDecimals"));
        }

        @Test
        @DisplayName("should validate requirements")
        void testValidateRequirements() {
            Map<String, Object> valid = new HashMap<>();
            valid.put("scheme", "exact-direct");
            valid.put("network", CosmosConstants.NOBLE_MAINNET);
            valid.put("payTo", RECIPIENT_ADDRESS);

            assertTrue(scheme.validateRequirements(valid));

            // Missing scheme
            Map<String, Object> noScheme = new HashMap<>();
            noScheme.put("network", CosmosConstants.NOBLE_MAINNET);
            noScheme.put("payTo", RECIPIENT_ADDRESS);
            assertFalse(scheme.validateRequirements(noScheme));

            // Wrong scheme
            Map<String, Object> wrongScheme = new HashMap<>();
            wrongScheme.put("scheme", "exact");
            wrongScheme.put("network", CosmosConstants.NOBLE_MAINNET);
            wrongScheme.put("payTo", RECIPIENT_ADDRESS);
            assertFalse(scheme.validateRequirements(wrongScheme));

            // Non-Cosmos network
            Map<String, Object> wrongNetwork = new HashMap<>();
            wrongNetwork.put("scheme", "exact-direct");
            wrongNetwork.put("network", "eip155:1");
            wrongNetwork.put("payTo", RECIPIENT_ADDRESS);
            assertFalse(scheme.validateRequirements(wrongNetwork));

            // Null requirements
            assertFalse(scheme.validateRequirements(null));
        }

        @Test
        @DisplayName("should use default network")
        void testDefaultNetwork() {
            assertEquals(CosmosConstants.NOBLE_MAINNET, scheme.getDefaultNetwork());

            ExactDirectCosmosServerScheme testnetScheme =
                new ExactDirectCosmosServerScheme(CosmosConstants.NOBLE_TESTNET);
            assertEquals(CosmosConstants.NOBLE_TESTNET, testnetScheme.getDefaultNetwork());
        }

        @Test
        @DisplayName("should convert atomic units correctly")
        void testToAtomicUnits() {
            assertEquals("1500000", ExactDirectCosmosServerScheme.toAtomicUnits("1.50", 6));
            assertEquals("1000000", ExactDirectCosmosServerScheme.toAtomicUnits("1.00", 6));
            assertEquals("100", ExactDirectCosmosServerScheme.toAtomicUnits("0.0001", 6));
            assertEquals("1500000", ExactDirectCosmosServerScheme.toAtomicUnits("1500000", 6));
        }
    }

    @Nested
    @DisplayName("ExactDirectCosmosClientScheme")
    class ClientSchemeTest {

        private MockClientSigner mockSigner;
        private ExactDirectCosmosClientScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockClientSigner(SENDER_ADDRESS);
            scheme = new ExactDirectCosmosClientScheme(mockSigner);
        }

        @Test
        @DisplayName("should get address from signer")
        void testGetAddress() {
            assertEquals(SENDER_ADDRESS, scheme.getAddress());
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class,
                () -> new ExactDirectCosmosClientScheme(null));
        }

        @Test
        @DisplayName("should create payment payload")
        void testCreatePaymentPayload() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("t402Version", 2);
            requirements.put("network", CosmosConstants.NOBLE_MAINNET);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "uusdc");

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            assertEquals(2, result.get("t402Version"));
            assertEquals("exact-direct", result.get("scheme"));
            assertEquals(CosmosConstants.NOBLE_MAINNET, result.get("network"));

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.get("payload");
            assertNotNull(payload);
            assertNotNull(payload.get("txHash"));
            assertEquals(SENDER_ADDRESS, payload.get("from"));
            assertEquals(RECIPIENT_ADDRESS, payload.get("to"));
            assertEquals("1000000", payload.get("amount"));
            assertEquals("uusdc", payload.get("denom"));
        }

        @Test
        @DisplayName("should use USDC symbol as asset")
        void testCreatePaymentPayloadUsdcSymbol() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", CosmosConstants.NOBLE_MAINNET);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "USDC");

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.get("payload");
            assertEquals("uusdc", payload.get("denom"));
        }

        @Test
        @DisplayName("should default to uusdc when no asset specified")
        void testCreatePaymentPayloadDefaultDenom() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", CosmosConstants.NOBLE_MAINNET);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");

            Map<String, Object> result = scheme.createPaymentPayloadSync(requirements);

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) result.get("payload");
            assertEquals("uusdc", payload.get("denom"));
        }

        @Test
        @DisplayName("should throw for missing payTo")
        void testMissingPayTo() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", CosmosConstants.NOBLE_MAINNET);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "uusdc");

            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should throw for missing amount")
        void testMissingAmount() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", CosmosConstants.NOBLE_MAINNET);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("asset", "uusdc");

            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should throw for invalid recipient")
        void testInvalidRecipient() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", CosmosConstants.NOBLE_MAINNET);
            requirements.put("payTo", "cosmos1invalidprefix");
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "uusdc");

            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should throw for unsupported network")
        void testUnsupportedNetwork() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", "cosmos:unknown");
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "uusdc");

            assertThrows(IllegalArgumentException.class, () ->
                scheme.createPaymentPayloadSync(requirements));
        }

        @Test
        @DisplayName("should pass correct parameters to signer")
        void testSignerParams() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("network", CosmosConstants.NOBLE_MAINNET);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "uusdc");

            scheme.createPaymentPayloadSync(requirements);

            assertEquals(CosmosConstants.NOBLE_MAINNET, mockSigner.lastNetwork);
            assertEquals(RECIPIENT_ADDRESS, mockSigner.lastTo);
            assertEquals("1000000", mockSigner.lastAmount);
            assertEquals("uusdc", mockSigner.lastDenom);
        }
    }

    @Nested
    @DisplayName("ExactDirectCosmosFacilitatorScheme")
    class FacilitatorSchemeTest {

        private MockFacilitatorSigner mockSigner;
        private ExactDirectCosmosFacilitatorScheme scheme;

        @BeforeEach
        void setUp() {
            mockSigner = new MockFacilitatorSigner();
            scheme = new ExactDirectCosmosFacilitatorScheme(mockSigner);
        }

        @Test
        @DisplayName("should throw when signer is null")
        void testNullSigner() {
            assertThrows(IllegalArgumentException.class,
                () -> new ExactDirectCosmosFacilitatorScheme(null));
        }

        @Test
        @DisplayName("should get signers")
        void testGetSigners() {
            List<String> signers = scheme.getSigners(CosmosConstants.NOBLE_MAINNET);
            assertEquals(1, signers.size());
            assertEquals("noble1facilitator", signers.get(0));
        }

        @Test
        @DisplayName("should get extra metadata")
        void testGetExtra() {
            Map<String, Object> extra = scheme.getExtra(CosmosConstants.NOBLE_MAINNET);
            assertEquals("USDC", extra.get("assetSymbol"));
            assertEquals(6, extra.get("assetDecimals"));
            assertEquals("uusdc", extra.get("assetDenom"));
        }

        @Test
        @DisplayName("should reject missing payload")
        void testVerifyMissingPayload() {
            Map<String, Object> payload = new HashMap<>();
            payload.put("scheme", "exact-direct");
            payload.put("network", CosmosConstants.NOBLE_MAINNET);

            Map<String, Object> requirements = createValidRequirements();

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertEquals("Missing payload", result.error);
        }

        @Test
        @DisplayName("should reject unsupported network")
        void testVerifyUnsupportedNetwork() {
            Map<String, Object> payload = createValidPayload();
            payload.put("network", "cosmos:unknown");

            Map<String, Object> requirements = createValidRequirements();
            requirements.put("network", "cosmos:unknown");

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Unsupported network"));
        }

        @Test
        @DisplayName("should reject invalid sender address")
        void testVerifyInvalidSenderAddress() {
            Map<String, Object> innerPayload = new HashMap<>();
            innerPayload.put("txHash", SAMPLE_TX_HASH);
            innerPayload.put("from", "cosmos1invalidsender");
            innerPayload.put("to", RECIPIENT_ADDRESS);
            innerPayload.put("amount", "1000000");

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact-direct");
            payload.put("network", CosmosConstants.NOBLE_MAINNET);
            payload.put("payload", innerPayload);

            Map<String, Object> requirements = createValidRequirements();

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Invalid sender address"));
        }

        @Test
        @DisplayName("should reject wrong recipient")
        void testVerifyWrongRecipient() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("payTo", "noble1othermerchant");

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Wrong recipient"));
        }

        @Test
        @DisplayName("should reject insufficient amount")
        void testVerifyInsufficientAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "2000000"); // More than 1000000 in mock

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Insufficient amount"));
        }

        @Test
        @DisplayName("should reject wrong denom")
        void testVerifyWrongDenom() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("asset", "uatom"); // Different denom than uusdc in mock

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("not found in transaction"));
        }

        @Test
        @DisplayName("should reject failed transactions")
        void testVerifyFailedTransaction() {
            mockSigner.setTransactionFailed(true);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("failed on-chain"));
        }

        @Test
        @DisplayName("should reject sender mismatch")
        void testVerifySenderMismatch() {
            mockSigner.setMsgSendFromAddress("noble1differentsender");

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertFalse(result.valid);
            assertTrue(result.error.contains("Sender mismatch"));
        }

        @Test
        @DisplayName("should reject replayed transactions")
        void testReplayProtection() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            // First verification should succeed
            ExactDirectCosmosFacilitatorScheme.VerificationResult first =
                scheme.verifySync(payload, requirements);
            assertTrue(first.valid);

            // Second verification of same tx should fail
            ExactDirectCosmosFacilitatorScheme.VerificationResult second =
                scheme.verifySync(payload, requirements);
            assertFalse(second.valid);
            assertTrue(second.error.contains("already been used"));
        }

        @Test
        @DisplayName("should verify valid payload")
        void testVerifyValidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
            assertNull(result.error);
            assertEquals(SENDER_ADDRESS, result.payer);
            assertEquals(CosmosConstants.NOBLE_MAINNET, result.network);
        }

        @Test
        @DisplayName("should settle valid payment")
        void testSettleValidPayment() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectCosmosFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertEquals(ExactDirectCosmosFacilitatorScheme.SettlementStatus.SUCCESS,
                result.status);
            assertEquals(SAMPLE_TX_HASH, result.transaction);
            assertNull(result.error);
        }

        @Test
        @DisplayName("should fail settlement for invalid payload")
        void testSettleInvalidPayload() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "999999999"); // Too much

            ExactDirectCosmosFacilitatorScheme.SettlementResult result =
                scheme.settleSync(payload, requirements);

            assertEquals(ExactDirectCosmosFacilitatorScheme.SettlementStatus.FAILED,
                result.status);
            assertNull(result.transaction);
            assertNotNull(result.error);
        }

        @Test
        @DisplayName("should accept amount greater than required")
        void testVerifyExcessAmount() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("maxAmountRequired", "500000"); // Less than 1000000 in mock

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
        }

        @Test
        @DisplayName("should handle transaction not found")
        void testTransactionNotFound() {
            mockSigner.setThrowOnQuery(true);

            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
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
            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);
            assertTrue(result.valid);
        }

        @Test
        @DisplayName("should use USDC denom by default when asset is USDC symbol")
        void testDefaultDenomForUsdcSymbol() {
            Map<String, Object> payload = createValidPayload();
            Map<String, Object> requirements = createValidRequirements();
            requirements.put("asset", "USDC"); // Symbol instead of denom

            ExactDirectCosmosFacilitatorScheme.VerificationResult result =
                scheme.verifySync(payload, requirements);

            assertTrue(result.valid);
        }

        private Map<String, Object> createValidPayload() {
            Map<String, Object> innerPayload = new HashMap<>();
            innerPayload.put("txHash", SAMPLE_TX_HASH);
            innerPayload.put("from", SENDER_ADDRESS);
            innerPayload.put("to", RECIPIENT_ADDRESS);
            innerPayload.put("amount", "1000000");
            innerPayload.put("denom", "uusdc");

            Map<String, Object> payload = new HashMap<>();
            payload.put("t402Version", 2);
            payload.put("scheme", "exact-direct");
            payload.put("network", CosmosConstants.NOBLE_MAINNET);
            payload.put("payload", innerPayload);

            return payload;
        }

        private Map<String, Object> createValidRequirements() {
            Map<String, Object> requirements = new HashMap<>();
            requirements.put("scheme", "exact-direct");
            requirements.put("network", CosmosConstants.NOBLE_MAINNET);
            requirements.put("payTo", RECIPIENT_ADDRESS);
            requirements.put("maxAmountRequired", "1000000");
            requirements.put("asset", "uusdc");
            requirements.put("maxTimeoutSeconds", 300);

            return requirements;
        }
    }

    @Nested
    @DisplayName("CosmosSchemes Factory")
    class CosmosSchemesTest {

        @Test
        @DisplayName("should create client scheme")
        void testCreateClient() {
            ClientCosmosSigner signer = new MockClientSigner(SENDER_ADDRESS);
            ExactDirectCosmosClientScheme client = CosmosSchemes.createClient(signer);
            assertEquals(SENDER_ADDRESS, client.getAddress());
        }

        @Test
        @DisplayName("should create server scheme with default network")
        void testCreateServer() {
            ExactDirectCosmosServerScheme server = CosmosSchemes.createServer();
            assertEquals(CosmosConstants.NOBLE_MAINNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create server scheme with custom network")
        void testCreateServerWithNetwork() {
            ExactDirectCosmosServerScheme server =
                CosmosSchemes.createServer("cosmos:grand-1");
            assertEquals(CosmosConstants.NOBLE_TESTNET, server.getDefaultNetwork());
        }

        @Test
        @DisplayName("should create facilitator scheme")
        void testCreateFacilitator() {
            FacilitatorCosmosSigner signer = new MockFacilitatorSigner();
            ExactDirectCosmosFacilitatorScheme facilitator =
                CosmosSchemes.createFacilitator(signer);
            assertNotNull(facilitator);
        }

        @Test
        @DisplayName("should return correct scheme identifier")
        void testGetScheme() {
            assertEquals("exact-direct", CosmosSchemes.getScheme());
        }

        @Test
        @DisplayName("should validate networks")
        void testIsValidNetwork() {
            assertTrue(CosmosSchemes.isValidNetwork("cosmos:noble-1"));
            assertTrue(CosmosSchemes.isValidNetwork("cosmos:grand-1"));
            assertFalse(CosmosSchemes.isValidNetwork("eip155:1"));
        }

        @Test
        @DisplayName("should get USDC denom")
        void testGetUsdcDenom() {
            assertEquals("uusdc",
                CosmosSchemes.getUsdcDenom("cosmos:noble-1"));
        }

        @Test
        @DisplayName("should provide supported networks list")
        void testSupportedNetworks() {
            assertEquals(2, CosmosSchemes.SUPPORTED_NETWORKS.size());
            assertTrue(CosmosSchemes.SUPPORTED_NETWORKS.contains("cosmos:noble-1"));
            assertTrue(CosmosSchemes.SUPPORTED_NETWORKS.contains("cosmos:grand-1"));
        }
    }

    // =========================================================================
    // Mock implementations for testing
    // =========================================================================

    /**
     * Mock client signer for testing.
     */
    static class MockClientSigner implements ClientCosmosSigner {
        private final String address;
        String lastNetwork;
        String lastTo;
        String lastAmount;
        String lastDenom;
        private int txCounter = 0;

        MockClientSigner(String address) {
            this.address = address;
        }

        @Override
        public String getAddress() {
            return address;
        }

        @Override
        public CompletableFuture<String> sendTokens(
                String network, String to, String amount, String denom) {
            this.lastNetwork = network;
            this.lastTo = to;
            this.lastAmount = amount;
            this.lastDenom = denom;
            txCounter++;
            return CompletableFuture.completedFuture("MockTxHash" + txCounter);
        }
    }

    /**
     * Mock facilitator signer for testing.
     */
    static class MockFacilitatorSigner implements FacilitatorCosmosSigner {
        private boolean transactionFailed = false;
        private boolean throwOnQuery = false;
        private String msgSendFromAddress = SENDER_ADDRESS;

        @Override
        public List<String> getAddresses(String network) {
            return List.of("noble1facilitator");
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

        /**
         * Sets the from_address in the MsgSend for testing sender mismatch.
         *
         * @param address The from address to use in mock transaction
         */
        void setMsgSendFromAddress(String address) {
            this.msgSendFromAddress = address;
        }

        @Override
        public CompletableFuture<CosmosTransactionResult> queryTransaction(
                String network, String txHash) {

            if (throwOnQuery) {
                CompletableFuture<CosmosTransactionResult> future = new CompletableFuture<>();
                future.completeExceptionally(
                    new RuntimeException("Transaction not found"));
                return future;
            }

            // Build MsgSend message
            Map<String, Object> coin = new HashMap<>();
            coin.put("denom", "uusdc");
            coin.put("amount", "1000000");

            List<Map<String, Object>> coins = new ArrayList<>();
            coins.add(coin);

            Map<String, Object> msgSend = new HashMap<>();
            msgSend.put("@type", CosmosConstants.MSG_TYPE_SEND);
            msgSend.put("from_address", msgSendFromAddress);
            msgSend.put("to_address", RECIPIENT_ADDRESS);
            msgSend.put("amount", coins);

            List<Map<String, Object>> messages = new ArrayList<>();
            messages.add(msgSend);

            int code = transactionFailed ? 1 : 0;
            String rawLog = transactionFailed ? "mock error" : "[]";

            CosmosTransactionResult result = CosmosTransactionResult.builder()
                .txHash(txHash)
                .height("12345")
                .code(code)
                .rawLog(rawLog)
                .gasWanted("200000")
                .gasUsed("150000")
                .timestamp("2026-01-26T00:00:00Z")
                .messages(messages)
                .build();

            return CompletableFuture.completedFuture(result);
        }

        @Override
        public CompletableFuture<String> getBalance(
                String network, String address, String denom) {
            return CompletableFuture.completedFuture("5000000");
        }
    }
}
