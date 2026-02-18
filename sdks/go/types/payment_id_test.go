package types

import (
	"encoding/json"
	"testing"
)

func TestPaymentIdExtensionKey(t *testing.T) {
	if PaymentIdExtensionKey != "paymentId" {
		t.Errorf("expected paymentId, got %s", PaymentIdExtensionKey)
	}
}

func TestPaymentIdExtensionInfoMarshal(t *testing.T) {
	info := PaymentIdExtensionInfo{
		ID:             "550e8400-e29b-41d4-a716-446655440000",
		IdempotencyKey: "idem-key-1",
		GroupID:        "group-1",
		Metadata:       map[string]string{"orderId": "order-123"},
	}

	data, err := json.Marshal(info)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded PaymentIdExtensionInfo
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if decoded.ID != info.ID {
		t.Errorf("expected ID %s, got %s", info.ID, decoded.ID)
	}
	if decoded.IdempotencyKey != info.IdempotencyKey {
		t.Errorf("expected IdempotencyKey %s, got %s", info.IdempotencyKey, decoded.IdempotencyKey)
	}
	if decoded.GroupID != info.GroupID {
		t.Errorf("expected GroupID %s, got %s", info.GroupID, decoded.GroupID)
	}
	if decoded.Metadata["orderId"] != "order-123" {
		t.Errorf("expected metadata orderId=order-123, got %s", decoded.Metadata["orderId"])
	}
}

func TestPaymentIdExtensionInfoOmitEmpty(t *testing.T) {
	info := PaymentIdExtensionInfo{
		ID: "test-id",
	}

	data, err := json.Marshal(info)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	// Should not contain optional fields
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if _, ok := raw["idempotencyKey"]; ok {
		t.Error("expected idempotencyKey to be omitted")
	}
	if _, ok := raw["groupId"]; ok {
		t.Error("expected groupId to be omitted")
	}
	if _, ok := raw["metadata"]; ok {
		t.Error("expected metadata to be omitted")
	}
}

func TestPaymentIdPayloadMarshal(t *testing.T) {
	payload := PaymentIdPayload{
		ID:       "test-id",
		ClientID: "client-123",
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded PaymentIdPayload
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if decoded.ID != payload.ID {
		t.Errorf("expected ID %s, got %s", payload.ID, decoded.ID)
	}
	if decoded.ClientID != payload.ClientID {
		t.Errorf("expected ClientID %s, got %s", payload.ClientID, decoded.ClientID)
	}
}

func TestPaymentIdExtensionMarshal(t *testing.T) {
	ext := PaymentIdExtension{
		Info: PaymentIdExtensionInfo{
			ID: "test-id",
		},
		Schema: map[string]interface{}{
			"type":     "object",
			"required": []string{"id"},
		},
	}

	data, err := json.Marshal(ext)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded PaymentIdExtension
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if decoded.Info.ID != "test-id" {
		t.Errorf("expected ID test-id, got %s", decoded.Info.ID)
	}
	if decoded.Schema["type"] != "object" {
		t.Errorf("expected schema type=object, got %v", decoded.Schema["type"])
	}
}
