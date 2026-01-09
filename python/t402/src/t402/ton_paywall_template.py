# THIS FILE IS AUTO-GENERATED - DO NOT EDIT
# TON Paywall Template - A simple placeholder template for TON payments
# In production, this would be a full React-based paywall like the EVM/SVM templates

TON_PAYWALL_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Required - TON</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            min-height: 100vh;
            background-color: #f9fafb;
            font-family: Inter, system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            max-width: 32rem;
            margin: 2rem;
            padding: 2rem;
            background-color: white;
            border-radius: 0.75rem;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
            text-align: center;
        }
        .logo {
            width: 64px;
            height: 64px;
            margin: 0 auto 1rem;
        }
        .title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #111827;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            color: #6b7280;
            margin-bottom: 1.5rem;
        }
        .payment-details {
            background-color: #f3f4f6;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
        }
        .payment-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
        }
        .payment-row:last-child { margin-bottom: 0; }
        .payment-label { color: #6b7280; }
        .payment-value { font-weight: 600; color: #111827; }
        .button {
            width: 100%;
            padding: 0.75rem 1rem;
            border-radius: 0.5rem;
            font-weight: 600;
            border: none;
            cursor: pointer;
            background-color: #0098EA;
            color: white;
            font-size: 1rem;
            transition: background-color 0.15s;
        }
        .button:hover { background-color: #0088D4; }
        .button:disabled {
            background-color: #9ca3af;
            cursor: not-allowed;
        }
        .ton-logo {
            fill: #0098EA;
        }
        .status {
            margin-top: 1rem;
            font-size: 0.875rem;
            color: #6b7280;
        }
        .error {
            color: #dc2626;
            background-color: #fef2f2;
            padding: 0.75rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <svg class="logo" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/>
            <path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5603 15.6277ZM26.2211 36.5583L23.6856 31.0379L17.4565 19.7027C17.0579 18.9891 17.5607 18.0868 18.4386 18.0868H26.2211V36.5583ZM38.5765 19.6635L32.3474 31.0379L29.7711 36.5583V18.0868H37.5603C38.4382 18.0868 38.941 18.9891 38.5765 19.6635Z" fill="white"/>
        </svg>
        <h1 class="title">Payment Required</h1>
        <p class="subtitle">This resource requires a TON payment to access.</p>

        <div id="error-container"></div>

        <div class="payment-details">
            <div class="payment-row">
                <span class="payment-label">Amount</span>
                <span class="payment-value" id="amount">Loading...</span>
            </div>
            <div class="payment-row">
                <span class="payment-label">Token</span>
                <span class="payment-value">USDT</span>
            </div>
            <div class="payment-row">
                <span class="payment-label">Network</span>
                <span class="payment-value" id="network">TON</span>
            </div>
        </div>

        <button class="button" id="connect-btn" onclick="connectWallet()">
            Connect TON Wallet
        </button>

        <p class="status" id="status"></p>
    </div>

    <script>
        // Initialize from window.t402 config
        document.addEventListener('DOMContentLoaded', function() {
            if (window.t402) {
                const config = window.t402;

                // Display amount
                if (config.amount) {
                    document.getElementById('amount').textContent = '$' + config.amount.toFixed(2) + ' USDT';
                }

                // Display network
                if (config.paymentRequirements && config.paymentRequirements[0]) {
                    const network = config.paymentRequirements[0].network;
                    document.getElementById('network').textContent =
                        network === 'ton:testnet' ? 'TON Testnet' : 'TON Mainnet';
                }

                // Display error if any
                if (config.error) {
                    const errorContainer = document.getElementById('error-container');
                    errorContainer.innerHTML = '<div class="error">' + config.error + '</div>';
                }
            }
        });

        async function connectWallet() {
            const btn = document.getElementById('connect-btn');
            const status = document.getElementById('status');

            btn.disabled = true;
            btn.textContent = 'Connecting...';
            status.textContent = '';

            try {
                // Check for TON wallet providers
                if (typeof window.tonkeeper !== 'undefined') {
                    status.textContent = 'Tonkeeper detected. Please approve the connection.';
                    // Tonkeeper integration would go here
                } else if (typeof window.ton !== 'undefined') {
                    status.textContent = 'TON wallet detected. Please approve the connection.';
                    // Generic TON wallet integration would go here
                } else {
                    status.textContent = 'No TON wallet detected. Please install Tonkeeper or another TON wallet.';
                    btn.textContent = 'Install Wallet';
                    btn.onclick = function() {
                        window.open('https://tonkeeper.com/', '_blank');
                    };
                    btn.disabled = false;
                    return;
                }

                // In a full implementation, this would:
                // 1. Connect to the wallet
                // 2. Build the Jetton transfer message
                // 3. Sign the message
                // 4. Create the payment payload
                // 5. Retry the original request with the payment header

            } catch (error) {
                status.textContent = 'Error: ' + error.message;
                btn.disabled = false;
                btn.textContent = 'Connect TON Wallet';
            }
        }
    </script>
</body>
</html>"""
