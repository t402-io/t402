// Package a2a implements the A2A (Agent-to-Agent) transport for t402 payments.
//
// It provides types and helpers for embedding payment flows into A2A protocol
// messages using JSON-RPC and task-based state management.
package a2a

// T402ExtensionURI is the URI for the t402 A2A extension.
const T402ExtensionURI = "https://github.com/google-a2a/a2a-t402/v0.1"

// ExtensionsHeader is the HTTP header for A2A extension activation.
const ExtensionsHeader = "X-A2A-Extensions"

// Payment metadata keys.
const (
	MetaPaymentStatus   = "t402.payment.status"
	MetaPaymentRequired = "t402.payment.required"
	MetaPaymentPayload  = "t402.payment.payload"
	MetaPaymentReceipts = "t402.payment.receipts"
	MetaPaymentError    = "t402.payment.error"
)

// PaymentStatus values used in A2A metadata.
const (
	StatusPaymentRequired  = "payment-required"
	StatusPaymentRejected  = "payment-rejected"
	StatusPaymentSubmitted = "payment-submitted"
	StatusPaymentVerified  = "payment-verified"
	StatusPaymentCompleted = "payment-completed"
	StatusPaymentFailed    = "payment-failed"
)

// TaskState values for A2A tasks.
const (
	StateSubmitted     = "submitted"
	StateWorking       = "working"
	StateInputRequired = "input-required"
	StateCompleted     = "completed"
	StateCanceled      = "canceled"
	StateFailed        = "failed"
	StateUnknown       = "unknown"
)

// TextPart is a text message part.
type TextPart struct {
	Kind string `json:"kind"` // always "text"
	Text string `json:"text"`
}

// FilePart is a file message part.
type FilePart struct {
	Kind string   `json:"kind"` // always "file"
	File FileData `json:"file"`
}

// FileData contains file content.
type FileData struct {
	Name     string `json:"name,omitempty"`
	MimeType string `json:"mimeType,omitempty"`
	Bytes    string `json:"bytes,omitempty"` // base64 encoded
	URI      string `json:"uri,omitempty"`
}

// DataPart is a data message part.
type DataPart struct {
	Kind string                 `json:"kind"` // always "data"
	Data map[string]interface{} `json:"data"`
}

// MessagePart is a union of text, file, and data parts.
type MessagePart struct {
	Kind string                 `json:"kind"`
	Text string                 `json:"text,omitempty"`
	File *FileData              `json:"file,omitempty"`
	Data map[string]interface{} `json:"data,omitempty"`
}

// Message is an A2A message with optional payment metadata.
type Message struct {
	Kind      string                 `json:"kind"` // always "message"
	MessageID string                 `json:"messageId,omitempty"`
	Role      string                 `json:"role"` // "user" or "agent"
	Parts     []MessagePart          `json:"parts"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Artifact is an output from a completed task.
type Artifact struct {
	Kind     string                 `json:"kind"`
	Name     string                 `json:"name,omitempty"`
	MimeType string                 `json:"mimeType,omitempty"`
	Data     string                 `json:"data,omitempty"` // base64 encoded
	URI      string                 `json:"uri,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// TaskStatus represents the current status of an A2A task.
type TaskStatus struct {
	State     string   `json:"state"`
	Message   *Message `json:"message,omitempty"`
	Timestamp string   `json:"timestamp,omitempty"`
}

// Task is an A2A task with status and history.
type Task struct {
	Kind      string                 `json:"kind"` // always "task"
	ID        string                 `json:"id"`
	SessionID string                 `json:"sessionId,omitempty"`
	Status    TaskStatus             `json:"status"`
	Artifacts []Artifact             `json:"artifacts,omitempty"`
	History   []Message              `json:"history,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Request is a JSON-RPC request.
type Request struct {
	JSONRPC string      `json:"jsonrpc"` // always "2.0"
	Method  string      `json:"method"`
	ID      interface{} `json:"id"` // string or number
	Params  interface{} `json:"params,omitempty"`
}

// Response is a JSON-RPC response.
type Response struct {
	JSONRPC string      `json:"jsonrpc"` // always "2.0"
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *Error      `json:"error,omitempty"`
}

// Error is a JSON-RPC error.
type Error struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Extension is an A2A extension declaration.
type Extension struct {
	URI         string `json:"uri"`
	Description string `json:"description,omitempty"`
	Required    bool   `json:"required,omitempty"`
}

// Capabilities describes an A2A agent's capabilities.
type Capabilities struct {
	Streaming              bool        `json:"streaming,omitempty"`
	PushNotifications      bool        `json:"pushNotifications,omitempty"`
	StateTransitionHistory bool        `json:"stateTransitionHistory,omitempty"`
	Extensions             []Extension `json:"extensions,omitempty"`
}

// AgentCard is a service advertisement for an A2A agent.
type AgentCard struct {
	Name              string        `json:"name"`
	Description       string        `json:"description,omitempty"`
	URL               string        `json:"url"`
	Provider          *Provider     `json:"provider,omitempty"`
	Version           string        `json:"version,omitempty"`
	DocumentationURL  string        `json:"documentationUrl,omitempty"`
	Capabilities      *Capabilities `json:"capabilities,omitempty"`
	Authentication    *AuthConfig   `json:"authentication,omitempty"`
	DefaultInputModes []string      `json:"defaultInputModes,omitempty"`
	DefaultOutputModes []string     `json:"defaultOutputModes,omitempty"`
	Skills            []Skill       `json:"skills,omitempty"`
}

// Provider identifies the agent's provider.
type Provider struct {
	Organization string `json:"organization,omitempty"`
	URL          string `json:"url,omitempty"`
}

// AuthConfig describes authentication for the agent.
type AuthConfig struct {
	Schemes     []string `json:"schemes"`
	Credentials string   `json:"credentials,omitempty"`
}

// Skill describes a capability of the agent.
type Skill struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Examples    []string `json:"examples,omitempty"`
	InputModes  []string `json:"inputModes,omitempty"`
	OutputModes []string `json:"outputModes,omitempty"`
}
