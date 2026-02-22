package erc8004

import (
	"encoding/json"
	"math/big"
	"testing"
)

func TestParseAgentRegistry(t *testing.T) {
	t.Run("should parse valid registry ID", func(t *testing.T) {
		reg, err := ParseAgentRegistry("eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD51")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if reg.Namespace != "eip155" {
			t.Errorf("expected namespace eip155, got %s", reg.Namespace)
		}
		if reg.ChainID != "8453" {
			t.Errorf("expected chainId 8453, got %s", reg.ChainID)
		}
		if reg.Address != "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD51" {
			t.Errorf("unexpected address: %s", reg.Address)
		}
		if reg.ID != "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD51" {
			t.Errorf("unexpected ID: %s", reg.ID)
		}
	})

	t.Run("should reject registry ID with fewer than 3 parts", func(t *testing.T) {
		_, err := ParseAgentRegistry("eip155:8453")
		if err == nil {
			t.Error("expected error for missing address part")
		}
	})

	t.Run("should reject registry ID with empty parts", func(t *testing.T) {
		_, err := ParseAgentRegistry("eip155::0x123")
		if err == nil {
			t.Error("expected error for empty chainId")
		}

		_, err = ParseAgentRegistry(":8453:0x123")
		if err == nil {
			t.Error("expected error for empty namespace")
		}
	})

	t.Run("should handle address containing colons", func(t *testing.T) {
		reg, err := ParseAgentRegistry("solana:mainnet:SomeAddress")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if reg.Namespace != "solana" {
			t.Errorf("expected namespace solana, got %s", reg.Namespace)
		}
		if reg.ChainID != "mainnet" {
			t.Errorf("expected chainId mainnet, got %s", reg.ChainID)
		}
		if reg.Address != "SomeAddress" {
			t.Errorf("unexpected address: %s", reg.Address)
		}
	})
}

func TestDeclareExtension(t *testing.T) {
	t.Run("should create extension without wallet", func(t *testing.T) {
		ext := DeclareExtension(42, "eip155:8453:0xABC")
		if ext.AgentID != 42 {
			t.Errorf("expected agentId 42, got %d", ext.AgentID)
		}
		if ext.AgentRegistry != "eip155:8453:0xABC" {
			t.Errorf("unexpected agentRegistry: %s", ext.AgentRegistry)
		}
		if ext.AgentWallet != "" {
			t.Errorf("expected empty agentWallet, got %s", ext.AgentWallet)
		}
	})

	t.Run("should create extension with wallet", func(t *testing.T) {
		ext := DeclareExtension(42, "eip155:8453:0xABC", "0xWALLET")
		if ext.AgentWallet != "0xWALLET" {
			t.Errorf("expected agentWallet 0xWALLET, got %s", ext.AgentWallet)
		}
	})

	t.Run("should serialize to JSON correctly", func(t *testing.T) {
		ext := DeclareExtension(42, "eip155:8453:0xABC", "0xWALLET")
		data, err := json.Marshal(ext)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded map[string]interface{}
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if int(decoded["agentId"].(float64)) != 42 {
			t.Errorf("unexpected agentId in JSON: %v", decoded["agentId"])
		}
		if decoded["agentRegistry"] != "eip155:8453:0xABC" {
			t.Errorf("unexpected agentRegistry in JSON: %v", decoded["agentRegistry"])
		}
	})
}

func TestParseExtension(t *testing.T) {
	t.Run("should parse valid extension", func(t *testing.T) {
		extensions := map[string]interface{}{
			ExtensionKey: map[string]interface{}{
				"agentId":       42,
				"agentRegistry": "eip155:8453:0xABC",
				"agentWallet":   "0xWALLET",
			},
		}

		ext, err := ParseExtension(extensions)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ext.AgentID != 42 {
			t.Errorf("expected agentId 42, got %d", ext.AgentID)
		}
		if ext.AgentRegistry != "eip155:8453:0xABC" {
			t.Errorf("unexpected agentRegistry: %s", ext.AgentRegistry)
		}
		if ext.AgentWallet != "0xWALLET" {
			t.Errorf("unexpected agentWallet: %s", ext.AgentWallet)
		}
	})

	t.Run("should parse extension with optional fields", func(t *testing.T) {
		score := 85
		count := 10
		extensions := map[string]interface{}{
			ExtensionKey: map[string]interface{}{
				"agentId":         42,
				"agentRegistry":   "eip155:8453:0xABC",
				"reputationScore": score,
				"feedbackCount":   count,
			},
		}

		ext, err := ParseExtension(extensions)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if ext.ReputationScore == nil || *ext.ReputationScore != 85 {
			t.Errorf("expected reputationScore 85, got %v", ext.ReputationScore)
		}
		if ext.FeedbackCount == nil || *ext.FeedbackCount != 10 {
			t.Errorf("expected feedbackCount 10, got %v", ext.FeedbackCount)
		}
	})

	t.Run("should return error when extension missing", func(t *testing.T) {
		_, err := ParseExtension(map[string]interface{}{})
		if err == nil {
			t.Error("expected error for missing extension")
		}
	})

	t.Run("should return error for invalid extension data", func(t *testing.T) {
		extensions := map[string]interface{}{
			ExtensionKey: map[string]interface{}{
				"agentId": 42,
				// missing agentRegistry
			},
		}

		_, err := ParseExtension(extensions)
		if err == nil {
			t.Error("expected error for missing agentRegistry")
		}
	})
}

func TestParsePayloadExtension(t *testing.T) {
	t.Run("should parse valid payload extension", func(t *testing.T) {
		extensions := map[string]interface{}{
			ExtensionKey: map[string]interface{}{
				"identityVerified": true,
				"agentId":          42,
				"agentRegistry":    "eip155:8453:0xABC",
			},
		}

		ext, err := ParsePayloadExtension(extensions)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !ext.IdentityVerified {
			t.Error("expected identityVerified to be true")
		}
		if ext.AgentID != 42 {
			t.Errorf("expected agentId 42, got %d", ext.AgentID)
		}
	})

	t.Run("should return error when extension missing", func(t *testing.T) {
		_, err := ParsePayloadExtension(map[string]interface{}{})
		if err == nil {
			t.Error("expected error for missing extension")
		}
	})
}

func TestCreatePayloadExtension(t *testing.T) {
	ext := CreatePayloadExtension(42, "eip155:8453:0xABC", true)
	if !ext.IdentityVerified {
		t.Error("expected identityVerified to be true")
	}
	if ext.AgentID != 42 {
		t.Errorf("expected agentId 42, got %d", ext.AgentID)
	}
	if ext.AgentRegistry != "eip155:8453:0xABC" {
		t.Errorf("unexpected agentRegistry: %s", ext.AgentRegistry)
	}
}

func TestNormalizeReputationScore(t *testing.T) {
	t.Run("should return 0 for zero count", func(t *testing.T) {
		score := NormalizeReputationScore(big.NewInt(85), 0, 0)
		if score != 0 {
			t.Errorf("expected 0, got %d", score)
		}
	})

	t.Run("should normalize score with no decimals", func(t *testing.T) {
		score := NormalizeReputationScore(big.NewInt(85), 0, 10)
		if score != 85 {
			t.Errorf("expected 85, got %d", score)
		}
	})

	t.Run("should normalize score with decimals", func(t *testing.T) {
		score := NormalizeReputationScore(big.NewInt(8500), 2, 10)
		if score != 85 {
			t.Errorf("expected 85, got %d", score)
		}
	})

	t.Run("should clamp to 100", func(t *testing.T) {
		score := NormalizeReputationScore(big.NewInt(150), 0, 5)
		if score != 100 {
			t.Errorf("expected 100, got %d", score)
		}
	})

	t.Run("should clamp to 0 for negative", func(t *testing.T) {
		score := NormalizeReputationScore(big.NewInt(-10), 0, 5)
		if score != 0 {
			t.Errorf("expected 0, got %d", score)
		}
	})
}

func TestBuildFeedbackFile(t *testing.T) {
	t.Run("should build feedback file without proof", func(t *testing.T) {
		f := BuildFeedbackFile(42, "eip155:8453:0xABC", "0xCLIENT", 100, 0, "paymentSuccess", "", nil)
		if f.AgentID != 42 {
			t.Errorf("expected agentId 42, got %d", f.AgentID)
		}
		if f.AgentRegistry != "eip155:8453:0xABC" {
			t.Errorf("unexpected agentRegistry: %s", f.AgentRegistry)
		}
		if f.ClientAddress != "0xCLIENT" {
			t.Errorf("unexpected clientAddress: %s", f.ClientAddress)
		}
		if f.Value != 100 {
			t.Errorf("expected value 100, got %d", f.Value)
		}
		if f.Tag1 != "paymentSuccess" {
			t.Errorf("unexpected tag1: %s", f.Tag1)
		}
		if f.ProofOfPayment != nil {
			t.Error("expected nil proofOfPayment")
		}
		if f.CreatedAt == "" {
			t.Error("expected non-empty createdAt")
		}
	})

	t.Run("should build feedback file with proof", func(t *testing.T) {
		proof := &ProofOfPayment{
			FromAddress: "0xFROM",
			ToAddress:   "0xTO",
			ChainID:     "eip155:8453",
			TxHash:      "0xTXHASH",
		}
		f := BuildFeedbackFile(42, "eip155:8453:0xABC", "0xCLIENT", 100, 0, "paymentSuccess", "", proof)
		if f.ProofOfPayment == nil {
			t.Fatal("expected non-nil proofOfPayment")
		}
		if f.ProofOfPayment.TxHash != "0xTXHASH" {
			t.Errorf("unexpected txHash: %s", f.ProofOfPayment.TxHash)
		}
	})

	t.Run("should serialize to JSON", func(t *testing.T) {
		f := BuildFeedbackFile(42, "eip155:8453:0xABC", "0xCLIENT", 100, 0, "paymentSuccess", "", nil)
		data, err := json.Marshal(f)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded map[string]interface{}
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if int(decoded["agentId"].(float64)) != 42 {
			t.Errorf("unexpected agentId in JSON: %v", decoded["agentId"])
		}
	})
}

func TestRegistryAddressFromID(t *testing.T) {
	t.Run("should extract address", func(t *testing.T) {
		addr, err := RegistryAddressFromID("eip155:8453:0xABC")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if addr != "0xABC" {
			t.Errorf("expected 0xABC, got %s", addr)
		}
	})

	t.Run("should return error for invalid ID", func(t *testing.T) {
		_, err := RegistryAddressFromID("invalid")
		if err == nil {
			t.Error("expected error for invalid ID")
		}
	})

	t.Run("should return error for empty address", func(t *testing.T) {
		_, err := RegistryAddressFromID("eip155:8453:")
		if err == nil {
			t.Error("expected error for empty address")
		}
	})
}

func TestVerifyPayToMatchesExtension(t *testing.T) {
	t.Run("should match case-insensitively", func(t *testing.T) {
		ext := &ERC8004Extension{AgentWallet: "0xAbCdEf"}
		if !VerifyPayToMatchesExtension(ext, "0xabcdef") {
			t.Error("expected match")
		}
	})

	t.Run("should not match different addresses", func(t *testing.T) {
		ext := &ERC8004Extension{AgentWallet: "0xABC"}
		if VerifyPayToMatchesExtension(ext, "0xDEF") {
			t.Error("expected no match")
		}
	})

	t.Run("should return false for empty wallet", func(t *testing.T) {
		ext := &ERC8004Extension{}
		if VerifyPayToMatchesExtension(ext, "0xABC") {
			t.Error("expected false for empty wallet")
		}
	})

	t.Run("should return false for empty payTo", func(t *testing.T) {
		ext := &ERC8004Extension{AgentWallet: "0xABC"}
		if VerifyPayToMatchesExtension(ext, "") {
			t.Error("expected false for empty payTo")
		}
	})
}

func TestExtensionJSONRoundTrip(t *testing.T) {
	t.Run("ERC8004Extension round-trips through JSON", func(t *testing.T) {
		score := 85
		count := 10
		original := ERC8004Extension{
			AgentID:         42,
			AgentRegistry:   "eip155:8453:0xABC",
			AgentWallet:     "0xWALLET",
			ReputationScore: &score,
			FeedbackCount:   &count,
		}

		data, err := json.Marshal(original)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded ERC8004Extension
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded.AgentID != original.AgentID {
			t.Errorf("agentId mismatch: %d vs %d", decoded.AgentID, original.AgentID)
		}
		if decoded.AgentRegistry != original.AgentRegistry {
			t.Errorf("agentRegistry mismatch: %s vs %s", decoded.AgentRegistry, original.AgentRegistry)
		}
		if decoded.AgentWallet != original.AgentWallet {
			t.Errorf("agentWallet mismatch: %s vs %s", decoded.AgentWallet, original.AgentWallet)
		}
		if decoded.ReputationScore == nil || *decoded.ReputationScore != 85 {
			t.Errorf("reputationScore mismatch: %v", decoded.ReputationScore)
		}
		if decoded.FeedbackCount == nil || *decoded.FeedbackCount != 10 {
			t.Errorf("feedbackCount mismatch: %v", decoded.FeedbackCount)
		}
	})

	t.Run("ERC8004PayloadExtension round-trips through JSON", func(t *testing.T) {
		original := ERC8004PayloadExtension{
			IdentityVerified: true,
			AgentID:          42,
			AgentRegistry:    "eip155:8453:0xABC",
		}

		data, err := json.Marshal(original)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded ERC8004PayloadExtension
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded.IdentityVerified != original.IdentityVerified {
			t.Errorf("identityVerified mismatch")
		}
		if decoded.AgentID != original.AgentID {
			t.Errorf("agentId mismatch")
		}
		if decoded.AgentRegistry != original.AgentRegistry {
			t.Errorf("agentRegistry mismatch")
		}
	})
}

func TestExtensionSchema(t *testing.T) {
	schema := ExtensionSchema()
	if schema == nil {
		t.Fatal("expected non-nil schema")
	}
	if schema["type"] != "object" {
		t.Errorf("expected type object, got %v", schema["type"])
	}

	required, ok := schema["required"].([]string)
	if !ok {
		t.Fatal("expected required to be []string")
	}
	if len(required) != 2 || required[0] != "agentId" || required[1] != "agentRegistry" {
		t.Errorf("unexpected required fields: %v", required)
	}
}

func TestPayloadExtensionSchema(t *testing.T) {
	schema := PayloadExtensionSchema()
	if schema == nil {
		t.Fatal("expected non-nil schema")
	}
	if schema["type"] != "object" {
		t.Errorf("expected type object, got %v", schema["type"])
	}

	required, ok := schema["required"].([]string)
	if !ok {
		t.Fatal("expected required to be []string")
	}
	if len(required) != 3 {
		t.Errorf("expected 3 required fields, got %d", len(required))
	}
}

func TestConstants(t *testing.T) {
	if ExtensionKey != "erc8004" {
		t.Errorf("unexpected ExtensionKey: %s", ExtensionKey)
	}
	if FeedbackTagPaymentSuccess != "paymentSuccess" {
		t.Errorf("unexpected FeedbackTagPaymentSuccess: %s", FeedbackTagPaymentSuccess)
	}
	if FeedbackTagPaymentFailed != "paymentFailed" {
		t.Errorf("unexpected FeedbackTagPaymentFailed: %s", FeedbackTagPaymentFailed)
	}
	if FeedbackTagServiceQuality != "starred" {
		t.Errorf("unexpected FeedbackTagServiceQuality: %s", FeedbackTagServiceQuality)
	}
	if FeedbackTagResponseTime != "responseTime" {
		t.Errorf("unexpected FeedbackTagResponseTime: %s", FeedbackTagResponseTime)
	}
	if FeedbackTagUptime != "uptime" {
		t.Errorf("unexpected FeedbackTagUptime: %s", FeedbackTagUptime)
	}
}

func TestIdentityRegistryDomain(t *testing.T) {
	if IdentityRegistryDomain["name"] != "IdentityRegistry" {
		t.Errorf("unexpected domain name: %s", IdentityRegistryDomain["name"])
	}
	if IdentityRegistryDomain["version"] != "1" {
		t.Errorf("unexpected domain version: %s", IdentityRegistryDomain["version"])
	}
}

func TestTypesJSON(t *testing.T) {
	t.Run("AgentIdentity serializes correctly", func(t *testing.T) {
		identity := AgentIdentity{
			AgentID:     big.NewInt(42),
			Owner:       "0xOWNER",
			AgentURI:    "https://example.com/agent.json",
			AgentWallet: "0xWALLET",
			Registry: AgentRegistry{
				Namespace: "eip155",
				ChainID:   "8453",
				Address:   "0xREGISTRY",
				ID:        "eip155:8453:0xREGISTRY",
			},
		}

		data, err := json.Marshal(identity)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded map[string]interface{}
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded["owner"] != "0xOWNER" {
			t.Errorf("unexpected owner: %v", decoded["owner"])
		}
		if decoded["agentURI"] != "https://example.com/agent.json" {
			t.Errorf("unexpected agentURI: %v", decoded["agentURI"])
		}
	})

	t.Run("RegistrationFile serializes correctly", func(t *testing.T) {
		reg := RegistrationFile{
			Type:        "AgentRegistration",
			Name:        "TestAgent",
			X402Support: true,
			Active:      true,
			Services: []ServiceEntry{
				{Name: "api", Endpoint: "https://api.example.com"},
			},
			Registrations: []RegistrationEntry{
				{AgentID: 42, AgentRegistry: "eip155:8453:0xABC"},
			},
		}

		data, err := json.Marshal(reg)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded RegistrationFile
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded.Name != "TestAgent" {
			t.Errorf("unexpected name: %s", decoded.Name)
		}
		if !decoded.X402Support {
			t.Error("expected x402Support to be true")
		}
		if len(decoded.Services) != 1 || decoded.Services[0].Name != "api" {
			t.Errorf("unexpected services: %v", decoded.Services)
		}
	})

	t.Run("ValidationStatus serializes correctly", func(t *testing.T) {
		vs := ValidationStatus{
			ValidatorAddress: "0xVALIDATOR",
			AgentID:          big.NewInt(42),
			Response:         85,
			ResponseHash:     "0xHASH",
			Tag:              "quality",
			LastUpdate:       big.NewInt(1700000000),
		}

		data, err := json.Marshal(vs)
		if err != nil {
			t.Fatalf("marshal error: %v", err)
		}

		var decoded map[string]interface{}
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("unmarshal error: %v", err)
		}

		if decoded["validatorAddress"] != "0xVALIDATOR" {
			t.Errorf("unexpected validatorAddress: %v", decoded["validatorAddress"])
		}
		if int(decoded["response"].(float64)) != 85 {
			t.Errorf("unexpected response: %v", decoded["response"])
		}
	})
}
