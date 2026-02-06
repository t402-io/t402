package a2a

// IsPaymentRequired checks if a task is in a payment-required state.
func IsPaymentRequired(task *Task) bool {
	if task.Status.State != StateInputRequired {
		return false
	}
	if task.Status.Message == nil || task.Status.Message.Metadata == nil {
		return false
	}
	status, ok := task.Status.Message.Metadata[MetaPaymentStatus].(string)
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
	status, ok := task.Status.Message.Metadata[MetaPaymentStatus].(string)
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
	status, ok := task.Status.Message.Metadata[MetaPaymentStatus].(string)
	return ok && status == StatusPaymentFailed
}

// GetPaymentRequired extracts payment requirements from a task.
func GetPaymentRequired(task *Task) map[string]interface{} {
	if !IsPaymentRequired(task) {
		return nil
	}
	req, ok := task.Status.Message.Metadata[MetaPaymentRequired].(map[string]interface{})
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
	receipts, ok := task.Status.Message.Metadata[MetaPaymentReceipts].([]interface{})
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
	status, ok := msg.Metadata[MetaPaymentStatus].(string)
	if !ok || status != StatusPaymentSubmitted {
		return false
	}
	_, hasPayload := msg.Metadata[MetaPaymentPayload]
	return hasPayload
}

// ExtractPaymentPayload extracts a payment payload from a message.
func ExtractPaymentPayload(msg *Message) map[string]interface{} {
	if msg.Metadata == nil {
		return nil
	}
	payload, ok := msg.Metadata[MetaPaymentPayload].(map[string]interface{})
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
	return &Message{
		Kind: "message",
		Role: "agent",
		Parts: []MessagePart{
			{Kind: "text", Text: text},
		},
		Metadata: map[string]interface{}{
			MetaPaymentStatus:   StatusPaymentRequired,
			MetaPaymentRequired: paymentRequired,
		},
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
			MetaPaymentStatus:  StatusPaymentSubmitted,
			MetaPaymentPayload: paymentPayload,
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
			MetaPaymentStatus:   StatusPaymentCompleted,
			MetaPaymentReceipts: receipts,
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
			MetaPaymentStatus:   StatusPaymentFailed,
			MetaPaymentError:    errorCode,
			MetaPaymentReceipts: receipts,
		},
	}
}

// CreateT402Extension creates a T402 extension declaration for agent cards.
func CreateT402Extension(required bool) Extension {
	return Extension{
		URI:         T402ExtensionURI,
		Description: "Supports payments using the t402 protocol for on-chain settlement.",
		Required:    required,
	}
}
