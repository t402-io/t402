package t402

// Version constants
const (
	// Version is the SDK version
	Version = "2.0.0"

	// ProtocolVersion is the current t402 protocol version
	ProtocolVersion = 2

	// ProtocolVersionV1 is the legacy t402 protocol version
	ProtocolVersionV1 = 1
)

// Export the main types with uppercase names for external packages
type (
	// T402Client is the exported type for t402Client
	T402Client = t402Client

	// T402ResourceServer is the exported type for t402ResourceServer
	T402ResourceServer = t402ResourceServer

	// T402Facilitator is the exported type for t402Facilitator
	T402Facilitator = t402Facilitator
)
