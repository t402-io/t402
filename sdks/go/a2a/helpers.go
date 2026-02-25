package a2a

import "strings"

// getMetaString retrieves a string value from metadata, checking the t402 key first,
// then falling back to the x402 key (dual-namespace support).
func getMetaString(metadata map[string]interface{}, t402Key, x402Key string) (string, bool) {
	if v, ok := metadata[t402Key].(string); ok {
		return v, true
	}
	if v, ok := metadata[x402Key].(string); ok {
		return v, true
	}
	return "", false
}

// getMetaValue retrieves a value from metadata, checking the t402 key first,
// then falling back to the x402 key (dual-namespace support).
func getMetaValue(metadata map[string]interface{}, t402Key, x402Key string) (interface{}, bool) {
	if v, ok := metadata[t402Key]; ok {
		return v, true
	}
	if v, ok := metadata[x402Key]; ok {
		return v, true
	}
	return nil, false
}

// IsPaymentRequired checks if a task is in a payment-required state.
func IsPaymentRequired(task *Task) bool {
	if task.Status.State != StateInputRequired {
		return false
	}
	if task.Status.Message == nil || task.Status.Message.Metadata == nil {
		return false
	}
	status, ok := getMetaString(task.Status.Message.Metadata, MetaPaymentStatus, X402MetaPaymentStatus)
	return ok && status == StatusPaymentRequired
}

// IsPaymentCompleted checks if a task has completed payment.
func IsPaymentCompleted(task *Task) bool {
	if task.Status.State != StateCompleted {
		return false
	}
	if task.Status.Message == nil || task.Status.Message.Metadata == nil {
		return false
	}
	status, ok := getMetaString(task.Status.Message.Metadata, MetaPaymentStatus, X402MetaPaymentStatus)
	return ok && status == StatusPaymentCompleted
}

// IsPaymentFailed checks if a task has failed payment.
func IsPaymentFailed(task *Task) bool {
	if task.Status.State != StateFailed {
		return false
	}
	if task.Status.Message == nil || task.Status.Message.Metadata == nil {
		return false
	}
	status, ok := getMetaString(task.Status.Message.Metadata, MetaPaymentStatus, X402MetaPaymentStatus)
	return ok && status == StatusPaymentFailed
}

// GetPaymentRequired extracts payment requirements from a task.
func GetPaymentRequired(task *Task) map[string]interface{} {
	if !IsPaymentRequired(task) {
		return nil
	}
	val, ok := getMetaValue(task.Status.Message.Metadata, MetaPaymentRequired, X402MetaPaymentRequired)
	if !ok {
		return nil
	}
	req, ok := val.(map[string]interface{})
	if !ok {
		return nil
	}
	return req
}

// GetPaymentReceipts extracts payment receipts from a task.
func GetPaymentReceipts(task *Task) []interface{} {
	if task.Status.Message == nil || task.Status.Message.Metadata == nil {
		return nil
	}
	val, ok := getMetaValue(task.Status.Message.Metadata, MetaPaymentReceipts, X402MetaPaymentReceipts)
	if !ok {
		return nil
	}
	receipts, ok := val.([]interface{})
	if !ok {
		return nil
	}
	return receipts
}

// HasPaymentPayload checks if a message contains a payment submission.
func HasPaymentPayload(msg *Message) bool {
	if msg.Metadata == nil {
		return false
	}
	status, ok := getMetaString(msg.Metadata, MetaPaymentStatus, X402MetaPaymentStatus)
	if !ok || status != StatusPaymentSubmitted {
		return false
	}
	_, hasT402 := msg.Metadata[MetaPaymentPayload]
	_, hasX402 := msg.Metadata[X402MetaPaymentPayload]
	return hasT402 || hasX402
}

// ExtractPaymentPayload extracts a payment payload from a message.
func ExtractPaymentPayload(msg *Message) map[string]interface{} {
	if msg.Metadata == nil {
		return nil
	}
	val, ok := getMetaValue(msg.Metadata, MetaPaymentPayload, X402MetaPaymentPayload)
	if !ok {
		return nil
	}
	payload, ok := val.(map[string]interface{})
	if !ok {
		return nil
	}
	return payload
}

// CreatePaymentRequiredMessage creates an agent message requesting payment.
func CreatePaymentRequiredMessage(paymentRequired interface{}, text string) *Message {
	if text == "" {
		text = "Payment is required to complete this request."
	}
	metadata := map[string]interface{}{
		MetaPaymentStatus:       StatusPaymentRequired,
		MetaPaymentRequired:     paymentRequired,
		X402MetaPaymentStatus:   StatusPaymentRequired,
		X402MetaPaymentRequired: DowngradeRequirementsToX402(paymentRequired),
	}
	// If downgrade returned nil, remove the x402 required key to avoid nil values.
	if metadata[X402MetaPaymentRequired] == nil {
		metadata[X402MetaPaymentRequired] = paymentRequired
	}
	return &Message{
		Kind: "message",
		Role: "agent",
		Parts: []MessagePart{
			{Kind: "text", Text: text},
		},
		Metadata: metadata,
	}
}

// CreatePaymentSubmissionMessage creates a user message submitting payment.
func CreatePaymentSubmissionMessage(paymentPayload interface{}, text string) *Message {
	if text == "" {
		text = "Here is the payment authorization."
	}
	return &Message{
		Kind: "message",
		Role: "user",
		Parts: []MessagePart{
			{Kind: "text", Text: text},
		},
		Metadata: map[string]interface{}{
			MetaPaymentStatus:      StatusPaymentSubmitted,
			MetaPaymentPayload:     paymentPayload,
			X402MetaPaymentStatus:  StatusPaymentSubmitted,
			X402MetaPaymentPayload: paymentPayload,
		},
	}
}

// CreatePaymentCompletedMessage creates an agent message confirming payment.
func CreatePaymentCompletedMessage(receipts interface{}, text string) *Message {
	if text == "" {
		text = "Payment successful."
	}
	return &Message{
		Kind: "message",
		Role: "agent",
		Parts: []MessagePart{
			{Kind: "text", Text: text},
		},
		Metadata: map[string]interface{}{
			MetaPaymentStatus:       StatusPaymentCompleted,
			MetaPaymentReceipts:     receipts,
			X402MetaPaymentStatus:   StatusPaymentCompleted,
			X402MetaPaymentReceipts: receipts,
		},
	}
}

// CreatePaymentFailedMessage creates an agent message reporting payment failure.
func CreatePaymentFailedMessage(receipts interface{}, errorCode string, text string) *Message {
	if text == "" {
		text = "Payment failed."
	}
	return &Message{
		Kind: "message",
		Role: "agent",
		Parts: []MessagePart{
			{Kind: "text", Text: text},
		},
		Metadata: map[string]interface{}{
			MetaPaymentStatus:       StatusPaymentFailed,
			MetaPaymentError:        errorCode,
			MetaPaymentReceipts:     receipts,
			X402MetaPaymentStatus:   StatusPaymentFailed,
			X402MetaPaymentError:    MapT402ErrorToX402(errorCode),
			X402MetaPaymentReceipts: receipts,
		},
	}
}

// CreateT402Extension creates a T402 extension declaration for agent cards.
func CreateT402Extension(required bool) Extension {
	return Extension{
		URI:         T402ExtensionURI,
		Description: "T402 multi-chain payment protocol (12 mechanisms, 44 networks).",
		Required:    required,
	}
}

// CreateX402Extension creates an x402 compatibility extension declaration for agent cards.
func CreateX402Extension(required bool) Extension {
	return Extension{
		URI:         X402ExtensionURI,
		Description: "x402 v0.2 payment extension (EVM compatibility layer).",
		Required:    required,
	}
}

// MapT402ErrorToX402 maps a T402 error code to its x402 v0.2 equivalent.
// Returns "UNKNOWN_ERROR" if the code is not recognized.
func MapT402ErrorToX402(code string) string {
	if mapped, ok := t402ToX402ErrorMap[code]; ok {
		return mapped
	}
	return "UNKNOWN_ERROR"
}

// DowngradeRequirementsToX402 converts T402 V2 payment requirements to x402 V1 format.
// Only EVM networks with scheme "exact" are included. Returns nil if no compatible entries exist.
func DowngradeRequirementsToX402(requirements interface{}) map[string]interface{} {
	reqMap, ok := requirements.(map[string]interface{})
	if !ok {
		return nil
	}

	acceptsRaw, ok := reqMap["accepts"]
	if !ok {
		return nil
	}

	accepts, ok := acceptsRaw.([]interface{})
	if !ok {
		return nil
	}

	var downgraded []interface{}
	for _, entry := range accepts {
		entryMap, ok := entry.(map[string]interface{})
		if !ok {
			continue
		}
		network, _ := entryMap["network"].(string)
		scheme, _ := entryMap["scheme"].(string)
		if !strings.HasPrefix(network, "eip155:") || scheme != "exact" {
			continue
		}
		flatName, ok := CAIP2ToFlatName[network]
		if !ok {
			continue
		}
		downgradedEntry := make(map[string]interface{})
		for k, v := range entryMap {
			downgradedEntry[k] = v
		}
		downgradedEntry["network"] = flatName
		downgraded = append(downgraded, downgradedEntry)
	}

	if len(downgraded) == 0 {
		return nil
	}

	return map[string]interface{}{
		"x402Version": 1,
		"accepts":     downgraded,
	}
}

// IsStandaloneFlow checks if a task is using standalone A2A payment flow
// (payment metadata on the task status message, not embedded in artifacts).
func IsStandaloneFlow(task *Task) bool {
	if task.Status.Message == nil || task.Status.Message.Metadata == nil {
		return false
	}
	_, ok := getMetaString(task.Status.Message.Metadata, MetaPaymentStatus, X402MetaPaymentStatus)
	return ok
}

// IsEmbeddedFlow checks if a task has payment metadata embedded in artifacts.
func IsEmbeddedFlow(task *Task) bool {
	for _, artifact := range task.Artifacts {
		if artifact.Metadata == nil {
			continue
		}
		if _, ok := getMetaString(artifact.Metadata, MetaPaymentStatus, X402MetaPaymentStatus); ok {
			return true
		}
	}
	return false
}
