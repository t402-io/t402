package io.t402.extensions;

import java.util.Map;

/**
 * Constants for the ERC-8004 agent identity and reputation extension.
 *
 * <p>Includes contract ABIs (as human-readable function signatures),
 * standard feedback tags, and EIP-712 domain constants.</p>
 */
public final class Erc8004Constants {

    private Erc8004Constants() {}

    /** Extension key for ERC-8004 in requirements/payload extensions. */
    public static final String EXTENSION_KEY = "erc8004";

    // ========================================================================
    // Feedback Tags
    // ========================================================================

    /** Standard feedback tags for t402 payment interactions. */
    public static final class FeedbackTags {
        private FeedbackTags() {}

        /** tag1: Payment completed successfully. */
        public static final String PAYMENT_SUCCESS = "paymentSuccess";
        /** tag1: Payment verification failed. */
        public static final String PAYMENT_FAILED = "paymentFailed";
        /** tag1: Service quality rating. */
        public static final String SERVICE_QUALITY = "starred";
        /** tag2: Response time measurement. */
        public static final String RESPONSE_TIME = "responseTime";
        /** tag2: Uptime measurement. */
        public static final String UPTIME = "uptime";
    }

    // ========================================================================
    // EIP-712 Constants
    // ========================================================================

    /** EIP-712 domain name for setAgentWallet signature verification. */
    public static final String IDENTITY_REGISTRY_DOMAIN_NAME = "IdentityRegistry";

    /** EIP-712 domain version for setAgentWallet signature verification. */
    public static final String IDENTITY_REGISTRY_DOMAIN_VERSION = "1";

    // ========================================================================
    // Identity Registry ABI (function signatures)
    // ========================================================================

    /** Function: register(string agentURI, tuple[] metadata) returns (uint256). */
    public static final String ABI_REGISTER = "register(string,(string,bytes)[])";

    /** Function: getAgentWallet(uint256 agentId) returns (address). */
    public static final String ABI_GET_AGENT_WALLET = "getAgentWallet(uint256)";

    /** Function: tokenURI(uint256 tokenId) returns (string). */
    public static final String ABI_TOKEN_URI = "tokenURI(uint256)";

    /** Function: ownerOf(uint256 tokenId) returns (address). */
    public static final String ABI_OWNER_OF = "ownerOf(uint256)";

    /** Function: getMetadata(uint256 agentId, string metadataKey) returns (bytes). */
    public static final String ABI_GET_METADATA = "getMetadata(uint256,string)";

    /** Function: setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature). */
    public static final String ABI_SET_AGENT_WALLET = "setAgentWallet(uint256,address,uint256,bytes)";

    // ========================================================================
    // Reputation Registry ABI (function signatures)
    // ========================================================================

    /** Function: giveFeedback(uint256, int128, uint8, string, string, string, string, bytes32). */
    public static final String ABI_GIVE_FEEDBACK =
            "giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)";

    /** Function: getSummary(uint256, address[], string, string) returns (uint64, int128, uint8). */
    public static final String ABI_GET_SUMMARY = "getSummary(uint256,address[],string,string)";

    /** Function: revokeFeedback(uint256, uint64). */
    public static final String ABI_REVOKE_FEEDBACK = "revokeFeedback(uint256,uint64)";

    /** Function: getClients(uint256) returns (address[]). */
    public static final String ABI_GET_CLIENTS = "getClients(uint256)";

    // ========================================================================
    // Validation Registry ABI (function signatures)
    // ========================================================================

    /** Function: validationRequest(address, uint256, string, bytes32). */
    public static final String ABI_VALIDATION_REQUEST = "validationRequest(address,uint256,string,bytes32)";

    /** Function: validationResponse(bytes32, uint8, string, bytes32, string). */
    public static final String ABI_VALIDATION_RESPONSE = "validationResponse(bytes32,uint8,string,bytes32,string)";

    /** Function: getValidationStatus(bytes32) returns (address, uint256, uint8, bytes32, string, uint256). */
    public static final String ABI_GET_VALIDATION_STATUS = "getValidationStatus(bytes32)";

    /** Function: getSummary(uint256, address[], string) returns (uint64, uint8). */
    public static final String ABI_VALIDATION_GET_SUMMARY = "getSummary(uint256,address[],string)";

    // ========================================================================
    // SetAgentWallet EIP-712 typed data
    // ========================================================================

    /** EIP-712 type hash fields for SetAgentWallet. */
    public static final Map<String, String> SET_AGENT_WALLET_TYPES = Map.of(
            "agentId", "uint256",
            "newWallet", "address",
            "deadline", "uint256",
            "nonce", "uint256"
    );
}
