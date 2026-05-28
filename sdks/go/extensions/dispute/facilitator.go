package dispute

import "time"

// FacilitatorResolveInput holds inputs for the arbiter-side handler.
type FacilitatorResolveInput struct {
	DisputeHash       string
	Verdict           Verdict
	SettledAmount     string
	RefundTransaction string
	Version           int   // 0 = default to 1
	IssuedAt          int64 // 0 = time.Now().Unix()
}

// FacilitatorHandler signs resolutions for the "facilitator" arbiterScheme.
// The arbiter address is the handler's signer address.
type FacilitatorHandler struct {
	signer Signer
}

// NewFacilitatorHandler builds a handler that uses the given signer as
// arbiter. The handler's GetArbiterAddress is the signer's address; the
// signed resolution's payload.arbiter is filled accordingly.
func NewFacilitatorHandler(signer Signer) *FacilitatorHandler {
	return &FacilitatorHandler{signer: signer}
}

// GetArbiterAddress returns the address this handler uses as arbiter.
func (h *FacilitatorHandler) GetArbiterAddress() string {
	return h.signer.GetAddress()
}

// ResolveDispute signs a resolution for a verified dispute.
func (h *FacilitatorHandler) ResolveDispute(input FacilitatorResolveInput) (*SignedResolution, error) {
	version := input.Version
	if version == 0 {
		version = 1
	}
	issuedAt := input.IssuedAt
	if issuedAt == 0 {
		issuedAt = time.Now().Unix()
	}
	payload := &ResolutionPayload{
		Version:           version,
		DisputeHash:       input.DisputeHash,
		Verdict:           input.Verdict,
		SettledAmount:     input.SettledAmount,
		Arbiter:           h.GetArbiterAddress(),
		IssuedAt:          issuedAt,
		RefundTransaction: input.RefundTransaction,
	}
	return CreateSignedResolution(h.signer, payload)
}

// BuildFacilitatorResolution is a one-call helper for facilitators
// acting on a pre-decided verdict.
func BuildFacilitatorResolution(
	handler *FacilitatorHandler,
	disputeHash string,
	verdict Verdict,
	settledAmount string,
	refundTransaction string,
) (*SignedResolution, error) {
	return handler.ResolveDispute(FacilitatorResolveInput{
		DisputeHash:       disputeHash,
		Verdict:           verdict,
		SettledAmount:     settledAmount,
		RefundTransaction: refundTransaction,
	})
}
