"""Tests for T402 MCP Server."""

import io
import json
import pytest
from dataclasses import asdict

from t402.mcp import (
    # Server
    T402McpServer,
    ServerConfig,
    # Constants
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
    # Types
    SupportedNetwork,
    SupportedToken,
    Tool,
    ToolResult,
    GetBalanceInput,
    PayInput,
    GetBridgeFeeInput,
    # Tools
    get_tool_definitions,
)


class TestConstants:
    """Tests for MCP constants."""

    def test_chain_ids(self):
        """Test chain IDs are defined."""
        assert CHAIN_IDS["ethereum"] == 1
        assert CHAIN_IDS["base"] == 8453
        assert CHAIN_IDS["arbitrum"] == 42161

    def test_native_symbols(self):
        """Test native symbols are defined."""
        assert NATIVE_SYMBOLS["ethereum"] == "ETH"
        assert NATIVE_SYMBOLS["polygon"] == "MATIC"
        assert NATIVE_SYMBOLS["avalanche"] == "AVAX"

    def test_explorer_urls(self):
        """Test explorer URLs are defined."""
        assert EXPLORER_URLS["ethereum"] == "https://etherscan.io"
        assert EXPLORER_URLS["base"] == "https://basescan.org"

    def test_usdc_addresses(self):
        """Test USDC addresses are defined."""
        assert "ethereum" in USDC_ADDRESSES
        assert USDC_ADDRESSES["ethereum"].startswith("0x")
        assert len(USDC_ADDRESSES["ethereum"]) == 42

    def test_all_networks(self):
        """Test ALL_NETWORKS list."""
        assert len(ALL_NETWORKS) == 9
        assert "ethereum" in ALL_NETWORKS
        assert "base" in ALL_NETWORKS
        assert "arbitrum" in ALL_NETWORKS


class TestConstantFunctions:
    """Tests for constant utility functions."""

    def test_is_valid_network(self):
        """Test is_valid_network function."""
        assert is_valid_network("ethereum") is True
        assert is_valid_network("base") is True
        assert is_valid_network("arbitrum") is True
        assert is_valid_network("invalid") is False
        assert is_valid_network("") is False

    def test_is_bridgeable_chain(self):
        """Test is_bridgeable_chain function."""
        assert is_bridgeable_chain("ethereum") is True
        assert is_bridgeable_chain("arbitrum") is True
        assert is_bridgeable_chain("ink") is True
        assert is_bridgeable_chain("base") is False
        assert is_bridgeable_chain("invalid") is False

    def test_is_gasless_network(self):
        """Test is_gasless_network function."""
        assert is_gasless_network("ethereum") is True
        assert is_gasless_network("base") is True
        assert is_gasless_network("arbitrum") is True
        assert is_gasless_network("ink") is False
        assert is_gasless_network("invalid") is False

    def test_get_token_address(self):
        """Test get_token_address function."""
        usdc_eth = get_token_address("ethereum", "USDC")
        assert usdc_eth is not None
        assert usdc_eth.startswith("0x")

        usdt_arb = get_token_address("arbitrum", "USDT")
        assert usdt_arb is not None

        usdt0_ink = get_token_address("ink", "USDT0")
        assert usdt0_ink is not None

        # Unsupported
        assert get_token_address("base", "USDT") is None

    def test_get_explorer_tx_url(self):
        """Test get_explorer_tx_url function."""
        url = get_explorer_tx_url("ethereum", "0x1234")
        assert url == "https://etherscan.io/tx/0x1234"

        url = get_explorer_tx_url("arbitrum", "0xabcd")
        assert url == "https://arbiscan.io/tx/0xabcd"

    def test_get_rpc_url(self):
        """Test get_rpc_url function."""
        # Default URL
        url = get_rpc_url(None, "ethereum")
        assert url == "https://eth.llamarpc.com"

        # Custom URL
        config = ServerConfig(rpc_urls={"ethereum": "https://custom.rpc.com"})
        url = get_rpc_url(config, "ethereum")
        assert url == "https://custom.rpc.com"

        # Fallback to default
        config = ServerConfig(rpc_urls={})
        url = get_rpc_url(config, "base")
        assert url == "https://mainnet.base.org"

    def test_format_token_amount(self):
        """Test format_token_amount function."""
        assert format_token_amount(0, 6) == "0"
        assert format_token_amount(1000000, 6) == "1"
        assert format_token_amount(1500000, 6) == "1.5"
        assert format_token_amount(1, 6) == "0.000001"
        assert format_token_amount(1000000000000000000, 18) == "1"

    def test_parse_token_amount(self):
        """Test parse_token_amount function."""
        assert parse_token_amount("1", 6) == 1000000
        assert parse_token_amount("1.5", 6) == 1500000
        assert parse_token_amount("0.000001", 6) == 1
        assert parse_token_amount("1000000", 6) == 1000000000000


class TestToolDefinitions:
    """Tests for tool definitions."""

    def test_get_tool_definitions(self):
        """Test get_tool_definitions returns all tools."""
        tools = get_tool_definitions()
        assert len(tools) == 6

        tool_names = {t.name for t in tools}
        assert "t402/getBalance" in tool_names
        assert "t402/getAllBalances" in tool_names
        assert "t402/pay" in tool_names
        assert "t402/payGasless" in tool_names
        assert "t402/getBridgeFee" in tool_names
        assert "t402/bridge" in tool_names

    def test_tool_schemas(self):
        """Test tool schemas are valid."""
        tools = get_tool_definitions()

        for tool in tools:
            assert tool.name
            assert tool.description
            assert tool.inputSchema.type == "object"
            assert tool.inputSchema.properties
            assert tool.inputSchema.required

            # All required fields should be in properties
            for req in tool.inputSchema.required:
                assert req in tool.inputSchema.properties


class TestServerConfig:
    """Tests for ServerConfig."""

    def test_default_config(self):
        """Test default configuration."""
        config = ServerConfig()
        assert config.private_key is None
        assert config.rpc_urls == {}
        assert config.demo_mode is False
        assert config.paymaster_url is None
        assert config.bundler_url is None

    def test_custom_config(self):
        """Test custom configuration."""
        config = ServerConfig(
            private_key="0x1234",
            demo_mode=True,
            rpc_urls={"ethereum": "https://custom.rpc"},
        )
        assert config.private_key == "0x1234"
        assert config.demo_mode is True
        assert config.rpc_urls["ethereum"] == "https://custom.rpc"


class TestT402McpServer:
    """Tests for T402McpServer."""

    def test_server_creation(self):
        """Test server creation."""
        config = ServerConfig(demo_mode=True)
        server = T402McpServer(config)
        assert server.config.demo_mode is True

    @pytest.mark.asyncio
    async def test_initialize(self):
        """Test initialize request."""
        config = ServerConfig(demo_mode=True)
        stdin = io.StringIO('{"jsonrpc":"2.0","id":1,"method":"initialize"}\n')
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)

        # Run server (will stop at EOF)
        await server.run()

        # Parse response
        stdout.seek(0)
        response = json.loads(stdout.read())

        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 1
        assert "result" in response
        assert response["result"]["serverInfo"]["name"] == "t402"

    @pytest.mark.asyncio
    async def test_list_tools(self):
        """Test tools/list request."""
        config = ServerConfig(demo_mode=True)
        stdin = io.StringIO('{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n')
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert response["jsonrpc"] == "2.0"
        assert len(response["result"]["tools"]) == 6

    @pytest.mark.asyncio
    async def test_call_tool_get_balance(self):
        """Test tools/call for getBalance."""
        config = ServerConfig(demo_mode=True)
        request = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "t402/getBalance",
                "arguments": {
                    "address": "0x1234567890abcdef1234567890abcdef12345678",
                    "network": "ethereum",
                },
            },
        }
        stdin = io.StringIO(json.dumps(request) + "\n")
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert response["jsonrpc"] == "2.0"
        assert "result" in response
        assert "content" in response["result"]
        assert len(response["result"]["content"]) > 0

    @pytest.mark.asyncio
    async def test_call_tool_pay_demo_mode(self):
        """Test tools/call for pay in demo mode."""
        config = ServerConfig(demo_mode=True)
        request = {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "t402/pay",
                "arguments": {
                    "to": "0x1234567890abcdef1234567890abcdef12345678",
                    "amount": "100",
                    "token": "USDC",
                    "network": "ethereum",
                },
            },
        }
        stdin = io.StringIO(json.dumps(request) + "\n")
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert "result" in response
        content = response["result"]["content"]
        assert len(content) > 0
        assert "Demo Mode" in content[0]["text"]

    @pytest.mark.asyncio
    async def test_call_tool_invalid_network(self):
        """Test tools/call with invalid network."""
        config = ServerConfig(demo_mode=True)
        request = {
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "t402/getBalance",
                "arguments": {
                    "address": "0x1234567890abcdef1234567890abcdef12345678",
                    "network": "invalid",
                },
            },
        }
        stdin = io.StringIO(json.dumps(request) + "\n")
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert response["result"]["isError"] is True
        assert "Invalid network" in response["result"]["content"][0]["text"]

    @pytest.mark.asyncio
    async def test_call_tool_unknown_tool(self):
        """Test tools/call with unknown tool."""
        config = ServerConfig(demo_mode=True)
        request = {
            "jsonrpc": "2.0",
            "id": 6,
            "method": "tools/call",
            "params": {
                "name": "t402/unknown",
                "arguments": {},
            },
        }
        stdin = io.StringIO(json.dumps(request) + "\n")
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert response["result"]["isError"] is True
        assert "Unknown tool" in response["result"]["content"][0]["text"]

    @pytest.mark.asyncio
    async def test_call_tool_bridge_fee(self):
        """Test tools/call for getBridgeFee."""
        config = ServerConfig(demo_mode=True)
        request = {
            "jsonrpc": "2.0",
            "id": 7,
            "method": "tools/call",
            "params": {
                "name": "t402/getBridgeFee",
                "arguments": {
                    "fromChain": "arbitrum",
                    "toChain": "ethereum",
                    "amount": "100",
                    "recipient": "0x1234567890abcdef1234567890abcdef12345678",
                },
            },
        }
        stdin = io.StringIO(json.dumps(request) + "\n")
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert "result" in response
        content = response["result"]["content"]
        assert "Bridge Fee Quote" in content[0]["text"]

    @pytest.mark.asyncio
    async def test_call_tool_bridge_same_chain(self):
        """Test tools/call for bridge with same chain."""
        config = ServerConfig(demo_mode=True)
        request = {
            "jsonrpc": "2.0",
            "id": 8,
            "method": "tools/call",
            "params": {
                "name": "t402/bridge",
                "arguments": {
                    "fromChain": "arbitrum",
                    "toChain": "arbitrum",
                    "amount": "100",
                    "recipient": "0x1234567890abcdef1234567890abcdef12345678",
                },
            },
        }
        stdin = io.StringIO(json.dumps(request) + "\n")
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert response["result"]["isError"] is True
        assert "different" in response["result"]["content"][0]["text"]

    @pytest.mark.asyncio
    async def test_method_not_found(self):
        """Test unknown method."""
        config = ServerConfig(demo_mode=True)
        stdin = io.StringIO('{"jsonrpc":"2.0","id":9,"method":"unknown"}\n')
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert "error" in response
        assert response["error"]["code"] == -32601
        assert "Method not found" in response["error"]["message"]

    @pytest.mark.asyncio
    async def test_parse_error(self):
        """Test JSON parse error."""
        config = ServerConfig(demo_mode=True)
        stdin = io.StringIO("not valid json\n")
        stdout = io.StringIO()

        server = T402McpServer(config, stdin=stdin, stdout=stdout)
        await server.run()

        stdout.seek(0)
        response = json.loads(stdout.read())

        assert "error" in response
        assert response["error"]["code"] == -32700
        assert "Parse error" in response["error"]["message"]


class TestInputTypes:
    """Tests for input type dataclasses."""

    def test_get_balance_input(self):
        """Test GetBalanceInput."""
        inp = GetBalanceInput(
            address="0x1234567890abcdef1234567890abcdef12345678",
            network="ethereum",
        )
        assert inp.address.startswith("0x")
        assert inp.network == "ethereum"

    def test_pay_input(self):
        """Test PayInput."""
        inp = PayInput(
            to="0x1234567890abcdef1234567890abcdef12345678",
            amount="100.5",
            token="USDC",
            network="base",
        )
        assert inp.amount == "100.5"
        assert inp.token == "USDC"

    def test_get_bridge_fee_input(self):
        """Test GetBridgeFeeInput."""
        inp = GetBridgeFeeInput(
            fromChain="arbitrum",
            toChain="ethereum",
            amount="1000",
            recipient="0x1234567890abcdef1234567890abcdef12345678",
        )
        assert inp.fromChain == "arbitrum"
        assert inp.toChain == "ethereum"
