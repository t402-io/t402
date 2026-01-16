"""T402 MCP Server - Model Context Protocol server for AI agent integration.

This module provides an MCP server that enables AI agents to interact with
blockchain payments using the T402 protocol.

Example:
    ```python
    from t402.mcp import T402McpServer, ServerConfig

    config = ServerConfig(demo_mode=True)
    server = T402McpServer(config)
    await server.run()
    ```

Available Tools:
    - t402/getBalance: Get token balances for a wallet on specific network
    - t402/getAllBalances: Get balances across all supported networks
    - t402/pay: Execute stablecoin payments (USDC, USDT, USDT0)
    - t402/payGasless: ERC-4337 gasless payments
    - t402/getBridgeFee: Get LayerZero bridge fee quotes
    - t402/bridge: Bridge USDT0 between chains via LayerZero
"""

from .server import T402McpServer, run_server
from .types import (
    ServerConfig,
    SupportedNetwork,
    SupportedToken,
    Tool,
    ToolResult,
    GetBalanceInput,
    GetAllBalancesInput,
    PayInput,
    PayGaslessInput,
    GetBridgeFeeInput,
    BridgeInput,
    BalanceInfo,
    NetworkBalance,
    PaymentResult,
    BridgeFeeResult,
    BridgeResultData,
)
from .constants import (
    CHAIN_IDS,
    NATIVE_SYMBOLS,
    EXPLORER_URLS,
    DEFAULT_RPC_URLS,
    USDC_ADDRESSES,
    USDT_ADDRESSES,
    USDT0_ADDRESSES,
    BRIDGEABLE_CHAINS,
    GASLESS_NETWORKS,
    ALL_NETWORKS,
    is_valid_network,
    is_bridgeable_chain,
    is_gasless_network,
    get_token_address,
    get_explorer_tx_url,
    get_rpc_url,
    format_token_amount,
    parse_token_amount,
)
from .tools import get_tool_definitions

__all__ = [
    # Server
    "T402McpServer",
    "run_server",
    # Config and types
    "ServerConfig",
    "SupportedNetwork",
    "SupportedToken",
    "Tool",
    "ToolResult",
    # Input types
    "GetBalanceInput",
    "GetAllBalancesInput",
    "PayInput",
    "PayGaslessInput",
    "GetBridgeFeeInput",
    "BridgeInput",
    # Result types
    "BalanceInfo",
    "NetworkBalance",
    "PaymentResult",
    "BridgeFeeResult",
    "BridgeResultData",
    # Constants
    "CHAIN_IDS",
    "NATIVE_SYMBOLS",
    "EXPLORER_URLS",
    "DEFAULT_RPC_URLS",
    "USDC_ADDRESSES",
    "USDT_ADDRESSES",
    "USDT0_ADDRESSES",
    "BRIDGEABLE_CHAINS",
    "GASLESS_NETWORKS",
    "ALL_NETWORKS",
    # Functions
    "is_valid_network",
    "is_bridgeable_chain",
    "is_gasless_network",
    "get_token_address",
    "get_explorer_tx_url",
    "get_rpc_url",
    "format_token_amount",
    "parse_token_amount",
    "get_tool_definitions",
]
