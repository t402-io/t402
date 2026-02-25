package a2a

import "time"

// A2APaymentClientOptions configures optional callbacks for the A2A payment client.
type A2APaymentClientOptions struct {
	// OnPaymentRequired is called when a task is detected as requiring payment.
	OnPaymentRequired func(requirements map[string]interface{})

	// OnPaymentSubmitted is called when a payment payload is submitted.
	OnPaymentSubmitted func(payload map[string]interface{})

	// OnPaymentCompleted is called when a payment task is completed.
	OnPaymentCompleted func(task *Task)

	// OnPaymentFailed is called when a payment fails.
	OnPaymentFailed func(err string, task *Task)
}

// A2APaymentClient provides methods for handling t402 payments in A2A client agents.
//
// It wraps the lower-level helpers from helpers.go and ap2.go into a
// convenient struct with lifecycle callbacks.
//
// Example:
//
//	client := NewA2APaymentClient(A2APaymentClientOptions{
//	    OnPaymentRequired: func(req map[string]interface{}) {
//	        fmt.Println("Payment required:", req)
//	    },
//	})
//
//	if client.RequiresPayment(task) {
//	    requirements := client.GetRequirements(task)
//	    // ... sign with mechanism ...
//	    msg := client.CreatePaymentMessage(payload, "")
//	    // Send msg via A2A
//	}
type A2APaymentClient struct {
	options A2APaymentClientOptions
}

// NewA2APaymentClient creates a new A2APaymentClient with the given options.
func NewA2APaymentClient(opts A2APaymentClientOptions) *A2APaymentClient {
	return &A2APaymentClient{options: opts}
}

// RequiresPayment checks if a task requires payment.
// If true and the OnPaymentRequired callback is set, it fires the callback.
func (c *A2APaymentClient) RequiresPayment(task *Task) bool {
	requires := IsPaymentRequired(task)
	if requires {
		requirements := GetPaymentRequired(task)
		if requirements != nil && c.options.OnPaymentRequired != nil {
			c.options.OnPaymentRequired(requirements)
		}
	}
	return requires
}

// GetRequirements extracts payment requirements from a payment-required task.
// Returns nil if the task is not in a payment-required state.
func (c *A2APaymentClient) GetRequirements(task *Task) map[string]interface{} {
	return GetPaymentRequired(task)
}

// SelectPaymentOption selects the best payment option from requirements.
// It tries to match by both network and scheme, then by network only,
// then by scheme only, and finally returns the first option as a fallback.
// Returns nil if no options are available.
func (c *A2APaymentClient) SelectPaymentOption(requirements map[string]interface{}, preferredNetwork, preferredScheme string) map[string]interface{} {
	acceptsRaw, ok := requirements["accepts"]
	if !ok {
		return nil
	}

	accepts, ok := acceptsRaw.([]interface{})
	if !ok {
		return nil
	}
	if len(accepts) == 0 {
		return nil
	}

	// Try exact match for both network and scheme
	if preferredNetwork != "" && preferredScheme != "" {
		for _, a := range accepts {
			aMap, ok := a.(map[string]interface{})
			if !ok {
				continue
			}
			if aMap["network"] == preferredNetwork && aMap["scheme"] == preferredScheme {
				return aMap
			}
		}
	}

	// Try network only
	if preferredNetwork != "" {
		for _, a := range accepts {
			aMap, ok := a.(map[string]interface{})
			if !ok {
				continue
			}
			if aMap["network"] == preferredNetwork {
				return aMap
			}
		}
	}

	// Try scheme only
	if preferredScheme != "" {
		for _, a := range accepts {
			aMap, ok := a.(map[string]interface{})
			if !ok {
				continue
			}
			if aMap["scheme"] == preferredScheme {
				return aMap
			}
		}
	}

	// Return first option
	if first, ok := accepts[0].(map[string]interface{}); ok {
		return first
	}
	return nil
}

// CreatePaymentMessage creates an A2A message submitting a payment payload.
// Delegates to CreatePaymentSubmissionMessage from helpers.go.
func (c *A2APaymentClient) CreatePaymentMessage(payload map[string]interface{}, text string) *Message {
	if text == "" {
		text = "Here is the payment authorization."
	}
	msg := CreatePaymentSubmissionMessage(payload, text)
	if c.options.OnPaymentSubmitted != nil {
		c.options.OnPaymentSubmitted(payload)
	}
	return msg
}

// ExtractEmbeddedRequirements extracts x402 payment requirements from a task's
// CartMandate artifacts (AP2 embedded flow).
// Returns nil if no CartMandate with x402 requirements is found.
func (c *A2APaymentClient) ExtractEmbeddedRequirements(task *Task) []map[string]interface{} {
	if len(task.Artifacts) == 0 {
		return nil
	}
	for _, artifact := range task.Artifacts {
		cmMap, ok := ExtractCartMandateFromArtifact(artifact)
		if !ok {
			continue
		}
		// Reconstruct a CartMandate from the map to use ExtractX402Requirements.
		// The map has "contents" with "payment_request" containing "method_data".
		mandate := cartMandateFromMap(cmMap)
		reqs, ok := ExtractX402Requirements(mandate)
		if ok {
			return reqs
		}
	}
	return nil
}

// CreateEmbeddedPaymentMessage creates an A2A message for the AP2 embedded flow.
// It wraps the payment payload inside a PaymentMandate DataPart.
func (c *A2APaymentClient) CreateEmbeddedPaymentMessage(mandateContents PaymentMandateContents, payload map[string]interface{}, userAuth, text string) *Message {
	if text == "" {
		text = "Here is the payment mandate."
	}
	mandate := CreatePaymentMandateWithX402(mandateContents, payload, userAuth)
	return &Message{
		Kind: "message",
		Role: "user",
		Parts: []MessagePart{
			{Kind: "text", Text: text},
			CreatePaymentMandateDataPart(mandate),
		},
		Metadata: map[string]interface{}{
			MetaPaymentStatus:     StatusPaymentSubmitted,
			X402MetaPaymentStatus: StatusPaymentSubmitted,
		},
	}
}

// cartMandateFromMap reconstructs a CartMandate from a map[string]interface{}.
// This is needed because ExtractCartMandateFromArtifact returns a raw map
// (from the JSON round-trip in mandateToMap), and we need a typed CartMandate
// to pass to ExtractX402Requirements.
func cartMandateFromMap(m map[string]interface{}) CartMandate {
	mandate := CartMandate{}

	contentsRaw, ok := m["contents"]
	if !ok {
		return mandate
	}
	contents, ok := contentsRaw.(map[string]interface{})
	if !ok {
		return mandate
	}

	if id, ok := contents["id"].(string); ok {
		mandate.Contents.ID = id
	}
	if mn, ok := contents["merchant_name"].(string); ok {
		mandate.Contents.MerchantName = mn
	}
	if ce, ok := contents["cart_expiry"].(string); ok {
		mandate.Contents.CartExpiry = ce
	}

	if prRaw, ok := contents["payment_request"].(map[string]interface{}); ok {
		if mdRaw, ok := prRaw["method_data"].([]interface{}); ok {
			for _, mdItem := range mdRaw {
				mdMap, ok := mdItem.(map[string]interface{})
				if !ok {
					continue
				}
				method := AP2PaymentMethodData{}
				if sm, ok := mdMap["supported_methods"].(string); ok {
					method.SupportedMethods = sm
				}
				if data, ok := mdMap["data"].(map[string]interface{}); ok {
					method.Data = data
				}
				mandate.Contents.PaymentRequest.MethodData = append(
					mandate.Contents.PaymentRequest.MethodData, method)
			}
		}
	}

	if auth, ok := m["merchant_authorization"].(string); ok {
		mandate.MerchantAuthorization = auth
	}

	return mandate
}

// nowISO returns the current time in ISO-8601 format.
// This is a package-level helper used by both client.go and server.go.
func nowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}
