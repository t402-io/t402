package a2a

import (
	"testing"
)

func TestIsPaymentRequired(t *testing.T) {
	task := &Task{
		Kind: "task",
		ID:   "task-1",
		Status: TaskStatus{
			State: StateInputRequired,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Metadata: map[string]interface{}{
					MetaPaymentStatus: StatusPaymentRequired,
					MetaPaymentRequired: map[string]interface{}{
						"t402Version": 2,
						"resource":    "https://example.com/api",
					},
				},
			},
		},
	}

	if !IsPaymentRequired(task) {
		t.Error("expected IsPaymentRequired to return true")
	}

	// Not payment-required if state is different
	task.Status.State = StateWorking
	if IsPaymentRequired(task) {
		t.Error("expected IsPaymentRequired to return false for working state")
	}
}

func TestIsPaymentCompleted(t *testing.T) {
	task := &Task{
		Kind: "task",
		ID:   "task-1",
		Status: TaskStatus{
			State: StateCompleted,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Metadata: map[string]interface{}{
					MetaPaymentStatus: StatusPaymentCompleted,
				},
			},
		},
	}

	if !IsPaymentCompleted(task) {
		t.Error("expected IsPaymentCompleted to return true")
	}
}

func TestIsPaymentFailed(t *testing.T) {
	task := &Task{
		Kind: "task",
		ID:   "task-1",
		Status: TaskStatus{
			State: StateFailed,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Metadata: map[string]interface{}{
					MetaPaymentStatus: StatusPaymentFailed,
					MetaPaymentError:  "T402-3001",
				},
			},
		},
	}

	if !IsPaymentFailed(task) {
		t.Error("expected IsPaymentFailed to return true")
	}
}

func TestGetPaymentRequired(t *testing.T) {
	requirements := map[string]interface{}{
		"t402Version": 2,
		"resource":    "https://example.com/api",
	}
	task := &Task{
		Kind: "task",
		ID:   "task-1",
		Status: TaskStatus{
			State: StateInputRequired,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Metadata: map[string]interface{}{
					MetaPaymentStatus:   StatusPaymentRequired,
					MetaPaymentRequired: requirements,
				},
			},
		},
	}

	got := GetPaymentRequired(task)
	if got == nil {
		t.Fatal("expected non-nil payment requirements")
	}
	if got["resource"] != "https://example.com/api" {
		t.Errorf("expected resource https://example.com/api, got %v", got["resource"])
	}
}

func TestGetPaymentRequiredNil(t *testing.T) {
	task := &Task{
		Kind:   "task",
		ID:     "task-1",
		Status: TaskStatus{State: StateWorking},
	}

	got := GetPaymentRequired(task)
	if got != nil {
		t.Error("expected nil for non-payment-required task")
	}
}

func TestHasPaymentPayload(t *testing.T) {
	msg := &Message{
		Kind: "message",
		Role: "user",
		Metadata: map[string]interface{}{
			MetaPaymentStatus: StatusPaymentSubmitted,
			MetaPaymentPayload: map[string]interface{}{
				"signature": "0xabc",
			},
		},
	}

	if !HasPaymentPayload(msg) {
		t.Error("expected HasPaymentPayload to return true")
	}

	// No payload
	msg2 := &Message{Kind: "message", Role: "user"}
	if HasPaymentPayload(msg2) {
		t.Error("expected HasPaymentPayload to return false for no metadata")
	}
}

func TestExtractPaymentPayload(t *testing.T) {
	msg := &Message{
		Kind: "message",
		Role: "user",
		Metadata: map[string]interface{}{
			MetaPaymentPayload: map[string]interface{}{
				"signature": "0xabc",
			},
		},
	}

	payload := ExtractPaymentPayload(msg)
	if payload == nil {
		t.Fatal("expected non-nil payload")
	}
	if payload["signature"] != "0xabc" {
		t.Errorf("expected signature 0xabc, got %v", payload["signature"])
	}
}

func TestCreatePaymentRequiredMessage(t *testing.T) {
	requirements := map[string]interface{}{
		"t402Version": 2,
	}
	msg := CreatePaymentRequiredMessage(requirements, "")

	if msg.Role != "agent" {
		t.Errorf("expected role agent, got %s", msg.Role)
	}
	if msg.Parts[0].Text != "Payment is required to complete this request." {
		t.Errorf("unexpected text: %s", msg.Parts[0].Text)
	}
	if msg.Metadata[MetaPaymentStatus] != StatusPaymentRequired {
		t.Error("expected payment-required status")
	}
}

func TestCreatePaymentSubmissionMessage(t *testing.T) {
	payload := map[string]interface{}{
		"signature": "0xabc",
	}
	msg := CreatePaymentSubmissionMessage(payload, "My payment")

	if msg.Role != "user" {
		t.Errorf("expected role user, got %s", msg.Role)
	}
	if msg.Parts[0].Text != "My payment" {
		t.Errorf("unexpected text: %s", msg.Parts[0].Text)
	}
	if msg.Metadata[MetaPaymentStatus] != StatusPaymentSubmitted {
		t.Error("expected payment-submitted status")
	}
}

func TestCreatePaymentCompletedMessage(t *testing.T) {
	receipts := []interface{}{"receipt-1"}
	msg := CreatePaymentCompletedMessage(receipts, "")

	if msg.Metadata[MetaPaymentStatus] != StatusPaymentCompleted {
		t.Error("expected payment-completed status")
	}
}

func TestCreatePaymentFailedMessage(t *testing.T) {
	msg := CreatePaymentFailedMessage(nil, "T402-3001", "Verification failed")

	if msg.Metadata[MetaPaymentStatus] != StatusPaymentFailed {
		t.Error("expected payment-failed status")
	}
	if msg.Metadata[MetaPaymentError] != "T402-3001" {
		t.Errorf("expected error code T402-3001, got %v", msg.Metadata[MetaPaymentError])
	}
	if msg.Parts[0].Text != "Verification failed" {
		t.Errorf("unexpected text: %s", msg.Parts[0].Text)
	}
}

func TestCreateT402Extension(t *testing.T) {
	ext := CreateT402Extension(true)
	if ext.URI != T402ExtensionURI {
		t.Errorf("expected URI %s, got %s", T402ExtensionURI, ext.URI)
	}
	if ext.Description != "T402 multi-chain payment protocol (12 mechanisms, 44 networks)." {
		t.Errorf("unexpected description: %s", ext.Description)
	}
	if !ext.Required {
		t.Error("expected required=true")
	}

	ext2 := CreateT402Extension(false)
	if ext2.Required {
		t.Error("expected required=false")
	}
}

func TestConstants(t *testing.T) {
	if T402ExtensionURI != "https://github.com/google-a2a/a2a-t402/v0.1" {
		t.Errorf("wrong extension URI: %s", T402ExtensionURI)
	}
	if ExtensionsHeader != "X-A2A-Extensions" {
		t.Errorf("wrong extensions header: %s", ExtensionsHeader)
	}
}

func TestGetPaymentReceipts(t *testing.T) {
	task := &Task{
		Kind: "task",
		ID:   "task-1",
		Status: TaskStatus{
			State: StateCompleted,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Metadata: map[string]interface{}{
					MetaPaymentStatus:   StatusPaymentCompleted,
					MetaPaymentReceipts: []interface{}{"receipt-1", "receipt-2"},
				},
			},
		},
	}

	receipts := GetPaymentReceipts(task)
	if len(receipts) != 2 {
		t.Errorf("expected 2 receipts, got %d", len(receipts))
	}
}

// --- Dual-namespace (x402 compat) tests ---

func TestIsPaymentRequiredX402Only(t *testing.T) {
	task := &Task{
		Kind: "task",
		ID:   "task-x402",
		Status: TaskStatus{
			State: StateInputRequired,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Metadata: map[string]interface{}{
					X402MetaPaymentStatus: StatusPaymentRequired,
					X402MetaPaymentRequired: map[string]interface{}{
						"x402Version": 1,
					},
				},
			},
		},
	}

	if !IsPaymentRequired(task) {
		t.Error("expected IsPaymentRequired to return true for x402-only metadata")
	}

	// GetPaymentRequired should also work with x402 keys
	got := GetPaymentRequired(task)
	if got == nil {
		t.Fatal("expected non-nil payment requirements from x402 metadata")
	}
	if got["x402Version"] != 1 {
		t.Errorf("expected x402Version 1, got %v", got["x402Version"])
	}
}

func TestIsPaymentRequiredDualNamespace(t *testing.T) {
	task := &Task{
		Kind: "task",
		ID:   "task-dual",
		Status: TaskStatus{
			State: StateInputRequired,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Metadata: map[string]interface{}{
					MetaPaymentStatus:     StatusPaymentRequired,
					X402MetaPaymentStatus: StatusPaymentRequired,
					MetaPaymentRequired: map[string]interface{}{
						"t402Version": 2,
					},
					X402MetaPaymentRequired: map[string]interface{}{
						"x402Version": 1,
					},
				},
			},
		},
	}

	if !IsPaymentRequired(task) {
		t.Error("expected IsPaymentRequired to return true for dual-namespace metadata")
	}

	// t402 key should take priority
	got := GetPaymentRequired(task)
	if got == nil {
		t.Fatal("expected non-nil payment requirements")
	}
	if got["t402Version"] != 2 {
		t.Errorf("expected t402Version 2 (t402 key takes priority), got %v", got["t402Version"])
	}
}

func TestCreatePaymentRequiredMessageDualNamespace(t *testing.T) {
	requirements := map[string]interface{}{
		"t402Version": 2,
		"accepts": []interface{}{
			map[string]interface{}{
				"scheme":  "exact",
				"network": "eip155:8453",
				"asset":   "USDC",
			},
		},
	}
	msg := CreatePaymentRequiredMessage(requirements, "")

	// Must have t402 keys
	if msg.Metadata[MetaPaymentStatus] != StatusPaymentRequired {
		t.Error("expected t402 payment-required status")
	}
	if msg.Metadata[MetaPaymentRequired] == nil {
		t.Error("expected t402 payment requirements")
	}

	// Must have x402 keys
	if msg.Metadata[X402MetaPaymentStatus] != StatusPaymentRequired {
		t.Error("expected x402 payment-required status")
	}
	if msg.Metadata[X402MetaPaymentRequired] == nil {
		t.Error("expected x402 payment requirements")
	}

	// x402 requirements should be downgraded (has x402Version: 1)
	x402Req, ok := msg.Metadata[X402MetaPaymentRequired].(map[string]interface{})
	if !ok {
		t.Fatal("expected x402 requirements to be a map")
	}
	if x402Req["x402Version"] != 1 {
		t.Errorf("expected x402Version 1, got %v", x402Req["x402Version"])
	}
}

func TestCreatePaymentSubmissionMessageDualNamespace(t *testing.T) {
	payload := map[string]interface{}{
		"signature": "0xabc",
	}
	msg := CreatePaymentSubmissionMessage(payload, "")

	// Must have both t402 and x402 keys
	if msg.Metadata[MetaPaymentStatus] != StatusPaymentSubmitted {
		t.Error("expected t402 payment-submitted status")
	}
	if msg.Metadata[X402MetaPaymentStatus] != StatusPaymentSubmitted {
		t.Error("expected x402 payment-submitted status")
	}
	if msg.Metadata[MetaPaymentPayload] == nil {
		t.Error("expected t402 payment payload")
	}
	if msg.Metadata[X402MetaPaymentPayload] == nil {
		t.Error("expected x402 payment payload")
	}
}

func TestCreatePaymentCompletedMessageDualNamespace(t *testing.T) {
	receipts := []interface{}{"receipt-1"}
	msg := CreatePaymentCompletedMessage(receipts, "")

	// Must have both t402 and x402 keys
	if msg.Metadata[MetaPaymentStatus] != StatusPaymentCompleted {
		t.Error("expected t402 payment-completed status")
	}
	if msg.Metadata[X402MetaPaymentStatus] != StatusPaymentCompleted {
		t.Error("expected x402 payment-completed status")
	}
	if msg.Metadata[MetaPaymentReceipts] == nil {
		t.Error("expected t402 payment receipts")
	}
	if msg.Metadata[X402MetaPaymentReceipts] == nil {
		t.Error("expected x402 payment receipts")
	}
}

func TestCreatePaymentFailedMessageDualNamespace(t *testing.T) {
	msg := CreatePaymentFailedMessage(nil, "T402-3001", "Verification failed")

	// t402 keys
	if msg.Metadata[MetaPaymentStatus] != StatusPaymentFailed {
		t.Error("expected t402 payment-failed status")
	}
	if msg.Metadata[MetaPaymentError] != "T402-3001" {
		t.Errorf("expected t402 error code T402-3001, got %v", msg.Metadata[MetaPaymentError])
	}

	// x402 keys
	if msg.Metadata[X402MetaPaymentStatus] != StatusPaymentFailed {
		t.Error("expected x402 payment-failed status")
	}
	if msg.Metadata[X402MetaPaymentError] != "SETTLEMENT_FAILED" {
		t.Errorf("expected x402 error SETTLEMENT_FAILED, got %v", msg.Metadata[X402MetaPaymentError])
	}
}

func TestMapT402ErrorToX402(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"T402-1001", "INVALID_AMOUNT"},
		{"T402-2001", "INVALID_SIGNATURE"},
		{"T402-3001", "SETTLEMENT_FAILED"},
		{"T402-5001", "SETTLEMENT_FAILED"},
		{"T402-5002", "SETTLEMENT_FAILED"},
		{"T402-9999", "UNKNOWN_ERROR"},
		{"RANDOM", "UNKNOWN_ERROR"},
	}

	for _, tt := range tests {
		got := MapT402ErrorToX402(tt.input)
		if got != tt.expected {
			t.Errorf("MapT402ErrorToX402(%s) = %s, want %s", tt.input, got, tt.expected)
		}
	}
}

func TestDowngradeRequirementsToX402(t *testing.T) {
	requirements := map[string]interface{}{
		"t402Version": 2,
		"accepts": []interface{}{
			map[string]interface{}{
				"scheme":  "exact",
				"network": "eip155:8453",
				"asset":   "USDC",
				"amount":  "1000000",
			},
			map[string]interface{}{
				"scheme":  "exact",
				"network": "eip155:1",
				"asset":   "USDT",
				"amount":  "2000000",
			},
		},
	}

	result := DowngradeRequirementsToX402(requirements)
	if result == nil {
		t.Fatal("expected non-nil downgraded requirements")
	}
	if result["x402Version"] != 1 {
		t.Errorf("expected x402Version 1, got %v", result["x402Version"])
	}

	accepts, ok := result["accepts"].([]interface{})
	if !ok {
		t.Fatal("expected accepts to be a slice")
	}
	if len(accepts) != 2 {
		t.Fatalf("expected 2 accepts entries, got %d", len(accepts))
	}

	first, ok := accepts[0].(map[string]interface{})
	if !ok {
		t.Fatal("expected first accept to be a map")
	}
	if first["network"] != "base" {
		t.Errorf("expected network 'base', got %v", first["network"])
	}
	if first["asset"] != "USDC" {
		t.Errorf("expected asset preserved as USDC, got %v", first["asset"])
	}

	second, ok := accepts[1].(map[string]interface{})
	if !ok {
		t.Fatal("expected second accept to be a map")
	}
	if second["network"] != "ethereum" {
		t.Errorf("expected network 'ethereum', got %v", second["network"])
	}
}

func TestDowngradeRequirementsToX402NonEVM(t *testing.T) {
	requirements := map[string]interface{}{
		"t402Version": 2,
		"accepts": []interface{}{
			map[string]interface{}{
				"scheme":  "exact",
				"network": "solana:mainnet",
				"asset":   "USDC",
			},
			map[string]interface{}{
				"scheme":  "exact",
				"network": "ton:mainnet",
				"asset":   "USDT",
			},
		},
	}

	result := DowngradeRequirementsToX402(requirements)
	if result != nil {
		t.Error("expected nil for non-EVM requirements")
	}
}

func TestDowngradeRequirementsToX402NonExactScheme(t *testing.T) {
	requirements := map[string]interface{}{
		"t402Version": 2,
		"accepts": []interface{}{
			map[string]interface{}{
				"scheme":  "upto",
				"network": "eip155:8453",
				"asset":   "USDC",
			},
		},
	}

	result := DowngradeRequirementsToX402(requirements)
	if result != nil {
		t.Error("expected nil for non-exact scheme")
	}
}

func TestDowngradeRequirementsToX402InvalidInput(t *testing.T) {
	// Not a map
	result := DowngradeRequirementsToX402("invalid")
	if result != nil {
		t.Error("expected nil for non-map input")
	}

	// No accepts
	result = DowngradeRequirementsToX402(map[string]interface{}{
		"t402Version": 2,
	})
	if result != nil {
		t.Error("expected nil for missing accepts")
	}
}

func TestIsStandaloneFlow(t *testing.T) {
	task := &Task{
		Kind: "task",
		ID:   "task-1",
		Status: TaskStatus{
			State: StateInputRequired,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Metadata: map[string]interface{}{
					MetaPaymentStatus: StatusPaymentRequired,
				},
			},
		},
	}

	if !IsStandaloneFlow(task) {
		t.Error("expected IsStandaloneFlow to return true")
	}

	// Also works with x402 keys
	taskX402 := &Task{
		Kind: "task",
		ID:   "task-2",
		Status: TaskStatus{
			State: StateInputRequired,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Metadata: map[string]interface{}{
					X402MetaPaymentStatus: StatusPaymentRequired,
				},
			},
		},
	}

	if !IsStandaloneFlow(taskX402) {
		t.Error("expected IsStandaloneFlow to return true for x402 metadata")
	}

	// No metadata
	taskNone := &Task{
		Kind:   "task",
		ID:     "task-3",
		Status: TaskStatus{State: StateWorking},
	}

	if IsStandaloneFlow(taskNone) {
		t.Error("expected IsStandaloneFlow to return false for no metadata")
	}
}

func TestIsEmbeddedFlow(t *testing.T) {
	task := &Task{
		Kind: "task",
		ID:   "task-1",
		Status: TaskStatus{
			State: StateCompleted,
		},
		Artifacts: []Artifact{
			{
				Kind: "artifact",
				Metadata: map[string]interface{}{
					MetaPaymentStatus: StatusPaymentCompleted,
				},
			},
		},
	}

	if !IsEmbeddedFlow(task) {
		t.Error("expected IsEmbeddedFlow to return true")
	}

	// Also works with x402 keys in artifacts
	taskX402 := &Task{
		Kind: "task",
		ID:   "task-2",
		Status: TaskStatus{
			State: StateCompleted,
		},
		Artifacts: []Artifact{
			{
				Kind: "artifact",
				Metadata: map[string]interface{}{
					X402MetaPaymentStatus: StatusPaymentCompleted,
				},
			},
		},
	}

	if !IsEmbeddedFlow(taskX402) {
		t.Error("expected IsEmbeddedFlow to return true for x402 artifact metadata")
	}

	// No payment metadata in artifacts
	taskNone := &Task{
		Kind: "task",
		ID:   "task-3",
		Status: TaskStatus{
			State: StateCompleted,
		},
		Artifacts: []Artifact{
			{Kind: "artifact"},
		},
	}

	if IsEmbeddedFlow(taskNone) {
		t.Error("expected IsEmbeddedFlow to return false for no payment artifacts")
	}
}

func TestCreateX402Extension(t *testing.T) {
	ext := CreateX402Extension(true)
	if ext.URI != X402ExtensionURI {
		t.Errorf("expected URI %s, got %s", X402ExtensionURI, ext.URI)
	}
	if ext.Description != "x402 v0.2 payment extension (EVM compatibility layer)." {
		t.Errorf("unexpected description: %s", ext.Description)
	}
	if !ext.Required {
		t.Error("expected required=true")
	}

	ext2 := CreateX402Extension(false)
	if ext2.Required {
		t.Error("expected required=false")
	}
}

func TestX402Constants(t *testing.T) {
	if X402ExtensionURI != "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2" {
		t.Errorf("wrong x402 extension URI: %s", X402ExtensionURI)
	}
	if X402MetaPaymentStatus != "x402.payment.status" {
		t.Errorf("wrong x402 status key: %s", X402MetaPaymentStatus)
	}
	if X402MetaPaymentRequired != "x402.payment.required" {
		t.Errorf("wrong x402 required key: %s", X402MetaPaymentRequired)
	}
	if X402MetaPaymentPayload != "x402.payment.payload" {
		t.Errorf("wrong x402 payload key: %s", X402MetaPaymentPayload)
	}
	if X402MetaPaymentReceipts != "x402.payment.receipts" {
		t.Errorf("wrong x402 receipts key: %s", X402MetaPaymentReceipts)
	}
	if X402MetaPaymentError != "x402.payment.error" {
		t.Errorf("wrong x402 error key: %s", X402MetaPaymentError)
	}
}

func TestHasPaymentPayloadX402Only(t *testing.T) {
	msg := &Message{
		Kind: "message",
		Role: "user",
		Metadata: map[string]interface{}{
			X402MetaPaymentStatus: StatusPaymentSubmitted,
			X402MetaPaymentPayload: map[string]interface{}{
				"signature": "0xdef",
			},
		},
	}

	if !HasPaymentPayload(msg) {
		t.Error("expected HasPaymentPayload to return true for x402-only metadata")
	}

	payload := ExtractPaymentPayload(msg)
	if payload == nil {
		t.Fatal("expected non-nil payload from x402 metadata")
	}
	if payload["signature"] != "0xdef" {
		t.Errorf("expected signature 0xdef, got %v", payload["signature"])
	}
}
