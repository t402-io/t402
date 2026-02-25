"""A2A transport types for t402 payments."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

# Constants
T402_A2A_EXTENSION_URI = "https://github.com/google-a2a/a2a-t402/v0.1"
A2A_EXTENSIONS_HEADER = "X-A2A-Extensions"

# Payment metadata keys
META_PAYMENT_STATUS = "t402.payment.status"
META_PAYMENT_REQUIRED = "t402.payment.required"
META_PAYMENT_PAYLOAD = "t402.payment.payload"
META_PAYMENT_RECEIPTS = "t402.payment.receipts"
META_PAYMENT_ERROR = "t402.payment.error"

# x402 v0.2 A2A extension URI (compatibility layer)
X402_A2A_EXTENSION_URI = (
    "https://github.com/google-agentic-commerce/"
    "a2a-x402/blob/main/spec/v0.2"
)

# x402 payment metadata keys (compatibility layer)
X402_META_PAYMENT_STATUS = "x402.payment.status"
X402_META_PAYMENT_REQUIRED = "x402.payment.required"
X402_META_PAYMENT_PAYLOAD = "x402.payment.payload"
X402_META_PAYMENT_RECEIPTS = "x402.payment.receipts"
X402_META_PAYMENT_ERROR = "x402.payment.error"

# CAIP-2 to flat name mapping for x402 V1 compat
CAIP2_TO_FLAT_NAME: Dict[str, str] = {
    "eip155:1": "ethereum",
    "eip155:8453": "base",
    "eip155:84532": "base-sepolia",
    "eip155:42161": "arbitrum",
    "eip155:10": "optimism",
    "eip155:137": "polygon",
    "eip155:56": "bsc",
    "eip155:43114": "avalanche",
    "eip155:43113": "avalanche-fuji",
    "eip155:250": "fantom",
    "eip155:8217": "klaytn",
    "eip155:42220": "celo",
    "eip155:57073": "ink",
    "eip155:80094": "berachain",
    "eip155:130": "unichain",
    "eip155:5000": "mantle",
    "eip155:9745": "plasma",
    "eip155:1329": "sei",
    "eip155:1030": "conflux",
    "eip155:143": "monad",
    "eip155:14": "flare",
    "eip155:30": "rootstock",
    "eip155:196": "xlayer",
    "eip155:988": "stable",
    "eip155:999": "hyperevm",
    "eip155:4326": "megaeth",
    "eip155:21000000": "corn",
}

# T402 to x402 v0.2 error code mapping
T402_TO_X402_ERROR_MAP: Dict[str, str] = {
    "T402-1001": "INVALID_AMOUNT",
    "T402-2001": "INVALID_SIGNATURE",
    "T402-3001": "SETTLEMENT_FAILED",
    "T402-5001": "SETTLEMENT_FAILED",
    "T402-5002": "SETTLEMENT_FAILED",
}

# Payment status values
STATUS_PAYMENT_REQUIRED = "payment-required"
STATUS_PAYMENT_REJECTED = "payment-rejected"
STATUS_PAYMENT_SUBMITTED = "payment-submitted"
STATUS_PAYMENT_VERIFIED = "payment-verified"
STATUS_PAYMENT_COMPLETED = "payment-completed"
STATUS_PAYMENT_FAILED = "payment-failed"

# Task state values
STATE_SUBMITTED = "submitted"
STATE_WORKING = "working"
STATE_INPUT_REQUIRED = "input-required"
STATE_COMPLETED = "completed"
STATE_CANCELED = "canceled"
STATE_FAILED = "failed"
STATE_UNKNOWN = "unknown"


@dataclass
class A2AMessagePart:
    """A message part (text, file, or data)."""

    kind: str
    text: Optional[str] = None
    file: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None


@dataclass
class A2AMessage:
    """An A2A message with optional payment metadata."""

    kind: str  # always "message"
    role: str  # "user" or "agent"
    parts: List[A2AMessagePart]
    message_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class A2ATaskStatus:
    """Current status of an A2A task."""

    state: str
    message: Optional[A2AMessage] = None
    timestamp: Optional[str] = None


@dataclass
class A2AArtifact:
    """Output from a completed task."""

    kind: str
    name: Optional[str] = None
    mime_type: Optional[str] = None
    data: Optional[str] = None
    uri: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class A2ATask:
    """An A2A task with status and history."""

    kind: str  # always "task"
    id: str
    status: A2ATaskStatus
    session_id: Optional[str] = None
    artifacts: Optional[List[A2AArtifact]] = None
    history: Optional[List[A2AMessage]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class A2AExtension:
    """An A2A extension declaration."""

    uri: str
    description: Optional[str] = None
    required: bool = False


@dataclass
class A2ACapabilities:
    """A2A agent capabilities."""

    streaming: bool = False
    push_notifications: bool = False
    state_transition_history: bool = False
    extensions: Optional[List[A2AExtension]] = None


@dataclass
class A2AProvider:
    """Agent provider information."""

    organization: Optional[str] = None
    url: Optional[str] = None


@dataclass
class A2ASkill:
    """A2A skill definition."""

    id: str
    name: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    examples: Optional[List[str]] = None
    input_modes: Optional[List[str]] = None
    output_modes: Optional[List[str]] = None


@dataclass
class A2AAgentCard:
    """A2A agent card (service advertisement)."""

    name: str
    url: str
    description: Optional[str] = None
    provider: Optional[A2AProvider] = None
    version: Optional[str] = None
    documentation_url: Optional[str] = None
    capabilities: Optional[A2ACapabilities] = None
    default_input_modes: Optional[List[str]] = None
    default_output_modes: Optional[List[str]] = None
    skills: Optional[List[A2ASkill]] = None
