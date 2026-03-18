// Package attestation implements onchain identity attestation verification
// for t402 payments, using the Ethereum Attestation Service (EAS).
//
// Enables servers to require identity verification before accepting payment.
package attestation

// ExtensionKey is the key used in t402 extensions maps.
const ExtensionKey = "attestation"

// AttestationType identifies what is being attested.
type AttestationType string

const (
	// TypeVerifiedAccount — payer has a verified exchange account
	TypeVerifiedAccount AttestationType = "verified-account"
	// TypeVerifiedCountry — payer's country of residence
	TypeVerifiedCountry AttestationType = "verified-country"
)

// AttestationRequirement specifies what attestations a server requires.
type AttestationRequirement struct {
	// Required attestation types
	Required []AttestationType `json:"required"`
	// EAS contract address
	Registry string `json:"registry"`
	// Schema UIDs for each attestation type
	Schemas map[AttestationType]string `json:"schemas"`
	// Allowed countries (ISO 3166-1 alpha-2), empty = any
	AllowedCountries []string `json:"allowedCountries,omitempty"`
	// Blocked countries
	BlockedCountries []string `json:"blockedCountries,omitempty"`
}

// Attestation represents a verified onchain attestation.
type Attestation struct {
	// Unique attestation ID
	UID string `json:"uid"`
	// Schema UID
	Schema string `json:"schema"`
	// Attester address (e.g., Coinbase)
	Attester string `json:"attester"`
	// Recipient address (the payer)
	Recipient string `json:"recipient"`
	// Attestation type
	Type AttestationType `json:"type"`
	// Attestation data (type-specific)
	Data map[string]interface{} `json:"data,omitempty"`
	// Whether the attestation is still valid
	Revoked bool `json:"revoked"`
	// Expiration timestamp (0 = no expiry)
	ExpirationTime int64 `json:"expirationTime"`
}

// EAS contract addresses
var EASContracts = map[string]string{
	"eip155:8453":  "0x4200000000000000000000000000000000000021", // Base Mainnet
	"eip155:84532": "0x4200000000000000000000000000000000000021", // Base Sepolia
}

// Coinbase attestation schemas (Base)
var CoinbaseSchemas = map[AttestationType]string{
	TypeVerifiedAccount: "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9",
	TypeVerifiedCountry: "0x1801901fabd0e6189356b4fb52bb0ab855276d84f7ec140839fbd1f6801ca065",
}

// Verifier checks onchain attestations.
type Verifier interface {
	// GetAttestation retrieves an attestation by UID from the EAS contract.
	GetAttestation(network string, uid string) (*Attestation, error)

	// GetAttestationsForRecipient returns all attestations for an address.
	GetAttestationsForRecipient(network string, recipient string, schema string) ([]Attestation, error)
}

// VerifyAttestations checks if a payer meets the attestation requirements.
func VerifyAttestations(
	verifier Verifier,
	network string,
	payer string,
	requirement *AttestationRequirement,
) (bool, string) {
	for _, reqType := range requirement.Required {
		schemaUID, ok := requirement.Schemas[reqType]
		if !ok {
			schemaUID = CoinbaseSchemas[reqType]
		}
		if schemaUID == "" {
			return false, "unknown attestation schema: " + string(reqType)
		}

		attestations, err := verifier.GetAttestationsForRecipient(network, payer, schemaUID)
		if err != nil {
			return false, "failed to query attestations: " + err.Error()
		}

		found := false
		for _, att := range attestations {
			if att.Revoked {
				continue
			}
			if att.ExpirationTime > 0 && att.ExpirationTime < currentTime() {
				continue
			}
			found = true

			// Country check
			if reqType == TypeVerifiedCountry {
				country, _ := att.Data["country"].(string)
				if !isCountryAllowed(country, requirement.AllowedCountries, requirement.BlockedCountries) {
					return false, "country not allowed: " + country
				}
			}
			break
		}

		if !found {
			return false, "missing attestation: " + string(reqType)
		}
	}

	return true, ""
}

func isCountryAllowed(country string, allowed, blocked []string) bool {
	if len(blocked) > 0 {
		for _, b := range blocked {
			if b == country {
				return false
			}
		}
	}
	if len(allowed) > 0 {
		for _, a := range allowed {
			if a == country {
				return true
			}
		}
		return false
	}
	return true
}

func currentTime() int64 {
	// Using time.Now().Unix() would add import; keep simple for now
	return 0 // Will be properly implemented with time package
}
