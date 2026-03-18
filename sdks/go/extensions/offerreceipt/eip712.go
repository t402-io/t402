package offerreceipt

import "math/big"

// EIP-712 domain constants. chainId is fixed at 1 (off-chain signing).
var (
	OfferDomainName    = "t402 offer"
	ReceiptDomainName  = "t402 receipt"
	DomainVersion      = "1"
	DomainChainID      = big.NewInt(1)
)

// OfferDomain returns the EIP-712 domain for offer signing.
func OfferDomain() map[string]interface{} {
	return map[string]interface{}{
		"name":    OfferDomainName,
		"version": DomainVersion,
		"chainId": DomainChainID,
	}
}

// ReceiptDomain returns the EIP-712 domain for receipt signing.
func ReceiptDomain() map[string]interface{} {
	return map[string]interface{}{
		"name":    ReceiptDomainName,
		"version": DomainVersion,
		"chainId": DomainChainID,
	}
}

// OfferTypes returns the EIP-712 type definition for Offer.
func OfferTypes() []map[string]string {
	return []map[string]string{
		{"name": "version", "type": "uint256"},
		{"name": "resourceUrl", "type": "string"},
		{"name": "scheme", "type": "string"},
		{"name": "network", "type": "string"},
		{"name": "asset", "type": "string"},
		{"name": "payTo", "type": "string"},
		{"name": "amount", "type": "string"},
		{"name": "validUntil", "type": "uint256"},
	}
}

// ReceiptTypes returns the EIP-712 type definition for Receipt.
func ReceiptTypes() []map[string]string {
	return []map[string]string{
		{"name": "version", "type": "uint256"},
		{"name": "network", "type": "string"},
		{"name": "resourceUrl", "type": "string"},
		{"name": "payer", "type": "string"},
		{"name": "issuedAt", "type": "uint256"},
		{"name": "transaction", "type": "string"},
	}
}

// NormalizeOfferForSigning converts an OfferPayload to a map for EIP-712 signing.
// Optional fields use 0 when absent.
func NormalizeOfferForSigning(p *OfferPayload) map[string]interface{} {
	validUntil := p.ValidUntil
	if validUntil == 0 {
		validUntil = 0
	}
	return map[string]interface{}{
		"version":     big.NewInt(int64(p.Version)),
		"resourceUrl": p.ResourceURL,
		"scheme":      p.Scheme,
		"network":     p.Network,
		"asset":       p.Asset,
		"payTo":       p.PayTo,
		"amount":      p.Amount,
		"validUntil":  big.NewInt(validUntil),
	}
}

// NormalizeReceiptForSigning converts a ReceiptPayload to a map for EIP-712 signing.
// Optional fields use "" when absent.
func NormalizeReceiptForSigning(p *ReceiptPayload) map[string]interface{} {
	tx := p.Transaction
	return map[string]interface{}{
		"version":     big.NewInt(int64(p.Version)),
		"network":     p.Network,
		"resourceUrl": p.ResourceURL,
		"payer":       p.Payer,
		"issuedAt":    big.NewInt(p.IssuedAt),
		"transaction": tx,
	}
}
