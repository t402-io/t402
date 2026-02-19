"""E2E tests for T402 MCP Server (Python)."""

import io
import json

from t402.mcp import (
    T402McpServer,
    ServerConfig,
    get_tool_definitions,
    ALL_NETWORKS,
    BRIDGEABLE_CHAINS,
    GASLESS_NETWORKS,
)

TEST_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678"


# ========================
# Helper
# ========================


async def send_request(config: ServerConfig, request: dict) -> dict:
    """Send a JSON-RPC request to the MCP server and return the response."""
    stdin = io.StringIO(json.dumps(request) + "\n")
    stdout = io.StringIO()
    server = T402McpServer(config, stdin=stdin, stdout=stdout)
    await server.run()
    stdout.seek(0)
    return json.loads(stdout.read())


# ========================
# Server Lifecycle
# ========================


class TestMcpServerLifecycle:
    """E2E tests for MCP server lifecycle."""

    async def test_initialize(self, demo_config):
        """Test initialize request returns protocol info."""
        response = await send_request(
            demo_config,
            {"jsonrpc": "2.0", "id": 1, "method": "initialize"},
        )
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 1
        assert "result" in response
        assert response["result"]["serverInfo"]["name"] == "t402"
        assert response["result"]["serverInfo"]["version"] == "1.0.0"
        assert "capabilities" in response["result"]
        assert "tools" in response["result"]["capabilities"]

    async def test_list_tools(self, demo_config):
        """Test tools/list returns all 6 tools."""
        response = await send_request(
            demo_config,
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
        )
        assert "result" in response
        tools = response["result"]["tools"]
        assert len(tools) == 6

        tool_names = {t["name"] for t in tools}
        assert "t402/getBalance" in tool_names
        assert "t402/getAllBalances" in tool_names
        assert "t402/pay" in tool_names
        assert "t402/payGasless" in tool_names
        assert "t402/getBridgeFee" in tool_names
        assert "t402/bridge" in tool_names

    async def test_notifications_initialized(self, demo_config):
        """Test notifications/initialized returns empty result."""
        response = await send_request(
            demo_config,
            {"jsonrpc": "2.0", "id": 3, "method": "notifications/initialized"},
        )
        assert "result" in response
        assert response["result"] == {}

    async def test_method_not_found(self, demo_config):
        """Test unknown method returns error."""
        response = await send_request(
            demo_config,
            {"jsonrpc": "2.0", "id": 4, "method": "nonexistent/method"},
        )
        assert "error" in response
        assert response["error"]["code"] == -32601
        assert "Method not found" in response["error"]["message"]

    async def test_parse_error(self, demo_config):
        """Test invalid JSON returns parse error."""
        stdin = io.StringIO("not valid json\n")
        stdout = io.StringIO()
        server = T402McpServer(demo_config, stdin=stdin, stdout=stdout)
        await server.run()
        stdout.seek(0)
        response = json.loads(stdout.read())
        assert "error" in response
        assert response["error"]["code"] == -32700


# ========================
# Tool Calls (Demo Mode)
# ========================


class TestMcpToolCallsE2E:
    """E2E tests for MCP tool calls in demo mode."""

    async def test_get_balance(self, demo_config):
        """Test t402/getBalance in demo mode."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "t402/getBalance",
                    "arguments": {
                        "address": TEST_ADDRESS,
                        "network": "ethereum",
                    },
                },
            },
        )
        assert "result" in response
        content = response["result"]["content"]
        assert len(content) > 0
        assert "Balance on ethereum" in content[0]["text"]
        assert response["result"]["isError"] is False

    async def test_get_balance_invalid_network(self, demo_config):
        """Test t402/getBalance with invalid network."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "t402/getBalance",
                    "arguments": {
                        "address": TEST_ADDRESS,
                        "network": "invalid",
                    },
                },
            },
        )
        assert response["result"]["isError"] is True
        assert "Invalid network" in response["result"]["content"][0]["text"]

    async def test_get_all_balances(self, demo_config):
        """Test t402/getAllBalances in demo mode."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "t402/getAllBalances",
                    "arguments": {"address": TEST_ADDRESS},
                },
            },
        )
        assert "result" in response
        content = response["result"]["content"]
        assert "Balances Across All Networks" in content[0]["text"]
        assert response["result"]["isError"] is False

    async def test_pay_demo_mode(self, demo_config):
        """Test t402/pay in demo mode."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "tools/call",
                "params": {
                    "name": "t402/pay",
                    "arguments": {
                        "to": TEST_ADDRESS,
                        "amount": "100",
                        "token": "USDC",
                        "network": "ethereum",
                    },
                },
            },
        )
        assert "result" in response
        content = response["result"]["content"]
        assert "Demo Mode" in content[0]["text"]
        assert response["result"]["isError"] is False

    async def test_pay_invalid_network(self, demo_config):
        """Test t402/pay with invalid network."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 5,
                "method": "tools/call",
                "params": {
                    "name": "t402/pay",
                    "arguments": {
                        "to": TEST_ADDRESS,
                        "amount": "100",
                        "token": "USDC",
                        "network": "invalid",
                    },
                },
            },
        )
        assert response["result"]["isError"] is True
        assert "Invalid network" in response["result"]["content"][0]["text"]

    async def test_pay_unsupported_token(self, demo_config):
        """Test t402/pay with unsupported token on network."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 6,
                "method": "tools/call",
                "params": {
                    "name": "t402/pay",
                    "arguments": {
                        "to": TEST_ADDRESS,
                        "amount": "100",
                        "token": "USDT",
                        "network": "base",
                    },
                },
            },
        )
        assert response["result"]["isError"] is True
        assert "not supported" in response["result"]["content"][0]["text"]

    async def test_pay_gasless_demo_mode(self, demo_config):
        """Test t402/payGasless in demo mode."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 7,
                "method": "tools/call",
                "params": {
                    "name": "t402/payGasless",
                    "arguments": {
                        "to": TEST_ADDRESS,
                        "amount": "50",
                        "token": "USDC",
                        "network": "base",
                    },
                },
            },
        )
        assert "result" in response
        content = response["result"]["content"]
        assert "Demo Mode" in content[0]["text"]
        assert response["result"]["isError"] is False

    async def test_pay_gasless_non_gasless_network(self, demo_config):
        """Test t402/payGasless on non-gasless network."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 8,
                "method": "tools/call",
                "params": {
                    "name": "t402/payGasless",
                    "arguments": {
                        "to": TEST_ADDRESS,
                        "amount": "50",
                        "token": "USDC",
                        "network": "ink",
                    },
                },
            },
        )
        assert response["result"]["isError"] is True
        assert "does not support gasless" in response["result"]["content"][0]["text"]

    async def test_get_bridge_fee_demo_mode(self, demo_config):
        """Test t402/getBridgeFee in demo mode."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 9,
                "method": "tools/call",
                "params": {
                    "name": "t402/getBridgeFee",
                    "arguments": {
                        "fromChain": "arbitrum",
                        "toChain": "ethereum",
                        "amount": "100",
                        "recipient": TEST_ADDRESS,
                    },
                },
            },
        )
        assert "result" in response
        content = response["result"]["content"]
        assert "Bridge Fee Quote" in content[0]["text"]
        assert response["result"]["isError"] is False

    async def test_get_bridge_fee_same_chain(self, demo_config):
        """Test t402/getBridgeFee with same chain."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 10,
                "method": "tools/call",
                "params": {
                    "name": "t402/getBridgeFee",
                    "arguments": {
                        "fromChain": "arbitrum",
                        "toChain": "arbitrum",
                        "amount": "100",
                        "recipient": TEST_ADDRESS,
                    },
                },
            },
        )
        assert response["result"]["isError"] is True
        assert "different" in response["result"]["content"][0]["text"]

    async def test_get_bridge_fee_non_bridgeable(self, demo_config):
        """Test t402/getBridgeFee with non-bridgeable chain."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 11,
                "method": "tools/call",
                "params": {
                    "name": "t402/getBridgeFee",
                    "arguments": {
                        "fromChain": "base",
                        "toChain": "ethereum",
                        "amount": "100",
                        "recipient": TEST_ADDRESS,
                    },
                },
            },
        )
        assert response["result"]["isError"] is True
        assert "does not support" in response["result"]["content"][0]["text"]

    async def test_bridge_demo_mode(self, demo_config):
        """Test t402/bridge in demo mode."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 12,
                "method": "tools/call",
                "params": {
                    "name": "t402/bridge",
                    "arguments": {
                        "fromChain": "ethereum",
                        "toChain": "arbitrum",
                        "amount": "500",
                        "recipient": TEST_ADDRESS,
                    },
                },
            },
        )
        assert "result" in response
        content = response["result"]["content"]
        assert "Demo Mode" in content[0]["text"]
        assert "LayerZero Scan" in content[0]["text"]
        assert response["result"]["isError"] is False

    async def test_bridge_same_chain(self, demo_config):
        """Test t402/bridge with same chain."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 13,
                "method": "tools/call",
                "params": {
                    "name": "t402/bridge",
                    "arguments": {
                        "fromChain": "ethereum",
                        "toChain": "ethereum",
                        "amount": "500",
                        "recipient": TEST_ADDRESS,
                    },
                },
            },
        )
        assert response["result"]["isError"] is True
        assert "different" in response["result"]["content"][0]["text"]

    async def test_unknown_tool(self, demo_config):
        """Test calling an unknown tool."""
        response = await send_request(
            demo_config,
            {
                "jsonrpc": "2.0",
                "id": 14,
                "method": "tools/call",
                "params": {
                    "name": "t402/doesNotExist",
                    "arguments": {},
                },
            },
        )
        assert response["result"]["isError"] is True
        assert "Unknown tool" in response["result"]["content"][0]["text"]


# ========================
# Tool Definitions
# ========================


class TestMcpToolDefinitionsE2E:
    """E2E tests for tool definition completeness."""

    def test_all_6_tools_defined(self):
        """Test all 6 base tools are defined."""
        tools = get_tool_definitions()
        assert len(tools) == 6

        names = {t.name for t in tools}
        assert names == {
            "t402/getBalance",
            "t402/getAllBalances",
            "t402/pay",
            "t402/payGasless",
            "t402/getBridgeFee",
            "t402/bridge",
        }

    def test_all_tools_have_valid_schemas(self):
        """Test all tools have valid input schemas."""
        for tool in get_tool_definitions():
            assert tool.name
            assert tool.description
            assert tool.inputSchema.type == "object"
            assert tool.inputSchema.properties
            assert tool.inputSchema.required

            for req in tool.inputSchema.required:
                assert req in tool.inputSchema.properties

    def test_9_supported_networks(self):
        """Test all 9 networks are supported."""
        assert len(ALL_NETWORKS) == 9
        expected = {
            "ethereum", "base", "arbitrum", "optimism",
            "polygon", "avalanche", "ink", "berachain", "unichain",
        }
        assert set(ALL_NETWORKS) == expected

    def test_bridgeable_chains_subset(self):
        """Test bridgeable chains are a subset of all networks."""
        for chain in BRIDGEABLE_CHAINS:
            assert chain in ALL_NETWORKS

    def test_gasless_networks_subset(self):
        """Test gasless networks are a subset of all networks."""
        for network in GASLESS_NETWORKS:
            assert network in ALL_NETWORKS


# ========================
# Mock Facilitator
# ========================


class TestMockFacilitatorE2E:
    """E2E tests for the mock facilitator HTTP server."""

    def test_facilitator_running(self, mock_facilitator_url):
        """Test mock facilitator is accessible."""
        import urllib.request

        resp = urllib.request.urlopen(f"{mock_facilitator_url}/supported")
        assert resp.status == 200
        data = json.loads(resp.read())
        assert "networks" in data
        assert len(data["networks"]) == 3

    def test_facilitator_verify(self, mock_facilitator_url):
        """Test mock facilitator /verify endpoint."""
        import urllib.request

        req = urllib.request.Request(
            f"{mock_facilitator_url}/verify",
            data=json.dumps({"payload": "test"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        resp = urllib.request.urlopen(req)
        assert resp.status == 200
        data = json.loads(resp.read())
        assert data["isValid"] is True

    def test_facilitator_settle(self, mock_facilitator_url):
        """Test mock facilitator /settle endpoint."""
        import urllib.request

        req = urllib.request.Request(
            f"{mock_facilitator_url}/settle",
            data=json.dumps({"payload": "test"}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        resp = urllib.request.urlopen(req)
        assert resp.status == 200
        data = json.loads(resp.read())
        assert data["success"] is True

    def test_facilitator_404(self, mock_facilitator_url):
        """Test mock facilitator unknown endpoint."""
        import urllib.request
        import urllib.error

        try:
            urllib.request.urlopen(f"{mock_facilitator_url}/unknown")
            assert False, "Expected 404"
        except urllib.error.HTTPError as e:
            assert e.code == 404


# ========================
# Server Configuration
# ========================


class TestMcpServerConfigE2E:
    """E2E tests for server configuration."""

    def test_default_config(self):
        """Test default config values."""
        config = ServerConfig()
        assert config.private_key is None
        assert config.demo_mode is False
        assert config.rpc_urls == {}
        assert config.bundler_url is None
        assert config.paymaster_url is None

    def test_demo_mode_config(self):
        """Test demo mode config."""
        config = ServerConfig(demo_mode=True)
        assert config.demo_mode is True

    def test_custom_rpc_config(self):
        """Test custom RPC URLs config."""
        config = ServerConfig(
            rpc_urls={"ethereum": "https://custom.rpc.com"}
        )
        assert config.rpc_urls["ethereum"] == "https://custom.rpc.com"

    async def test_pay_without_key_or_demo(self):
        """Test pay fails without private key or demo mode."""
        config = ServerConfig(demo_mode=False, private_key=None)
        response = await send_request(
            config,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": "t402/pay",
                    "arguments": {
                        "to": TEST_ADDRESS,
                        "amount": "100",
                        "token": "USDC",
                        "network": "ethereum",
                    },
                },
            },
        )
        assert response["result"]["isError"] is True
        assert "Private key not configured" in response["result"]["content"][0]["text"]
