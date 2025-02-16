402 payments protocol

## Terms:

- resource: some thing on the internet, could be a file, a service, etc.
- client: entity wanting to pay for a resource
- router service: service that facilitates verification and execution of payments
- resource server: an http server that provides an api or other resources for a client

## Goals:

- gassless for all client and resource server
- minimal integration for the resource server and client (1 line for server, 1 function for client)
- ability to trade off speed of response for guarantee of payment

# V1 Flow

1. Request endpoint
2. Receive 402 response with body `PaymentNeededDetails`

```typescript
type PaymentNeededDetails = {
  version: number; // Version of the payment protocol
  maxAmountRequired: bigint; // Maximum amount required to pay for the resource
  resource: Resource; // URL of resource to pay for
  description: string; // Description of the resource
  mimeType: string; // MIME type of the resource response
  outputSchema?: object | undefined; // Output schema of the resource response
  routerAddress: Address; // Address of the routing account that facilitates payment
};
```

3. Create payment payload

3.a Sign permit operation with `usdc` contract for `routerAddress`

3.b Create `PaymentPayloadV1`

```typescript
export type PaymentPayloadV1 = {
  version: number;
  payload: PayloadV1;
  resource: Resource;
};

export type PayloadV1 = {
  signature: PermitSignature;
  params: PermitParameters;
};

export type PermitSignature = {
  r: Hex;
  s: Hex;
  v: number;
};

// Standard parameters for a permit signature
export type PermitParameters = {
  ownerAddress: Address;
  spenderAddress: Address;
  deadline: bigint;
  chainId: number;
  permitVersion: string;
  // Nonce applies to the spender
  nonce: bigint;
  // Value of usdc to approve (usdc uses 6 decimals, to get float its value / 10^6)
  value: bigint;
};
```

3.c Convert `PaymentPayloadV1` to json and base64 encode

4. Send request to resource server with `Payment-Signature` header

5. Resource server verifies payload or forwards payment header to router service

### Verification (default path)

Router service (CDP provided) has the follow interface provided over REST. `PaymentHeader` is the base64 encoded `PaymentPayloadV1`

```typescript
export type PaymentExecutionResponse = {
  success: boolean;
  error?: string | undefined;
  txHash?: Hex | undefined;
  chainId?: number | undefined;
};

interface RouterService {
  verifyPayment(
    paymentHeader: string,
    paymentDetails: PaymentNeededDetails
  ): {
    isValid: boolean;
    invalidReason?: string | undefined;
  };
  executePayment(
    paymentHeader: string,
    amount: string
  ): PaymentExecutionResponse; // amount is the required payment represented as a string
}
```

6. Verifier confirms funds are available and the resource should accept the request

7. Resource server performs work to fulfill request

8. Resource server called `executePayment` with the amount required to pay for the resource

8.a router service performs a multi-call on the usdc contract consuming the permit signature, and then calling `transferFrom` with the amount required to pay for the resource

9. Resource server returns the `PaymentExecutionResponse` from the router service

10. Resource server returns the response to the client

#### Notes

- there is a window of time while the resource server is performing the work that the client could revoke a nonce or move funds that would result in the payment failing
- the resource server currently waits for payment to execute before returning the response to the client, meaning the minimum response time is 1 block

### Verification (optimistic aka just trust me bro)

todo: more detailed steps

- similar to default path but the resource server doesn't wait for payment to execute before returning the response to the client

### Verification (high value)

todo: more detailed steps

- on `verifyPayment` the resource server pulls funds into an escrow account before telling the client to proceed with the work.

## Future

- re-requesting resources that have been paid for
