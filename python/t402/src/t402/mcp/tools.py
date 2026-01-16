"""Tool definitions for T402 MCP Server."""

from .constants import ALL_NETWORKS, BRIDGEABLE_CHAINS, GASLESS_NETWORKS
from .types import InputSchema, Property, Tool


def get_tool_definitions() -> list[Tool]:
    """Get all available tool definitions."""
    networks = list(ALL_NETWORKS)
    bridgeable_chains = list(BRIDGEABLE_CHAINS)
    gasless_networks = list(GASLESS_NETWORKS)

    return [
        Tool(
            name="t402/getBalance",
            description="Get token balances (native + stablecoins) for a wallet address on a specific network",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "address": Property(
                        type="string",
                        description="Ethereum address (0x...)",
                        pattern="^0x[a-fA-F0-9]{40}$",
                    ),
                    "network": Property(
                        type="string",
                        description="Network to query",
                        enum=networks,
                    ),
                },
                required=["address", "network"],
            ),
        ),
        Tool(
            name="t402/getAllBalances",
            description="Get token balances across all supported networks for a wallet address",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "address": Property(
                        type="string",
                        description="Ethereum address (0x...)",
                        pattern="^0x[a-fA-F0-9]{40}$",
                    ),
                },
                required=["address"],
            ),
        ),
        Tool(
            name="t402/pay",
            description="Execute a stablecoin payment (USDC, USDT, or USDT0)",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "to": Property(
                        type="string",
                        description="Recipient address (0x...)",
                        pattern="^0x[a-fA-F0-9]{40}$",
                    ),
                    "amount": Property(
                        type="string",
                        description="Amount to send (e.g., '10.5')",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "token": Property(
                        type="string",
                        description="Token to send",
                        enum=["USDC", "USDT", "USDT0"],
                    ),
                    "network": Property(
                        type="string",
                        description="Network to use",
                        enum=networks,
                    ),
                },
                required=["to", "amount", "token", "network"],
            ),
        ),
        Tool(
            name="t402/payGasless",
            description="Execute a gasless payment using ERC-4337 account abstraction (user pays no gas)",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "to": Property(
                        type="string",
                        description="Recipient address (0x...)",
                        pattern="^0x[a-fA-F0-9]{40}$",
                    ),
                    "amount": Property(
                        type="string",
                        description="Amount to send (e.g., '10.5')",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "token": Property(
                        type="string",
                        description="Token to send",
                        enum=["USDC", "USDT", "USDT0"],
                    ),
                    "network": Property(
                        type="string",
                        description="Network to use (must support ERC-4337)",
                        enum=gasless_networks,
                    ),
                },
                required=["to", "amount", "token", "network"],
            ),
        ),
        Tool(
            name="t402/getBridgeFee",
            description="Get the fee quote for bridging USDT0 between chains via LayerZero",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "fromChain": Property(
                        type="string",
                        description="Source chain",
                        enum=bridgeable_chains,
                    ),
                    "toChain": Property(
                        type="string",
                        description="Destination chain",
                        enum=bridgeable_chains,
                    ),
                    "amount": Property(
                        type="string",
                        description="Amount to bridge (e.g., '100')",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "recipient": Property(
                        type="string",
                        description="Recipient address on destination chain (0x...)",
                        pattern="^0x[a-fA-F0-9]{40}$",
                    ),
                },
                required=["fromChain", "toChain", "amount", "recipient"],
            ),
        ),
        Tool(
            name="t402/bridge",
            description="Bridge USDT0 between chains using LayerZero OFT",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "fromChain": Property(
                        type="string",
                        description="Source chain",
                        enum=bridgeable_chains,
                    ),
                    "toChain": Property(
                        type="string",
                        description="Destination chain",
                        enum=bridgeable_chains,
                    ),
                    "amount": Property(
                        type="string",
                        description="Amount to bridge (e.g., '100')",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "recipient": Property(
                        type="string",
                        description="Recipient address on destination chain (0x...)",
                        pattern="^0x[a-fA-F0-9]{40}$",
                    ),
                },
                required=["fromChain", "toChain", "amount", "recipient"],
            ),
        ),
    ]
