package io.t402.extensions;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * ERC-8004 Agent Identity and Reputation Extension for the t402 protocol.
 *
 * <p>Provides agent identity verification, reputation scoring, and validation
 * status based on the ERC-8004 standard. Agents register on-chain with an
 * Identity Registry; reputation and validation data is aggregated from trusted
 * reviewers for Sybil resistance.</p>
 *
 * <p>Extension data flows as follows:</p>
 * <ol>
 *   <li>Server declares {@link ServerExtension} in PaymentRequired.extensions</li>
 *   <li>Client verifies agent identity and echoes {@link PayloadExtension} in PaymentPayload.extensions</li>
 *   <li>Server checks reputation/validation before verification</li>
 * </ol>
 */
public class Erc8004Extension {

    private Erc8004Extension() {}

    // ========================================================================
    // Agent Registry
    // ========================================================================

    /**
     * Parsed agent registry identifier.
     *
     * <p>Format: {@code {namespace}:{chainId}:{contractAddress}}</p>
     */
    public static class AgentRegistry {
        public String namespace;
        public String chainId;
        public String address;
        public String id;

        public AgentRegistry() {}

        public AgentRegistry(String namespace, String chainId, String address, String id) {
            this.namespace = namespace;
            this.chainId = chainId;
            this.address = address;
            this.id = id;
        }
    }

    /**
     * On-chain agent identity from the Identity Registry.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AgentIdentity {
        public long agentId;
        public String owner;
        public String agentURI;
        public String agentWallet;
        public AgentRegistry registry;

        public AgentIdentity() {}
    }

    // ========================================================================
    // Registration File Types
    // ========================================================================

    /**
     * ERC-8004 Registration File (off-chain JSON at agentURI).
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RegistrationFile {
        public String type;
        public String name;
        public String description;
        public String image;
        public List<ServiceEntry> services;
        public boolean x402Support;
        public boolean active;
        public List<RegistrationEntry> registrations;
        public List<String> supportedTrust;

        public RegistrationFile() {}
    }

    /**
     * Service entry in a registration file.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ServiceEntry {
        public String name;
        public String endpoint;
        public String version;
        public List<String> skills;
        public List<String> domains;

        public ServiceEntry() {}
    }

    /**
     * Registration entry linking an agent ID to a registry.
     */
    public static class RegistrationEntry {
        public int agentId;
        public String agentRegistry;

        public RegistrationEntry() {}
    }

    // ========================================================================
    // Reputation Types
    // ========================================================================

    /**
     * Aggregated reputation summary for an agent.
     */
    public static class ReputationSummary {
        public long agentId;
        public long count;
        public long summaryValue;
        public int summaryValueDecimals;
        /** Normalized 0-100 score derived from summaryValue/summaryValueDecimals. */
        public double normalizedScore;

        public ReputationSummary() {}

        public ReputationSummary(long agentId, long count, long summaryValue,
                                 int summaryValueDecimals, double normalizedScore) {
            this.agentId = agentId;
            this.count = count;
            this.summaryValue = summaryValue;
            this.summaryValueDecimals = summaryValueDecimals;
            this.normalizedScore = normalizedScore;
        }
    }

    /**
     * Off-chain feedback file structure.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FeedbackFile {
        public String agentRegistry;
        public int agentId;
        public String clientAddress;
        public String createdAt;
        public int value;
        public int valueDecimals;
        public String tag1;
        public String tag2;
        public String endpoint;
        public ProofOfPayment proofOfPayment;

        public FeedbackFile() {}
    }

    /**
     * Proof of payment for linking feedback to a transaction.
     */
    public static class ProofOfPayment {
        public String fromAddress;
        public String toAddress;
        public String chainId;
        public String txHash;

        public ProofOfPayment() {}

        public ProofOfPayment(String fromAddress, String toAddress, String chainId, String txHash) {
            this.fromAddress = fromAddress;
            this.toAddress = toAddress;
            this.chainId = chainId;
            this.txHash = txHash;
        }
    }

    // ========================================================================
    // Validation Types
    // ========================================================================

    /**
     * Validation status for a request.
     */
    public static class ValidationStatus {
        public String validatorAddress;
        public long agentId;
        public int response;
        public String responseHash;
        public String tag;
        public long lastUpdate;

        public ValidationStatus() {}
    }

    /**
     * Aggregated validation summary.
     */
    public static class ValidationSummary {
        public long count;
        public int averageResponse;

        public ValidationSummary() {}

        public ValidationSummary(long count, int averageResponse) {
            this.count = count;
            this.averageResponse = averageResponse;
        }
    }

    // ========================================================================
    // Extension Types (for PaymentRequired / PaymentPayload)
    // ========================================================================

    /**
     * ERC-8004 extension data in PaymentRequired.extensions.
     *
     * <p>Declared by the server to advertise agent identity and reputation.</p>
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ServerExtension {
        public int agentId;
        public String agentRegistry;
        public String agentWallet;
        public Integer reputationScore;
        public Integer feedbackCount;
        public Integer validationScore;

        public ServerExtension() {}

        public ServerExtension(int agentId, String agentRegistry) {
            this.agentId = agentId;
            this.agentRegistry = agentRegistry;
        }
    }

    /**
     * ERC-8004 extension data echoed in PaymentPayload.extensions.
     *
     * <p>Sent by the client to confirm identity verification status.</p>
     */
    public static class PayloadExtension {
        public boolean identityVerified;
        public int agentId;
        public String agentRegistry;

        public PayloadExtension() {}

        public PayloadExtension(boolean identityVerified, int agentId, String agentRegistry) {
            this.identityVerified = identityVerified;
            this.agentId = agentId;
            this.agentRegistry = agentRegistry;
        }
    }

    // ========================================================================
    // Static Methods — Declare / Parse / Validate
    // ========================================================================

    /**
     * Declares an ERC-8004 server extension for PaymentRequired.
     *
     * @param agentId agent's on-chain ID
     * @param agentRegistry registry identifier ({@code namespace:chainId:address})
     * @return a new ServerExtension
     */
    public static ServerExtension declare(int agentId, String agentRegistry) {
        return new ServerExtension(agentId, agentRegistry);
    }

    /**
     * Declares an ERC-8004 server extension with an explicit wallet address.
     *
     * @param agentId agent's on-chain ID
     * @param agentRegistry registry identifier
     * @param agentWallet agent's verified wallet address
     * @return a new ServerExtension
     */
    public static ServerExtension declare(int agentId, String agentRegistry, String agentWallet) {
        ServerExtension ext = new ServerExtension(agentId, agentRegistry);
        ext.agentWallet = agentWallet;
        return ext;
    }

    /**
     * Creates a client-side payload extension after verifying identity.
     *
     * @param agentId agent ID that was verified
     * @param agentRegistry registry used
     * @param verified whether verification passed
     * @return a PayloadExtension to echo back in the payment payload
     */
    public static PayloadExtension createPayloadExtension(
            int agentId, String agentRegistry, boolean verified) {
        return new PayloadExtension(verified, agentId, agentRegistry);
    }

    /**
     * Extracts ERC-8004 extension data from PaymentRequired extensions.
     *
     * @param extensions the extensions map from PaymentRequired
     * @return parsed ServerExtension, or null if not present
     * @throws IllegalArgumentException if the extension is present but invalid
     */
    @SuppressWarnings("unchecked")
    public static ServerExtension parse(Map<String, Object> extensions) {
        if (extensions == null || !extensions.containsKey(Erc8004Constants.EXTENSION_KEY)) {
            return null;
        }

        Object raw = extensions.get(Erc8004Constants.EXTENSION_KEY);
        if (!(raw instanceof Map)) {
            throw new IllegalArgumentException("Invalid erc8004 extension: expected Map");
        }

        Map<String, Object> map = (Map<String, Object>) raw;

        if (!map.containsKey("agentId")) {
            throw new IllegalArgumentException("Invalid erc8004 extension: missing agentId");
        }
        if (!map.containsKey("agentRegistry")) {
            throw new IllegalArgumentException("Invalid erc8004 extension: missing agentRegistry");
        }

        ServerExtension ext = new ServerExtension();
        ext.agentId = toInt(map.get("agentId"));
        ext.agentRegistry = (String) map.get("agentRegistry");
        ext.agentWallet = map.get("agentWallet") instanceof String
                ? (String) map.get("agentWallet") : null;
        ext.reputationScore = map.get("reputationScore") instanceof Number
                ? ((Number) map.get("reputationScore")).intValue() : null;
        ext.feedbackCount = map.get("feedbackCount") instanceof Number
                ? ((Number) map.get("feedbackCount")).intValue() : null;
        ext.validationScore = map.get("validationScore") instanceof Number
                ? ((Number) map.get("validationScore")).intValue() : null;

        return ext;
    }

    /**
     * Extracts ERC-8004 payload extension from PaymentPayload extensions.
     *
     * @param extensions the extensions map from PaymentPayload
     * @return parsed PayloadExtension, or null if not present
     * @throws IllegalArgumentException if the extension is present but invalid
     */
    @SuppressWarnings("unchecked")
    public static PayloadExtension parsePayload(Map<String, Object> extensions) {
        if (extensions == null || !extensions.containsKey(Erc8004Constants.EXTENSION_KEY)) {
            return null;
        }

        Object raw = extensions.get(Erc8004Constants.EXTENSION_KEY);
        if (!(raw instanceof Map)) {
            throw new IllegalArgumentException("Invalid erc8004 payload extension: expected Map");
        }

        Map<String, Object> map = (Map<String, Object>) raw;

        if (!map.containsKey("agentId")) {
            throw new IllegalArgumentException("Invalid erc8004 payload extension: missing agentId");
        }
        if (!map.containsKey("agentRegistry")) {
            throw new IllegalArgumentException("Invalid erc8004 payload extension: missing agentRegistry");
        }

        PayloadExtension ext = new PayloadExtension();
        ext.agentId = toInt(map.get("agentId"));
        ext.agentRegistry = (String) map.get("agentRegistry");
        ext.identityVerified = map.get("identityVerified") instanceof Boolean
                ? (Boolean) map.get("identityVerified") : false;

        return ext;
    }

    // ========================================================================
    // Identity Helpers
    // ========================================================================

    /**
     * Parses an agent registry ID string into components.
     *
     * @param registryId format: {@code {namespace}:{chainId}:{address}}
     * @return parsed AgentRegistry
     * @throws IllegalArgumentException if the format is invalid
     */
    public static AgentRegistry parseAgentRegistry(String registryId) {
        if (registryId == null) {
            throw new IllegalArgumentException("Agent registry ID must not be null");
        }
        String[] parts = registryId.split(":", 3);
        if (parts.length < 3) {
            throw new IllegalArgumentException(
                    "Invalid agent registry ID: " + registryId
                            + ". Expected format: namespace:chainId:address");
        }
        String namespace = parts[0];
        String chainId = parts[1];
        String address = parts[2];

        if (namespace.isEmpty() || chainId.isEmpty() || address.isEmpty()) {
            throw new IllegalArgumentException(
                    "Invalid agent registry ID: " + registryId
                            + ". All parts must be non-empty");
        }

        return new AgentRegistry(namespace, chainId, address, registryId);
    }

    /**
     * Verifies that a payTo address matches the declared agentWallet.
     *
     * <p>Case-insensitive comparison for EVM-style hex addresses.</p>
     *
     * @param payTo address from PaymentRequirements
     * @param agentWallet agent's registered wallet address
     * @return true if addresses match (case-insensitive)
     */
    public static boolean verifyPayToMatchesWallet(String payTo, String agentWallet) {
        if (payTo == null || agentWallet == null) {
            return false;
        }
        return payTo.equalsIgnoreCase(agentWallet);
    }

    // ========================================================================
    // Reputation Helpers
    // ========================================================================

    /**
     * Normalizes a raw reputation summary value to a 0-100 score.
     *
     * @param count number of feedback records
     * @param summaryValue raw summary value from the contract
     * @param summaryValueDecimals decimal precision of the summary value
     * @return normalized score in range [0, 100], or 0 if count is 0
     */
    public static double normalizeScore(long count, long summaryValue, int summaryValueDecimals) {
        if (count == 0) {
            return 0.0;
        }
        double divisor = Math.pow(10, summaryValueDecimals);
        double raw = summaryValue / divisor;
        return Math.min(100.0, Math.max(0.0, raw));
    }

    /**
     * Builds an off-chain feedback file with optional proof of payment.
     *
     * @param agentId agent's numeric ID
     * @param agentRegistry registry identifier
     * @param clientAddress address of the feedback submitter
     * @param value feedback value (e.g. 100 for positive)
     * @param valueDecimals decimal precision for the value
     * @param tag1 primary classification tag
     * @param tag2 secondary classification tag
     * @param proofOfPayment optional payment proof from settlement
     * @return a FeedbackFile object ready for JSON serialization
     */
    public static FeedbackFile buildFeedbackFile(
            int agentId,
            String agentRegistry,
            String clientAddress,
            int value,
            int valueDecimals,
            String tag1,
            String tag2,
            ProofOfPayment proofOfPayment) {
        FeedbackFile file = new FeedbackFile();
        file.agentRegistry = agentRegistry;
        file.agentId = agentId;
        file.clientAddress = clientAddress;
        file.createdAt = Instant.now().toString();
        file.value = value;
        file.valueDecimals = valueDecimals;
        file.tag1 = tag1;
        file.tag2 = tag2;
        file.proofOfPayment = proofOfPayment;
        return file;
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private static int toInt(Object obj) {
        if (obj instanceof Number) {
            return ((Number) obj).intValue();
        }
        if (obj instanceof String) {
            return Integer.parseInt((String) obj);
        }
        throw new IllegalArgumentException("Cannot convert to int: " + obj);
    }
}
