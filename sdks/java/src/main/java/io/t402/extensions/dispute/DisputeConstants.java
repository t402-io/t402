package io.t402.extensions.dispute;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Constants for the Dispute extension.
 *
 * <p>EIP-712 domain and type definitions matching specs/extensions/dispute.md.
 * Mirrors the TypeScript / Go / Python reference implementations.
 */
public final class DisputeConstants {

    private DisputeConstants() {}

    /** Extension key used in extensions["dispute"]. */
    public static final String EXTENSION_KEY = "dispute";

    /** Default envelope lifetime: 24h per spec §Security Considerations. */
    public static final long DEFAULT_DISPUTE_VALIDITY_SECONDS = 24L * 60 * 60;

    /** EIP-712 domain (chainId=1 — off-chain envelope per spec §Signature Formats). */
    public static final String DOMAIN_NAME = "T402Dispute";
    public static final String DOMAIN_VERSION = "1";
    public static final long DOMAIN_CHAIN_ID = 1L;

    public static final String DISPUTE_PRIMARY_TYPE = "Dispute";
    public static final String RESOLUTION_PRIMARY_TYPE = "Resolution";

    public static Map<String, Object> disputeDomain() {
        return Map.of(
            "name", DOMAIN_NAME,
            "version", DOMAIN_VERSION,
            "chainId", DOMAIN_CHAIN_ID
        );
    }

    /** Resolution domain shares name space with dispute domain. */
    public static Map<String, Object> resolutionDomain() {
        return disputeDomain();
    }

    public static List<Map<String, String>> disputeTypes() {
        return List.of(
            Map.of("name", "version", "type", "uint256"),
            Map.of("name", "receiptHash", "type", "bytes32"),
            Map.of("name", "reason", "type", "string"),
            Map.of("name", "requestedAmount", "type", "uint256"),
            Map.of("name", "validUntil", "type", "uint256"),
            Map.of("name", "evidence", "type", "string[]")
        );
    }

    public static List<Map<String, String>> resolutionTypes() {
        return List.of(
            Map.of("name", "version", "type", "uint256"),
            Map.of("name", "disputeHash", "type", "bytes32"),
            Map.of("name", "verdict", "type", "string"),
            Map.of("name", "settledAmount", "type", "uint256"),
            Map.of("name", "arbiter", "type", "address"),
            Map.of("name", "issuedAt", "type", "uint256"),
            Map.of("name", "refundTransaction", "type", "string")
        );
    }

    // --- Closed-enum constants ---

    public static final String REASON_NOT_DELIVERED = "not_delivered";
    public static final String REASON_PARTIAL_DELIVERY = "partial_delivery";
    public static final String REASON_QUALITY_ISSUE = "quality_issue";
    public static final String REASON_UNAUTHORIZED = "unauthorized";
    public static final String REASON_SERVICE_UNAVAILABLE = "service_unavailable";
    public static final String REASON_DUPLICATE_CHARGE = "duplicate_charge";
    public static final String REASON_OTHER = "other";

    /** Closed-enum standard dispute reasons (servers MAY also accept x_* extensions). */
    public static final List<String> STANDARD_DISPUTE_REASONS = List.of(
        REASON_NOT_DELIVERED,
        REASON_PARTIAL_DELIVERY,
        REASON_QUALITY_ISSUE,
        REASON_UNAUTHORIZED,
        REASON_SERVICE_UNAVAILABLE,
        REASON_DUPLICATE_CHARGE,
        REASON_OTHER
    );

    public static final String VERDICT_UPHELD_FULL = "upheld_full";
    public static final String VERDICT_UPHELD_PARTIAL = "upheld_partial";
    public static final String VERDICT_DENIED = "denied";
    public static final String VERDICT_VOID = "void";

    public static final List<String> DISPUTE_VERDICTS = List.of(
        VERDICT_UPHELD_FULL,
        VERDICT_UPHELD_PARTIAL,
        VERDICT_DENIED,
        VERDICT_VOID
    );

    public static final String ARBITER_FACILITATOR = "facilitator";
    public static final String ARBITER_CONTRACT = "contract";
    public static final String ARBITER_EXTERNAL = "external";
    public static final String ARBITER_NONE = "none";

    public static final List<String> ARBITER_SCHEMES = List.of(
        ARBITER_FACILITATOR,
        ARBITER_CONTRACT,
        ARBITER_EXTERNAL,
        ARBITER_NONE
    );

    /** Default acceptable evidence URI schemes (spec §Extension Data). */
    public static final List<String> DEFAULT_EVIDENCE_URI_SCHEMES = List.of(
        "ipfs", "arweave", "https"
    );

    /** Closed-enum signature formats. */
    public static final String FORMAT_EIP712 = "eip712";
    public static final String FORMAT_JWS = "jws";

    // --- Validation error codes ---

    public static final String ERR_DISPUTE_INVALID_SIGNATURE = "dispute_invalid_signature";
    public static final String ERR_DISPUTE_UNKNOWN_RECEIPT = "dispute_unknown_receipt";
    public static final String ERR_DISPUTE_OUT_OF_WINDOW = "dispute_out_of_window";
    public static final String ERR_DISPUTE_INVALID_REASON = "dispute_invalid_reason";
    public static final String ERR_DISPUTE_AMOUNT_EXCEEDS_RECEIPT = "dispute_amount_exceeds_receipt";
    public static final String ERR_DISPUTE_EVIDENCE_URI_UNSUPPORTED = "dispute_evidence_uri_unsupported";
    public static final String ERR_DISPUTE_EXPIRED = "dispute_expired";
    public static final String ERR_DISPUTE_UNSUPPORTED_FORMAT = "dispute_unsupported_format";

    public static final String ERR_RESOLUTION_INVALID_SIGNATURE = "resolution_invalid_signature";
    public static final String ERR_RESOLUTION_ARBITER_MISMATCH = "resolution_arbiter_mismatch";
    public static final String ERR_RESOLUTION_UNKNOWN_DISPUTE = "resolution_unknown_dispute";
    public static final String ERR_RESOLUTION_VERDICT_AMOUNT_INCONSISTENT =
        "resolution_verdict_amount_inconsistent";
    public static final String ERR_RESOLUTION_UNSUPPORTED_FORMAT = "resolution_unsupported_format";

    /** Standard reasons indexed for O(1) membership tests. */
    static final Set<String> STANDARD_REASONS_SET = Set.copyOf(STANDARD_DISPUTE_REASONS);
}
