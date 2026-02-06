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
