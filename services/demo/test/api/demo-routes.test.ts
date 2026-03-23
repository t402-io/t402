import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { encodeHeader, decodeHeader } from "../../app/lib/t402-server";

// Mock the facilitator calls so we never hit a real network
vi.mock("../../app/lib/t402-server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    verifyPayment: vi.fn().mockResolvedValue({ isValid: true, payer: "0xabc" }),
    settlePayment: vi.fn().mockResolvedValue({
      success: true,
      transaction: "0x" + "a".repeat(64),
      network: "eip155:84532",
      payer: "0xabc",
    }),
  };
});

function makeRequest(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
) {
  const headers = new Headers(options?.headers);
  const init: { method: string; headers: Headers; body?: string } = { method: options?.method ?? "GET", headers };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function makePaymentHeader(payload: Record<string, unknown> = { mock: true }): string {
  return encodeHeader(payload);
}

// ---------------------------------------------------------------------------
// encodeHeader / decodeHeader
// ---------------------------------------------------------------------------
describe("encodeHeader / decodeHeader", () => {
  it("encodeHeader produces valid base64url (no +, /, or = padding)", () => {
    const data = { hello: "world", num: 42, nested: { a: [1, 2, 3] } };
    const encoded = encodeHeader(data);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("decodeHeader reverses encodeHeader", () => {
    const data = { t402Version: 2, error: "Payment required", extra: [1, "two"] };
    const encoded = encodeHeader(data);
    const decoded = decodeHeader(encoded);
    expect(decoded).toEqual(data);
  });

  it("decodeHeader handles invalid base64 gracefully (throws)", () => {
    expect(() => decodeHeader("!!!invalid-not-base64!!!")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Content route — GET /api/demo/content
// ---------------------------------------------------------------------------
describe("GET /api/demo/content", () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import("../../app/api/demo/content/route");
    GET = mod.GET;
  });

  it("returns 402 with correct PaymentRequired structure when no payment header", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/content");
    const res = await GET(req);
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body).toHaveProperty("t402Version", 2);
    expect(body).toHaveProperty("error", "Payment required");
    expect(body).toHaveProperty("resource");
    expect(body.resource).toHaveProperty("url", "/api/demo/content");
    expect(body.resource).toHaveProperty("mimeType", "application/json");
    expect(body).toHaveProperty("accepts");
    expect(Array.isArray(body.accepts)).toBe(true);
    expect(body.accepts.length).toBeGreaterThan(0);
  });

  it("returns 402 with TON as first option when x-preferred-chain: ton", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/content", {
      headers: { "x-preferred-chain": "ton" },
    });
    const res = await GET(req);
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.accepts[0].network).toBe("ton:testnet");
  });

  it("returns 200 with article in demo mode with valid payment header", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/content", {
      headers: {
        "x-demo-mode": "true",
        "payment-signature": makePaymentHeader(),
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("article");
    expect(body.article).toHaveProperty("title");
    expect(body.article).toHaveProperty("content");
  });

  it("includes CORS expose headers on 402 response", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/content");
    const res = await GET(req);
    const expose = res.headers.get("Access-Control-Expose-Headers");
    expect(expose).toContain("Payment-Required");
    expect(expose).toContain("Payment-Response");
  });

  it("includes CORS expose headers on 200 response", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/content", {
      headers: {
        "x-demo-mode": "true",
        "payment-signature": makePaymentHeader(),
      },
    });
    const res = await GET(req);
    const expose = res.headers.get("Access-Control-Expose-Headers");
    expect(expose).toContain("Payment-Required");
    expect(expose).toContain("Payment-Response");
  });

  it("sets Payment-Required header (base64url-encoded) on 402", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/content");
    const res = await GET(req);
    const header = res.headers.get("Payment-Required");
    expect(header).toBeTruthy();

    // Should be decodable back to the payment required structure
    const decoded = decodeHeader(header!) as Record<string, unknown>;
    expect(decoded).toHaveProperty("t402Version", 2);
    expect(decoded).toHaveProperty("accepts");
  });

  it("sets Payment-Response header on 200 in demo mode", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/content", {
      headers: {
        "x-demo-mode": "true",
        "payment-signature": makePaymentHeader(),
      },
    });
    const res = await GET(req);
    const header = res.headers.get("Payment-Response");
    expect(header).toBeTruthy();

    const decoded = decodeHeader(header!) as Record<string, unknown>;
    expect(decoded).toHaveProperty("success", true);
    expect(decoded).toHaveProperty("transaction");
  });

  it("402 body includes preview with title and author", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/content");
    const res = await GET(req);
    const body = await res.json();
    expect(body).toHaveProperty("preview");
    expect(body.preview).toHaveProperty("title");
    expect(body.preview).toHaveProperty("author");
  });
});

// ---------------------------------------------------------------------------
// AI Query route — POST /api/demo/ai-query
// ---------------------------------------------------------------------------
describe("POST /api/demo/ai-query", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    const mod = await import("../../app/api/demo/ai-query/route");
    POST = mod.POST;
  });

  it("returns 402 without payment header", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/ai-query", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body).toHaveProperty("t402Version", 2);
    expect(body).toHaveProperty("error", "Payment required");
    expect(body).toHaveProperty("resource");
    expect(body).toHaveProperty("accepts");
    expect(Array.isArray(body.accepts)).toBe(true);
  });

  it("returns 200 with AI response in demo mode", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/ai-query", {
      method: "POST",
      headers: {
        "x-demo-mode": "true",
        "payment-signature": makePaymentHeader(),
        "Content-Type": "application/json",
      },
      body: { query: "What is HTTP 402?" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("query", "What is HTTP 402?");
    expect(body).toHaveProperty("response");
    expect(typeof body.response).toBe("string");
    expect(body).toHaveProperty("cost", "0.001 USDT");
    expect(body).toHaveProperty("model");
  });

  it("sets Payment-Required header on 402", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/ai-query", {
      method: "POST",
    });
    const res = await POST(req);
    const header = res.headers.get("Payment-Required");
    expect(header).toBeTruthy();
  });

  it("sets Payment-Response header on 200 in demo mode", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/ai-query", {
      method: "POST",
      headers: {
        "x-demo-mode": "true",
        "payment-signature": makePaymentHeader(),
        "Content-Type": "application/json",
      },
      body: { query: "Tell me about T402" },
    });
    const res = await POST(req);
    const header = res.headers.get("Payment-Response");
    expect(header).toBeTruthy();

    const decoded = decodeHeader(header!) as Record<string, unknown>;
    expect(decoded).toHaveProperty("success", true);
  });

  it("402 accepts array has correct resource url", async () => {
    const req = makeRequest("http://localhost:3000/api/demo/ai-query", {
      method: "POST",
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.resource.url).toBe("/api/demo/ai-query");
  });
});
