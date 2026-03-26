import type { Language } from "./syntax-highlighter";

export interface SdkExample {
  label: string;
  language: Language;
  code: string;
}

export type ScenarioId =
  | "ai-api"
  | "content-paywall"
  | "data-marketplace"
  | "agent-to-agent"
  | "iot-micropayments"
  | "streaming-media"
  | "mcp-ai-agent"
  | "cross-chain-bridge"
  | "gasless-payment"
  | "dex-swap";

// Client-side SDK examples showing how to integrate T402 for each scenario
const EXAMPLES: Record<ScenarioId, SdkExample[]> = {
  "ai-api": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { createT402Fetch } from '@t402/fetch';
import { ExactEVMClient } from '@t402/evm/exact/client';

const client = new ExactEVMClient({ signer });
const t402Fetch = createT402Fetch({ client });

// Just fetch — T402 handles 402 + signing automatically
const res = await t402Fetch("https://ai.example.com/v1/query", {
  method: "POST",
  body: JSON.stringify({ prompt: "What is T402?" }),
});

const data = await res.json();
console.log(data.response);`,
    },
    {
      label: "Go",
      language: "go",
      code: `import (
    "github.com/t402-io/t402/sdks/go/http"
    "github.com/t402-io/t402/sdks/go/mechanisms/evm"
)

client := evm.NewExactClient(privateKey)
t402Client := http.NewClient(client)

body := map[string]string{"prompt": "What is T402?"}
resp, err := t402Client.Post(
    "https://ai.example.com/v1/query",
    body,
)

var result AIResponse
json.NewDecoder(resp.Body).Decode(&result)
fmt.Println(result.Response)`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402 import T402Client
from t402.mechanisms.evm import ExactEVMClient

client = ExactEVMClient(private_key=key)
t402 = T402Client(client)

# Automatic 402 handling + payment signing
response = t402.post(
    "https://ai.example.com/v1/query",
    json={"prompt": "What is T402?"}
)

data = response.json()
print(data["response"])`,
    },
    {
      label: "Java",
      language: "java",
      code: `import io.t402.T402Client;
import io.t402.mechanisms.evm.ExactEVMClient;

ExactEVMClient evmClient = new ExactEVMClient(privateKey);
T402Client client = new T402Client(evmClient);

Map<String, String> body = Map.of("prompt", "What is T402?");
T402Response response = client.post(
    "https://ai.example.com/v1/query",
    body
);

AIResult result = response.as(AIResult.class);
System.out.println(result.getResponse());`,
    },
  ],

  "content-paywall": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { createT402Fetch } from '@t402/fetch';
import { ExactEVMClient } from '@t402/evm/exact/client';

const client = new ExactEVMClient({ signer });
const t402Fetch = createT402Fetch({ client });

// Access paywalled content — pays 0.01 USDT automatically
const res = await t402Fetch("https://blog.example.com/premium/article-42");
const article = await res.json();

console.log(article.title);
console.log(article.content);`,
    },
    {
      label: "Go",
      language: "go",
      code: `client := evm.NewExactClient(privateKey)
t402Client := http.NewClient(client)

resp, err := t402Client.Get(
    "https://blog.example.com/premium/article-42",
)

var article Article
json.NewDecoder(resp.Body).Decode(&article)
fmt.Println(article.Title)`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402 import T402Client
from t402.mechanisms.evm import ExactEVMClient

client = ExactEVMClient(private_key=key)
t402 = T402Client(client)

# Automatic paywall bypass via USDT payment
response = t402.get("https://blog.example.com/premium/article-42")
article = response.json()
print(article["title"])`,
    },
    {
      label: "Java",
      language: "java",
      code: `ExactEVMClient evmClient = new ExactEVMClient(privateKey);
T402Client client = new T402Client(evmClient);

T402Response response = client.get(
    "https://blog.example.com/premium/article-42"
);

Article article = response.as(Article.class);
System.out.println(article.getTitle());`,
    },
  ],

  "data-marketplace": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { createT402Fetch } from '@t402/fetch';
import { ExactEVMClient } from '@t402/evm/exact/client';

const client = new ExactEVMClient({ signer });
const t402Fetch = createT402Fetch({ client });

// Pay-per-request market data
const res = await t402Fetch("https://data.example.com/v1/price/BTC");
const data = await res.json();

console.log(\`BTC: $\${data.price}\`);
console.log(\`Updated: \${data.timestamp}\`);`,
    },
    {
      label: "Go",
      language: "go",
      code: `client := evm.NewExactClient(privateKey)
t402Client := http.NewClient(client)

resp, err := t402Client.Get(
    "https://data.example.com/v1/price/BTC",
)

var price PriceData
json.NewDecoder(resp.Body).Decode(&price)
fmt.Printf("BTC: $%.2f\\n", price.Price)`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402 import T402Client
from t402.mechanisms.evm import ExactEVMClient

client = ExactEVMClient(private_key=key)
t402 = T402Client(client)

response = t402.get("https://data.example.com/v1/price/BTC")
data = response.json()
print(f"BTC: {data['price']}")`,
    },
    {
      label: "Java",
      language: "java",
      code: `ExactEVMClient evmClient = new ExactEVMClient(privateKey);
T402Client client = new T402Client(evmClient);

T402Response response = client.get(
    "https://data.example.com/v1/price/BTC"
);

PriceData data = response.as(PriceData.class);
System.out.printf("BTC: $%.2f%n", data.getPrice());`,
    },
  ],

  "agent-to-agent": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { createT402Fetch } from '@t402/fetch';
import { ExactEVMClient } from '@t402/evm/exact/client';

// Agent's own wallet for autonomous payments
const agentClient = new ExactEVMClient({ signer: agentWallet });
const t402Fetch = createT402Fetch({ client: agentClient });

// Agent delegates task to another agent, pays automatically
const res = await t402Fetch("https://agent-b.example.com/a2a/task", {
  method: "POST",
  body: JSON.stringify({
    task: "analyze",
    input: { dataset: "quarterly-revenue" },
  }),
});

const result = await res.json();
console.log(result.analysis);`,
    },
    {
      label: "Go",
      language: "go",
      code: `// Agent's wallet for autonomous payments
client := evm.NewExactClient(agentPrivateKey)
t402Client := http.NewClient(client)

task := map[string]interface{}{
    "task":  "analyze",
    "input": map[string]string{"dataset": "quarterly-revenue"},
}

resp, err := t402Client.Post(
    "https://agent-b.example.com/a2a/task",
    task,
)

var result AnalysisResult
json.NewDecoder(resp.Body).Decode(&result)`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402 import T402Client
from t402.mechanisms.evm import ExactEVMClient

# Agent's wallet for autonomous payments
client = ExactEVMClient(private_key=agent_key)
t402 = T402Client(client)

response = t402.post(
    "https://agent-b.example.com/a2a/task",
    json={
        "task": "analyze",
        "input": {"dataset": "quarterly-revenue"},
    }
)

result = response.json()
print(result["analysis"])`,
    },
    {
      label: "Java",
      language: "java",
      code: `// Agent's wallet for autonomous payments
ExactEVMClient evmClient = new ExactEVMClient(agentKey);
T402Client client = new T402Client(evmClient);

Map<String, Object> task = Map.of(
    "task", "analyze",
    "input", Map.of("dataset", "quarterly-revenue")
);

T402Response response = client.post(
    "https://agent-b.example.com/a2a/task", task
);

AnalysisResult result = response.as(AnalysisResult.class);`,
    },
  ],

  "iot-micropayments": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { createT402Fetch } from '@t402/fetch';
import { ExactEVMClient } from '@t402/evm/exact/client';

const client = new ExactEVMClient({ signer });
const t402Fetch = createT402Fetch({ client });

// Pay 0.0001 USDT per sensor reading
const res = await t402Fetch("https://iot.example.com/sensors/temp-01");
const reading = await res.json();

console.log(\`Temperature: \${reading.value}\${reading.unit}\`);
console.log(\`Timestamp: \${reading.timestamp}\`);`,
    },
    {
      label: "Go",
      language: "go",
      code: `client := evm.NewExactClient(privateKey)
t402Client := http.NewClient(client)

// Micropayment per sensor reading
resp, err := t402Client.Get(
    "https://iot.example.com/sensors/temp-01",
)

var reading SensorReading
json.NewDecoder(resp.Body).Decode(&reading)
fmt.Printf("Temp: %.1f%s\\n", reading.Value, reading.Unit)`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402 import T402Client
from t402.mechanisms.evm import ExactEVMClient

client = ExactEVMClient(private_key=key)
t402 = T402Client(client)

# 0.0001 USDT per reading
response = t402.get("https://iot.example.com/sensors/temp-01")
reading = response.json()
print(f"Temp: {reading['value']}{reading['unit']}")`,
    },
    {
      label: "Java",
      language: "java",
      code: `ExactEVMClient evmClient = new ExactEVMClient(privateKey);
T402Client client = new T402Client(evmClient);

T402Response response = client.get(
    "https://iot.example.com/sensors/temp-01"
);

SensorReading reading = response.as(SensorReading.class);
System.out.printf("Temp: %.1f%s%n",
    reading.getValue(), reading.getUnit());`,
    },
  ],

  "streaming-media": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { createT402Fetch } from '@t402/fetch';
import { UptoEVMClient } from '@t402/evm/upto/client';

// Use 'upto' scheme for streaming (max budget authorization)
const client = new UptoEVMClient({ signer, maxAmount: "10000" });
const t402Fetch = createT402Fetch({ client });

// Stream with pay-per-segment (0.001 USDT per 10s)
const res = await t402Fetch("https://stream.example.com/live/channel-1");
const reader = res.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  processAudioChunk(value);
}`,
    },
    {
      label: "Go",
      language: "go",
      code: `// Use 'upto' scheme for streaming budget
client := evm.NewUptoClient(privateKey, "10000")
t402Client := http.NewClient(client)

resp, err := t402Client.Get(
    "https://stream.example.com/live/channel-1",
)
defer resp.Body.Close()

// Process streaming chunks
scanner := bufio.NewScanner(resp.Body)
for scanner.Scan() {
    processChunk(scanner.Bytes())
}`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402 import T402Client
from t402.mechanisms.evm import UptoEVMClient

# Budget-capped streaming payments
client = UptoEVMClient(private_key=key, max_amount="10000")
t402 = T402Client(client)

response = t402.get(
    "https://stream.example.com/live/channel-1",
    stream=True
)

for chunk in response.iter_content(chunk_size=1024):
    process_audio_chunk(chunk)`,
    },
    {
      label: "Java",
      language: "java",
      code: `// Budget-capped streaming payments
UptoEVMClient evmClient = new UptoEVMClient(privateKey, "10000");
T402Client client = new T402Client(evmClient);

T402Response response = client.get(
    "https://stream.example.com/live/channel-1"
);

try (InputStream stream = response.getBody()) {
    byte[] buffer = new byte[1024];
    int read;
    while ((read = stream.read(buffer)) != -1) {
        processChunk(buffer, read);
    }
}`,
    },
  ],

  "mcp-ai-agent": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { T402McpServer } from '@t402/mcp';
import { ExactEVMClient } from '@t402/evm/exact/client';

// MCP server with T402 payment-gated tools
const server = new T402McpServer({
  client: new ExactEVMClient({ signer }),
});

// Tools automatically handle 402 payment
const result = await server.callTool("get_weather", {
  city: "Tokyo",
});

// Agent paid 0.001 USDT for the tool call
console.log(result.temperature);`,
    },
    {
      label: "Go",
      language: "go",
      code: `import (
    "github.com/t402-io/t402/sdks/go/mcp"
    "github.com/t402-io/t402/sdks/go/mechanisms/evm"
)

client := evm.NewExactClient(privateKey)
mcpServer := mcp.NewT402Server(client)

// Paid tool call via MCP protocol
result, err := mcpServer.CallTool("get_weather", map[string]string{
    "city": "Tokyo",
})

fmt.Printf("Temp: %s\\n", result["temperature"])`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402.mcp import T402McpServer
from t402.mechanisms.evm import ExactEVMClient

client = ExactEVMClient(private_key=key)
server = T402McpServer(client)

# Tool call with automatic payment
result = await server.call_tool("get_weather", {
    "city": "Tokyo"
})

# Agent paid 0.001 USDT for this call
print(f"Temperature: {result['temperature']}")`,
    },
    {
      label: "Java",
      language: "java",
      code: `ExactEVMClient evmClient = new ExactEVMClient(privateKey);
T402McpServer server = new T402McpServer(evmClient);

// Payment-gated MCP tool call
Map<String, String> args = Map.of("city", "Tokyo");
ToolResult result = server.callTool("get_weather", args);

System.out.println("Temp: " + result.get("temperature"));`,
    },
  ],

  "cross-chain-bridge": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { T402Bridge } from '@t402/wdk-bridge';
import { ExactEVMClient } from '@t402/evm/exact/client';

const bridge = new T402Bridge({
  client: new ExactEVMClient({ signer }),
});

// Bridge USDT from Base to TON via LayerZero USDT0
const result = await bridge.transfer({
  sourceChain: "eip155:8453",
  targetChain: "ton:mainnet",
  amount: "1000000", // 1 USDT
});

console.log(\`Bridge tx: \${result.txHash}\`);
console.log(\`Status: \${result.status}\`);`,
    },
    {
      label: "Go",
      language: "go",
      code: `import (
    "github.com/t402-io/t402/sdks/go/mechanisms/evm"
    bridge "github.com/t402-io/t402/sdks/go/wdk/bridge"
)

client := evm.NewExactClient(privateKey)
b := bridge.New(client)

result, err := b.Transfer(ctx, bridge.TransferRequest{
    SourceChain: "eip155:8453",
    TargetChain: "ton:mainnet",
    Amount:      "1000000",
})

fmt.Printf("Bridge tx: %s\\n", result.TxHash)`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402.wdk.bridge import T402Bridge
from t402.mechanisms.evm import ExactEVMClient

client = ExactEVMClient(private_key=key)
bridge = T402Bridge(client)

# Cross-chain USDT transfer via LayerZero
result = await bridge.transfer(
    source_chain="eip155:8453",
    target_chain="ton:mainnet",
    amount="1000000",
)

print(f"Bridge tx: {result.tx_hash}")`,
    },
    {
      label: "Java",
      language: "java",
      code: `ExactEVMClient evmClient = new ExactEVMClient(privateKey);
T402Bridge bridge = new T402Bridge(evmClient);

TransferResult result = bridge.transfer(
    TransferRequest.builder()
        .sourceChain("eip155:8453")
        .targetChain("ton:mainnet")
        .amount("1000000")
        .build()
);

System.out.println("Bridge tx: " + result.getTxHash());`,
    },
  ],

  "gasless-payment": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { T402Gasless } from '@t402/wdk-gasless';
import { ExactEVMClient } from '@t402/evm/exact/client';

// ERC-4337 gasless payments — user doesn't need ETH
const gasless = new T402Gasless({
  client: new ExactEVMClient({ signer }),
  bundlerUrl: "https://bundler.example.com",
  paymasterUrl: "https://paymaster.example.com",
});

// Pay without holding any native gas token
const res = await gasless.fetch("https://api.example.com/premium", {
  method: "GET",
});

const data = await res.json();
console.log(data);`,
    },
    {
      label: "Go",
      language: "go",
      code: `import (
    "github.com/t402-io/t402/sdks/go/mechanisms/evm"
    gasless "github.com/t402-io/t402/sdks/go/wdk/gasless"
)

client := evm.NewExactClient(privateKey)
g := gasless.New(client, gasless.Config{
    BundlerURL:    "https://bundler.example.com",
    PaymasterURL:  "https://paymaster.example.com",
})

// ERC-4337 UserOp — no ETH needed
resp, err := g.Get("https://api.example.com/premium")

var data PremiumData
json.NewDecoder(resp.Body).Decode(&data)`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402.wdk.gasless import T402Gasless
from t402.mechanisms.evm import ExactEVMClient

client = ExactEVMClient(private_key=key)
gasless = T402Gasless(
    client,
    bundler_url="https://bundler.example.com",
    paymaster_url="https://paymaster.example.com",
)

# No ETH needed — paymaster sponsors gas
response = gasless.get("https://api.example.com/premium")
data = response.json()`,
    },
    {
      label: "Java",
      language: "java",
      code: `ExactEVMClient evmClient = new ExactEVMClient(privateKey);
T402Gasless gasless = T402Gasless.builder()
    .client(evmClient)
    .bundlerUrl("https://bundler.example.com")
    .paymasterUrl("https://paymaster.example.com")
    .build();

// ERC-4337 gasless payment
T402Response response = gasless.get(
    "https://api.example.com/premium"
);

PremiumData data = response.as(PremiumData.class);`,
    },
  ],

  "dex-swap": [
    {
      label: "TypeScript",
      language: "typescript",
      code: `import { T402Client } from '@t402/client';

const client = new T402Client({
  facilitatorUrl: 'https://facilitator.t402.io',
  signer: wallet,
});

// Pay 0.01 USDT and get a real-time swap quote
const res = await client.post('https://api.example.com/swap', {
  body: {
    srcToken: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',  // USDT
    destToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
    amount: '1000000000',  // 1000 USDT
    srcDecimals: 6,
    destDecimals: 18,
  },
});

const { quote } = await res.json();
console.log(quote.rate);           // "1 USDT = 0.000481 ETH"
console.log(quote.route);          // ["PancakeswapV3 (83%)", ...]`,
    },
    {
      label: "Python",
      language: "python",
      code: `from t402 import T402Client

client = T402Client(
    facilitator_url="https://facilitator.t402.io",
    signer=wallet,
)

# Pay 0.01 USDT and get a real-time swap quote
res = client.post("https://api.example.com/swap", json={
    "srcToken": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "destToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "amount": "1000000000",
    "srcDecimals": 6,
    "destDecimals": 18,
})

quote = res.json()["quote"]
print(quote["rate"])      # 1 USDT = 0.000481 ETH
print(quote["route"])     # ["PancakeswapV3 (83%)", ...]`,
    },
    {
      label: "Go",
      language: "go",
      code: `import t402 "github.com/t402-io/t402/sdks/go/http"

client := t402.NewClient(t402.Config{
    FacilitatorURL: "https://facilitator.t402.io",
    Signer:         signer,
})

body := map[string]any{
    "srcToken":    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "destToken":   "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "amount":      "1000000000",
    "srcDecimals": 6,
    "destDecimals": 18,
}

// Pay 0.01 USDT and get a real-time swap quote
resp, _ := client.Post("https://api.example.com/swap", body)
fmt.Println(resp.Quote.Rate)   // 1 USDT = 0.000481 ETH`,
    },
  ],
};

export function getExamplesForScenario(scenarioId: ScenarioId): SdkExample[] {
  return EXAMPLES[scenarioId] || [];
}

// Server-side examples for each scenario
const SERVER_EXAMPLES: Record<ScenarioId, SdkExample[]> = {
  "ai-api": [
    {
      label: "Express.js",
      language: "typescript",
      code: `import express from 'express';
import { t402 } from '@t402/express';

const app = express();

app.post('/v1/query', t402({
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '1000',        // 0.001 USDT
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  payTo: '0xYourAddress',
  facilitatorUrl: 'https://facilitator.t402.io',
}), (req, res) => {
  // This runs only after payment is verified
  const { prompt } = req.body;
  const answer = generateAIResponse(prompt);
  res.json({ response: answer, cost: "0.001 USDT" });
});`,
    },
    {
      label: "Hono",
      language: "typescript",
      code: `import { Hono } from 'hono';
import { t402 } from '@t402/hono';

const app = new Hono();

app.post('/v1/query', t402({
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '1000',
  asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  payTo: '0xYourAddress',
  facilitatorUrl: 'https://facilitator.t402.io',
}), (c) => {
  const { prompt } = await c.req.json();
  return c.json({ response: generateAIResponse(prompt) });
});`,
    },
    {
      label: "Go (Gin)",
      language: "go",
      code: `import (
    "github.com/gin-gonic/gin"
    t402http "github.com/t402-io/t402/sdks/go/http"
)

r := gin.Default()

r.POST("/v1/query", t402http.Middleware(t402http.Config{
    Scheme:         "exact",
    Network:        "eip155:8453",
    Amount:         "1000",
    Asset:          "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    PayTo:          "0xYourAddress",
    FacilitatorURL: "https://facilitator.t402.io",
}), func(c *gin.Context) {
    var req QueryRequest
    c.BindJSON(&req)
    c.JSON(200, gin.H{"response": generateResponse(req.Prompt)})
})`,
    },
  ],

  "content-paywall": [
    {
      label: "Next.js",
      language: "typescript",
      code: `import { withT402 } from '@t402/next';

export const GET = withT402({
  scheme: 'exact',
  network: 'eip155:8453',
  amount: '10000',       // 0.01 USDT
  payTo: '0xYourAddress',
}, async (req) => {
  const articleId = req.nextUrl.searchParams.get('id');
  const article = await getArticle(articleId);
  return Response.json(article);
});`,
    },
  ],

  "data-marketplace": [],
  "agent-to-agent": [],
  "iot-micropayments": [],
  "streaming-media": [],
  "mcp-ai-agent": [],
  "cross-chain-bridge": [],
  "gasless-payment": [],
  "dex-swap": [],
};

export function getServerExamplesForScenario(scenarioId: ScenarioId): SdkExample[] {
  return SERVER_EXAMPLES[scenarioId] || [];
}
