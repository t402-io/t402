package erc8004

// ExtensionKey is the extension key for ERC-8004 in PaymentRequired/PaymentPayload extensions.
const ExtensionKey = "erc8004"

// FeedbackTag constants for t402 payment interactions.
const (
	// FeedbackTagPaymentSuccess indicates a successful payment.
	FeedbackTagPaymentSuccess = "paymentSuccess"
	// FeedbackTagPaymentFailed indicates a failed payment.
	FeedbackTagPaymentFailed = "paymentFailed"
	// FeedbackTagServiceQuality indicates a service quality rating.
	FeedbackTagServiceQuality = "starred"
	// FeedbackTagResponseTime indicates response time measurement.
	FeedbackTagResponseTime = "responseTime"
	// FeedbackTagUptime indicates uptime measurement.
	FeedbackTagUptime = "uptime"
)

// IdentityRegistryDomain is the EIP-712 domain for setAgentWallet signature verification.
var IdentityRegistryDomain = map[string]string{
	"name":    "IdentityRegistry",
	"version": "1",
}

// SetAgentWalletTypes defines the EIP-712 typed data for setAgentWallet.
var SetAgentWalletTypes = []struct {
	Name string
	Type string
}{
	{Name: "agentId", Type: "uint256"},
	{Name: "newWallet", Type: "address"},
	{Name: "deadline", Type: "uint256"},
	{Name: "nonce", Type: "uint256"},
}

// IdentityRegistries contains known Identity Registry addresses per network (CAIP-2).
// Populated as ERC-8004 deploys to each chain (spec is in Draft status).
var IdentityRegistries = map[string]string{}

// ReputationRegistries contains known Reputation Registry addresses per network (CAIP-2).
var ReputationRegistries = map[string]string{}

// ValidationRegistries contains known Validation Registry addresses per network (CAIP-2).
var ValidationRegistries = map[string]string{}

// Contract ABIs as Go string constants.
// These mirror the TypeScript ABIs for contract interaction via go-ethereum or similar.

// IdentityRegistryABI is the ABI for the Identity Registry contract.
const IdentityRegistryABI = `[
	{
		"type": "function",
		"name": "register",
		"inputs": [
			{"name": "agentURI", "type": "string"},
			{"name": "metadata", "type": "tuple[]", "components": [
				{"name": "metadataKey", "type": "string"},
				{"name": "metadataValue", "type": "bytes"}
			]}
		],
		"outputs": [{"type": "uint256"}],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "getAgentWallet",
		"inputs": [{"name": "agentId", "type": "uint256"}],
		"outputs": [{"type": "address"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "tokenURI",
		"inputs": [{"name": "tokenId", "type": "uint256"}],
		"outputs": [{"type": "string"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "ownerOf",
		"inputs": [{"name": "tokenId", "type": "uint256"}],
		"outputs": [{"type": "address"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "getMetadata",
		"inputs": [
			{"name": "agentId", "type": "uint256"},
			{"name": "metadataKey", "type": "string"}
		],
		"outputs": [{"type": "bytes"}],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "setAgentWallet",
		"inputs": [
			{"name": "agentId", "type": "uint256"},
			{"name": "newWallet", "type": "address"},
			{"name": "deadline", "type": "uint256"},
			{"name": "signature", "type": "bytes"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "event",
		"name": "Registered",
		"inputs": [
			{"name": "agentId", "type": "uint256", "indexed": true},
			{"name": "agentURI", "type": "string", "indexed": false},
			{"name": "owner", "type": "address", "indexed": true}
		]
	}
]`

// ReputationRegistryABI is the ABI for the Reputation Registry contract.
const ReputationRegistryABI = `[
	{
		"type": "function",
		"name": "giveFeedback",
		"inputs": [
			{"name": "agentId", "type": "uint256"},
			{"name": "value", "type": "int128"},
			{"name": "valueDecimals", "type": "uint8"},
			{"name": "tag1", "type": "string"},
			{"name": "tag2", "type": "string"},
			{"name": "endpoint", "type": "string"},
			{"name": "feedbackURI", "type": "string"},
			{"name": "feedbackHash", "type": "bytes32"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "getSummary",
		"inputs": [
			{"name": "agentId", "type": "uint256"},
			{"name": "clientAddresses", "type": "address[]"},
			{"name": "tag1", "type": "string"},
			{"name": "tag2", "type": "string"}
		],
		"outputs": [
			{"name": "count", "type": "uint64"},
			{"name": "summaryValue", "type": "int128"},
			{"name": "summaryValueDecimals", "type": "uint8"}
		],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "revokeFeedback",
		"inputs": [
			{"name": "agentId", "type": "uint256"},
			{"name": "feedbackIndex", "type": "uint64"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "getClients",
		"inputs": [{"name": "agentId", "type": "uint256"}],
		"outputs": [{"type": "address[]"}],
		"stateMutability": "view"
	},
	{
		"type": "event",
		"name": "NewFeedback",
		"inputs": [
			{"name": "agentId", "type": "uint256", "indexed": true},
			{"name": "clientAddress", "type": "address", "indexed": true},
			{"name": "feedbackIndex", "type": "uint64", "indexed": false},
			{"name": "value", "type": "int128", "indexed": false},
			{"name": "valueDecimals", "type": "uint8", "indexed": false},
			{"name": "indexedTag1", "type": "string", "indexed": true},
			{"name": "tag1", "type": "string", "indexed": false},
			{"name": "tag2", "type": "string", "indexed": false},
			{"name": "endpoint", "type": "string", "indexed": false},
			{"name": "feedbackURI", "type": "string", "indexed": false},
			{"name": "feedbackHash", "type": "bytes32", "indexed": false}
		]
	}
]`

// ValidationRegistryABI is the ABI for the Validation Registry contract.
const ValidationRegistryABI = `[
	{
		"type": "function",
		"name": "validationRequest",
		"inputs": [
			{"name": "validatorAddress", "type": "address"},
			{"name": "agentId", "type": "uint256"},
			{"name": "requestURI", "type": "string"},
			{"name": "requestHash", "type": "bytes32"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "validationResponse",
		"inputs": [
			{"name": "requestHash", "type": "bytes32"},
			{"name": "response", "type": "uint8"},
			{"name": "responseURI", "type": "string"},
			{"name": "responseHash", "type": "bytes32"},
			{"name": "tag", "type": "string"}
		],
		"outputs": [],
		"stateMutability": "nonpayable"
	},
	{
		"type": "function",
		"name": "getValidationStatus",
		"inputs": [{"name": "requestHash", "type": "bytes32"}],
		"outputs": [
			{"name": "validatorAddress", "type": "address"},
			{"name": "agentId", "type": "uint256"},
			{"name": "response", "type": "uint8"},
			{"name": "responseHash", "type": "bytes32"},
			{"name": "tag", "type": "string"},
			{"name": "lastUpdate", "type": "uint256"}
		],
		"stateMutability": "view"
	},
	{
		"type": "function",
		"name": "getSummary",
		"inputs": [
			{"name": "agentId", "type": "uint256"},
			{"name": "validatorAddresses", "type": "address[]"},
			{"name": "tag", "type": "string"}
		],
		"outputs": [
			{"name": "count", "type": "uint64"},
			{"name": "averageResponse", "type": "uint8"}
		],
		"stateMutability": "view"
	},
	{
		"type": "event",
		"name": "ValidationRequest",
		"inputs": [
			{"name": "validatorAddress", "type": "address", "indexed": true},
			{"name": "agentId", "type": "uint256", "indexed": true},
			{"name": "requestURI", "type": "string", "indexed": false},
			{"name": "requestHash", "type": "bytes32", "indexed": true}
		]
	},
	{
		"type": "event",
		"name": "ValidationResponse",
		"inputs": [
			{"name": "validatorAddress", "type": "address", "indexed": true},
			{"name": "agentId", "type": "uint256", "indexed": true},
			{"name": "requestHash", "type": "bytes32", "indexed": true},
			{"name": "response", "type": "uint8", "indexed": false},
			{"name": "responseURI", "type": "string", "indexed": false},
			{"name": "responseHash", "type": "bytes32", "indexed": false},
			{"name": "tag", "type": "string", "indexed": false}
		]
	}
]`
