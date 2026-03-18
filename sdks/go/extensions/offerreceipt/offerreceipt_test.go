package offerreceipt

import (
	"testing"
	"time"
)

// Mock signer
type mockSigner struct{}

func (m *mockSigner) SignOffer(p *OfferPayload) (string, error)   { return "0xoffer_sig", nil }
func (m *mockSigner) SignReceipt(p *ReceiptPayload) (string, error) { return "0xreceipt_sig", nil }
func (m *mockSigner) GetAddress() string                           { return "0xserver1234" }

// Mock verifier
type mockVerifier struct{ fail bool }

func (m *mockVerifier) RecoverOfferSigner(p *OfferPayload, sig string) (string, error) {
	if m.fail {
		return "", &verifyError{}
	}
	return "0xserver1234", nil
}
func (m *mockVerifier) RecoverReceiptSigner(p *ReceiptPayload, sig string) (string, error) {
	if m.fail {
		return "", &verifyError{}
	}
	return "0xserver1234", nil
}

type verifyError struct{}

func (e *verifyError) Error() string { return "invalid signature" }

func TestCreateSignedOffer(t *testing.T) {
	signer := &mockSigner{}
	idx := 0
	payload := &OfferPayload{
		Version: 1, ResourceURL: "https://api.example.com/data",
		Scheme: "exact", Network: "eip155:8453",
		Asset: "0xUSDC", PayTo: "0xserver1234", Amount: "10000",
	}

	offer, err := CreateSignedOffer(signer, payload, &idx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if offer.Format != FormatEIP712 {
		t.Errorf("expected eip712, got %s", offer.Format)
	}
	if offer.Signature != "0xoffer_sig" {
		t.Errorf("wrong signature: %s", offer.Signature)
	}
	if offer.AcceptIndex == nil || *offer.AcceptIndex != 0 {
		t.Error("wrong acceptIndex")
	}
}

func TestCreateSignedReceipt(t *testing.T) {
	signer := &mockSigner{}
	payload := &ReceiptPayload{
		Version: 1, Network: "eip155:8453",
		ResourceURL: "https://api.example.com/data",
		Payer: "0xpayer", IssuedAt: 1700000000,
		Transaction: "0xtxhash",
	}

	receipt, err := CreateSignedReceipt(signer, payload)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if receipt.Format != FormatEIP712 {
		t.Errorf("expected eip712, got %s", receipt.Format)
	}
	if receipt.Signature != "0xreceipt_sig" {
		t.Errorf("wrong signature: %s", receipt.Signature)
	}
}

func TestVerifyOffer_Valid(t *testing.T) {
	verifier := &mockVerifier{}
	offer := &SignedOffer{
		Format:  FormatEIP712,
		Payload: &OfferPayload{Version: 1, Scheme: "exact"},
		Signature: "0xvalid",
	}

	result, err := VerifyOffer(verifier, offer)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Valid {
		t.Error("expected valid")
	}
	if result.Signer != "0xserver1234" {
		t.Errorf("wrong signer: %s", result.Signer)
	}
}

func TestVerifyOffer_Invalid(t *testing.T) {
	verifier := &mockVerifier{fail: true}
	offer := &SignedOffer{
		Format:  FormatEIP712,
		Payload: &OfferPayload{Version: 1},
		Signature: "0xinvalid",
	}

	result, _ := VerifyOffer(verifier, offer)
	if result.Valid {
		t.Error("expected invalid")
	}
}

func TestVerifyOffer_JWSNotSupported(t *testing.T) {
	verifier := &mockVerifier{}
	offer := &SignedOffer{Format: FormatJWS, Signature: "eyJ..."}

	result, _ := VerifyOffer(verifier, offer)
	if result.Valid {
		t.Error("JWS should not be valid yet")
	}
}

func TestMatchOfferToRequirements(t *testing.T) {
	offer := &SignedOffer{
		Format: FormatEIP712,
		Payload: &OfferPayload{
			Scheme: "exact", Network: "eip155:8453",
			Asset: "0xUSDC", PayTo: "0xServer", Amount: "10000",
		},
	}

	if !MatchOfferToRequirements(offer, "exact", "eip155:8453", "0xusdc", "0xserver", "10000") {
		t.Error("should match (case-insensitive)")
	}

	if MatchOfferToRequirements(offer, "exact", "eip155:1", "0xUSDC", "0xServer", "10000") {
		t.Error("should not match different network")
	}

	if MatchOfferToRequirements(offer, "exact", "eip155:8453", "0xUSDC", "0xServer", "99999") {
		t.Error("should not match different amount")
	}
}

func TestIsOfferExpired(t *testing.T) {
	// No expiry
	noExpiry := &SignedOffer{
		Format: FormatEIP712,
		Payload: &OfferPayload{ValidUntil: 0},
	}
	if IsOfferExpired(noExpiry, time.Now()) {
		t.Error("should not be expired when validUntil=0")
	}

	// Not yet expired
	future := &SignedOffer{
		Format: FormatEIP712,
		Payload: &OfferPayload{ValidUntil: 9999999999},
	}
	if IsOfferExpired(future, time.Unix(1700000000, 0)) {
		t.Error("should not be expired")
	}

	// Expired
	past := &SignedOffer{
		Format: FormatEIP712,
		Payload: &OfferPayload{ValidUntil: 1700000000},
	}
	if !IsOfferExpired(past, time.Unix(1700000001, 0)) {
		t.Error("should be expired")
	}
}

func TestCreateOffersFromRequirements(t *testing.T) {
	config := &ServerConfig{
		Signer:      &mockSigner{},
		ResourceURL: "https://api.example.com/data",
	}

	accepts := []AcceptedMethod{
		{Scheme: "exact", Network: "eip155:8453", Asset: "0xUSDC", PayTo: "0xserver", Amount: "10000"},
		{Scheme: "exact", Network: "eip155:1", Asset: "0xUSDT0", PayTo: "0xserver", Amount: "10000"},
	}

	offers, err := CreateOffersFromRequirements(config, accepts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(offers) != 2 {
		t.Fatalf("expected 2 offers, got %d", len(offers))
	}
	if offers[0].Payload.Network != "eip155:8453" {
		t.Errorf("wrong network: %s", offers[0].Payload.Network)
	}
	if offers[0].AcceptIndex == nil || *offers[0].AcceptIndex != 0 {
		t.Error("wrong acceptIndex for first offer")
	}
	if offers[1].AcceptIndex == nil || *offers[1].AcceptIndex != 1 {
		t.Error("wrong acceptIndex for second offer")
	}
}

func TestCreateReceiptForPayment(t *testing.T) {
	config := &ServerConfig{
		Signer:      &mockSigner{},
		ResourceURL: "https://api.example.com/data",
	}

	receipt, err := CreateReceiptForPayment(config, "eip155:8453", "0xpayer", "0xtxhash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if receipt.Payload.Network != "eip155:8453" {
		t.Errorf("wrong network: %s", receipt.Payload.Network)
	}
	if receipt.Payload.Payer != "0xpayer" {
		t.Errorf("wrong payer: %s", receipt.Payload.Payer)
	}
	if receipt.Payload.IssuedAt == 0 {
		t.Error("issuedAt should be set")
	}
}

func TestEIP712Constants(t *testing.T) {
	domain := OfferDomain()
	if domain["name"] != "t402 offer" {
		t.Errorf("wrong offer domain name: %s", domain["name"])
	}

	domain = ReceiptDomain()
	if domain["name"] != "t402 receipt" {
		t.Errorf("wrong receipt domain name: %s", domain["name"])
	}

	types := OfferTypes()
	if len(types) != 8 {
		t.Errorf("expected 8 offer fields, got %d", len(types))
	}

	types = ReceiptTypes()
	if len(types) != 6 {
		t.Errorf("expected 6 receipt fields, got %d", len(types))
	}
}

func TestNormalizeOfferForSigning(t *testing.T) {
	p := &OfferPayload{
		Version: 1, ResourceURL: "https://example.com",
		Scheme: "exact", Network: "eip155:8453",
		Asset: "0xUSDC", PayTo: "0xserver", Amount: "10000",
	}

	m := NormalizeOfferForSigning(p)
	if m["amount"] != "10000" {
		t.Errorf("wrong amount: %v", m["amount"])
	}
}

func TestNormalizeReceiptForSigning(t *testing.T) {
	p := &ReceiptPayload{
		Version: 1, Network: "eip155:8453",
		ResourceURL: "https://example.com",
		Payer: "0xpayer", IssuedAt: 1700000000,
	}

	m := NormalizeReceiptForSigning(p)
	if m["transaction"] != "" {
		t.Errorf("expected empty transaction, got: %v", m["transaction"])
	}
}
