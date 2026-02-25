package a2a

import (
	"testing"
)

// ============================================================================
// Test Fixtures
// ============================================================================

func mockCartContents() CartContents {
	return CartContents{
		ID:                           "cart-001",
		UserCartConfirmationRequired: false,
		PaymentRequest: AP2PaymentRequest{
			MethodData: []AP2PaymentMethodData{},
			Details: AP2PaymentDetailsInit{
				ID: "order-001",
				DisplayItems: []AP2PaymentItem{
					{Label: "AI Translation", Amount: AP2PaymentCurrencyAmount{Currency: "USD", Value: 1.0}},
				},
				Total: AP2PaymentItem{Label: "Total", Amount: AP2PaymentCurrencyAmount{Currency: "USD", Value: 1.0}},
			},
		},
		CartExpiry:   "2026-12-31T23:59:59Z",
		MerchantName: "Test Merchant",
	}
}

func mockX402Requirements() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"scheme":            "exact",
			"network":           "eip155:8453",
			"amount":            "1000000",
			"asset":             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			"payTo":             "0xTestPayTo",
			"maxTimeoutSeconds": float64(3600),
		},
	}
}

func mockPaymentMandateContents() PaymentMandateContents {
	return PaymentMandateContents{
		PaymentMandateID: "mandate-001",
		PaymentDetailsID: "cart-001",
		PaymentDetailsTotal: AP2PaymentItem{
			Label:  "Total",
			Amount: AP2PaymentCurrencyAmount{Currency: "USD", Value: 1.0},
		},
		PaymentResponse: AP2PaymentResponse{
			RequestID:  "order-001",
			MethodName: "",
		},
		MerchantAgent: "agent://test-merchant/translate",
		Timestamp:     "2026-02-25T12:00:00Z",
	}
}

func mockX402Payload() map[string]interface{} {
	return map[string]interface{}{
		"t402Version": float64(2),
		"payload": map[string]interface{}{
			"signature": "0xMockSignature",
			"from":      "0xTestPayer",
			"to":        "0xTestPayTo",
			"amount":    "1000000",
		},
	}
}

// ============================================================================
// Constants
// ============================================================================

func TestAP2Constants(t *testing.T) {
	tests := []struct {
		name     string
		got      string
		expected string
	}{
		{"AP2ExtensionURI", AP2ExtensionURI, "https://github.com/google-agentic-commerce/ap2/tree/v0.1"},
		{"X402PaymentMethod", X402PaymentMethod, "https://www.x402.org/"},
		{"AP2DataKeyIntentMandate", AP2DataKeyIntentMandate, "ap2.mandates.IntentMandate"},
		{"AP2DataKeyCartMandate", AP2DataKeyCartMandate, "ap2.mandates.CartMandate"},
		{"AP2DataKeyPaymentMandate", AP2DataKeyPaymentMandate, "ap2.mandates.PaymentMandate"},
		{"AP2DataKeyPaymentReceipt", AP2DataKeyPaymentReceipt, "ap2.PaymentReceipt"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, tt.got)
			}
		})
	}
}

// ============================================================================
// CartMandate Bridge
// ============================================================================

func TestCreateCartMandateWithX402EmbedsRequirements(t *testing.T) {
	contents := mockCartContents()
	reqs := mockX402Requirements()

	mandate := CreateCartMandateWithX402(contents, reqs, "")

	if mandate.Contents.ID != "cart-001" {
		t.Errorf("expected cart ID cart-001, got %s", mandate.Contents.ID)
	}
	if mandate.Contents.MerchantName != "Test Merchant" {
		t.Errorf("expected merchant name Test Merchant, got %s", mandate.Contents.MerchantName)
	}

	// Find the x402 method
	var x402Method *AP2PaymentMethodData
	for i, m := range mandate.Contents.PaymentRequest.MethodData {
		if m.SupportedMethods == X402PaymentMethod {
			x402Method = &mandate.Contents.PaymentRequest.MethodData[i]
			break
		}
	}
	if x402Method == nil {
		t.Fatal("expected to find x402 payment method")
	}
	if x402Method.Data == nil {
		t.Fatal("expected x402 method data to be non-nil")
	}
	if x402Method.Data["requirements"] == nil {
		t.Fatal("expected requirements in x402 method data")
	}
}

func TestCreateCartMandateWithX402PreservesNonX402Methods(t *testing.T) {
	contents := mockCartContents()
	contents.PaymentRequest.MethodData = []AP2PaymentMethodData{
		{SupportedMethods: "https://pay.google.com/", Data: map[string]interface{}{"type": "CARD"}},
	}
	reqs := mockX402Requirements()

	mandate := CreateCartMandateWithX402(contents, reqs, "")

	if len(mandate.Contents.PaymentRequest.MethodData) != 2 {
		t.Fatalf("expected 2 methods, got %d", len(mandate.Contents.PaymentRequest.MethodData))
	}
	if mandate.Contents.PaymentRequest.MethodData[0].SupportedMethods != "https://pay.google.com/" {
		t.Errorf("expected first method to be Google Pay, got %s", mandate.Contents.PaymentRequest.MethodData[0].SupportedMethods)
	}
	if mandate.Contents.PaymentRequest.MethodData[1].SupportedMethods != X402PaymentMethod {
		t.Errorf("expected second method to be x402, got %s", mandate.Contents.PaymentRequest.MethodData[1].SupportedMethods)
	}
}

func TestCreateCartMandateWithX402IncludesMerchantAuth(t *testing.T) {
	contents := mockCartContents()
	reqs := mockX402Requirements()

	mandate := CreateCartMandateWithX402(contents, reqs, "jwt-token-here")

	if mandate.MerchantAuthorization != "jwt-token-here" {
		t.Errorf("expected merchant authorization jwt-token-here, got %s", mandate.MerchantAuthorization)
	}
}

func TestExtractX402RequirementsRoundTrip(t *testing.T) {
	contents := mockCartContents()
	reqs := mockX402Requirements()

	mandate := CreateCartMandateWithX402(contents, reqs, "")
	extracted, ok := ExtractX402Requirements(mandate)

	if !ok {
		t.Fatal("expected ExtractX402Requirements to return true")
	}
	if len(extracted) != 1 {
		t.Fatalf("expected 1 requirement, got %d", len(extracted))
	}
	if extracted[0]["network"] != "eip155:8453" {
		t.Errorf("expected network eip155:8453, got %v", extracted[0]["network"])
	}
	if extracted[0]["amount"] != "1000000" {
		t.Errorf("expected amount 1000000, got %v", extracted[0]["amount"])
	}
}

func TestExtractX402RequirementsReturnsFalseForNonX402(t *testing.T) {
	mandate := CartMandate{
		Contents: CartContents{
			ID: "cart-no-x402",
			PaymentRequest: AP2PaymentRequest{
				MethodData: []AP2PaymentMethodData{
					{SupportedMethods: "https://pay.google.com/", Data: map[string]interface{}{"type": "CARD"}},
				},
			},
		},
	}

	result, ok := ExtractX402Requirements(mandate)
	if ok {
		t.Error("expected ExtractX402Requirements to return false for non-x402 mandate")
	}
	if result != nil {
		t.Error("expected nil result for non-x402 mandate")
	}
}

func TestExtractX402RequirementsReturnsFalseForNoMethods(t *testing.T) {
	mandate := CartMandate{
		Contents: CartContents{
			ID: "cart-empty",
			PaymentRequest: AP2PaymentRequest{
				MethodData: []AP2PaymentMethodData{},
			},
		},
	}

	result, ok := ExtractX402Requirements(mandate)
	if ok {
		t.Error("expected ExtractX402Requirements to return false for empty methods")
	}
	if result != nil {
		t.Error("expected nil result for empty methods")
	}
}

func TestExtractX402RequirementsReturnsFalseForMissingData(t *testing.T) {
	mandate := CartMandate{
		Contents: CartContents{
			ID: "cart-no-data",
			PaymentRequest: AP2PaymentRequest{
				MethodData: []AP2PaymentMethodData{
					{SupportedMethods: X402PaymentMethod, Data: map[string]interface{}{}},
				},
			},
		},
	}

	result, ok := ExtractX402Requirements(mandate)
	if ok {
		t.Error("expected ExtractX402Requirements to return false for missing requirements key")
	}
	if result != nil {
		t.Error("expected nil result for missing requirements key")
	}
}

func TestCreateCartMandateReplacesExistingX402Method(t *testing.T) {
	contents := mockCartContents()
	contents.PaymentRequest.MethodData = []AP2PaymentMethodData{
		{SupportedMethods: X402PaymentMethod, Data: map[string]interface{}{"requirements": []map[string]interface{}{{"old": true}}}},
		{SupportedMethods: "https://pay.google.com/"},
	}
	reqs := mockX402Requirements()

	mandate := CreateCartMandateWithX402(contents, reqs, "")

	// Should have exactly 2 methods: Google Pay + new x402
	if len(mandate.Contents.PaymentRequest.MethodData) != 2 {
		t.Fatalf("expected 2 methods (old x402 replaced), got %d", len(mandate.Contents.PaymentRequest.MethodData))
	}
	// First should be Google Pay (non-x402 preserved)
	if mandate.Contents.PaymentRequest.MethodData[0].SupportedMethods != "https://pay.google.com/" {
		t.Errorf("expected first method to be Google Pay, got %s", mandate.Contents.PaymentRequest.MethodData[0].SupportedMethods)
	}
	// Second should be the new x402
	if mandate.Contents.PaymentRequest.MethodData[1].SupportedMethods != X402PaymentMethod {
		t.Errorf("expected second method to be x402, got %s", mandate.Contents.PaymentRequest.MethodData[1].SupportedMethods)
	}
}

// ============================================================================
// PaymentMandate Bridge
// ============================================================================

func TestCreatePaymentMandateWithX402EmbedsPayload(t *testing.T) {
	contents := mockPaymentMandateContents()
	payload := mockX402Payload()

	mandate := CreatePaymentMandateWithX402(contents, payload, "")

	if mandate.PaymentMandateContents.PaymentMandateID != "mandate-001" {
		t.Errorf("expected mandate ID mandate-001, got %s", mandate.PaymentMandateContents.PaymentMandateID)
	}
	if mandate.PaymentMandateContents.PaymentResponse.MethodName != X402PaymentMethod {
		t.Errorf("expected method name %s, got %s", X402PaymentMethod, mandate.PaymentMandateContents.PaymentResponse.MethodName)
	}
	if mandate.PaymentMandateContents.PaymentResponse.Details == nil {
		t.Fatal("expected non-nil payment response details")
	}
}

func TestCreatePaymentMandateWithX402IncludesUserAuth(t *testing.T) {
	contents := mockPaymentMandateContents()
	payload := mockX402Payload()

	mandate := CreatePaymentMandateWithX402(contents, payload, "verifiable-presentation-jwt")

	if mandate.UserAuthorization != "verifiable-presentation-jwt" {
		t.Errorf("expected user authorization, got %s", mandate.UserAuthorization)
	}
}

func TestExtractX402PayloadRoundTrip(t *testing.T) {
	contents := mockPaymentMandateContents()
	payload := mockX402Payload()

	mandate := CreatePaymentMandateWithX402(contents, payload, "")
	extracted, ok := ExtractX402Payload(mandate)

	if !ok {
		t.Fatal("expected ExtractX402Payload to return true")
	}
	if extracted["t402Version"] != float64(2) {
		t.Errorf("expected t402Version 2, got %v", extracted["t402Version"])
	}
	payloadMap, ok := extracted["payload"].(map[string]interface{})
	if !ok {
		t.Fatal("expected payload to be a map")
	}
	if payloadMap["signature"] != "0xMockSignature" {
		t.Errorf("expected signature 0xMockSignature, got %v", payloadMap["signature"])
	}
}

func TestExtractX402PayloadReturnsFalseForNonX402Method(t *testing.T) {
	mandate := PaymentMandate{
		PaymentMandateContents: PaymentMandateContents{
			PaymentResponse: AP2PaymentResponse{
				MethodName: "https://pay.google.com/",
				Details:    map[string]interface{}{"foo": "bar"},
			},
		},
	}

	result, ok := ExtractX402Payload(mandate)
	if ok {
		t.Error("expected ExtractX402Payload to return false for non-x402 method")
	}
	if result != nil {
		t.Error("expected nil result for non-x402 method")
	}
}

func TestExtractX402PayloadReturnsFalseForNilDetails(t *testing.T) {
	mandate := PaymentMandate{
		PaymentMandateContents: PaymentMandateContents{
			PaymentResponse: AP2PaymentResponse{
				MethodName: X402PaymentMethod,
				Details:    nil,
			},
		},
	}

	result, ok := ExtractX402Payload(mandate)
	if ok {
		t.Error("expected ExtractX402Payload to return false for nil details")
	}
	if result != nil {
		t.Error("expected nil result for nil details")
	}
}

// ============================================================================
// DataPart Helpers
// ============================================================================

func TestCreateCartMandateDataPartAndExtractFromArtifact(t *testing.T) {
	contents := mockCartContents()
	reqs := mockX402Requirements()
	mandate := CreateCartMandateWithX402(contents, reqs, "")

	dataPart := CreateCartMandateDataPart(mandate)

	if dataPart.Kind != "data" {
		t.Errorf("expected kind data, got %s", dataPart.Kind)
	}
	if dataPart.Data[AP2DataKeyCartMandate] == nil {
		t.Fatal("expected CartMandate data key to be present")
	}

	// Extract from artifact
	artifact := Artifact{
		Kind:  "ap2.cart",
		Name:  "Cart",
		Parts: []MessagePart{dataPart},
	}

	extracted, ok := ExtractCartMandateFromArtifact(artifact)
	if !ok {
		t.Fatal("expected ExtractCartMandateFromArtifact to return true")
	}
	// Verify contents round-tripped (as map)
	contentsMap, ok := extracted["contents"].(map[string]interface{})
	if !ok {
		t.Fatal("expected contents to be a map")
	}
	if contentsMap["id"] != "cart-001" {
		t.Errorf("expected cart ID cart-001, got %v", contentsMap["id"])
	}
}

func TestCreatePaymentMandateDataPartCreatesCorrectPart(t *testing.T) {
	contents := mockPaymentMandateContents()
	payload := mockX402Payload()
	mandate := CreatePaymentMandateWithX402(contents, payload, "")

	dataPart := CreatePaymentMandateDataPart(mandate)

	if dataPart.Kind != "data" {
		t.Errorf("expected kind data, got %s", dataPart.Kind)
	}
	if dataPart.Data[AP2DataKeyPaymentMandate] == nil {
		t.Fatal("expected PaymentMandate data key to be present")
	}
}

func TestExtractPaymentMandateFromMessageRoundTrip(t *testing.T) {
	contents := mockPaymentMandateContents()
	payload := mockX402Payload()
	mandate := CreatePaymentMandateWithX402(contents, payload, "")

	msg := Message{
		Kind: "message",
		Role: "user",
		Parts: []MessagePart{
			{Kind: "text", Text: "Payment"},
			CreatePaymentMandateDataPart(mandate),
		},
	}

	extracted, ok := ExtractPaymentMandateFromMessage(msg)
	if !ok {
		t.Fatal("expected ExtractPaymentMandateFromMessage to return true")
	}
	pmContents, ok := extracted["payment_mandate_contents"].(map[string]interface{})
	if !ok {
		t.Fatal("expected payment_mandate_contents to be a map")
	}
	if pmContents["payment_mandate_id"] != "mandate-001" {
		t.Errorf("expected mandate ID mandate-001, got %v", pmContents["payment_mandate_id"])
	}
}

func TestCreateIntentMandateDataPart(t *testing.T) {
	intent := IntentMandate{
		NaturalLanguageDescription:   "Book a flight to Tokyo",
		UserCartConfirmationRequired: true,
		IntentExpiry:                 "2026-12-31T23:59:59Z",
	}

	dataPart := CreateIntentMandateDataPart(intent)

	if dataPart.Kind != "data" {
		t.Errorf("expected kind data, got %s", dataPart.Kind)
	}
	if dataPart.Data[AP2DataKeyIntentMandate] == nil {
		t.Fatal("expected IntentMandate data key to be present")
	}
}

func TestCreatePaymentReceiptDataPart(t *testing.T) {
	receipt := AP2PaymentReceipt{
		PaymentMandateID: "mandate-001",
		Timestamp:        "2026-02-25T12:01:00Z",
		PaymentID:        "tx-001",
		Amount:           AP2PaymentCurrencyAmount{Currency: "USD", Value: 1.0},
		PaymentStatus:    map[string]interface{}{"merchant_confirmation_id": "conf-001"},
	}

	dataPart := CreatePaymentReceiptDataPart(receipt)

	if dataPart.Kind != "data" {
		t.Errorf("expected kind data, got %s", dataPart.Kind)
	}
	if dataPart.Data[AP2DataKeyPaymentReceipt] == nil {
		t.Fatal("expected PaymentReceipt data key to be present")
	}
}

// ============================================================================
// Edge Cases
// ============================================================================

func TestExtractCartMandateFromArtifactNoParts(t *testing.T) {
	artifact := Artifact{Kind: "generic"}

	result, ok := ExtractCartMandateFromArtifact(artifact)
	if ok {
		t.Error("expected false for artifact with no parts")
	}
	if result != nil {
		t.Error("expected nil result for artifact with no parts")
	}
}

func TestExtractCartMandateFromArtifactNonDataParts(t *testing.T) {
	artifact := Artifact{
		Kind: "generic",
		Parts: []MessagePart{
			{Kind: "text", Text: "hello"},
		},
	}

	result, ok := ExtractCartMandateFromArtifact(artifact)
	if ok {
		t.Error("expected false for artifact with text-only parts")
	}
	if result != nil {
		t.Error("expected nil result for artifact with text-only parts")
	}
}

func TestExtractCartMandateFromArtifactWrongDataKey(t *testing.T) {
	artifact := Artifact{
		Kind: "generic",
		Parts: []MessagePart{
			{Kind: "data", Data: map[string]interface{}{"other_key": "value"}},
		},
	}

	result, ok := ExtractCartMandateFromArtifact(artifact)
	if ok {
		t.Error("expected false for artifact with wrong data key")
	}
	if result != nil {
		t.Error("expected nil result for artifact with wrong data key")
	}
}

func TestExtractPaymentMandateFromMessageTextOnly(t *testing.T) {
	msg := Message{
		Kind: "message",
		Role: "user",
		Parts: []MessagePart{
			{Kind: "text", Text: "No mandate here"},
		},
	}

	result, ok := ExtractPaymentMandateFromMessage(msg)
	if ok {
		t.Error("expected false for text-only message")
	}
	if result != nil {
		t.Error("expected nil result for text-only message")
	}
}

func TestExtractPaymentMandateFromMessageNoParts(t *testing.T) {
	msg := Message{
		Kind:  "message",
		Role:  "user",
		Parts: []MessagePart{},
	}

	result, ok := ExtractPaymentMandateFromMessage(msg)
	if ok {
		t.Error("expected false for message with no parts")
	}
	if result != nil {
		t.Error("expected nil result for message with no parts")
	}
}

// ============================================================================
// Extension Helper
// ============================================================================

func TestCreateAP2ExtensionWithRoles(t *testing.T) {
	ext := CreateAP2Extension([]string{"merchant"}, false)

	if ext.URI != AP2ExtensionURI {
		t.Errorf("expected URI %s, got %s", AP2ExtensionURI, ext.URI)
	}
	if ext.Required {
		t.Error("expected required=false")
	}
	if ext.Description != "AP2 payment agent (roles: merchant)." {
		t.Errorf("unexpected description: %s", ext.Description)
	}
}

func TestCreateAP2ExtensionWithMultipleRoles(t *testing.T) {
	ext := CreateAP2Extension([]string{"merchant", "payment-processor"}, true)

	if ext.URI != AP2ExtensionURI {
		t.Errorf("expected URI %s, got %s", AP2ExtensionURI, ext.URI)
	}
	if !ext.Required {
		t.Error("expected required=true")
	}
	if ext.Description != "AP2 payment agent (roles: merchant, payment-processor)." {
		t.Errorf("unexpected description: %s", ext.Description)
	}
}

// ============================================================================
// Artifact Struct — New Fields
// ============================================================================

func TestArtifactDescriptionAndPartsFields(t *testing.T) {
	artifact := Artifact{
		Kind:        "ap2.cart",
		Name:        "Shopping Cart",
		Description: "A cart with payment options",
		Parts: []MessagePart{
			{Kind: "text", Text: "item 1"},
			{Kind: "data", Data: map[string]interface{}{"key": "value"}},
		},
	}

	if artifact.Description != "A cart with payment options" {
		t.Errorf("expected description, got %s", artifact.Description)
	}
	if len(artifact.Parts) != 2 {
		t.Fatalf("expected 2 parts, got %d", len(artifact.Parts))
	}
	if artifact.Parts[0].Kind != "text" {
		t.Errorf("expected first part kind text, got %s", artifact.Parts[0].Kind)
	}
	if artifact.Parts[1].Kind != "data" {
		t.Errorf("expected second part kind data, got %s", artifact.Parts[1].Kind)
	}
}
