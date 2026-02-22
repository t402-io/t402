package io.t402.extensions;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class Erc8004ExtensionTest {

    private final ObjectMapper mapper = new ObjectMapper();

    // ========================================================================
    // Declare
    // ========================================================================

    @Test
    void declareCreatesServerExtension() {
        Erc8004Extension.ServerExtension ext = Erc8004Extension.declare(
                42, "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12");

        assertEquals(42, ext.agentId);
        assertEquals("eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12", ext.agentRegistry);
        assertNull(ext.agentWallet);
        assertNull(ext.reputationScore);
        assertNull(ext.feedbackCount);
        assertNull(ext.validationScore);
    }

    @Test
    void declareWithWallet() {
        Erc8004Extension.ServerExtension ext = Erc8004Extension.declare(
                42, "eip155:8453:0xRegistry", "0xWalletAddress");

        assertEquals(42, ext.agentId);
        assertEquals("0xWalletAddress", ext.agentWallet);
    }

    // ========================================================================
    // Parse ServerExtension
    // ========================================================================

    @Test
    void parseValidServerExtension() {
        Map<String, Object> erc8004Data = new HashMap<>();
        erc8004Data.put("agentId", 42);
        erc8004Data.put("agentRegistry", "eip155:8453:0xAbc123");
        erc8004Data.put("agentWallet", "0xWallet");
        erc8004Data.put("reputationScore", 85);
        erc8004Data.put("feedbackCount", 10);
        erc8004Data.put("validationScore", 90);

        Map<String, Object> extensions = Map.of(Erc8004Constants.EXTENSION_KEY, erc8004Data);

        Erc8004Extension.ServerExtension ext = Erc8004Extension.parse(extensions);
        assertNotNull(ext);
        assertEquals(42, ext.agentId);
        assertEquals("eip155:8453:0xAbc123", ext.agentRegistry);
        assertEquals("0xWallet", ext.agentWallet);
        assertEquals(85, ext.reputationScore);
        assertEquals(10, ext.feedbackCount);
        assertEquals(90, ext.validationScore);
    }

    @Test
    void parseMinimalServerExtension() {
        Map<String, Object> erc8004Data = new HashMap<>();
        erc8004Data.put("agentId", 1);
        erc8004Data.put("agentRegistry", "eip155:1:0xDead");

        Map<String, Object> extensions = Map.of(Erc8004Constants.EXTENSION_KEY, erc8004Data);

        Erc8004Extension.ServerExtension ext = Erc8004Extension.parse(extensions);
        assertNotNull(ext);
        assertEquals(1, ext.agentId);
        assertEquals("eip155:1:0xDead", ext.agentRegistry);
        assertNull(ext.agentWallet);
        assertNull(ext.reputationScore);
        assertNull(ext.feedbackCount);
        assertNull(ext.validationScore);
    }

    @Test
    void parseReturnsNullWhenMissing() {
        assertNull(Erc8004Extension.parse(Map.of()));
        assertNull(Erc8004Extension.parse(null));
    }

    @Test
    void parseThrowsOnInvalidType() {
        Map<String, Object> extensions = Map.of(Erc8004Constants.EXTENSION_KEY, "invalid");
        assertThrows(IllegalArgumentException.class,
                () -> Erc8004Extension.parse(extensions));
    }

    @Test
    void parseThrowsOnMissingAgentId() {
        Map<String, Object> erc8004Data = Map.of("agentRegistry", "eip155:1:0x123");
        Map<String, Object> extensions = Map.of(Erc8004Constants.EXTENSION_KEY, erc8004Data);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> Erc8004Extension.parse(extensions));
        assertTrue(ex.getMessage().contains("agentId"));
    }

    @Test
    void parseThrowsOnMissingAgentRegistry() {
        Map<String, Object> erc8004Data = Map.of("agentId", 1);
        Map<String, Object> extensions = Map.of(Erc8004Constants.EXTENSION_KEY, erc8004Data);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> Erc8004Extension.parse(extensions));
        assertTrue(ex.getMessage().contains("agentRegistry"));
    }

    // ========================================================================
    // Parse PayloadExtension
    // ========================================================================

    @Test
    void parsePayloadValid() {
        Map<String, Object> payloadData = new HashMap<>();
        payloadData.put("identityVerified", true);
        payloadData.put("agentId", 42);
        payloadData.put("agentRegistry", "eip155:8453:0xAbc");

        Map<String, Object> extensions = Map.of(Erc8004Constants.EXTENSION_KEY, payloadData);

        Erc8004Extension.PayloadExtension ext = Erc8004Extension.parsePayload(extensions);
        assertNotNull(ext);
        assertTrue(ext.identityVerified);
        assertEquals(42, ext.agentId);
        assertEquals("eip155:8453:0xAbc", ext.agentRegistry);
    }

    @Test
    void parsePayloadReturnsNullWhenMissing() {
        assertNull(Erc8004Extension.parsePayload(Map.of()));
        assertNull(Erc8004Extension.parsePayload(null));
    }

    @Test
    void parsePayloadDefaultsVerifiedToFalse() {
        Map<String, Object> payloadData = new HashMap<>();
        payloadData.put("agentId", 1);
        payloadData.put("agentRegistry", "eip155:1:0x123");

        Map<String, Object> extensions = Map.of(Erc8004Constants.EXTENSION_KEY, payloadData);

        Erc8004Extension.PayloadExtension ext = Erc8004Extension.parsePayload(extensions);
        assertNotNull(ext);
        assertFalse(ext.identityVerified);
    }

    // ========================================================================
    // createPayloadExtension
    // ========================================================================

    @Test
    void createPayloadExtension() {
        Erc8004Extension.PayloadExtension ext = Erc8004Extension.createPayloadExtension(
                42, "eip155:8453:0xAbc", true);

        assertTrue(ext.identityVerified);
        assertEquals(42, ext.agentId);
        assertEquals("eip155:8453:0xAbc", ext.agentRegistry);
    }

    // ========================================================================
    // parseAgentRegistry
    // ========================================================================

    @Test
    void parseAgentRegistryValid() {
        Erc8004Extension.AgentRegistry reg = Erc8004Extension.parseAgentRegistry(
                "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12");

        assertEquals("eip155", reg.namespace);
        assertEquals("8453", reg.chainId);
        assertEquals("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12", reg.address);
        assertEquals("eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12", reg.id);
    }

    @Test
    void parseAgentRegistryThrowsOnTooFewParts() {
        assertThrows(IllegalArgumentException.class,
                () -> Erc8004Extension.parseAgentRegistry("eip155:8453"));
    }

    @Test
    void parseAgentRegistryThrowsOnEmptyParts() {
        assertThrows(IllegalArgumentException.class,
                () -> Erc8004Extension.parseAgentRegistry("eip155::0xAbc"));
    }

    @Test
    void parseAgentRegistryThrowsOnNull() {
        assertThrows(IllegalArgumentException.class,
                () -> Erc8004Extension.parseAgentRegistry(null));
    }

    // ========================================================================
    // verifyPayToMatchesWallet
    // ========================================================================

    @Test
    void verifyPayToMatchesCaseInsensitive() {
        assertTrue(Erc8004Extension.verifyPayToMatchesWallet(
                "0xAbCdEf", "0xabcdef"));
    }

    @Test
    void verifyPayToMismatch() {
        assertFalse(Erc8004Extension.verifyPayToMatchesWallet(
                "0x111", "0x222"));
    }

    @Test
    void verifyPayToNullReturnsfalse() {
        assertFalse(Erc8004Extension.verifyPayToMatchesWallet(null, "0x111"));
        assertFalse(Erc8004Extension.verifyPayToMatchesWallet("0x111", null));
    }

    // ========================================================================
    // normalizeScore
    // ========================================================================

    @Test
    void normalizeScoreBasic() {
        double score = Erc8004Extension.normalizeScore(5, 85, 0);
        assertEquals(85.0, score, 0.001);
    }

    @Test
    void normalizeScoreWithDecimals() {
        // summaryValue=8500, decimals=2 => 85.0
        double score = Erc8004Extension.normalizeScore(3, 8500, 2);
        assertEquals(85.0, score, 0.001);
    }

    @Test
    void normalizeScoreZeroCount() {
        assertEquals(0.0, Erc8004Extension.normalizeScore(0, 999, 0));
    }

    @Test
    void normalizeScoreClampsTo100() {
        double score = Erc8004Extension.normalizeScore(1, 150, 0);
        assertEquals(100.0, score, 0.001);
    }

    @Test
    void normalizeScoreClampsToZero() {
        double score = Erc8004Extension.normalizeScore(1, -50, 0);
        assertEquals(0.0, score, 0.001);
    }

    // ========================================================================
    // buildFeedbackFile
    // ========================================================================

    @Test
    void buildFeedbackFileBasic() {
        Erc8004Extension.FeedbackFile file = Erc8004Extension.buildFeedbackFile(
                42, "eip155:8453:0xReg", "0xClient",
                100, 0, "paymentSuccess", "", null);

        assertEquals(42, file.agentId);
        assertEquals("eip155:8453:0xReg", file.agentRegistry);
        assertEquals("0xClient", file.clientAddress);
        assertEquals(100, file.value);
        assertEquals(0, file.valueDecimals);
        assertEquals("paymentSuccess", file.tag1);
        assertNotNull(file.createdAt);
        assertNull(file.proofOfPayment);
    }

    @Test
    void buildFeedbackFileWithProof() {
        Erc8004Extension.ProofOfPayment proof = new Erc8004Extension.ProofOfPayment(
                "0xFrom", "0xTo", "eip155:8453", "0xTxHash");

        Erc8004Extension.FeedbackFile file = Erc8004Extension.buildFeedbackFile(
                42, "eip155:8453:0xReg", "0xClient",
                100, 0, "paymentSuccess", "responseTime", proof);

        assertNotNull(file.proofOfPayment);
        assertEquals("0xFrom", file.proofOfPayment.fromAddress);
        assertEquals("0xTxHash", file.proofOfPayment.txHash);
    }

    // ========================================================================
    // JSON Serialization
    // ========================================================================

    @Test
    void serverExtensionJsonSerialization() throws Exception {
        Erc8004Extension.ServerExtension ext = Erc8004Extension.declare(
                42, "eip155:8453:0xAbc", "0xWallet");
        ext.reputationScore = 85;

        String json = mapper.writeValueAsString(ext);
        assertTrue(json.contains("\"agentId\":42"));
        assertTrue(json.contains("\"agentRegistry\":\"eip155:8453:0xAbc\""));
        assertTrue(json.contains("\"agentWallet\":\"0xWallet\""));
        assertTrue(json.contains("\"reputationScore\":85"));

        Erc8004Extension.ServerExtension deserialized = mapper.readValue(
                json, Erc8004Extension.ServerExtension.class);
        assertEquals(42, deserialized.agentId);
        assertEquals("eip155:8453:0xAbc", deserialized.agentRegistry);
        assertEquals("0xWallet", deserialized.agentWallet);
        assertEquals(85, deserialized.reputationScore);
    }

    @Test
    void serverExtensionJsonOmitsNulls() throws Exception {
        Erc8004Extension.ServerExtension ext = Erc8004Extension.declare(42, "eip155:1:0x123");

        String json = mapper.writeValueAsString(ext);
        assertFalse(json.contains("agentWallet"));
        assertFalse(json.contains("reputationScore"));
        assertFalse(json.contains("feedbackCount"));
        assertFalse(json.contains("validationScore"));
    }

    @Test
    void payloadExtensionJsonSerialization() throws Exception {
        Erc8004Extension.PayloadExtension ext = new Erc8004Extension.PayloadExtension(
                true, 42, "eip155:8453:0xAbc");

        String json = mapper.writeValueAsString(ext);
        assertTrue(json.contains("\"identityVerified\":true"));

        Erc8004Extension.PayloadExtension deserialized = mapper.readValue(
                json, Erc8004Extension.PayloadExtension.class);
        assertTrue(deserialized.identityVerified);
        assertEquals(42, deserialized.agentId);
    }

    @Test
    void feedbackFileJsonSerialization() throws Exception {
        Erc8004Extension.FeedbackFile file = Erc8004Extension.buildFeedbackFile(
                1, "eip155:1:0xReg", "0xClient", 100, 0, "paymentSuccess", "", null);

        String json = mapper.writeValueAsString(file);
        assertTrue(json.contains("\"agentId\":1"));
        assertFalse(json.contains("proofOfPayment"));

        Erc8004Extension.FeedbackFile deserialized = mapper.readValue(
                json, Erc8004Extension.FeedbackFile.class);
        assertEquals(1, deserialized.agentId);
        assertEquals("0xClient", deserialized.clientAddress);
    }

    // ========================================================================
    // Constants
    // ========================================================================

    @Test
    void extensionKeyIsCorrect() {
        assertEquals("erc8004", Erc8004Constants.EXTENSION_KEY);
    }

    @Test
    void feedbackTagsExist() {
        assertEquals("paymentSuccess", Erc8004Constants.FeedbackTags.PAYMENT_SUCCESS);
        assertEquals("paymentFailed", Erc8004Constants.FeedbackTags.PAYMENT_FAILED);
        assertEquals("starred", Erc8004Constants.FeedbackTags.SERVICE_QUALITY);
        assertEquals("responseTime", Erc8004Constants.FeedbackTags.RESPONSE_TIME);
        assertEquals("uptime", Erc8004Constants.FeedbackTags.UPTIME);
    }

    @Test
    void eip712Constants() {
        assertEquals("IdentityRegistry", Erc8004Constants.IDENTITY_REGISTRY_DOMAIN_NAME);
        assertEquals("1", Erc8004Constants.IDENTITY_REGISTRY_DOMAIN_VERSION);
        assertNotNull(Erc8004Constants.SET_AGENT_WALLET_TYPES);
        assertEquals("uint256", Erc8004Constants.SET_AGENT_WALLET_TYPES.get("agentId"));
        assertEquals("address", Erc8004Constants.SET_AGENT_WALLET_TYPES.get("newWallet"));
    }

    @Test
    void abiConstantsExist() {
        assertNotNull(Erc8004Constants.ABI_REGISTER);
        assertNotNull(Erc8004Constants.ABI_GET_AGENT_WALLET);
        assertNotNull(Erc8004Constants.ABI_TOKEN_URI);
        assertNotNull(Erc8004Constants.ABI_OWNER_OF);
        assertNotNull(Erc8004Constants.ABI_GIVE_FEEDBACK);
        assertNotNull(Erc8004Constants.ABI_GET_SUMMARY);
        assertNotNull(Erc8004Constants.ABI_VALIDATION_REQUEST);
        assertNotNull(Erc8004Constants.ABI_GET_VALIDATION_STATUS);
    }

    // ========================================================================
    // ReputationSummary / ValidationSummary
    // ========================================================================

    @Test
    void reputationSummaryConstructor() {
        Erc8004Extension.ReputationSummary summary = new Erc8004Extension.ReputationSummary(
                42, 10, 850, 1, 85.0);
        assertEquals(42, summary.agentId);
        assertEquals(10, summary.count);
        assertEquals(850, summary.summaryValue);
        assertEquals(1, summary.summaryValueDecimals);
        assertEquals(85.0, summary.normalizedScore, 0.001);
    }

    @Test
    void validationSummaryConstructor() {
        Erc8004Extension.ValidationSummary summary = new Erc8004Extension.ValidationSummary(5, 92);
        assertEquals(5, summary.count);
        assertEquals(92, summary.averageResponse);
    }
}
