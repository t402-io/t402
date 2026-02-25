package a2a

import (
	"context"
	"fmt"
)

// A2AFacilitator is a simplified facilitator interface for the A2A server.
// It avoids importing the parent t402 package which would cause circular imports.
type A2AFacilitator interface {
	Verify(ctx context.Context, payload, requirements map[string]interface{}) (*VerifyResult, error)
	Settle(ctx context.Context, payload, requirements map[string]interface{}) (*SettleResult, error)
}

// VerifyResult represents the result of payment verification.
type VerifyResult struct {
	IsValid       bool   `json:"isValid"`
	InvalidReason string `json:"invalidReason,omitempty"`
}

// SettleResult represents the result of payment settlement.
type SettleResult struct {
	Success     bool   `json:"success"`
	ErrorReason string `json:"errorReason,omitempty"`
	TxHash      string `json:"txHash,omitempty"`
	Network     string `json:"network,omitempty"`
}

// A2APaymentResult represents the outcome of payment processing.
type A2APaymentResult struct {
	Success  bool
	Receipts []*SettleResult
	Error    string
	Message  *Message
}

// A2APaymentServerOptions configures the A2A payment server.
type A2APaymentServerOptions struct {
	// Facilitator for verification and settlement.
	Facilitator A2AFacilitator

	// PaymentHandler is an alternative custom handler (instead of facilitator).
	PaymentHandler func(ctx context.Context, payload, requirements map[string]interface{}) (*A2APaymentResult, error)

	// DefaultRequirements is a template merged into all created requirements.
	DefaultRequirements map[string]interface{}

	// OnPaymentReceived is called when a payment payload is extracted.
	OnPaymentReceived func(payload map[string]interface{})

	// OnPaymentVerified is called after successful verification.
	OnPaymentVerified func(payload map[string]interface{})

	// OnPaymentSettled is called after successful settlement.
	OnPaymentSettled func(receipts []*SettleResult)

	// OnPaymentFailed is called when payment processing fails.
	OnPaymentFailed func(err string, payload map[string]interface{})
}

// A2APaymentServer provides server-side payment handling for A2A agent endpoints.
//
// Example:
//
//	server := NewA2APaymentServer(A2APaymentServerOptions{
//	    Facilitator: myFacilitator,
//	    DefaultRequirements: map[string]interface{}{
//	        "resource": "agent://my-agent/skill",
//	    },
//	})
//
//	requirements := server.CreateRequirements(map[string]interface{}{
//	    "accepts": []interface{}{...},
//	})
//	task := server.CreatePaymentRequiredTask("task-1", requirements, "")
type A2APaymentServer struct {
	options A2APaymentServerOptions
}

// NewA2APaymentServer creates a new A2APaymentServer with the given options.
func NewA2APaymentServer(opts A2APaymentServerOptions) *A2APaymentServer {
	return &A2APaymentServer{options: opts}
}

// CreateRequirements creates payment requirements by merging the provided
// requirements with DefaultRequirements and ensuring t402Version is set.
func (s *A2APaymentServer) CreateRequirements(requirements map[string]interface{}) map[string]interface{} {
	result := map[string]interface{}{
		"t402Version": 2,
	}
	// Apply defaults
	for k, v := range s.options.DefaultRequirements {
		result[k] = v
	}
	// Apply provided requirements (override defaults)
	for k, v := range requirements {
		result[k] = v
	}
	return result
}

// CreatePaymentRequiredStatus creates a task status in the "input-required" state
// with payment requirements metadata.
func (s *A2APaymentServer) CreatePaymentRequiredStatus(requirements map[string]interface{}, text string) TaskStatus {
	return TaskStatus{
		State:     StateInputRequired,
		Message:   CreatePaymentRequiredMessage(requirements, text),
		Timestamp: nowISO(),
	}
}

// CreatePaymentRequiredTask creates a complete task in the "input-required" state
// with payment requirements.
func (s *A2APaymentServer) CreatePaymentRequiredTask(taskID string, requirements map[string]interface{}, text string) *Task {
	status := s.CreatePaymentRequiredStatus(requirements, text)
	return &Task{
		Kind:   "task",
		ID:     taskID,
		Status: status,
	}
}

// ExtractPaymentPayload extracts the payment payload from a message's metadata.
// Checks the t402 key first, then falls back to x402.
func (s *A2APaymentServer) ExtractPaymentPayload(message *Message) map[string]interface{} {
	return ExtractPaymentPayload(message)
}

// HasPaymentPayload checks if a message contains a payment submission.
func (s *A2APaymentServer) HasPaymentPayload(message *Message) bool {
	return HasPaymentPayload(message)
}

// ProcessPayment processes a payment submission from a message.
// It extracts the payload, verifies, and settles using the facilitator
// or a custom payment handler.
func (s *A2APaymentServer) ProcessPayment(ctx context.Context, message *Message, requirements map[string]interface{}) (*A2APaymentResult, error) {
	payload := ExtractPaymentPayload(message)

	if payload == nil {
		errMsg := "No payment payload in message"
		if s.options.OnPaymentFailed != nil {
			s.options.OnPaymentFailed(errMsg, nil)
		}
		return &A2APaymentResult{
			Success: false,
			Error:   errMsg,
			Message: CreatePaymentFailedMessage(nil, "T402-1001", errMsg),
		}, nil
	}

	if s.options.OnPaymentReceived != nil {
		s.options.OnPaymentReceived(payload)
	}

	// Use custom handler if provided
	if s.options.PaymentHandler != nil {
		return s.options.PaymentHandler(ctx, payload, requirements)
	}

	// Use facilitator
	if s.options.Facilitator == nil {
		errMsg := "No facilitator or payment handler configured"
		if s.options.OnPaymentFailed != nil {
			s.options.OnPaymentFailed(errMsg, payload)
		}
		return &A2APaymentResult{
			Success: false,
			Error:   errMsg,
			Message: CreatePaymentFailedMessage(nil, "T402-5001", errMsg),
		}, nil
	}

	// Verify
	verifyResult, err := s.options.Facilitator.Verify(ctx, payload, requirements)
	if err != nil {
		errMsg := fmt.Sprintf("Payment processing error: %s", err.Error())
		if s.options.OnPaymentFailed != nil {
			s.options.OnPaymentFailed(errMsg, payload)
		}
		return &A2APaymentResult{
			Success: false,
			Error:   errMsg,
			Message: CreatePaymentFailedMessage(nil, "T402-5002", errMsg),
		}, nil
	}

	if !verifyResult.IsValid {
		errMsg := verifyResult.InvalidReason
		if errMsg == "" {
			errMsg = "Payment verification failed"
		}
		if s.options.OnPaymentFailed != nil {
			s.options.OnPaymentFailed(errMsg, payload)
		}
		return &A2APaymentResult{
			Success: false,
			Error:   errMsg,
			Message: CreatePaymentFailedMessage(nil, "T402-2001", errMsg),
		}, nil
	}

	if s.options.OnPaymentVerified != nil {
		s.options.OnPaymentVerified(payload)
	}

	// Settle
	settleResult, err := s.options.Facilitator.Settle(ctx, payload, requirements)
	if err != nil {
		errMsg := fmt.Sprintf("Payment processing error: %s", err.Error())
		if s.options.OnPaymentFailed != nil {
			s.options.OnPaymentFailed(errMsg, payload)
		}
		return &A2APaymentResult{
			Success: false,
			Error:   errMsg,
			Message: CreatePaymentFailedMessage(nil, "T402-5002", errMsg),
		}, nil
	}

	receipts := []*SettleResult{settleResult}

	if !settleResult.Success {
		errMsg := settleResult.ErrorReason
		if errMsg == "" {
			errMsg = "Payment settlement failed"
		}
		if s.options.OnPaymentFailed != nil {
			s.options.OnPaymentFailed(errMsg, payload)
		}
		return &A2APaymentResult{
			Success:  false,
			Receipts: receipts,
			Error:    errMsg,
			Message:  CreatePaymentFailedMessage(settleResultsToInterface(receipts), "T402-3001", errMsg),
		}, nil
	}

	if s.options.OnPaymentSettled != nil {
		s.options.OnPaymentSettled(receipts)
	}

	return &A2APaymentResult{
		Success:  true,
		Receipts: receipts,
		Message:  CreatePaymentCompletedMessage(settleResultsToInterface(receipts), ""),
	}, nil
}

// HandlePayment is a convenience method that processes a payment submission
// and returns an updated task.
func (s *A2APaymentServer) HandlePayment(ctx context.Context, task *Task, message *Message, requirements map[string]interface{}) (*Task, error) {
	result, err := s.ProcessPayment(ctx, message, requirements)
	if err != nil {
		return nil, err
	}
	return s.UpdateTaskWithPaymentResult(task, result), nil
}

// UpdateTaskWithPaymentResult updates a task based on a payment result.
// On success, the task state becomes "completed"; on failure, "failed".
func (s *A2APaymentServer) UpdateTaskWithPaymentResult(task *Task, result *A2APaymentResult) *Task {
	updated := *task
	if result.Success {
		updated.Status = s.CreatePaymentCompletedStatus(result.Receipts, "")
	} else {
		updated.Status = s.CreatePaymentFailedStatus(result.Error, result.Receipts, "")
	}
	if result.Message != nil {
		updated.History = append(append([]Message{}, task.History...), *result.Message)
	}
	return &updated
}

// CreatePaymentCompletedStatus creates a task status indicating successful payment.
func (s *A2APaymentServer) CreatePaymentCompletedStatus(receipts []*SettleResult, text string) TaskStatus {
	return TaskStatus{
		State:     StateCompleted,
		Message:   CreatePaymentCompletedMessage(settleResultsToInterface(receipts), text),
		Timestamp: nowISO(),
	}
}

// CreatePaymentFailedStatus creates a task status indicating failed payment.
func (s *A2APaymentServer) CreatePaymentFailedStatus(errMsg string, receipts []*SettleResult, errorCode string) TaskStatus {
	if errorCode == "" {
		errorCode = "T402-5000"
	}
	return TaskStatus{
		State:     StateFailed,
		Message:   CreatePaymentFailedMessage(settleResultsToInterface(receipts), errorCode, errMsg),
		Timestamp: nowISO(),
	}
}

// CreateEmbeddedPaymentRequiredTask creates a task with a CartMandate artifact
// for the AP2 embedded payment flow.
func (s *A2APaymentServer) CreateEmbeddedPaymentRequiredTask(taskID string, cartContents CartContents, requirements []map[string]interface{}, merchantAuth, text string) *Task {
	if text == "" {
		text = "Payment is required."
	}
	cartMandate := CreateCartMandateWithX402(cartContents, requirements, merchantAuth)
	return &Task{
		Kind: "task",
		ID:   taskID,
		Status: TaskStatus{
			State: StateInputRequired,
			Message: &Message{
				Kind: "message",
				Role: "agent",
				Parts: []MessagePart{
					{Kind: "text", Text: text},
				},
				Metadata: map[string]interface{}{
					X402MetaPaymentStatus: StatusPaymentRequired,
				},
			},
			Timestamp: nowISO(),
		},
		Artifacts: []Artifact{
			{
				Kind: "ap2.cart",
				Name: "Cart Mandate",
				Parts: []MessagePart{
					CreateCartMandateDataPart(cartMandate),
				},
			},
		},
	}
}

// ExtractEmbeddedPayload extracts the x402 payment payload from an embedded-flow message.
// It scans message parts for a PaymentMandate DataPart.
func (s *A2APaymentServer) ExtractEmbeddedPayload(message *Message) map[string]interface{} {
	if message == nil {
		return nil
	}
	mandateMap, ok := ExtractPaymentMandateFromMessage(*message)
	if !ok {
		return nil
	}
	// Reconstruct a PaymentMandate from the map to use ExtractX402Payload.
	mandate := paymentMandateFromMap(mandateMap)
	payload, ok := ExtractX402Payload(mandate)
	if !ok {
		return nil
	}
	return payload
}

// settleResultsToInterface converts a slice of SettleResult pointers to []interface{}
// for use with the helper functions that accept interface{} receipts.
func settleResultsToInterface(receipts []*SettleResult) []interface{} {
	if receipts == nil {
		return nil
	}
	result := make([]interface{}, len(receipts))
	for i, r := range receipts {
		result[i] = map[string]interface{}{
			"success":     r.Success,
			"errorReason": r.ErrorReason,
			"txHash":      r.TxHash,
			"network":     r.Network,
		}
	}
	return result
}

// paymentMandateFromMap reconstructs a PaymentMandate from a map[string]interface{}.
func paymentMandateFromMap(m map[string]interface{}) PaymentMandate {
	mandate := PaymentMandate{}

	pmcRaw, ok := m["payment_mandate_contents"]
	if !ok {
		return mandate
	}
	pmc, ok := pmcRaw.(map[string]interface{})
	if !ok {
		return mandate
	}

	if id, ok := pmc["payment_mandate_id"].(string); ok {
		mandate.PaymentMandateContents.PaymentMandateID = id
	}
	if id, ok := pmc["payment_details_id"].(string); ok {
		mandate.PaymentMandateContents.PaymentDetailsID = id
	}
	if agent, ok := pmc["merchant_agent"].(string); ok {
		mandate.PaymentMandateContents.MerchantAgent = agent
	}
	if ts, ok := pmc["timestamp"].(string); ok {
		mandate.PaymentMandateContents.Timestamp = ts
	}

	if prRaw, ok := pmc["payment_response"].(map[string]interface{}); ok {
		if mn, ok := prRaw["method_name"].(string); ok {
			mandate.PaymentMandateContents.PaymentResponse.MethodName = mn
		}
		if rid, ok := prRaw["request_id"].(string); ok {
			mandate.PaymentMandateContents.PaymentResponse.RequestID = rid
		}
		if details, ok := prRaw["details"].(map[string]interface{}); ok {
			mandate.PaymentMandateContents.PaymentResponse.Details = details
		}
	}

	if auth, ok := m["user_authorization"].(string); ok {
		mandate.UserAuthorization = auth
	}

	return mandate
}
