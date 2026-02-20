package eip2612gassponsor

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestDeclareEip2612GasSponsorExtension(t *testing.T) {
	t.Run("should create extension with correct fields", func(t *testing.T) {
		ext := DeclareEip2612GasSponsorExtension(
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

	t.Run("should default permitDeadline to 300", func(t *testing.T) {
		ext := DeclareEip2612GasSponsorExtension(
			[]string{"eip155:8453"},
			"1000000000",
			"0xSponsor",
		)

		if ext.Info.PermitDeadline != 300 {
			t.Errorf("expected permitDeadline 300, got %d", ext.Info.PermitDeadline)
		}
	})

	t.Run("should apply custom permitDeadline", func(t *testing.T) {
		ext := DeclareEip2612GasSponsorExtension(
			[]string{"eip155:8453"},
			"1000000000",
			"0xSponsor",
			WithPermitDeadline(600),
		)

		if ext.Info.PermitDeadline != 600 {
			t.Errorf("expected permitDeadline 600, got %d", ext.Info.PermitDeadline)
		}
	})
}

func TestParseEip2612GasSponsorPayload(t *testing.T) {
	t.Run("should parse valid payload", func(t *testing.T) {
		extensions := map[string]interface{}{
			ExtensionKey: map[string]interface{}{
				"network":         "eip155:8453",
				"permitSignature": "0x" + strings.Repeat("ab", 65),
				"owner":           "0x1234567890123456789012345678901234567890",
				"spender":         "0xFacilitator0000000000000000000000000000",
				"value":           "1000000",
				"deadline":        float64(1700000000),
				"v":               float64(27),
				"r":               "0x" + strings.Repeat("ab", 32),
				"s":               "0x" + strings.Repeat("cd", 32),
			},
		}

		payload, err := ParseEip2612GasSponsorPayload(extensions)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if payload.Network != "eip155:8453" {
			t.Errorf("expected network eip155:8453, got %s", payload.Network)
		}
		if payload.Owner != "0x1234567890123456789012345678901234567890" {
			t.Errorf("unexpected owner: %s", payload.Owner)
		}
		if payload.Value != "1000000" {
			t.Errorf("expected value 1000000, got %s", payload.Value)
		}
	})

	t.Run("should return error when extension missing", func(t *testing.T) {
		_, err := ParseEip2612GasSponsorPayload(map[string]interface{}{})
		if err == nil {
			t.Error("expected error for missing extension")
		}
	})

	t.Run("should return error for missing required fields", func(t *testing.T) {
		extensions := map[string]interface{}{
			ExtensionKey: map[string]interface{}{
				"value": "1000000",
			},
		}

		_, err := ParseEip2612GasSponsorPayload(extensions)
		if err == nil {
			t.Error("expected error for missing required fields")
		}
	})
}

func TestValidateEip2612GasSponsorPayload(t *testing.T) {
	fixedTime := time.Unix(1700000000, 0)

	info := &Eip2612GasSponsorExtensionInfo{
		SponsoredNetworks: []string{"eip155:8453", "eip155:42161"},
		MaxAmount:         "1000000000",
		PermitDeadline:    300,
		SponsorAddress:    "0xFacilitator0000000000000000000000000000",
	}

	validPayload := &Eip2612GasSponsorPayload{
		Network:         "eip155:8453",
		PermitSignature: "0x" + strings.Repeat("ab", 65),
		Owner:           "0x1234567890123456789012345678901234567890",
		Spender:         "0xFacilitator0000000000000000000000000000",
		Value:           "1000000",
		Deadline:        1700000200,
		V:               27,
		R:               "0x" + strings.Repeat("ab", 32),
		S:               "0x" + strings.Repeat("cd", 32),
	}

	t.Run("should validate correct payload", func(t *testing.T) {
		err := ValidateEip2612GasSponsorPayloadAt(validPayload, info, fixedTime)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("should reject unsupported network", func(t *testing.T) {
		p := *validPayload
		p.Network = "eip155:1"
		err := ValidateEip2612GasSponsorPayloadAt(&p, info, fixedTime)
		if err == nil || !strings.Contains(err.Error(), "not in sponsored networks") {
			t.Errorf("expected network error, got: %v", err)
		}
	})

	t.Run("should reject value exceeding maxAmount", func(t *testing.T) {
		p := *validPayload
		p.Value = "2000000000"
		err := ValidateEip2612GasSponsorPayloadAt(&p, info, fixedTime)
		if err == nil || !strings.Contains(err.Error(), "exceeds maximum amount") {
			t.Errorf("expected amount error, got: %v", err)
		}
	})

	t.Run("should reject expired deadline", func(t *testing.T) {
		p := *validPayload
		p.Deadline = 1699999990
		err := ValidateEip2612GasSponsorPayloadAt(&p, info, fixedTime)
		if err == nil || !strings.Contains(err.Error(), "deadline has expired") {
			t.Errorf("expected deadline error, got: %v", err)
		}
	})

	t.Run("should reject deadline exceeding permitDeadline window", func(t *testing.T) {
		p := *validPayload
		p.Deadline = 1700000600
		err := ValidateEip2612GasSponsorPayloadAt(&p, info, fixedTime)
		if err == nil || !strings.Contains(err.Error(), "exceeds maximum allowed deadline") {
			t.Errorf("expected deadline window error, got: %v", err)
		}
	})

	t.Run("should reject spender mismatch", func(t *testing.T) {
		p := *validPayload
		p.Spender = "0xWrongAddress000000000000000000000000000"
		err := ValidateEip2612GasSponsorPayloadAt(&p, info, fixedTime)
		if err == nil || !strings.Contains(err.Error(), "does not match sponsor address") {
			t.Errorf("expected spender error, got: %v", err)
		}
	})

	t.Run("should reject invalid signature length", func(t *testing.T) {
		p := *validPayload
		p.PermitSignature = "0x1234"
		err := ValidateEip2612GasSponsorPayloadAt(&p, info, fixedTime)
		if err == nil || !strings.Contains(err.Error(), "invalid permit signature length") {
			t.Errorf("expected signature length error, got: %v", err)
		}
	})

	t.Run("should reject invalid v value", func(t *testing.T) {
		p := *validPayload
		p.V = 25
		err := ValidateEip2612GasSponsorPayloadAt(&p, info, fixedTime)
		if err == nil || !strings.Contains(err.Error(), "invalid v value") {
			t.Errorf("expected v value error, got: %v", err)
		}
	})

	t.Run("should reject invalid r length", func(t *testing.T) {
		p := *validPayload
		p.R = "0x1234"
		err := ValidateEip2612GasSponsorPayloadAt(&p, info, fixedTime)
		if err == nil || !strings.Contains(err.Error(), "invalid r length") {
			t.Errorf("expected r length error, got: %v", err)
		}
	})

	t.Run("should reject invalid s length", func(t *testing.T) {
		p := *validPayload
		p.S = "0x5678"
		err := ValidateEip2612GasSponsorPayloadAt(&p, info, fixedTime)
		if err == nil || !strings.Contains(err.Error(), "invalid s length") {
			t.Errorf("expected s length error, got: %v", err)
		}
	})

	t.Run("should accept case-insensitive spender match", func(t *testing.T) {
		lowercaseInfo := &Eip2612GasSponsorExtensionInfo{
			SponsoredNetworks: []string{"eip155:8453"},
			MaxAmount:         "1000000000",
			PermitDeadline:    300,
			SponsorAddress:    "0xfacilitator0000000000000000000000000000",
		}
		p := *validPayload
		p.Spender = "0xFacilitator0000000000000000000000000000"
		err := ValidateEip2612GasSponsorPayloadAt(&p, lowercaseInfo, fixedTime)
		if err != nil {
			t.Errorf("unexpected error for case-insensitive match: %v", err)
		}
	})
}

func TestBuildPermitCallData(t *testing.T) {
	payload := &Eip2612GasSponsorPayload{
		Network:         "eip155:8453",
		PermitSignature: "0x" + strings.Repeat("ab", 65),
		Owner:           "0xOwner",
		Spender:         "0xSpender",
		Value:           "1000000",
		Deadline:        1700000200,
		V:               27,
		R:               "0x" + strings.Repeat("ab", 32),
		S:               "0x" + strings.Repeat("cd", 32),
	}

	owner, spender, value, deadline, v, r, s := BuildPermitCallData(payload)

	if owner != "0xOwner" {
		t.Errorf("expected owner 0xOwner, got %s", owner)
	}
	if spender != "0xSpender" {
		t.Errorf("expected spender 0xSpender, got %s", spender)
	}
	if value != "1000000" {
		t.Errorf("expected value 1000000, got %s", value)
	}
	if deadline != 1700000200 {
		t.Errorf("expected deadline 1700000200, got %d", deadline)
	}
	if v != 27 {
		t.Errorf("expected v 27, got %d", v)
	}
	if r != "0x"+strings.Repeat("ab", 32) {
		t.Errorf("unexpected r value")
	}
	if s != "0x"+strings.Repeat("cd", 32) {
		t.Errorf("unexpected s value")
	}
}

func TestEip2612GasSponsorExtensionJSON(t *testing.T) {
	ext := Eip2612GasSponsorExtension{
		Info: Eip2612GasSponsorExtensionInfo{
			SponsoredNetworks: []string{"eip155:8453"},
			MaxAmount:         "1000000000",
			PermitDeadline:    300,
			SponsorAddress:    "0xSponsor",
		},
		Schema: map[string]interface{}{"type": "object"},
	}

	data, err := json.Marshal(ext)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded Eip2612GasSponsorExtension
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if len(decoded.Info.SponsoredNetworks) != 1 {
		t.Errorf("expected 1 network, got %d", len(decoded.Info.SponsoredNetworks))
	}
	if decoded.Info.MaxAmount != "1000000000" {
		t.Errorf("expected maxAmount 1000000000, got %s", decoded.Info.MaxAmount)
	}
	if decoded.Info.PermitDeadline != 300 {
		t.Errorf("expected permitDeadline 300, got %d", decoded.Info.PermitDeadline)
	}
}
