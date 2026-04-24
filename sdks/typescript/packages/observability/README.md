# @t402/observability

Payment observability, analytics, and metrics for the t402 payment protocol. Collect events, trace end-to-end payment flows, and export Prometheus metrics.

## Installation

```bash
pnpm install @t402/observability
```

## Overview

Three building blocks:

- **`PaymentEventCollector`** — ring-buffer event sink with filtering and aggregation
- **`PaymentTracer`** — correlates events into end-to-end `PaymentFlow` spans
- **`withObservability` middleware** — wraps a t402 client so every client call emits events

Plus a Prometheus exporter for scraping aggregated metrics.

## Quick Start

### Wrap a client

```typescript
import { t402Client } from "@t402/core/client";
import { withObservability, PaymentEventCollector } from "@t402/observability";

const collector = new PaymentEventCollector();
const client = withObservability(new t402Client(), { collector });

// every .createPaymentPayload / .verifyPaymentHeader call now emits events
```

### Export metrics

```typescript
import { toPrometheusMetrics } from "@t402/observability";

app.get("/metrics", (_req, res) => {
  res.type("text/plain").send(toPrometheusMetrics(collector.metrics()));
});
```

### Trace a flow

```typescript
import { PaymentTracer } from "@t402/observability";

const tracer = new PaymentTracer(collector);
const flow: PaymentFlow = tracer.flowFor(paymentId);
// → { paymentId, startedAt, events, settled, failed, durationMs }
```

## Event Types

`PaymentEventType` covers the full lifecycle: `requirements_built`, `payload_signed`, `payload_sent`, `verifying`, `verified`, `settling`, `settled`, `failed`, `rejected`.

Each `PaymentEvent` carries `paymentId`, `network`, `scheme`, `timestamp`, and scheme-specific metadata.

## API

- `PaymentEventCollector` — `.record(event)`, `.events(filter?)`, `.metrics()`, `.clear()`
- `PaymentTracer` — `.flowFor(paymentId)`, `.recentFlows(limit)`
- `withObservability(client, { collector })` — returns `ObservableClient`
- `toPrometheusMetrics(metrics)` — returns Prometheus text exposition

## Development

```bash
pnpm build
pnpm test
```

## License

Apache-2.0
