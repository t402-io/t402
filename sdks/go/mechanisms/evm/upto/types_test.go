package upto

import (
	"math/big"
	"testing"
)

func TestPermitSignature(t *testing.T) {
	t.Run("should have correct structure", func(t *testing.T) {
		sig := PermitSignature{
			V: 27,
			R: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			S: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
		}

		if sig.V != 27 {
			t.Errorf("expected V 27, got %d", sig.V)
		}
		if len(sig.R) != 66 { // 0x + 64 hex chars
			t.Errorf("expected R length 66, got %d", len(sig.R))
		}
		if len(sig.S) != 66 {
			t.Errorf("expected S length 66, got %d", len(sig.S))
		}
	})
}

func TestPermitAuthorization(t *testing.T) {
	t.Run("should have correct structure", func(t *testing.T) {
		auth := PermitAuthorization{
			Owner:    "0x1234567890123456789012345678901234567890",
			Spender:  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Value:    "1000000",
			Deadline: "1740675689",
			Nonce:    5,
		}

		if len(auth.Owner) != 42 { // 0x + 40 hex chars
			t.Errorf("expected owner length 42, got %d", len(auth.Owner))
		}
		if len(auth.Spender) != 42 {
			t.Errorf("expected spender length 42, got %d", len(auth.Spender))
		}
		if auth.Value != "1000000" {
			t.Errorf("expected value '1000000', got '%s'", auth.Value)
		}
		if auth.Deadline != "1740675689" {
			t.Errorf("expected deadline '1740675689', got '%s'", auth.Deadline)
		}
		if auth.Nonce != 5 {
			t.Errorf("expected nonce 5, got %d", auth.Nonce)
		}
	})
}

func TestEIP2612Payload(t *testing.T) {
	t.Run("should have correct structure", func(t *testing.T) {
		payload := EIP2612Payload{
			Signature: PermitSignature{
				V: 28,
				R: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				S: "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
			},
			Authorization: PermitAuthorization{
				Owner:    "0x1234567890123456789012345678901234567890",
				Spender:  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
				Value:    "1000000",
				Deadline: "1740675689",
				Nonce:    0,
			},
			PaymentNonce: "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480",
		}

		if payload.Signature.V != 28 {
			t.Errorf("expected signature V 28, got %d", payload.Signature.V)
		}
		if payload.Authorization.Owner != "0x1234567890123456789012345678901234567890" {
			t.Errorf("expected owner address, got '%s'", payload.Authorization.Owner)
		}
		if len(payload.PaymentNonce) != 66 { // 0x + 64 hex chars
			t.Errorf("expected paymentNonce length 66, got %d", len(payload.PaymentNonce))
		}
	})
}

func TestExtra(t *testing.T) {
	t.Run("should have EIP-712 domain parameters", func(t *testing.T) {
		extra := Extra{
			Name:          "USD Coin",
			Version:       "2",
			RouterAddress: "0x1234567890123456789012345678901234567890",
			Unit:          "token",
			UnitPrice:     "100",
		}

		if extra.Name != "USD Coin" {
			t.Errorf("expected name 'USD Coin', got '%s'", extra.Name)
		}
		if extra.Version != "2" {
			t.Errorf("expected version '2', got '%s'", extra.Version)
		}
		if len(extra.RouterAddress) != 42 {
			t.Errorf("expected routerAddress length 42, got %d", len(extra.RouterAddress))
		}
		if extra.Unit != "token" {
			t.Errorf("expected unit 'token', got '%s'", extra.Unit)
		}
		if extra.UnitPrice != "100" {
			t.Errorf("expected unitPrice '100', got '%s'", extra.UnitPrice)
		}
	})

	t.Run("should work with minimal required fields", func(t *testing.T) {
		extra := Extra{
			Name:    "USDC",
			Version: "1",
		}

		if extra.Name != "USDC" {
			t.Errorf("expected name 'USDC', got '%s'", extra.Name)
		}
		if extra.Version != "1" {
			t.Errorf("expected version '1', got '%s'", extra.Version)
		}
		if extra.RouterAddress != "" {
			t.Errorf("expected empty routerAddress, got '%s'", extra.RouterAddress)
		}
	})
}

func TestSettlement(t *testing.T) {
	t.Run("should contain settle amount", func(t *testing.T) {
		settlement := Settlement{
			SettleAmount: "150000",
		}

		if settlement.SettleAmount != "150000" {
			t.Errorf("expected settleAmount '150000', got '%s'", settlement.SettleAmount)
		}
	})

	t.Run("should support usage details", func(t *testing.T) {
		settlement := Settlement{
			SettleAmount: "150000",
			UsageDetails: &UsageDetails{
				UnitsConsumed: 1500,
				UnitPrice:     "100",
				UnitType:      "token",
				StartTime:     1740672000,
				EndTime:       1740675600,
			},
		}

		if settlement.SettleAmount != "150000" {
			t.Errorf("expected settleAmount '150000', got '%s'", settlement.SettleAmount)
		}
		if settlement.UsageDetails.UnitsConsumed != 1500 {
			t.Errorf("expected unitsConsumed 1500, got %d", settlement.UsageDetails.UnitsConsumed)
		}
		if settlement.UsageDetails.UnitPrice != "100" {
			t.Errorf("expected unitPrice '100', got '%s'", settlement.UsageDetails.UnitPrice)
		}
		if settlement.UsageDetails.UnitType != "token" {
			t.Errorf("expected unitType 'token', got '%s'", settlement.UsageDetails.UnitType)
		}
	})
}

func TestPermitTypes(t *testing.T) {
	t.Run("should have correct EIP-712 structure", func(t *testing.T) {
		permitType, ok := PermitTypes["Permit"]
		if !ok {
			t.Fatal("expected Permit type to be defined")
		}

		if len(permitType) != 5 {
			t.Errorf("expected 5 fields in Permit type, got %d", len(permitType))
		}

		expectedFields := []string{"owner", "spender", "value", "nonce", "deadline"}
		for i, expected := range expectedFields {
			if permitType[i].Name != expected {
				t.Errorf("expected field[%d] name '%s', got '%s'", i, expected, permitType[i].Name)
			}
		}
	})
}

func TestIsEIP2612Payload(t *testing.T) {
	t.Run("should return true for valid payload", func(t *testing.T) {
		payload := map[string]interface{}{
			"signature": map[string]interface{}{
				"v": 28,
				"r": "0x123",
				"s": "0x456",
			},
			"authorization": map[string]interface{}{
				"owner":    "0x123",
				"spender":  "0x456",
				"value":    "1000",
				"deadline": "123456",
				"nonce":    0,
			},
			"paymentNonce": "0xabc",
		}

		if !IsEIP2612Payload(payload) {
			t.Error("expected IsEIP2612Payload to return true")
		}
	})

	t.Run("should return false for invalid payload", func(t *testing.T) {
		testCases := []map[string]interface{}{
			nil,
			{},
			{"signature": "0x123"},
			{
				"signature": map[string]interface{}{"v": 28},
				"authorization": map[string]interface{}{},
			},
		}

		for i, tc := range testCases {
			if IsEIP2612Payload(tc) {
				t.Errorf("testCase[%d]: expected IsEIP2612Payload to return false", i)
			}
		}
	})

	t.Run("should return false for exact scheme payload", func(t *testing.T) {
		// exact scheme uses different authorization structure
		exactPayload := map[string]interface{}{
			"signature": "0x123", // string, not object
			"authorization": map[string]interface{}{
				"from":        "0x123",
				"to":          "0x456",
				"value":       "1000",
				"validAfter":  "0",
				"validBefore": "999999",
				"nonce":       "0xabc",
			},
		}

		if IsEIP2612Payload(exactPayload) {
			t.Error("expected IsEIP2612Payload to return false for exact scheme payload")
		}
	})
}

func TestPayloadToMap(t *testing.T) {
	payload := &EIP2612Payload{
		Signature: PermitSignature{
			V: 28,
			R: "0x1234",
			S: "0x5678",
		},
		Authorization: PermitAuthorization{
			Owner:    "0xowner",
			Spender:  "0xspender",
			Value:    "1000000",
			Deadline: "1740675689",
			Nonce:    5,
		},
		PaymentNonce: "0xnonce",
	}

	result := payload.ToMap()

	if result["paymentNonce"] != "0xnonce" {
		t.Errorf("expected paymentNonce '0xnonce', got '%v'", result["paymentNonce"])
	}

	sig, ok := result["signature"].(map[string]interface{})
	if !ok {
		t.Fatal("expected signature to be a map")
	}
	if sig["v"] != 28 {
		t.Errorf("expected signature v 28, got %v", sig["v"])
	}

	auth, ok := result["authorization"].(map[string]interface{})
	if !ok {
		t.Fatal("expected authorization to be a map")
	}
	if auth["owner"] != "0xowner" {
		t.Errorf("expected owner '0xowner', got '%v'", auth["owner"])
	}
}

func TestPayloadFromMap(t *testing.T) {
	data := map[string]interface{}{
		"signature": map[string]interface{}{
			"v": float64(28),
			"r": "0x1234",
			"s": "0x5678",
		},
		"authorization": map[string]interface{}{
			"owner":    "0xowner",
			"spender":  "0xspender",
			"value":    "1000000",
			"deadline": "1740675689",
			"nonce":    float64(5),
		},
		"paymentNonce": "0xnonce",
	}

	payload, err := PayloadFromMap(data)
	if err != nil {
		t.Fatalf("PayloadFromMap failed: %v", err)
	}

	if payload.Signature.V != 28 {
		t.Errorf("expected V 28, got %d", payload.Signature.V)
	}
	if payload.Signature.R != "0x1234" {
		t.Errorf("expected R '0x1234', got '%s'", payload.Signature.R)
	}
	if payload.Authorization.Owner != "0xowner" {
		t.Errorf("expected owner '0xowner', got '%s'", payload.Authorization.Owner)
	}
	if payload.Authorization.Nonce != 5 {
		t.Errorf("expected nonce 5, got %d", payload.Authorization.Nonce)
	}
	if payload.PaymentNonce != "0xnonce" {
		t.Errorf("expected paymentNonce '0xnonce', got '%s'", payload.PaymentNonce)
	}
}

func TestCreatePermitDomain(t *testing.T) {
	domain := CreatePermitDomain("USD Coin", "2", big.NewInt(8453), "0xtoken")

	if domain.Name != "USD Coin" {
		t.Errorf("expected name 'USD Coin', got '%s'", domain.Name)
	}
	if domain.Version != "2" {
		t.Errorf("expected version '2', got '%s'", domain.Version)
	}
	if domain.ChainID.Cmp(big.NewInt(8453)) != 0 {
		t.Errorf("expected chainId 8453, got %s", domain.ChainID.String())
	}
	if domain.VerifyingContract != "0xtoken" {
		t.Errorf("expected verifyingContract '0xtoken', got '%s'", domain.VerifyingContract)
	}
}

func TestCreatePermitMessage(t *testing.T) {
	auth := PermitAuthorization{
		Owner:    "0xowner",
		Spender:  "0xspender",
		Value:    "1000000",
		Deadline: "1740675689",
		Nonce:    5,
	}

	message := CreatePermitMessage(auth)

	if message["owner"] != "0xowner" {
		t.Errorf("expected owner '0xowner', got '%v'", message["owner"])
	}
	if message["spender"] != "0xspender" {
		t.Errorf("expected spender '0xspender', got '%v'", message["spender"])
	}

	value, ok := message["value"].(*big.Int)
	if !ok {
		t.Fatal("expected value to be *big.Int")
	}
	if value.Cmp(big.NewInt(1000000)) != 0 {
		t.Errorf("expected value 1000000, got %s", value.String())
	}

	nonce, ok := message["nonce"].(*big.Int)
	if !ok {
		t.Fatal("expected nonce to be *big.Int")
	}
	if nonce.Cmp(big.NewInt(5)) != 0 {
		t.Errorf("expected nonce 5, got %s", nonce.String())
	}
}

func TestNewHelpers(t *testing.T) {
	t.Run("NewPermitSignature", func(t *testing.T) {
		sig := NewPermitSignature(27, "0xr", "0xs")
		if sig.V != 27 || sig.R != "0xr" || sig.S != "0xs" {
			t.Error("NewPermitSignature did not set values correctly")
		}
	})

	t.Run("NewPermitAuthorization", func(t *testing.T) {
		auth := NewPermitAuthorization("0xowner", "0xspender", "1000", "99999", 5)
		if auth.Owner != "0xowner" || auth.Spender != "0xspender" || auth.Value != "1000" ||
			auth.Deadline != "99999" || auth.Nonce != 5 {
			t.Error("NewPermitAuthorization did not set values correctly")
		}
	})

	t.Run("NewEIP2612Payload", func(t *testing.T) {
		sig := NewPermitSignature(28, "0xr", "0xs")
		auth := NewPermitAuthorization("0xowner", "0xspender", "1000", "99999", 0)
		payload := NewEIP2612Payload(sig, auth, "0xnonce")

		if payload.Signature.V != 28 {
			t.Errorf("expected V 28, got %d", payload.Signature.V)
		}
		if payload.Authorization.Owner != "0xowner" {
			t.Errorf("expected owner '0xowner', got '%s'", payload.Authorization.Owner)
		}
		if payload.PaymentNonce != "0xnonce" {
			t.Errorf("expected paymentNonce '0xnonce', got '%s'", payload.PaymentNonce)
		}
	})
}
