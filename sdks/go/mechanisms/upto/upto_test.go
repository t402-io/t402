package upto

import (
	"encoding/json"
	"testing"
)

func TestConstants(t *testing.T) {
	if Scheme != "upto" {
		t.Errorf("Scheme = %q, want %q", Scheme, "upto")
	}
	if DefaultMinAmount != "1000" {
		t.Errorf("DefaultMinAmount = %q, want %q", DefaultMinAmount, "1000")
	}
	if DefaultMaxTimeoutSeconds != 300 {
		t.Errorf("DefaultMaxTimeoutSeconds = %d, want %d", DefaultMaxTimeoutSeconds, 300)
	}
	if len(SupportedUnits) != 7 {
		t.Errorf("len(SupportedUnits) = %d, want 7", len(SupportedUnits))
	}
}

func TestIsValidUnit(t *testing.T) {
	valid := []string{"token", "request", "second", "minute", "byte", "kb", "mb"}
	for _, u := range valid {
		if !IsValidUnit(u) {
			t.Errorf("IsValidUnit(%q) = false, want true", u)
		}
	}
	invalid := []string{"", "tokens", "hour", "gb", "invalid"}
	for _, u := range invalid {
		if IsValidUnit(u) {
			t.Errorf("IsValidUnit(%q) = true, want false", u)
		}
	}
}

func TestNewPaymentRequirements(t *testing.T) {
	req := NewPaymentRequirements("eip155:8453", "1000000", "0xtoken", "0xpayto")

	if req.Scheme != Scheme {
		t.Errorf("Scheme = %q, want %q", req.Scheme, Scheme)
	}
	if req.Network != "eip155:8453" {
		t.Errorf("Network = %q, want %q", req.Network, "eip155:8453")
	}
	if req.MaxAmount != "1000000" {
		t.Errorf("MaxAmount = %q, want %q", req.MaxAmount, "1000000")
	}
	if req.MinAmount != DefaultMinAmount {
		t.Errorf("MinAmount = %q, want %q", req.MinAmount, DefaultMinAmount)
	}
	if req.Asset != "0xtoken" {
		t.Errorf("Asset = %q, want %q", req.Asset, "0xtoken")
	}
	if req.PayTo != "0xpayto" {
		t.Errorf("PayTo = %q, want %q", req.PayTo, "0xpayto")
	}
	if req.MaxTimeoutSeconds != DefaultMaxTimeoutSeconds {
		t.Errorf("MaxTimeoutSeconds = %d, want %d", req.MaxTimeoutSeconds, DefaultMaxTimeoutSeconds)
	}
}

func TestNewSettlement(t *testing.T) {
	s := NewSettlement("150000")
	if s.SettleAmount != "150000" {
		t.Errorf("SettleAmount = %q, want %q", s.SettleAmount, "150000")
	}
	if s.UsageDetails != nil {
		t.Error("UsageDetails should be nil")
	}
}

func TestNewSettlementWithUsage(t *testing.T) {
	s := NewSettlementWithUsage("150000", 1500, "100", "token")
	if s.SettleAmount != "150000" {
		t.Errorf("SettleAmount = %q, want %q", s.SettleAmount, "150000")
	}
	if s.UsageDetails == nil {
		t.Fatal("UsageDetails should not be nil")
	}
	if s.UsageDetails.UnitsConsumed != 1500 {
		t.Errorf("UnitsConsumed = %d, want %d", s.UsageDetails.UnitsConsumed, 1500)
	}
	if s.UsageDetails.UnitPrice != "100" {
		t.Errorf("UnitPrice = %q, want %q", s.UsageDetails.UnitPrice, "100")
	}
	if s.UsageDetails.UnitType != "token" {
		t.Errorf("UnitType = %q, want %q", s.UsageDetails.UnitType, "token")
	}
}

func TestSuccessResponse(t *testing.T) {
	r := SuccessResponse("150000", "1000000", "0xabc123")
	if !r.Success {
		t.Error("Success should be true")
	}
	if r.SettledAmount != "150000" {
		t.Errorf("SettledAmount = %q, want %q", r.SettledAmount, "150000")
	}
	if r.MaxAmount != "1000000" {
		t.Errorf("MaxAmount = %q, want %q", r.MaxAmount, "1000000")
	}
	if r.TransactionHash != "0xabc123" {
		t.Errorf("TransactionHash = %q, want %q", r.TransactionHash, "0xabc123")
	}
	if r.Error != "" {
		t.Errorf("Error should be empty, got %q", r.Error)
	}
}

func TestFailureResponse(t *testing.T) {
	r := FailureResponse("1000000", "insufficient balance")
	if r.Success {
		t.Error("Success should be false")
	}
	if r.SettledAmount != "0" {
		t.Errorf("SettledAmount = %q, want %q", r.SettledAmount, "0")
	}
	if r.MaxAmount != "1000000" {
		t.Errorf("MaxAmount = %q, want %q", r.MaxAmount, "1000000")
	}
	if r.Error != "insufficient balance" {
		t.Errorf("Error = %q, want %q", r.Error, "insufficient balance")
	}
}

func TestValidResult(t *testing.T) {
	v := Valid("1000000", "0xpayer", 1709251200)
	if !v.IsValid {
		t.Error("IsValid should be true")
	}
	if v.ValidatedMaxAmount != "1000000" {
		t.Errorf("ValidatedMaxAmount = %q, want %q", v.ValidatedMaxAmount, "1000000")
	}
	if v.Payer != "0xpayer" {
		t.Errorf("Payer = %q, want %q", v.Payer, "0xpayer")
	}
	if v.ExpiresAt == nil || *v.ExpiresAt != 1709251200 {
		t.Errorf("ExpiresAt = %v, want 1709251200", v.ExpiresAt)
	}
}

func TestInvalidResult(t *testing.T) {
	v := Invalid("expired")
	if v.IsValid {
		t.Error("IsValid should be false")
	}
	if v.InvalidReason != "expired" {
		t.Errorf("InvalidReason = %q, want %q", v.InvalidReason, "expired")
	}
}

func TestIsUptoRequirements(t *testing.T) {
	valid := map[string]interface{}{
		"scheme":    "upto",
		"maxAmount": "1000000",
		"network":   "eip155:8453",
	}
	if !IsUptoRequirements(valid) {
		t.Error("IsUptoRequirements should return true for valid data")
	}

	// Wrong scheme
	exact := map[string]interface{}{
		"scheme": "exact",
		"amount": "1000000",
	}
	if IsUptoRequirements(exact) {
		t.Error("IsUptoRequirements should return false for exact scheme")
	}

	// Missing maxAmount
	noMax := map[string]interface{}{
		"scheme": "upto",
	}
	if IsUptoRequirements(noMax) {
		t.Error("IsUptoRequirements should return false without maxAmount")
	}

	// Nil map
	if IsUptoRequirements(nil) {
		t.Error("IsUptoRequirements should return false for nil")
	}
}

func TestJSONSerialization(t *testing.T) {
	req := NewPaymentRequirements("eip155:8453", "1000000", "0xtoken", "0xpayto")
	req.Extra = &Extra{Unit: "token", UnitPrice: "100"}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded PaymentRequirements
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}

	if decoded.Scheme != req.Scheme {
		t.Errorf("Scheme = %q, want %q", decoded.Scheme, req.Scheme)
	}
	if decoded.MaxAmount != req.MaxAmount {
		t.Errorf("MaxAmount = %q, want %q", decoded.MaxAmount, req.MaxAmount)
	}
	if decoded.Extra == nil || decoded.Extra.Unit != "token" {
		t.Error("Extra.Unit should be 'token'")
	}
	if decoded.Extra.UnitPrice != "100" {
		t.Errorf("Extra.UnitPrice = %q, want %q", decoded.Extra.UnitPrice, "100")
	}
}

func TestSettlementJSONRoundTrip(t *testing.T) {
	s := NewSettlementWithUsage("150000", 1500, "100", "token")
	s.UsageDetails.StartTime = 1709244000
	s.UsageDetails.EndTime = 1709247600
	s.UsageDetails.Metadata = map[string]interface{}{"model": "gpt-4"}

	data, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var decoded Settlement
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}

	if decoded.SettleAmount != "150000" {
		t.Errorf("SettleAmount = %q, want %q", decoded.SettleAmount, "150000")
	}
	if decoded.UsageDetails == nil {
		t.Fatal("UsageDetails should not be nil")
	}
	if decoded.UsageDetails.UnitsConsumed != 1500 {
		t.Errorf("UnitsConsumed = %d, want %d", decoded.UsageDetails.UnitsConsumed, 1500)
	}
	if decoded.UsageDetails.StartTime != 1709244000 {
		t.Errorf("StartTime = %d, want %d", decoded.UsageDetails.StartTime, 1709244000)
	}
	if decoded.UsageDetails.Metadata["model"] != "gpt-4" {
		t.Errorf("Metadata[model] = %v, want gpt-4", decoded.UsageDetails.Metadata["model"])
	}
}
