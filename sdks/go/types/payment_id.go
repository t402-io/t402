package types

// PaymentIdExtensionKey is the extension key for payment ID.
const PaymentIdExtensionKey = "paymentId"

// PaymentIdExtensionInfo represents the server-declared payment identifier.
type PaymentIdExtensionInfo struct {
	ID             string            `json:"id"`
	IdempotencyKey string            `json:"idempotencyKey,omitempty"`
	GroupID        string            `json:"groupId,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

// PaymentIdExtension is the full extension structure.
type PaymentIdExtension struct {
	Info   PaymentIdExtensionInfo `json:"info"`
	Schema map[string]interface{} `json:"schema"`
}

// PaymentIdPayload is what the client echoes back.
type PaymentIdPayload struct {
	ID       string `json:"id"`
	ClientID string `json:"clientId,omitempty"`
}
