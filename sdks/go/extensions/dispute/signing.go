package dispute

import (
	"math/big"
	"strings"
	"time"
)

// Signer creates EIP-712 signatures for disputes and resolutions.
type Signer interface {
	// SignDispute signs a dispute payload and returns the signature.
	SignDispute(payload *DisputePayload) (string, error)
	// SignResolution signs a resolution payload and returns the signature.
	SignResolution(payload *ResolutionPayload) (string, error)
	// GetAddress returns the signer's address.
	GetAddress() string
}

// Verifier verifies EIP-712 signatures on disputes and resolutions.
type Verifier interface {
	// RecoverDisputeSigner recovers the signer address from a dispute
	// signature.
	RecoverDisputeSigner(payload *DisputePayload, signature string) (string, error)
	// RecoverResolutionSigner recovers the signer address from a
	// resolution signature.
	RecoverResolutionSigner(payload *ResolutionPayload, signature string) (string, error)
}

// CreateSignedDispute signs a dispute payload. signerAddress is optional;
// when non-empty, it records an explicit delegate signer per spec rule
// §Verification rule 2 (allows ERC-7710 delegate signing).
func CreateSignedDispute(signer Signer, payload *DisputePayload, signerAddress string) (*SignedDispute, error) {
	sig, err := signer.SignDispute(payload)
	if err != nil {
		return nil, err
	}
	return &SignedDispute{
		Format:    FormatEIP712,
		Payload:   payload,
		Signature: sig,
		Signer:    signerAddress,
	}, nil
}

// CreateSignedResolution signs a resolution payload with the arbiter's signer.
func CreateSignedResolution(signer Signer, payload *ResolutionPayload) (*SignedResolution, error) {
	sig, err := signer.SignResolution(payload)
	if err != nil {
		return nil, err
	}
	return &SignedResolution{
		Format:    FormatEIP712,
		Payload:   payload,
		Signature: sig,
	}, nil
}

// VerifyDisputeResult holds the outcome of a dispute signature recovery.
type VerifyDisputeResult struct {
	Valid   bool
	Signer  string
	Payload *DisputePayload
}

// VerifyDispute recovers the signer address from a SignedDispute. The
// returned Signer field is the explicit Signer in the envelope (for
// delegate-signed disputes) or the recovered address.
//
// Note: this only verifies the signature, NOT business-level rules
// like dispute-window enforcement or receipt binding. Use ValidateDispute
// for the full pipeline.
func VerifyDispute(verifier Verifier, signed *SignedDispute) (*VerifyDisputeResult, error) {
	if signed.Format == FormatJWS {
		return nil, ErrJWSReserved
	}
	if signed.Format != FormatEIP712 || signed.Payload == nil {
		return &VerifyDisputeResult{Valid: false}, nil
	}
	addr, err := verifier.RecoverDisputeSigner(signed.Payload, signed.Signature)
	if err != nil || addr == "" {
		return &VerifyDisputeResult{Valid: false}, nil
	}
	recoveredSigner := signed.Signer
	if recoveredSigner == "" {
		recoveredSigner = addr
	}
	return &VerifyDisputeResult{
		Valid:   true,
		Signer:  recoveredSigner,
		Payload: signed.Payload,
	}, nil
}

// VerifyResolutionResult holds the outcome of a resolution signature
// recovery.
type VerifyResolutionResult struct {
	Valid   bool
	Signer  string
	Payload *ResolutionPayload
}

// VerifyResolution recovers the signer address from a SignedResolution.
// If expectedArbiter is non-empty, the recovered address must equal it
// (case-insensitive); otherwise the result is invalid.
func VerifyResolution(verifier Verifier, signed *SignedResolution, expectedArbiter string) (*VerifyResolutionResult, error) {
	if signed.Format == FormatJWS {
		return nil, ErrJWSReserved
	}
	if signed.Format != FormatEIP712 || signed.Payload == nil {
		return &VerifyResolutionResult{Valid: false}, nil
	}
	addr, err := verifier.RecoverResolutionSigner(signed.Payload, signed.Signature)
	if err != nil || addr == "" {
		return &VerifyResolutionResult{Valid: false}, nil
	}
	if expectedArbiter != "" && !strings.EqualFold(addr, expectedArbiter) {
		return &VerifyResolutionResult{Valid: false}, nil
	}
	return &VerifyResolutionResult{
		Valid:   true,
		Signer:  addr,
		Payload: signed.Payload,
	}, nil
}

// IsDisputeExpired reports whether the envelope is past its validUntil.
func IsDisputeExpired(signed *SignedDispute, now time.Time) bool {
	if signed.Format != FormatEIP712 || signed.Payload == nil {
		return false
	}
	return now.Unix() > signed.Payload.ValidUntil
}

// IsVerdictAmountConsistent enforces the verdict ↔ settledAmount rule
// from spec §Verification on the resolution side: denied/void → 0;
// upheld_full → equals requested; upheld_partial → in (0, requested].
func IsVerdictAmountConsistent(resolution *SignedResolution, disputeRequestedAmount string) bool {
	if resolution.Format != FormatEIP712 || resolution.Payload == nil {
		return true
	}
	settled, ok := new(big.Int).SetString(resolution.Payload.SettledAmount, 10)
	if !ok {
		return false
	}
	requested, ok := new(big.Int).SetString(disputeRequestedAmount, 10)
	if !ok {
		return false
	}
	switch resolution.Payload.Verdict {
	case VerdictDenied, VerdictVoid:
		return settled.Sign() == 0
	case VerdictUpheldFull:
		return settled.Cmp(requested) == 0
	case VerdictUpheldPartial:
		return settled.Sign() > 0 && settled.Cmp(requested) <= 0
	default:
		return false
	}
}
