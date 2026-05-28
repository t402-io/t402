package io.t402.extensions.dispute;

import java.math.BigInteger;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static io.t402.extensions.dispute.DisputeConstants.*;

/**
 * Signing, verification, and validation helpers for the Dispute extension.
 *
 * Static methods mirror the TypeScript / Go / Python reference impls.
 */
public final class DisputeUtils {

    private DisputeUtils() {}

    // =======================================================================
    // EIP-712 normalization
    // =======================================================================

    public static Map<String, Object> normalizeDisputeForSigning(DisputePayload p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("version", p.getVersion());
        m.put("receiptHash", p.getReceiptHash());
        m.put("reason", p.getReason());
        m.put("requestedAmount", p.getRequestedAmount());
        m.put("validUntil", p.getValidUntil());
        m.put("evidence", p.getEvidence());
        return m;
    }

    public static Map<String, Object> normalizeResolutionForSigning(ResolutionPayload p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("version", p.getVersion());
        m.put("disputeHash", p.getDisputeHash());
        m.put("verdict", p.getVerdict());
        m.put("settledAmount", p.getSettledAmount());
        m.put("arbiter", p.getArbiter());
        m.put("issuedAt", p.getIssuedAt());
        m.put("refundTransaction", p.getRefundTransaction());
        return m;
    }

    // =======================================================================
    // Signing + verification
    // =======================================================================

    /** Sign a dispute payload. signerAddress optionally records a delegate signer. */
    public static SignedDispute createSignedDispute(
        DisputeSigner signer, DisputePayload payload, String signerAddress
    ) throws Exception {
        String sig = signer.signDispute(payload);
        return new SignedDispute(FORMAT_EIP712, sig, payload, signerAddress);
    }

    public static SignedDispute createSignedDispute(
        DisputeSigner signer, DisputePayload payload
    ) throws Exception {
        return createSignedDispute(signer, payload, "");
    }

    public static SignedResolution createSignedResolution(
        DisputeSigner signer, ResolutionPayload payload
    ) throws Exception {
        String sig = signer.signResolution(payload);
        return new SignedResolution(FORMAT_EIP712, sig, payload);
    }

    /** Result of verifying a dispute signature. */
    public record VerifyDisputeResult(boolean valid, String signer, DisputePayload payload) {}

    public static VerifyDisputeResult verifyDispute(
        DisputeVerifier verifier, SignedDispute signed
    ) {
        if (FORMAT_JWS.equals(signed.getFormat())) {
            throw new JWSReservedException();
        }
        if (!FORMAT_EIP712.equals(signed.getFormat()) || signed.getPayload() == null) {
            return new VerifyDisputeResult(false, "", null);
        }
        String recovered;
        try {
            recovered = verifier.recoverDisputeSigner(signed.getPayload(), signed.getSignature());
        } catch (Exception e) {
            return new VerifyDisputeResult(false, "", null);
        }
        if (recovered == null || recovered.isEmpty()) {
            return new VerifyDisputeResult(false, "", null);
        }
        String signer = !signed.getSigner().isEmpty() ? signed.getSigner() : recovered;
        return new VerifyDisputeResult(true, signer, signed.getPayload());
    }

    /** Result of verifying a resolution signature. */
    public record VerifyResolutionResult(boolean valid, String signer, ResolutionPayload payload) {}

    public static VerifyResolutionResult verifyResolution(
        DisputeVerifier verifier, SignedResolution signed, String expectedArbiter
    ) {
        if (FORMAT_JWS.equals(signed.getFormat())) {
            throw new JWSReservedException();
        }
        if (!FORMAT_EIP712.equals(signed.getFormat()) || signed.getPayload() == null) {
            return new VerifyResolutionResult(false, "", null);
        }
        String recovered;
        try {
            recovered = verifier.recoverResolutionSigner(signed.getPayload(), signed.getSignature());
        } catch (Exception e) {
            return new VerifyResolutionResult(false, "", null);
        }
        if (recovered == null || recovered.isEmpty()) {
            return new VerifyResolutionResult(false, "", null);
        }
        if (expectedArbiter != null && !expectedArbiter.isEmpty()
            && !recovered.equalsIgnoreCase(expectedArbiter)) {
            return new VerifyResolutionResult(false, "", null);
        }
        return new VerifyResolutionResult(true, recovered, signed.getPayload());
    }

    /** Whether the envelope is past its validUntil. */
    public static boolean isDisputeExpired(SignedDispute signed, long nowUnix) {
        if (!FORMAT_EIP712.equals(signed.getFormat()) || signed.getPayload() == null) {
            return false;
        }
        return nowUnix > signed.getPayload().getValidUntil();
    }

    /** Spec §Verification rule: verdict ↔ settledAmount consistency. */
    public static boolean isVerdictAmountConsistent(
        SignedResolution resolution, String disputeRequestedAmount
    ) {
        if (!FORMAT_EIP712.equals(resolution.getFormat()) || resolution.getPayload() == null) {
            return true;
        }
        BigInteger settled;
        BigInteger requested;
        try {
            settled = new BigInteger(resolution.getPayload().getSettledAmount());
            requested = new BigInteger(disputeRequestedAmount);
        } catch (NumberFormatException e) {
            return false;
        }
        String verdict = resolution.getPayload().getVerdict();
        return switch (verdict) {
            case VERDICT_DENIED, VERDICT_VOID -> settled.signum() == 0;
            case VERDICT_UPHELD_FULL -> settled.equals(requested);
            case VERDICT_UPHELD_PARTIAL -> settled.signum() > 0 && settled.compareTo(requested) <= 0;
            default -> false;
        };
    }

    // =======================================================================
    // Client helpers
    // =======================================================================

    /** Parameters for {@link #buildDisputePayload}. */
    public record BuildDisputeParams(
        String receiptHash,
        String reason,
        String requestedAmount,
        List<String> evidence,
        long validUntil,    // 0 = default
        int version          // 0 = default to 1
    ) {}

    public static DisputePayload buildDisputePayload(BuildDisputeParams p) {
        int version = p.version() == 0 ? 1 : p.version();
        long validUntil = p.validUntil() == 0
            ? Instant.now().getEpochSecond() + DEFAULT_DISPUTE_VALIDITY_SECONDS
            : p.validUntil();
        List<String> evidence = p.evidence() == null ? List.of() : p.evidence();
        return new DisputePayload(
            version, p.receiptHash(), p.reason(), p.requestedAmount(), validUntil, evidence
        );
    }

    public static SignedDispute buildAndSignDispute(
        DisputeSigner signer, BuildDisputeParams params, String signerAddress
    ) throws Exception {
        return createSignedDispute(signer, buildDisputePayload(params), signerAddress);
    }

    public static Map<String, Object> packageDisputeSubmission(SignedDispute signed) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("submission", signed.toMap());
        Map<String, Object> wrap = new LinkedHashMap<>();
        wrap.put("info", info);
        return wrap;
    }

    public static Map<String, Object> buildDisputeSubmissionBody(SignedDispute signed) {
        Map<String, Object> extensions = new LinkedHashMap<>();
        extensions.put(EXTENSION_KEY, packageDisputeSubmission(signed));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("extensions", extensions);
        return body;
    }

    /** Extract dispute terms from a 402 extensions map. Returns null if absent or malformed. */
    @SuppressWarnings("unchecked")
    public static DisputeTermsInfo extractDisputeTerms(Map<String, Object> extensions) {
        if (extensions == null) return null;
        Object ext = extensions.get(EXTENSION_KEY);
        if (!(ext instanceof Map<?, ?> extMap)) return null;
        Object info = ((Map<String, Object>) extMap).get("info");
        if (!(info instanceof Map<?, ?> infoMap)) return null;
        try {
            return DisputeTermsInfo.fromMap((Map<String, Object>) infoMap);
        } catch (RuntimeException e) {
            return null;
        }
    }

    public static boolean isStandardReason(String reason) {
        return STANDARD_REASONS_SET.contains(reason);
    }

    public static boolean isReasonWellFormed(String reason) {
        return STANDARD_REASONS_SET.contains(reason) || reason.startsWith("x_");
    }

    // =======================================================================
    // Server helpers
    // =======================================================================

    public static Map<String, Object> buildDisputeRequirements(DisputeTermsInfo terms) {
        if (!ARBITER_SCHEMES.contains(terms.getArbiterScheme())) {
            throw new IllegalArgumentException(
                "unsupported arbiterScheme: " + terms.getArbiterScheme()
            );
        }
        if (terms.getDisputeWindow() <= 0) {
            throw new IllegalArgumentException("disputeWindow must be positive");
        }
        if (terms.getSupportedReasons().isEmpty()) {
            throw new IllegalArgumentException("supportedReasons must not be empty");
        }
        Map<String, Object> req = new LinkedHashMap<>();
        req.put("info", terms.toMap());
        return req;
    }

    /** Parse a POST /v2/dispute body. Returns null on malformed input. */
    @SuppressWarnings("unchecked")
    public static SignedDispute parseDisputeSubmission(Object body) {
        if (!(body instanceof Map<?, ?> bodyMap)) return null;
        Object extensions = ((Map<String, Object>) bodyMap).get("extensions");
        if (!(extensions instanceof Map<?, ?> extMap)) return null;
        Object dispute = ((Map<String, Object>) extMap).get(EXTENSION_KEY);
        if (!(dispute instanceof Map<?, ?> dMap)) return null;
        Object info = ((Map<String, Object>) dMap).get("info");
        if (!(info instanceof Map<?, ?> iMap)) return null;
        Object submission = ((Map<String, Object>) iMap).get("submission");
        if (!(submission instanceof Map<?, ?> sMap)) return null;
        try {
            return SignedDispute.fromMap((Map<String, Object>) sMap);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Whether a URI uses a permitted scheme. */
    public static boolean isEvidenceUriAllowed(String uri, List<String> allowedSchemes) {
        int colon = uri.indexOf(':');
        if (colon <= 0) return false;
        String scheme = uri.substring(0, colon);
        return allowedSchemes.contains(scheme);
    }

    /** Whether a reason is in the server's accepted list. */
    public static boolean isReasonSupported(String reason, List<String> supported) {
        return supported.contains(reason);
    }

    public static Map<String, Object> packageResolutionResponse(SignedResolution signed) {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("resolution", signed.toMap());
        Map<String, Object> wrap = new LinkedHashMap<>();
        wrap.put("info", info);
        return wrap;
    }

    /** Inputs for the seven-step ValidateDispute pipeline. */
    public record ValidateDisputeInput(
        DisputeVerifier verifier,
        SignedDispute dispute,
        long receiptIssuedAt,
        String receiptHash,
        String receiptAmount,
        DisputeTermsInfo terms,
        long nowUnix // 0 = Instant.now().getEpochSecond()
    ) {}

    /** Seven-step pipeline from spec §Verification. */
    public static DisputeValidation validateDispute(ValidateDisputeInput in) {
        if (in.dispute() == null || !FORMAT_EIP712.equals(in.dispute().getFormat())) {
            return DisputeValidation.fail(ERR_DISPUTE_UNSUPPORTED_FORMAT);
        }

        // (1) Signature.
        VerifyDisputeResult verify = verifyDispute(in.verifier(), in.dispute());
        if (!verify.valid()) {
            return DisputeValidation.fail(ERR_DISPUTE_INVALID_SIGNATURE);
        }

        DisputePayload payload = in.dispute().getPayload();
        long now = in.nowUnix() == 0 ? Instant.now().getEpochSecond() : in.nowUnix();

        // (2) Envelope expiry.
        if (isDisputeExpired(in.dispute(), now)) {
            return DisputeValidation.fail(
                ERR_DISPUTE_EXPIRED,
                "validUntil=" + payload.getValidUntil() + ", now=" + now
            );
        }

        // (3) Receipt binding.
        if (!payload.getReceiptHash().equalsIgnoreCase(in.receiptHash())) {
            return DisputeValidation.fail(
                ERR_DISPUTE_UNKNOWN_RECEIPT,
                "dispute.receiptHash=" + payload.getReceiptHash() + " vs receipt=" + in.receiptHash()
            );
        }

        // (4) Dispute window.
        long windowEnd = in.receiptIssuedAt() + in.terms().getDisputeWindow();
        if (now < in.receiptIssuedAt() || now > windowEnd) {
            return DisputeValidation.fail(
                ERR_DISPUTE_OUT_OF_WINDOW,
                "window=[" + in.receiptIssuedAt() + "," + windowEnd + "], now=" + now
            );
        }

        // (5) Reason allowed.
        if (!isReasonSupported(payload.getReason(), in.terms().getSupportedReasons())) {
            return DisputeValidation.fail(
                ERR_DISPUTE_INVALID_REASON,
                "reason " + payload.getReason() + " not in supportedReasons"
            );
        }

        // (6) Amount bounded.
        BigInteger requested;
        BigInteger receiptAmt;
        try {
            requested = new BigInteger(payload.getRequestedAmount());
            receiptAmt = new BigInteger(in.receiptAmount());
        } catch (NumberFormatException e) {
            return DisputeValidation.fail(
                ERR_DISPUTE_AMOUNT_EXCEEDS_RECEIPT,
                "amount not a valid integer"
            );
        }
        if (requested.compareTo(receiptAmt) > 0) {
            return DisputeValidation.fail(
                ERR_DISPUTE_AMOUNT_EXCEEDS_RECEIPT,
                "requestedAmount=" + requested + " > receipt.amount=" + receiptAmt
            );
        }

        // (7) Evidence URI schemes.
        List<String> allowed = in.terms().getEvidenceUriSchemes() != null
            ? in.terms().getEvidenceUriSchemes()
            : DEFAULT_EVIDENCE_URI_SCHEMES;
        for (String uri : payload.getEvidence()) {
            if (!isEvidenceUriAllowed(uri, allowed)) {
                return DisputeValidation.fail(
                    ERR_DISPUTE_EVIDENCE_URI_UNSUPPORTED,
                    "URI " + uri + " not in allowed schemes"
                );
            }
        }

        return DisputeValidation.ok();
    }

    /** Inputs for ValidateResolution. */
    public record ValidateResolutionInput(
        DisputeVerifier verifier,
        SignedResolution resolution,
        SignedDispute dispute,
        String disputeHash,
        String expectedArbiter
    ) {}

    public static ResolutionValidation validateResolution(ValidateResolutionInput in) {
        if (in.resolution() == null || !FORMAT_EIP712.equals(in.resolution().getFormat())) {
            return ResolutionValidation.fail(ERR_RESOLUTION_UNSUPPORTED_FORMAT);
        }

        VerifyResolutionResult verify = verifyResolution(
            in.verifier(), in.resolution(), in.expectedArbiter()
        );
        if (!verify.valid()) {
            return ResolutionValidation.fail(ERR_RESOLUTION_INVALID_SIGNATURE);
        }

        ResolutionPayload payload = in.resolution().getPayload();

        if (!payload.getDisputeHash().equalsIgnoreCase(in.disputeHash())) {
            return ResolutionValidation.fail(ERR_RESOLUTION_UNKNOWN_DISPUTE);
        }

        if (!payload.getArbiter().equalsIgnoreCase(in.expectedArbiter())) {
            return ResolutionValidation.fail(ERR_RESOLUTION_ARBITER_MISMATCH);
        }

        if (in.dispute() == null || !FORMAT_EIP712.equals(in.dispute().getFormat())
            || in.dispute().getPayload() == null) {
            return ResolutionValidation.fail(
                ERR_RESOLUTION_UNSUPPORTED_FORMAT, "dispute is not eip712"
            );
        }
        if (!isVerdictAmountConsistent(in.resolution(), in.dispute().getPayload().getRequestedAmount())) {
            return ResolutionValidation.fail(
                ERR_RESOLUTION_VERDICT_AMOUNT_INCONSISTENT,
                "verdict=" + payload.getVerdict()
                    + ", settled=" + payload.getSettledAmount()
                    + ", requested=" + in.dispute().getPayload().getRequestedAmount()
            );
        }

        return ResolutionValidation.ok();
    }
}
