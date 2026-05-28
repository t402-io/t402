"""Dispute extension for t402 (specs/extensions/dispute.md).

Disputes: A payer (or its delegate) signs a complaint against a
previously issued receipt, requesting a full or partial refund.
Resolutions: A designated arbiter signs a verdict resolving the dispute.

t402 is the first HTTP-native stablecoin payment protocol with a
standardized dispute primitive. The four-step chain that gives t402
payments enforceable buyer-side recourse is:

    Offer -> Receipt -> Dispute -> Resolution

This module mirrors the TypeScript reference implementation in
sdks/typescript/packages/extensions/src/dispute (commit 5b89f266).
"""

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Protocol, Tuple


# ===========================================================================
# Constants
# ===========================================================================

EXTENSION_KEY = "dispute"

DEFAULT_DISPUTE_VALIDITY_SECONDS = 24 * 60 * 60

# EIP-712 chainId fixed at 1 (off-chain envelope; mirrors offer-receipt).
DISPUTE_DOMAIN = {"name": "T402Dispute", "version": "1", "chainId": 1}
RESOLUTION_DOMAIN = {"name": "T402Dispute", "version": "1", "chainId": 1}

DISPUTE_PRIMARY_TYPE = "Dispute"
RESOLUTION_PRIMARY_TYPE = "Resolution"

DISPUTE_TYPES = [
    {"name": "version", "type": "uint256"},
    {"name": "receiptHash", "type": "bytes32"},
    {"name": "reason", "type": "string"},
    {"name": "requestedAmount", "type": "uint256"},
    {"name": "validUntil", "type": "uint256"},
    {"name": "evidence", "type": "string[]"},
]

RESOLUTION_TYPES = [
    {"name": "version", "type": "uint256"},
    {"name": "disputeHash", "type": "bytes32"},
    {"name": "verdict", "type": "string"},
    {"name": "settledAmount", "type": "uint256"},
    {"name": "arbiter", "type": "address"},
    {"name": "issuedAt", "type": "uint256"},
    {"name": "refundTransaction", "type": "string"},
]

# Closed-enum reasons. Servers MAY also accept x_*-prefixed extensions.
STANDARD_DISPUTE_REASONS: Tuple[str, ...] = (
    "not_delivered",
    "partial_delivery",
    "quality_issue",
    "unauthorized",
    "service_unavailable",
    "duplicate_charge",
    "other",
)

DISPUTE_VERDICTS: Tuple[str, ...] = (
    "upheld_full",
    "upheld_partial",
    "denied",
    "void",
)

ARBITER_SCHEMES: Tuple[str, ...] = (
    "facilitator",
    "contract",
    "external",
    "none",
)

DEFAULT_EVIDENCE_URI_SCHEMES: List[str] = ["ipfs", "arweave", "https"]

# Closed validation error codes.
DISPUTE_VALIDATION_ERRORS: Tuple[str, ...] = (
    "dispute_invalid_signature",
    "dispute_unknown_receipt",
    "dispute_out_of_window",
    "dispute_invalid_reason",
    "dispute_amount_exceeds_receipt",
    "dispute_evidence_uri_unsupported",
    "dispute_expired",
    "dispute_unsupported_format",
)

RESOLUTION_VALIDATION_ERRORS: Tuple[str, ...] = (
    "resolution_invalid_signature",
    "resolution_arbiter_mismatch",
    "resolution_unknown_dispute",
    "resolution_verdict_amount_inconsistent",
    "resolution_unsupported_format",
)


SignatureFormat = Literal["eip712", "jws"]
Verdict = Literal["upheld_full", "upheld_partial", "denied", "void"]
ArbiterScheme = Literal["facilitator", "contract", "external", "none"]


# ===========================================================================
# Payload dataclasses
# ===========================================================================


@dataclass
class DisputePayload:
    """Canonical dispute envelope contents."""

    version: int
    receipt_hash: str
    reason: str
    requested_amount: str
    valid_until: int
    evidence: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "version": self.version,
            "receiptHash": self.receipt_hash,
            "reason": self.reason,
            "requestedAmount": self.requested_amount,
            "validUntil": self.valid_until,
        }
        if self.evidence:
            d["evidence"] = self.evidence
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "DisputePayload":
        return cls(
            version=d["version"],
            receipt_hash=d["receiptHash"],
            reason=d["reason"],
            requested_amount=d["requestedAmount"],
            valid_until=d["validUntil"],
            evidence=list(d.get("evidence", [])),
        )


@dataclass
class ResolutionPayload:
    """Canonical resolution envelope contents."""

    version: int
    dispute_hash: str
    verdict: str
    settled_amount: str
    arbiter: str
    issued_at: int
    refund_transaction: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "version": self.version,
            "disputeHash": self.dispute_hash,
            "verdict": self.verdict,
            "settledAmount": self.settled_amount,
            "arbiter": self.arbiter,
            "issuedAt": self.issued_at,
        }
        if self.refund_transaction:
            d["refundTransaction"] = self.refund_transaction
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ResolutionPayload":
        return cls(
            version=d["version"],
            dispute_hash=d["disputeHash"],
            verdict=d["verdict"],
            settled_amount=d["settledAmount"],
            arbiter=d["arbiter"],
            issued_at=d["issuedAt"],
            refund_transaction=d.get("refundTransaction", ""),
        )


@dataclass
class SignedDispute:
    """A signed dispute envelope."""

    format: SignatureFormat
    signature: str
    payload: Optional[DisputePayload] = None
    signer: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"format": self.format, "signature": self.signature}
        if self.payload:
            d["payload"] = self.payload.to_dict()
        if self.signer:
            d["signer"] = self.signer
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "SignedDispute":
        payload_d = d.get("payload")
        payload = (
            DisputePayload.from_dict(payload_d) if payload_d else None
        )
        return cls(
            format=d["format"],
            signature=d["signature"],
            payload=payload,
            signer=d.get("signer", ""),
        )


@dataclass
class SignedResolution:
    """A signed resolution envelope."""

    format: SignatureFormat
    signature: str
    payload: Optional[ResolutionPayload] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {"format": self.format, "signature": self.signature}
        if self.payload:
            d["payload"] = self.payload.to_dict()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "SignedResolution":
        payload_d = d.get("payload")
        payload = (
            ResolutionPayload.from_dict(payload_d) if payload_d else None
        )
        return cls(
            format=d["format"],
            signature=d["signature"],
            payload=payload,
        )


@dataclass
class TermsInfo:
    """Server-declared dispute terms (used in 402 response)."""

    arbiter: str
    arbiter_scheme: ArbiterScheme
    dispute_window: int
    supported_reasons: List[str]
    evidence_uri_schemes: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "arbiter": self.arbiter,
            "arbiterScheme": self.arbiter_scheme,
            "disputeWindow": self.dispute_window,
            "supportedReasons": self.supported_reasons,
        }
        if self.evidence_uri_schemes is not None:
            d["evidenceUriSchemes"] = self.evidence_uri_schemes
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TermsInfo":
        return cls(
            arbiter=d["arbiter"],
            arbiter_scheme=d["arbiterScheme"],
            dispute_window=d["disputeWindow"],
            supported_reasons=list(d["supportedReasons"]),
            evidence_uri_schemes=(
                list(d["evidenceUriSchemes"])
                if "evidenceUriSchemes" in d
                else None
            ),
        )


# ===========================================================================
# Signer Protocols
# ===========================================================================


class DisputeSigner(Protocol):
    def sign_dispute(self, payload: DisputePayload) -> str: ...
    def sign_resolution(self, payload: ResolutionPayload) -> str: ...
    def get_address(self) -> str: ...


class DisputeVerifier(Protocol):
    def recover_dispute_signer(
        self, payload: DisputePayload, signature: str
    ) -> str: ...
    def recover_resolution_signer(
        self, payload: ResolutionPayload, signature: str
    ) -> str: ...


# ===========================================================================
# EIP-712 normalization
# ===========================================================================


def normalize_dispute_for_signing(p: DisputePayload) -> Dict[str, Any]:
    return {
        "version": p.version,
        "receiptHash": p.receipt_hash,
        "reason": p.reason,
        "requestedAmount": p.requested_amount,
        "validUntil": p.valid_until,
        "evidence": list(p.evidence) if p.evidence else [],
    }


def normalize_resolution_for_signing(p: ResolutionPayload) -> Dict[str, Any]:
    return {
        "version": p.version,
        "disputeHash": p.dispute_hash,
        "verdict": p.verdict,
        "settledAmount": p.settled_amount,
        "arbiter": p.arbiter,
        "issuedAt": p.issued_at,
        "refundTransaction": p.refund_transaction or "",
    }


# ===========================================================================
# Signing + verification
# ===========================================================================


class JWSReservedError(RuntimeError):
    """Raised on attempts to use JWS-format envelopes; reserved for future spec."""


def create_signed_dispute(
    signer: DisputeSigner,
    payload: DisputePayload,
    signer_address: str = "",
) -> SignedDispute:
    """Sign a dispute payload. signer_address optionally records an
    explicit delegate signer (e.g. ERC-7710)."""
    sig = signer.sign_dispute(payload)
    return SignedDispute(
        format="eip712",
        signature=sig,
        payload=payload,
        signer=signer_address,
    )


def create_signed_resolution(
    signer: DisputeSigner, payload: ResolutionPayload
) -> SignedResolution:
    """Sign a resolution payload with the arbiter's signer."""
    sig = signer.sign_resolution(payload)
    return SignedResolution(format="eip712", signature=sig, payload=payload)


def verify_dispute(
    verifier: DisputeVerifier, signed: SignedDispute
) -> Tuple[bool, str, Optional[DisputePayload]]:
    """Verify a signed dispute. Returns (valid, signer_address, payload)."""
    if signed.format == "jws":
        raise JWSReservedError(
            "JWS format is reserved for future spec; only EIP-712 is supported"
        )
    if signed.format != "eip712" or signed.payload is None:
        return False, "", None
    try:
        recovered = verifier.recover_dispute_signer(
            signed.payload, signed.signature
        )
    except Exception:
        return False, "", None
    if not recovered:
        return False, "", None
    signer = signed.signer or recovered
    return True, signer, signed.payload


def verify_resolution(
    verifier: DisputeVerifier,
    signed: SignedResolution,
    expected_arbiter: str = "",
) -> Tuple[bool, str, Optional[ResolutionPayload]]:
    """Verify a signed resolution. If expected_arbiter is non-empty, the
    recovered address must equal it (case-insensitive); otherwise the
    result is invalid."""
    if signed.format == "jws":
        raise JWSReservedError(
            "JWS format is reserved for future spec; only EIP-712 is supported"
        )
    if signed.format != "eip712" or signed.payload is None:
        return False, "", None
    try:
        recovered = verifier.recover_resolution_signer(
            signed.payload, signed.signature
        )
    except Exception:
        return False, "", None
    if not recovered:
        return False, "", None
    if expected_arbiter and recovered.lower() != expected_arbiter.lower():
        return False, "", None
    return True, recovered, signed.payload


def is_dispute_expired(signed: SignedDispute, now_unix: Optional[int] = None) -> bool:
    if signed.format != "eip712" or signed.payload is None:
        return False
    now = now_unix if now_unix is not None else int(time.time())
    return signed.payload.valid_until < now


def is_verdict_amount_consistent(
    resolution: SignedResolution, dispute_requested_amount: str
) -> bool:
    """Enforce the verdict <-> settledAmount consistency rule from spec
    §Verification."""
    if resolution.format != "eip712" or resolution.payload is None:
        return True
    try:
        settled = int(resolution.payload.settled_amount)
        requested = int(dispute_requested_amount)
    except ValueError:
        return False
    verdict = resolution.payload.verdict
    if verdict in ("denied", "void"):
        return settled == 0
    if verdict == "upheld_full":
        return settled == requested
    if verdict == "upheld_partial":
        return 0 < settled <= requested
    return False


# ===========================================================================
# Client helpers
# ===========================================================================


def build_dispute_payload(
    receipt_hash: str,
    reason: str,
    requested_amount: str,
    evidence: Optional[List[str]] = None,
    valid_until: int = 0,
    version: int = 1,
) -> DisputePayload:
    """Build a DisputePayload with sane defaults."""
    if valid_until == 0:
        valid_until = int(time.time()) + DEFAULT_DISPUTE_VALIDITY_SECONDS
    return DisputePayload(
        version=version,
        receipt_hash=receipt_hash,
        reason=reason,
        requested_amount=requested_amount,
        valid_until=valid_until,
        evidence=list(evidence) if evidence else [],
    )


def build_and_sign_dispute(
    signer: DisputeSigner,
    receipt_hash: str,
    reason: str,
    requested_amount: str,
    evidence: Optional[List[str]] = None,
    valid_until: int = 0,
    version: int = 1,
    signer_address: str = "",
) -> SignedDispute:
    payload = build_dispute_payload(
        receipt_hash, reason, requested_amount, evidence, valid_until, version
    )
    return create_signed_dispute(signer, payload, signer_address)


def package_dispute_submission(signed: SignedDispute) -> Dict[str, Any]:
    """Wrap a SignedDispute in the extension submission shape."""
    return {"info": {"submission": signed.to_dict()}}


def build_dispute_submission_body(signed: SignedDispute) -> Dict[str, Any]:
    """Produce the full POST /v2/dispute body."""
    return {"extensions": {EXTENSION_KEY: package_dispute_submission(signed)}}


def extract_dispute_terms(
    extensions: Optional[Dict[str, Any]],
) -> Optional[TermsInfo]:
    """Extract dispute terms from a 402 response extensions block."""
    if not extensions:
        return None
    ext = extensions.get(EXTENSION_KEY)
    if not isinstance(ext, dict):
        return None
    info = ext.get("info")
    if not isinstance(info, dict):
        return None
    try:
        return TermsInfo.from_dict(info)
    except (KeyError, TypeError):
        return None


def is_standard_reason(reason: str) -> bool:
    return reason in STANDARD_DISPUTE_REASONS


def is_reason_well_formed(reason: str) -> bool:
    return reason in STANDARD_DISPUTE_REASONS or reason.startswith("x_")


# ===========================================================================
# Server helpers
# ===========================================================================


def build_dispute_requirements(terms: TermsInfo) -> Dict[str, Any]:
    """Construct the extension block for the 402 PaymentRequired response.
    Validates the inputs and raises ValueError on errors."""
    if terms.arbiter_scheme not in ARBITER_SCHEMES:
        raise ValueError(
            f"unsupported arbiterScheme {terms.arbiter_scheme!r}; "
            f"expected one of {ARBITER_SCHEMES}"
        )
    if terms.dispute_window <= 0:
        raise ValueError(
            f"disputeWindow must be positive (got {terms.dispute_window})"
        )
    if not terms.supported_reasons:
        raise ValueError("supportedReasons must not be empty")
    return {"info": terms.to_dict()}


def parse_dispute_submission(body: Any) -> Optional[SignedDispute]:
    """Parse a POST /v2/dispute body into a SignedDispute. Returns None
    when the body is malformed."""
    if not isinstance(body, dict):
        return None
    extensions = body.get("extensions")
    if not isinstance(extensions, dict):
        return None
    ext = extensions.get(EXTENSION_KEY)
    if not isinstance(ext, dict):
        return None
    info = ext.get("info")
    if not isinstance(info, dict):
        return None
    submission = info.get("submission")
    if not isinstance(submission, dict):
        return None
    try:
        return SignedDispute.from_dict(submission)
    except (KeyError, TypeError):
        return None


@dataclass
class DisputeValidation:
    valid: bool
    error: str = ""
    detail: str = ""


@dataclass
class ResolutionValidation:
    valid: bool
    error: str = ""
    detail: str = ""


def is_evidence_uri_allowed(uri: str, allowed_schemes: List[str]) -> bool:
    colon = uri.find(":")
    if colon <= 0:
        return False
    return uri[:colon] in allowed_schemes


def is_reason_supported(reason: str, supported: List[str]) -> bool:
    return reason in supported


def validate_dispute(
    verifier: DisputeVerifier,
    dispute: SignedDispute,
    receipt_issued_at: int,
    receipt_hash: str,
    receipt_amount: str,
    terms: TermsInfo,
    now_unix: Optional[int] = None,
) -> DisputeValidation:
    """Seven-step pipeline from spec §Verification."""
    if dispute.format != "eip712":
        return DisputeValidation(
            False, "dispute_unsupported_format", f"format {dispute.format!r}"
        )

    # (1) Signature.
    valid, _, _ = verify_dispute(verifier, dispute)
    if not valid:
        return DisputeValidation(False, "dispute_invalid_signature")

    payload = dispute.payload
    if payload is None:
        return DisputeValidation(
            False, "dispute_unsupported_format", "missing payload"
        )

    now = now_unix if now_unix is not None else int(time.time())

    # (2) Envelope expiry.
    if is_dispute_expired(dispute, now):
        return DisputeValidation(
            False,
            "dispute_expired",
            f"validUntil={payload.valid_until}, now={now}",
        )

    # (3) Receipt binding.
    if payload.receipt_hash.lower() != receipt_hash.lower():
        return DisputeValidation(
            False,
            "dispute_unknown_receipt",
            f"dispute.receiptHash={payload.receipt_hash} vs receipt={receipt_hash}",
        )

    # (4) Dispute window.
    window_end = receipt_issued_at + terms.dispute_window
    if now < receipt_issued_at or now > window_end:
        return DisputeValidation(
            False,
            "dispute_out_of_window",
            f"window=[{receipt_issued_at},{window_end}], now={now}",
        )

    # (5) Reason allowed.
    if not is_reason_supported(payload.reason, terms.supported_reasons):
        return DisputeValidation(
            False,
            "dispute_invalid_reason",
            f"reason {payload.reason!r} not in supportedReasons",
        )

    # (6) Amount bounded.
    try:
        requested = int(payload.requested_amount)
        receipt_amt = int(receipt_amount)
    except ValueError:
        return DisputeValidation(
            False,
            "dispute_amount_exceeds_receipt",
            "amount not a valid integer",
        )
    if requested > receipt_amt:
        return DisputeValidation(
            False,
            "dispute_amount_exceeds_receipt",
            f"requestedAmount={requested} > receipt.amount={receipt_amt}",
        )

    # (7) Evidence URI schemes.
    allowed = terms.evidence_uri_schemes or DEFAULT_EVIDENCE_URI_SCHEMES
    for uri in payload.evidence or []:
        if not is_evidence_uri_allowed(uri, allowed):
            return DisputeValidation(
                False,
                "dispute_evidence_uri_unsupported",
                f"URI {uri!r} not in allowed schemes",
            )

    return DisputeValidation(True)


def validate_resolution(
    verifier: DisputeVerifier,
    resolution: SignedResolution,
    dispute: SignedDispute,
    dispute_hash: str,
    expected_arbiter: str,
) -> ResolutionValidation:
    """Validate a resolution against the dispute it resolves."""
    if resolution.format != "eip712":
        return ResolutionValidation(False, "resolution_unsupported_format")

    # (1) Signature + arbiter check.
    valid, _, _ = verify_resolution(verifier, resolution, expected_arbiter)
    if not valid:
        return ResolutionValidation(False, "resolution_invalid_signature")

    payload = resolution.payload
    if payload is None:
        return ResolutionValidation(False, "resolution_unsupported_format")

    # (2) Resolution references our dispute.
    if payload.dispute_hash.lower() != dispute_hash.lower():
        return ResolutionValidation(False, "resolution_unknown_dispute")

    # (3) Payload-declared arbiter agrees with expected.
    if payload.arbiter.lower() != expected_arbiter.lower():
        return ResolutionValidation(False, "resolution_arbiter_mismatch")

    # (4) Verdict <-> settledAmount consistency.
    if dispute.format != "eip712" or dispute.payload is None:
        return ResolutionValidation(
            False, "resolution_unsupported_format", "dispute is not eip712"
        )
    if not is_verdict_amount_consistent(
        resolution, dispute.payload.requested_amount
    ):
        return ResolutionValidation(
            False,
            "resolution_verdict_amount_inconsistent",
            f"verdict={payload.verdict}, settled={payload.settled_amount}, "
            f"requested={dispute.payload.requested_amount}",
        )

    return ResolutionValidation(True)


def package_resolution_response(signed: SignedResolution) -> Dict[str, Any]:
    """Wrap a SignedResolution as the wire-format response extension."""
    return {"info": {"resolution": signed.to_dict()}}


# ===========================================================================
# Facilitator-as-arbiter handler
# ===========================================================================


class DisputeFacilitatorHandler:
    """Facilitator handler for the `facilitator` arbiterScheme. The signer's
    address is the arbiter address."""

    def __init__(self, signer: DisputeSigner):
        self._signer = signer

    def get_arbiter_address(self) -> str:
        return self._signer.get_address()

    def resolve_dispute(
        self,
        dispute_hash: str,
        verdict: str,
        settled_amount: str,
        refund_transaction: str = "",
        version: int = 1,
        issued_at: int = 0,
    ) -> SignedResolution:
        if issued_at == 0:
            issued_at = int(time.time())
        payload = ResolutionPayload(
            version=version,
            dispute_hash=dispute_hash,
            verdict=verdict,
            settled_amount=settled_amount,
            arbiter=self.get_arbiter_address(),
            issued_at=issued_at,
            refund_transaction=refund_transaction,
        )
        return create_signed_resolution(self._signer, payload)


def build_facilitator_resolution(
    handler: DisputeFacilitatorHandler,
    dispute_hash: str,
    verdict: str,
    settled_amount: str,
    refund_transaction: str = "",
) -> SignedResolution:
    """One-call helper to build a resolution from a pre-decided verdict."""
    return handler.resolve_dispute(
        dispute_hash=dispute_hash,
        verdict=verdict,
        settled_amount=settled_amount,
        refund_transaction=refund_transaction,
    )
