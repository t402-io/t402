// Package offerreceipt implements the Offer and Receipt extension for t402.
//
// Offers are cryptographic commitments from the server to payment terms.
// Receipts are cryptographic confirmations of payment and service delivery.
// Both support EIP-712 signing format.
package offerreceipt

// ExtensionKey is the key used in extensions maps.
const ExtensionKey = "offer-receipt"

// SignatureFormat identifies the signing format.
type SignatureFormat string

const (
	FormatEIP712 SignatureFormat = "eip712"
	FormatJWS    SignatureFormat = "jws"
)

// OfferPayload contains the canonical offer fields for signing.
type OfferPayload struct {
	Version     int    `json:"version"`
	ResourceURL string `json:"resourceUrl"`
	Scheme      string `json:"scheme"`
	Network     string `json:"network"`
	Asset       string `json:"asset"`
	PayTo       string `json:"payTo"`
	Amount      string `json:"amount"`
	ValidUntil  int64  `json:"validUntil,omitempty"` // Unix timestamp, 0 = no expiry
}

// ReceiptPayload contains the canonical receipt fields for signing.
type ReceiptPayload struct {
	Version     int    `json:"version"`
	Network     string `json:"network"`
	ResourceURL string `json:"resourceUrl"`
	Payer       string `json:"payer"`
	IssuedAt    int64  `json:"issuedAt"` // Unix timestamp (seconds)
	Transaction string `json:"transaction,omitempty"`
}

// SignedOffer is a signed offer in EIP-712 format.
type SignedOffer struct {
	Format      SignatureFormat `json:"format"`
	Payload     *OfferPayload  `json:"payload,omitempty"` // Present for EIP-712
	Signature   string         `json:"signature"`
	AcceptIndex *int           `json:"acceptIndex,omitempty"`
}

// SignedReceipt is a signed receipt in EIP-712 format.
type SignedReceipt struct {
	Format    SignatureFormat `json:"format"`
	Payload   *ReceiptPayload `json:"payload,omitempty"` // Present for EIP-712
	Signature string          `json:"signature"`
}

// RequirementsExtension is the extension data in 402 responses.
type RequirementsExtension struct {
	Info struct {
		Offers []SignedOffer `json:"offers"`
	} `json:"info"`
}

// SettlementExtension is the extension data in success responses.
type SettlementExtension struct {
	Info struct {
		Receipt SignedReceipt `json:"receipt"`
	} `json:"info"`
}
