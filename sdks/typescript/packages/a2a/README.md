# @t402/a2a

A2A (Agent-to-Agent) transport implementation for the t402 payment protocol. Enables AI agents to monetize their services through on-chain cryptocurrency payments using the A2A protocol.

## Installation

```bash
npm install @t402/a2a
# or
pnpm add @t402/a2a
```

## Overview

This package provides tools for implementing t402 payments over the A2A (Agent-to-Agent) protocol:

- **A2APaymentClient**: Client-side payment handling for AI agents requesting services
- **A2APaymentServer**: Server-side payment processing for AI agents providing services
- **Type definitions**: Complete TypeScript types for A2A payment flows
- **Helper functions**: Utilities for creating and parsing payment messages

## Usage

### Client-Side (Requesting Services)

```typescript
import { A2APaymentClient } from "@t402/a2a";
import { ExactEVMClient } from "@t402/evm/exact/client";

// Create a payment client
const paymentClient = new A2APaymentClient({
  onPaymentRequired: (requirements) =>
    console.log("Payment required:", requirements),
  onPaymentSubmitted: (payload) =>
    console.log("Payment submitted:", payload),
});

// Create your mechanism client (e.g., EVM)
const mechanism = new ExactEVMClient({ signer: yourSigner });

// Handle payment flow
async function handleTask(task: A2ATask) {
  // Check if payment is required
  if (paymentClient.requiresPayment(task)) {
    // Get requirements and create payment
    const requirements = paymentClient.getRequirements(task);
    const payload = await paymentClient.createPayload(mechanism, requirements!);

    // Create message with payment
    const message = paymentClient.createPaymentMessage(payload);

    // Send message via A2A protocol
    return message;
  }
}

// Or use the convenience method
const paymentMessage = await paymentClient.handlePayment(task, mechanism);
```

### Server-Side (Providing Services)

```typescript
import { A2APaymentServer } from "@t402/a2a";
import { HTTPFacilitatorClient } from "@t402/core/server";

// Create a payment server
const paymentServer = new A2APaymentServer({
  facilitator: new HTTPFacilitatorClient(),
  defaultRequirements: {
    resource: { url: "agent://my-agent/skill" },
  },
  onPaymentReceived: (payload) => console.log("Payment received:", payload),
  onPaymentSettled: (receipts) => console.log("Payment settled:", receipts),
});

// Create payment-required task for a new request
function createPaymentTask(taskId: string): A2ATask {
  const requirements = paymentServer.createRequirements({
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: "1000000", // 1 USDC
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        payTo: "0xYourAddress",
        maxTimeoutSeconds: 3600,
        extra: {},
      },
    ],
  });

  return paymentServer.createPaymentRequiredTask(taskId, requirements);
}

// Process payment when received
async function processPayment(
  task: A2ATask,
  message: A2AMessage,
  requirements: PaymentRequired,
): Promise<A2ATask> {
  const result = await paymentServer.processPayment(message, requirements);

  if (result.success) {
    // Payment successful, continue with task execution
    return {
      ...task,
      status: {
        state: "working",
        message: { kind: "message", role: "agent", parts: [{ kind: "text", text: "Processing..." }] },
      },
    };
  }

  // Payment failed
  return paymentServer.updateTaskWithPaymentResult(task, result);
}
```

## API Reference

### A2APaymentClient

Client for handling payments in A2A client agents.

| Method | Description |
|--------|-------------|
| `requiresPayment(task)` | Check if a task requires payment |
| `getRequirements(task)` | Extract payment requirements from a task |
| `selectPaymentOption(requirements, network?, scheme?)` | Select the best payment option |
| `createPayload(mechanism, requirements)` | Create a signed payment payload |
| `createPaymentMessage(payload, text?)` | Create an A2A message with payment |
| `handlePayment(task, mechanism, network?, scheme?)` | Handle complete payment flow |

### A2APaymentServer

Server for processing payments in A2A server agents.

| Method | Description |
|--------|-------------|
| `createRequirements(requirements)` | Create requirements with defaults |
| `createPaymentRequiredTask(taskId, requirements, text?)` | Create a payment-required task |
| `extractPaymentPayload(message)` | Extract payment from a message |
| `hasPaymentPayload(message)` | Check if message contains payment |
| `processPayment(message, requirements)` | Process a payment submission |
| `handlePayment(task, message, requirements)` | Handle payment and update task |
| `updateTaskWithPaymentResult(task, result)` | Update task with payment result |

### Re-exported Types

All A2A types from `@t402/core/types` are re-exported:

- `A2ATask`, `A2AMessage`, `A2ATaskStatus`
- `A2APaymentStatus`, `A2APaymentMetadata`
- `A2AAgentCard`, `A2ASkill`, `A2ACapabilities`
- `isPaymentRequired()`, `isPaymentCompleted()`, `isPaymentFailed()`
- `createPaymentRequiredMessage()`, `createPaymentSubmissionMessage()`
- `createPaymentCompletedMessage()`, `createPaymentFailedMessage()`
- `T402_A2A_EXTENSION_URI`, `A2A_EXTENSIONS_HEADER`

## A2A Extension

When advertising t402 payment support in your agent card:

```typescript
import { createT402Extension } from "@t402/a2a";

const agentCard: A2AAgentCard = {
  name: "My AI Agent",
  url: "https://my-agent.example.com",
  capabilities: {
    extensions: [
      createT402Extension(true), // required = true
    ],
  },
  // ...
};
```

## License

Apache-2.0
