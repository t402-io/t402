# t402

t402 is an open standard for internet native payments. It aims to support all networks (both crypto & fiat) and forms of value (stablecoins, tokens, fiat).

```typescript
app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: [...],                 // As many networks / schemes as you want to support
        description: "Weather data",    // what your endpoint does
      },
    },
  ),
);
// That's it! See examples/ for full details
```

<details>
<summary><b>Installation</b></summary>

### TypeScript

```shell
# All available packages
pnpm add @t402/core @t402/evm @t402/svm @t402/ton @t402/tron @t402/wdk @t402/extensions

# Minimal client
pnpm add @t402/core @t402/evm

# Or with npm
npm install @t402/core @t402/evm
```

### Python

```shell
pip install t402

# Or with uv
uv add t402
```

### Go

```shell
# Set GOPRIVATE (one-time setup, required for private repo)
go env -w GOPRIVATE=github.com/t402-io/t402

# Install
go get github.com/t402-io/t402/go@v1.0.0
```

</details>

<details>
<summary><b>Supported Networks</b></summary>

### EVM (Ethereum Virtual Machine)
- Ethereum Mainnet (`eip155:1`)
- Base (`eip155:8453`, `eip155:84532`)
- Optimism, Arbitrum, Polygon, and more
- Supports USDC, USDT, and native tokens

### ERC-4337 Account Abstraction
- **Gasless Transactions**: Users pay zero gas fees via paymaster sponsorship
- **Smart Accounts**: Safe 4337 Module v0.3.0 integration
- **Bundlers**: Pimlico, Alchemy, and generic bundler support
- **Paymasters**: Pimlico, Biconomy, Stackup integrations
- **EntryPoint v0.7**: Full support for latest ERC-4337 specification
- Supported on all EVM networks above

### SVM (Solana Virtual Machine)
- Solana Mainnet (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)
- Solana Devnet (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`)
- Supports USDC and native SOL

### TON (The Open Network)
- TON Mainnet (`ton:mainnet`)
- TON Testnet (`ton:testnet`)
- Supports USDT Jetton (TEP-74 standard)
- Pre-signed BOC message format

### TRON
- TRON Mainnet (`tron:mainnet`)
- TRON Nile Testnet (`tron:nile`)
- TRON Shasta Testnet (`tron:shasta`)
- Supports USDT TRC-20 (TIP-20 standard)
- Pre-signed transaction format

### USDT0 Cross-Chain Bridge (LayerZero)
- **Cross-chain USDT0 transfers** via LayerZero OFT standard
- **Supported chains**: Ethereum, Arbitrum, Ink, Berachain, Unichain
- **Message tracking** via LayerZero Scan API
- **Cross-chain payment routing** for multi-chain payments

</details>

## Principles

- **Open standard:** the t402 protocol will never force reliance on a single party
- **HTTP Native:** t402 is meant to seamlessly complement the existing HTTP request made by traditional web services, it should not mandate additional requests outside the scope of a typical client / server flow.
- **Chain and token agnostic:** we welcome contributions that add support for new chains, signing standards, or schemes, so long as they meet our acceptance criteria laid out in [CONTRIBUTING.md](https://github.com/t402-io/t402/blob/main/CONTRIBUTING.md)
- **Trust minimizing:** all payment schemes must not allow for the facilitator or resource server to move funds, other than in accordance with client intentions
- **Easy to use:** t402 needs to be 10x better than existing ways to pay on the internet. This means abstracting as many details of crypto as possible away from the client and resource server, and into the facilitator. This means the client/server should not need to think about gas, rpc, etc.

## Ecosystem

The t402 ecosystem is growing! Check out our [ecosystem page](https://t402.org/ecosystem) to see projects building with t402, including:

- Client-side integrations
- Services and endpoints
- Ecosystem infrastructure and tooling
- Learning and community resources

Want to add your project to the ecosystem? See our [demo site README](https://github.com/t402-io/t402/tree/main/typescript/site#adding-your-project-to-the-ecosystem) for detailed instructions on how to submit your project.

**Roadmap:** see [ROADMAP.md](https://github.com/t402-io/t402/blob/main/ROADMAP.md)

## Terms:

- `resource`: Something on the internet. This could be a webpage, file server, RPC service, API, any resource on the internet that accepts HTTP / HTTPS requests.
- `client`: An entity wanting to pay for a resource.
- `facilitator`: A server that facilitates verification and execution of payments for one or many networks.
- `resource server`: An HTTP server that provides an API or other resource for a client.

## Technical Goals:

- Permissionless and secure for clients, servers, and facilitators
- Minimal friction to adopt for both client and resource servers
- Minimal integration for the resource server and client (1 line for the server, 1 function for the client)
- Ability to trade off speed of response for guarantee of payment
- Extensible to different payment flows and networks

## Specification

See `specs/` for full documentation of the t402 standard/

### Typical t402 flow

t402 payments typically adhere to the following flow, but servers have a lot of flexibility. See `advanced` folders in `examples/`.
![](./static/flow.png)

The following outlines the flow of a payment using the `t402` protocol. Note that steps (1) and (2) are optional if the client already knows the payment details accepted for a resource.

1. `Client` makes an HTTP request to a `resource server`.

2. `Resource server` responds with a `402 Payment Required` status and a `PaymentRequired` b64 object return as a `PAYMENT-REQUIRED` header.

3. `Client` selects one of the `PaymentRequirements` returned by the server response and creates a `PaymentPayload` based on the `scheme` & `network` of the `PaymentRequirements` they have selected.

4. `Client` sends the HTTP request with the `PAYMENT-SIGNATURE` header containing the `PaymentPayload` to the resource server.

5. `Resource server` verifies the `PaymentPayload` is valid either via local verification or by POSTing the `PaymentPayload` and `PaymentRequirements` to the `/verify` endpoint of a `facilitator`.

6. `Facilitator` performs verification of the object based on the `scheme` and `network` of the `PaymentPayload` and returns a `Verification Response`.

7. If the `Verification Response` is valid, the resource server performs the work to fulfill the request. If the `Verification Response` is invalid, the resource server returns a `402 Payment Required` status and a `Payment Required Response` JSON object in the response body.

8. `Resource server` either settles the payment by interacting with a blockchain directly, or by POSTing the `Payment Payload` and `Payment PaymentRequirements` to the `/settle` endpoint of a `facilitator server`.

9. `Facilitator server` submits the payment to the blockchain based on the `scheme` and `network` of the `Payment Payload`.

10. `Facilitator server` waits for the payment to be confirmed on the blockchain.

11. `Facilitator server` returns a `Payment Execution Response` to the resource server.

12. `Resource server` returns a `200 OK` response to the `Client` with the resource they requested as the body of the HTTP response, and a `PAYMENT-RESPONSE` header containing the `Settlement Response` as Base64 encoded JSON if the payment was executed successfully.

### Schemes

A scheme is a logical way of moving money.

Blockchains allow for a large number of flexible ways to move money. To help facilitate an expanding number of payment use cases, the `t402` protocol is extensible to different ways of settling payments via its `scheme` field.

Each payment scheme may have different operational functionality depending on what actions are necessary to fulfill the payment.
For example `exact`, the first scheme shipping as part of the protocol, would have different behavior than `upto`. `exact` transfers a specific amount (ex: pay $1 to read an article), while a theoretical `upto` would transfer up to an amount, based on the resources consumed during a request (ex: generating tokens from an LLM).

See `specs/schemes` for more details on schemes, and see `specs/schemes/exact/scheme_exact_evm.md` to see the first proposed scheme for exact payment on EVM chains.

### Schemes vs Networks

Because a scheme is a logical way of moving money, the way a scheme is implemented can be different for different blockchains. (ex: the way you need to implement `exact` on Ethereum is very different from the way you need to implement `exact` on Solana).

Clients and facilitators must explicitly support different `(scheme, network)` pairs in order to be able to create proper payloads and verify / settle payments.

## Quick Start Examples

<details>
<summary><b>TypeScript Client (Multi-Network)</b></summary>

```typescript
import { t402Client, wrapFetchWithPayment } from "@t402/fetch";
import { registerExactEvmScheme } from "@t402/evm/exact/client";
import { registerExactTonClientScheme } from "@t402/ton";
import { registerExactTronClientScheme } from "@t402/tron";
import { privateKeyToAccount } from "viem/accounts";

// Create client and register payment schemes
const client = new t402Client();

// Register EVM networks
registerExactEvmScheme(client, {
  signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`),
});

// Register TON networks
registerExactTonClientScheme(client, {
  signer: tonSigner,
  getJettonWalletAddress: async (owner, master) => jettonWalletAddress,
});

// Register TRON networks
registerExactTronClientScheme(client, {
  signer: tronSigner,
});

// Make payments automatically
const fetchWithPayment = wrapFetchWithPayment(fetch, client);
const response = await fetchWithPayment("https://api.example.com/data");
```

</details>

<details>
<summary><b>TypeScript Server (Multi-Network)</b></summary>

```typescript
import express from "express";
import { paymentMiddleware, t402ResourceServer } from "@t402/express";
import { ExactEvmScheme } from "@t402/evm/exact/server";
import { ExactTonScheme } from "@t402/ton/exact/server";
import { ExactTronScheme } from "@t402/tron/exact/server";

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /api/data": {
        accepts: [
          // Accept EVM payments
          { scheme: "exact", price: "$0.01", network: "eip155:8453", payTo: evmAddress },
          // Accept TON payments
          { scheme: "exact", price: "$0.01", network: "ton:mainnet", payTo: tonAddress },
          // Accept TRON payments
          { scheme: "exact", price: "$0.01", network: "tron:mainnet", payTo: tronAddress },
        ],
        description: "Premium API data",
      },
    },
    new t402ResourceServer(facilitatorClient)
      .register("eip155:8453", new ExactEvmScheme())
      .register("ton:mainnet", new ExactTonScheme())
      .register("tron:mainnet", new ExactTronScheme()),
  ),
);
```

</details>

<details>
<summary><b>Python Server (TON/TRON)</b></summary>

```python
from flask import Flask
from t402.flask import create_paywall
from t402.tron import TRON_MAINNET

app = Flask(__name__)

# Create paywall with TON and TRON support
paywall = create_paywall(
    routes={
        "GET /api/data": {
            "price": "$0.01",
            "network": "ton:mainnet",  # or TRON_MAINNET for TRON
            "pay_to": "EQC...",  # TON or TRON address
            "description": "Premium API data",
        },
        "GET /api/premium": {
            "price": "$0.05",
            "network": TRON_MAINNET,  # tron:mainnet
            "pay_to": "TR7NHq...",  # TRON address
            "description": "Premium content",
        },
    },
    facilitator_url="https://facilitator.example.com",
)
app.register_blueprint(paywall)

@app.route("/api/data")
def get_data():
    return {"data": "premium content"}
```

</details>

<details>
<summary><b>Go Client (Multi-Network)</b></summary>

```go
package main

import (
    t402 "github.com/t402-io/t402/go"
    tonclient "github.com/t402-io/t402/go/mechanisms/ton/exact/client"
    tronclient "github.com/t402-io/t402/go/mechanisms/tron/exact/client"
)

func main() {
    // Create client
    client := t402.NewClient()

    // Register TON scheme
    tonScheme := tonclient.NewExactTonScheme(tonSigner)
    client.Register(t402.Network("ton:mainnet"), tonScheme)

    // Register TRON scheme
    tronScheme := tronclient.NewExactTronScheme(tronSigner)
    client.Register(t402.Network("tron:mainnet"), tronScheme)

    // Make request with automatic payment
    // The client will select the appropriate network based on server requirements
}
```

</details>

<details>
<summary><b>ERC-4337 Gasless Transactions (TypeScript)</b></summary>

```typescript
import { SafeSmartAccount, createBundlerClient, createPaymaster } from "@t402/evm/erc4337";

// 1. Create Safe smart account
const safeAccount = new SafeSmartAccount({
  owner: privateKeyToAccount(ownerPrivateKey),
  chainId: 8453, // Base
  salt: 0n,
});
const smartAccountAddress = await safeAccount.getAddress();

// 2. Connect to Pimlico bundler
const bundler = createBundlerClient({
  provider: "pimlico",
  apiKey: process.env.PIMLICO_API_KEY,
  chainId: 8453,
});

// 3. Setup paymaster for gas sponsorship
const paymaster = createPaymaster({
  provider: "pimlico",
  apiKey: process.env.PIMLICO_API_KEY,
  chainId: 8453,
});

// 4. Build UserOperation
const callData = safeAccount.encodeExecute(targetAddress, 0n, data);
const userOp = await bundler.buildUserOperation({
  sender: smartAccountAddress,
  callData,
});

// 5. Get paymaster sponsorship
const paymasterData = await paymaster.sponsorUserOperation(userOp);

// 6. Sign and submit
const signature = await safeAccount.signUserOpHash(userOpHash);
const hash = await bundler.sendUserOperation({ ...userOp, ...paymasterData, signature });
const receipt = await bundler.waitForReceipt(hash);
```

</details>

<details>
<summary><b>ERC-4337 Gasless Transactions (Python)</b></summary>

```python
from t402.erc4337 import (
    SafeSmartAccount, SafeAccountConfig,
    create_bundler_client, create_paymaster,
    ENTRYPOINT_V07_ADDRESS,
)

# 1. Create Safe smart account
safe_account = SafeSmartAccount(SafeAccountConfig(
    owner_private_key="0x...",
    chain_id=8453,  # Base
    salt=0,
))
smart_account_address = safe_account.get_address()

# 2. Connect to Pimlico bundler
bundler = create_bundler_client(
    provider="pimlico",
    api_key=os.getenv("PIMLICO_API_KEY"),
    chain_id=8453,
)

# 3. Setup paymaster for gas sponsorship
paymaster = create_paymaster(
    provider="pimlico",
    api_key=os.getenv("PIMLICO_API_KEY"),
    chain_id=8453,
)

# 4. Build UserOperation
call_data = safe_account.encode_execute(target_address, 0, b"")
user_op = UserOperation(
    sender=smart_account_address,
    call_data=call_data,
    # ... gas limits
)

# 5. Get paymaster sponsorship
paymaster_data = paymaster.get_paymaster_data(user_op, 8453, ENTRYPOINT_V07_ADDRESS)

# 6. Submit to bundler
user_op_hash = bundler.send_user_operation(user_op)
receipt = bundler.wait_for_receipt(user_op_hash)
```

</details>

<details>
<summary><b>ERC-4337 Gasless Transactions (Go)</b></summary>

```go
import "github.com/t402-io/t402/go/mechanisms/evm/erc4337"

// 1. Create Safe smart account
safeAccount, _ := erc4337.NewSafeSmartAccount(erc4337.SafeAccountConfig{
    Owner:   privateKey,
    ChainID: 8453, // Base
    Salt:    big.NewInt(0),
})
smartAccountAddress, _ := safeAccount.GetAddress()

// 2. Connect to Pimlico bundler
bundler := erc4337.NewPimlicoBundlerClient(erc4337.PimlicoConfig{
    APIKey:  os.Getenv("PIMLICO_API_KEY"),
    ChainID: 8453,
})

// 3. Setup paymaster for gas sponsorship
paymaster := erc4337.NewPimlicoPaymaster(erc4337.PimlicoPaymasterConfig{
    APIKey:  os.Getenv("PIMLICO_API_KEY"),
    ChainID: 8453,
})

// 4. Build UserOperation
callData, _ := safeAccount.EncodeExecute(targetAddress, big.NewInt(0), []byte{})
userOp := &erc4337.UserOperation{
    Sender:   smartAccountAddress,
    CallData: callData,
    // ... gas limits
}

// 5. Get paymaster sponsorship
paymasterData, _ := paymaster.SponsorUserOperation(userOp)

// 6. Submit to bundler
hash, _ := bundler.SendUserOperation(userOp)
receipt, _ := bundler.WaitForReceipt(hash, 60*time.Second, 2*time.Second)
```

</details>

<details>
<summary><b>USDT0 Cross-Chain Bridge (TypeScript)</b></summary>

```typescript
import {
  Usdt0Bridge,
  LayerZeroScanClient,
  getBridgeableChains,
} from "@t402/evm";

// Check supported chains
console.log(getBridgeableChains()); // ['ethereum', 'arbitrum', 'ink', 'berachain', 'unichain']

// Create bridge client
const bridge = new Usdt0Bridge(signer, "arbitrum");

// Get quote
const quote = await bridge.quote({
  fromChain: "arbitrum",
  toChain: "ethereum",
  amount: 100_000000n, // 100 USDT0
  recipient: "0x...",
});
console.log(`Fee: ${quote.nativeFee} wei`);

// Execute bridge
const result = await bridge.send({
  fromChain: "arbitrum",
  toChain: "ethereum",
  amount: 100_000000n,
  recipient: "0x...",
});
console.log(`TX: ${result.txHash}`);
console.log(`Message GUID: ${result.messageGuid}`);

// Track delivery via LayerZero Scan
const scanClient = new LayerZeroScanClient();
const message = await scanClient.waitForDelivery(result.messageGuid, {
  onStatusChange: (status) => console.log(`Status: ${status}`),
});
console.log(`Delivered! Dest TX: ${message.dstTxHash}`);
```

</details>

<details>
<summary><b>USDT0 Cross-Chain Bridge (Python)</b></summary>

```python
from t402.bridge import (
    Usdt0Bridge,
    LayerZeroScanClient,
    BridgeQuoteParams,
    BridgeExecuteParams,
    get_bridgeable_chains,
)

# Check supported chains
print(get_bridgeable_chains())  # ['ethereum', 'arbitrum', 'ink', ...]

# Create bridge client
bridge = Usdt0Bridge(signer, "arbitrum")

# Get quote
quote = await bridge.quote(BridgeQuoteParams(
    from_chain="arbitrum",
    to_chain="ethereum",
    amount=100_000000,  # 100 USDT0
    recipient="0x...",
))
print(f"Fee: {quote.native_fee} wei")

# Execute bridge
result = await bridge.send(BridgeExecuteParams(
    from_chain="arbitrum",
    to_chain="ethereum",
    amount=100_000000,
    recipient="0x...",
))
print(f"TX: {result.tx_hash}")
print(f"Message GUID: {result.message_guid}")

# Track delivery via LayerZero Scan
scan_client = LayerZeroScanClient()
message = await scan_client.wait_for_delivery(
    result.message_guid,
    on_status_change=lambda s: print(f"Status: {s}"),
)
print(f"Delivered! Dest TX: {message.dst_tx_hash}")
```

</details>

<details>
<summary><b>USDT0 Cross-Chain Bridge (Go)</b></summary>

```go
import (
    "math/big"
    "github.com/t402-io/t402/go/mechanisms/evm/bridge"
)

// Check supported chains
chains := bridge.GetBridgeableChains() // [ethereum, arbitrum, ink, ...]

// Create bridge client
bridgeClient, _ := bridge.NewUsdt0Bridge(signer, "arbitrum")

// Get quote
quote, _ := bridgeClient.Quote(ctx, &bridge.BridgeQuoteParams{
    FromChain: "arbitrum",
    ToChain:   "ethereum",
    Amount:    big.NewInt(100_000000), // 100 USDT0
    Recipient: "0x...",
})
fmt.Printf("Fee: %s wei\n", quote.NativeFee)

// Execute bridge
result, _ := bridgeClient.Send(ctx, &bridge.BridgeExecuteParams{
    BridgeQuoteParams: bridge.BridgeQuoteParams{
        FromChain: "arbitrum",
        ToChain:   "ethereum",
        Amount:    big.NewInt(100_000000),
        Recipient: "0x...",
    },
})
fmt.Printf("TX: %s\n", result.TxHash)
fmt.Printf("Message GUID: %s\n", result.MessageGUID)

// Track delivery via LayerZero Scan
scanClient := bridge.NewLayerZeroScanClient()
message, _ := scanClient.WaitForDelivery(ctx, result.MessageGUID, &bridge.WaitForDeliveryOptions{
    OnStatusChange: func(status bridge.LayerZeroMessageStatus) {
        fmt.Printf("Status: %s\n", status)
    },
})
fmt.Printf("Delivered! Dest TX: %s\n", message.DstTxHash)
```

</details>
