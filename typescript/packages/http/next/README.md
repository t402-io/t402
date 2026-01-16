# @t402/next

Next.js integration for the t402 Payment Protocol. This package allows you to easily add paywall functionality to your Next.js applications using the t402 protocol.

## Installation

```bash
pnpm install @t402/next
```

## Quick Start

### Protecting Page Routes

Page routes are protected using the `paymentProxy`. Create a proxy (middleware) file in your Next.js project (`proxy.ts`):

```typescript
import { paymentProxy, t402ResourceServer } from "@t402/next";
import { HTTPFacilitatorClient } from "@t402/core/server";
import { ExactEvmScheme } from "@t402/evm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({ url: "https://facilitator.t402.io" });
const resourceServer = new t402ResourceServer(facilitatorClient)
  .register("eip155:84532", new ExactEvmScheme());

export const proxy = paymentProxy(
  {
    "/protected": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:84532",
        payTo: "0xYourAddress",
      },
      description: "Access to protected content",
    },
  },
  resourceServer,
);

// Configure which paths the middleware should run on
export const config = {
  matcher: ["/protected/:path*"],
};
```

### Protecting API Routes

API routes are protected using the `withX402` route wrapper. This is the recommended approach to protect API routes as it guarantees payment settlement only AFTER successful API responses (status < 400). API routes can also be protected by `paymentProxy`, however this will charge clients for failed API responses:

```typescript
// app/api/your-endpoint/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@t402/next";

const handler = async (_: NextRequest) => {
  return NextResponse.json({ data: "your response" });
};

export const GET = withX402(
  handler,
  {
    accepts: {
      scheme: "exact",
      price: "$0.01",
      network: "eip155:84532",
      payTo: "0xYourAddress",
    },
    description: "Access to API endpoint",
  },
  server, // your configured t402ResourceServer
);
```

## Configuration

### paymentProxy

The `paymentProxy` function is used to protect page routes. It can also protect API routes, however this will charge clients for failed API responses.

```typescript
paymentProxy(
  routes: RoutesConfig,
  server: t402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean
)
```

#### Parameters

1. **`routes`** (required): Route configurations for protected endpoints
2. **`server`** (required): Pre-configured t402ResourceServer instance
3. **`paywallConfig`** (optional): Configuration for the built-in paywall UI
4. **`paywall`** (optional): Custom paywall provider
5. **`syncFacilitatorOnStart`** (optional): Whether to sync with facilitator on startup (defaults to true)

### withX402

The `withX402` function wraps API route handlers. This is the recommended approach to protect API routes as it guarantees payment settlement only AFTER successful API responses (status < 400).

```typescript
withX402(
  routeHandler: (request: NextRequest) => Promise<NextResponse>,
  routeConfig: RouteConfig,
  server: t402ResourceServer,
  paywallConfig?: PaywallConfig,
  paywall?: PaywallProvider,
  syncFacilitatorOnStart?: boolean
)
```

#### Parameters

1. **`routeHandler`** (required): Your API route handler function
2. **`routeConfig`** (required): Payment configuration for this specific route
3. **`server`** (required): Pre-configured t402ResourceServer instance
4. **`paywallConfig`** (optional): Configuration for the built-in paywall UI
5. **`paywall`** (optional): Custom paywall provider
6. **`syncFacilitatorOnStart`** (optional): Whether to sync with facilitator on startup (defaults to true)

## API Reference

### NextAdapter

The `NextAdapter` class implements the `HTTPAdapter` interface from `@t402/core`, providing Next.js-specific request handling:

```typescript
class NextAdapter implements HTTPAdapter {
  getHeader(name: string): string | undefined;
  getMethod(): string;
  getPath(): string;
  getUrl(): string;
  getAcceptHeader(): string;
  getUserAgent(): string;
}
```

### Route Configuration

```typescript
const routes: RoutesConfig = {
  "/api/protected": {
    accepts: {
      scheme: "exact",
      price: "$0.10",
      network: "eip155:84532",
      payTo: "0xYourAddress",
      maxTimeoutSeconds: 60,
    },
    description: "Premium API access",
  },
};
```

## Advanced Usage

### Multiple Payment Networks

```typescript
import { paymentProxy, t402ResourceServer } from "@t402/next";
import { HTTPFacilitatorClient } from "@t402/core/server";
import { registerExactEvmScheme } from "@t402/evm/exact/server";
import { registerExactSvmScheme } from "@t402/svm/exact/server";

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const server = new t402ResourceServer(facilitatorClient);

registerExactEvmScheme(server);
registerExactSvmScheme(server);

export const middleware = paymentProxy(
  {
    "/protected": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.001",
          network: "eip155:84532",
          payTo: evmAddress,
        },
        {
          scheme: "exact",
          price: "$0.001",
          network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
          payTo: svmAddress,
        },
      ],
      description: "Premium content",
      mimeType: "text/html",
    },
  },
  server,
);
```

### Custom Paywall

```typescript
import { createPaywall } from "@t402/paywall";
import { evmPaywall } from "@t402/paywall/evm";
import { svmPaywall } from "@t402/paywall/svm";

const paywall = createPaywall()
  .withNetwork(evmPaywall)
  .withNetwork(svmPaywall)
  .withConfig({
    appName: "My App",
    appLogo: "/logo.png",
    testnet: true,
  })
  .build();

export const middleware = paymentProxy(
  routes,
  server,
  undefined, // paywallConfig (using custom paywall instead)
  paywall,
);
```
## Migration from t402-next

If you're migrating from the legacy `t402-next` package:

1. **Update imports**: Change from `t402-next` to `@t402/next`
2. **New API**: Create an t402ResourceServer and register payment schemes
3. **Function rename**: `paymentMiddleware` is now `paymentProxy`
4. **Parameter order**: Routes first, then resource server

### Before (t402-next):

```typescript
import { paymentMiddleware } from "t402-next";

export const middleware = paymentMiddleware(
  "0xYourAddress",
  {
    "/protected": {
      price: "$0.01",
      network: "base-sepolia",
      config: { description: "Access to protected content" },
    },
  },
  facilitator,
  paywall,
);
```

### After (@t402/next):

```typescript
import { paymentProxy, t402ResourceServer } from "@t402/next";
import { HTTPFacilitatorClient } from "@t402/core/server";
import { ExactEvmScheme } from "@t402/evm/exact/server";

const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new t402ResourceServer(facilitator)
  .register("eip155:84532", new ExactEvmScheme());

export const middleware = paymentProxy(
  {
    "/protected": {
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:84532",
        payTo: "0xYourAddress",
      },
      description: "Access to protected content",
    },
  },
  resourceServer,
);
```

Note: The `payTo` address is now specified within each route configuration rather than as a separate parameter.

