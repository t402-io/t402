# t402 Python

Python SDK for the T402 HTTP-native stablecoin payments protocol.

[![PyPI version](https://badge.fury.io/py/t402.svg)](https://pypi.org/project/t402/)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)

## Installation

```bash
pip install t402

# or with uv
uv add t402
```

## Features

- **Multi-Chain Support**: EVM (Ethereum, Base, Polygon, etc.), TON, TRON, Solana
- **Server Middleware**: FastAPI and Flask integrations
- **Client Libraries**: httpx and requests adapters
- **ERC-4337 Account Abstraction**: Gasless payments with smart accounts
- **USDT0 Cross-Chain Bridge**: LayerZero-powered bridging
- **WDK Integration**: Tether Wallet Development Kit support

## FastAPI Integration

The simplest way to add t402 payment protection to your FastAPI application:

```py
from fastapi import FastAPI
from t402.fastapi.middleware import require_payment

app = FastAPI()
app.middleware("http")(
    require_payment(price="0.01", pay_to_address="0x209693Bc6afc0C5328bA36FaF03C514EF312287C")
)

@app.get("/")
async def root():
    return {"message": "Hello World"}
```

To protect specific routes:

```py
app.middleware("http")(
    require_payment(price="0.01",
    pay_to_address="0x209693Bc6afc0C5328bA36FaF03C514EF312287C"),
    path="/foo"  # <-- this can also be a list ex: ["/foo", "/bar"]
)
```

## Flask Integration

The simplest way to add t402 payment protection to your Flask application:

```py
from flask import Flask
from t402.flask.middleware import PaymentMiddleware

app = Flask(__name__)

# Initialize payment middleware
payment_middleware = PaymentMiddleware(app)

# Add payment protection for all routes
payment_middleware.add(
    price="$0.01",
    pay_to_address="0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
)

@app.route("/")
def root():
    return {"message": "Hello World"}
```

To protect specific routes:

```py
# Protect specific endpoint
payment_middleware.add(
    path="/foo",
    price="$0.001",
    pay_to_address="0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
)
```

## Client Integration

### Simple Usage

#### Httpx Client
```py
from eth_account import Account
from t402.clients.httpx import t402HttpxClient

# Initialize account
account = Account.from_key("your_private_key")

# Create client and make request
async with t402HttpxClient(account=account, base_url="https://api.example.com") as client:
    response = await client.get("/protected-endpoint")
    print(await response.aread())
```

#### Requests Session Client
```py
from eth_account import Account
from t402.clients.requests import t402_requests

# Initialize account
account = Account.from_key("your_private_key")

# Create session and make request
session = t402_requests(account)
response = session.get("https://api.example.com/protected-endpoint")
print(response.content)
```

### Advanced Usage

#### Httpx Extensible Example
```py
import httpx
from eth_account import Account
from t402.clients.httpx import t402_payment_hooks

# Initialize account
account = Account.from_key("your_private_key")

# Create httpx client with t402 payment hooks
async with httpx.AsyncClient(base_url="https://api.example.com") as client:
    # Add payment hooks directly to client
    client.event_hooks = t402_payment_hooks(account)
    
    # Make request - payment handling is automatic
    response = await client.get("/protected-endpoint")
    print(await response.aread())
```

#### Requests Session Extensible Example
```py
import requests
from eth_account import Account
from t402.clients.requests import t402_http_adapter

# Initialize account
account = Account.from_key("your_private_key")

# Create session and mount the t402 adapter
session = requests.Session()
adapter = t402_http_adapter(account)

# Mount the adapter for both HTTP and HTTPS
session.mount("http://", adapter)
session.mount("https://", adapter)

# Make request - payment handling is automatic
response = session.get("https://api.example.com/protected-endpoint")
print(response.content)
```

## Manual Server Integration

If you're not using the FastAPI middleware, you can implement the t402 protocol manually. Here's what you'll need to handle:

1. Return 402 error responses with the appropriate response body
2. Use the facilitator to validate payments
3. Use the facilitator to settle payments
4. Return the appropriate response header to the caller

Here's an example of manual integration:

```py
from typing import Annotated
from fastapi import FastAPI, Request
from t402.types import PaymentRequiredResponse, PaymentRequirements
from t402.encoding import safe_base64_decode

payment_requirements = PaymentRequirements(...)
facilitator = FacilitatorClient(facilitator_url)

@app.get("/foo")
async def foo(req: request: Request):
    payment_required = PaymentRequiredResponse(
        t402_version: 1,
        accepts=[payment_requirements],
        error="",
    )
    payment_header = req.headers.get("X-PAYMENT", "")

    if payment_header == "":
        payment_required.error = "X-PAYMENT header not set"
        return JSONResponse(
            content=payment_required.model_dump(by_alias=True),
            status_code=402,
        )
    
    payment = PaymentPayload(**json.loads(safe_base64_decode(payment_header)))

    verify_response = await facilitator.verify(payment, payment_requirements)
    if not verify_response.is_valid:
        payment_required.error = "Invalid payment"
        return JSONResponse(
            content=payment_required.model_dump(by_alias=True),
            status_code=402,
        )

    settle_response = await facilitator.settle(payment, payment_requirements)
    if settle_response.success:
        response.headers["X-PAYMENT-RESPONSE"] = base64.b64encode(
            settle_response.model_dump_json().encode("utf-8")
        ).decode("utf-8")
    else:
        payment_required.error = "Settle failed: " + settle_response.error
        return JSONResponse(
            content=payment_required.model_dump(by_alias=True),
            status_code=402,
        )
```

For more examples and advanced usage patterns, check out our [examples directory](https://github.com/t402-io/t402/tree/main/examples/python).

## Multi-Chain Support

### TON Network

```python
from t402 import (
    TON_MAINNET,
    TON_TESTNET,
    validate_ton_address,
    prepare_ton_payment_header,
    get_ton_network_config,
)

# Validate address
is_valid = validate_ton_address("EQD...")

# Get network config
config = get_ton_network_config(TON_MAINNET)
```

### TRON Network

```python
from t402 import (
    TRON_MAINNET,
    TRON_NILE,
    validate_tron_address,
    prepare_tron_payment_header,
    get_tron_network_config,
)

# Validate address
is_valid = validate_tron_address("T...")

# Get network config
config = get_tron_network_config(TRON_MAINNET)
```

### Solana (SVM) Network

```python
from t402 import (
    SOLANA_MAINNET,
    SOLANA_DEVNET,
    SOLANA_TESTNET,
    validate_svm_address,
    prepare_svm_payment_header,
    get_svm_network_config,
    get_svm_usdc_address,
    is_svm_network,
)

# Validate address
is_valid = validate_svm_address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")

# Get network config
config = get_svm_network_config(SOLANA_MAINNET)

# Get USDC mint address
usdc_mint = get_svm_usdc_address(SOLANA_MAINNET)

# Check if network is Solana
is_solana = is_svm_network("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
```

Install with optional Solana dependencies:

```bash
pip install t402[svm]
```

## ERC-4337 Account Abstraction

Gasless payments using smart accounts and paymasters:

```python
from t402 import (
    create_bundler_client,
    create_paymaster,
    create_smart_account,
    SafeAccountConfig,
)

# Create bundler client
bundler = create_bundler_client(
    bundler_type="pimlico",
    api_key="your_api_key",
    chain_id=8453  # Base
)

# Create paymaster for sponsored transactions
paymaster = create_paymaster(
    paymaster_type="pimlico",
    api_key="your_api_key",
    chain_id=8453
)

# Create Safe smart account
account = create_smart_account(
    config=SafeAccountConfig(
        owner_private_key="0x...",
        chain_id=8453,
    ),
    bundler=bundler,
    paymaster=paymaster,
)
```

## USDT0 Cross-Chain Bridge

Bridge USDT0 across chains using LayerZero:

```python
from t402 import (
    create_usdt0_bridge,
    create_cross_chain_payment_router,
    get_bridgeable_chains,
)

# Check supported chains
chains = get_bridgeable_chains()

# Create bridge client
bridge = create_usdt0_bridge(
    private_key="0x...",
    source_chain_id=1,  # Ethereum
)

# Get quote
quote = await bridge.get_quote(
    destination_chain_id=8453,  # Base
    amount="1000000",  # 1 USDT0
)

# Execute bridge
result = await bridge.bridge(
    destination_chain_id=8453,
    amount="1000000",
    recipient="0x...",
)
```

## WDK Integration

Tether Wallet Development Kit support:

```python
from t402 import (
    WDKSigner,
    generate_seed_phrase,
    WDKConfig,
    get_wdk_usdt0_chains,
)

# Generate new wallet
seed = generate_seed_phrase()

# Create WDK signer
signer = WDKSigner(
    config=WDKConfig(
        seed_phrase=seed,
        chains=get_wdk_usdt0_chains(),
    )
)

# Get address
address = await signer.get_address(chain_id=8453)

# Sign payment
signature = await signer.sign_payment(
    chain_id=8453,
    amount="1000000",
    recipient="0x...",
)
```

## API Reference

### Core Types

| Type | Description |
|------|-------------|
| `PaymentRequirements` | Payment configuration |
| `PaymentPayload` | Signed payment data |
| `VerifyResponse` | Verification result |
| `SettleResponse` | Settlement result |

### Network Utilities

| Function | Description |
|----------|-------------|
| `is_evm_network(network)` | Check if EVM network |
| `is_ton_network(network)` | Check if TON network |
| `is_tron_network(network)` | Check if TRON network |
| `is_svm_network(network)` | Check if Solana SVM network |
| `get_network_type(network)` | Get network type string |

### Facilitator Client

```python
from t402 import FacilitatorClient, FacilitatorConfig

client = FacilitatorClient(FacilitatorConfig(
    url="https://facilitator.t402.io"
))

# Verify payment
result = await client.verify(payload, requirements)

# Settle payment
result = await client.settle(payload, requirements)
```

## Requirements

- Python 3.10+
- pip or uv package manager

## Documentation

Full documentation available at [docs.t402.io](https://docs.t402.io/sdks/python)