package a2a

import (
	"testing"
)

// ============================================================================
// Fixtures
// ============================================================================

func paymentRequiredTask() *Task {
	return &Task{
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
						"accepts": []interface{}{
							map[string]interface{}{
								"scheme":  "exact",
								"network": "eip155:8453",
								"amount":  "1000000",
								"asset":   "USDC",
							},
							map[string]interface{}{
								"scheme":  "upto",
								"network": "eip155:1",
								"amount":  "2000000",
								"asset":   "USDT",
							},
							map[string]interface{}{
								"scheme":  "exact",
								"network": "solana:mainnet",
								"amount":  "500000",
								"asset":   "USDC",
							},
						},
					},
					X402MetaPaymentStatus: StatusPaymentRequired,
				},
			},
		},
	}
}

func nonPaymentTask() *Task {
	return &Task{
		Kind:   "task",
		ID:     "task-2",
		Status: TaskStatus{State: StateWorking},
	}
}

// ============================================================================
// RequiresPayment
// ============================================================================

func TestA2APaymentClient_RequiresPayment_True(t *testing.T) {
	var callbackReqs map[string]interface{}
	client := NewA2APaymentClient(A2APaymentClientOptions{
		OnPaymentRequired: func(requirements map[string]interface{}) {
			callbackReqs = requirements
		},
	})

	task := paymentRequiredTask()
	if !client.RequiresPayment(task) {
		t.Error("expected RequiresPayment to return true")
	}
	if callbackReqs == nil {
		t.Error("expected OnPaymentRequired callback to fire")
	}
	if callbackReqs["resource"] != "https://example.com/api" {
		t.Errorf("expected resource https://example.com/api, got %v", callbackReqs["resource"])
	}
}

func TestA2APaymentClient_RequiresPayment_False(t *testing.T) {
	callbackFired := false
	client := NewA2APaymentClient(A2APaymentClientOptions{
		OnPaymentRequired: func(_ map[string]interface{}) {
			callbackFired = true
		},
	})

	task := nonPaymentTask()
	if client.RequiresPayment(task) {
		t.Error("expected RequiresPayment to return false")
	}
	if callbackFired {
		t.Error("expected OnPaymentRequired callback NOT to fire")
	}
}

func TestA2APaymentClient_RequiresPayment_NoCallback(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	task := paymentRequiredTask()
	if !client.RequiresPayment(task) {
		t.Error("expected RequiresPayment to return true even without callback")
	}
}

// ============================================================================
// GetRequirements
// ============================================================================

func TestA2APaymentClient_GetRequirements(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	task := paymentRequiredTask()
	reqs := client.GetRequirements(task)
	if reqs == nil {
		t.Fatal("expected non-nil requirements")
	}
	if reqs["t402Version"] != 2 {
		t.Errorf("expected t402Version 2, got %v", reqs["t402Version"])
	}
}

func TestA2APaymentClient_GetRequirements_NonPaymentTask(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	task := nonPaymentTask()
	reqs := client.GetRequirements(task)
	if reqs != nil {
		t.Error("expected nil requirements for non-payment task")
	}
}

// ============================================================================
// SelectPaymentOption
// ============================================================================

func TestA2APaymentClient_SelectPaymentOption_PreferredNetwork(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	task := paymentRequiredTask()
	reqs := client.GetRequirements(task)

	selected := client.SelectPaymentOption(reqs, "eip155:1", "")
	if selected == nil {
		t.Fatal("expected non-nil selected option")
	}
	if selected["network"] != "eip155:1" {
		t.Errorf("expected network eip155:1, got %v", selected["network"])
	}
}

func TestA2APaymentClient_SelectPaymentOption_PreferredScheme(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	task := paymentRequiredTask()
	reqs := client.GetRequirements(task)

	selected := client.SelectPaymentOption(reqs, "", "upto")
	if selected == nil {
		t.Fatal("expected non-nil selected option")
	}
	if selected["scheme"] != "upto" {
		t.Errorf("expected scheme upto, got %v", selected["scheme"])
	}
}

func TestA2APaymentClient_SelectPaymentOption_BothPreferences(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	task := paymentRequiredTask()
	reqs := client.GetRequirements(task)

	selected := client.SelectPaymentOption(reqs, "solana:mainnet", "exact")
	if selected == nil {
		t.Fatal("expected non-nil selected option")
	}
	if selected["network"] != "solana:mainnet" {
		t.Errorf("expected network solana:mainnet, got %v", selected["network"])
	}
	if selected["scheme"] != "exact" {
		t.Errorf("expected scheme exact, got %v", selected["scheme"])
	}
}

func TestA2APaymentClient_SelectPaymentOption_DefaultFirst(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	task := paymentRequiredTask()
	reqs := client.GetRequirements(task)

	selected := client.SelectPaymentOption(reqs, "", "")
	if selected == nil {
		t.Fatal("expected non-nil selected option")
	}
	// Should return first option
	if selected["network"] != "eip155:8453" {
		t.Errorf("expected first option network eip155:8453, got %v", selected["network"])
	}
}

func TestA2APaymentClient_SelectPaymentOption_NoAccepts(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	reqs := map[string]interface{}{
		"t402Version": 2,
	}
	selected := client.SelectPaymentOption(reqs, "eip155:8453", "exact")
	if selected != nil {
		t.Error("expected nil for missing accepts")
	}
}

func TestA2APaymentClient_SelectPaymentOption_EmptyAccepts(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	reqs := map[string]interface{}{
		"t402Version": 2,
		"accepts":     []interface{}{},
	}
	selected := client.SelectPaymentOption(reqs, "eip155:8453", "exact")
	if selected != nil {
		t.Error("expected nil for empty accepts")
	}
}

// ============================================================================
// CreatePaymentMessage
// ============================================================================

func TestA2APaymentClient_CreatePaymentMessage(t *testing.T) {
	var submittedPayload map[string]interface{}
	client := NewA2APaymentClient(A2APaymentClientOptions{
		OnPaymentSubmitted: func(payload map[string]interface{}) {
			submittedPayload = payload
		},
	})

	payload := map[string]interface{}{
		"signature": "0xabc123",
		"from":      "0xPayer",
	}
	msg := client.CreatePaymentMessage(payload, "Payment sent")

	if msg.Role != "user" {
		t.Errorf("expected role user, got %s", msg.Role)
	}
	if msg.Parts[0].Text != "Payment sent" {
		t.Errorf("expected text 'Payment sent', got %s", msg.Parts[0].Text)
	}
	// Dual-namespace metadata
	if msg.Metadata[MetaPaymentStatus] != StatusPaymentSubmitted {
		t.Error("expected t402 payment-submitted status")
	}
	if msg.Metadata[X402MetaPaymentStatus] != StatusPaymentSubmitted {
		t.Error("expected x402 payment-submitted status")
	}
	if msg.Metadata[MetaPaymentPayload] == nil {
		t.Error("expected t402 payment payload in metadata")
	}
	if msg.Metadata[X402MetaPaymentPayload] == nil {
		t.Error("expected x402 payment payload in metadata")
	}
	// Callback fired
	if submittedPayload == nil {
		t.Error("expected OnPaymentSubmitted callback to fire")
	}
	if submittedPayload["signature"] != "0xabc123" {
		t.Errorf("expected signature 0xabc123, got %v", submittedPayload["signature"])
	}
}

func TestA2APaymentClient_CreatePaymentMessage_DefaultText(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	payload := map[string]interface{}{"signature": "0x1"}
	msg := client.CreatePaymentMessage(payload, "")

	if msg.Parts[0].Text != "Here is the payment authorization." {
		t.Errorf("expected default text, got %s", msg.Parts[0].Text)
	}
}

// ============================================================================
// ExtractEmbeddedRequirements
// ============================================================================

func TestA2APaymentClient_ExtractEmbeddedRequirements(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	contents := mockCartContents()
	reqs := mockX402Requirements()
	mandate := CreateCartMandateWithX402(contents, reqs, "")

	task := &Task{
		Kind:   "task",
		ID:     "embed-task",
		Status: TaskStatus{State: StateInputRequired},
		Artifacts: []Artifact{
			{
				Kind:  "ap2.cart",
				Name:  "Cart",
				Parts: []MessagePart{CreateCartMandateDataPart(mandate)},
			},
		},
	}

	extracted := client.ExtractEmbeddedRequirements(task)
	if extracted == nil {
		t.Fatal("expected non-nil requirements from embedded task")
	}
	if len(extracted) != 1 {
		t.Fatalf("expected 1 requirement, got %d", len(extracted))
	}
	if extracted[0]["network"] != "eip155:8453" {
		t.Errorf("expected network eip155:8453, got %v", extracted[0]["network"])
	}
}

func TestA2APaymentClient_ExtractEmbeddedRequirements_NoArtifacts(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	task := &Task{
		Kind:   "task",
		ID:     "empty-task",
		Status: TaskStatus{State: StateInputRequired},
	}

	extracted := client.ExtractEmbeddedRequirements(task)
	if extracted != nil {
		t.Error("expected nil for task with no artifacts")
	}
}

// ============================================================================
// CreateEmbeddedPaymentMessage
// ============================================================================

func TestA2APaymentClient_CreateEmbeddedPaymentMessage(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	contents := mockPaymentMandateContents()
	payload := mockX402Payload()

	msg := client.CreateEmbeddedPaymentMessage(contents, payload, "vp-jwt", "Paying now")

	if msg.Role != "user" {
		t.Errorf("expected role user, got %s", msg.Role)
	}
	if len(msg.Parts) != 2 {
		t.Fatalf("expected 2 parts, got %d", len(msg.Parts))
	}
	if msg.Parts[0].Text != "Paying now" {
		t.Errorf("expected text 'Paying now', got %s", msg.Parts[0].Text)
	}
	if msg.Parts[1].Kind != "data" {
		t.Errorf("expected second part kind data, got %s", msg.Parts[1].Kind)
	}
	if msg.Parts[1].Data[AP2DataKeyPaymentMandate] == nil {
		t.Error("expected PaymentMandate data key in data part")
	}
	if msg.Metadata[MetaPaymentStatus] != StatusPaymentSubmitted {
		t.Error("expected t402 payment-submitted status")
	}
	if msg.Metadata[X402MetaPaymentStatus] != StatusPaymentSubmitted {
		t.Error("expected x402 payment-submitted status")
	}
}

func TestA2APaymentClient_CreateEmbeddedPaymentMessage_DefaultText(t *testing.T) {
	client := NewA2APaymentClient(A2APaymentClientOptions{})

	contents := mockPaymentMandateContents()
	payload := mockX402Payload()

	msg := client.CreateEmbeddedPaymentMessage(contents, payload, "", "")
	if msg.Parts[0].Text != "Here is the payment mandate." {
		t.Errorf("expected default text, got %s", msg.Parts[0].Text)
	}
}
