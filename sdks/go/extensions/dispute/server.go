package dispute

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"
)

// DefaultEvidenceURISchemes is the spec default for evidenceUriSchemes
// when not declared by the server.
var DefaultEvidenceURISchemes = []string{"ipfs", "arweave", "https"}

// BuildDisputeRequirements constructs the extension block for the 402
// PaymentRequired response. Validates the inputs.
func BuildDisputeRequirements(terms TermsInfo) (*RequirementsExtension, error) {
	if !isArbiterSchemeValid(terms.ArbiterScheme) {
		return nil, fmt.Errorf(
			"dispute: unsupported arbiterScheme %q; expected one of facilitator, contract, external, none",
			terms.ArbiterScheme,
		)
	}
	if terms.DisputeWindow <= 0 {
		return nil, fmt.Errorf("dispute: disputeWindow must be positive (got %d)", terms.DisputeWindow)
	}
	if len(terms.SupportedReasons) == 0 {
		return nil, fmt.Errorf("dispute: supportedReasons must not be empty")
	}
	return &RequirementsExtension{Info: terms}, nil
}

// ParseDisputeSubmission decodes a POST /v2/dispute body into a SignedDispute.
// Returns nil if the body is malformed.
func ParseDisputeSubmission(body json.RawMessage) *SignedDispute {
	var envelope struct {
		Extensions map[string]json.RawMessage `json:"extensions"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil
	}
	raw, ok := envelope.Extensions[ExtensionKey]
	if !ok {
		return nil
	}
	var ext SubmissionExtension
	if err := json.Unmarshal(raw, &ext); err != nil {
		return nil
	}
	return &ext.Info.Submission
}

// ValidateDisputeInput bundles inputs for the seven-step validation
// pipeline. ReceiptIssuedAt is the receipt's issued-at unix-seconds;
// ReceiptHash binds the dispute to the receipt; ReceiptAmount is used
// to bound the requested refund.
type ValidateDisputeInput struct {
	Verifier        Verifier
	Dispute         *SignedDispute
	ReceiptIssuedAt int64
	ReceiptHash     string
	ReceiptAmount   string
	Terms           TermsInfo
	Now             time.Time // zero = time.Now()
}

// ValidateDispute runs the seven-step pipeline from spec §Verification.
func ValidateDispute(input ValidateDisputeInput) (*DisputeValidation, error) {
	if input.Dispute == nil {
		return &DisputeValidation{
			Valid:  false,
			Error:  ErrDisputeUnsupportedFormat,
			Detail: "dispute is nil",
		}, nil
	}
	if input.Dispute.Format != FormatEIP712 {
		return &DisputeValidation{
			Valid:  false,
			Error:  ErrDisputeUnsupportedFormat,
			Detail: fmt.Sprintf("format %q not supported", input.Dispute.Format),
		}, nil
	}

	// (1) Signature.
	verify, err := VerifyDispute(input.Verifier, input.Dispute)
	if err != nil {
		return nil, err
	}
	if !verify.Valid {
		return &DisputeValidation{
			Valid: false,
			Error: ErrDisputeInvalidSignature,
		}, nil
	}

	payload := input.Dispute.Payload
	now := input.Now
	if now.IsZero() {
		now = time.Now()
	}

	// (2) Envelope expiry.
	if IsDisputeExpired(input.Dispute, now) {
		return &DisputeValidation{
			Valid:  false,
			Error:  ErrDisputeExpired,
			Detail: fmt.Sprintf("validUntil=%d, now=%d", payload.ValidUntil, now.Unix()),
		}, nil
	}

	// (3) Receipt hash binding.
	if !strings.EqualFold(payload.ReceiptHash, input.ReceiptHash) {
		return &DisputeValidation{
			Valid:  false,
			Error:  ErrDisputeUnknownReceipt,
			Detail: fmt.Sprintf("dispute.receiptHash=%s vs receipt.hash=%s", payload.ReceiptHash, input.ReceiptHash),
		}, nil
	}

	// (4) Dispute window.
	windowEnd := input.ReceiptIssuedAt + input.Terms.DisputeWindow
	if now.Unix() < input.ReceiptIssuedAt || now.Unix() > windowEnd {
		return &DisputeValidation{
			Valid:  false,
			Error:  ErrDisputeOutOfWindow,
			Detail: fmt.Sprintf("window=[%d,%d], now=%d", input.ReceiptIssuedAt, windowEnd, now.Unix()),
		}, nil
	}

	// (5) Reason allowed.
	if !isReasonSupported(payload.Reason, input.Terms.SupportedReasons) {
		return &DisputeValidation{
			Valid:  false,
			Error:  ErrDisputeInvalidReason,
			Detail: fmt.Sprintf("reason %q not in supportedReasons", payload.Reason),
		}, nil
	}

	// (6) Amount bounded.
	requested, ok := new(big.Int).SetString(payload.RequestedAmount, 10)
	if !ok {
		return &DisputeValidation{
			Valid:  false,
			Error:  ErrDisputeAmountExceedsReceipt,
			Detail: "requestedAmount not a valid integer",
		}, nil
	}
	receiptAmt, ok := new(big.Int).SetString(input.ReceiptAmount, 10)
	if !ok {
		return &DisputeValidation{
			Valid:  false,
			Error:  ErrDisputeAmountExceedsReceipt,
			Detail: "receipt amount not a valid integer",
		}, nil
	}
	if requested.Cmp(receiptAmt) > 0 {
		return &DisputeValidation{
			Valid:  false,
			Error:  ErrDisputeAmountExceedsReceipt,
			Detail: fmt.Sprintf("requestedAmount=%s > receipt.amount=%s", payload.RequestedAmount, input.ReceiptAmount),
		}, nil
	}

	// (7) Evidence URI schemes.
	allowed := input.Terms.EvidenceURISchemes
	if len(allowed) == 0 {
		allowed = DefaultEvidenceURISchemes
	}
	for _, uri := range payload.Evidence {
		if !isEvidenceURIAllowed(uri, allowed) {
			return &DisputeValidation{
				Valid:  false,
				Error:  ErrDisputeEvidenceURIUnsupported,
				Detail: fmt.Sprintf("URI %q not in allowed schemes", uri),
			}, nil
		}
	}

	return &DisputeValidation{Valid: true}, nil
}

// ValidateResolutionInput bundles inputs for resolution validation.
type ValidateResolutionInput struct {
	Verifier        Verifier
	Resolution      *SignedResolution
	Dispute         *SignedDispute
	DisputeHash     string
	ExpectedArbiter string
}

// ValidateResolution validates a SignedResolution against the dispute
// it resolves.
func ValidateResolution(input ValidateResolutionInput) (*ResolutionValidation, error) {
	if input.Resolution == nil || input.Resolution.Format != FormatEIP712 {
		return &ResolutionValidation{
			Valid: false,
			Error: ErrResolutionUnsupportedFormat,
		}, nil
	}

	// (1) Signature + arbiter check.
	verify, err := VerifyResolution(input.Verifier, input.Resolution, input.ExpectedArbiter)
	if err != nil {
		return nil, err
	}
	if !verify.Valid {
		return &ResolutionValidation{
			Valid: false,
			Error: ErrResolutionInvalidSignature,
		}, nil
	}

	payload := input.Resolution.Payload

	// (2) Resolution must reference the dispute we have.
	if !strings.EqualFold(payload.DisputeHash, input.DisputeHash) {
		return &ResolutionValidation{
			Valid: false,
			Error: ErrResolutionUnknownDispute,
		}, nil
	}

	// (3) Payload-declared arbiter ↔ expected.
	if !strings.EqualFold(payload.Arbiter, input.ExpectedArbiter) {
		return &ResolutionValidation{
			Valid: false,
			Error: ErrResolutionArbiterMismatch,
		}, nil
	}

	// (4) Verdict ↔ settledAmount consistency.
	if input.Dispute == nil || input.Dispute.Format != FormatEIP712 || input.Dispute.Payload == nil {
		return &ResolutionValidation{
			Valid:  false,
			Error:  ErrResolutionUnsupportedFormat,
			Detail: "dispute is not eip712 format",
		}, nil
	}
	if !IsVerdictAmountConsistent(input.Resolution, input.Dispute.Payload.RequestedAmount) {
		return &ResolutionValidation{
			Valid: false,
			Error: ErrResolutionVerdictAmountInconsist,
			Detail: fmt.Sprintf(
				"verdict=%s, settled=%s, requested=%s",
				payload.Verdict, payload.SettledAmount, input.Dispute.Payload.RequestedAmount,
			),
		}, nil
	}

	return &ResolutionValidation{Valid: true}, nil
}

// PackageResolutionResponse wraps a SignedResolution as the wire-format
// response extension.
func PackageResolutionResponse(signed *SignedResolution) *ResolutionExtension {
	ext := &ResolutionExtension{}
	ext.Info.Resolution = *signed
	return ext
}

// IsEvidenceURIAllowed reports whether a URI uses a permitted scheme.
func IsEvidenceURIAllowed(uri string, allowedSchemes []string) bool {
	return isEvidenceURIAllowed(uri, allowedSchemes)
}

// IsReasonSupported reports whether the dispute's reason is in the
// server's accepted list.
func IsReasonSupported(reason DisputeReason, supported []DisputeReason) bool {
	return isReasonSupported(reason, supported)
}

// --- internal helpers ---

func isArbiterSchemeValid(s ArbiterScheme) bool {
	for _, valid := range ArbiterSchemes {
		if s == valid {
			return true
		}
	}
	return false
}

func isEvidenceURIAllowed(uri string, allowedSchemes []string) bool {
	colon := strings.Index(uri, ":")
	if colon <= 0 {
		return false
	}
	scheme := uri[:colon]
	for _, s := range allowedSchemes {
		if s == scheme {
			return true
		}
	}
	return false
}

func isReasonSupported(reason DisputeReason, supported []DisputeReason) bool {
	for _, s := range supported {
		if s == reason {
			return true
		}
	}
	return false
}
