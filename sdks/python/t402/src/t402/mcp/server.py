"""T402 MCP Server implementation."""

import asyncio
import json
import os
import sys
from dataclasses import asdict
from typing import Any, Optional, TextIO

from .constants import (
    ALL_NETWORKS,
    CHAIN_IDS,
    LAYERZERO_ENDPOINT_IDS,
    LAYERZERO_SCAN_URL,
    NATIVE_DECIMALS,
    NATIVE_SYMBOLS,
    TOKEN_DECIMALS,
    USDT0_ADDRESSES,
    format_token_amount,
    get_explorer_tx_url,
    get_rpc_url,
    get_token_address,
    is_bridgeable_chain,
    is_gasless_network,
    is_valid_network,
    parse_token_amount,
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
from .web3_utils import (
    execute_bridge_send,
    extract_message_guid_from_receipt,
    format_wei_to_ether,
    get_erc20_balance,
    get_native_balance,
    get_web3_provider,
    quote_bridge_fee,
    run_sync_in_executor,
    transfer_erc20,
)


# Estimated bridge times in seconds per destination chain
ESTIMATED_BRIDGE_TIMES: dict[str, int] = {
    "ethereum": 900,  # 15 minutes
    "arbitrum": 300,  # 5 minutes
    "ink": 300,
    "berachain": 300,
    "unichain": 300,
}


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

        return {
            "content": [asdict(c) for c in result.content],
            "isError": result.isError,
        }

    def _get_web3(self, network: str) -> Any:
        """Get a Web3 provider for the given network.

        Args:
            network: Network name

        Returns:
            Web3 instance
        """
        rpc_url = get_rpc_url(self.config, network)
        if not rpc_url:
            raise ValueError(f"No RPC URL configured for {network}")
        return get_web3_provider(rpc_url)

    async def _fetch_single_balance(
        self, address: str, network: str
    ) -> NetworkBalance:
        """Fetch balance for a single network, returning a NetworkBalance.

        Args:
            address: Wallet address to check
            network: Network name

        Returns:
            NetworkBalance with native and token balances
        """
        try:
            w3 = self._get_web3(network)

            # Get native balance
            native_raw = await run_sync_in_executor(
                get_native_balance, w3, address
            )
            native_formatted = format_token_amount(native_raw, NATIVE_DECIMALS)

            result = NetworkBalance(
                network=network,
                native=BalanceInfo(
                    token=NATIVE_SYMBOLS.get(network, "ETH"),
                    balance=native_formatted,
                    raw=str(native_raw),
                ),
                tokens=[],
            )

            # Get token balances for USDC, USDT, USDT0
            tokens_to_check = ["USDC", "USDT", "USDT0"]
            for token_name in tokens_to_check:
                token_addr = get_token_address(network, token_name)
                if not token_addr:
                    continue

                try:
                    balance = await run_sync_in_executor(
                        get_erc20_balance, w3, token_addr, address
                    )
                    if balance > 0:
                        result.tokens.append(
                            BalanceInfo(
                                token=token_name,
                                balance=format_token_amount(balance, TOKEN_DECIMALS),
                                raw=str(balance),
                            )
                        )
                except Exception:
                    # Skip token if query fails
                    continue

            return result

        except Exception as e:
            return NetworkBalance(
                network=network,
                error=str(e),
            )

    async def _handle_get_balance(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/getBalance tool.

        Connects to the network via RPC, queries native and ERC-20 token
        balances, and returns formatted results. Falls back to demo mode
        when no RPC is available.
        """
        try:
            address = args.get("address", "")
            network = args.get("network", "")

            if not is_valid_network(network):
                return self._error_result(f"Invalid network: {network}")

            # Demo mode returns placeholder data
            if self.config.demo_mode:
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

            # Real mode: query blockchain
            result = await self._fetch_single_balance(address, network)
            return self._text_result(self._format_balance_result(result))

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_get_all_balances(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/getAllBalances tool.

        Queries all supported networks in parallel using asyncio.gather,
        reusing _fetch_single_balance per network. Handles per-network
        errors gracefully.
        """
        try:
            address = args.get("address", "")

            # Demo mode returns placeholder data
            if self.config.demo_mode:
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

            # Real mode: query all networks in parallel
            tasks = [
                self._fetch_single_balance(address, network)
                for network in ALL_NETWORKS
            ]
            results = await asyncio.gather(*tasks)
            return self._text_result(self._format_all_balances_result(list(results)))

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_pay(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/pay tool.

        Validates token support on network, parses amount with correct
        decimals, builds and signs an ERC-20 transfer transaction via web3,
        sends and waits for receipt, and returns the tx hash and explorer URL.
        Falls back to demo mode when no private key is configured.
        """
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

            # Real mode: execute ERC-20 transfer
            raw_amount = parse_token_amount(amount, TOKEN_DECIMALS)
            w3 = self._get_web3(network)

            receipt = await run_sync_in_executor(
                transfer_erc20,
                w3,
                self.config.private_key,
                token_addr,
                to,
                raw_amount,
            )

            tx_hash = receipt["transactionHash"].hex()
            if not tx_hash.startswith("0x"):
                tx_hash = "0x" + tx_hash

            # Derive from_address from private key
            from_address = w3.eth.account.from_key(
                self.config.private_key
            ).address

            result = PaymentResult(
                tx_hash=tx_hash,
                from_address=from_address,
                to=to,
                amount=amount,
                token=token,
                network=network,
                explorer_url=get_explorer_tx_url(network, tx_hash),
            )
            return self._text_result(self._format_payment_result(result))

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_pay_gasless(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/payGasless tool.

        Builds an ERC-4337 UserOperation using the existing t402.erc4337
        module, submits it to the bundler, polls for receipt, and returns
        the transaction hash. Falls back to demo mode when bundler is
        not configured.
        """
        try:
            network = args.get("network", "")
            to = args.get("to", "")
            amount = args.get("amount", "")
            token = args.get("token", "")

            if not is_gasless_network(network):
                return self._error_result(
                    f"Network {network} does not support gasless payments"
                )

            if not self.config.bundler_url and not self.config.demo_mode:
                return self._error_result(
                    "Bundler URL not configured. Set T402_BUNDLER_URL or enable T402_DEMO_MODE"
                )

            # Demo mode
            if self.config.demo_mode:
                result = PaymentResult(
                    tx_hash="0x" + "0" * 64 + "_gasless_demo",
                    from_address="0x" + "0" * 40,
                    to=to,
                    amount=amount,
                    token=token,
                    network=network,
                    explorer_url=get_explorer_tx_url(network, "0x_demo"),
                    demo_mode=True,
                )
                return self._text_result(self._format_payment_result(result))

            # Real mode: build and submit ERC-4337 UserOperation
            token_addr = get_token_address(network, token)
            if not token_addr:
                return self._error_result(f"Token {token} not supported on {network}")

            if not self.config.private_key:
                return self._error_result(
                    "Private key not configured for gasless payments"
                )

            raw_amount = parse_token_amount(amount, TOKEN_DECIMALS)
            chain_id = CHAIN_IDS.get(network)
            if not chain_id:
                return self._error_result(f"Chain ID not found for {network}")

            # Use ERC-4337 module to build and submit UserOperation
            from t402.erc4337 import (
                GenericBundlerClient,
                BundlerConfig,
                ENTRYPOINT_V07_ADDRESS,
                UserOperation,
            )
            from web3 import Web3

            w3 = self._get_web3(network)

            # Encode the ERC-20 transfer call data
            transfer_selector = Web3.keccak(text="transfer(address,uint256)")[:4]
            to_padded = bytes.fromhex(to[2:]).rjust(32, b"\x00")
            amount_padded = raw_amount.to_bytes(32, "big")
            call_data = transfer_selector + to_padded + amount_padded

            account = w3.eth.account.from_key(self.config.private_key)
            from_address = account.address

            nonce = await run_sync_in_executor(
                w3.eth.get_transaction_count, from_address
            )
            gas_price = await run_sync_in_executor(
                lambda: w3.eth.gas_price
            )

            user_op = UserOperation(
                sender=from_address,
                nonce=nonce,
                call_data=call_data,
                verification_gas_limit=150000,
                call_gas_limit=100000,
                pre_verification_gas=50000,
                max_fee_per_gas=gas_price,
                max_priority_fee_per_gas=gas_price // 10,
            )

            bundler = GenericBundlerClient(
                BundlerConfig(
                    bundler_url=self.config.bundler_url,
                    chain_id=chain_id,
                    entry_point=ENTRYPOINT_V07_ADDRESS,
                )
            )

            # Submit UserOperation
            user_op_hash = await run_sync_in_executor(
                bundler.send_user_operation, user_op
            )

            # Poll for receipt
            receipt = await run_sync_in_executor(
                bundler.wait_for_receipt, user_op_hash, 60.0, 2.0
            )

            tx_hash = receipt.transaction_hash or user_op_hash

            pay_result = PaymentResult(
                tx_hash=tx_hash,
                from_address=from_address,
                to=to,
                amount=amount,
                token=token,
                network=network,
                explorer_url=get_explorer_tx_url(network, tx_hash),
            )
            return self._text_result(self._format_payment_result(pay_result))

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_get_bridge_fee(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/getBridgeFee tool.

        Queries the LayerZero OFT contract's quoteSend function to get
        the actual bridge fee estimate. Falls back to demo mode when
        no RPC is available.
        """
        try:
            from_chain = args.get("fromChain", "")
            to_chain = args.get("toChain", "")
            amount = args.get("amount", "")
            recipient = args.get("recipient", "")

            if not is_bridgeable_chain(from_chain):
                return self._error_result(
                    f"Chain {from_chain} does not support USDT0 bridging"
                )
            if not is_bridgeable_chain(to_chain):
                return self._error_result(
                    f"Chain {to_chain} does not support USDT0 bridging"
                )
            if from_chain == to_chain:
                return self._error_result(
                    "Source and destination chains must be different"
                )

            # Demo mode returns estimated fee
            if self.config.demo_mode:
                result = BridgeFeeResult(
                    native_fee="0.001",
                    native_symbol=NATIVE_SYMBOLS.get(from_chain, "ETH"),
                    from_chain=from_chain,
                    to_chain=to_chain,
                    amount=amount,
                    estimated_time=ESTIMATED_BRIDGE_TIMES.get(to_chain, 300),
                )
                return self._text_result(self._format_bridge_fee_result(result))

            # Real mode: query OFT contract
            oft_address = USDT0_ADDRESSES.get(from_chain)
            if not oft_address:
                return self._error_result(f"USDT0 not found on {from_chain}")

            dst_eid = LAYERZERO_ENDPOINT_IDS.get(to_chain)
            if not dst_eid:
                return self._error_result(
                    f"LayerZero endpoint ID not found for {to_chain}"
                )

            raw_amount = parse_token_amount(amount, TOKEN_DECIMALS)
            w3 = self._get_web3(from_chain)

            native_fee, _lz_fee = await run_sync_in_executor(
                quote_bridge_fee,
                w3,
                oft_address,
                dst_eid,
                recipient,
                raw_amount,
                raw_amount,  # minAmount = amount for quote (no slippage)
            )

            native_symbol = NATIVE_SYMBOLS.get(from_chain, "ETH")
            fee_formatted = format_wei_to_ether(native_fee)

            result = BridgeFeeResult(
                native_fee=f"{fee_formatted} {native_symbol}",
                native_symbol=native_symbol,
                from_chain=from_chain,
                to_chain=to_chain,
                amount=amount,
                estimated_time=ESTIMATED_BRIDGE_TIMES.get(to_chain, 300),
            )
            return self._text_result(self._format_bridge_fee_result(result))

        except Exception as e:
            return self._error_result(str(e))

    async def _handle_bridge(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/bridge tool.

        Executes a LayerZero OFT send transaction to bridge USDT0
        between chains. Gets a fee quote, executes the send with
        a 10% fee buffer, and extracts the message GUID from the
        OFTSent event logs. Falls back to demo mode when no private
        key is configured.
        """
        try:
            from_chain = args.get("fromChain", "")
            to_chain = args.get("toChain", "")
            amount = args.get("amount", "")
            recipient = args.get("recipient", "")

            if not is_bridgeable_chain(from_chain):
                return self._error_result(
                    f"Chain {from_chain} does not support USDT0 bridging"
                )
            if not is_bridgeable_chain(to_chain):
                return self._error_result(
                    f"Chain {to_chain} does not support USDT0 bridging"
                )
            if from_chain == to_chain:
                return self._error_result(
                    "Source and destination chains must be different"
                )

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
                    estimated_time=ESTIMATED_BRIDGE_TIMES.get(to_chain, 300),
                    demo_mode=True,
                )
                return self._text_result(self._format_bridge_result(result))

            # Real mode: execute LayerZero OFT bridge
            oft_address = USDT0_ADDRESSES.get(from_chain)
            if not oft_address:
                return self._error_result(f"USDT0 not found on {from_chain}")

            dst_eid = LAYERZERO_ENDPOINT_IDS.get(to_chain)
            if not dst_eid:
                return self._error_result(
                    f"LayerZero endpoint ID not found for {to_chain}"
                )

            raw_amount = parse_token_amount(amount, TOKEN_DECIMALS)

            # Calculate min amount with 0.5% slippage
            min_amount = raw_amount - (raw_amount * 50) // 10000

            w3 = self._get_web3(from_chain)

            # Get fee quote
            native_fee, _lz_fee = await run_sync_in_executor(
                quote_bridge_fee,
                w3,
                oft_address,
                dst_eid,
                recipient,
                raw_amount,
                min_amount,
            )

            # Add 10% buffer to fee
            native_fee_with_buffer = (native_fee * 110) // 100

            # Check USDT0 balance
            balance = await run_sync_in_executor(
                get_erc20_balance, w3, oft_address,
                w3.eth.account.from_key(self.config.private_key).address,
            )
            if balance < raw_amount:
                return self._error_result(
                    f"Insufficient USDT0 balance: have {format_token_amount(balance, TOKEN_DECIMALS)}, "
                    f"need {amount}"
                )

            # Execute bridge send
            receipt = await run_sync_in_executor(
                execute_bridge_send,
                w3,
                self.config.private_key,
                oft_address,
                dst_eid,
                recipient,
                raw_amount,
                min_amount,
                native_fee_with_buffer,
            )

            tx_hash = receipt["transactionHash"].hex()
            if not tx_hash.startswith("0x"):
                tx_hash = "0x" + tx_hash

            # Extract message GUID from logs
            message_guid = extract_message_guid_from_receipt(receipt)
            if not message_guid:
                return self._error_result(
                    "Bridge transaction succeeded but failed to extract message GUID from logs"
                )

            estimated_time = ESTIMATED_BRIDGE_TIMES.get(to_chain, 300)

            bridge_result = BridgeResultData(
                tx_hash=tx_hash,
                message_guid=message_guid,
                from_chain=from_chain,
                to_chain=to_chain,
                amount=amount,
                explorer_url=get_explorer_tx_url(from_chain, tx_hash),
                tracking_url=LAYERZERO_SCAN_URL + message_guid,
                estimated_time=estimated_time,
            )
            return self._text_result(self._format_bridge_result(bridge_result))

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
                lines.append(f"Error: {result.error}")
                lines.append("")
                continue

            lines.append(f"### {result.network}")
            if result.native:
                lines.append(
                    f"- Native ({result.native.token}): {result.native.balance}"
                )
            for token in result.tokens:
                lines.append(f"- {token.token}: {token.balance}")
            lines.append("")

        return "\n".join(lines)

    def _format_payment_result(self, result: PaymentResult) -> str:
        """Format payment result as markdown."""
        lines = []

        if result.demo_mode:
            lines.extend(
                [
                    "## Payment (Demo Mode)",
                    "",
                    "This is a simulated transaction. No actual tokens were transferred.",
                    "",
                ]
            )
        else:
            lines.extend(["## Payment Successful", ""])

        lines.extend(
            [
                f"- **Amount:** {result.amount} {result.token}",
                f"- **To:** {result.to}",
                f"- **Network:** {result.network}",
                f"- **Transaction:** [{self._truncate_hash(result.tx_hash)}]({result.explorer_url})",
            ]
        )

        return "\n".join(lines)

    def _format_bridge_fee_result(self, result: BridgeFeeResult) -> str:
        """Format bridge fee result as markdown."""
        return "\n".join(
            [
                "## Bridge Fee Quote",
                "",
                f"- **From:** {result.from_chain}",
                f"- **To:** {result.to_chain}",
                f"- **Amount:** {result.amount} USDT0",
                f"- **Fee:** {result.native_fee} {result.native_symbol}",
                f"- **Estimated Time:** ~{result.estimated_time} seconds",
            ]
        )

    def _format_bridge_result(self, result: BridgeResultData) -> str:
        """Format bridge result as markdown."""
        lines = []

        if result.demo_mode:
            lines.extend(
                [
                    "## Bridge (Demo Mode)",
                    "",
                    "This is a simulated bridge. No actual tokens were transferred.",
                    "",
                ]
            )
        else:
            lines.extend(["## Bridge Initiated", ""])

        lines.extend(
            [
                f"- **Amount:** {result.amount} USDT0",
                f"- **From:** {result.from_chain}",
                f"- **To:** {result.to_chain}",
                f"- **Transaction:** [{self._truncate_hash(result.tx_hash)}]({result.explorer_url})",
                f"- **Track:** [LayerZero Scan]({result.tracking_url})",
                f"- **Estimated Delivery:** ~{result.estimated_time} seconds",
            ]
        )

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
