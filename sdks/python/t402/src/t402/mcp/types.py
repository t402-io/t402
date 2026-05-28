"""Type definitions for T402 MCP Server."""

from dataclasses import dataclass, field
from typing import Any, Literal, Optional


# Supported networks
# Source of truth: sdks/typescript/packages/mechanisms/evm/src/tokens.ts
# USDT0 networks (19): ethereum, arbitrum, ink, berachain, unichain, polygon,
#   mantle, optimism, plasma, sei, conflux, monad, rootstock, xlayer, flare,
#   corn, hyperevm, megaeth, stable
# USDT legacy networks (7): ethereum, polygon, bsc, avalanche, fantom, celo, kaia
# USAT networks (1): ethereum
# USDC networks (6): ethereum, base, arbitrum, optimism, polygon, avalanche
# Base is USDC-only (no USDT0 or legacy USDT).
SupportedNetwork = Literal[
    # USDT0 mainnet networks
    "ethereum",
    "base",
    "arbitrum",
    "optimism",
    "polygon",
    "avalanche",
    "ink",
    "berachain",
    "unichain",
    "mantle",
    "plasma",
    "sei",
    "conflux",
    "monad",
    "rootstock",
    "xlayer",
    "flare",
    "corn",
    "hyperevm",
    "megaeth",
    "stable",
    # USDT-legacy-only mainnet networks (no USDT0)
    "bsc",
    "fantom",
    "celo",
    "kaia",
]

# Supported tokens
# USAT = Tether America (Tether's federally-regulated US stablecoin,
# ERC-2612 permit only, no EIP-3009)
SupportedToken = Literal["USDC", "USDT", "USDT0", "USAT"]


@dataclass
class ServerConfig:
    """MCP Server configuration."""

    private_key: Optional[str] = None
    """Hex wallet private key (0x...)."""

    rpc_urls: dict[str, str] = field(default_factory=dict)
    """Custom RPC endpoints by network."""

    demo_mode: bool = False
    """Enable transaction simulation without executing."""

    paymaster_url: Optional[str] = None
    """ERC-4337 paymaster endpoint."""

    bundler_url: Optional[str] = None
    """ERC-4337 bundler endpoint."""


# JSON-RPC types


@dataclass
class JSONRPCRequest:
    """JSON-RPC 2.0 request."""

    jsonrpc: str
    id: Any
    method: str
    params: Optional[dict[str, Any]] = None


@dataclass
class JSONRPCError:
    """JSON-RPC 2.0 error."""

    code: int
    message: str
    data: Optional[Any] = None


@dataclass
class JSONRPCResponse:
    """JSON-RPC 2.0 response."""

    jsonrpc: str
    id: Any
    result: Optional[Any] = None
    error: Optional[JSONRPCError] = None


# MCP Tool types


@dataclass
class Property:
    """JSON Schema property."""

    type: str
    description: Optional[str] = None
    enum: Optional[list[str]] = None
    pattern: Optional[str] = None


@dataclass
class InputSchema:
    """JSON Schema for tool inputs."""

    type: str = "object"
    properties: dict[str, Property] = field(default_factory=dict)
    required: list[str] = field(default_factory=list)


@dataclass
class Tool:
    """MCP tool definition."""

    name: str
    description: str
    inputSchema: InputSchema


@dataclass
class ContentBlock:
    """Content block in tool result."""

    type: str
    text: Optional[str] = None


@dataclass
class ToolResult:
    """Tool execution result."""

    content: list[ContentBlock]
    isError: bool = False


# Tool input types


@dataclass
class GetBalanceInput:
    """Input for t402/getBalance."""

    address: str
    network: SupportedNetwork


@dataclass
class GetAllBalancesInput:
    """Input for t402/getAllBalances."""

    address: str


@dataclass
class PayInput:
    """Input for t402/pay."""

    to: str
    amount: str
    token: SupportedToken
    network: SupportedNetwork


@dataclass
class PayGaslessInput:
    """Input for t402/payGasless."""

    to: str
    amount: str
    token: SupportedToken
    network: SupportedNetwork


@dataclass
class GetBridgeFeeInput:
    """Input for t402/getBridgeFee."""

    fromChain: str
    toChain: str
    amount: str
    recipient: str


@dataclass
class BridgeInput:
    """Input for t402/bridge."""

    fromChain: str
    toChain: str
    amount: str
    recipient: str


# Tool result types


@dataclass
class BalanceInfo:
    """Balance information for a token."""

    token: str
    balance: str
    raw: str


@dataclass
class NetworkBalance:
    """Balances for a single network."""

    network: str
    native: Optional[BalanceInfo] = None
    tokens: list[BalanceInfo] = field(default_factory=list)
    error: Optional[str] = None


@dataclass
class PaymentResult:
    """Payment execution result."""

    tx_hash: str
    from_address: str
    to: str
    amount: str
    token: str
    network: str
    explorer_url: str
    demo_mode: bool = False


@dataclass
class BridgeFeeResult:
    """Bridge fee query result."""

    native_fee: str
    native_symbol: str
    from_chain: str
    to_chain: str
    amount: str
    estimated_time: int


@dataclass
class BridgeResultData:
    """Bridge execution result."""

    tx_hash: str
    message_guid: str
    from_chain: str
    to_chain: str
    amount: str
    explorer_url: str
    tracking_url: str
    estimated_time: int
    demo_mode: bool = False
