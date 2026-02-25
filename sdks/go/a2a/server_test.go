package a2a

import (
	"context"
	"errors"
	"testing"
)

// ============================================================================
// Mock Facilitator
// ============================================================================

type mockFacilitator struct {
	verifyResult *VerifyResult
	settleResult *SettleResult
	verifyErr    error
	settleErr    error
}

func (m *mockFacilitator) Verify(_ context.Context, _, _ map[string]interface{}) (*VerifyResult, error) {
	return m.verifyResult, m.verifyErr
}

func (m *mockFacilitator) Settle(_ context.Context, _, _ map[string]interface{}) (*SettleResult, error) {
	return m.settleResult, m.settleErr
}

// ============================================================================
// Fixtures
// ============================================================================

func paymentMessage() *Message {
	return &Message{
		Kind: "message",
		Role: "user",
		Parts: []MessagePart{
			{Kind: "text", Text: "Here is the payment."},
		},
		Metadata: map[string]interface{}{
			MetaPaymentStatus:      StatusPaymentSubmitted,
			MetaPaymentPayload:     map[string]interface{}{"signature": "0xabc", "from": "0xPayer"},
			X402MetaPaymentStatus:  StatusPaymentSubmitted,
			X402MetaPaymentPayload: map[string]interface{}{"signature": "0xabc", "from": "0xPayer"},
		},
	}
}

func noPaymentMessage() *Message {
	return &Message{
		Kind: "message",
		Role: "user",
		Parts: []MessagePart{
			{Kind: "text", Text: "Hello"},
		},
	}
}

func sampleRequirements() map[string]interface{} {
	return map[string]interface{}{
		"t402Version": 2,
		"resource":    "https://example.com/api",
		"accepts": []interface{}{
			map[string]interface{}{
				"scheme":  "exact",
				"network": "eip155:8453",
				"amount":  "1000000",
			},
		},
	}
}

func successFacilitator() *mockFacilitator {
	return &mockFacilitator{
		verifyResult: &VerifyResult{IsValid: true},
		settleResult: &SettleResult{Success: true, TxHash: "0xTxHash123", Network: "eip155:8453"},
	}
}

// ============================================================================
// CreateRequirements
// ============================================================================

func TestA2APaymentServer_CreateRequirements(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{
		DefaultRequirements: map[string]interface{}{
			"resource": "agent://default/skill",
			"extra":    "value",
		},
	})

	reqs := server.CreateRequirements(map[string]interface{}{
		"accepts": []interface{}{
			map[string]interface{}{"scheme": "exact", "network": "eip155:8453"},
		},
	})

	if reqs["t402Version"] != 2 {
		t.Errorf("expected t402Version 2, got %v", reqs["t402Version"])
	}
	if reqs["resource"] != "agent://default/skill" {
		t.Errorf("expected default resource, got %v", reqs["resource"])
	}
	if reqs["extra"] != "value" {
		t.Errorf("expected extra value, got %v", reqs["extra"])
	}
	if reqs["accepts"] == nil {
		t.Error("expected accepts to be set")
	}
}

func TestA2APaymentServer_CreateRequirements_OverrideDefaults(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{
		DefaultRequirements: map[string]interface{}{
			"resource": "agent://default/skill",
		},
	})

	reqs := server.CreateRequirements(map[string]interface{}{
		"resource": "agent://custom/skill",
	})

	if reqs["resource"] != "agent://custom/skill" {
		t.Errorf("expected override resource, got %v", reqs["resource"])
	}
}

// ============================================================================
// CreatePaymentRequiredTask
// ============================================================================

func TestA2APaymentServer_CreatePaymentRequiredTask(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	reqs := sampleRequirements()
	task := server.CreatePaymentRequiredTask("task-1", reqs, "Please pay.")

	if task.Kind != "task" {
		t.Errorf("expected kind task, got %s", task.Kind)
	}
	if task.ID != "task-1" {
		t.Errorf("expected ID task-1, got %s", task.ID)
	}
	if task.Status.State != StateInputRequired {
		t.Errorf("expected state input-required, got %s", task.Status.State)
	}
	if task.Status.Message == nil {
		t.Fatal("expected non-nil status message")
	}
	if task.Status.Message.Metadata[MetaPaymentStatus] != StatusPaymentRequired {
		t.Error("expected payment-required status in metadata")
	}
	if task.Status.Message.Parts[0].Text != "Please pay." {
		t.Errorf("expected custom text, got %s", task.Status.Message.Parts[0].Text)
	}
	if task.Status.Timestamp == "" {
		t.Error("expected non-empty timestamp")
	}
}

// ============================================================================
// ExtractPaymentPayload
// ============================================================================

func TestA2APaymentServer_ExtractPaymentPayload(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	msg := paymentMessage()
	payload := server.ExtractPaymentPayload(msg)

	if payload == nil {
		t.Fatal("expected non-nil payload")
	}
	if payload["signature"] != "0xabc" {
		t.Errorf("expected signature 0xabc, got %v", payload["signature"])
	}
}

func TestA2APaymentServer_ExtractPaymentPayload_X402Fallback(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	msg := &Message{
		Kind: "message",
		Role: "user",
		Metadata: map[string]interface{}{
			X402MetaPaymentPayload: map[string]interface{}{"signature": "0xdef"},
		},
	}
	payload := server.ExtractPaymentPayload(msg)

	if payload == nil {
		t.Fatal("expected non-nil payload from x402 key")
	}
	if payload["signature"] != "0xdef" {
		t.Errorf("expected signature 0xdef, got %v", payload["signature"])
	}
}

// ============================================================================
// HasPaymentPayload
// ============================================================================

func TestA2APaymentServer_HasPaymentPayload(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	if !server.HasPaymentPayload(paymentMessage()) {
		t.Error("expected HasPaymentPayload to return true")
	}
	if server.HasPaymentPayload(noPaymentMessage()) {
		t.Error("expected HasPaymentPayload to return false")
	}
}

// ============================================================================
// ProcessPayment — Success
// ============================================================================

func TestA2APaymentServer_ProcessPayment_Success(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{
		Facilitator: successFacilitator(),
	})

	result, err := server.ProcessPayment(context.Background(), paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Success {
		t.Errorf("expected success, got error: %s", result.Error)
	}
	if len(result.Receipts) != 1 {
		t.Fatalf("expected 1 receipt, got %d", len(result.Receipts))
	}
	if result.Receipts[0].TxHash != "0xTxHash123" {
		t.Errorf("expected TxHash 0xTxHash123, got %s", result.Receipts[0].TxHash)
	}
	if result.Message == nil {
		t.Error("expected non-nil message")
	}
	if result.Message.Metadata[MetaPaymentStatus] != StatusPaymentCompleted {
		t.Error("expected payment-completed status in message")
	}
}

// ============================================================================
// ProcessPayment — Verify Fail
// ============================================================================

func TestA2APaymentServer_ProcessPayment_VerifyFail(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{
		Facilitator: &mockFacilitator{
			verifyResult: &VerifyResult{IsValid: false, InvalidReason: "Bad signature"},
		},
	})

	result, err := server.ProcessPayment(context.Background(), paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected failure")
	}
	if result.Error != "Bad signature" {
		t.Errorf("expected error 'Bad signature', got %s", result.Error)
	}
	if result.Message.Metadata[MetaPaymentError] != "T402-2001" {
		t.Errorf("expected error code T402-2001, got %v", result.Message.Metadata[MetaPaymentError])
	}
}

// ============================================================================
// ProcessPayment — Settle Fail
// ============================================================================

func TestA2APaymentServer_ProcessPayment_SettleFail(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{
		Facilitator: &mockFacilitator{
			verifyResult: &VerifyResult{IsValid: true},
			settleResult: &SettleResult{Success: false, ErrorReason: "Insufficient funds"},
		},
	})

	result, err := server.ProcessPayment(context.Background(), paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected failure")
	}
	if result.Error != "Insufficient funds" {
		t.Errorf("expected error 'Insufficient funds', got %s", result.Error)
	}
	if result.Message.Metadata[MetaPaymentError] != "T402-3001" {
		t.Errorf("expected error code T402-3001, got %v", result.Message.Metadata[MetaPaymentError])
	}
	if len(result.Receipts) != 1 {
		t.Errorf("expected 1 receipt, got %d", len(result.Receipts))
	}
}

// ============================================================================
// ProcessPayment — No Payload
// ============================================================================

func TestA2APaymentServer_ProcessPayment_NoPayload(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{
		Facilitator: successFacilitator(),
	})

	result, err := server.ProcessPayment(context.Background(), noPaymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected failure for no payload")
	}
	if result.Error != "No payment payload in message" {
		t.Errorf("expected 'No payment payload in message', got %s", result.Error)
	}
	if result.Message.Metadata[MetaPaymentError] != "T402-1001" {
		t.Errorf("expected error code T402-1001, got %v", result.Message.Metadata[MetaPaymentError])
	}
}

// ============================================================================
// ProcessPayment — No Facilitator
// ============================================================================

func TestA2APaymentServer_ProcessPayment_NoFacilitator(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	result, err := server.ProcessPayment(context.Background(), paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected failure for no facilitator")
	}
	if result.Error != "No facilitator or payment handler configured" {
		t.Errorf("unexpected error: %s", result.Error)
	}
	if result.Message.Metadata[MetaPaymentError] != "T402-5001" {
		t.Errorf("expected error code T402-5001, got %v", result.Message.Metadata[MetaPaymentError])
	}
}

// ============================================================================
// ProcessPayment — Custom Handler
// ============================================================================

func TestA2APaymentServer_ProcessPayment_CustomHandler(t *testing.T) {
	handlerCalled := false
	server := NewA2APaymentServer(A2APaymentServerOptions{
		PaymentHandler: func(_ context.Context, payload, _ map[string]interface{}) (*A2APaymentResult, error) {
			handlerCalled = true
			return &A2APaymentResult{
				Success: true,
				Message: CreatePaymentCompletedMessage(nil, "Custom success"),
			}, nil
		},
	})

	result, err := server.ProcessPayment(context.Background(), paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !handlerCalled {
		t.Error("expected custom handler to be called")
	}
	if !result.Success {
		t.Error("expected success from custom handler")
	}
}

// ============================================================================
// ProcessPayment — Verify Error
// ============================================================================

func TestA2APaymentServer_ProcessPayment_VerifyError(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{
		Facilitator: &mockFacilitator{
			verifyErr: errors.New("connection timeout"),
		},
	})

	result, err := server.ProcessPayment(context.Background(), paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected failure")
	}
	if result.Message.Metadata[MetaPaymentError] != "T402-5002" {
		t.Errorf("expected error code T402-5002, got %v", result.Message.Metadata[MetaPaymentError])
	}
}

// ============================================================================
// ProcessPayment — Settle Error
// ============================================================================

func TestA2APaymentServer_ProcessPayment_SettleError(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{
		Facilitator: &mockFacilitator{
			verifyResult: &VerifyResult{IsValid: true},
			settleErr:    errors.New("RPC unavailable"),
		},
	})

	result, err := server.ProcessPayment(context.Background(), paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected failure")
	}
	if result.Message.Metadata[MetaPaymentError] != "T402-5002" {
		t.Errorf("expected error code T402-5002, got %v", result.Message.Metadata[MetaPaymentError])
	}
}

// ============================================================================
// HandlePayment
// ============================================================================

func TestA2APaymentServer_HandlePayment(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{
		Facilitator: successFacilitator(),
	})

	task := &Task{
		Kind:   "task",
		ID:     "task-handle",
		Status: TaskStatus{State: StateInputRequired},
	}

	updatedTask, err := server.HandlePayment(context.Background(), task, paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedTask.Status.State != StateCompleted {
		t.Errorf("expected state completed, got %s", updatedTask.Status.State)
	}
	if len(updatedTask.History) != 1 {
		t.Errorf("expected 1 history entry, got %d", len(updatedTask.History))
	}
}

// ============================================================================
// UpdateTaskWithPaymentResult
// ============================================================================

func TestA2APaymentServer_UpdateTaskWithPaymentResult_Success(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	task := &Task{
		Kind:   "task",
		ID:     "task-1",
		Status: TaskStatus{State: StateInputRequired},
	}

	result := &A2APaymentResult{
		Success:  true,
		Receipts: []*SettleResult{{Success: true, TxHash: "0x123"}},
		Message:  CreatePaymentCompletedMessage(nil, ""),
	}

	updated := server.UpdateTaskWithPaymentResult(task, result)

	if updated.Status.State != StateCompleted {
		t.Errorf("expected state completed, got %s", updated.Status.State)
	}
	if len(updated.History) != 1 {
		t.Errorf("expected 1 history entry, got %d", len(updated.History))
	}
	// Original task should not be mutated
	if task.Status.State != StateInputRequired {
		t.Error("original task should not be mutated")
	}
}

func TestA2APaymentServer_UpdateTaskWithPaymentResult_Failure(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	task := &Task{
		Kind:   "task",
		ID:     "task-1",
		Status: TaskStatus{State: StateInputRequired},
	}

	result := &A2APaymentResult{
		Success: false,
		Error:   "Verification failed",
		Message: CreatePaymentFailedMessage(nil, "T402-2001", "Verification failed"),
	}

	updated := server.UpdateTaskWithPaymentResult(task, result)

	if updated.Status.State != StateFailed {
		t.Errorf("expected state failed, got %s", updated.Status.State)
	}
	// UpdateTaskWithPaymentResult uses default error code T402-5000
	if updated.Status.Message.Metadata[MetaPaymentError] != "T402-5000" {
		t.Errorf("expected default error code T402-5000, got %v", updated.Status.Message.Metadata[MetaPaymentError])
	}
}

// ============================================================================
// CreateEmbeddedPaymentRequiredTask
// ============================================================================

func TestA2APaymentServer_CreateEmbeddedPaymentRequiredTask(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	contents := mockCartContents()
	reqs := mockX402Requirements()

	task := server.CreateEmbeddedPaymentRequiredTask("embed-task-1", contents, reqs, "jwt-auth", "Pay for translation")

	if task.Kind != "task" {
		t.Errorf("expected kind task, got %s", task.Kind)
	}
	if task.ID != "embed-task-1" {
		t.Errorf("expected ID embed-task-1, got %s", task.ID)
	}
	if task.Status.State != StateInputRequired {
		t.Errorf("expected state input-required, got %s", task.Status.State)
	}
	if task.Status.Message.Parts[0].Text != "Pay for translation" {
		t.Errorf("expected custom text, got %s", task.Status.Message.Parts[0].Text)
	}
	if task.Status.Message.Metadata[X402MetaPaymentStatus] != StatusPaymentRequired {
		t.Error("expected x402 payment-required status in metadata")
	}
	if len(task.Artifacts) != 1 {
		t.Fatalf("expected 1 artifact, got %d", len(task.Artifacts))
	}
	if task.Artifacts[0].Kind != "ap2.cart" {
		t.Errorf("expected artifact kind ap2.cart, got %s", task.Artifacts[0].Kind)
	}
	if len(task.Artifacts[0].Parts) != 1 {
		t.Fatalf("expected 1 artifact part, got %d", len(task.Artifacts[0].Parts))
	}
	if task.Artifacts[0].Parts[0].Data[AP2DataKeyCartMandate] == nil {
		t.Error("expected CartMandate data key in artifact part")
	}
}

func TestA2APaymentServer_CreateEmbeddedPaymentRequiredTask_DefaultText(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	contents := mockCartContents()
	reqs := mockX402Requirements()

	task := server.CreateEmbeddedPaymentRequiredTask("embed-task-2", contents, reqs, "", "")
	if task.Status.Message.Parts[0].Text != "Payment is required." {
		t.Errorf("expected default text, got %s", task.Status.Message.Parts[0].Text)
	}
}

// ============================================================================
// ExtractEmbeddedPayload
// ============================================================================

func TestA2APaymentServer_ExtractEmbeddedPayload(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	contents := mockPaymentMandateContents()
	payload := mockX402Payload()
	mandate := CreatePaymentMandateWithX402(contents, payload, "")

	msg := &Message{
		Kind: "message",
		Role: "user",
		Parts: []MessagePart{
			{Kind: "text", Text: "Payment"},
			CreatePaymentMandateDataPart(mandate),
		},
	}

	extracted := server.ExtractEmbeddedPayload(msg)
	if extracted == nil {
		t.Fatal("expected non-nil extracted payload")
	}
	if extracted["t402Version"] != float64(2) {
		t.Errorf("expected t402Version 2, got %v", extracted["t402Version"])
	}
}

func TestA2APaymentServer_ExtractEmbeddedPayload_NoMandate(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	msg := &Message{
		Kind:  "message",
		Role:  "user",
		Parts: []MessagePart{{Kind: "text", Text: "Hello"}},
	}

	extracted := server.ExtractEmbeddedPayload(msg)
	if extracted != nil {
		t.Error("expected nil for message without PaymentMandate")
	}
}

func TestA2APaymentServer_ExtractEmbeddedPayload_NilMessage(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	extracted := server.ExtractEmbeddedPayload(nil)
	if extracted != nil {
		t.Error("expected nil for nil message")
	}
}

// ============================================================================
// Callbacks
// ============================================================================

func TestA2APaymentServer_Callbacks(t *testing.T) {
	receivedCalled := false
	verifiedCalled := false
	settledCalled := false

	server := NewA2APaymentServer(A2APaymentServerOptions{
		Facilitator: successFacilitator(),
		OnPaymentReceived: func(_ map[string]interface{}) {
			receivedCalled = true
		},
		OnPaymentVerified: func(_ map[string]interface{}) {
			verifiedCalled = true
		},
		OnPaymentSettled: func(_ []*SettleResult) {
			settledCalled = true
		},
	})

	_, err := server.ProcessPayment(context.Background(), paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !receivedCalled {
		t.Error("expected OnPaymentReceived callback to fire")
	}
	if !verifiedCalled {
		t.Error("expected OnPaymentVerified callback to fire")
	}
	if !settledCalled {
		t.Error("expected OnPaymentSettled callback to fire")
	}
}

func TestA2APaymentServer_Callbacks_OnFail(t *testing.T) {
	failedCalled := false
	var failedErr string
	var failedPayload map[string]interface{}

	server := NewA2APaymentServer(A2APaymentServerOptions{
		Facilitator: &mockFacilitator{
			verifyResult: &VerifyResult{IsValid: false, InvalidReason: "Bad sig"},
		},
		OnPaymentFailed: func(err string, payload map[string]interface{}) {
			failedCalled = true
			failedErr = err
			failedPayload = payload
		},
	})

	_, err := server.ProcessPayment(context.Background(), paymentMessage(), sampleRequirements())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !failedCalled {
		t.Error("expected OnPaymentFailed callback to fire")
	}
	if failedErr != "Bad sig" {
		t.Errorf("expected error 'Bad sig', got %s", failedErr)
	}
	if failedPayload == nil {
		t.Error("expected non-nil payload in failure callback")
	}
}

func TestA2APaymentServer_Callbacks_NoPayload_OnFail(t *testing.T) {
	failedCalled := false
	server := NewA2APaymentServer(A2APaymentServerOptions{
		OnPaymentFailed: func(_ string, _ map[string]interface{}) {
			failedCalled = true
		},
	})

	_, _ = server.ProcessPayment(context.Background(), noPaymentMessage(), sampleRequirements())

	if !failedCalled {
		t.Error("expected OnPaymentFailed callback to fire for no payload")
	}
}

// ============================================================================
// CreatePaymentCompletedStatus / CreatePaymentFailedStatus
// ============================================================================

func TestA2APaymentServer_CreatePaymentCompletedStatus(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	receipts := []*SettleResult{{Success: true, TxHash: "0xABC"}}
	status := server.CreatePaymentCompletedStatus(receipts, "Done!")

	if status.State != StateCompleted {
		t.Errorf("expected state completed, got %s", status.State)
	}
	if status.Message.Metadata[MetaPaymentStatus] != StatusPaymentCompleted {
		t.Error("expected payment-completed status")
	}
	if status.Message.Parts[0].Text != "Done!" {
		t.Errorf("expected text 'Done!', got %s", status.Message.Parts[0].Text)
	}
	if status.Timestamp == "" {
		t.Error("expected non-empty timestamp")
	}
}

func TestA2APaymentServer_CreatePaymentFailedStatus(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	status := server.CreatePaymentFailedStatus("Bad payment", nil, "T402-2001")

	if status.State != StateFailed {
		t.Errorf("expected state failed, got %s", status.State)
	}
	if status.Message.Metadata[MetaPaymentError] != "T402-2001" {
		t.Errorf("expected error code T402-2001, got %v", status.Message.Metadata[MetaPaymentError])
	}
	if status.Message.Parts[0].Text != "Bad payment" {
		t.Errorf("expected error text, got %s", status.Message.Parts[0].Text)
	}
}

func TestA2APaymentServer_CreatePaymentFailedStatus_DefaultErrorCode(t *testing.T) {
	server := NewA2APaymentServer(A2APaymentServerOptions{})

	status := server.CreatePaymentFailedStatus("Unknown error", nil, "")

	if status.Message.Metadata[MetaPaymentError] != "T402-5000" {
		t.Errorf("expected default error code T402-5000, got %v", status.Message.Metadata[MetaPaymentError])
	}
}
