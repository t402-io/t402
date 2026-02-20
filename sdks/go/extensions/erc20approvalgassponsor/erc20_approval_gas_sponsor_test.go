package erc20approvalgassponsor

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestDeclareERC20ApprovalGasSponsorExtension(t *testing.T) {
	t.Run("should create extension with correct fields", func(t *testing.T) {
		ext := DeclareERC20ApprovalGasSponsorExtension(
			[]string{"eip155:8453", "eip155:42161"},
			"1000000000",
			"0xFacilitator0000000000000000000000000000",
		)

		if len(ext.Info.SponsoredNetworks) != 2 {
			t.Errorf("expected 2 networks, got %d", len(ext.Info.SponsoredNetworks))
		}
		if ext.Info.SponsoredNetworks[0] != "eip155:8453" {
			t.Errorf("expected first network eip155:8453, got %s", ext.Info.SponsoredNetworks[0])
		}
		if ext.Info.MaxAmount != "1000000000" {
			t.Errorf("expected maxAmount 1000000000, got %s", ext.Info.MaxAmount)
		}
		if ext.Info.SponsorAddress != "0xFacilitator0000000000000000000000000000" {
			t.Errorf("expected sponsor address, got %s", ext.Info.SponsorAddress)
		}
		if ext.Schema == nil {
			t.Error("expected schema to be non-nil")
		}
	})

	t.Run("should default requiresAtomicBatch to false", func(t *testing.T) {
		ext := DeclareERC20ApprovalGasSponsorExtension(
			[]string{"eip155:8453"},
			"1000000000",
			"0xSponsor0000000000000000000000000000000000",
		)

		if ext.Info.RequiresAtomicBatch != false {
			t.Errorf("expected requiresAtomicBatch false, got %v", ext.Info.RequiresAtomicBatch)
		}
	})

	t.Run("should apply WithAtomicBatch option", func(t *testing.T) {
		ext := DeclareERC20ApprovalGasSponsorExtension(
			[]string{"eip155:8453"},
			"1000000000",
			"0xSponsor0000000000000000000000000000000000",
			WithAtomicBatch(true),
		)

		if ext.Info.RequiresAtomicBatch != true {
			t.Errorf("expected requiresAtomicBatch true, got %v", ext.Info.RequiresAtomicBatch)
		}
	})

	t.Run("should apply WithPermit2Address option", func(t *testing.T) {
		ext := DeclareERC20ApprovalGasSponsorExtension(
			[]string{"eip155:8453"},
			"1000000000",
			"0xSponsor0000000000000000000000000000000000",
			WithPermit2Address("0xPermit20000000000000000000000000000000000"),
		)

		if ext.Info.Permit2Address != "0xPermit20000000000000000000000000000000000" {
			t.Errorf("expected permit2Address, got %s", ext.Info.Permit2Address)
		}
	})
}

func TestParseERC20ApprovalGasSponsorPayload(t *testing.T) {
	t.Run("should parse valid payload", func(t *testing.T) {
		extensions := map[string]interface{}{
			ExtensionKey: map[string]interface{}{
				"network":          "eip155:8453",
				"from":             "0x1234567890123456789012345678901234567890",
				"asset":            "0xUSDT567890123456789012345678901234567890",
				"amount":           "1000000",
				"signedApprovalTx": "0x" + strings.Repeat("ab", 100),
				"chainId":          float64(8453),
			},
		}

		payload, err := ParseERC20ApprovalGasSponsorPayload(extensions)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if payload.Network != "eip155:8453" {
			t.Errorf("expected network eip155:8453, got %s", payload.Network)
		}
		if payload.From != "0x1234567890123456789012345678901234567890" {
			t.Errorf("unexpected from: %s", payload.From)
		}
		if payload.Amount != "1000000" {
			t.Errorf("expected amount 1000000, got %s", payload.Amount)
		}
		if payload.ChainID != 8453 {
			t.Errorf("expected chainId 8453, got %d", payload.ChainID)
		}
	})

	t.Run("should return error when extension missing", func(t *testing.T) {
		_, err := ParseERC20ApprovalGasSponsorPayload(map[string]interface{}{})
		if err == nil {
			t.Error("expected error for missing extension")
		}
	})

	t.Run("should return error for missing required fields", func(t *testing.T) {
		extensions := map[string]interface{}{
			ExtensionKey: map[string]interface{}{
				"amount": "1000000",
			},
		}

		_, err := ParseERC20ApprovalGasSponsorPayload(extensions)
		if err == nil {
			t.Error("expected error for missing required fields")
		}
	})
}

func TestValidateERC20ApprovalGasSponsorPayload(t *testing.T) {
	info := &ERC20ApprovalGasSponsorExtensionInfo{
		SponsoredNetworks:  []string{"eip155:8453", "eip155:42161"},
		MaxAmount:          "1000000000",
		SponsorAddress:     "0xFacilitator0000000000000000000000000000",
		RequiresAtomicBatch: true,
	}

	validPayload := &ERC20ApprovalGasSponsorPayload{
		Network:          "eip155:8453",
		From:             "0x1234567890123456789012345678901234567890",
		Asset:            "0xabcd567890123456789012345678901234567890",
		Amount:           "1000000",
		SignedApprovalTx: "0x" + strings.Repeat("ab", 100),
		ChainID:          8453,
	}

	t.Run("should validate correct payload", func(t *testing.T) {
		err := ValidateERC20ApprovalGasSponsorPayload(validPayload, info)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("should reject unsupported network", func(t *testing.T) {
		p := *validPayload
		p.Network = "eip155:1"
		err := ValidateERC20ApprovalGasSponsorPayload(&p, info)
		if err == nil || !strings.Contains(err.Error(), "not in sponsored networks") {
			t.Errorf("expected network error, got: %v", err)
		}
	})

	t.Run("should reject amount exceeding maxAmount", func(t *testing.T) {
		p := *validPayload
		p.Amount = "2000000000"
		err := ValidateERC20ApprovalGasSponsorPayload(&p, info)
		if err == nil || !strings.Contains(err.Error(), "exceeds maximum amount") {
			t.Errorf("expected amount error, got: %v", err)
		}
	})

	t.Run("should reject empty signedApprovalTx", func(t *testing.T) {
		p := *validPayload
		p.SignedApprovalTx = "0x"
		err := ValidateERC20ApprovalGasSponsorPayload(&p, info)
		if err == nil || !strings.Contains(err.Error(), "empty") {
			t.Errorf("expected empty tx error, got: %v", err)
		}
	})

	t.Run("should reject non-hex signedApprovalTx", func(t *testing.T) {
		p := *validPayload
		p.SignedApprovalTx = "0xnothex"
		err := ValidateERC20ApprovalGasSponsorPayload(&p, info)
		if err == nil || !strings.Contains(err.Error(), "not valid hex") {
			t.Errorf("expected hex error, got: %v", err)
		}
	})

	t.Run("should reject invalid from address", func(t *testing.T) {
		p := *validPayload
		p.From = "0x1234"
		err := ValidateERC20ApprovalGasSponsorPayload(&p, info)
		if err == nil || !strings.Contains(err.Error(), "invalid from address") {
			t.Errorf("expected from address error, got: %v", err)
		}
	})

	t.Run("should reject invalid asset address", func(t *testing.T) {
		p := *validPayload
		p.Asset = "0xshort"
		err := ValidateERC20ApprovalGasSponsorPayload(&p, info)
		if err == nil || !strings.Contains(err.Error(), "invalid asset address") {
			t.Errorf("expected asset address error, got: %v", err)
		}
	})

	t.Run("should validate payload with chain ID check", func(t *testing.T) {
		err := ValidateERC20ApprovalGasSponsorPayloadWithChainID(validPayload, info, 8453)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("should reject mismatched chain ID", func(t *testing.T) {
		err := ValidateERC20ApprovalGasSponsorPayloadWithChainID(validPayload, info, 1)
		if err == nil || !strings.Contains(err.Error(), "does not match expected chain ID") {
			t.Errorf("expected chain ID error, got: %v", err)
		}
	})
}

func TestEncodeApproveCalldata(t *testing.T) {
	t.Run("should encode approve calldata with correct selector", func(t *testing.T) {
		calldata := EncodeApproveCalldata("0x1234567890123456789012345678901234567890", "1000000")
		if !strings.HasPrefix(calldata, ApproveFunctionSelector) {
			t.Errorf("expected selector prefix %s, got %s", ApproveFunctionSelector, calldata[:10])
		}
	})

	t.Run("should produce correct length calldata", func(t *testing.T) {
		calldata := EncodeApproveCalldata("0x1234567890123456789012345678901234567890", "1000000")
		// 0x095ea7b3 (10 chars) + 64 chars spender + 64 chars amount = 138 chars
		if len(calldata) != 10+64+64 {
			t.Errorf("expected calldata length %d, got %d", 10+64+64, len(calldata))
		}
	})
}

func TestDecodeApproveCalldata(t *testing.T) {
	t.Run("should decode valid approve calldata", func(t *testing.T) {
		encoded := EncodeApproveCalldata("0x1234567890123456789012345678901234567890", "1000000")
		spender, amount, ok := DecodeApproveCalldata(encoded)
		if !ok {
			t.Fatal("expected decode to succeed")
		}
		if spender != "0x1234567890123456789012345678901234567890" {
			t.Errorf("expected spender, got %s", spender)
		}
		if amount != "1000000" {
			t.Errorf("expected amount 1000000, got %s", amount)
		}
	})

	t.Run("should return false for non-approve selector", func(t *testing.T) {
		calldata := "0xdeadbeef" + strings.Repeat("00", 64)
		_, _, ok := DecodeApproveCalldata(calldata)
		if ok {
			t.Error("expected decode to fail for wrong selector")
		}
	})

	t.Run("should return false for calldata too short", func(t *testing.T) {
		_, _, ok := DecodeApproveCalldata("0x095ea7b3")
		if ok {
			t.Error("expected decode to fail for short calldata")
		}
	})

	t.Run("should handle calldata without 0x prefix", func(t *testing.T) {
		encoded := EncodeApproveCalldata("0x1234567890123456789012345678901234567890", "500000")
		// Remove the 0x prefix
		noPrefix := strings.TrimPrefix(encoded, "0x")
		spender, amount, ok := DecodeApproveCalldata(noPrefix)
		if !ok {
			t.Fatal("expected decode to succeed without prefix")
		}
		if spender != "0x1234567890123456789012345678901234567890" {
			t.Errorf("expected spender, got %s", spender)
		}
		if amount != "500000" {
			t.Errorf("expected amount 500000, got %s", amount)
		}
	})
}

func TestERC20ApprovalGasSponsorExtensionJSON(t *testing.T) {
	ext := ERC20ApprovalGasSponsorExtension{
		Info: ERC20ApprovalGasSponsorExtensionInfo{
			SponsoredNetworks:  []string{"eip155:8453"},
			MaxAmount:          "1000000000",
			SponsorAddress:     "0xSponsor",
			RequiresAtomicBatch: true,
		},
		Schema: map[string]interface{}{"type": "object"},
	}

	data, err := json.Marshal(ext)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded ERC20ApprovalGasSponsorExtension
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if len(decoded.Info.SponsoredNetworks) != 1 {
		t.Errorf("expected 1 network, got %d", len(decoded.Info.SponsoredNetworks))
	}
	if decoded.Info.MaxAmount != "1000000000" {
		t.Errorf("expected maxAmount 1000000000, got %s", decoded.Info.MaxAmount)
	}
	if decoded.Info.RequiresAtomicBatch != true {
		t.Errorf("expected requiresAtomicBatch true, got %v", decoded.Info.RequiresAtomicBatch)
	}
	if decoded.Info.SponsorAddress != "0xSponsor" {
		t.Errorf("expected sponsor address 0xSponsor, got %s", decoded.Info.SponsorAddress)
	}
}
