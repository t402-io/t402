"""ERC-8004 constants: ABIs, registry addresses, and standard values."""

from typing import Dict

from t402.extensions.erc8004.types import Address

# ============================================================================
# Contract ABIs
# ============================================================================

IDENTITY_REGISTRY_ABI = [
    {
        "type": "function",
        "name": "register",
        "inputs": [
            {"name": "agentURI", "type": "string"},
            {
                "name": "metadata",
                "type": "tuple[]",
                "components": [
                    {"name": "metadataKey", "type": "string"},
                    {"name": "metadataValue", "type": "bytes"},
                ],
            },
        ],
        "outputs": [{"type": "uint256"}],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "getAgentWallet",
        "inputs": [{"name": "agentId", "type": "uint256"}],
        "outputs": [{"type": "address"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "tokenURI",
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "outputs": [{"type": "string"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "ownerOf",
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "outputs": [{"type": "address"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "getMetadata",
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "metadataKey", "type": "string"},
        ],
        "outputs": [{"type": "bytes"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "setAgentWallet",
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "newWallet", "type": "address"},
            {"name": "deadline", "type": "uint256"},
            {"name": "signature", "type": "bytes"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    },
    {
        "type": "event",
        "name": "Registered",
        "inputs": [
            {"name": "agentId", "type": "uint256", "indexed": True},
            {"name": "agentURI", "type": "string", "indexed": False},
            {"name": "owner", "type": "address", "indexed": True},
        ],
    },
]

REPUTATION_REGISTRY_ABI = [
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
            {"name": "feedbackHash", "type": "bytes32"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "getSummary",
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "clientAddresses", "type": "address[]"},
            {"name": "tag1", "type": "string"},
            {"name": "tag2", "type": "string"},
        ],
        "outputs": [
            {"name": "count", "type": "uint64"},
            {"name": "summaryValue", "type": "int128"},
            {"name": "summaryValueDecimals", "type": "uint8"},
        ],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "revokeFeedback",
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "feedbackIndex", "type": "uint64"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "getClients",
        "inputs": [{"name": "agentId", "type": "uint256"}],
        "outputs": [{"type": "address[]"}],
        "stateMutability": "view",
    },
    {
        "type": "event",
        "name": "NewFeedback",
        "inputs": [
            {"name": "agentId", "type": "uint256", "indexed": True},
            {"name": "clientAddress", "type": "address", "indexed": True},
            {"name": "feedbackIndex", "type": "uint64", "indexed": False},
            {"name": "value", "type": "int128", "indexed": False},
            {"name": "valueDecimals", "type": "uint8", "indexed": False},
            {"name": "indexedTag1", "type": "string", "indexed": True},
            {"name": "tag1", "type": "string", "indexed": False},
            {"name": "tag2", "type": "string", "indexed": False},
            {"name": "endpoint", "type": "string", "indexed": False},
            {"name": "feedbackURI", "type": "string", "indexed": False},
            {"name": "feedbackHash", "type": "bytes32", "indexed": False},
        ],
    },
]

VALIDATION_REGISTRY_ABI = [
    {
        "type": "function",
        "name": "validationRequest",
        "inputs": [
            {"name": "validatorAddress", "type": "address"},
            {"name": "agentId", "type": "uint256"},
            {"name": "requestURI", "type": "string"},
            {"name": "requestHash", "type": "bytes32"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "validationResponse",
        "inputs": [
            {"name": "requestHash", "type": "bytes32"},
            {"name": "response", "type": "uint8"},
            {"name": "responseURI", "type": "string"},
            {"name": "responseHash", "type": "bytes32"},
            {"name": "tag", "type": "string"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
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
            {"name": "lastUpdate", "type": "uint256"},
        ],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "getSummary",
        "inputs": [
            {"name": "agentId", "type": "uint256"},
            {"name": "validatorAddresses", "type": "address[]"},
            {"name": "tag", "type": "string"},
        ],
        "outputs": [
            {"name": "count", "type": "uint64"},
            {"name": "averageResponse", "type": "uint8"},
        ],
        "stateMutability": "view",
    },
    {
        "type": "event",
        "name": "ValidationRequest",
        "inputs": [
            {"name": "validatorAddress", "type": "address", "indexed": True},
            {"name": "agentId", "type": "uint256", "indexed": True},
            {"name": "requestURI", "type": "string", "indexed": False},
            {"name": "requestHash", "type": "bytes32", "indexed": True},
        ],
    },
    {
        "type": "event",
        "name": "ValidationResponse",
        "inputs": [
            {"name": "validatorAddress", "type": "address", "indexed": True},
            {"name": "agentId", "type": "uint256", "indexed": True},
            {"name": "requestHash", "type": "bytes32", "indexed": True},
            {"name": "response", "type": "uint8", "indexed": False},
            {"name": "responseURI", "type": "string", "indexed": False},
            {"name": "responseHash", "type": "bytes32", "indexed": False},
            {"name": "tag", "type": "string", "indexed": False},
        ],
    },
]

# ============================================================================
# Known Registry Addresses
# ============================================================================

IDENTITY_REGISTRIES: Dict[str, Address] = {}
"""Known Identity Registry addresses per network (CAIP-2). Empty until mainnet deployments."""

REPUTATION_REGISTRIES: Dict[str, Address] = {}
"""Known Reputation Registry addresses per network (CAIP-2)."""

VALIDATION_REGISTRIES: Dict[str, Address] = {}
"""Known Validation Registry addresses per network (CAIP-2)."""

# ============================================================================
# Extension Key
# ============================================================================

ERC8004_EXTENSION_KEY = "erc8004"
"""Extension key for t402 PaymentRequired/PaymentPayload.extensions."""

# ============================================================================
# Standard Feedback Tags
# ============================================================================

FEEDBACK_TAGS = {
    "PAYMENT_SUCCESS": "paymentSuccess",
    "PAYMENT_FAILED": "paymentFailed",
    "SERVICE_QUALITY": "starred",
    "RESPONSE_TIME": "responseTime",
    "UPTIME": "uptime",
}
"""Standard feedback tags for t402 payment interactions."""

# ============================================================================
# EIP-712 Constants
# ============================================================================

IDENTITY_REGISTRY_DOMAIN = {
    "name": "IdentityRegistry",
    "version": "1",
}
"""EIP-712 domain for setAgentWallet signature verification."""

SET_AGENT_WALLET_TYPES = {
    "SetAgentWallet": [
        {"name": "agentId", "type": "uint256"},
        {"name": "newWallet", "type": "address"},
        {"name": "deadline", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
    ],
}
"""EIP-712 typed data for setAgentWallet."""
