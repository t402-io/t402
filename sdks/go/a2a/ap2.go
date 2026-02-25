package a2a

import (
	"encoding/json"
	"strings"
)

// AP2ExtensionURI is the URI for the AP2 A2A extension.
const AP2ExtensionURI = "https://github.com/google-agentic-commerce/ap2/tree/v0.1"

// X402PaymentMethod is the W3C Payment Method identifier for x402/t402.
const X402PaymentMethod = "https://www.x402.org/"

// AP2 data keys for embedding mandates and receipts in DataParts.
const (
	AP2DataKeyIntentMandate  = "ap2.mandates.IntentMandate"
	AP2DataKeyCartMandate    = "ap2.mandates.CartMandate"
	AP2DataKeyPaymentMandate = "ap2.mandates.PaymentMandate"
	AP2DataKeyPaymentReceipt = "ap2.PaymentReceipt"
)

// --- W3C Payment Request types (AP2-prefixed to avoid collision) ---

// AP2PaymentCurrencyAmount represents a currency amount per the W3C Payment Request API.
type AP2PaymentCurrencyAmount struct {
	Currency string  `json:"currency"`
	Value    float64 `json:"value"`
}

// AP2PaymentItem represents a payment line item.
type AP2PaymentItem struct {
	Label   string                   `json:"label"`
	Amount  AP2PaymentCurrencyAmount `json:"amount"`
	Pending bool                     `json:"pending,omitempty"`
}

// AP2PaymentMethodData describes a supported payment method.
type AP2PaymentMethodData struct {
	SupportedMethods string                 `json:"supported_methods"`
	Data             map[string]interface{} `json:"data,omitempty"`
}

// AP2PaymentDetailsInit contains the details of a payment request.
type AP2PaymentDetailsInit struct {
	ID           string           `json:"id"`
	DisplayItems []AP2PaymentItem `json:"display_items"`
	Total        AP2PaymentItem   `json:"total"`
}

// AP2PaymentRequest is a W3C-style payment request.
type AP2PaymentRequest struct {
	MethodData []AP2PaymentMethodData `json:"method_data"`
	Details    AP2PaymentDetailsInit  `json:"details"`
}

// AP2PaymentResponse is a W3C-style payment response.
type AP2PaymentResponse struct {
	RequestID  string                 `json:"request_id"`
	MethodName string                 `json:"method_name"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

// --- AP2 Mandate types ---

// IntentMandate describes a user's purchase intent.
type IntentMandate struct {
	NaturalLanguageDescription   string   `json:"natural_language_description"`
	UserCartConfirmationRequired bool     `json:"user_cart_confirmation_required"`
	Merchants                    []string `json:"merchants,omitempty"`
	SKUs                         []string `json:"skus,omitempty"`
	RequiresRefundability        bool     `json:"requires_refundability,omitempty"`
	IntentExpiry                 string   `json:"intent_expiry"`
}

// CartContents describes a shopping cart.
type CartContents struct {
	ID                           string            `json:"id"`
	UserCartConfirmationRequired bool              `json:"user_cart_confirmation_required"`
	PaymentRequest               AP2PaymentRequest `json:"payment_request"`
	CartExpiry                   string            `json:"cart_expiry"`
	MerchantName                 string            `json:"merchant_name"`
}

// CartMandate wraps cart contents with optional merchant authorization.
type CartMandate struct {
	Contents              CartContents `json:"contents"`
	MerchantAuthorization string       `json:"merchant_authorization,omitempty"`
}

// PaymentMandateContents describes a payment mandate.
type PaymentMandateContents struct {
	PaymentMandateID    string             `json:"payment_mandate_id"`
	PaymentDetailsID    string             `json:"payment_details_id"`
	PaymentDetailsTotal AP2PaymentItem     `json:"payment_details_total"`
	PaymentResponse     AP2PaymentResponse `json:"payment_response"`
	MerchantAgent       string             `json:"merchant_agent"`
	Timestamp           string             `json:"timestamp"`
}

// PaymentMandate wraps payment mandate contents with optional user authorization.
type PaymentMandate struct {
	PaymentMandateContents PaymentMandateContents `json:"payment_mandate_contents"`
	UserAuthorization      string                 `json:"user_authorization,omitempty"`
}

// AP2PaymentReceipt represents a payment receipt.
type AP2PaymentReceipt struct {
	PaymentMandateID string                   `json:"payment_mandate_id"`
	Timestamp        string                   `json:"timestamp"`
	PaymentID        string                   `json:"payment_id"`
	Amount           AP2PaymentCurrencyAmount `json:"amount"`
	PaymentStatus    map[string]interface{}   `json:"payment_status"`
}

// --- Bridge functions ---

// CreateCartMandateWithX402 creates a CartMandate with x402 requirements embedded
// in the payment request method data. Existing non-x402 methods are preserved.
func CreateCartMandateWithX402(contents CartContents, requirements []map[string]interface{}, merchantAuth string) CartMandate {
	var methods []AP2PaymentMethodData
	for _, m := range contents.PaymentRequest.MethodData {
		if m.SupportedMethods != X402PaymentMethod {
			methods = append(methods, m)
		}
	}
	methods = append(methods, AP2PaymentMethodData{
		SupportedMethods: X402PaymentMethod,
		Data:             map[string]interface{}{"requirements": requirements},
	})
	contents.PaymentRequest.MethodData = methods
	return CartMandate{Contents: contents, MerchantAuthorization: merchantAuth}
}

// ExtractX402Requirements extracts x402 requirements from a CartMandate.
// Returns the requirements slice and true if found, or nil and false otherwise.
func ExtractX402Requirements(mandate CartMandate) ([]map[string]interface{}, bool) {
	for _, m := range mandate.Contents.PaymentRequest.MethodData {
		if m.SupportedMethods == X402PaymentMethod {
			if reqs, ok := m.Data["requirements"]; ok {
				if reqSlice, ok := reqs.([]interface{}); ok {
					var result []map[string]interface{}
					for _, r := range reqSlice {
						if rm, ok := r.(map[string]interface{}); ok {
							result = append(result, rm)
						}
					}
					return result, true
				}
				if reqSlice, ok := reqs.([]map[string]interface{}); ok {
					return reqSlice, true
				}
			}
			return nil, false
		}
	}
	return nil, false
}

// CreatePaymentMandateWithX402 creates a PaymentMandate with an x402 payload
// embedded in the payment response.
func CreatePaymentMandateWithX402(contents PaymentMandateContents, payload map[string]interface{}, userAuth string) PaymentMandate {
	contents.PaymentResponse.MethodName = X402PaymentMethod
	contents.PaymentResponse.Details = payload
	return PaymentMandate{PaymentMandateContents: contents, UserAuthorization: userAuth}
}

// ExtractX402Payload extracts the x402 payload from a PaymentMandate.
// Returns the payload map and true if found, or nil and false otherwise.
func ExtractX402Payload(mandate PaymentMandate) (map[string]interface{}, bool) {
	if mandate.PaymentMandateContents.PaymentResponse.MethodName != X402PaymentMethod {
		return nil, false
	}
	if mandate.PaymentMandateContents.PaymentResponse.Details == nil {
		return nil, false
	}
	return mandate.PaymentMandateContents.PaymentResponse.Details, true
}

// CreateAP2Extension creates an AP2 extension declaration for agent cards.
func CreateAP2Extension(roles []string, required bool) Extension {
	desc := "AP2 payment agent (roles: " + strings.Join(roles, ", ") + ")."
	return Extension{URI: AP2ExtensionURI, Description: desc, Required: required}
}

// CreateCartMandateDataPart creates a DataPart (MessagePart) containing a CartMandate.
func CreateCartMandateDataPart(mandate CartMandate) MessagePart {
	return MessagePart{
		Kind: "data",
		Data: map[string]interface{}{AP2DataKeyCartMandate: mandateToMap(mandate)},
	}
}

// CreatePaymentMandateDataPart creates a DataPart (MessagePart) containing a PaymentMandate.
func CreatePaymentMandateDataPart(mandate PaymentMandate) MessagePart {
	return MessagePart{
		Kind: "data",
		Data: map[string]interface{}{AP2DataKeyPaymentMandate: mandateToMap(mandate)},
	}
}

// CreateIntentMandateDataPart creates a DataPart (MessagePart) containing an IntentMandate.
func CreateIntentMandateDataPart(mandate IntentMandate) MessagePart {
	return MessagePart{
		Kind: "data",
		Data: map[string]interface{}{AP2DataKeyIntentMandate: mandateToMap(mandate)},
	}
}

// CreatePaymentReceiptDataPart creates a DataPart (MessagePart) containing a PaymentReceipt.
func CreatePaymentReceiptDataPart(receipt AP2PaymentReceipt) MessagePart {
	return MessagePart{
		Kind: "data",
		Data: map[string]interface{}{AP2DataKeyPaymentReceipt: mandateToMap(receipt)},
	}
}

// ExtractCartMandateFromArtifact extracts a CartMandate map from an Artifact's parts.
// Returns the CartMandate as a map and true if found, or nil and false otherwise.
func ExtractCartMandateFromArtifact(artifact Artifact) (map[string]interface{}, bool) {
	for _, part := range artifact.Parts {
		if part.Kind == "data" && part.Data != nil {
			if cm, ok := part.Data[AP2DataKeyCartMandate]; ok {
				if cmMap, ok := cm.(map[string]interface{}); ok {
					return cmMap, true
				}
			}
		}
	}
	return nil, false
}

// ExtractPaymentMandateFromMessage extracts a PaymentMandate map from a Message's parts.
// Returns the PaymentMandate as a map and true if found, or nil and false otherwise.
func ExtractPaymentMandateFromMessage(msg Message) (map[string]interface{}, bool) {
	for _, part := range msg.Parts {
		if part.Kind == "data" && part.Data != nil {
			if pm, ok := part.Data[AP2DataKeyPaymentMandate]; ok {
				if pmMap, ok := pm.(map[string]interface{}); ok {
					return pmMap, true
				}
			}
		}
	}
	return nil, false
}

// PaymentExtensionOptions configures which payment extensions to include in an agent card.
type PaymentExtensionOptions struct {
	AP2Roles     []string
	T402Required bool
	X402Required bool
	AP2Required  bool
}

// CreatePaymentExtensions composes an array of payment extensions for agent cards.
// Always includes t402 and x402 extensions; optionally includes AP2 if roles are specified.
func CreatePaymentExtensions(options PaymentExtensionOptions) []Extension {
	extensions := []Extension{
		CreateT402Extension(options.T402Required),
		CreateX402Extension(options.X402Required),
	}
	if len(options.AP2Roles) > 0 {
		extensions = append(extensions, CreateAP2Extension(options.AP2Roles, options.AP2Required))
	}
	return extensions
}

// GetPaymentExtensionHeaders returns the X-A2A-Extensions header map for payment extensions.
// Always includes the x402 extension URI; optionally includes the AP2 extension URI.
func GetPaymentExtensionHeaders(includeAP2 bool) map[string]string {
	uris := X402ExtensionURI
	if includeAP2 {
		uris = uris + ", " + AP2ExtensionURI
	}
	return map[string]string{ExtensionsHeader: uris}
}

// mandateToMap converts a struct to a map[string]interface{} via JSON round-trip.
func mandateToMap(v interface{}) map[string]interface{} {
	b, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err != nil {
		return nil
	}
	return m
}
