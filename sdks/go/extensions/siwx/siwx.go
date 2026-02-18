// Package siwx provides Sign-In-With-X (SIWx) extension types and utilities
// for the t402 protocol. SIWx enables CAIP-122 compliant wallet-based identity
// assertions, allowing clients to prove control of a wallet address.
package siwx

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// ExtensionKey is the extension key for SIWx in requirements/payload.
const ExtensionKey = "siwx"

// HeaderName is the HTTP header name for SIWx payload.
const HeaderName = "X-T402-SIWx"

// SIWxExtensionInfo represents the server-side SIWX declaration.
type SIWxExtensionInfo struct {
	Domain          string `json:"domain"`
	URI             string `json:"uri"`
	Statement       string `json:"statement,omitempty"`
	Version         string `json:"version"`
	ChainID         string `json:"chainId"`
	Nonce           string `json:"nonce"`
	IssuedAt        string `json:"issuedAt"`
	ExpirationTime  string `json:"expirationTime,omitempty"`
	NotBefore       string `json:"notBefore,omitempty"`
	RequestID       string `json:"requestId,omitempty"`
	Resources       []string `json:"resources,omitempty"`
	SignatureScheme string `json:"signatureScheme,omitempty"`
}

// SIWxPayload represents the client-side SIWX response.
type SIWxPayload struct {
	Domain         string   `json:"domain"`
	Address        string   `json:"address"`
	Statement      string   `json:"statement,omitempty"`
	URI            string   `json:"uri"`
	Version        string   `json:"version"`
	ChainID        string   `json:"chainId"`
	Nonce          string   `json:"nonce"`
	IssuedAt       string   `json:"issuedAt"`
	ExpirationTime string   `json:"expirationTime,omitempty"`
	NotBefore      string   `json:"notBefore,omitempty"`
	RequestID      string   `json:"requestId,omitempty"`
	Resources      []string `json:"resources,omitempty"`
	Signature      string   `json:"signature"`
}

// SIWxExtension is the full extension for requirements.
type SIWxExtension struct {
	Info   SIWxExtensionInfo      `json:"info"`
	Schema map[string]interface{} `json:"schema"`
}

// SIWxOption configures optional fields for DeclareSIWxExtension.
type SIWxOption func(*SIWxExtensionInfo)

// WithStatement sets the statement field.
func WithStatement(statement string) SIWxOption {
	return func(info *SIWxExtensionInfo) {
		info.Statement = statement
	}
}

// WithExpirationTime sets a custom expiration time.
func WithExpirationTime(t time.Time) SIWxOption {
	return func(info *SIWxExtensionInfo) {
		info.ExpirationTime = t.UTC().Format(time.RFC3339Nano)
	}
}

// WithSignatureScheme sets the preferred signature scheme.
func WithSignatureScheme(scheme string) SIWxOption {
	return func(info *SIWxExtensionInfo) {
		info.SignatureScheme = scheme
	}
}

// WithVersion sets the SIWx version.
func WithVersion(version string) SIWxOption {
	return func(info *SIWxExtensionInfo) {
		info.Version = version
	}
}

// siwxSchema is the JSON Schema for SIWx payload validation.
var siwxSchema = map[string]interface{}{
	"type":     "object",
	"required": []string{"domain", "address", "uri", "version", "chainId", "nonce", "issuedAt", "signature"},
	"properties": map[string]interface{}{
		"domain":         map[string]interface{}{"type": "string"},
		"address":        map[string]interface{}{"type": "string"},
		"statement":      map[string]interface{}{"type": "string"},
		"uri":            map[string]interface{}{"type": "string"},
		"version":        map[string]interface{}{"type": "string"},
		"chainId":        map[string]interface{}{"type": "string"},
		"nonce":          map[string]interface{}{"type": "string"},
		"issuedAt":       map[string]interface{}{"type": "string", "format": "date-time"},
		"expirationTime": map[string]interface{}{"type": "string", "format": "date-time"},
		"notBefore":      map[string]interface{}{"type": "string", "format": "date-time"},
		"requestId":      map[string]interface{}{"type": "string"},
		"resources":      map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
		"signature":      map[string]interface{}{"type": "string"},
	},
}

// DeclareSIWxExtension creates a SIWx extension for server responses.
func DeclareSIWxExtension(resourceURI, network string, opts ...SIWxOption) (SIWxExtension, error) {
	domain, err := extractDomain(resourceURI)
	if err != nil {
		return SIWxExtension{}, fmt.Errorf("invalid resource URI: %w", err)
	}

	nonce, err := generateNonce()
	if err != nil {
		return SIWxExtension{}, fmt.Errorf("failed to generate nonce: %w", err)
	}

	now := time.Now().UTC()
	info := SIWxExtensionInfo{
		Domain:         domain,
		URI:            resourceURI,
		Version:        "1",
		ChainID:        network,
		Nonce:          nonce,
		IssuedAt:       now.Format(time.RFC3339Nano),
		ExpirationTime: now.Add(5 * time.Minute).Format(time.RFC3339Nano),
		Resources:      []string{resourceURI},
	}

	for _, opt := range opts {
		opt(&info)
	}

	return SIWxExtension{
		Info:   info,
		Schema: siwxSchema,
	}, nil
}

// ParseSIWxPayload extracts a SIWx payload from extensions map.
func ParseSIWxPayload(extensions map[string]interface{}) (*SIWxPayload, error) {
	raw, ok := extensions[ExtensionKey]
	if !ok {
		return nil, fmt.Errorf("missing %s extension", ExtensionKey)
	}

	data, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal siwx extension: %w", err)
	}

	var payload SIWxPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal siwx payload: %w", err)
	}

	if payload.Domain == "" || payload.Address == "" || payload.Signature == "" {
		return nil, fmt.Errorf("invalid siwx payload: missing required fields")
	}

	return &payload, nil
}

// ValidateSIWxMessage validates a SIWx message against expected values.
func ValidateSIWxMessage(payload *SIWxPayload, expectedResourceURI string, maxAge time.Duration) error {
	expectedDomain, err := extractDomain(expectedResourceURI)
	if err != nil {
		return fmt.Errorf("invalid expected URI: %w", err)
	}

	if payload.Domain != expectedDomain {
		return fmt.Errorf("domain mismatch: expected %s, got %s", expectedDomain, payload.Domain)
	}

	if payload.URI != expectedResourceURI {
		return fmt.Errorf("URI mismatch: expected %s, got %s", expectedResourceURI, payload.URI)
	}

	if payload.Version != "1" {
		return fmt.Errorf("unsupported version: %s", payload.Version)
	}

	issuedAt, err := time.Parse(time.RFC3339Nano, payload.IssuedAt)
	if err != nil {
		return fmt.Errorf("invalid issuedAt: %w", err)
	}

	if time.Since(issuedAt) > maxAge {
		return fmt.Errorf("message has expired (issuedAt too old)")
	}

	if payload.ExpirationTime != "" {
		expiration, err := time.Parse(time.RFC3339Nano, payload.ExpirationTime)
		if err != nil {
			return fmt.Errorf("invalid expirationTime: %w", err)
		}
		if time.Now().After(expiration) {
			return fmt.Errorf("message has expired")
		}
	}

	if payload.NotBefore != "" {
		notBefore, err := time.Parse(time.RFC3339Nano, payload.NotBefore)
		if err != nil {
			return fmt.Errorf("invalid notBefore: %w", err)
		}
		if time.Now().Before(notBefore) {
			return fmt.Errorf("message not yet valid (notBefore in future)")
		}
	}

	return nil
}

// ConstructMessage builds the CAIP-122 message string from a payload.
func ConstructMessage(payload *SIWxPayload) string {
	var b strings.Builder

	fmt.Fprintf(&b, "%s wants you to sign in with your %s account:\n", payload.Domain, payload.ChainID)
	b.WriteString(payload.Address)
	b.WriteString("\n")

	if payload.Statement != "" {
		b.WriteString("\n")
		b.WriteString(payload.Statement)
		b.WriteString("\n")
	}

	fmt.Fprintf(&b, "\nURI: %s\n", payload.URI)
	fmt.Fprintf(&b, "Version: %s\n", payload.Version)
	fmt.Fprintf(&b, "Chain ID: %s\n", payload.ChainID)
	fmt.Fprintf(&b, "Nonce: %s\n", payload.Nonce)
	fmt.Fprintf(&b, "Issued At: %s", payload.IssuedAt)

	if payload.ExpirationTime != "" {
		fmt.Fprintf(&b, "\nExpiration Time: %s", payload.ExpirationTime)
	}
	if payload.NotBefore != "" {
		fmt.Fprintf(&b, "\nNot Before: %s", payload.NotBefore)
	}
	if payload.RequestID != "" {
		fmt.Fprintf(&b, "\nRequest ID: %s", payload.RequestID)
	}

	if len(payload.Resources) > 0 {
		b.WriteString("\nResources:")
		for _, r := range payload.Resources {
			fmt.Fprintf(&b, "\n- %s", r)
		}
	}

	return b.String()
}

func extractDomain(resourceURI string) (string, error) {
	u, err := url.Parse(resourceURI)
	if err != nil {
		return "", err
	}
	if u.Host == "" {
		return "", fmt.Errorf("no host in URI: %s", resourceURI)
	}
	return u.Host, nil
}

func generateNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
