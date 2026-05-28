package dispute

import (
	"encoding/json"
	"strings"
	"time"
)

// DefaultDisputeValiditySeconds is the default envelope lifetime when
// BuildDisputePayload is called without an explicit ValidUntil — 24h
// per spec §Security Considerations.
const DefaultDisputeValiditySeconds = 24 * 60 * 60

// BuildDisputePayloadParams holds the inputs for BuildDisputePayload.
type BuildDisputePayloadParams struct {
	ReceiptHash     string
	Reason          DisputeReason
	RequestedAmount string
	Evidence        []string
	ValidUntil      int64 // 0 = use default (now + 24h)
	Version         int   // 0 = default to 1
}

// BuildDisputePayload constructs a DisputePayload with sane defaults.
func BuildDisputePayload(params BuildDisputePayloadParams) *DisputePayload {
	version := params.Version
	if version == 0 {
		version = 1
	}
	validUntil := params.ValidUntil
	if validUntil == 0 {
		validUntil = time.Now().Unix() + int64(DefaultDisputeValiditySeconds)
	}
	return &DisputePayload{
		Version:         version,
		ReceiptHash:     params.ReceiptHash,
		Reason:          params.Reason,
		RequestedAmount: params.RequestedAmount,
		ValidUntil:      validUntil,
		Evidence:        params.Evidence,
	}
}

// BuildAndSignDispute builds a payload and signs it in one call.
// signerAddress is optional (see CreateSignedDispute).
func BuildAndSignDispute(signer Signer, params BuildDisputePayloadParams, signerAddress string) (*SignedDispute, error) {
	payload := BuildDisputePayload(params)
	return CreateSignedDispute(signer, payload, signerAddress)
}

// PackageDisputeSubmission wraps a SignedDispute in the wire-format
// extension shape used by POST /v2/dispute bodies.
func PackageDisputeSubmission(signed *SignedDispute) *SubmissionExtension {
	ext := &SubmissionExtension{}
	ext.Info.Submission = *signed
	return ext
}

// BuildDisputeSubmissionBody produces the full JSON body for a dispute
// POST: { "extensions": { "dispute": { "info": { "submission": ... } } } }.
func BuildDisputeSubmissionBody(signed *SignedDispute) map[string]interface{} {
	return map[string]interface{}{
		"extensions": map[string]interface{}{
			ExtensionKey: PackageDisputeSubmission(signed),
		},
	}
}

// ExtractDisputeTerms parses the "dispute" extension out of the 402
// response's extensions map and returns the TermsInfo. Returns nil if
// the extension is absent or malformed.
func ExtractDisputeTerms(extensions map[string]json.RawMessage) *TermsInfo {
	raw, ok := extensions[ExtensionKey]
	if !ok {
		return nil
	}
	var ext RequirementsExtension
	if err := json.Unmarshal(raw, &ext); err != nil {
		return nil
	}
	terms := ext.Info
	return &terms
}

// IsStandardReason reports whether the reason is one of the closed-enum
// standard reasons (not an x_*-prefixed extension).
func IsStandardReason(reason DisputeReason) bool {
	for _, r := range StandardReasons {
		if r == reason {
			return true
		}
	}
	return false
}

// IsReasonWellFormed reports whether the reason string is either a
// standard reason or an x_*-prefixed extension. Catches typos before
// the 402 ships or a dispute is signed.
func IsReasonWellFormed(reason string) bool {
	for _, r := range StandardReasons {
		if string(r) == reason {
			return true
		}
	}
	return strings.HasPrefix(reason, "x_")
}
