package attestation

import (
	"testing"
)

type mockVerifier struct {
	attestations map[string][]Attestation
}

func (m *mockVerifier) GetAttestation(network, uid string) (*Attestation, error) {
	return nil, nil
}

func (m *mockVerifier) GetAttestationsForRecipient(network, recipient, schema string) ([]Attestation, error) {
	key := recipient + ":" + schema
	return m.attestations[key], nil
}

func TestVerifyAttestations_HasRequired(t *testing.T) {
	v := &mockVerifier{
		attestations: map[string][]Attestation{
			"0xPayer:" + CoinbaseSchemas[TypeVerifiedAccount]: {
				{UID: "att-1", Type: TypeVerifiedAccount, Recipient: "0xPayer"},
			},
		},
	}

	ok, reason := VerifyAttestations(v, "eip155:8453", "0xPayer", &AttestationRequirement{
		Required: []AttestationType{TypeVerifiedAccount},
		Schemas:  CoinbaseSchemas,
	})
	if !ok {
		t.Errorf("expected valid, got: %s", reason)
	}
}

func TestVerifyAttestations_MissingRequired(t *testing.T) {
	v := &mockVerifier{attestations: map[string][]Attestation{}}

	ok, reason := VerifyAttestations(v, "eip155:8453", "0xPayer", &AttestationRequirement{
		Required: []AttestationType{TypeVerifiedAccount},
		Schemas:  CoinbaseSchemas,
	})
	if ok {
		t.Error("expected invalid for missing attestation")
	}
	if reason != "missing attestation: verified-account" {
		t.Errorf("wrong reason: %s", reason)
	}
}

func TestVerifyAttestations_RevokedSkipped(t *testing.T) {
	v := &mockVerifier{
		attestations: map[string][]Attestation{
			"0xPayer:" + CoinbaseSchemas[TypeVerifiedAccount]: {
				{UID: "att-1", Type: TypeVerifiedAccount, Revoked: true},
			},
		},
	}

	ok, _ := VerifyAttestations(v, "eip155:8453", "0xPayer", &AttestationRequirement{
		Required: []AttestationType{TypeVerifiedAccount},
		Schemas:  CoinbaseSchemas,
	})
	if ok {
		t.Error("revoked attestation should not count")
	}
}

func TestVerifyAttestations_CountryAllowed(t *testing.T) {
	v := &mockVerifier{
		attestations: map[string][]Attestation{
			"0xPayer:" + CoinbaseSchemas[TypeVerifiedCountry]: {
				{UID: "att-1", Type: TypeVerifiedCountry, Data: map[string]interface{}{"country": "US"}},
			},
		},
	}

	ok, _ := VerifyAttestations(v, "eip155:8453", "0xPayer", &AttestationRequirement{
		Required:         []AttestationType{TypeVerifiedCountry},
		Schemas:          CoinbaseSchemas,
		AllowedCountries: []string{"US", "JP", "TW"},
	})
	if !ok {
		t.Error("US should be allowed")
	}
}

func TestVerifyAttestations_CountryBlocked(t *testing.T) {
	v := &mockVerifier{
		attestations: map[string][]Attestation{
			"0xPayer:" + CoinbaseSchemas[TypeVerifiedCountry]: {
				{UID: "att-1", Type: TypeVerifiedCountry, Data: map[string]interface{}{"country": "KP"}},
			},
		},
	}

	ok, reason := VerifyAttestations(v, "eip155:8453", "0xPayer", &AttestationRequirement{
		Required:         []AttestationType{TypeVerifiedCountry},
		Schemas:          CoinbaseSchemas,
		BlockedCountries: []string{"KP", "IR"},
	})
	if ok {
		t.Error("KP should be blocked")
	}
	if reason != "country not allowed: KP" {
		t.Errorf("wrong reason: %s", reason)
	}
}

func TestIsCountryAllowed(t *testing.T) {
	// No restrictions
	if !isCountryAllowed("US", nil, nil) {
		t.Error("any country should be allowed with no restrictions")
	}

	// Allowlist
	if !isCountryAllowed("US", []string{"US", "JP"}, nil) {
		t.Error("US should be in allowlist")
	}
	if isCountryAllowed("CN", []string{"US", "JP"}, nil) {
		t.Error("CN should not be in allowlist")
	}

	// Blocklist
	if isCountryAllowed("KP", nil, []string{"KP"}) {
		t.Error("KP should be blocked")
	}
	if !isCountryAllowed("US", nil, []string{"KP"}) {
		t.Error("US should not be blocked")
	}
}

func TestEASContracts(t *testing.T) {
	if EASContracts["eip155:8453"] == "" {
		t.Error("Base mainnet EAS address missing")
	}
}

func TestCoinbaseSchemas(t *testing.T) {
	if CoinbaseSchemas[TypeVerifiedAccount] == "" {
		t.Error("verified-account schema missing")
	}
	if CoinbaseSchemas[TypeVerifiedCountry] == "" {
		t.Error("verified-country schema missing")
	}
}
