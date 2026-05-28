"""Tests for the t402 Dispute extension.

Mirrors the TS reference test suite (test/dispute.test.ts) so the
Python port maintains parity with the canonical spec implementation.
"""

import time

import pytest

from t402.extensions.dispute import (
    ARBITER_SCHEMES,
    DEFAULT_EVIDENCE_URI_SCHEMES,
    DISPUTE_DOMAIN,
    DISPUTE_PRIMARY_TYPE,
    DISPUTE_TYPES,
    DISPUTE_VERDICTS,
    EXTENSION_KEY,
    RESOLUTION_DOMAIN,
    RESOLUTION_PRIMARY_TYPE,
    RESOLUTION_TYPES,
    STANDARD_DISPUTE_REASONS,
    DisputeFacilitatorHandler,
    DisputePayload,
    DisputeValidation,
    JWSReservedError,
    ResolutionPayload,
    SignedDispute,
    SignedResolution,
    TermsInfo,
    build_and_sign_dispute,
    build_dispute_payload,
    build_dispute_requirements,
    build_dispute_submission_body,
    build_facilitator_resolution,
    create_signed_dispute,
    create_signed_resolution,
    extract_dispute_terms,
    is_dispute_expired,
    is_evidence_uri_allowed,
    is_reason_supported,
    is_reason_well_formed,
    is_standard_reason,
    is_verdict_amount_consistent,
    normalize_dispute_for_signing,
    normalize_resolution_for_signing,
    package_resolution_response,
    parse_dispute_submission,
    validate_dispute,
    validate_resolution,
    verify_dispute,
    verify_resolution,
)


PAYER = "0x1234567890abcdef1234567890abcdef12345678"
ARBITER = "0xabcdef1234567890abcdef1234567890abcdef12"
SAMPLE_RECEIPT_HASH = (
    "0xcafedade000000000000000000000000000000000000000000000000deadbeef"
)
SAMPLE_DISPUTE_HASH = (
    "0xbeefface000000000000000000000000000000000000000000000000feedf00d"
)
NOW = 1_716_000_000


class MockSigner:
    def __init__(self, address: str):
        self.address = address

    def sign_dispute(self, payload):
        return "0xdispute_sig_" + self.address[-6:]

    def sign_resolution(self, payload):
        return "0xresolution_sig_" + self.address[-6:]

    def get_address(self):
        return self.address


class PassingVerifier:
    def __init__(self, address: str):
        self.address = address

    def recover_dispute_signer(self, payload, signature):
        return self.address

    def recover_resolution_signer(self, payload, signature):
        return self.address


class FailingVerifier:
    def recover_dispute_signer(self, payload, signature):
        raise RuntimeError("invalid signature")

    def recover_resolution_signer(self, payload, signature):
        raise RuntimeError("invalid signature")


def sample_dispute() -> DisputePayload:
    return DisputePayload(
        version=1,
        receipt_hash=SAMPLE_RECEIPT_HASH,
        reason="not_delivered",
        requested_amount="1000000",
        valid_until=NOW + 86_400,
        evidence=["ipfs://QmEvidenceHash/complaint.json"],
    )


def sample_resolution() -> ResolutionPayload:
    return ResolutionPayload(
        version=1,
        dispute_hash=SAMPLE_DISPUTE_HASH,
        verdict="upheld_full",
        settled_amount="1000000",
        arbiter=ARBITER,
        issued_at=NOW + 100,
        refund_transaction="0xrefundtx0000000000000000000000000000000000000000",
    )


def sample_terms() -> TermsInfo:
    return TermsInfo(
        arbiter=ARBITER,
        arbiter_scheme="facilitator",
        dispute_window=86_400 * 7,
        supported_reasons=[
            "not_delivered",
            "partial_delivery",
            "quality_issue",
        ],
        evidence_uri_schemes=["ipfs", "arweave", "https"],
    )


# ===========================================================================
# EIP-712 constants
# ===========================================================================


class TestEIP712Constants:
    def test_dispute_domain(self):
        assert DISPUTE_DOMAIN["name"] == "T402Dispute"
        assert DISPUTE_DOMAIN["version"] == "1"
        assert DISPUTE_DOMAIN["chainId"] == 1

    def test_resolution_shares_namespace(self):
        assert RESOLUTION_DOMAIN["name"] == DISPUTE_DOMAIN["name"]

    def test_dispute_primary_type(self):
        assert DISPUTE_PRIMARY_TYPE == "Dispute"
        fields = [f["name"] for f in DISPUTE_TYPES]
        assert fields == [
            "version",
            "receiptHash",
            "reason",
            "requestedAmount",
            "validUntil",
            "evidence",
        ]

    def test_resolution_primary_type(self):
        assert RESOLUTION_PRIMARY_TYPE == "Resolution"
        fields = [f["name"] for f in RESOLUTION_TYPES]
        assert fields == [
            "version",
            "disputeHash",
            "verdict",
            "settledAmount",
            "arbiter",
            "issuedAt",
            "refundTransaction",
        ]

    def test_normalize_dispute_fills_empty_evidence(self):
        payload = sample_dispute()
        payload.evidence = []
        norm = normalize_dispute_for_signing(payload)
        assert norm["evidence"] == []

    def test_normalize_resolution_defaults_refund_tx(self):
        payload = sample_resolution()
        payload.refund_transaction = ""
        norm = normalize_resolution_for_signing(payload)
        assert norm["refundTransaction"] == ""


# ===========================================================================
# Enums
# ===========================================================================


class TestEnums:
    def test_standard_reasons(self):
        assert STANDARD_DISPUTE_REASONS == (
            "not_delivered",
            "partial_delivery",
            "quality_issue",
            "unauthorized",
            "service_unavailable",
            "duplicate_charge",
            "other",
        )

    def test_verdicts(self):
        assert DISPUTE_VERDICTS == (
            "upheld_full",
            "upheld_partial",
            "denied",
            "void",
        )

    def test_arbiter_schemes(self):
        assert ARBITER_SCHEMES == (
            "facilitator",
            "contract",
            "external",
            "none",
        )

    def test_extension_key(self):
        assert EXTENSION_KEY == "dispute"

    def test_default_evidence_uri_schemes(self):
        assert DEFAULT_EVIDENCE_URI_SCHEMES == ["ipfs", "arweave", "https"]

    def test_is_standard_reason(self):
        assert is_standard_reason("not_delivered") is True
        assert is_standard_reason("x_custom") is False
        assert is_standard_reason("typo") is False

    def test_is_reason_well_formed(self):
        assert is_reason_well_formed("not_delivered") is True
        assert is_reason_well_formed("x_anything") is True
        assert is_reason_well_formed("typo") is False


# ===========================================================================
# Signing roundtrip
# ===========================================================================


class TestSigningRoundtrip:
    def test_create_and_verify_dispute(self):
        signer = MockSigner(PAYER)
        verifier = PassingVerifier(PAYER)
        signed = create_signed_dispute(signer, sample_dispute())
        assert signed.format == "eip712"
        valid, recovered, payload = verify_dispute(verifier, signed)
        assert valid is True
        assert recovered.lower() == PAYER.lower()
        assert payload == sample_dispute()

    def test_explicit_delegate_signer(self):
        signer = MockSigner(PAYER)
        delegate = "0xdelegate1111111111111111111111111111111111"
        signed = create_signed_dispute(signer, sample_dispute(), delegate)
        assert signed.signer == delegate
        verifier = PassingVerifier(PAYER)
        valid, recovered, _ = verify_dispute(verifier, signed)
        assert valid is True
        assert recovered == delegate  # explicit signer wins over recovered

    def test_create_and_verify_resolution(self):
        signer = MockSigner(ARBITER)
        verifier = PassingVerifier(ARBITER)
        signed = create_signed_resolution(signer, sample_resolution())
        valid, recovered, _ = verify_resolution(verifier, signed, ARBITER)
        assert valid is True
        assert recovered.lower() == ARBITER.lower()

    def test_verify_dispute_failure(self):
        signer = MockSigner(PAYER)
        signed = create_signed_dispute(signer, sample_dispute())
        valid, _, _ = verify_dispute(FailingVerifier(), signed)
        assert valid is False

    def test_verify_resolution_arbiter_mismatch(self):
        signer = MockSigner(ARBITER)
        verifier = PassingVerifier(ARBITER)
        signed = create_signed_resolution(signer, sample_resolution())
        valid, _, _ = verify_resolution(
            verifier, signed, "0xwrongarbiter"
        )
        assert valid is False

    def test_verify_dispute_jws_raises(self):
        jws = SignedDispute(format="jws", signature="0x")
        with pytest.raises(JWSReservedError):
            verify_dispute(FailingVerifier(), jws)


# ===========================================================================
# Time windows
# ===========================================================================


class TestEnvelopeExpiry:
    def test_future_valid_until_not_expired(self):
        signed = SignedDispute(
            format="eip712",
            signature="0x",
            payload=DisputePayload(
                version=1,
                receipt_hash=SAMPLE_RECEIPT_HASH,
                reason="not_delivered",
                requested_amount="1",
                valid_until=NOW + 100,
            ),
        )
        assert is_dispute_expired(signed, NOW) is False

    def test_past_valid_until_expired(self):
        signed = SignedDispute(
            format="eip712",
            signature="0x",
            payload=DisputePayload(
                version=1,
                receipt_hash=SAMPLE_RECEIPT_HASH,
                reason="not_delivered",
                requested_amount="1",
                valid_until=NOW - 100,
            ),
        )
        assert is_dispute_expired(signed, NOW) is True

    def test_default_now_when_omitted(self):
        signed = SignedDispute(
            format="eip712",
            signature="0x",
            payload=DisputePayload(
                version=1,
                receipt_hash=SAMPLE_RECEIPT_HASH,
                reason="not_delivered",
                requested_amount="1",
                valid_until=int(time.time()) - 100,
            ),
        )
        assert is_dispute_expired(signed) is True


# ===========================================================================
# Verdict <-> amount consistency
# ===========================================================================


def _make_resolution(verdict: str, settled: str) -> SignedResolution:
    payload = sample_resolution()
    payload.verdict = verdict
    payload.settled_amount = settled
    return SignedResolution(format="eip712", signature="0x", payload=payload)


class TestVerdictAmountConsistency:
    @pytest.mark.parametrize(
        "verdict,settled,requested,expected",
        [
            ("denied", "0", "1000000", True),
            ("denied", "1", "1000000", False),
            ("void", "0", "1000000", True),
            ("void", "1", "1000000", False),
            ("upheld_full", "1000000", "1000000", True),
            ("upheld_full", "500000", "1000000", False),
            ("upheld_full", "1000001", "1000000", False),
            ("upheld_partial", "500000", "1000000", True),
            ("upheld_partial", "0", "1000000", False),
            ("upheld_partial", "1000001", "1000000", False),
            ("rogue_value", "0", "0", False),
        ],
    )
    def test_cases(self, verdict, settled, requested, expected):
        assert (
            is_verdict_amount_consistent(
                _make_resolution(verdict, settled), requested
            )
            is expected
        )


# ===========================================================================
# Client helpers
# ===========================================================================


class TestClientHelpers:
    def test_build_dispute_payload_defaults(self):
        built = build_dispute_payload(
            receipt_hash=SAMPLE_RECEIPT_HASH,
            reason="not_delivered",
            requested_amount="1000000",
        )
        assert built.version == 1
        assert built.valid_until > int(time.time())
        assert built.evidence == []

    def test_build_dispute_payload_explicit(self):
        built = build_dispute_payload(
            receipt_hash=SAMPLE_RECEIPT_HASH,
            reason="quality_issue",
            requested_amount="500000",
            evidence=["ipfs://X"],
            valid_until=12345,
            version=2,
        )
        assert built.valid_until == 12345
        assert built.evidence == ["ipfs://X"]
        assert built.version == 2

    def test_build_and_sign_dispute(self):
        signer = MockSigner(PAYER)
        signed = build_and_sign_dispute(
            signer,
            receipt_hash=SAMPLE_RECEIPT_HASH,
            reason="not_delivered",
            requested_amount="1000000",
        )
        assert signed.format == "eip712"

    def test_extract_dispute_terms_present(self):
        terms = sample_terms()
        extensions = {EXTENSION_KEY: {"info": terms.to_dict()}}
        got = extract_dispute_terms(extensions)
        assert got is not None
        assert got.arbiter == terms.arbiter
        assert got.dispute_window == terms.dispute_window

    def test_extract_dispute_terms_absent(self):
        assert extract_dispute_terms(None) is None
        assert extract_dispute_terms({}) is None
        assert extract_dispute_terms({"other": {}}) is None

    def test_build_submission_body_roundtrips_via_parse(self):
        signer = MockSigner(PAYER)
        signed = create_signed_dispute(signer, sample_dispute())
        body = build_dispute_submission_body(signed)
        parsed = parse_dispute_submission(body)
        assert parsed is not None
        assert parsed.signature == signed.signature


# ===========================================================================
# Server: buildDisputeRequirements
# ===========================================================================


class TestServerBuildRequirements:
    def test_valid_terms(self):
        req = build_dispute_requirements(sample_terms())
        assert req["info"]["arbiter"] == ARBITER

    def test_invalid_arbiter_scheme(self):
        bad = sample_terms()
        bad.arbiter_scheme = "invalid"
        with pytest.raises(ValueError, match="unsupported arbiterScheme"):
            build_dispute_requirements(bad)

    def test_non_positive_window(self):
        bad = sample_terms()
        bad.dispute_window = 0
        with pytest.raises(ValueError, match="disputeWindow"):
            build_dispute_requirements(bad)

    def test_empty_supported_reasons(self):
        bad = sample_terms()
        bad.supported_reasons = []
        with pytest.raises(ValueError, match="supportedReasons"):
            build_dispute_requirements(bad)


# ===========================================================================
# Server: parseDisputeSubmission
# ===========================================================================


class TestParseDisputeSubmission:
    def test_malformed_inputs(self):
        assert parse_dispute_submission(None) is None
        assert parse_dispute_submission({}) is None
        assert parse_dispute_submission({"extensions": {}}) is None
        assert (
            parse_dispute_submission({"extensions": {"dispute": {}}}) is None
        )
        assert (
            parse_dispute_submission(
                {"extensions": {"dispute": {"info": {}}}}
            )
            is None
        )


# ===========================================================================
# Server: validateDispute (seven-step pipeline)
# ===========================================================================


def _receipt_ctx():
    return {
        "issued_at": NOW - 60,
        "hash": SAMPLE_RECEIPT_HASH,
        "amount": "1000000",
    }


class TestValidateDispute:
    def test_happy_path(self):
        signer = MockSigner(PAYER)
        verifier = PassingVerifier(PAYER)
        signed = create_signed_dispute(signer, sample_dispute())
        result = validate_dispute(
            verifier,
            signed,
            receipt_issued_at=_receipt_ctx()["issued_at"],
            receipt_hash=_receipt_ctx()["hash"],
            receipt_amount=_receipt_ctx()["amount"],
            terms=sample_terms(),
            now_unix=NOW,
        )
        assert result.valid is True

    def test_bad_signature(self):
        signer = MockSigner(PAYER)
        signed = create_signed_dispute(signer, sample_dispute())
        result = validate_dispute(
            FailingVerifier(),
            signed,
            receipt_issued_at=_receipt_ctx()["issued_at"],
            receipt_hash=_receipt_ctx()["hash"],
            receipt_amount=_receipt_ctx()["amount"],
            terms=sample_terms(),
            now_unix=NOW,
        )
        assert result.valid is False
        assert result.error == "dispute_invalid_signature"

    def test_expired_envelope(self):
        signer = MockSigner(PAYER)
        verifier = PassingVerifier(PAYER)
        payload = sample_dispute()
        payload.valid_until = NOW - 1
        signed = create_signed_dispute(signer, payload)
        result = validate_dispute(
            verifier,
            signed,
            receipt_issued_at=_receipt_ctx()["issued_at"],
            receipt_hash=_receipt_ctx()["hash"],
            receipt_amount=_receipt_ctx()["amount"],
            terms=sample_terms(),
            now_unix=NOW,
        )
        assert result.valid is False
        assert result.error == "dispute_expired"

    def test_receipt_hash_mismatch(self):
        signer = MockSigner(PAYER)
        verifier = PassingVerifier(PAYER)
        payload = sample_dispute()
        payload.receipt_hash = "0xdifferenthash" + "0" * 52
        signed = create_signed_dispute(signer, payload)
        result = validate_dispute(
            verifier,
            signed,
            receipt_issued_at=_receipt_ctx()["issued_at"],
            receipt_hash=_receipt_ctx()["hash"],
            receipt_amount=_receipt_ctx()["amount"],
            terms=sample_terms(),
            now_unix=NOW,
        )
        assert result.valid is False
        assert result.error == "dispute_unknown_receipt"

    def test_out_of_window(self):
        signer = MockSigner(PAYER)
        verifier = PassingVerifier(PAYER)
        signed = create_signed_dispute(signer, sample_dispute())
        terms = sample_terms()
        result = validate_dispute(
            verifier,
            signed,
            receipt_issued_at=NOW - terms.dispute_window - 100,
            receipt_hash=_receipt_ctx()["hash"],
            receipt_amount=_receipt_ctx()["amount"],
            terms=terms,
            now_unix=NOW,
        )
        assert result.valid is False
        assert result.error == "dispute_out_of_window"

    def test_unsupported_reason(self):
        signer = MockSigner(PAYER)
        verifier = PassingVerifier(PAYER)
        payload = sample_dispute()
        payload.reason = "duplicate_charge"  # not in sample_terms
        signed = create_signed_dispute(signer, payload)
        result = validate_dispute(
            verifier,
            signed,
            receipt_issued_at=_receipt_ctx()["issued_at"],
            receipt_hash=_receipt_ctx()["hash"],
            receipt_amount=_receipt_ctx()["amount"],
            terms=sample_terms(),
            now_unix=NOW,
        )
        assert result.valid is False
        assert result.error == "dispute_invalid_reason"

    def test_custom_x_reason_accepted(self):
        signer = MockSigner(PAYER)
        verifier = PassingVerifier(PAYER)
        payload = sample_dispute()
        payload.reason = "x_gdpr_violation"
        signed = create_signed_dispute(signer, payload)
        terms = sample_terms()
        terms.supported_reasons = ["not_delivered", "x_gdpr_violation"]
        result = validate_dispute(
            verifier,
            signed,
            receipt_issued_at=_receipt_ctx()["issued_at"],
            receipt_hash=_receipt_ctx()["hash"],
            receipt_amount=_receipt_ctx()["amount"],
            terms=terms,
            now_unix=NOW,
        )
        assert result.valid is True

    def test_amount_exceeds_receipt(self):
        signer = MockSigner(PAYER)
        verifier = PassingVerifier(PAYER)
        payload = sample_dispute()
        payload.requested_amount = "1000001"
        signed = create_signed_dispute(signer, payload)
        result = validate_dispute(
            verifier,
            signed,
            receipt_issued_at=_receipt_ctx()["issued_at"],
            receipt_hash=_receipt_ctx()["hash"],
            receipt_amount=_receipt_ctx()["amount"],
            terms=sample_terms(),
            now_unix=NOW,
        )
        assert result.valid is False
        assert result.error == "dispute_amount_exceeds_receipt"

    def test_evidence_uri_rejected(self):
        signer = MockSigner(PAYER)
        verifier = PassingVerifier(PAYER)
        payload = sample_dispute()
        payload.evidence = ["ftp://server/evidence.json"]
        signed = create_signed_dispute(signer, payload)
        result = validate_dispute(
            verifier,
            signed,
            receipt_issued_at=_receipt_ctx()["issued_at"],
            receipt_hash=_receipt_ctx()["hash"],
            receipt_amount=_receipt_ctx()["amount"],
            terms=sample_terms(),
            now_unix=NOW,
        )
        assert result.valid is False
        assert result.error == "dispute_evidence_uri_unsupported"


# ===========================================================================
# Server: validateResolution
# ===========================================================================


class TestValidateResolution:
    def test_happy_path(self):
        verifier = PassingVerifier(ARBITER)
        signed_dispute = create_signed_dispute(
            MockSigner(PAYER), sample_dispute()
        )
        signed_resolution = create_signed_resolution(
            MockSigner(ARBITER), sample_resolution()
        )
        result = validate_resolution(
            verifier,
            signed_resolution,
            signed_dispute,
            dispute_hash=SAMPLE_DISPUTE_HASH,
            expected_arbiter=ARBITER,
        )
        assert result.valid is True

    def test_arbiter_signature_mismatch(self):
        verifier = PassingVerifier("0xwrongarbiter")
        signed_dispute = create_signed_dispute(
            MockSigner(PAYER), sample_dispute()
        )
        signed_resolution = create_signed_resolution(
            MockSigner(ARBITER), sample_resolution()
        )
        result = validate_resolution(
            verifier,
            signed_resolution,
            signed_dispute,
            dispute_hash=SAMPLE_DISPUTE_HASH,
            expected_arbiter=ARBITER,
        )
        assert result.valid is False
        assert result.error == "resolution_invalid_signature"

    def test_unknown_dispute_hash(self):
        verifier = PassingVerifier(ARBITER)
        signed_dispute = create_signed_dispute(
            MockSigner(PAYER), sample_dispute()
        )
        res_payload = sample_resolution()
        res_payload.dispute_hash = "0xwronghash" + "0" * 56
        signed_resolution = create_signed_resolution(
            MockSigner(ARBITER), res_payload
        )
        result = validate_resolution(
            verifier,
            signed_resolution,
            signed_dispute,
            dispute_hash=SAMPLE_DISPUTE_HASH,
            expected_arbiter=ARBITER,
        )
        assert result.valid is False
        assert result.error == "resolution_unknown_dispute"

    def test_arbiter_payload_mismatch(self):
        verifier = PassingVerifier(ARBITER)
        signed_dispute = create_signed_dispute(
            MockSigner(PAYER), sample_dispute()
        )
        res_payload = sample_resolution()
        res_payload.arbiter = "0xdifferent0000000000000000000000000000ab12"
        signed_resolution = create_signed_resolution(
            MockSigner(ARBITER), res_payload
        )
        result = validate_resolution(
            verifier,
            signed_resolution,
            signed_dispute,
            dispute_hash=SAMPLE_DISPUTE_HASH,
            expected_arbiter=ARBITER,
        )
        assert result.valid is False
        assert result.error == "resolution_arbiter_mismatch"

    def test_verdict_amount_inconsistent(self):
        verifier = PassingVerifier(ARBITER)
        signed_dispute = create_signed_dispute(
            MockSigner(PAYER), sample_dispute()
        )
        res_payload = sample_resolution()
        res_payload.verdict = "denied"
        res_payload.settled_amount = "1000000"  # denied requires 0
        signed_resolution = create_signed_resolution(
            MockSigner(ARBITER), res_payload
        )
        result = validate_resolution(
            verifier,
            signed_resolution,
            signed_dispute,
            dispute_hash=SAMPLE_DISPUTE_HASH,
            expected_arbiter=ARBITER,
        )
        assert result.valid is False
        assert result.error == "resolution_verdict_amount_inconsistent"


# ===========================================================================
# Server utility predicates
# ===========================================================================


class TestServerUtils:
    def test_is_reason_supported(self):
        assert is_reason_supported("not_delivered", ["not_delivered"]) is True
        assert is_reason_supported("x_custom", ["x_custom"]) is True
        assert is_reason_supported("not_delivered", ["quality_issue"]) is False

    def test_is_evidence_uri_allowed(self):
        assert is_evidence_uri_allowed("ipfs://hash", ["ipfs"]) is True
        assert (
            is_evidence_uri_allowed("ftp://server", ["ipfs", "arweave"])
            is False
        )
        assert is_evidence_uri_allowed("plaintext-no-colon", ["ipfs"]) is False

    def test_package_resolution_response(self):
        signed = create_signed_resolution(
            MockSigner(ARBITER), sample_resolution()
        )
        pkg = package_resolution_response(signed)
        assert pkg["info"]["resolution"] == signed.to_dict()


# ===========================================================================
# Facilitator handler
# ===========================================================================


class TestFacilitatorHandler:
    def test_arbiter_address(self):
        handler = DisputeFacilitatorHandler(MockSigner(ARBITER))
        assert handler.get_arbiter_address() == ARBITER

    def test_resolve_dispute(self):
        handler = DisputeFacilitatorHandler(MockSigner(ARBITER))
        signed = handler.resolve_dispute(
            dispute_hash=SAMPLE_DISPUTE_HASH,
            verdict="upheld_full",
            settled_amount="1000000",
        )
        assert signed.format == "eip712"
        assert signed.payload is not None
        assert signed.payload.arbiter == ARBITER
        assert signed.payload.verdict == "upheld_full"
        assert signed.payload.dispute_hash == SAMPLE_DISPUTE_HASH

    def test_build_facilitator_resolution(self):
        handler = DisputeFacilitatorHandler(MockSigner(ARBITER))
        signed = build_facilitator_resolution(
            handler,
            dispute_hash=SAMPLE_DISPUTE_HASH,
            verdict="denied",
            settled_amount="0",
        )
        assert signed.payload is not None
        assert signed.payload.verdict == "denied"
        assert signed.payload.settled_amount == "0"
