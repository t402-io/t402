import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3001';

// Helper to create a mock payment header (base64url-encoded JSON)
function createMockPaymentHeader(network = 'eip155:84532') {
  const payload = {
    t402Version: 2,
    scheme: 'exact',
    network,
    payload: {
      authorization: {
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68',
        to: '0xC88f67e776f16DcFBf42e6bDda1B82604448899B',
        value: '10000',
        validAfter: 0,
        validBefore: 9999999999,
        nonce: '0x' + '0'.repeat(64),
      },
      signature: '0x' + '0'.repeat(130),
    },
  };
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode a base64url string back to a parsed JSON object.
 */
function decodeBase64url(encoded: string): unknown {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

// ---------------------------------------------------------------------------
// /api/status
// ---------------------------------------------------------------------------
test.describe('GET /api/status', () => {
  test('returns 200 with status, facilitator, and demo fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/status`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('facilitator');
    expect(body).toHaveProperty('demo');
    expect(body.facilitator).toHaveProperty('url');
    expect(body.facilitator).toHaveProperty('online');
    expect(body.demo).toHaveProperty('network');
    expect(body.demo).toHaveProperty('asset');
    expect(body.demo).toHaveProperty('payTo');
  });
});

// ---------------------------------------------------------------------------
// /api/demo/content
// ---------------------------------------------------------------------------
test.describe('GET /api/demo/content', () => {
  test('returns 402 with t402Version 2 and 10 accepts', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`);
    expect(res.status()).toBe(402);

    const body = await res.json();
    expect(body.t402Version).toBe(2);
    expect(body.accepts).toHaveLength(10);
  });

  test('x-preferred-chain: ton puts ton:testnet first', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`, {
      headers: { 'x-preferred-chain': 'ton' },
    });
    expect(res.status()).toBe(402);

    const body = await res.json();
    expect(body.accepts[0].network).toBe('ton:testnet');
  });

  test('x-preferred-chain: solana puts solana network first', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`, {
      headers: { 'x-preferred-chain': 'solana' },
    });
    expect(res.status()).toBe(402);

    const body = await res.json();
    expect(body.accepts[0].network).toMatch(/^solana:/);
  });

  test('Payment-Required header is valid base64url', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`);
    expect(res.status()).toBe(402);

    const header = res.headers()['payment-required'];
    expect(header).toBeTruthy();

    // Must be valid base64url — no +, /, or = characters
    expect(header).toMatch(/^[A-Za-z0-9_-]+$/);

    // Must decode to valid JSON with t402Version
    const decoded = decodeBase64url(header) as Record<string, unknown>;
    expect(decoded).toHaveProperty('t402Version', 2);
    expect(decoded).toHaveProperty('accepts');
  });

  test('CORS expose headers are present', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`);
    const exposeHeaders = res.headers()['access-control-expose-headers'];
    expect(exposeHeaders).toBeTruthy();
    expect(exposeHeaders).toContain('Payment-Required');
    expect(exposeHeaders).toContain('Payment-Response');
  });

  test('demo mode with payment returns 200 with article', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`, {
      headers: {
        'x-demo-mode': 'true',
        'payment-signature': createMockPaymentHeader(),
      },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('article');
    expect(body.article).toHaveProperty('title');
    expect(body.article).toHaveProperty('author');
    expect(body.article).toHaveProperty('content');
  });

  test('demo mode with payment returns Payment-Response header', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`, {
      headers: {
        'x-demo-mode': 'true',
        'payment-signature': createMockPaymentHeader(),
      },
    });
    expect(res.status()).toBe(200);

    const paymentResponse = res.headers()['payment-response'];
    expect(paymentResponse).toBeTruthy();
    expect(paymentResponse).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('each accept has correct scheme per chain family', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`);
    const body = await res.json();

    const exactNetworks = /^(eip155:|ton:|tron:|solana:)/;
    const exactDirectNetworks = /^(stacks:|near:|aptos:|tezos:|polkadot:|cosmos:)/;

    for (const accept of body.accepts) {
      if (exactNetworks.test(accept.network)) {
        expect(accept.scheme).toBe('exact');
      } else if (exactDirectNetworks.test(accept.network)) {
        expect(accept.scheme).toBe('exact-direct');
      }
    }
  });

  test('EVM accept has extra.name = "USD Coin"', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`);
    const body = await res.json();

    const evmAccept = body.accepts.find((a: { network: string }) =>
      a.network.startsWith('eip155:'),
    );
    expect(evmAccept).toBeTruthy();
    expect(evmAccept.extra).toBeTruthy();
    expect(evmAccept.extra.name).toBe('USD Coin');
  });

  test('402 response includes preview with title and author', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`);
    expect(res.status()).toBe(402);

    const body = await res.json();
    expect(body).toHaveProperty('preview');
    expect(body.preview).toHaveProperty('title');
    expect(body.preview).toHaveProperty('author');
    expect(typeof body.preview.title).toBe('string');
    expect(typeof body.preview.author).toBe('string');
    expect(body.preview.title.length).toBeGreaterThan(0);
    expect(body.preview.author.length).toBeGreaterThan(0);
  });

  test('all accepts have non-empty payTo addresses', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`);
    const body = await res.json();

    for (const accept of body.accepts) {
      expect(accept.payTo).toBeTruthy();
      expect(typeof accept.payTo).toBe('string');
      expect(accept.payTo.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// /api/demo/ai-query
// ---------------------------------------------------------------------------
test.describe('/api/demo/ai-query', () => {
  test('GET returns 405 with helpful message', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/ai-query`);
    expect(res.status()).toBe(405);

    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('not allowed');
    expect(body).toHaveProperty('example');
  });

  test('POST without payment returns 402', async ({ request }) => {
    const res = await request.post(`${BASE}/api/demo/ai-query`, {
      data: { query: 'What is T402?' },
    });
    expect(res.status()).toBe(402);

    const body = await res.json();
    expect(body.t402Version).toBe(2);
    expect(body.accepts).toHaveLength(10);
  });

  test('POST with demo mode + payment returns 200 with AI response', async ({ request }) => {
    const res = await request.post(`${BASE}/api/demo/ai-query`, {
      headers: {
        'x-demo-mode': 'true',
        'payment-signature': createMockPaymentHeader(),
      },
      data: { query: 'What is HTTP 402?' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('query');
    expect(body).toHaveProperty('response');
    expect(body).toHaveProperty('cost');
    expect(typeof body.response).toBe('string');
    expect(body.response.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// OPTIONS (CORS preflight)
// ---------------------------------------------------------------------------
test.describe('OPTIONS CORS preflight', () => {
  test('OPTIONS /api/demo/content returns 204 with CORS headers', async ({ request }) => {
    const res = await request.fetch(`${BASE}/api/demo/content`, { method: 'OPTIONS' });
    expect(res.status()).toBe(204);

    const headers = res.headers();
    expect(headers['access-control-allow-origin']).toBe('*');
    expect(headers['access-control-allow-methods']).toContain('GET');
    expect(headers['access-control-allow-methods']).toContain('POST');
    expect(headers['access-control-allow-methods']).toContain('OPTIONS');
    expect(headers['access-control-allow-headers']).toContain('Payment-Signature');
    expect(headers['access-control-expose-headers']).toContain('Payment-Required');
    expect(headers['access-control-expose-headers']).toContain('Payment-Response');
  });

  test('OPTIONS /api/demo/ai-query returns 204 with CORS headers', async ({ request }) => {
    const res = await request.fetch(`${BASE}/api/demo/ai-query`, { method: 'OPTIONS' });
    expect(res.status()).toBe(204);

    const headers = res.headers();
    expect(headers['access-control-allow-origin']).toBe('*');
    expect(headers['access-control-allow-methods']).toContain('GET');
    expect(headers['access-control-allow-methods']).toContain('OPTIONS');
    expect(headers['access-control-allow-headers']).toContain('Payment-Signature');
  });
});

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
test.describe('Security headers', () => {
  test('API responses include security headers', async ({ request }) => {
    const res = await request.get(`${BASE}/api/demo/content`);
    const headers = res.headers();

    // Content-Security-Policy
    expect(headers['content-security-policy']).toBeTruthy();
    expect(headers['content-security-policy']).toContain("default-src 'self'");

    // HSTS
    expect(headers['strict-transport-security']).toBeTruthy();
    expect(headers['strict-transport-security']).toContain('max-age=');

    // X-Content-Type-Options
    expect(headers['x-content-type-options']).toBe('nosniff');

    // X-Frame-Options
    expect(headers['x-frame-options']).toBe('DENY');

    // Referrer-Policy
    expect(headers['referrer-policy']).toBeTruthy();

    // Permissions-Policy
    expect(headers['permissions-policy']).toBeTruthy();
  });
});
