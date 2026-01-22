package upto

import (
	"encoding/json"
	"testing"
)

func TestPaymentRequirements(t *testing.T) {
	t.Run("should have upto scheme", func(t *testing.T) {
		req := &PaymentRequirements{
			Scheme:            "upto",
			Network:           "eip155:8453",
			MaxAmount:         "1000000",
			MinAmount:         "10000",
			Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			PayTo:             "0x1234567890123456789012345678901234567890",
			MaxTimeoutSeconds: 300,
			Extra: Extra{
				Unit:      "token",
				UnitPrice: "100",
			},
		}

		if req.Scheme != "upto" {
			t.Errorf("expected scheme 'upto', got '%s'", req.Scheme)
		}
		if req.MaxAmount != "1000000" {
			t.Errorf("expected maxAmount '1000000', got '%s'", req.MaxAmount)
		}
		if req.MinAmount != "10000" {
			t.Errorf("expected minAmount '10000', got '%s'", req.MinAmount)
		}
	})

	t.Run("should work without optional minAmount", func(t *testing.T) {
		req := &PaymentRequirements{
			Scheme:            "upto",
			Network:           "eip155:8453",
			MaxAmount:         "1000000",
			Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			PayTo:             "0x1234567890123456789012345678901234567890",
			MaxTimeoutSeconds: 300,
			Extra:             Extra{},
		}

		if req.Scheme != "upto" {
			t.Errorf("expected scheme 'upto', got '%s'", req.Scheme)
		}
		if req.MinAmount != "" {
			t.Errorf("expected empty minAmount, got '%s'", req.MinAmount)
		}
	})
}

func TestExtra(t *testing.T) {
	t.Run("should support billing unit configuration", func(t *testing.T) {
		extra := Extra{
			Unit:          "token",
			UnitPrice:     "100",
			Name:          "USD Coin",
			Version:       "2",
			RouterAddress: "0x1234567890123456789012345678901234567890",
		}

		if extra.Unit != "token" {
			t.Errorf("expected unit 'token', got '%s'", extra.Unit)
		}
		if extra.UnitPrice != "100" {
			t.Errorf("expected unitPrice '100', got '%s'", extra.UnitPrice)
		}
		if extra.Name != "USD Coin" {
			t.Errorf("expected name 'USD Coin', got '%s'", extra.Name)
		}
		if extra.Version != "2" {
			t.Errorf("expected version '2', got '%s'", extra.Version)
		}
	})

	t.Run("should marshal and unmarshal with additional fields", func(t *testing.T) {
		extra := Extra{
			Unit:      "token",
			UnitPrice: "100",
			Additional: map[string]interface{}{
				"customField": "customValue",
			},
		}

		data, err := json.Marshal(extra)
		if err != nil {
			t.Fatalf("failed to marshal extra: %v", err)
		}

		var result map[string]interface{}
		if err := json.Unmarshal(data, &result); err != nil {
			t.Fatalf("failed to unmarshal to map: %v", err)
		}

		if result["unit"] != "token" {
			t.Errorf("expected unit 'token', got '%v'", result["unit"])
		}
		if result["customField"] != "customValue" {
			t.Errorf("expected customField 'customValue', got '%v'", result["customField"])
		}
	})
}

func TestSettlement(t *testing.T) {
	t.Run("should contain settle amount", func(t *testing.T) {
		settlement := &Settlement{
			SettleAmount: "150000",
		}

		if settlement.SettleAmount != "150000" {
			t.Errorf("expected settleAmount '150000', got '%s'", settlement.SettleAmount)
		}
	})

	t.Run("should support usage details", func(t *testing.T) {
		settlement := &Settlement{
			SettleAmount: "150000",
			UsageDetails: &UsageDetails{
				UnitsConsumed: 1500,
				UnitPrice:     "100",
				UnitType:      "token",
			},
		}

		if settlement.UsageDetails.UnitsConsumed != 1500 {
			t.Errorf("expected unitsConsumed 1500, got %d", settlement.UsageDetails.UnitsConsumed)
		}
	})
}

func TestUsageDetails(t *testing.T) {
	t.Run("should track usage metrics", func(t *testing.T) {
		usage := &UsageDetails{
			UnitsConsumed: 1500,
			UnitPrice:     "100",
			UnitType:      "token",
			StartTime:     1740672000,
			EndTime:       1740675600,
			Metadata: map[string]interface{}{
				"model":            "gpt-4",
				"promptTokens":     100,
				"completionTokens": 1400,
			},
		}

		if usage.UnitsConsumed != 1500 {
			t.Errorf("expected unitsConsumed 1500, got %d", usage.UnitsConsumed)
		}
		if usage.StartTime != 1740672000 {
			t.Errorf("expected startTime 1740672000, got %d", usage.StartTime)
		}
		if usage.EndTime != 1740675600 {
			t.Errorf("expected endTime 1740675600, got %d", usage.EndTime)
		}
		if usage.Metadata["model"] != "gpt-4" {
			t.Errorf("expected model 'gpt-4', got '%v'", usage.Metadata["model"])
		}
	})
}

func TestSettlementResponse(t *testing.T) {
	t.Run("should report successful settlement", func(t *testing.T) {
		response := &SettlementResponse{
			Success:         true,
			TransactionHash: "0xabc123",
			SettledAmount:   "150000",
			MaxAmount:       "1000000",
			BlockNumber:     12345678,
			GasUsed:         "85000",
		}

		if !response.Success {
			t.Error("expected success true")
		}
		if response.SettledAmount != "150000" {
			t.Errorf("expected settledAmount '150000', got '%s'", response.SettledAmount)
		}
		if response.MaxAmount != "1000000" {
			t.Errorf("expected maxAmount '1000000', got '%s'", response.MaxAmount)
		}
	})

	t.Run("should report failed settlement", func(t *testing.T) {
		response := &SettlementResponse{
			Success:       false,
			SettledAmount: "0",
			MaxAmount:     "1000000",
			Error:         "Insufficient balance",
		}

		if response.Success {
			t.Error("expected success false")
		}
		if response.Error != "Insufficient balance" {
			t.Errorf("expected error 'Insufficient balance', got '%s'", response.Error)
		}
	})
}

func TestValidationResult(t *testing.T) {
	t.Run("should indicate valid payment", func(t *testing.T) {
		result := &ValidationResult{
			IsValid:            true,
			ValidatedMaxAmount: "1000000",
			Payer:              "0x1234567890123456789012345678901234567890",
			ExpiresAt:          1740675600,
		}

		if !result.IsValid {
			t.Error("expected isValid true")
		}
		if result.ValidatedMaxAmount != "1000000" {
			t.Errorf("expected validatedMaxAmount '1000000', got '%s'", result.ValidatedMaxAmount)
		}
	})

	t.Run("should indicate invalid payment with reason", func(t *testing.T) {
		result := &ValidationResult{
			IsValid:       false,
			InvalidReason: "Permit signature is invalid",
		}

		if result.IsValid {
			t.Error("expected isValid false")
		}
		if result.InvalidReason != "Permit signature is invalid" {
			t.Errorf("expected invalidReason 'Permit signature is invalid', got '%s'", result.InvalidReason)
		}
	})
}

func TestIsUptoPaymentRequirements(t *testing.T) {
	t.Run("should return true for upto requirements", func(t *testing.T) {
		data := map[string]interface{}{
			"scheme":            "upto",
			"network":           "eip155:8453",
			"maxAmount":         "1000000",
			"asset":             "0x123",
			"payTo":             "0x456",
			"maxTimeoutSeconds": 300,
			"extra":             map[string]interface{}{},
		}

		if !IsUptoPaymentRequirements(data) {
			t.Error("expected IsUptoPaymentRequirements to return true")
		}
	})

	t.Run("should return false for exact requirements", func(t *testing.T) {
		data := map[string]interface{}{
			"scheme":            "exact",
			"network":           "eip155:8453",
			"amount":            "1000000",
			"asset":             "0x123",
			"payTo":             "0x456",
			"maxTimeoutSeconds": 300,
			"extra":             map[string]interface{}{},
		}

		if IsUptoPaymentRequirements(data) {
			t.Error("expected IsUptoPaymentRequirements to return false for exact scheme")
		}
	})

	t.Run("should return false for missing maxAmount", func(t *testing.T) {
		data := map[string]interface{}{
			"scheme":  "upto",
			"network": "eip155:8453",
			"amount":  "1000000", // wrong field name
		}

		if IsUptoPaymentRequirements(data) {
			t.Error("expected IsUptoPaymentRequirements to return false without maxAmount")
		}
	})
}

func TestIsValidUnit(t *testing.T) {
	validUnits := []string{"token", "request", "second", "minute", "byte", "kb", "mb"}
	for _, unit := range validUnits {
		if !IsValidUnit(unit) {
			t.Errorf("expected '%s' to be a valid unit", unit)
		}
	}

	invalidUnits := []string{"invalid", "unknown", ""}
	for _, unit := range invalidUnits {
		if IsValidUnit(unit) {
			t.Errorf("expected '%s' to be an invalid unit", unit)
		}
	}
}

func TestConstants(t *testing.T) {
	t.Run("should have correct Scheme constant", func(t *testing.T) {
		if Scheme != "upto" {
			t.Errorf("expected Scheme 'upto', got '%s'", Scheme)
		}
	})

	t.Run("should have correct defaults", func(t *testing.T) {
		if DefaultMinAmount != "1000" {
			t.Errorf("expected DefaultMinAmount '1000', got '%s'", DefaultMinAmount)
		}
		if DefaultMaxTimeoutSeconds != 300 {
			t.Errorf("expected DefaultMaxTimeoutSeconds 300, got %d", DefaultMaxTimeoutSeconds)
		}
	})

	t.Run("should have supported units", func(t *testing.T) {
		expectedUnits := []string{"token", "request", "second", "minute", "byte", "kb", "mb"}
		if len(SupportedUnits) != len(expectedUnits) {
			t.Errorf("expected %d supported units, got %d", len(expectedUnits), len(SupportedUnits))
		}
		for i, unit := range expectedUnits {
			if SupportedUnits[i] != unit {
				t.Errorf("expected unit[%d] '%s', got '%s'", i, unit, SupportedUnits[i])
			}
		}
	})
}

func TestNewPaymentRequirements(t *testing.T) {
	req := NewPaymentRequirements("eip155:8453", "1000000", "0x123", "0x456")

	if req.Scheme != Scheme {
		t.Errorf("expected scheme '%s', got '%s'", Scheme, req.Scheme)
	}
	if req.Network != "eip155:8453" {
		t.Errorf("expected network 'eip155:8453', got '%s'", req.Network)
	}
	if req.MaxAmount != "1000000" {
		t.Errorf("expected maxAmount '1000000', got '%s'", req.MaxAmount)
	}
	if req.MinAmount != DefaultMinAmount {
		t.Errorf("expected minAmount '%s', got '%s'", DefaultMinAmount, req.MinAmount)
	}
	if req.MaxTimeoutSeconds != DefaultMaxTimeoutSeconds {
		t.Errorf("expected maxTimeoutSeconds %d, got %d", DefaultMaxTimeoutSeconds, req.MaxTimeoutSeconds)
	}
}

func TestBuilderPattern(t *testing.T) {
	t.Run("should create settlement with usage details", func(t *testing.T) {
		settlement := NewSettlement("150000").
			WithUsageDetails(NewUsageDetails(1500, "100", "token").
				WithTimeRange(1740672000, 1740675600).
				WithMetadata(map[string]interface{}{"model": "gpt-4"}))

		if settlement.SettleAmount != "150000" {
			t.Errorf("expected settleAmount '150000', got '%s'", settlement.SettleAmount)
		}
		if settlement.UsageDetails == nil {
			t.Fatal("expected usageDetails to be set")
		}
		if settlement.UsageDetails.UnitsConsumed != 1500 {
			t.Errorf("expected unitsConsumed 1500, got %d", settlement.UsageDetails.UnitsConsumed)
		}
		if settlement.UsageDetails.StartTime != 1740672000 {
			t.Errorf("expected startTime 1740672000, got %d", settlement.UsageDetails.StartTime)
		}
		if settlement.UsageDetails.Metadata["model"] != "gpt-4" {
			t.Errorf("expected model 'gpt-4', got '%v'", settlement.UsageDetails.Metadata["model"])
		}
	})
}
