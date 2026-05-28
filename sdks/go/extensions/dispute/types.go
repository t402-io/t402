// Package dispute implements the Dispute extension for t402.
//
// Disputes are cryptographic envelopes for the post-settlement
// reversibility cycle: a payer (or its delegate) signs a complaint
// against a previously issued receipt; an arbiter signs a verdict
// resolving the dispute.
//
// See specs/extensions/dispute.md for the protocol specification.
//
// t402 is the first HTTP-native stablecoin payment protocol with a
// standardized dispute primitive. Together with the offer-receipt
// extension, the four-step chain is:
//
//	Offer -> Receipt -> Dispute -> Resolution
package dispute

// ExtensionKey is the key used in the extensions map of 402 responses
// and dispute submission bodies.
const ExtensionKey = "dispute"

// SignatureFormat identifies the signing format. Only EIP-712 is
// currently implemented; JWS is reserved for future spec.
type SignatureFormat string

const (
	FormatEIP712 SignatureFormat = "eip712"
	FormatJWS    SignatureFormat = "jws"
)

// DisputeReason is one of the standard closed-enum reasons, or an
// "x_"-prefixed extension value defined by the server.
type DisputeReason string

const (
	ReasonNotDelivered       DisputeReason = "not_delivered"
	ReasonPartialDelivery    DisputeReason = "partial_delivery"
	ReasonQualityIssue       DisputeReason = "quality_issue"
	ReasonUnauthorized       DisputeReason = "unauthorized"
	ReasonServiceUnavailable DisputeReason = "service_unavailable"
	ReasonDuplicateCharge    DisputeReason = "duplicate_charge"
	ReasonOther              DisputeReason = "other"
)

// StandardReasons lists the closed-enum dispute reasons from the spec.
var StandardReasons = []DisputeReason{
	ReasonNotDelivered,
	ReasonPartialDelivery,
	ReasonQualityIssue,
	ReasonUnauthorized,
	ReasonServiceUnavailable,
	ReasonDuplicateCharge,
	ReasonOther,
}

// Verdict is the arbiter's decision on a dispute. Closed enum.
type Verdict string

const (
	VerdictUpheldFull    Verdict = "upheld_full"
	VerdictUpheldPartial Verdict = "upheld_partial"
	VerdictDenied        Verdict = "denied"
	VerdictVoid          Verdict = "void"
)

// Verdicts lists the closed-enum verdicts from the spec.
var Verdicts = []Verdict{
	VerdictUpheldFull,
	VerdictUpheldPartial,
	VerdictDenied,
	VerdictVoid,
}

// ArbiterScheme is the arbitration model declared by the server.
type ArbiterScheme string

const (
	ArbiterFacilitator ArbiterScheme = "facilitator"
	ArbiterContract    ArbiterScheme = "contract"
	ArbiterExternal    ArbiterScheme = "external"
	ArbiterNone        ArbiterScheme = "none"
)

// ArbiterSchemes lists the supported arbitration models.
var ArbiterSchemes = []ArbiterScheme{
	ArbiterFacilitator,
	ArbiterContract,
	ArbiterExternal,
	ArbiterNone,
}

// DisputePayload contains the canonical dispute fields for signing.
type DisputePayload struct {
	// Version is the extension version (currently 1).
	Version int `json:"version"`
	// ReceiptHash is the EIP-712 hash of the SignedReceipt being disputed.
	ReceiptHash string `json:"receiptHash"`
	// Reason is a standard or x_*-prefixed dispute reason.
	Reason DisputeReason `json:"reason"`
	// RequestedAmount is the refund requested in token smallest unit;
	// "0" indicates an on-record-only dispute with no refund.
	RequestedAmount string `json:"requestedAmount"`
	// ValidUntil is the unix-seconds expiry of the envelope.
	ValidUntil int64 `json:"validUntil"`
	// Evidence is an optional list of URIs pointing to dispute evidence.
	Evidence []string `json:"evidence,omitempty"`
}

// ResolutionPayload contains the canonical resolution fields for signing.
type ResolutionPayload struct {
	// Version is the extension version (currently 1).
	Version int `json:"version"`
	// DisputeHash is the EIP-712 hash of the SignedDispute being resolved.
	DisputeHash string `json:"disputeHash"`
	// Verdict is the arbiter's decision.
	Verdict Verdict `json:"verdict"`
	// SettledAmount is the actual refund amount granted; MUST be "0" for
	// denied or void verdicts.
	SettledAmount string `json:"settledAmount"`
	// Arbiter is the arbiter's address; MUST match the address advertised
	// in the receipt's offer.
	Arbiter string `json:"arbiter"`
	// IssuedAt is the unix-seconds resolution issuance time.
	IssuedAt int64 `json:"issuedAt"`
	// RefundTransaction is an optional on-chain refund tx hash or
	// off-chain reference like "offchain://wire/2026-05-28/INV-123".
	RefundTransaction string `json:"refundTransaction,omitempty"`
}

// SignedDispute is a signed dispute envelope.
type SignedDispute struct {
	Format SignatureFormat `json:"format"`
	// Payload is present for EIP-712 format; nil for JWS.
	Payload   *DisputePayload `json:"payload,omitempty"`
	Signature string          `json:"signature"`
	// Signer is the explicit signer address when signed by a delegate
	// (e.g. ERC-7710) rather than the payer themselves.
	Signer string `json:"signer,omitempty"`
}

// SignedResolution is a signed resolution envelope.
type SignedResolution struct {
	Format    SignatureFormat    `json:"format"`
	Payload   *ResolutionPayload `json:"payload,omitempty"`
	Signature string             `json:"signature"`
}

// TermsInfo is the server-declared dispute terms inside a 402 response.
type TermsInfo struct {
	Arbiter            string          `json:"arbiter"`
	ArbiterScheme      ArbiterScheme   `json:"arbiterScheme"`
	DisputeWindow      int64           `json:"disputeWindow"`
	SupportedReasons   []DisputeReason `json:"supportedReasons"`
	EvidenceURISchemes []string        `json:"evidenceUriSchemes,omitempty"`
}

// RequirementsExtension is the extensions["dispute"] block of a 402
// PaymentRequired response.
type RequirementsExtension struct {
	Info TermsInfo `json:"info"`
}

// SubmissionExtension is the extensions["dispute"] block of a dispute
// submission body (POST /v2/dispute).
type SubmissionExtension struct {
	Info struct {
		Submission SignedDispute `json:"submission"`
	} `json:"info"`
}

// ResolutionExtension is the extensions["dispute"] block of a resolution
// response body.
type ResolutionExtension struct {
	Info struct {
		Resolution SignedResolution `json:"resolution"`
	} `json:"info"`
}

// ValidationError is a closed enum of dispute validation error codes.
type ValidationError string

const (
	ErrDisputeInvalidSignature       ValidationError = "dispute_invalid_signature"
	ErrDisputeUnknownReceipt         ValidationError = "dispute_unknown_receipt"
	ErrDisputeOutOfWindow            ValidationError = "dispute_out_of_window"
	ErrDisputeInvalidReason          ValidationError = "dispute_invalid_reason"
	ErrDisputeAmountExceedsReceipt   ValidationError = "dispute_amount_exceeds_receipt"
	ErrDisputeEvidenceURIUnsupported ValidationError = "dispute_evidence_uri_unsupported"
	ErrDisputeExpired                ValidationError = "dispute_expired"
	ErrDisputeUnsupportedFormat      ValidationError = "dispute_unsupported_format"
)

// ResolutionValidationError is the closed enum for resolution validation.
type ResolutionValidationError string

const (
	ErrResolutionInvalidSignature        ResolutionValidationError = "resolution_invalid_signature"
	ErrResolutionArbiterMismatch         ResolutionValidationError = "resolution_arbiter_mismatch"
	ErrResolutionUnknownDispute          ResolutionValidationError = "resolution_unknown_dispute"
	ErrResolutionVerdictAmountInconsist  ResolutionValidationError = "resolution_verdict_amount_inconsistent"
	ErrResolutionUnsupportedFormat       ResolutionValidationError = "resolution_unsupported_format"
)

// DisputeValidation is the result of validating an incoming dispute.
type DisputeValidation struct {
	Valid  bool
	Error  ValidationError
	Detail string
}

// ResolutionValidation is the result of validating a resolution.
type ResolutionValidation struct {
	Valid  bool
	Error  ResolutionValidationError
	Detail string
}
