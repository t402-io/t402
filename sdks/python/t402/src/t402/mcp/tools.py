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
        # ------------------------------------------------------------------
        # Phase C cross-SDK parity additions (2026-04-24)
        # ------------------------------------------------------------------
        Tool(
            name="t402/getTokenPrice",
            description="Get current token prices in a target currency via CoinGecko (e.g., ETH, USDC in USD)",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "tokens": Property(
                        type="array",
                        description="Token symbols to price (e.g., [\"ETH\", \"USDC\"])",
                    ),
                    "currency": Property(
                        type="string",
                        description="Target currency (default: 'usd')",
                    ),
                },
                required=["tokens"],
            ),
        ),
        Tool(
            name="t402/getGasPrice",
            description="Get the current suggested gas price for a network (wei and gwei)",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "network": Property(
                        type="string",
                        description="Network to query",
                        enum=networks,
                    ),
                },
                required=["network"],
            ),
        ),
        Tool(
            name="t402/signMessage",
            description="Sign a message using the configured private key (EIP-191 personal_sign)",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "message": Property(
                        type="string",
                        description="Plain-text message to sign",
                    ),
                },
                required=["message"],
            ),
        ),
        # ------------------------------------------------------------------
        # Phase C Batch 2 — WDK tools (2026-04-24). Three are fully
        # implemented; the swap trio is a honest stub (see server.py).
        # ------------------------------------------------------------------
        Tool(
            name="t402/wdk/getWallet",
            description="Get wallet info (EVM address and configured chains) for the current WDK identity",
            inputSchema=InputSchema(
                type="object",
                properties={},
                required=[],
            ),
        ),
        Tool(
            name="t402/wdk/getBalances",
            description="Get multi-chain balances (USDT0, USDC, native) for the WDK wallet, with totals",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "chains": Property(
                        type="array",
                        description="Optional list of chains to check. If empty, checks all configured chains.",
                    ),
                },
                required=[],
            ),
        ),
        Tool(
            name="t402/wdk/transfer",
            description=(
                "Send tokens via the WDK wallet. Requires `confirmed: true` to "
                "execute; otherwise returns a preview."
            ),
            inputSchema=InputSchema(
                type="object",
                properties={
                    "to": Property(
                        type="string",
                        description="Recipient address",
                        pattern="^0x[a-fA-F0-9]{40}$",
                    ),
                    "amount": Property(
                        type="string",
                        description="Amount to send (e.g., '10.5')",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "token": Property(
                        type="string",
                        description="Token to transfer",
                        enum=["USDC", "USDT", "USDT0"],
                    ),
                    "chain": Property(
                        type="string",
                        description="Chain to execute transfer on",
                        enum=networks,
                    ),
                    "confirmed": Property(
                        type="boolean",
                        description="Set to true to execute; otherwise a preview is returned.",
                    ),
                },
                required=["to", "amount", "token", "chain"],
            ),
        ),
        Tool(
            name="t402/wdk/swap",
            description=(
                "[Python SDK: not implemented — returns an error directing callers "
                "to the TS SDK] Swap tokens via WDK."
            ),
            inputSchema=InputSchema(
                type="object",
                properties={
                    "fromToken": Property(type="string", description="Token to swap from"),
                    "toToken": Property(type="string", description="Token to swap to"),
                    "amount": Property(
                        type="string",
                        description="Amount to swap",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "chain": Property(
                        type="string",
                        description="Chain to execute swap on",
                        enum=networks,
                    ),
                    "confirmed": Property(
                        type="boolean",
                        description="Set to true to execute; otherwise a preview is returned.",
                    ),
                },
                required=["fromToken", "toToken", "amount", "chain"],
            ),
        ),
        Tool(
            name="t402/wdk/quoteSwap",
            description=(
                "[Python SDK: not implemented — returns an error directing callers "
                "to the TS SDK] Get a swap quote with a stored quoteId."
            ),
            inputSchema=InputSchema(
                type="object",
                properties={
                    "fromToken": Property(type="string", description="Token to swap from"),
                    "toToken": Property(type="string", description="Token to swap to"),
                    "amount": Property(
                        type="string",
                        description="Amount to swap",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "chain": Property(
                        type="string",
                        description="Chain to execute swap on",
                        enum=networks,
                    ),
                },
                required=["fromToken", "toToken", "amount", "chain"],
            ),
        ),
        Tool(
            name="t402/wdk/executeSwap",
            description=(
                "[Python SDK: not implemented — returns an error directing callers "
                "to the TS SDK] Execute a swap from a stored quoteId."
            ),
            inputSchema=InputSchema(
                type="object",
                properties={
                    "quoteId": Property(
                        type="string",
                        description="Quote ID from wdk/quoteSwap",
                    ),
                    "confirmed": Property(
                        type="boolean",
                        description="Set to true to execute",
                    ),
                },
                required=["quoteId"],
            ),
        ),
        # ------------------------------------------------------------------
        # Phase C Batch 3 — high-utility tools (2026-04-24)
        # ------------------------------------------------------------------
        Tool(
            name="t402/verifySignature",
            description="Verify an EIP-191 signed message against an expected signer address",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "chain": Property(
                        type="string",
                        description="Blockchain network context",
                        enum=networks,
                    ),
                    "message": Property(
                        type="string",
                        description="The original message that was signed",
                    ),
                    "signature": Property(
                        type="string",
                        description="The signature to verify (hex string)",
                        pattern="^0x[a-fA-F0-9]+$",
                    ),
                    "address": Property(
                        type="string",
                        description="The expected signer address",
                        pattern="^0x[a-fA-F0-9]{40}$",
                    ),
                },
                required=["chain", "message", "signature", "address"],
            ),
        ),
        Tool(
            name="t402/estimatePaymentFee",
            description="Estimate gas and USD cost for an ERC-20 payment on a specific network",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "network": Property(
                        type="string",
                        description="Network to estimate on",
                        enum=networks,
                    ),
                    "amount": Property(
                        type="string",
                        description="Payment amount",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "token": Property(
                        type="string",
                        description="Token to use",
                        enum=["USDC", "USDT", "USDT0"],
                    ),
                },
                required=["network", "amount", "token"],
            ),
        ),
        Tool(
            name="t402/compareNetworkFees",
            description="Compare payment fees across multiple networks for a given amount and token",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "amount": Property(
                        type="string",
                        description="Payment amount",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "token": Property(
                        type="string",
                        description="Token to use",
                        enum=["USDC", "USDT", "USDT0"],
                    ),
                    "networks": Property(
                        type="array",
                        description="Networks to compare. If empty, compares all supported networks.",
                    ),
                },
                required=["amount", "token"],
            ),
        ),
        Tool(
            name="t402/getHistoricalPrice",
            description="Get historical price data (1-365 days) for a token via CoinGecko",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "token": Property(
                        type="string",
                        description="Token symbol (e.g., 'ETH', 'USDC')",
                    ),
                    "days": Property(
                        type="integer",
                        description="Number of days (default: 7, max: 365)",
                    ),
                },
                required=["token"],
            ),
        ),
        Tool(
            name="t402/quoteBridge",
            description="Get a USDT0 bridge quote and receive a quoteId usable with executeBridgeFromQuote",
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
                        description="Amount to bridge",
                        pattern=r"^\d+(\.\d+)?$",
                    ),
                    "recipient": Property(
                        type="string",
                        description="Recipient address on destination chain",
                        pattern="^0x[a-fA-F0-9]{40}$",
                    ),
                },
                required=["fromChain", "toChain", "amount", "recipient"],
            ),
        ),
        Tool(
            name="t402/executeBridgeFromQuote",
            description="Execute a USDT0 bridge from a stored quoteId (requires confirmed: true)",
            inputSchema=InputSchema(
                type="object",
                properties={
                    "quoteId": Property(
                        type="string",
                        description="Quote ID from t402/quoteBridge",
                    ),
                    "confirmed": Property(
                        type="boolean",
                        description="Set to true to execute",
                    ),
                },
                required=["quoteId"],
            ),
        ),
    ]
