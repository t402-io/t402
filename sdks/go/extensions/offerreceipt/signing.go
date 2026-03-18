package offerreceipt

import (
	"strings"
	"time"
)

// Signer creates EIP-712 signatures for offers and receipts.
type Signer interface {
	// SignOffer signs an offer payload and returns the signature.
	SignOffer(payload *OfferPayload) (string, error)
	// SignReceipt signs a receipt payload and returns the signature.
	SignReceipt(payload *ReceiptPayload) (string, error)
	// GetAddress returns the signer's address.
	GetAddress() string
}

// Verifier verifies EIP-712 signatures on offers and receipts.
type Verifier interface {
	// RecoverOfferSigner recovers the signer address from an offer signature.
	RecoverOfferSigner(payload *OfferPayload, signature string) (string, error)
	// RecoverReceiptSigner recovers the signer address from a receipt signature.
	RecoverReceiptSigner(payload *ReceiptPayload, signature string) (string, error)
}

// CreateSignedOffer creates a signed offer from a payload.
func CreateSignedOffer(signer Signer, payload *OfferPayload, acceptIndex *int) (*SignedOffer, error) {
	sig, err := signer.SignOffer(payload)
	if err != nil {
		return nil, err
	}
	return &SignedOffer{
		Format:      FormatEIP712,
		Payload:     payload,
		Signature:   sig,
		AcceptIndex: acceptIndex,
	}, nil
}

// CreateSignedReceipt creates a signed receipt from a payload.
func CreateSignedReceipt(signer Signer, payload *ReceiptPayload) (*SignedReceipt, error) {
	sig, err := signer.SignReceipt(payload)
	if err != nil {
		return nil, err
	}
	return &SignedReceipt{
		Format:    FormatEIP712,
		Payload:   payload,
		Signature: sig,
	}, nil
}

// VerifyOfferResult contains the result of offer verification.
type VerifyOfferResult struct {
	Valid   bool
	Signer  string
	Payload *OfferPayload
}

// VerifyOffer verifies a signed offer.
func VerifyOffer(verifier Verifier, offer *SignedOffer) (*VerifyOfferResult, error) {
	if offer.Format != FormatEIP712 || offer.Payload == nil {
		return &VerifyOfferResult{Valid: false}, nil
	}

	signerAddr, err := verifier.RecoverOfferSigner(offer.Payload, offer.Signature)
	if err != nil {
		return &VerifyOfferResult{Valid: false}, nil
	}

	return &VerifyOfferResult{
		Valid:   true,
		Signer:  signerAddr,
		Payload: offer.Payload,
	}, nil
}

// VerifyReceiptResult contains the result of receipt verification.
type VerifyReceiptResult struct {
	Valid   bool
	Signer  string
	Payload *ReceiptPayload
}

// VerifyReceipt verifies a signed receipt.
func VerifyReceipt(verifier Verifier, receipt *SignedReceipt) (*VerifyReceiptResult, error) {
	if receipt.Format != FormatEIP712 || receipt.Payload == nil {
		return &VerifyReceiptResult{Valid: false}, nil
	}

	signerAddr, err := verifier.RecoverReceiptSigner(receipt.Payload, receipt.Signature)
	if err != nil {
		return &VerifyReceiptResult{Valid: false}, nil
	}

	return &VerifyReceiptResult{
		Valid:   true,
		Signer:  signerAddr,
		Payload: receipt.Payload,
	}, nil
}

// MatchOfferToRequirements checks if an offer matches payment requirements.
func MatchOfferToRequirements(offer *SignedOffer, scheme, network, asset, payTo, amount string) bool {
	if offer.Format != FormatEIP712 || offer.Payload == nil {
		return false
	}
	p := offer.Payload
	return p.Scheme == scheme &&
		p.Network == network &&
		strings.EqualFold(p.Asset, asset) &&
		strings.EqualFold(p.PayTo, payTo) &&
		p.Amount == amount
}

// IsOfferExpired checks if an offer has expired.
func IsOfferExpired(offer *SignedOffer, now time.Time) bool {
	if offer.Format != FormatEIP712 || offer.Payload == nil {
		return true
	}
	if offer.Payload.ValidUntil == 0 {
		return false
	}
	return now.Unix() > offer.Payload.ValidUntil
}
