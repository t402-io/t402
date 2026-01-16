"""T402 MCP Server implementation."""

import asyncio
import json
import os
import sys
from dataclasses import asdict
from typing import Any, Optional, TextIO

from .constants import (
    ALL_NETWORKS,
    LAYERZERO_SCAN_URL,
    NATIVE_SYMBOLS,
    get_explorer_tx_url,
    get_token_address,
    is_bridgeable_chain,
    is_gasless_network,
    is_valid_network,
)
from .tools import get_tool_definitions
from .types import (
    BalanceInfo,
    BridgeFeeResult,
    BridgeResultData,
    ContentBlock,
    JSONRPCError,
    JSONRPCResponse,
    NetworkBalance,
    PaymentResult,
    ServerConfig,
    ToolResult,
)


class T402McpServer:
    """T402 MCP Server.

    Provides blockchain payment tools for AI agents via MCP protocol.
    """

    def __init__(
        self,
        config: Optional[ServerConfig] = None,
        stdin: Optional[TextIO] = None,
        stdout: Optional[TextIO] = None,
    ) -> None:
        """Create a new MCP server.

        Args:
            config: Server configuration
            stdin: Input stream (default: sys.stdin)
            stdout: Output stream (default: sys.stdout)
        """
        self.config = config or ServerConfig()
        self._stdin = stdin or sys.stdin
        self._stdout = stdout or sys.stdout

    async def run(self) -> None:
        """Run the MCP server, processing requests until EOF."""
        print("T402 MCP Server starting...", file=sys.stderr)
        print(f"Demo mode: {self.config.demo_mode}", file=sys.stderr)

        loop = asyncio.get_event_loop()

        while True:
            try:
                # Read line from stdin
                line = await loop.run_in_executor(None, self._stdin.readline)
                if not line:
                    break

                line = line.strip()
                if not line:
                    continue

                # Process request
                response = await self._handle_request(line)

                # Write response
                response_json = self._serialize_response(response)
                self._stdout.write(response_json + "\n")
                self._stdout.flush()

            except Exception as e:
                print(f"Error: {e}", file=sys.stderr)
                continue

    async def _handle_request(self, data: str) -> JSONRPCResponse:
        """Handle a single JSON-RPC request."""
        try:
            req = json.loads(data)
        except json.JSONDecodeError as e:
            return JSONRPCResponse(
                jsonrpc="2.0",
                id=None,
                error=JSONRPCError(code=-32700, message="Parse error", data=str(e)),
            )

        method = req.get("method", "")
        req_id = req.get("id")
        params = req.get("params", {})

        response = JSONRPCResponse(jsonrpc="2.0", id=req_id)

        if method == "initialize":
            response.result = self._handle_initialize()
        elif method == "tools/list":
            response.result = self._handle_list_tools()
        elif method == "tools/call":
            response.result = await self._handle_call_tool(params)
        elif method == "notifications/initialized":
            response.result = {}
        else:
            response.error = JSONRPCError(
                code=-32601, message="Method not found", data=method
            )

        return response

    def _handle_initialize(self) -> dict[str, Any]:
        """Handle the initialize request."""
        return {
            "protocolVersion": "2024-11-05",
            "serverInfo": {"name": "t402", "version": "1.0.0"},
            "capabilities": {"tools": {}},
        }

    def _handle_list_tools(self) -> dict[str, Any]:
        """Handle the tools/list request."""
        tools = get_tool_definitions()
        return {"tools": [self._tool_to_dict(t) for t in tools]}

    def _tool_to_dict(self, tool) -> dict[str, Any]:
        """Convert Tool to dictionary."""
        return {
            "name": tool.name,
            "description": tool.description,
            "inputSchema": {
                "type": tool.inputSchema.type,
                "properties": {
                    k: {
                        "type": v.type,
                        **({"description": v.description} if v.description else {}),
                        **({"enum": v.enum} if v.enum else {}),
                        **({"pattern": v.pattern} if v.pattern else {}),
                    }
                    for k, v in tool.inputSchema.properties.items()
                },
                "required": tool.inputSchema.required,
            },
        }

    async def _handle_call_tool(self, params: dict[str, Any]) -> dict[str, Any]:
        """Handle the tools/call request."""
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        if tool_name == "t402/getBalance":
            result = await self._handle_get_balance(arguments)
        elif tool_name == "t402/getAllBalances":
            result = await self._handle_get_all_balances(arguments)
        elif tool_name == "t402/pay":
            result = await self._handle_pay(arguments)
        elif tool_name == "t402/payGasless":
            result = await self._handle_pay_gasless(arguments)
        elif tool_name == "t402/getBridgeFee":
            result = await self._handle_get_bridge_fee(arguments)
        elif tool_name == "t402/bridge":
            result = await self._handle_bridge(arguments)
        else:
            result = self._error_result(f"Unknown tool: {tool_name}")

        return {"content": [asdict(c) for c in result.content], "isError": result.isError}

    async def _handle_get_balance(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/getBalance tool."""
        try:
            _address = args.get("address", "")  # noqa: F841 - reserved for future use
            network = args.get("network", "")

            if not is_valid_network(network):
                return self._error_result(f"Invalid network: {network}")

            # In demo mode or without web3, return placeholder data
            result = NetworkBalance(
                network=network,
                native=BalanceInfo(
                    token=NATIVE_SYMBOLS.get(network, "ETH"),
                    balance="0.0",
                    raw="0",
                ),
                tokens=[],
            )

            return self._text_result(self._format_balance_result(result))

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_get_all_balances(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/getAllBalances tool."""
        try:
            _address = args.get("address", "")  # noqa: F841 - reserved for future use

            results = []
            for network in ALL_NETWORKS:
                results.append(
                    NetworkBalance(
                        network=network,
                        native=BalanceInfo(
                            token=NATIVE_SYMBOLS.get(network, "ETH"),
                            balance="0.0",
                            raw="0",
                        ),
                        tokens=[],
                    )
                )

            return self._text_result(self._format_all_balances_result(results))

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_pay(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/pay tool."""
        try:
            to = args.get("to", "")
            amount = args.get("amount", "")
            token = args.get("token", "")
            network = args.get("network", "")

            if not is_valid_network(network):
                return self._error_result(f"Invalid network: {network}")

            token_addr = get_token_address(network, token)
            if not token_addr:
                return self._error_result(f"Token {token} not supported on {network}")

            if not self.config.private_key and not self.config.demo_mode:
                return self._error_result(
                    "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE"
                )

            # Demo mode
            if self.config.demo_mode:
                result = PaymentResult(
                    tx_hash="0x" + "0" * 64 + "_demo",
                    from_address="0x" + "0" * 40,
                    to=to,
                    amount=amount,
                    token=token,
                    network=network,
                    explorer_url=get_explorer_tx_url(network, "0x_demo"),
                    demo_mode=True,
                )
                return self._text_result(self._format_payment_result(result))

            return self._error_result("Real transactions require private key configuration")

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_pay_gasless(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/payGasless tool."""
        try:
            network = args.get("network", "")

            if not is_gasless_network(network):
                return self._error_result(f"Network {network} does not support gasless payments")

            if not self.config.bundler_url and not self.config.demo_mode:
                return self._error_result(
                    "Bundler URL not configured. Set T402_BUNDLER_URL or enable T402_DEMO_MODE"
                )

            # Demo mode
            if self.config.demo_mode:
                result = PaymentResult(
                    tx_hash="0x" + "0" * 64 + "_gasless_demo",
                    from_address="0x" + "0" * 40,
                    to=args.get("to", ""),
                    amount=args.get("amount", ""),
                    token=args.get("token", ""),
                    network=network,
                    explorer_url=get_explorer_tx_url(network, "0x_demo"),
                    demo_mode=True,
                )
                return self._text_result(self._format_payment_result(result))

            return self._error_result("Gasless payments require bundler configuration")

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_get_bridge_fee(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/getBridgeFee tool."""
        try:
            from_chain = args.get("fromChain", "")
            to_chain = args.get("toChain", "")
            amount = args.get("amount", "")

            if not is_bridgeable_chain(from_chain):
                return self._error_result(f"Chain {from_chain} does not support USDT0 bridging")
            if not is_bridgeable_chain(to_chain):
                return self._error_result(f"Chain {to_chain} does not support USDT0 bridging")
            if from_chain == to_chain:
                return self._error_result("Source and destination chains must be different")

            result = BridgeFeeResult(
                native_fee="0.001",
                native_symbol=NATIVE_SYMBOLS.get(from_chain, "ETH"),
                from_chain=from_chain,
                to_chain=to_chain,
                amount=amount,
                estimated_time=300,
            )
            return self._text_result(self._format_bridge_fee_result(result))

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_bridge(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/bridge tool."""
        try:
            from_chain = args.get("fromChain", "")
            to_chain = args.get("toChain", "")
            amount = args.get("amount", "")

            if not is_bridgeable_chain(from_chain):
                return self._error_result(f"Chain {from_chain} does not support USDT0 bridging")
            if not is_bridgeable_chain(to_chain):
                return self._error_result(f"Chain {to_chain} does not support USDT0 bridging")
            if from_chain == to_chain:
                return self._error_result("Source and destination chains must be different")

            if not self.config.private_key and not self.config.demo_mode:
                return self._error_result(
                    "Private key not configured. Set T402_PRIVATE_KEY or enable T402_DEMO_MODE"
                )

            # Demo mode
            if self.config.demo_mode:
                demo_guid = "0x" + "a" * 64
                result = BridgeResultData(
                    tx_hash="0x" + "0" * 64 + "_bridge_demo",
                    message_guid=demo_guid,
                    from_chain=from_chain,
                    to_chain=to_chain,
                    amount=amount,
                    explorer_url=get_explorer_tx_url(from_chain, "0x_demo"),
                    tracking_url=LAYERZERO_SCAN_URL + demo_guid,
                    estimated_time=300,
                    demo_mode=True,
                )
                return self._text_result(self._format_bridge_result(result))

            return self._error_result("Bridge functionality requires private key configuration")

        except Exception as e:
            return self._error_result(str(e))

    # Result helpers

    def _text_result(self, text: str) -> ToolResult:
        """Create a text result."""
        return ToolResult(content=[ContentBlock(type="text", text=text)])

    def _error_result(self, message: str) -> ToolResult:
        """Create an error result."""
        return ToolResult(
            content=[ContentBlock(type="text", text=f"Error: {message}")],
            isError=True,
        )

    # Formatting helpers

    def _format_balance_result(self, result: NetworkBalance) -> str:
        """Format balance result as markdown."""
        lines = [f"## Balance on {result.network}", ""]

        if result.error:
            lines.append(f"Error: {result.error}")
            return "\n".join(lines)

        if result.native:
            lines.append(f"**Native ({result.native.token}):** {result.native.balance}")
            lines.append("")

        if result.tokens:
            lines.append("**Tokens:**")
            for token in result.tokens:
                lines.append(f"- {token.token}: {token.balance}")
        else:
            lines.append("No token balances found.")

        return "\n".join(lines)

    def _format_all_balances_result(self, results: list[NetworkBalance]) -> str:
        """Format all balances result as markdown."""
        lines = ["## Balances Across All Networks", ""]

        for result in results:
            if result.error:
                lines.append(f"### {result.network}")
                lines.append(f"❌ {result.error}")
                lines.append("")
                continue

            lines.append(f"### {result.network}")
            if result.native:
                lines.append(f"- Native ({result.native.token}): {result.native.balance}")
            for token in result.tokens:
                lines.append(f"- {token.token}: {token.balance}")
            lines.append("")

        return "\n".join(lines)

    def _format_payment_result(self, result: PaymentResult) -> str:
        """Format payment result as markdown."""
        lines = []

        if result.demo_mode:
            lines.extend([
                "## Payment (Demo Mode)",
                "",
                "⚠️ This is a simulated transaction. No actual tokens were transferred.",
                "",
            ])
        else:
            lines.extend(["## Payment Successful", ""])

        lines.extend([
            f"- **Amount:** {result.amount} {result.token}",
            f"- **To:** {result.to}",
            f"- **Network:** {result.network}",
            f"- **Transaction:** [{self._truncate_hash(result.tx_hash)}]({result.explorer_url})",
        ])

        return "\n".join(lines)

    def _format_bridge_fee_result(self, result: BridgeFeeResult) -> str:
        """Format bridge fee result as markdown."""
        return "\n".join([
            "## Bridge Fee Quote",
            "",
            f"- **From:** {result.from_chain}",
            f"- **To:** {result.to_chain}",
            f"- **Amount:** {result.amount} USDT0",
            f"- **Fee:** {result.native_fee} {result.native_symbol}",
            f"- **Estimated Time:** ~{result.estimated_time} seconds",
        ])

    def _format_bridge_result(self, result: BridgeResultData) -> str:
        """Format bridge result as markdown."""
        lines = []

        if result.demo_mode:
            lines.extend([
                "## Bridge (Demo Mode)",
                "",
                "⚠️ This is a simulated bridge. No actual tokens were transferred.",
                "",
            ])
        else:
            lines.extend(["## Bridge Initiated", ""])

        lines.extend([
            f"- **Amount:** {result.amount} USDT0",
            f"- **From:** {result.from_chain}",
            f"- **To:** {result.to_chain}",
            f"- **Transaction:** [{self._truncate_hash(result.tx_hash)}]({result.explorer_url})",
            f"- **Track:** [LayerZero Scan]({result.tracking_url})",
            f"- **Estimated Delivery:** ~{result.estimated_time} seconds",
        ])

        return "\n".join(lines)

    def _truncate_hash(self, hash_str: str) -> str:
        """Truncate a hash for display."""
        if len(hash_str) <= 16:
            return hash_str
        return f"{hash_str[:8]}...{hash_str[-6:]}"

    def _serialize_response(self, response: JSONRPCResponse) -> str:
        """Serialize response to JSON."""
        data = {"jsonrpc": response.jsonrpc, "id": response.id}

        if response.error:
            data["error"] = {
                "code": response.error.code,
                "message": response.error.message,
            }
            if response.error.data:
                data["error"]["data"] = response.error.data
        else:
            data["result"] = response.result

        return json.dumps(data)


def load_config_from_env() -> ServerConfig:
    """Load server configuration from environment variables."""
    config = ServerConfig(
        private_key=os.environ.get("T402_PRIVATE_KEY"),
        demo_mode=os.environ.get("T402_DEMO_MODE", "").lower() == "true",
        bundler_url=os.environ.get("T402_BUNDLER_URL"),
        paymaster_url=os.environ.get("T402_PAYMASTER_URL"),
    )

    # Load network-specific RPC URLs
    for network in ALL_NETWORKS:
        env_key = f"T402_RPC_{network.upper()}"
        if url := os.environ.get(env_key):
            config.rpc_urls[network] = url

    return config


def run_server() -> None:
    """Run the MCP server (entry point for CLI)."""
    config = load_config_from_env()
    server = T402McpServer(config)
    asyncio.run(server.run())


if __name__ == "__main__":
    run_server()
