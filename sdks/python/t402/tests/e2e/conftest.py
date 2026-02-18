"""Shared fixtures for E2E tests."""

import json
import io
import pytest
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

from t402.mcp import T402McpServer, ServerConfig


# ========================
# Mock Facilitator Server
# ========================

MOCK_SUPPORTED = {
    "networks": [
        {"network": "eip155:8453", "name": "base", "schemes": ["exact"]},
        {"network": "eip155:1", "name": "ethereum", "schemes": ["exact"]},
        {"network": "eip155:42161", "name": "arbitrum", "schemes": ["exact"]},
    ],
}

MOCK_VERIFY = {
    "isValid": True,
    "invalidReason": None,
    "payer": "0x1234567890abcdef1234567890abcdef12345678",
    "network": "eip155:8453",
    "scheme": "exact",
    "amount": "1000000",
}

MOCK_SETTLE = {
    "success": True,
    "transaction": "0x" + "0" * 64,
    "network": "eip155:8453",
    "payer": "0x1234567890abcdef1234567890abcdef12345678",
}


class MockFacilitatorHandler(BaseHTTPRequestHandler):
    """HTTP handler for mock facilitator."""

    def log_message(self, format, *args):
        """Suppress request logging."""
        pass

    def do_GET(self):
        if self.path == "/supported":
            self._json_response(200, MOCK_SUPPORTED)
        else:
            self._json_response(404, {"error": "Not found"})

    def do_POST(self):
        if self.path == "/verify":
            self._json_response(200, MOCK_VERIFY)
        elif self.path == "/settle":
            self._json_response(200, MOCK_SETTLE)
        else:
            self._json_response(404, {"error": "Not found"})

    def _json_response(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


@pytest.fixture(scope="session")
def mock_facilitator_url():
    """Start a mock facilitator HTTP server and return its URL."""
    server = HTTPServer(("127.0.0.1", 0), MockFacilitatorHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


# ========================
# Test Constants
# ========================

TEST_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678"
TEST_PRIVATE_KEY = "0x" + "ab" * 32


@pytest.fixture
def test_address():
    """Test Ethereum address."""
    return TEST_ADDRESS


@pytest.fixture
def test_private_key():
    """Test Ethereum private key for signing."""
    return TEST_PRIVATE_KEY


@pytest.fixture
def demo_config():
    """Demo mode server config."""
    return ServerConfig(demo_mode=True)


@pytest.fixture
def demo_server(demo_config):
    """MCP server in demo mode."""
    stdin = io.StringIO("")
    stdout = io.StringIO()
    return T402McpServer(demo_config, stdin=stdin, stdout=stdout)
