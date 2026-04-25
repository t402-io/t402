"""T402 MCP Server implementation."""

import asyncio
import json
import os
import sys
import time
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
from .price_service import get_token_prices, get_token_prices_demo
from .quote_store import clear_quote_store, create_quote, delete_quote, get_quote
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
        elif tool_name == "t402/getTokenPrice":
            result = await self._handle_get_token_price(arguments)
        elif tool_name == "t402/getGasPrice":
            result = await self._handle_get_gas_price(arguments)
        elif tool_name == "t402/signMessage":
            result = self._handle_sign_message(arguments)
        elif tool_name == "t402/wdk/getWallet":
            result = self._handle_wdk_get_wallet(arguments)
        elif tool_name == "t402/wdk/getBalances":
            result = await self._handle_wdk_get_balances(arguments)
        elif tool_name == "t402/wdk/transfer":
            result = await self._handle_wdk_transfer(arguments)
        elif tool_name in ("t402/wdk/swap", "t402/wdk/quoteSwap", "t402/wdk/executeSwap"):
            result = self._handle_wdk_swap_stub()
        elif tool_name == "t402/verifySignature":
            result = self._handle_verify_signature(arguments)
        elif tool_name == "t402/estimatePaymentFee":
            result = await self._handle_estimate_payment_fee(arguments)
        elif tool_name == "t402/compareNetworkFees":
            result = await self._handle_compare_network_fees(arguments)
        elif tool_name == "t402/getHistoricalPrice":
            result = await self._handle_get_historical_price(arguments)
        elif tool_name == "t402/quoteBridge":
            result = await self._handle_quote_bridge(arguments)
        elif tool_name == "t402/executeBridgeFromQuote":
            result = await self._handle_execute_bridge_from_quote(arguments)
        elif tool_name == "t402/searchBazaar":
            result = await self._handle_search_bazaar(arguments)
        elif tool_name in (
            "t402/payForService",
            "t402/autoPay",
            "t402/erc8004/resolveAgent",
            "t402/erc8004/verifyWallet",
            "t402/erc8004/checkReputation",
        ):
            result = self._handle_batch4_stub(tool_name)
        elif tool_name == "t402/getTransferHistory":
            result = await self._handle_get_transfer_history(arguments)
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

    # ------------------------------------------------------------------
    # Phase C cross-SDK parity additions (2026-04-24)
    # ------------------------------------------------------------------

    async def _handle_get_token_price(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/getTokenPrice.

        Fetches live prices from CoinGecko (with a 5-minute in-memory
        cache) or returns a fixed demo table when demo_mode is set. The
        markdown output is sorted alphabetically so the same inputs
        produce the same output regardless of request order.
        """
        try:
            tokens = args.get("tokens", [])
            if not tokens or not isinstance(tokens, list):
                return self._error_result("tokens must not be empty")
            currency = (args.get("currency") or "usd").strip() or "usd"

            if self.config.demo_mode:
                prices = get_token_prices_demo(tokens)
            else:
                prices = await asyncio.get_event_loop().run_in_executor(
                    None, get_token_prices, tokens, currency
                )

            currency_upper = currency.upper()
            lines = ["## Token Prices", ""]
            for token in sorted(prices):
                price = prices[token]
                if price > 0:
                    lines.append(f"- **{token}:** {_format_price(price)} {currency_upper}")
                else:
                    lines.append(f"- **{token}:** Price unavailable")
            return self._text_result("\n".join(lines))
        except Exception as e:
            return self._error_result(f"Failed to fetch prices: {e}")

    async def _handle_get_gas_price(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/getGasPrice.

        Returns the network's current suggested gas price in both gwei and
        raw wei. Demo mode returns a plausible fixed value so callers can
        exercise the flow without an RPC.
        """
        try:
            network = args.get("network", "")
            if not is_valid_network(network):
                return self._error_result(f"Invalid network: {network}")

            if self.config.demo_mode:
                return self._text_result(
                    self._format_gas_price(network, 25_000_000_000, demo=True)
                )

            w3 = self._get_web3(network)
            gas_price = await run_sync_in_executor(lambda: w3.eth.gas_price)
            return self._text_result(self._format_gas_price(network, int(gas_price)))
        except Exception as e:
            return self._error_result(str(e))

    def _handle_sign_message(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/signMessage.

        Signs a plain-text message with the configured private key using
        EIP-191 personal_sign semantics. Returns the recovered address
        (derived from the key) together with the signature.
        """
        try:
            message = args.get("message", "")
            if not message:
                return self._error_result("message must not be empty")
            if not self.config.private_key:
                return self._error_result(
                    "Private key not configured. Set T402_PRIVATE_KEY to sign messages."
                )

            from eth_account import Account
            from eth_account.messages import encode_defunct

            account = Account.from_key(self.config.private_key)
            signable = encode_defunct(text=message)
            signed = account.sign_message(signable)
            signature = signed.signature.hex()
            if not signature.startswith("0x"):
                signature = "0x" + signature

            lines = [
                "## Signed Message",
                "",
                f"- **Address:** {account.address}",
                f"- **Message:** {message}",
                f"- **Signature:** {signature}",
            ]
            return self._text_result("\n".join(lines))
        except Exception as e:
            return self._error_result(str(e))

    def _format_gas_price(self, network: str, gas_price_wei: int, demo: bool = False) -> str:
        """Format gas price output as markdown."""
        gwei = gas_price_wei / 1e9
        lines = [
            f"## Gas Price on {network}",
            "",
            f"- **Gas Price:** {gwei:.3f} gwei",
            f"- **Raw (wei):** {gas_price_wei}",
        ]
        if demo:
            lines.append("- **Mode:** demo (no RPC call)")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Phase C Batch 2 — WDK tool handlers (2026-04-24)
    # ------------------------------------------------------------------

    def _handle_wdk_get_wallet(self, _args: dict[str, Any]) -> ToolResult:
        """Handle t402/wdk/getWallet.

        Derives the EVM address from the configured private key (or
        reports a zero address in demo mode) and lists the chains the
        server is configured for.
        """
        try:
            chains = list(ALL_NETWORKS)
            demo_mode = self.config.demo_mode or not self.config.private_key

            if demo_mode:
                address = "0x0000000000000000000000000000000000000000"
            else:
                from eth_account import Account

                address = Account.from_key(self.config.private_key).address

            lines = [
                "## Wallet",
                "",
                f"- **EVM Address:** {address}",
                f"- **Chains:** {', '.join(chains)}",
            ]
            if demo_mode:
                lines.append("- **Mode:** demo (no private key configured)")
            return self._text_result("\n".join(lines))
        except Exception as e:
            return self._error_result(str(e))

    async def _handle_wdk_get_balances(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/wdk/getBalances.

        Returns a simplified per-chain view (usdt0, usdc, native) plus
        USDT0/USDC totals across all queried chains. Matches the TS
        wdk/getBalances schema for cross-SDK consistency.
        """
        try:
            chains_input = args.get("chains") or []
            if not isinstance(chains_input, list):
                return self._error_result("chains must be a list of strings")
            chains = chains_input or list(ALL_NETWORKS)

            # Validate chain names up-front so an obvious typo fails loud
            # rather than silently producing empty entries.
            for chain in chains:
                if not is_valid_network(chain):
                    return self._error_result(f"Invalid network: {chain}")

            demo_mode = self.config.demo_mode or not self.config.private_key
            address = (
                "0x0000000000000000000000000000000000000000"
                if demo_mode
                else __import__("eth_account").Account.from_key(
                    self.config.private_key
                ).address
            )

            entries: list[dict[str, str]] = []
            total_usdt0 = 0
            total_usdc = 0

            for chain in chains:
                if demo_mode:
                    entries.append(
                        {"chain": chain, "usdt0": "0", "usdc": "0", "native": "0"}
                    )
                    continue

                try:
                    w3 = self._get_web3(chain)
                    native_raw = await run_sync_in_executor(
                        get_native_balance, w3, address
                    )
                    usdt0_raw = 0
                    usdc_raw = 0

                    usdt0_addr = get_token_address(chain, "USDT0")
                    if usdt0_addr:
                        try:
                            usdt0_raw = await run_sync_in_executor(
                                get_erc20_balance, w3, usdt0_addr, address
                            )
                        except Exception:
                            pass
                    usdc_addr = get_token_address(chain, "USDC")
                    if usdc_addr:
                        try:
                            usdc_raw = await run_sync_in_executor(
                                get_erc20_balance, w3, usdc_addr, address
                            )
                        except Exception:
                            pass

                    entries.append(
                        {
                            "chain": chain,
                            "usdt0": format_token_amount(usdt0_raw, TOKEN_DECIMALS),
                            "usdc": format_token_amount(usdc_raw, TOKEN_DECIMALS),
                            "native": format_token_amount(native_raw, NATIVE_DECIMALS),
                        }
                    )
                    total_usdt0 += int(usdt0_raw)
                    total_usdc += int(usdc_raw)
                except Exception as e:
                    entries.append(
                        {
                            "chain": chain,
                            "usdt0": "0",
                            "usdc": "0",
                            "native": "0",
                            "error": str(e),
                        }
                    )

            lines = ["## WDK Balances", ""]
            for entry in entries:
                lines.append(f"### {entry['chain']}")
                lines.append(f"- USDT0: {entry['usdt0']}")
                lines.append(f"- USDC: {entry['usdc']}")
                lines.append(f"- Native: {entry['native']}")
                if "error" in entry:
                    lines.append(f"- Error: {entry['error']}")
                lines.append("")

            lines.append("## Totals")
            lines.append("")
            lines.append(f"- **USDT0:** {format_token_amount(total_usdt0, TOKEN_DECIMALS)}")
            lines.append(f"- **USDC:** {format_token_amount(total_usdc, TOKEN_DECIMALS)}")
            if demo_mode:
                lines.append("")
                lines.append("_Demo mode — balances are zero._")
            return self._text_result("\n".join(lines))
        except Exception as e:
            return self._error_result(str(e))

    async def _handle_wdk_transfer(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/wdk/transfer.

        Confirmation-gated: unconfirmed requests return a preview; a
        confirmed request delegates to the core `_handle_pay` handler
        (wdk/transfer maps `chain` to pay's `network`).
        """
        try:
            to = args.get("to", "")
            amount = args.get("amount", "")
            token = args.get("token", "")
            chain = args.get("chain", "")
            confirmed = bool(args.get("confirmed", False))

            if not is_valid_network(chain):
                return self._error_result(f"Invalid chain: {chain}")

            if not confirmed:
                lines = [
                    "## Transfer Preview (NOT executed)",
                    "",
                    f"- **Amount:** {amount} {token}",
                    f"- **To:** {to}",
                    f"- **Chain:** {chain}",
                    "",
                    "Set `confirmed: true` to execute.",
                ]
                return self._text_result("\n".join(lines))

            # Delegate to pay handler. Repackage `chain` → `network`; other
            # fields are structurally identical.
            pay_args = {
                "to": to,
                "amount": amount,
                "token": token,
                "network": chain,
            }
            return await self._handle_pay(pay_args)
        except Exception as e:
            return self._error_result(str(e))

    def _handle_wdk_swap_stub(self) -> ToolResult:
        """Shared handler for t402/wdk/swap, quoteSwap, executeSwap.

        The Python SDK has no equivalent to @tetherto/wdk and does not
        bundle a DEX aggregator client; the tool schemas exist for
        cross-SDK parity at the discovery level but the handlers return
        an error pointing callers to the TypeScript SDK. See
        memory/phase-c-d-decisions-2026-04-24.md for context.
        """
        return self._error_result(
            "swap is not supported in the Python SDK. "
            "Use the TypeScript SDK (@t402/mcp) for swap workflows — "
            "it integrates with Tether WDK via wdk-swap-jupiter (SVM) "
            "and @tetherto/wdk-protocol-swap-velora-evm (EVM). "
            "The wdk/swap, wdk/quoteSwap, and wdk/executeSwap schemas "
            "are exposed here for cross-SDK parity at the tool-discovery "
            "level only."
        )

    # ------------------------------------------------------------------
    # Phase C Batch 3 — six high-utility tools (2026-04-24)
    # ------------------------------------------------------------------

    def _handle_verify_signature(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/verifySignature — EIP-191 verify via eth_account."""
        try:
            chain = args.get("chain", "")
            message = args.get("message", "")
            signature = args.get("signature", "")
            address = args.get("address", "")

            if not message:
                return self._error_result("message must not be empty")
            if not is_valid_network(chain):
                return self._error_result(f"Invalid chain: {chain}")
            if not address.startswith("0x") or len(address) != 42:
                return self._error_result(
                    "address must be a 0x-prefixed 20-byte hex address"
                )

            recovered: Optional[str] = None
            error: Optional[str] = None
            valid = False
            try:
                from eth_account import Account
                from eth_account.messages import encode_defunct

                encoded = encode_defunct(text=message)
                recovered = Account.recover_message(encoded, signature=signature)
                valid = recovered.lower() == address.lower()
            except Exception as e:
                error = str(e)

            lines = [
                "## Signature Verification",
                "",
                f"- **Valid:** {str(valid).lower()}",
                f"- **Expected Address:** {address}",
                f"- **Network:** {chain}",
                f"- **Message:** {message}",
            ]
            if recovered and not valid:
                lines.append(f"- **Recovered Address:** {recovered}")
            if error:
                lines.append(f"- **Error:** {error}")
            return self._text_result("\n".join(lines))
        except Exception as e:
            return self._error_result(str(e))

    async def _handle_estimate_payment_fee(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/estimatePaymentFee. See `_estimate_payment_fee`."""
        try:
            network = args.get("network", "")
            amount = args.get("amount", "")
            token = args.get("token", "")

            if not is_valid_network(network):
                return self._error_result(f"Invalid network: {network}")

            estimate = await self._estimate_payment_fee(network, amount, token)
            return self._text_result(self._format_payment_fee(estimate))
        except Exception as e:
            return self._error_result(str(e))

    async def _estimate_payment_fee(
        self, network: str, amount: str, token: str
    ) -> dict[str, str]:
        """Compute a payment fee estimate for a single network.

        Demo mode uses a canned table so the call works offline; live
        mode estimates gas via web3, fetches the current gas price, and
        converts the native cost to USD via CoinGecko when possible.
        """
        native_symbol = NATIVE_SYMBOLS.get(network, "ETH")
        demo_mode = self.config.demo_mode

        if demo_mode:
            return self._demo_payment_fee(network, native_symbol)

        token_addr = get_token_address(network, token)
        if not token_addr:
            raise ValueError(f"token {token} not supported on {network}")

        w3 = self._get_web3(network)
        from web3 import Web3

        transfer_selector = Web3.keccak(text="transfer(address,uint256)")[:4]
        dummy_to = "0x000000000000000000000000000000000000dEaD"
        raw_amount = parse_token_amount(amount, TOKEN_DECIMALS)
        call_data = (
            transfer_selector
            + bytes.fromhex(dummy_to[2:]).rjust(32, b"\x00")
            + raw_amount.to_bytes(32, "big")
        )
        try:
            gas_limit = await run_sync_in_executor(
                lambda: w3.eth.estimate_gas({"to": token_addr, "data": call_data})
            )
        except Exception:
            gas_limit = 65_000

        gas_price = await run_sync_in_executor(lambda: w3.eth.gas_price)
        native_cost_wei = gas_limit * gas_price

        usd_cost = "unknown"
        try:
            prices = await run_sync_in_executor(
                get_token_prices, [native_symbol], "usd"
            )
            native_price = prices.get(native_symbol.upper(), 0.0)
            if native_price > 0:
                native_cost_eth = native_cost_wei / 1e18
                usd_cost = f"${native_cost_eth * native_price:.4f}"
        except Exception:
            pass

        return {
            "network": network,
            "gasLimit": str(gas_limit),
            "gasPriceGwei": f"{gas_price / 1e9:.3f}",
            "nativeCost": f"{native_cost_wei / 1e18:.9f}",
            "nativeSymbol": native_symbol,
            "usdCost": usd_cost,
        }

    def _demo_payment_fee(self, network: str, native_symbol: str) -> dict[str, str]:
        """Canned payment-fee estimate mirroring the TS demo table."""
        table = {
            "ethereum": (65_000, 25_000_000_000, 3250.42),
            "base": (65_000, 50_000_000, 3250.42),
            "arbitrum": (65_000, 100_000_000, 3250.42),
            "optimism": (65_000, 50_000_000, 3250.42),
            "polygon": (65_000, 30_000_000_000, 0.58),
            "avalanche": (65_000, 25_000_000_000, 24.15),
            "ink": (65_000, 50_000_000, 3250.42),
            "berachain": (65_000, 1_000_000_000, 3.82),
            "unichain": (65_000, 50_000_000, 3250.42),
        }
        gas_limit, gas_price, native_price = table.get(network, table["ethereum"])
        native_cost_wei = gas_limit * gas_price
        native_cost_eth = native_cost_wei / 1e18
        return {
            "network": network,
            "gasLimit": str(gas_limit),
            "gasPriceGwei": f"{gas_price / 1e9:.3f}",
            "nativeCost": f"{native_cost_eth:.9f}",
            "nativeSymbol": native_symbol,
            "usdCost": f"${native_cost_eth * native_price:.4f}",
        }

    def _format_payment_fee(self, e: dict[str, str]) -> str:
        return "\n".join(
            [
                f"## Payment Fee Estimate ({e['network']})",
                "",
                f"- **Gas Limit:** {e['gasLimit']}",
                f"- **Gas Price:** {e['gasPriceGwei']} gwei",
                f"- **Native Cost:** {e['nativeCost']} {e['nativeSymbol']}",
                f"- **USD Cost:** {e['usdCost']}",
            ]
        )

    async def _handle_compare_network_fees(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/compareNetworkFees — aggregates estimatePaymentFee."""
        try:
            amount = args.get("amount", "")
            token = args.get("token", "")
            networks = args.get("networks") or list(ALL_NETWORKS)

            for network in networks:
                if not is_valid_network(network):
                    return self._error_result(f"Invalid network: {network}")

            estimates: list[dict[str, str]] = []
            for network in networks:
                try:
                    estimates.append(
                        await self._estimate_payment_fee(network, amount, token)
                    )
                except Exception:
                    # Skip networks that don't support this token.
                    continue

            # Sort by USD cost ascending; unparseable entries sink.
            def _usd(e: dict[str, str]) -> float:
                s = e.get("usdCost", "").lstrip("$")
                try:
                    return float(s)
                except ValueError:
                    return float("inf")

            estimates.sort(key=_usd)

            lines = [
                f"## Network Fee Comparison for {amount} {token}",
                "",
            ]
            for e in estimates:
                lines.extend(
                    [
                        f"### {e['network']}",
                        f"- USD Cost: {e['usdCost']}",
                        f"- Native: {e['nativeCost']} {e['nativeSymbol']}",
                        f"- Gas Limit × Price: {e['gasLimit']} × {e['gasPriceGwei']} gwei",
                        "",
                    ]
                )
            if not estimates:
                lines.append("_No supported networks returned a successful estimate._")
            return self._text_result("\n".join(lines))
        except Exception as e:
            return self._error_result(str(e))

    async def _handle_get_historical_price(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/getHistoricalPrice — CoinGecko historical chart."""
        try:
            token = args.get("token", "")
            days = args.get("days") or 7

            if not token:
                return self._error_result("token must not be empty")
            if not isinstance(days, int) or days < 1 or days > 365:
                return self._error_result("days must be an integer between 1 and 365")

            if self.config.demo_mode:
                return self._text_result(self._demo_historical_price(token, days))

            from .price_service import TOKEN_TO_COINGECKO_ID

            coin_id = TOKEN_TO_COINGECKO_ID.get(token.upper(), token.lower())
            url = (
                f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
                f"?vs_currency=usd&days={days}"
            )

            from urllib.request import Request, urlopen
            import json as _json

            req = Request(url, headers={"User-Agent": "t402-mcp/1.0"})

            def _fetch() -> list[list[float]]:
                with urlopen(req, timeout=10) as resp:
                    if resp.status != 200:
                        raise RuntimeError(f"CoinGecko API error: {resp.status}")
                    data = _json.loads(resp.read().decode("utf-8"))
                    return data.get("prices", [])

            series: list[list[float]] = await run_sync_in_executor(_fetch)
            if not series:
                return self._error_result("CoinGecko returned no price data")

            return self._text_result(
                self._format_historical_price(token, coin_id, days, series)
            )
        except Exception as e:
            return self._error_result(str(e))

    def _format_historical_price(
        self,
        token: str,
        coin_id: str,
        days: int,
        series: list[list[float]],
    ) -> str:
        from datetime import datetime, timezone

        lines = [
            f"## Historical Price — {token.upper()} ({days} days)",
            "",
            f"- **CoinGecko ID:** {coin_id}",
            f"- **Data Points:** {len(series)}",
            "",
        ]
        start = series[0][1]
        end = series[-1][1]
        absolute = end - start
        percent = (absolute / start * 100) if start else 0.0
        lines.extend(
            [
                "**Price Change Over Period:**",
                f"- Start: ${start:.4f}",
                f"- End:   ${end:.4f}",
                f"- Change: ${absolute:.4f} ({percent:.2f}%)",
                "",
                "**Sample Points:**",
            ]
        )
        step = max(1, len(series) // 10)
        for i in range(0, len(series), step):
            ts = int(series[i][0]) // 1000
            date = datetime.fromtimestamp(ts, tz=timezone.utc).strftime(
                "%Y-%m-%d %H:%M"
            )
            lines.append(f"- {date}: ${series[i][1]:.4f}")
        return "\n".join(lines)

    def _demo_historical_price(self, token: str, days: int) -> str:
        from datetime import datetime, timezone

        now = int(time.time())
        points = [
            (now - days * 86400, 3000.0),
            (now - days * 64800, 3100.0),
            (now - days * 43200, 3200.0),
            (now, 3250.0),
        ]
        lines = [
            f"## Historical Price — {token.upper()} ({days} days) [demo]",
            "",
            "- **Demo mode** — synthetic data, CoinGecko was not contacted.",
            "",
            "**Price Change Over Period:** $250.00 (+8.33%)",
            "",
            "**Sample Points:**",
        ]
        for ts, price in points:
            date = datetime.fromtimestamp(ts, tz=timezone.utc).strftime(
                "%Y-%m-%d %H:%M"
            )
            lines.append(f"- {date}: ${price:.4f}")
        return "\n".join(lines)

    async def _handle_quote_bridge(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/quoteBridge — wraps getBridgeFee with a stored quoteId."""
        try:
            from_chain = args.get("fromChain", "")
            to_chain = args.get("toChain", "")
            amount = args.get("amount", "")
            recipient = args.get("recipient", "")

            # Build the fee quote using the existing getBridgeFee handler.
            fee_result = await self._handle_get_bridge_fee(args)
            if fee_result.isError:
                return fee_result

            quote_id = create_quote(
                "bridge",
                {
                    "fromChain": from_chain,
                    "toChain": to_chain,
                    "amount": amount,
                    "recipient": recipient,
                },
            )

            from datetime import datetime, timedelta, timezone

            expires_at = (
                datetime.now(timezone.utc) + timedelta(minutes=5)
            ).isoformat()

            lines = [
                "## Bridge Quote",
                "",
                f"- **Quote ID:** `{quote_id}`",
                f"- **From:** {from_chain}",
                f"- **To:** {to_chain}",
                f"- **Amount:** {amount} USDT0",
                f"- **Recipient:** {recipient}",
                f"- **Expires At:** {expires_at}",
                "",
                "Fee detail:",
                fee_result.content[0].text,
                "",
                "Submit `quoteId` to `t402/executeBridgeFromQuote` with `confirmed: true` to execute.",
            ]
            return self._text_result("\n".join(lines))
        except Exception as e:
            return self._error_result(str(e))

    async def _handle_execute_bridge_from_quote(
        self, args: dict[str, Any]
    ) -> ToolResult:
        """Handle t402/executeBridgeFromQuote."""
        try:
            quote_id = args.get("quoteId", "")
            confirmed = bool(args.get("confirmed", False))

            if not quote_id:
                return self._error_result("quoteId must not be empty")

            quote = get_quote(quote_id)
            if quote is None:
                return self._error_result(
                    "Quote not found or expired. Please request a new quote."
                )
            if quote.type != "bridge":
                return self._error_result(
                    "Invalid quote type. Expected a bridge quote."
                )

            data = quote.data
            from_chain = data.get("fromChain", "")
            to_chain = data.get("toChain", "")
            amount = data.get("amount", "")
            recipient = data.get("recipient", "")

            if not confirmed:
                lines = [
                    "## Bridge Preview (NOT executed)",
                    "",
                    f"- **Quote ID:** `{quote_id}`",
                    f"- **Amount:** {amount} USDT0",
                    f"- **From:** {from_chain}",
                    f"- **To:** {to_chain}",
                    f"- **Recipient:** {recipient}",
                    "",
                    "Set `confirmed: true` to execute.",
                ]
                return self._text_result("\n".join(lines))

            # Delegate to bridge handler, then consume the quote on success.
            bridge_args = {
                "fromChain": from_chain,
                "toChain": to_chain,
                "amount": amount,
                "recipient": recipient,
            }
            result = await self._handle_bridge(bridge_args)
            if not result.isError:
                delete_quote(quote_id)
            return result
        except Exception as e:
            return self._error_result(str(e))

    # ------------------------------------------------------------------
    # Phase C Batch 4 — bazaar discovery, transfer history, stubs (2026-04-25)
    # ------------------------------------------------------------------

    async def _handle_search_bazaar(self, args: dict[str, Any]) -> ToolResult:
        """Handle t402/searchBazaar.

        Calls bazaar.t402.io when reachable, falls back to a small
        curated demo set when offline. Schema and demo data mirror
        the TS implementation.
        """
        try:
            query = args.get("query", "")
            if not query:
                return self._error_result("query must not be empty")

            params: dict[str, str] = {"q": query}
            for key in ("category", "maxPrice", "network", "token", "tags"):
                value = args.get(key)
                if value:
                    params[key] = str(value)

            services = await self._fetch_bazaar_services(params)
            if services is None:
                services = self._bazaar_demo_results(query)
            if not services:
                return self._text_result("No services found.")

            lines = ["## Bazaar Results", ""]
            for svc in services:
                price = svc.get("price", {}) or {}
                amount = price.get("amount", "")
                try:
                    amount = f"{int(amount) / 1e6:.4f}"
                except (TypeError, ValueError):
                    pass
                lines.append(
                    f"• **{svc.get('name', '?')}** — {svc.get('description', '')}"
                )
                lines.append(f"  URL: {svc.get('url', '')}")
                lines.append(
                    f"  Price: {amount} {price.get('token', '?')} on {price.get('network', '?')}"
                )
                tags = svc.get("tags") or []
                if tags:
                    lines.append(f"  Tags: {', '.join(tags)}")
                lines.append("")
            return self._text_result("\n".join(lines))
        except Exception as e:
            return self._error_result(str(e))

    async def _fetch_bazaar_services(
        self, params: dict[str, str]
    ) -> Optional[list[dict[str, Any]]]:
        """Try the live bazaar API; return None on any failure so the
        caller falls back to demo results without a separate error path.
        """
        try:
            from urllib.parse import urlencode
            from urllib.request import Request, urlopen
            import json as _json

            url = f"https://bazaar.t402.io/api/v1/search?{urlencode(params)}"
            req = Request(url, headers={"User-Agent": "t402-mcp/1.0"})

            def _fetch() -> Optional[list[dict[str, Any]]]:
                with urlopen(req, timeout=10) as resp:
                    if resp.status != 200:
                        return None
                    payload = _json.loads(resp.read().decode("utf-8"))
                    return payload.get("services", [])

            return await run_sync_in_executor(_fetch)
        except Exception:
            return None

    def _bazaar_demo_results(self, query: str) -> list[dict[str, Any]]:
        """Mirrors the TS demo fallback set."""
        q = query.lower()
        catalogue = [
            {
                "url": "https://api.weather402.com/forecast",
                "name": "Weather Forecast API",
                "description": "Global weather data with hourly resolution, 7-day forecast",
                "category": "data",
                "price": {"amount": "1000", "token": "USDC", "network": "eip155:8453"},
                "methods": ["GET"],
            },
            {
                "url": "https://api.llm402.com/v1/chat/completions",
                "name": "LLM Inference API",
                "description": "Pay-per-request access to GPT-4, Claude, and open models",
                "category": "ai",
                "price": {"amount": "5000", "token": "USDC", "network": "eip155:8453"},
                "methods": ["POST"],
            },
            {
                "url": "https://api.market402.com/report",
                "name": "DeFi Market Intelligence",
                "description": "Weekly DeFi market analysis with trading signals and risk metrics",
                "category": "reports",
                "price": {"amount": "50000", "token": "USDT0", "network": "eip155:42161"},
                "methods": ["GET"],
            },
            {
                "url": "https://api.image402.com/generate",
                "name": "Image Generation API",
                "description": "High-res image generation via Stable Diffusion XL and Flux",
                "category": "ai",
                "price": {"amount": "2000", "token": "USDC", "network": "eip155:8453"},
                "methods": ["POST"],
            },
            {
                "url": "https://api.compute402.com/gpu/run",
                "name": "GPU Compute Service",
                "description": "On-demand GPU compute for ML inference (A100, H100)",
                "category": "compute",
                "price": {"amount": "100000", "token": "USDT0", "network": "eip155:42161"},
                "methods": ["POST"],
            },
        ]
        return [
            s
            for s in catalogue
            if q in s["name"].lower()
            or q in s["description"].lower()
            or q in s["category"].lower()
        ]

    def _handle_batch4_stub(self, tool_name: str) -> ToolResult:
        """Single error-stub handler shared by payForService, autoPay,
        and the three erc8004 tools. Each tool needs ABI bindings or a
        WDK-style orchestration layer that the Python SDK does not
        bundle yet — schemas exist for cross-SDK discovery parity but
        the handlers point callers at the TypeScript SDK.
        """
        if tool_name in ("t402/payForService", "t402/autoPay"):
            msg = (
                f"{tool_name.split('/')[1]} is not implemented in the Python SDK. "
                "These tools perform a multi-step orchestration "
                "(fetch → 402 detect → balance check → sign → retry) "
                "that depends on a WDK-style wallet abstraction. "
                "Use the TypeScript SDK (@t402/mcp) for now; the schema "
                "is exposed here for cross-SDK discovery parity only."
            )
        else:
            msg = (
                "ERC-8004 agent identity tools are not implemented in the "
                "Python SDK. resolveAgent / verifyWallet / checkReputation "
                "all require ERC-8004 contract ABI bindings that the "
                "Python SDK does not ship yet. Use the TypeScript SDK "
                "(@t402/mcp) for ERC-8004 flows. Schemas are exposed here "
                "for cross-SDK discovery parity."
            )
        return self._error_result(msg)

    async def _handle_get_transfer_history(
        self, args: dict[str, Any]
    ) -> ToolResult:
        """Handle t402/getTransferHistory.

        Queries the last 10,000 blocks for ERC-20 stablecoin Transfer
        events involving `address` (as sender or receiver), merges
        results across the configured stablecoins (or the requested
        single token), sorts newest-first, and trims to `limit`. Demo
        mode returns a placeholder note.
        """
        try:
            network = args.get("network", "")
            address = args.get("address", "")
            token = args.get("token", "") or ""
            limit = args.get("limit") or 10
            if not isinstance(limit, int) or limit <= 0:
                limit = 10
            if limit > 100:
                limit = 100

            if not is_valid_network(network):
                return self._error_result(f"Invalid network: {network}")
            if not address:
                return self._error_result("address must not be empty")

            if self.config.demo_mode:
                lines = [
                    f"## Transfer History — {address} on {network} [demo]",
                    "",
                    "_Demo mode — no RPC was queried._",
                    "",
                    f"Would have returned up to {limit} most recent ERC-20 transfers in the last 10,000 blocks.",
                ]
                return self._text_result("\n".join(lines))

            from web3 import Web3

            w3 = self._get_web3(network)
            latest = await run_sync_in_executor(lambda: w3.eth.block_number)
            from_block = max(0, latest - 10_000)

            tokens = [token] if token else ["USDC", "USDT", "USDT0"]
            transfer_topic = Web3.keccak(
                text="Transfer(address,address,uint256)"
            ).hex()
            address_topic = "0x" + address[2:].rjust(64, "0").lower()

            records: list[dict[str, Any]] = []
            for tok in tokens:
                token_addr = get_token_address(network, tok)
                if not token_addr:
                    continue

                for position in (1, 2):  # 1 = from, 2 = to
                    topics: list[Any] = [transfer_topic, None, None]
                    topics[position] = address_topic
                    filter_params = {
                        "fromBlock": from_block,
                        "toBlock": latest,
                        "address": token_addr,
                        "topics": topics,
                    }
                    try:
                        logs = await run_sync_in_executor(
                            lambda fp=filter_params: w3.eth.get_logs(fp)
                        )
                    except Exception:
                        continue
                    for lg in logs:
                        records.append(self._transfer_record(lg, tok, network))

            records.sort(
                key=lambda r: (r["blockNumber"], r["logIndex"]),
                reverse=True,
            )
            records = records[:limit]

            if not records:
                return self._text_result(
                    f"## Transfer History\n\nNo transfers found for {address} "
                    f"on {network} in the last 10,000 blocks."
                )

            lines = [
                f"## Transfer History — {address} on {network}",
                "",
                f"Showing {len(records)} most recent transfers (latest 10,000 blocks):",
                "",
            ]
            for r in records:
                amount = r["amount"] / 1e6
                if r["from"].lower() == address.lower():
                    direction = "↗"
                    other = r["to"]
                elif r["to"].lower() == address.lower():
                    direction = "↘"
                    other = r["from"]
                else:
                    direction = "→"
                    other = r["to"]
                lines.append(
                    f"- {direction} {amount:.4f} {r['token']} {other}  "
                    f"(block {r['blockNumber']}, tx `{r['txHash']}`)"
                )
            return self._text_result("\n".join(lines))
        except Exception as e:
            return self._error_result(str(e))

    @staticmethod
    def _transfer_record(
        log: dict[str, Any], token: str, network: str
    ) -> dict[str, Any]:
        """Decode a Transfer event log into a flat record."""
        topics = log.get("topics", [])
        # web3.py returns topics as HexBytes; normalize to lowercase strings.
        topics = [t.hex() if hasattr(t, "hex") else str(t) for t in topics]
        from_addr = "0x" + topics[1][-40:].lower()
        to_addr = "0x" + topics[2][-40:].lower()

        data = log.get("data", "0x")
        if hasattr(data, "hex"):
            data_hex = data.hex()
        else:
            data_hex = str(data)
        data_hex = data_hex[2:] if data_hex.startswith("0x") else data_hex
        amount = int(data_hex, 16) if data_hex else 0

        tx_hash = log.get("transactionHash")
        if hasattr(tx_hash, "hex"):
            tx_hash = tx_hash.hex()
        if isinstance(tx_hash, str) and not tx_hash.startswith("0x"):
            tx_hash = "0x" + tx_hash

        return {
            "token": token,
            "network": network,
            "from": from_addr,
            "to": to_addr,
            "amount": amount,
            "blockNumber": log.get("blockNumber", 0),
            "logIndex": log.get("logIndex", 0),
            "txHash": tx_hash or "",
        }

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


def _format_price(price: float) -> str:
    """Format a float with up to 6 significant decimals, trimming trailing zeros.

    Keeps token-price output readable across tiny (BTC in BTC) and large
    (ETH in USD) values without locking into a fixed decimal count.
    """
    s = f"{price:.6f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"


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
