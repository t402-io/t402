# X402 Python Examples

This directory contains a collection of Python examples demonstrating how to use the X402 protocol in various contexts. These examples use the Python `t402` package and standard Python web frameworks/HTTP clients.

## Setup

Before running any examples, ensure you have:

- Python 3.10+
- `uv` package manager installed (see `https://github.com/astral-sh/uv`)

Then install dependencies for the examples you want to run. You can either:

```bash
# Option A: sync each example individually (recommended by each example README)
cd <example-dir>
uv sync

# Option B: run the helper script to sync all examples
cd examples/python
uv run python sync.py
```

## Example Structure

The examples are organized into several categories:

### Clients

Examples of different client implementations for interacting with t402-protected services:

- `clients/httpx/` - Two approaches with httpx: a pre-configured `t402HttpxClient` and an extensible `event_hooks` integration.
- `clients/requests/` - Two approaches with requests: a simple `t402_requests` session and an extensible HTTP adapter.

### Discovery

- `discovery/` - Uses the facilitator to list available t402-protected resources (Bazaar) with CDP credentials.

### Fullstack

- `fullstack/fastapi/` - FastAPI application with t402 middleware protecting routes. Includes simple UI assets.
- `fullstack/flask/` - Flask application with t402 middleware protecting routes. Includes simple UI assets.

### Servers

Examples of different server implementations:

- `servers/fastapi/` - FastAPI server using t402 middleware to protect endpoints.
- `servers/flask/` - Flask server using t402 middleware to protect endpoints.
- `servers/advanced/` - FastAPI server without middleware: delayed settlement, dynamic pricing, multiple requirements.
- `servers/mainnet/` - Server example for accepting real USDC on Base mainnet using the Coinbase hosted facilitator.

## Running Examples

Each example directory contains its own README with specific instructions. In general:

```bash
cd <example-dir>
cp .env-local .env   # then fill in required values
uv sync
uv run python main.py
```

Some client examples also provide an `extensible.py` variant that demonstrates lower-level integrations.

## Development

This workspace uses:

- `uv` for Python environment and dependency management
- Python 3.10+ and standard tooling

The examples are independent projects; install dependencies per example before running.

## A note on private keys

The examples in this folder commonly use private keys to sign messages. **Never put a private key with mainnet funds in a `.env` file**. This can result in keys getting checked into codebases and being drained.

Use a development wallet funded on testnets (e.g., Base Sepolia USDC/ETH). You can fund a dev wallet via the testnet [CDP Faucet](https://portal.cdp.coinbase.com/products/faucet).
