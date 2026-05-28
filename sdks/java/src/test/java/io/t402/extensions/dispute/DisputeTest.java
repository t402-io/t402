package io.t402.extensions.dispute;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static io.t402.extensions.dispute.DisputeConstants.*;
import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Dispute extension")
class DisputeTest {

    private static final String PAYER = "0x1234567890abcdef1234567890abcdef12345678";
    private static final String ARBITER = "0xabcdef1234567890abcdef1234567890abcdef12";
    private static final String SAMPLE_RECEIPT_HASH =
        "0xcafedade000000000000000000000000000000000000000000000000deadbeef";
    private static final String SAMPLE_DISPUTE_HASH =
        "0xbeefface000000000000000000000000000000000000000000000000feedf00d";
    private static final long NOW = 1_716_000_000L;

    private static class MockSigner implements DisputeSigner {
        final String address;
        MockSigner(String address) { this.address = address; }
        public String signDispute(DisputePayload p) { return "0xdispute_sig_" + address.substring(address.length() - 6); }
        public String signResolution(ResolutionPayload p) { return "0xresolution_sig_" + address.substring(address.length() - 6); }
        public String getAddress() { return address; }
    }

    private static class PassingVerifier implements DisputeVerifier {
        final String address;
        PassingVerifier(String address) { this.address = address; }
        public String recoverDisputeSigner(DisputePayload p, String s) { return address; }
        public String recoverResolutionSigner(ResolutionPayload p, String s) { return address; }
    }

    private static class FailingVerifier implements DisputeVerifier {
        public String recoverDisputeSigner(DisputePayload p, String s) throws Exception {
            throw new Exception("invalid signature");
        }
        public String recoverResolutionSigner(ResolutionPayload p, String s) throws Exception {
            throw new Exception("invalid signature");
        }
    }

    private static DisputePayload sampleDispute() {
        return new DisputePayload(
            1, SAMPLE_RECEIPT_HASH, REASON_NOT_DELIVERED, "1000000",
            NOW + 86_400, List.of("ipfs://QmEvidenceHash/complaint.json")
        );
    }

    private static ResolutionPayload sampleResolution() {
        return new ResolutionPayload(
            1, SAMPLE_DISPUTE_HASH, VERDICT_UPHELD_FULL, "1000000",
            ARBITER, NOW + 100,
            "0xrefundtx0000000000000000000000000000000000000000"
        );
    }

    private static DisputeTermsInfo sampleTerms() {
        return new DisputeTermsInfo(
            ARBITER, ARBITER_FACILITATOR, 86_400L * 7,
            List.of(REASON_NOT_DELIVERED, REASON_PARTIAL_DELIVERY, REASON_QUALITY_ISSUE),
            List.of("ipfs", "arweave", "https")
        );
    }

    // =======================================================================
    // EIP-712 constants
    // =======================================================================

    @Test
    @DisplayName("dispute domain matches spec")
    void disputeDomainMatchesSpec() {
        Map<String, Object> d = disputeDomain();
        assertEquals("T402Dispute", d.get("name"));
        assertEquals("1", d.get("version"));
        assertEquals(1L, d.get("chainId"));
    }

    @Test
    @DisplayName("resolution domain shares name space")
    void resolutionSharesNamespace() {
        assertEquals(disputeDomain().get("name"), resolutionDomain().get("name"));
    }

    @Test
    @DisplayName("dispute types field list")
    void disputeTypesFields() {
        List<String> names = disputeTypes().stream().map(f -> f.get("name")).toList();
        assertEquals(List.of("version", "receiptHash", "reason", "requestedAmount", "validUntil", "evidence"), names);
    }

    @Test
    @DisplayName("resolution types field list")
    void resolutionTypesFields() {
        List<String> names = resolutionTypes().stream().map(f -> f.get("name")).toList();
        assertEquals(List.of("version", "disputeHash", "verdict", "settledAmount", "arbiter", "issuedAt", "refundTransaction"), names);
    }

    @Test
    @DisplayName("normalize dispute carries evidence list")
    void normalizeDisputeEvidence() {
        Map<String, Object> norm = DisputeUtils.normalizeDisputeForSigning(sampleDispute());
        @SuppressWarnings("unchecked")
        List<String> ev = (List<String>) norm.get("evidence");
        assertEquals(1, ev.size());
    }

    @Test
    @DisplayName("normalize resolution defaults refundTransaction to empty")
    void normalizeResolutionDefaultsRefundTx() {
        ResolutionPayload p = new ResolutionPayload(
            1, SAMPLE_DISPUTE_HASH, VERDICT_DENIED, "0", ARBITER, NOW, null
        );
        Map<String, Object> norm = DisputeUtils.normalizeResolutionForSigning(p);
        assertEquals("", norm.get("refundTransaction"));
    }

    // =======================================================================
    // Enums
    // =======================================================================

    @Test
    void standardReasonsMatchSpec() {
        assertEquals(7, STANDARD_DISPUTE_REASONS.size());
        assertTrue(STANDARD_DISPUTE_REASONS.contains(REASON_NOT_DELIVERED));
        assertTrue(STANDARD_DISPUTE_REASONS.contains(REASON_DUPLICATE_CHARGE));
    }

    @Test
    void verdictsMatchSpec() {
        assertEquals(4, DISPUTE_VERDICTS.size());
    }

    @Test
    void arbiterSchemesMatchSpec() {
        assertEquals(4, ARBITER_SCHEMES.size());
    }

    @Test
    void extensionKey() {
        assertEquals("dispute", EXTENSION_KEY);
    }

    @Test
    void defaultEvidenceUriSchemes() {
        assertEquals(List.of("ipfs", "arweave", "https"), DEFAULT_EVIDENCE_URI_SCHEMES);
    }

    @Test
    void isStandardReason() {
        assertTrue(DisputeUtils.isStandardReason(REASON_NOT_DELIVERED));
        assertFalse(DisputeUtils.isStandardReason("x_custom"));
        assertFalse(DisputeUtils.isStandardReason("typo"));
    }

    @Test
    void isReasonWellFormedAcceptsXPrefix() {
        assertTrue(DisputeUtils.isReasonWellFormed(REASON_NOT_DELIVERED));
        assertTrue(DisputeUtils.isReasonWellFormed("x_anything"));
        assertFalse(DisputeUtils.isReasonWellFormed("typo"));
    }

    // =======================================================================
    // Signing roundtrip
    // =======================================================================

    @Test
    void createAndVerifyDispute() throws Exception {
        MockSigner signer = new MockSigner(PAYER);
        SignedDispute signed = DisputeUtils.createSignedDispute(signer, sampleDispute());
        assertEquals(FORMAT_EIP712, signed.getFormat());
        DisputeUtils.VerifyDisputeResult result =
            DisputeUtils.verifyDispute(new PassingVerifier(PAYER), signed);
        assertTrue(result.valid());
        assertEquals(PAYER.toLowerCase(), result.signer().toLowerCase());
    }

    @Test
    void explicitDelegateSigner() throws Exception {
        MockSigner signer = new MockSigner(PAYER);
        String delegate = "0xdelegate1111111111111111111111111111111111";
        SignedDispute signed = DisputeUtils.createSignedDispute(signer, sampleDispute(), delegate);
        assertEquals(delegate, signed.getSigner());
        DisputeUtils.VerifyDisputeResult result =
            DisputeUtils.verifyDispute(new PassingVerifier(PAYER), signed);
        assertEquals(delegate, result.signer());
    }

    @Test
    void createAndVerifyResolution() throws Exception {
        MockSigner signer = new MockSigner(ARBITER);
        SignedResolution signed = DisputeUtils.createSignedResolution(signer, sampleResolution());
        DisputeUtils.VerifyResolutionResult result =
            DisputeUtils.verifyResolution(new PassingVerifier(ARBITER), signed, ARBITER);
        assertTrue(result.valid());
        assertEquals(ARBITER.toLowerCase(), result.signer().toLowerCase());
    }

    @Test
    void verifyDisputeFailsOnBadSignature() throws Exception {
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        DisputeUtils.VerifyDisputeResult result =
            DisputeUtils.verifyDispute(new FailingVerifier(), signed);
        assertFalse(result.valid());
    }

    @Test
    void verifyResolutionArbiterMismatch() throws Exception {
        SignedResolution signed = DisputeUtils.createSignedResolution(new MockSigner(ARBITER), sampleResolution());
        DisputeUtils.VerifyResolutionResult result =
            DisputeUtils.verifyResolution(new PassingVerifier(ARBITER), signed, "0xwrongarbiter");
        assertFalse(result.valid());
    }

    @Test
    void verifyDisputeRejectsJWS() {
        SignedDispute jws = new SignedDispute(FORMAT_JWS, "0x", null, "");
        assertThrows(JWSReservedException.class,
            () -> DisputeUtils.verifyDispute(new FailingVerifier(), jws));
    }

    // =======================================================================
    // Envelope expiry
    // =======================================================================

    @Test
    void notExpiredWhenValidUntilFuture() {
        SignedDispute signed = new SignedDispute(
            FORMAT_EIP712, "0x",
            new DisputePayload(1, SAMPLE_RECEIPT_HASH, REASON_NOT_DELIVERED, "1", NOW + 100, List.of()),
            ""
        );
        assertFalse(DisputeUtils.isDisputeExpired(signed, NOW));
    }

    @Test
    void expiredWhenValidUntilPast() {
        SignedDispute signed = new SignedDispute(
            FORMAT_EIP712, "0x",
            new DisputePayload(1, SAMPLE_RECEIPT_HASH, REASON_NOT_DELIVERED, "1", NOW - 100, List.of()),
            ""
        );
        assertTrue(DisputeUtils.isDisputeExpired(signed, NOW));
    }

    // =======================================================================
    // Verdict <-> amount consistency
    // =======================================================================

    static Stream<Arguments> verdictCases() {
        return Stream.of(
            Arguments.of(VERDICT_DENIED, "0", "1000000", true),
            Arguments.of(VERDICT_DENIED, "1", "1000000", false),
            Arguments.of(VERDICT_VOID, "0", "1000000", true),
            Arguments.of(VERDICT_VOID, "1", "1000000", false),
            Arguments.of(VERDICT_UPHELD_FULL, "1000000", "1000000", true),
            Arguments.of(VERDICT_UPHELD_FULL, "500000", "1000000", false),
            Arguments.of(VERDICT_UPHELD_FULL, "1000001", "1000000", false),
            Arguments.of(VERDICT_UPHELD_PARTIAL, "500000", "1000000", true),
            Arguments.of(VERDICT_UPHELD_PARTIAL, "0", "1000000", false),
            Arguments.of(VERDICT_UPHELD_PARTIAL, "1000001", "1000000", false),
            Arguments.of("rogue_value", "0", "0", false)
        );
    }

    @ParameterizedTest(name = "verdict={0}, settled={1}, requested={2} -> {3}")
    @MethodSource("verdictCases")
    void verdictAmountConsistency(String verdict, String settled, String requested, boolean expected) {
        ResolutionPayload p = new ResolutionPayload(
            1, SAMPLE_DISPUTE_HASH, verdict, settled, ARBITER, NOW, ""
        );
        SignedResolution res = new SignedResolution(FORMAT_EIP712, "0x", p);
        assertEquals(expected, DisputeUtils.isVerdictAmountConsistent(res, requested));
    }

    // =======================================================================
    // Client helpers
    // =======================================================================

    @Test
    void buildDisputePayloadDefaults() {
        DisputePayload built = DisputeUtils.buildDisputePayload(
            new DisputeUtils.BuildDisputeParams(
                SAMPLE_RECEIPT_HASH, REASON_NOT_DELIVERED, "1000000",
                null, 0L, 0
            )
        );
        assertEquals(1, built.getVersion());
        assertTrue(built.getValidUntil() > java.time.Instant.now().getEpochSecond());
        assertTrue(built.getEvidence().isEmpty());
    }

    @Test
    void buildDisputePayloadExplicit() {
        DisputePayload built = DisputeUtils.buildDisputePayload(
            new DisputeUtils.BuildDisputeParams(
                SAMPLE_RECEIPT_HASH, REASON_QUALITY_ISSUE, "500000",
                List.of("ipfs://X"), 12345L, 2
            )
        );
        assertEquals(12345L, built.getValidUntil());
        assertEquals(2, built.getVersion());
        assertEquals(List.of("ipfs://X"), built.getEvidence());
    }

    @Test
    void buildAndSignDisputeOneCall() throws Exception {
        SignedDispute signed = DisputeUtils.buildAndSignDispute(
            new MockSigner(PAYER),
            new DisputeUtils.BuildDisputeParams(
                SAMPLE_RECEIPT_HASH, REASON_NOT_DELIVERED, "1000000",
                null, 0L, 0
            ),
            ""
        );
        assertEquals(FORMAT_EIP712, signed.getFormat());
    }

    @Test
    void extractDisputeTermsPresent() {
        DisputeTermsInfo terms = sampleTerms();
        Map<String, Object> ext = new LinkedHashMap<>();
        ext.put("info", terms.toMap());
        Map<String, Object> extensions = new LinkedHashMap<>();
        extensions.put(EXTENSION_KEY, ext);
        DisputeTermsInfo got = DisputeUtils.extractDisputeTerms(extensions);
        assertNotNull(got);
        assertEquals(terms.getArbiter(), got.getArbiter());
        assertEquals(terms.getDisputeWindow(), got.getDisputeWindow());
    }

    @Test
    void extractDisputeTermsAbsent() {
        assertNull(DisputeUtils.extractDisputeTerms(null));
        assertNull(DisputeUtils.extractDisputeTerms(Map.of()));
        assertNull(DisputeUtils.extractDisputeTerms(Map.of("other", Map.of())));
    }

    @Test
    void buildSubmissionRoundtripsViaParse() throws Exception {
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        Map<String, Object> body = DisputeUtils.buildDisputeSubmissionBody(signed);
        SignedDispute parsed = DisputeUtils.parseDisputeSubmission(body);
        assertNotNull(parsed);
        assertEquals(signed.getSignature(), parsed.getSignature());
    }

    // =======================================================================
    // Server: buildDisputeRequirements
    // =======================================================================

    @Test
    void buildDisputeRequirementsValid() {
        Map<String, Object> req = DisputeUtils.buildDisputeRequirements(sampleTerms());
        @SuppressWarnings("unchecked")
        Map<String, Object> info = (Map<String, Object>) req.get("info");
        assertEquals(ARBITER, info.get("arbiter"));
    }

    @Test
    void buildDisputeRequirementsRejectsInvalidScheme() {
        DisputeTermsInfo bad = new DisputeTermsInfo(
            ARBITER, "invalid", 100L, List.of(REASON_NOT_DELIVERED), null
        );
        assertThrows(IllegalArgumentException.class,
            () -> DisputeUtils.buildDisputeRequirements(bad));
    }

    @Test
    void buildDisputeRequirementsRejectsZeroWindow() {
        DisputeTermsInfo bad = new DisputeTermsInfo(
            ARBITER, ARBITER_FACILITATOR, 0L, List.of(REASON_NOT_DELIVERED), null
        );
        assertThrows(IllegalArgumentException.class,
            () -> DisputeUtils.buildDisputeRequirements(bad));
    }

    @Test
    void buildDisputeRequirementsRejectsEmptyReasons() {
        DisputeTermsInfo bad = new DisputeTermsInfo(
            ARBITER, ARBITER_FACILITATOR, 100L, List.of(), null
        );
        assertThrows(IllegalArgumentException.class,
            () -> DisputeUtils.buildDisputeRequirements(bad));
    }

    @Test
    void parseDisputeSubmissionMalformed() {
        assertNull(DisputeUtils.parseDisputeSubmission(null));
        assertNull(DisputeUtils.parseDisputeSubmission(Map.of()));
        assertNull(DisputeUtils.parseDisputeSubmission(Map.of("extensions", Map.of())));
        assertNull(DisputeUtils.parseDisputeSubmission(
            Map.of("extensions", Map.of("dispute", Map.of()))
        ));
    }

    // =======================================================================
    // Server: validateDispute pipeline
    // =======================================================================

    @Test
    void validateDisputeHappyPath() throws Exception {
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        DisputeValidation result = DisputeUtils.validateDispute(
            new DisputeUtils.ValidateDisputeInput(
                new PassingVerifier(PAYER), signed,
                NOW - 60, SAMPLE_RECEIPT_HASH, "1000000",
                sampleTerms(), NOW
            )
        );
        assertTrue(result.valid(), () -> "want valid, got " + result);
    }

    @Test
    void validateDisputeBadSignature() throws Exception {
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        DisputeValidation result = DisputeUtils.validateDispute(
            new DisputeUtils.ValidateDisputeInput(
                new FailingVerifier(), signed,
                NOW - 60, SAMPLE_RECEIPT_HASH, "1000000",
                sampleTerms(), NOW
            )
        );
        assertFalse(result.valid());
        assertEquals(ERR_DISPUTE_INVALID_SIGNATURE, result.error());
    }

    @Test
    void validateDisputeExpiredEnvelope() throws Exception {
        DisputePayload payload = new DisputePayload(
            1, SAMPLE_RECEIPT_HASH, REASON_NOT_DELIVERED, "1000000",
            NOW - 1, List.of()
        );
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), payload);
        DisputeValidation result = DisputeUtils.validateDispute(
            new DisputeUtils.ValidateDisputeInput(
                new PassingVerifier(PAYER), signed,
                NOW - 60, SAMPLE_RECEIPT_HASH, "1000000",
                sampleTerms(), NOW
            )
        );
        assertEquals(ERR_DISPUTE_EXPIRED, result.error());
    }

    @Test
    void validateDisputeReceiptMismatch() throws Exception {
        DisputePayload payload = new DisputePayload(
            1, "0xdifferenthash" + "0".repeat(52),
            REASON_NOT_DELIVERED, "1000000", NOW + 86_400, List.of()
        );
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), payload);
        DisputeValidation result = DisputeUtils.validateDispute(
            new DisputeUtils.ValidateDisputeInput(
                new PassingVerifier(PAYER), signed,
                NOW - 60, SAMPLE_RECEIPT_HASH, "1000000",
                sampleTerms(), NOW
            )
        );
        assertEquals(ERR_DISPUTE_UNKNOWN_RECEIPT, result.error());
    }

    @Test
    void validateDisputeOutOfWindow() throws Exception {
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        DisputeTermsInfo terms = sampleTerms();
        DisputeValidation result = DisputeUtils.validateDispute(
            new DisputeUtils.ValidateDisputeInput(
                new PassingVerifier(PAYER), signed,
                NOW - terms.getDisputeWindow() - 100,
                SAMPLE_RECEIPT_HASH, "1000000",
                terms, NOW
            )
        );
        assertEquals(ERR_DISPUTE_OUT_OF_WINDOW, result.error());
    }

    @Test
    void validateDisputeUnsupportedReason() throws Exception {
        DisputePayload payload = new DisputePayload(
            1, SAMPLE_RECEIPT_HASH, REASON_DUPLICATE_CHARGE, // not in sample terms
            "1000000", NOW + 86_400, List.of()
        );
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), payload);
        DisputeValidation result = DisputeUtils.validateDispute(
            new DisputeUtils.ValidateDisputeInput(
                new PassingVerifier(PAYER), signed,
                NOW - 60, SAMPLE_RECEIPT_HASH, "1000000",
                sampleTerms(), NOW
            )
        );
        assertEquals(ERR_DISPUTE_INVALID_REASON, result.error());
    }

    @Test
    void validateDisputeCustomXReasonAccepted() throws Exception {
        DisputePayload payload = new DisputePayload(
            1, SAMPLE_RECEIPT_HASH, "x_gdpr_violation",
            "1000000", NOW + 86_400, List.of()
        );
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), payload);
        DisputeTermsInfo terms = new DisputeTermsInfo(
            ARBITER, ARBITER_FACILITATOR, 86_400L * 7,
            List.of(REASON_NOT_DELIVERED, "x_gdpr_violation"),
            List.of("ipfs", "arweave", "https")
        );
        DisputeValidation result = DisputeUtils.validateDispute(
            new DisputeUtils.ValidateDisputeInput(
                new PassingVerifier(PAYER), signed,
                NOW - 60, SAMPLE_RECEIPT_HASH, "1000000",
                terms, NOW
            )
        );
        assertTrue(result.valid(), () -> "want valid, got " + result);
    }

    @Test
    void validateDisputeAmountExceedsReceipt() throws Exception {
        DisputePayload payload = new DisputePayload(
            1, SAMPLE_RECEIPT_HASH, REASON_NOT_DELIVERED,
            "1000001", NOW + 86_400, List.of()
        );
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), payload);
        DisputeValidation result = DisputeUtils.validateDispute(
            new DisputeUtils.ValidateDisputeInput(
                new PassingVerifier(PAYER), signed,
                NOW - 60, SAMPLE_RECEIPT_HASH, "1000000",
                sampleTerms(), NOW
            )
        );
        assertEquals(ERR_DISPUTE_AMOUNT_EXCEEDS_RECEIPT, result.error());
    }

    @Test
    void validateDisputeEvidenceUriRejected() throws Exception {
        DisputePayload payload = new DisputePayload(
            1, SAMPLE_RECEIPT_HASH, REASON_NOT_DELIVERED,
            "1000000", NOW + 86_400, List.of("ftp://server/evidence.json")
        );
        SignedDispute signed = DisputeUtils.createSignedDispute(new MockSigner(PAYER), payload);
        DisputeValidation result = DisputeUtils.validateDispute(
            new DisputeUtils.ValidateDisputeInput(
                new PassingVerifier(PAYER), signed,
                NOW - 60, SAMPLE_RECEIPT_HASH, "1000000",
                sampleTerms(), NOW
            )
        );
        assertEquals(ERR_DISPUTE_EVIDENCE_URI_UNSUPPORTED, result.error());
    }

    // =======================================================================
    // ValidateResolution
    // =======================================================================

    @Test
    void validateResolutionHappyPath() throws Exception {
        SignedDispute signedDispute = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        SignedResolution signedResolution = DisputeUtils.createSignedResolution(new MockSigner(ARBITER), sampleResolution());
        ResolutionValidation result = DisputeUtils.validateResolution(
            new DisputeUtils.ValidateResolutionInput(
                new PassingVerifier(ARBITER), signedResolution, signedDispute,
                SAMPLE_DISPUTE_HASH, ARBITER
            )
        );
        assertTrue(result.valid(), () -> "want valid, got " + result);
    }

    @Test
    void validateResolutionArbiterSignatureMismatch() throws Exception {
        SignedDispute signedDispute = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        SignedResolution signedResolution = DisputeUtils.createSignedResolution(new MockSigner(ARBITER), sampleResolution());
        ResolutionValidation result = DisputeUtils.validateResolution(
            new DisputeUtils.ValidateResolutionInput(
                new PassingVerifier("0xwrongarbiter"), signedResolution, signedDispute,
                SAMPLE_DISPUTE_HASH, ARBITER
            )
        );
        assertEquals(ERR_RESOLUTION_INVALID_SIGNATURE, result.error());
    }

    @Test
    void validateResolutionUnknownDisputeHash() throws Exception {
        SignedDispute signedDispute = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        ResolutionPayload p = new ResolutionPayload(
            1, "0xwronghash" + "0".repeat(56), VERDICT_UPHELD_FULL, "1000000", ARBITER, NOW + 100, ""
        );
        SignedResolution signedResolution = DisputeUtils.createSignedResolution(new MockSigner(ARBITER), p);
        ResolutionValidation result = DisputeUtils.validateResolution(
            new DisputeUtils.ValidateResolutionInput(
                new PassingVerifier(ARBITER), signedResolution, signedDispute,
                SAMPLE_DISPUTE_HASH, ARBITER
            )
        );
        assertEquals(ERR_RESOLUTION_UNKNOWN_DISPUTE, result.error());
    }

    @Test
    void validateResolutionArbiterPayloadMismatch() throws Exception {
        SignedDispute signedDispute = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        ResolutionPayload p = new ResolutionPayload(
            1, SAMPLE_DISPUTE_HASH, VERDICT_UPHELD_FULL, "1000000",
            "0xdifferent0000000000000000000000000000ab12", NOW + 100, ""
        );
        SignedResolution signedResolution = DisputeUtils.createSignedResolution(new MockSigner(ARBITER), p);
        ResolutionValidation result = DisputeUtils.validateResolution(
            new DisputeUtils.ValidateResolutionInput(
                new PassingVerifier(ARBITER), signedResolution, signedDispute,
                SAMPLE_DISPUTE_HASH, ARBITER
            )
        );
        assertEquals(ERR_RESOLUTION_ARBITER_MISMATCH, result.error());
    }

    @Test
    void validateResolutionVerdictAmountInconsistent() throws Exception {
        SignedDispute signedDispute = DisputeUtils.createSignedDispute(new MockSigner(PAYER), sampleDispute());
        ResolutionPayload p = new ResolutionPayload(
            1, SAMPLE_DISPUTE_HASH, VERDICT_DENIED, "1000000", ARBITER, NOW + 100, ""
        );
        SignedResolution signedResolution = DisputeUtils.createSignedResolution(new MockSigner(ARBITER), p);
        ResolutionValidation result = DisputeUtils.validateResolution(
            new DisputeUtils.ValidateResolutionInput(
                new PassingVerifier(ARBITER), signedResolution, signedDispute,
                SAMPLE_DISPUTE_HASH, ARBITER
            )
        );
        assertEquals(ERR_RESOLUTION_VERDICT_AMOUNT_INCONSISTENT, result.error());
    }

    // =======================================================================
    // Server utility predicates
    // =======================================================================

    @Test
    void isReasonSupported() {
        assertTrue(DisputeUtils.isReasonSupported(REASON_NOT_DELIVERED, List.of(REASON_NOT_DELIVERED)));
        assertFalse(DisputeUtils.isReasonSupported(REASON_NOT_DELIVERED, List.of(REASON_QUALITY_ISSUE)));
        assertTrue(DisputeUtils.isReasonSupported("x_custom", List.of("x_custom")));
    }

    @Test
    void isEvidenceUriAllowed() {
        assertTrue(DisputeUtils.isEvidenceUriAllowed("ipfs://hash", List.of("ipfs")));
        assertFalse(DisputeUtils.isEvidenceUriAllowed("ftp://server", List.of("ipfs", "arweave")));
        assertFalse(DisputeUtils.isEvidenceUriAllowed("no-colon-here", List.of("ipfs")));
    }

    @Test
    void packageResolutionResponseWraps() throws Exception {
        SignedResolution signed = DisputeUtils.createSignedResolution(new MockSigner(ARBITER), sampleResolution());
        Map<String, Object> pkg = DisputeUtils.packageResolutionResponse(signed);
        @SuppressWarnings("unchecked")
        Map<String, Object> info = (Map<String, Object>) pkg.get("info");
        assertEquals(signed.toMap(), info.get("resolution"));
    }

    // =======================================================================
    // Facilitator handler
    // =======================================================================

    @Test
    void facilitatorHandlerUsesSignerAddress() {
        DisputeFacilitatorHandler handler = new DisputeFacilitatorHandler(new MockSigner(ARBITER));
        assertEquals(ARBITER, handler.getArbiterAddress());
    }

    @Test
    void resolveDisputeSignsResolution() throws Exception {
        DisputeFacilitatorHandler handler = new DisputeFacilitatorHandler(new MockSigner(ARBITER));
        SignedResolution signed = handler.resolveDispute(SAMPLE_DISPUTE_HASH, VERDICT_UPHELD_FULL, "1000000");
        assertEquals(FORMAT_EIP712, signed.getFormat());
        assertEquals(ARBITER, signed.getPayload().getArbiter());
        assertEquals(VERDICT_UPHELD_FULL, signed.getPayload().getVerdict());
        assertEquals(SAMPLE_DISPUTE_HASH, signed.getPayload().getDisputeHash());
    }

    @Test
    void buildFacilitatorResolutionStatic() throws Exception {
        DisputeFacilitatorHandler handler = new DisputeFacilitatorHandler(new MockSigner(ARBITER));
        SignedResolution signed = DisputeFacilitatorHandler.buildFacilitatorResolution(
            handler, SAMPLE_DISPUTE_HASH, VERDICT_DENIED, "0", ""
        );
        assertEquals(VERDICT_DENIED, signed.getPayload().getVerdict());
        assertEquals("0", signed.getPayload().getSettledAmount());
    }
}
