"""
Example Flask server with t402 TON payment protection.

This example demonstrates how to:
1. Create a Flask server with t402 middleware
2. Configure payment routes with TON USDT Jetton requirements
3. Protect endpoints with micropayments

Required environment variables:
- TON_ADDRESS: TON wallet address to receive payments
- FACILITATOR_URL: URL of the t402 facilitator
"""

import os
from datetime import datetime, timezone
from flask import Flask, jsonify, request
from dotenv import load_dotenv

from t402.flask import create_paywall
from t402.ton import TON_MAINNET, TON_TESTNET

# Load environment variables
load_dotenv()

ton_address = os.getenv("TON_ADDRESS")
if not ton_address:
    print("❌ TON_ADDRESS environment variable is required")
    print("   Example: EQC... (your TON wallet address)")
    exit(1)

facilitator_url = os.getenv("FACILITATOR_URL")
if not facilitator_url:
    print("❌ FACILITATOR_URL environment variable is required")
    print("   Example: https://facilitator.t402.io")
    exit(1)

network = os.getenv("TON_NETWORK", TON_TESTNET)
port = int(os.getenv("PORT", "4021"))

print("🚀 Starting TON t402 Flask server...")
print(f"   TON Address: {ton_address}")
print(f"   Network: {network}")
print(f"   Facilitator: {facilitator_url}")

app = Flask(__name__)

# Configure t402 payment routes
paywall = create_paywall(
    routes={
        "GET /weather": {
            "price": "$0.001",
            "network": network,
            "pay_to": ton_address,
            "description": "Weather data",
        },
        "GET /premium": {
            "price": "$0.01",
            "network": network,
            "pay_to": ton_address,
            "description": "Premium content",
        },
        "POST /ai/generate": {
            "price": "$0.05",
            "network": network,
            "pay_to": ton_address,
            "description": "AI content generation",
        },
    },
    facilitator_url=facilitator_url,
)

# Register the paywall blueprint
app.register_blueprint(paywall)


@app.route("/weather")
def weather():
    """Weather endpoint - requires $0.001 USDT on TON."""
    city = request.args.get("city", "San Francisco")

    weather_data = {
        "San Francisco": {"weather": "foggy", "temperature": 60},
        "New York": {"weather": "cloudy", "temperature": 55},
        "London": {"weather": "rainy", "temperature": 50},
        "Tokyo": {"weather": "clear", "temperature": 65},
    }

    data = weather_data.get(city, {"weather": "sunny", "temperature": 70})

    return jsonify({
        "city": city,
        **data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/premium")
def premium():
    """Premium endpoint - requires $0.01 USDT on TON."""
    return jsonify({
        "content": "This is premium content protected by TON USDT payments",
        "features": ["Advanced analytics", "Priority support", "Extended history"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/ai/generate", methods=["POST"])
def ai_generate():
    """AI generation endpoint - requires $0.05 USDT on TON."""
    data = request.get_json() or {}
    prompt = data.get("prompt", "")

    return jsonify({
        "prompt": prompt,
        "generated": "This is a placeholder for AI-generated content based on your prompt.",
        "model": "example-model-v1",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@app.route("/health")
def health():
    """Health check - no payment required."""
    return jsonify({
        "status": "ok",
        "network": network,
        "version": "1.1.0",
    })


if __name__ == "__main__":
    print(f"   Server listening on http://localhost:{port}\n")
    print("Endpoints:")
    print(f"   GET  /weather     - $0.001 USDT ({network})")
    print(f"   GET  /premium     - $0.01 USDT ({network})")
    print(f"   POST /ai/generate - $0.05 USDT ({network})")
    print("   GET  /health      - Free")
    print()

    app.run(host="0.0.0.0", port=port, debug=True)
