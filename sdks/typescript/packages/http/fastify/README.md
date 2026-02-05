# @t402/fastify

Fastify plugin integration for the t402 Payment Protocol. This package provides a simple middleware function for adding t402 payment requirements to your Fastify applications.

## Installation

```bash
npm install @t402/fastify
```

## Quick Start

```typescript
import Fastify from 'fastify'
import { paymentMiddleware, t402ResourceServer } from '@t402/fastify'
import { ExactEvmScheme } from '@t402/evm/exact/server'
import { HTTPFacilitatorClient } from '@t402/core/server'

const app = Fastify()

const facilitatorClient = new HTTPFacilitatorClient({ url: 'https://facilitator.t402.io' })
const resourceServer = new t402ResourceServer(facilitatorClient).register(
  'eip155:84532',
  new ExactEvmScheme(),
)

// Apply the payment middleware with your configuration
app.addHook(
  'onRequest',
  paymentMiddleware(
    {
      'GET /protected-route': {
        accepts: {
          scheme: 'exact',
          price: '$0.10',
          network: 'eip155:84532',
          payTo: '0xYourAddress',
        },
        description: 'Access to premium content',
      },
    },
    resourceServer,
  ),
)

// Implement your protected route
app.get('/protected-route', async (request, reply) => {
  return { message: 'This content is behind a paywall' }
})

app.listen({ port: 3000 })
```

## Configuration

The `paymentMiddleware` function accepts the following parameters:

```typescript
paymentMiddleware(
  routes: RoutesConfig,
  server: t402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean
)
```

### Parameters

1. **`routes`** (required): Route configurations for protected endpoints
2. **`server`** (required): Pre-configured t402ResourceServer instance
3. **`paywallConfig`** (optional): Configuration for the built-in paywall UI
4. **`paywall`** (optional): Custom paywall provider
5. **`syncFacilitatorOnStart`** (optional): Whether to sync with facilitator on startup (defaults to true)

## Route Configuration

```typescript
const routes: RoutesConfig = {
  'GET /api/protected': {
    accepts: {
      scheme: 'exact',
      price: '$0.10',
      network: 'eip155:84532',
      payTo: '0xYourAddress',
      maxTimeoutSeconds: 60,
    },
    description: 'Premium API access',
  },
}
```

## Multiple Payment Networks

```typescript
app.addHook(
  'onRequest',
  paymentMiddleware(
    {
      'GET /api/data': {
        accepts: [
          {
            scheme: 'exact',
            price: '$0.10',
            network: 'eip155:8453',
            payTo: evmAddress,
          },
          {
            scheme: 'exact',
            price: '$0.10',
            network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
            payTo: svmAddress,
          },
        ],
        description: 'Data API access',
      },
    },
    new t402ResourceServer(facilitatorClient)
      .register('eip155:8453', new ExactEvmScheme())
      .register('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', new ExactSvmScheme()),
  ),
)
```

## Paywall Configuration

The middleware automatically displays a paywall UI when browsers request protected endpoints.

Install the optional `@t402/paywall` package for a complete wallet connection and payment UI:

```bash
pnpm add @t402/paywall
```

```typescript
const paywallConfig: PaywallConfig = {
  appName: 'Your App Name',
  appLogo: '/path/to/logo.svg',
  testnet: true,
}

app.addHook('onRequest', paymentMiddleware(routes, resourceServer, paywallConfig))
```

## Peer Dependencies

- `fastify` ^4.0.0 || ^5.0.0

## Development

```bash
pnpm build    # Build the package
pnpm test     # Run unit tests
```

## Related Packages

- `@t402/core` - Core protocol types and client
- `@t402/express` - Express.js middleware
- `@t402/hono` - Hono middleware
- `@t402/paywall` - Universal paywall UI component
