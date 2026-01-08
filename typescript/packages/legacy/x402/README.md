# t402

Core TypeScript implementation of the t402 Payment Protocol. This package provides the foundational types, schemas, and utilities that power all t402 integrations.

## Installation

```bash
npm install t402
```

## Overview

The t402 package provides the core building blocks for implementing the t402 Payment Protocol in TypeScript. It's designed to be used by:

- Middleware implementations (Express, Hono, Next.js)
- Client-side payment handlers (fetch wrapper)
- Facilitator services
- Custom integrations

## Integration Packages

This core package is used by the following integration packages:

- `t402-express`: Express.js middleware
- `t402-hono`: Hono middleware
- `t402-next`: Next.js middleware
- `t402-fetch`: Fetch API wrapper
- `t402-axios`: Axios interceptor

## Manual Server Integration

If you're not using one of our server middleware packages, you can implement the t402 protocol manually. Here's what you'll need to handle:

1. Return 402 error responses with the appropriate response body
2. Use the facilitator to validate payments
3. Use the facilitator to settle payments
4. Return the appropriate response header to the caller

For a complete example implementation, see our [advanced server example](https://github.com/coinbase/t402/tree/main/examples/typescript/servers/advanced) which demonstrates both synchronous and asynchronous payment processing patterns.

## Manual Client Integration

If you're not using our `t402-fetch` or `t402-axios` packages, you can manually integrate the t402 protocol in your client application. Here's how:

1. Make a request to a t402-protected endpoint. The server will respond with a 402 status code and a JSON object containing:
   - `t402Version`: The version of the t402 protocol being used
   - `accepts`: An array of payment requirements you can fulfill

2. Select the payment requirement you wish to fulfill from the `accepts` array

3. Create the payment header using the selected payment requirement

4. Retry your network call with:
   - The payment header assigned to the `X-PAYMENT` field
   - The `Access-Control-Expose-Headers` field set to `"X-PAYMENT-RESPONSE"` to receive the server's transaction response

For implementation examples, we recommend reviewing our official client packages:
- [t402-fetch implementation](https://github.com/coinbase/t402/blob/main/typescript/packages/t402-fetch/src/index.ts)
- [t402-axios implementation](https://github.com/coinbase/t402/blob/main/typescript/packages/t402-axios/src/index.ts)

