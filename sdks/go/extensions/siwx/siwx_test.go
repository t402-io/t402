package siwx

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestDeclareSIWxExtension(t *testing.T) {
	t.Run("should create extension with correct domain", func(t *testing.T) {
		ext, err := DeclareSIWxExtension("https://api.example.com/premium", "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if ext.Info.Domain != "api.example.com" {
			t.Errorf("expected domain api.example.com, got %s", ext.Info.Domain)
		}
		if ext.Info.URI != "https://api.example.com/premium" {
			t.Errorf("expected URI https://api.example.com/premium, got %s", ext.Info.URI)
		}
		if ext.Info.ChainID != "eip155:8453" {
			t.Errorf("expected chainId eip155:8453, got %s", ext.Info.ChainID)
		}
		if ext.Info.Version != "1" {
			t.Errorf("expected version 1, got %s", ext.Info.Version)
		}
		if len(ext.Info.Nonce) != 32 {
			t.Errorf("expected nonce length 32, got %d", len(ext.Info.Nonce))
		}
		if len(ext.Info.Resources) != 1 || ext.Info.Resources[0] != "https://api.example.com/premium" {
			t.Errorf("unexpected resources: %v", ext.Info.Resources)
		}
		if ext.Schema == nil {
			t.Error("expected schema to be non-nil")
		}
	})

	t.Run("should apply options", func(t *testing.T) {
		exp := time.Now().Add(10 * time.Minute)
		ext, err := DeclareSIWxExtension(
			"https://api.example.com/resource",
			"solana:mainnet",
			WithStatement("Sign in to access"),
			WithExpirationTime(exp),
			WithSignatureScheme("siws"),
			WithVersion("2"),
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if ext.Info.Statement != "Sign in to access" {
			t.Errorf("expected statement 'Sign in to access', got %s", ext.Info.Statement)
		}
		if ext.Info.SignatureScheme != "siws" {
			t.Errorf("expected scheme siws, got %s", ext.Info.SignatureScheme)
		}
		if ext.Info.Version != "2" {
			t.Errorf("expected version 2, got %s", ext.Info.Version)
		}
	})

	t.Run("should return error for invalid URI", func(t *testing.T) {
		_, err := DeclareSIWxExtension("not-a-url", "eip155:1")
		if err == nil {
			t.Error("expected error for invalid URI")
		}
	})
}

func TestParseSIWxPayload(t *testing.T) {
	t.Run("should parse valid payload", func(t *testing.T) {
		extensions := map[string]interface{}{
			ExtensionKey: map[string]interface{}{
				"domain":    "api.example.com",
				"address":   "0x1234567890123456789012345678901234567890",
				"uri":       "https://api.example.com/resource",
				"version":   "1",
				"chainId":   "eip155:8453",
				"nonce":     "abc123",
				"issuedAt":  "2025-01-01T00:00:00.000Z",
				"signature": "0xsig",
			},
		}

		payload, err := ParseSIWxPayload(extensions)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if payload.Domain != "api.example.com" {
			t.Errorf("expected domain api.example.com, got %s", payload.Domain)
		}
		if payload.Address != "0x1234567890123456789012345678901234567890" {
			t.Errorf("unexpected address: %s", payload.Address)
		}
	})

	t.Run("should return error when extension missing", func(t *testing.T) {
		_, err := ParseSIWxPayload(map[string]interface{}{})
		if err == nil {
			t.Error("expected error for missing extension")
		}
	})
}

func TestValidateSIWxMessage(t *testing.T) {
	t.Run("should validate correct message", func(t *testing.T) {
		payload := &SIWxPayload{
			Domain:   "api.example.com",
			Address:  "0x1234",
			URI:      "https://api.example.com/resource",
			Version:  "1",
			ChainID:  "eip155:8453",
			Nonce:    "abc123",
			IssuedAt: time.Now().UTC().Format(time.RFC3339Nano),
		}

		err := ValidateSIWxMessage(payload, "https://api.example.com/resource", 5*time.Minute)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("should reject domain mismatch", func(t *testing.T) {
		payload := &SIWxPayload{
			Domain:   "other.example.com",
			URI:      "https://other.example.com/resource",
			Version:  "1",
			IssuedAt: time.Now().UTC().Format(time.RFC3339Nano),
		}

		err := ValidateSIWxMessage(payload, "https://api.example.com/resource", 5*time.Minute)
		if err == nil || !strings.Contains(err.Error(), "domain mismatch") {
			t.Errorf("expected domain mismatch error, got: %v", err)
		}
	})

	t.Run("should reject expired message", func(t *testing.T) {
		old := time.Now().Add(-10 * time.Minute).UTC().Format(time.RFC3339Nano)
		payload := &SIWxPayload{
			Domain:   "api.example.com",
			URI:      "https://api.example.com/resource",
			Version:  "1",
			IssuedAt: old,
		}

		err := ValidateSIWxMessage(payload, "https://api.example.com/resource", 5*time.Minute)
		if err == nil || !strings.Contains(err.Error(), "expired") {
			t.Errorf("expected expired error, got: %v", err)
		}
	})

	t.Run("should reject unsupported version", func(t *testing.T) {
		payload := &SIWxPayload{
			Domain:   "api.example.com",
			URI:      "https://api.example.com/resource",
			Version:  "99",
			IssuedAt: time.Now().UTC().Format(time.RFC3339Nano),
		}

		err := ValidateSIWxMessage(payload, "https://api.example.com/resource", 5*time.Minute)
		if err == nil || !strings.Contains(err.Error(), "unsupported version") {
			t.Errorf("expected version error, got: %v", err)
		}
	})
}

func TestConstructMessage(t *testing.T) {
	payload := &SIWxPayload{
		Domain:    "api.example.com",
		Address:   "0x1234567890123456789012345678901234567890",
		Statement: "Sign in to access premium content",
		URI:       "https://api.example.com/resource",
		Version:   "1",
		ChainID:   "eip155:8453",
		Nonce:     "abc123",
		IssuedAt:  "2025-01-01T00:00:00.000Z",
		Resources: []string{"https://api.example.com/resource"},
	}

	msg := ConstructMessage(payload)

	if !strings.Contains(msg, "api.example.com wants you to sign in with your eip155:8453 account:") {
		t.Error("missing header line")
	}
	if !strings.Contains(msg, "0x1234567890123456789012345678901234567890") {
		t.Error("missing address")
	}
	if !strings.Contains(msg, "Sign in to access premium content") {
		t.Error("missing statement")
	}
	if !strings.Contains(msg, "URI: https://api.example.com/resource") {
		t.Error("missing URI field")
	}
	if !strings.Contains(msg, "Nonce: abc123") {
		t.Error("missing nonce field")
	}
	if !strings.Contains(msg, "Resources:") {
		t.Error("missing resources section")
	}
}

func TestSIWxExtensionJSON(t *testing.T) {
	ext := SIWxExtension{
		Info: SIWxExtensionInfo{
			Domain:  "example.com",
			URI:     "https://example.com/api",
			Version: "1",
			ChainID: "eip155:1",
			Nonce:   "test-nonce",
		},
		Schema: map[string]interface{}{"type": "object"},
	}

	data, err := json.Marshal(ext)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded SIWxExtension
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if decoded.Info.Domain != "example.com" {
		t.Errorf("expected domain example.com, got %s", decoded.Info.Domain)
	}
	if decoded.Info.ChainID != "eip155:1" {
		t.Errorf("expected chainId eip155:1, got %s", decoded.Info.ChainID)
	}
}
