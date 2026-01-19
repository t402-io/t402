# @t402/agent-policy

AI Agent Payment Policy Engine for T402. Enables fine-grained control over autonomous AI agent payment authorizations with spending limits, time-based rules, merchant restrictions, and network policies.

## Features

- **Spending Limits**: Per-transaction, hourly, daily, weekly, and monthly limits
- **Time Rules**: Allowed time windows and blocked periods
- **Merchant Rules**: Whitelist/blacklist recipient addresses
- **Network Rules**: Restrict payments to specific blockchain networks
- **Category Rules**: Classify and restrict payments by category
- **Approval Workflow**: Threshold-based multi-approver payment approvals
- **Webhook Notifications**: HTTP webhooks for approval workflow events
- **Budget Tracking**: Real-time spending tracking with reservation system
- **MCP Integration**: Full Model Context Protocol support for AI agents
- **Demo Mode**: Test without making actual state changes

## Installation

```bash
npm install @t402/agent-policy
```

## Quick Start

### As MCP Server (CLI)

Run the MCP server for Claude Desktop or other MCP clients:

```bash
# With demo mode
AGENT_POLICY_DEMO_MODE=true node bin/agent-policy-mcp.js

# With Redis storage
AGENT_POLICY_REDIS_URL=redis://localhost:6379 node bin/agent-policy-mcp.js
```

### Claude Desktop Configuration

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-policy": {
      "command": "node",
      "args": ["/path/to/agent-policy/bin/agent-policy-mcp.js"],
      "env": {
        "AGENT_POLICY_DEMO_MODE": "true"
      }
    }
  }
}
```

### Programmatic Usage

```typescript
import { AgentPolicyMcpServer } from '@t402/agent-policy/mcp';

// Create server with in-memory storage
const server = new AgentPolicyMcpServer({ demoMode: true });
```

### With Redis Storage

```typescript
import { createServerWithRedis } from '@t402/agent-policy/mcp';

// Create server with Redis-backed persistent storage
const server = await createServerWithRedis('redis://localhost:6379', {
  keyPrefix: 'my-app:agent-policy:',  // Custom key prefix
  ttl: 86400,                          // Optional: Policy TTL in seconds
  demoMode: false,
});

// With webhook notifications
const serverWithWebhooks = await createServerWithRedis('redis://localhost:6379', {
  keyPrefix: 'my-app:agent-policy:',
  webhookEndpoints: [
    {
      url: 'https://api.example.com/webhooks/approvals',
      secret: 'your-hmac-secret',
      events: ['approval.created', 'approval.approved', 'approval.denied'],
    },
  ],
  webhookBlocking: false, // Fire and forget (default)
});
```

Or use the RedisPolicyStore directly:

```typescript
import Redis from 'ioredis';
import { AgentPolicyMcpServer, RedisPolicyStore } from '@t402/agent-policy/mcp';
import { RedisLimitStore } from '@t402/agent-policy/limits';

const redis = new Redis('redis://localhost:6379');

const policyStore = new RedisPolicyStore({
  redis,
  keyPrefix: 'my-prefix:',
  ttl: 3600, // Optional TTL
});

const limitStore = new RedisLimitStore(redis);

const server = new AgentPolicyMcpServer(
  { demoMode: false },
  { policyStore, limitStore }
);

// Set a policy for an agent
await server.handleToolCall('agent-policy/set', {
  agentId: 'agent-123',
  policy: {
    limits: {
      perTransaction: { value: '100000000', decimals: 6, symbol: 'USDT' },
      daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },
    },
    networkRules: {
      allowedNetworks: ['eip155:8453', 'eip155:1'],
    },
    enabled: true,
  },
});

// Check if a payment is authorized
const result = await server.handleToolCall('agent-policy/authorize', {
  agentId: 'agent-123',
  amount: '50000000', // 50 USDT
  recipient: '0x1234...',
  network: 'eip155:8453',
});

console.log(result.content[0].text);
// ## Payment Authorization Result
// **Status:** ✅ Authorized
// **Reservation ID:** `abc-123-def`
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_POLICY_DEMO_MODE` | Enable demo mode (no state changes) | `false` |
| `AGENT_POLICY_REDIS_URL` | Redis URL for persistent storage | In-memory |
| `AGENT_POLICY_ORG_ID` | Default organization ID | None |
| `AGENT_POLICY_WEBHOOK_URL` | Webhook endpoint URL | None |
| `AGENT_POLICY_WEBHOOK_SECRET` | HMAC secret for webhook signatures | None |
| `AGENT_POLICY_WEBHOOK_EVENTS` | Comma-separated event types | All events |
| `AGENT_POLICY_WEBHOOK_TIMEOUT` | Webhook request timeout (ms) | 10000 |
| `AGENT_POLICY_WEBHOOK_RETRIES` | Number of retry attempts | 3 |
| `AGENT_POLICY_WEBHOOK_BLOCKING` | Wait for webhooks to complete | `false` |
| `AGENT_POLICY_WEBHOOKS` | JSON array of webhook endpoints (advanced) | None |

### Webhook Configuration Examples

**Simple (single endpoint):**

```bash
AGENT_POLICY_WEBHOOK_URL=https://api.example.com/webhooks/approvals
AGENT_POLICY_WEBHOOK_SECRET=my-secret-key
AGENT_POLICY_WEBHOOK_EVENTS=approval.created,approval.approved,approval.denied
```

**Advanced (multiple endpoints via JSON):**

```bash
AGENT_POLICY_WEBHOOKS='[{"url":"https://api.example.com/webhook","secret":"secret1"},{"url":"https://slack.example.com/notify","events":["approval.created"]}]'
```

## MCP Tools

### agent-policy/authorize

Check if a payment is authorized according to the agent's policy.

**Input:**
```json
{
  "agentId": "agent-123",
  "amount": "100000000",
  "decimals": 6,
  "symbol": "USDT",
  "recipient": "0x1234...",
  "network": "eip155:8453",
  "memo": "Payment for API usage"
}
```

**Output:** Authorization decision with reservation ID if approved.

### agent-policy/budget

Get remaining budget for an agent in a specific period.

**Input:**
```json
{
  "agentId": "agent-123",
  "period": "daily"
}
```

**Output:** Budget status with limit, spent, and remaining amounts.

### agent-policy/get

Get the current policy configuration for an agent.

**Input:**
```json
{
  "agentId": "agent-123"
}
```

**Output:** Full policy configuration.

### agent-policy/set

Set or update the policy configuration for an agent.

**Input:**
```json
{
  "agentId": "agent-123",
  "policy": {
    "limits": {
      "perTransaction": { "value": "100000000" },
      "daily": { "value": "1000000000" }
    },
    "timeRules": {
      "allowedWindows": [
        { "days": [1, 2, 3, 4, 5], "startHour": 9, "endHour": 17 }
      ]
    },
    "merchantRules": {
      "whitelist": ["0xaddr1", "0xaddr2"],
      "requireWhitelist": true
    },
    "networkRules": {
      "allowedNetworks": ["eip155:8453"]
    },
    "enabled": true
  }
}
```

### agent-policy/list

List all policies, optionally filtered by organization ID.

**Input:**
```json
{
  "orgId": "org-123"
}
```

### agent-policy/confirm

Confirm a payment reservation after successful payment execution.

**Input:**
```json
{
  "reservationId": "abc-123-def"
}
```

### agent-policy/release

Release a payment reservation (cancel/rollback). Returns budget to available.

**Input:**
```json
{
  "reservationId": "abc-123-def"
}
```

### agent-policy/approvals/list

List pending payment approvals, optionally filtered by agent.

**Input:**
```json
{
  "agentId": "agent-123"
}
```

**Output:** List of pending approvals with details.

### agent-policy/approvals/get

Get details of a specific pending approval.

**Input:**
```json
{
  "approvalId": "approval-uuid-here"
}
```

**Output:** Full approval details including request, approvers, and current decisions.

### agent-policy/approvals/decide

Submit an approval decision (approve or deny) for a pending payment.

**Input:**
```json
{
  "approvalId": "approval-uuid-here",
  "decision": "approve",
  "approver": "admin@example.com",
  "comment": "Approved for Q1 budget"
}
```

**Output:** Approval result with updated status.

## Policy Configuration

### Spending Limits

Control how much an agent can spend:

```typescript
{
  limits: {
    perTransaction: { value: '100000000', decimals: 6, symbol: 'USDT' }, // 100 USDT max per tx
    hourly: { value: '500000000', decimals: 6, symbol: 'USDT' },         // 500 USDT/hour
    daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },         // 1000 USDT/day
    weekly: { value: '5000000000', decimals: 6, symbol: 'USDT' },        // 5000 USDT/week
    monthly: { value: '10000000000', decimals: 6, symbol: 'USDT' },      // 10000 USDT/month
  }
}
```

### Time Rules

Restrict when payments can be made:

```typescript
{
  timeRules: {
    // Allow payments Mon-Fri 9AM-5PM UTC
    allowedWindows: [
      { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 }
    ],
    // Block payments during maintenance
    blockedPeriods: [
      {
        start: new Date('2026-01-20T00:00:00Z'),
        end: new Date('2026-01-21T00:00:00Z'),
        reason: 'Scheduled maintenance'
      }
    ],
    timezone: 'UTC'
  }
}
```

### Merchant Rules

Control which addresses can receive payments:

```typescript
{
  merchantRules: {
    // Only allow payments to these addresses
    whitelist: ['0xaddr1', '0xaddr2', '0xaddr3'],
    requireWhitelist: true,
    // Never allow payments to these addresses
    blacklist: ['0xbadaddr1']
  }
}
```

### Network Rules

Restrict which blockchain networks can be used:

```typescript
{
  networkRules: {
    // Only allow Base and Ethereum mainnet
    allowedNetworks: ['eip155:8453', 'eip155:1'],
    // Block specific networks
    blockedNetworks: ['eip155:56'] // No BSC
  }
}
```

### Category Rules

Classify and restrict payments by category:

```typescript
{
  categoryRules: {
    // Only allow these categories
    allowedCategories: ['api_usage', 'subscription', 'data_storage'],
    // Block these categories
    blockedCategories: ['gambling', 'adult_content']
  }
}
```

### Approval Workflow

Require human approval for high-value payments:

```typescript
{
  approvalConfig: {
    thresholds: [
      {
        // Payments >= 100 USDT require 1 approver
        amount: { value: '100000000', decimals: 6, symbol: 'USDT' },
        requiredApprovers: 1,
        approvers: ['admin@example.com', 'manager@example.com']
      },
      {
        // Payments >= 1000 USDT require 2 approvers
        amount: { value: '1000000000', decimals: 6, symbol: 'USDT' },
        requiredApprovers: 2,
        approvers: ['admin@example.com', 'manager@example.com', 'cfo@example.com']
      }
    ],
    timeout: 3600000 // 1 hour timeout for approvals
  }
}
```

**Approval Flow:**
1. Agent requests payment authorization
2. If amount exceeds threshold, a pending approval is created
3. Authorized approvers are notified
4. Approvers submit decisions via `agent-policy/approvals/decide`
5. Once enough approvals are collected, payment proceeds
6. If any approver denies, payment is rejected immediately
7. If timeout expires, approval is marked as expired

**Key Features:**
- Multiple approval thresholds based on payment amount
- Configurable number of required approvers per threshold
- Budget is reserved during approval process
- Approvals expire after configurable timeout
- Case-insensitive approver matching
- Supports both Redis and in-memory storage

### Webhook Notifications

Get notified of approval workflow events via HTTP webhooks:

```typescript
import { ApprovalManager, InMemoryApprovalStore, WebhookNotifier } from '@t402/agent-policy/mcp';

const webhooks = new WebhookNotifier({
  endpoints: [
    {
      url: 'https://api.yourservice.com/webhooks/approvals',
      // Optional: filter events (empty = all events)
      events: ['approval.created', 'approval.approved', 'approval.denied'],
      // Optional: HMAC secret for signature verification
      secret: 'your-webhook-secret',
      // Optional: custom headers
      headers: {
        'Authorization': 'Bearer your-token',
      },
      // Optional: timeout in ms (default: 10000)
      timeout: 5000,
      // Optional: retry attempts (default: 3)
      retries: 3,
    },
    // You can configure multiple endpoints
    {
      url: 'https://slack-integration.example.com/notify',
      events: ['approval.created'], // Only notify on new approvals
    },
  ],
  // Wait for webhooks to complete (default: false = fire and forget)
  blocking: false,
});

const approvalManager = new ApprovalManager({
  store: new InMemoryApprovalStore(),
  webhooks,
});
```

**Webhook Events:**

| Event | Description |
|-------|-------------|
| `approval.created` | New approval request created |
| `approval.decision_submitted` | Approver submitted decision (still pending more approvals) |
| `approval.approved` | Payment approved (all required approvals received) |
| `approval.denied` | Payment denied by an approver |
| `approval.expired` | Approval timed out |
| `approval.cancelled` | Approval was cancelled |

**Webhook Payload:**

```json
{
  "event": "approval.created",
  "timestamp": "2026-01-19T10:30:00.000Z",
  "approval": {
    "id": "approval-uuid",
    "agentId": "agent-123",
    "status": "pending",
    "amount": "500 USDT",
    "amountRaw": { "value": "500000000", "decimals": 6, "symbol": "USDT" },
    "recipient": "0x1234...",
    "network": "eip155:8453",
    "category": "api_usage",
    "memo": "Monthly subscription",
    "requiredApprovers": 1,
    "currentApprovalCount": 0,
    "approvers": ["admin@example.com", "finance@example.com"],
    "createdAt": "2026-01-19T10:30:00.000Z",
    "expiresAt": "2026-01-19T11:30:00.000Z",
    "reservationId": "res-uuid"
  },
  "decision": {
    "approver": "admin@example.com",
    "decision": "approve",
    "comment": "Approved for Q1 budget",
    "timestamp": "2026-01-19T10:35:00.000Z"
  },
  "result": {
    "approved": true,
    "reason": null
  }
}
```

**Security:**

When a `secret` is configured, webhooks include an HMAC-SHA256 signature in the `X-Webhook-Signature` header:

```
X-Webhook-Signature: sha256=<hex-encoded-hmac>
```

Verify the signature in your webhook handler:

```typescript
import { createHmac } from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === expected;
}
```

**Headers:**

All webhook requests include:
- `Content-Type: application/json`
- `X-Webhook-Event: <event-type>`
- `X-Webhook-Timestamp: <ISO-8601-timestamp>`
- `X-Webhook-Signature: sha256=<hmac>` (if secret configured)
- Any custom headers from endpoint configuration

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Client (Claude)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ stdio
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AgentPolicyMcpServer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Tool Handler │  │ SimplPolicy  │  │    SpendingLimiter   │  │
│  │              │──│   Engine     │──│                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                 │                      │              │
│         │                 │          ┌──────────────────────┐  │
│         │                 └─────────│   ApprovalManager    │  │
│         │                            └──────────┬───────────┘  │
│         │                                       │              │
│         │                            ┌──────────▼───────────┐  │
│         │                            │  WebhookNotifier     │──┼──► External Webhooks
│         │                            └──────────────────────┘  │
│         ▼                 ▼                      ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ PolicyStore  │  │ RuleEvaluator│  │  LimitStore/Approval │  │
│  │ (In-Memory)  │  │              │  │  (In-Memory / Redis) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Payment Authorization Flow

```
1. Agent requests payment authorization
   └─► agent-policy/authorize

2. Policy Engine evaluates:
   ├─► Time Rules (is it an allowed time?)
   ├─► Merchant Rules (is recipient allowed?)
   ├─► Network Rules (is network allowed?)
   ├─► Category Rules (is category allowed?)
   ├─► Spending Limits (is there budget?)
   └─► Approval Thresholds (does amount require approval?)

3a. If approved (no approval needed):
    ├─► Budget is reserved
    ├─► Reservation ID returned
    └─► Agent executes payment

3b. If approval required:
    ├─► Budget is reserved
    ├─► Pending approval created
    ├─► Approval ID returned to agent
    └─► Workflow continues in step 4b

4a. After direct payment execution:
    ├─► Success: agent-policy/confirm (budget permanently deducted)
    └─► Failure: agent-policy/release (budget returned)

4b. Approval workflow:
    ├─► List pending: agent-policy/approvals/list
    ├─► View details: agent-policy/approvals/get
    └─► Submit decision: agent-policy/approvals/decide
        ├─► If approved (enough approvers): proceed to payment
        ├─► If denied: budget released, payment rejected
        └─► If timeout: approval expires, budget released

5. Webhook notifications (if configured):
   ├─► approval.created - when approval is created
   ├─► approval.decision_submitted - when approver submits (still pending)
   ├─► approval.approved - when payment is approved
   ├─► approval.denied - when payment is denied
   ├─► approval.expired - when approval times out
   └─► approval.cancelled - when approval is cancelled
```

## Direct API Usage

For advanced use cases, you can use the components directly:

```typescript
import { SimplePolicyEngine } from '@t402/agent-policy/mcp';
import { SpendingLimiter } from '@t402/agent-policy/limits';
import { RuleEvaluator } from '@t402/agent-policy/rules';

// Create components
const limitStore = new InMemoryLimitStore();
const spendingLimiter = new SpendingLimiter({ store: limitStore });
const policyEngine = new SimplePolicyEngine({ spendingLimiter });

// Define a policy
const policy = {
  enabled: true,
  limits: {
    daily: { value: '1000000000', decimals: 6, symbol: 'USDT' },
  },
  networkRules: {
    allowedNetworks: ['eip155:8453'],
  },
};

// Authorize a payment
const decision = await policyEngine.authorize(
  {
    agentId: 'agent-123',
    amount: { value: '50000000', decimals: 6, symbol: 'USDT' },
    recipient: '0x1234...',
    network: 'eip155:8453',
  },
  policy
);

if (decision.allowed) {
  console.log('Payment authorized:', decision.reservationId);
} else {
  console.log('Payment denied:', decision.reason);
}
```

## Approval Workflow Example

Complete example showing the approval workflow from policy setup to payment execution:

```typescript
import { AgentPolicyMcpServer } from '@t402/agent-policy/mcp';

// Create server (use createServerWithRedis for production)
const server = new AgentPolicyMcpServer();

// 1. Set up a policy with approval thresholds
await server.handleToolCall('agent-policy/set', {
  agentId: 'agent-123',
  policy: {
    enabled: true,
    limits: {
      daily: { value: '10000000000', decimals: 6 }, // 10,000 USDT/day
    },
    approvalConfig: {
      thresholds: [
        {
          amount: { value: '100000000', decimals: 6 }, // >= 100 USDT
          requiredApprovers: 1,
          approvers: ['admin@company.com', 'finance@company.com'],
        },
        {
          amount: { value: '1000000000', decimals: 6 }, // >= 1000 USDT
          requiredApprovers: 2,
          approvers: ['admin@company.com', 'finance@company.com', 'cfo@company.com'],
        },
      ],
      timeout: 3600000, // 1 hour
    },
  },
});

// 2. Agent requests a high-value payment (500 USDT - needs 1 approver)
const authResult = await server.handleToolCall('agent-policy/authorize', {
  agentId: 'agent-123',
  amount: '500000000', // 500 USDT
  recipient: '0xvendor...',
  network: 'eip155:8453',
  category: 'api_usage',
  memo: 'Monthly API subscription',
});

// Response indicates approval is required
// {
//   allowed: false,
//   requiresApproval: true,
//   approvalId: 'approval-uuid-here',
//   reservationId: 'res-uuid-here',
//   reason: 'Payment requires approval (1 approver(s) needed)'
// }

// 3. List pending approvals (e.g., in admin dashboard)
const pendingResult = await server.handleToolCall('agent-policy/approvals/list', {
  agentId: 'agent-123',
});
// Shows all pending approvals for the agent

// 4. Get approval details
const approvalId = 'approval-uuid-here'; // From step 2
const detailsResult = await server.handleToolCall('agent-policy/approvals/get', {
  approvalId,
});
// Shows full details including amount, recipient, approvers list

// 5. Approver submits decision
const decisionResult = await server.handleToolCall('agent-policy/approvals/decide', {
  approvalId,
  decision: 'approve',
  approver: 'admin@company.com',
  comment: 'Approved - within monthly budget',
});

// If approved:
// {
//   approved: true,
//   status: 'approved',
//   reservationId: 'res-uuid-here'
// }

// 6. After payment execution, confirm or release
await server.handleToolCall('agent-policy/confirm', {
  reservationId: 'res-uuid-here',
});
```

### Multi-Approver Example

For high-value payments requiring multiple approvers:

```typescript
// Request 2000 USDT payment (needs 2 approvers based on policy above)
const authResult = await server.handleToolCall('agent-policy/authorize', {
  agentId: 'agent-123',
  amount: '2000000000', // 2000 USDT
  recipient: '0xvendor...',
  network: 'eip155:8453',
});

const approvalId = authResult.data.approvalId;

// First approver
const result1 = await server.handleToolCall('agent-policy/approvals/decide', {
  approvalId,
  decision: 'approve',
  approver: 'admin@company.com',
});
// { approved: false, status: 'pending', reason: 'Waiting for 1 more approval(s)' }

// Second approver
const result2 = await server.handleToolCall('agent-policy/approvals/decide', {
  approvalId,
  decision: 'approve',
  approver: 'cfo@company.com',
});
// { approved: true, status: 'approved', reservationId: '...' }

// Payment can now proceed
```

### Denial Example

```typescript
// Any approver can deny, which immediately rejects the payment
const denyResult = await server.handleToolCall('agent-policy/approvals/decide', {
  approvalId,
  decision: 'deny',
  approver: 'finance@company.com',
  comment: 'Exceeds department budget for this quarter',
});
// { approved: false, status: 'denied', reason: 'Exceeds department budget...' }

// Budget reservation is automatically released
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Build
npm run build
```

## Package Exports

| Export Path | Description |
|-------------|-------------|
| `@t402/agent-policy` | Core types and schemas |
| `@t402/agent-policy/mcp` | MCP server and tools |
| `@t402/agent-policy/policy` | Policy engine and resolver |
| `@t402/agent-policy/limits` | Spending limiter |
| `@t402/agent-policy/rules` | Rule evaluator |

## License

Private - T402 Internal Use Only
