package dispute

import "math/big"

// EIP-712 domain constants. chainId is fixed at 1 since the envelope is
// off-chain and the actual payment may live on a different network.
// Mirrors the offer-receipt extension precedent (specs §Signature Formats).
var (
	DomainName    = "T402Dispute"
	DomainVersion = "1"
	DomainChainID = big.NewInt(1)
)

// DisputeDomain returns the EIP-712 domain for dispute signing.
func DisputeDomain() map[string]interface{} {
	return map[string]interface{}{
		"name":    DomainName,
		"version": DomainVersion,
		"chainId": DomainChainID,
	}
}

// ResolutionDomain returns the EIP-712 domain for resolution signing.
// Same name space as DisputeDomain — they are envelopes of the same
// protocol.
func ResolutionDomain() map[string]interface{} {
	return DisputeDomain()
}

// DisputeTypes returns the EIP-712 type definition for Dispute. `reason`
// is a string (not enum) in the typed data so x_*-prefixed values flow
// through without spec rev; validators must parse against the enum at
// deserialize time.
func DisputeTypes() []map[string]string {
	return []map[string]string{
		{"name": "version", "type": "uint256"},
		{"name": "receiptHash", "type": "bytes32"},
		{"name": "reason", "type": "string"},
		{"name": "requestedAmount", "type": "uint256"},
		{"name": "validUntil", "type": "uint256"},
		{"name": "evidence", "type": "string[]"},
	}
}

// ResolutionTypes returns the EIP-712 type definition for Resolution.
func ResolutionTypes() []map[string]string {
	return []map[string]string{
		{"name": "version", "type": "uint256"},
		{"name": "disputeHash", "type": "bytes32"},
		{"name": "verdict", "type": "string"},
		{"name": "settledAmount", "type": "uint256"},
		{"name": "arbiter", "type": "address"},
		{"name": "issuedAt", "type": "uint256"},
		{"name": "refundTransaction", "type": "string"},
	}
}

// DisputePrimaryType is the EIP-712 primary type name for disputes.
const DisputePrimaryType = "Dispute"

// ResolutionPrimaryType is the EIP-712 primary type name for resolutions.
const ResolutionPrimaryType = "Resolution"

// NormalizeDisputeForSigning produces the EIP-712 message map for a
// DisputePayload, filling defaults for optional fields (empty evidence
// list, etc.).
func NormalizeDisputeForSigning(p *DisputePayload) map[string]interface{} {
	evidence := p.Evidence
	if evidence == nil {
		evidence = []string{}
	}
	return map[string]interface{}{
		"version":         big.NewInt(int64(p.Version)),
		"receiptHash":     p.ReceiptHash,
		"reason":          string(p.Reason),
		"requestedAmount": p.RequestedAmount,
		"validUntil":      big.NewInt(p.ValidUntil),
		"evidence":        evidence,
	}
}

// NormalizeResolutionForSigning produces the EIP-712 message map for a
// ResolutionPayload, filling "" for absent refundTransaction.
func NormalizeResolutionForSigning(p *ResolutionPayload) map[string]interface{} {
	return map[string]interface{}{
		"version":           big.NewInt(int64(p.Version)),
		"disputeHash":       p.DisputeHash,
		"verdict":           string(p.Verdict),
		"settledAmount":     p.SettledAmount,
		"arbiter":           p.Arbiter,
		"issuedAt":          big.NewInt(p.IssuedAt),
		"refundTransaction": p.RefundTransaction,
	}
}
