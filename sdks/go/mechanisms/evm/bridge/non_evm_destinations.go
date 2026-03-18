package bridge

// Non-EVM destination support for USDT0 bridging via LayerZero.
// Enables bridging from any EVM source chain to Solana, TON, or TRON.

// LayerZero Endpoint IDs for non-EVM destinations
const (
	// Solana endpoint ID
	EndpointSolana = 30168
	// TON endpoint ID
	EndpointTON = 30343
	// TRON endpoint ID
	EndpointTRON = 30420
)

// NonEvmDestination describes a non-EVM bridge target.
type NonEvmDestination struct {
	// LayerZero endpoint ID
	EndpointID uint32
	// Human-readable name
	Name string
	// CAIP-2 network identifier
	Network string
	// Address encoding format
	AddressFormat AddressFormat
}

// AddressFormat describes how to encode a destination address.
type AddressFormat int

const (
	// AddressBase58 is Solana's base58-encoded public key
	AddressBase58 AddressFormat = iota
	// AddressRaw is a raw 32-byte address (TON)
	AddressRaw
	// AddressHex is a hex-encoded address (TRON's base58check → hex conversion)
	AddressHex
)

// NonEvmDestinations maps network identifiers to bridge configurations.
var NonEvmDestinations = map[string]NonEvmDestination{
	"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": {
		EndpointID:    EndpointSolana,
		Name:          "Solana",
		Network:       "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		AddressFormat: AddressBase58,
	},
	"ton:mainnet": {
		EndpointID:    EndpointTON,
		Name:          "TON",
		Network:       "ton:mainnet",
		AddressFormat: AddressRaw,
	},
	"tron:mainnet": {
		EndpointID:    EndpointTRON,
		Name:          "TRON",
		Network:       "tron:mainnet",
		AddressFormat: AddressHex,
	},
}

// BridgeToNonEvmParams contains parameters for bridging to a non-EVM chain.
type BridgeToNonEvmParams struct {
	// Source EVM network (e.g., "eip155:1")
	SourceNetwork string
	// Destination non-EVM network (e.g., "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
	DestNetwork string
	// Token to bridge ("USDT0" or "XAUT0")
	Token string
	// Amount in smallest unit
	Amount string
	// Recipient address on destination chain (native format)
	Recipient string
}

// EncodeRecipientBytes32 encodes a destination address to bytes32 for LayerZero.
// The encoding depends on the destination chain's address format.
func EncodeRecipientBytes32(address string, format AddressFormat) ([32]byte, error) {
	var result [32]byte

	switch format {
	case AddressBase58:
		// Solana: base58-decode the public key, left-pad to 32 bytes
		// The decoded key is already 32 bytes
		decoded, err := base58Decode(address)
		if err != nil {
			return result, err
		}
		copy(result[32-len(decoded):], decoded)

	case AddressRaw:
		// TON: workchain:hash format, extract 32-byte hash
		// For simplicity, assume raw hex input
		decoded, err := hexDecode(address)
		if err != nil {
			return result, err
		}
		copy(result[32-len(decoded):], decoded)

	case AddressHex:
		// TRON: convert base58check to 20-byte hex, left-pad to 32 bytes
		decoded, err := hexDecode(address)
		if err != nil {
			return result, err
		}
		copy(result[32-len(decoded):], decoded)
	}

	return result, nil
}

// base58Decode is a minimal base58 decoder.
func base58Decode(s string) ([]byte, error) {
	alphabet := "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
	result := make([]byte, 0)
	for _, c := range s {
		carry := 0
		for i := range alphabet {
			if rune(alphabet[i]) == c {
				carry = i
				break
			}
		}
		for j := range result {
			carry += int(result[j]) * 58
			result[j] = byte(carry & 0xff)
			carry >>= 8
		}
		for carry > 0 {
			result = append(result, byte(carry&0xff))
			carry >>= 8
		}
	}
	// Reverse
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result, nil
}

// hexDecode decodes a hex string (with optional 0x prefix).
func hexDecode(s string) ([]byte, error) {
	if len(s) >= 2 && s[:2] == "0x" {
		s = s[2:]
	}
	result := make([]byte, len(s)/2)
	for i := 0; i < len(s); i += 2 {
		b := hexVal(s[i])<<4 | hexVal(s[i+1])
		result[i/2] = b
	}
	return result, nil
}

func hexVal(c byte) byte {
	switch {
	case c >= '0' && c <= '9':
		return c - '0'
	case c >= 'a' && c <= 'f':
		return c - 'a' + 10
	case c >= 'A' && c <= 'F':
		return c - 'A' + 10
	}
	return 0
}
