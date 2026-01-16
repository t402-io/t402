# TON Server Example (Python Flask)

This example demonstrates how to create a Flask server with t402 payment protection using TON USDT Jettons.

## Prerequisites

- Python 3.9+
- A TON wallet address to receive payments
- Access to a t402 facilitator that supports TON

## Setup

1. Create a virtual environment and install dependencies:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install t402 flask python-dotenv
```

2. Create a `.env` file:

```env
TON_ADDRESS=EQC...your-ton-address
TON_NETWORK=ton:testnet
FACILITATOR_URL=https://facilitator.t402.io
PORT=4021
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TON_ADDRESS` | Your TON wallet address to receive payments | Required |
| `TON_NETWORK` | TON network identifier | `ton:testnet` |
| `FACILITATOR_URL` | URL of the t402 facilitator | Required |
| `PORT` | Server port | `4021` |

## Run

```bash
python app.py
```

## Endpoints

| Method | Endpoint | Price | Description |
|--------|----------|-------|-------------|
| GET | `/weather` | $0.001 USDT | Weather data |
| GET | `/premium` | $0.01 USDT | Premium content |
| POST | `/ai/generate` | $0.05 USDT | AI content generation |
| GET | `/health` | Free | Health check |

## Testing

1. Start the server
2. Make a request without payment:

```bash
curl http://localhost:4021/weather
```

You'll receive a 402 response with a payment page.

3. Use a t402 client with TON support to make the paid request

## Code Explanation

### Creating the Paywall

```python
from t402.flask import create_paywall
from t402.ton import TON_TESTNET

paywall = create_paywall(
    routes={
        "GET /weather": {
            "price": "$0.001",
            "network": TON_TESTNET,  # or "ton:mainnet"
            "pay_to": ton_address,
            "description": "Weather data",
        },
    },
    facilitator_url=facilitator_url,
)

app.register_blueprint(paywall)
```

### Network Constants

```python
from t402.ton import TON_MAINNET, TON_TESTNET

# TON_MAINNET = "ton:mainnet"
# TON_TESTNET = "ton:testnet"
```

### USDT Addresses

```python
from t402.ton import USDT_MAINNET_ADDRESS, USDT_TESTNET_ADDRESS

# Mainnet: EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs
# Testnet: kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx
```

## Multi-Network Support

To accept payments on multiple networks (EVM + TON):

```python
paywall = create_paywall(
    routes={
        "GET /weather": [
            {
                "price": "$0.001",
                "network": "eip155:8453",  # Base
                "pay_to": evm_address,
                "description": "Weather data",
            },
            {
                "price": "$0.001",
                "network": "ton:mainnet",
                "pay_to": ton_address,
                "description": "Weather data",
            },
        ],
    },
    facilitator_url=facilitator_url,
)
```

## FastAPI Support

The t402 Python SDK also supports FastAPI:

```python
from fastapi import FastAPI
from t402.fastapi import create_paywall

app = FastAPI()

paywall = create_paywall(
    routes={
        "GET /weather": {
            "price": "$0.001",
            "network": "ton:testnet",
            "pay_to": ton_address,
        },
    },
    facilitator_url=facilitator_url,
)

app.include_router(paywall)
```
