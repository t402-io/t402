"""
t402 MCP Chatbot Example (Python)

Interactive CLI that demonstrates the t402 MCP payment tools in demo mode.
Maps user input to JSON-RPC tool calls against the T402McpServer.

Run with: python chatbot.py
"""

import asyncio
import json
import re
import sys
from io import StringIO

from t402.mcp.server import T402McpServer
from t402.mcp.types import ServerConfig


class ChatbotMCPClient:
    """Wraps the T402McpServer for interactive chatbot usage."""

    def __init__(self) -> None:
        config = ServerConfig(demo_mode=True)
        self._request_id = 0
        self._server = T402McpServer(config)

    async def call_tool(self, tool_name: str, arguments: dict) -> str:
        """Call an MCP tool and return the formatted result."""
        self._request_id += 1
        request = json.dumps({
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        })

        response = await self._server._handle_request(request)
        serialized = self._server._serialize_response(response)
        data = json.loads(serialized)

        if "error" in data:
            return f"Error: {data['error']['message']}"

        result = data.get("result", {})
        content = result.get("content", [])
        texts = [block["text"] for block in content if block.get("type") == "text"]
        return "\n".join(texts) if texts else "No result"

    async def list_tools(self) -> str:
        """List available MCP tools."""
        self._request_id += 1
        request = json.dumps({
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": "tools/list",
            "params": {},
        })

        response = await self._server._handle_request(request)
        serialized = self._server._serialize_response(response)
        data = json.loads(serialized)

        tools = data.get("result", {}).get("tools", [])
        lines = ["Available tools:"]
        for tool in tools:
            lines.append(f"  {tool['name']} - {tool['description'][:80]}...")
        return "\n".join(lines)


def print_help() -> None:
    """Print chatbot help."""
    print("""
t402 MCP Chatbot (Python - Demo Mode)
======================================

Commands:
  balance <address> <network>         Check balance on a network
  all-balances <address>              Check balances across all networks
  pay <amount> <token> to <address> on <network>   Send a payment
  fee <fromChain> to <toChain> <amount>            Get bridge fee quote
  tools                               List available MCP tools
  help                                Show this help
  quit                                Exit

Networks: ethereum, base, arbitrum, optimism, polygon, avalanche, ink, berachain, unichain
Tokens: USDC, USDT, USDT0

All operations run in demo mode - no real transactions are executed.
""")


async def handle_balance(client: ChatbotMCPClient, parts: list[str]) -> None:
    """Handle balance command."""
    if len(parts) < 2:
        print("Usage: balance <address> <network>")
        return

    address = parts[1]
    network = parts[2] if len(parts) > 2 else "ethereum"
    print(f"Checking balance on {network}...")
    result = await client.call_tool("t402/getBalance", {
        "address": address,
        "network": network,
    })
    print(result)


async def handle_all_balances(client: ChatbotMCPClient, parts: list[str]) -> None:
    """Handle all-balances command."""
    if len(parts) < 2:
        print("Usage: all-balances <address>")
        return

    address = parts[1]
    print("Checking balances across all networks...")
    result = await client.call_tool("t402/getAllBalances", {"address": address})
    print(result)


async def handle_pay(client: ChatbotMCPClient, user_input: str) -> None:
    """Handle pay command."""
    match = re.match(
        r"^pay\s+(\S+)\s+(\S+)\s+to\s+(0x[a-fA-F0-9]{40})\s+on\s+(\S+)",
        user_input,
        re.IGNORECASE,
    )
    if not match:
        print("Usage: pay <amount> <token> to <address> on <network>")
        print("Example: pay 10 USDC to 0x1234...5678 on base")
        return

    amount, token, to, network = match.groups()
    print(f"Sending {amount} {token.upper()} to {to} on {network}...")
    result = await client.call_tool("t402/pay", {
        "to": to,
        "amount": amount,
        "token": token.upper(),
        "network": network,
    })
    print(result)
    print("\n(Demo mode - no real tokens transferred)")


async def handle_bridge_fee(client: ChatbotMCPClient, parts: list[str]) -> None:
    """Handle bridge fee command."""
    if len(parts) < 4 or parts[2] != "to":
        print("Usage: fee <fromChain> to <toChain> <amount>")
        print("Example: fee arbitrum to ethereum 100")
        return

    from_chain = parts[1]
    to_chain = parts[3]
    amount = parts[4] if len(parts) > 4 else "100"
    recipient = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

    print(f"Getting bridge fee for {amount} USDT0: {from_chain} -> {to_chain}...")
    result = await client.call_tool("t402/getBridgeFee", {
        "fromChain": from_chain,
        "toChain": to_chain,
        "amount": amount,
        "recipient": recipient,
    })
    print(result)


async def main() -> None:
    """Run the interactive chatbot."""
    client = ChatbotMCPClient()
    print("t402 MCP Chatbot (Python - Demo Mode)")
    print('Type "help" for commands, "quit" to exit.\n')

    while True:
        try:
            user_input = input("\n> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        parts = user_input.split()
        command = parts[0].lower()

        try:
            if command == "balance":
                await handle_balance(client, parts)
            elif command == "all-balances":
                await handle_all_balances(client, parts)
            elif command == "pay":
                await handle_pay(client, user_input)
            elif command == "fee":
                await handle_bridge_fee(client, parts)
            elif command == "tools":
                result = await client.list_tools()
                print(result)
            elif command == "help":
                print_help()
            elif command in ("quit", "exit"):
                print("Goodbye!")
                break
            else:
                print(f'Unknown command: {command}. Type "help" for available commands.')
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
