import { describe, it, expect } from "vitest";
import {
  // Constants
  AP2_EXTENSION_URI,
  X402_PAYMENT_METHOD,
  AP2_DATA_KEYS,
  T402_A2A_EXTENSION_URI,
  X402_A2A_EXTENSION_URI,
  A2A_EXTENSIONS_HEADER,
  // Bridge functions
  createCartMandateWithX402,
  extractX402Requirements,
  createPaymentMandateWithX402,
  extractX402Payload,
  createAP2Extension,
  // AgentCard & header helpers
  createPaymentExtensions,
  getPaymentExtensionHeaders,
  // DataPart helpers
  createCartMandateDataPart,
  createPaymentMandateDataPart,
  createIntentMandateDataPart,
  createPaymentReceiptDataPart,
  extractCartMandateFromArtifact,
  extractPaymentMandateFromMessage,
  // Flow detection (from Phase 1)
  isStandaloneFlow,
  isEmbeddedFlow,
} from "@t402/core/types";
import type {
  CartContents,
  CartMandate,
  PaymentMandateContents,
  IntentMandate,
  PaymentReceipt,
  A2ATask,
  A2AArtifact,
  A2AMessage,
  PaymentRequirements,
  PaymentPayload,
} from "@t402/core/types";
import { A2APaymentClient } from "../src/client";
import { A2APaymentServer } from "../src/server";

// ============================================================================
// Test Fixtures
// ============================================================================

const mockRequirements: PaymentRequirements = {
  scheme: "exact",
  network: "eip155:8453",
  amount: "1000000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0xTestPayTo",
  maxTimeoutSeconds: 3600,
  extra: {},
};

const mockPayload: PaymentPayload = {
  t402Version: 2,
  accepted: mockRequirements,
  payload: {
    signature: "0xMockSignature",
    from: "0xTestPayer",
    to: "0xTestPayTo",
    amount: "1000000",
  },
};

const mockCartContents: CartContents = {
  id: "cart-001",
  user_cart_confirmation_required: false,
  payment_request: {
    method_data: [],
    details: {
      id: "order-001",
      display_items: [
        { label: "AI Translation", amount: { currency: "USD", value: 1.0 } },
      ],
      total: { label: "Total", amount: { currency: "USD", value: 1.0 } },
    },
  },
  cart_expiry: "2026-12-31T23:59:59Z",
  merchant_name: "Test Merchant",
};

const mockMandateContents: PaymentMandateContents = {
  payment_mandate_id: "mandate-001",
  payment_details_id: "cart-001",
  payment_details_total: {
    label: "Total",
    amount: { currency: "USD", value: 1.0 },
  },
  payment_response: {
    request_id: "order-001",
    method_name: "",
  },
  merchant_agent: "agent://test-merchant/translate",
  timestamp: "2026-02-25T12:00:00Z",
};

// ============================================================================
// Constants
// ============================================================================

describe("AP2 Constants", () => {
  it("AP2_EXTENSION_URI is correct", () => {
    expect(AP2_EXTENSION_URI).toBe(
      "https://github.com/google-agentic-commerce/ap2/tree/v0.1",
    );
  });

  it("X402_PAYMENT_METHOD is correct", () => {
    expect(X402_PAYMENT_METHOD).toBe("https://www.x402.org/");
  });

  it("AP2_DATA_KEYS has all 4 canonical keys", () => {
    expect(AP2_DATA_KEYS.INTENT_MANDATE).toBe("ap2.mandates.IntentMandate");
    expect(AP2_DATA_KEYS.CART_MANDATE).toBe("ap2.mandates.CartMandate");
    expect(AP2_DATA_KEYS.PAYMENT_MANDATE).toBe("ap2.mandates.PaymentMandate");
    expect(AP2_DATA_KEYS.PAYMENT_RECEIPT).toBe("ap2.PaymentReceipt");
  });
});

// ============================================================================
// Bridge Functions — CartMandate
// ============================================================================

describe("CartMandate Bridge", () => {
  it("createCartMandateWithX402 embeds x402 requirements", () => {
    const mandate = createCartMandateWithX402(mockCartContents, [mockRequirements]);

    expect(mandate.contents.id).toBe("cart-001");
    expect(mandate.contents.merchant_name).toBe("Test Merchant");

    const x402Method = mandate.contents.payment_request.method_data.find(
      (m) => m.supported_methods === X402_PAYMENT_METHOD,
    );
    expect(x402Method).toBeDefined();
    expect((x402Method!.data!.requirements as PaymentRequirements[])[0]).toEqual(
      mockRequirements,
    );
  });

  it("createCartMandateWithX402 preserves existing non-x402 methods", () => {
    const contentsWithFiat: CartContents = {
      ...mockCartContents,
      payment_request: {
        ...mockCartContents.payment_request,
        method_data: [
          { supported_methods: "https://pay.google.com/", data: { type: "CARD" } },
        ],
      },
    };

    const mandate = createCartMandateWithX402(contentsWithFiat, [mockRequirements]);
    expect(mandate.contents.payment_request.method_data).toHaveLength(2);
    expect(
      mandate.contents.payment_request.method_data[0].supported_methods,
    ).toBe("https://pay.google.com/");
  });

  it("createCartMandateWithX402 includes merchant authorization", () => {
    const mandate = createCartMandateWithX402(
      mockCartContents,
      [mockRequirements],
      "jwt-token-here",
    );
    expect(mandate.merchant_authorization).toBe("jwt-token-here");
  });

  it("extractX402Requirements round-trips correctly", () => {
    const mandate = createCartMandateWithX402(mockCartContents, [mockRequirements]);
    const extracted = extractX402Requirements(mandate);

    expect(extracted).toBeDefined();
    expect(extracted).toHaveLength(1);
    expect(extracted![0]).toEqual(mockRequirements);
  });

  it("extractX402Requirements returns undefined for non-x402", () => {
    const mandate: CartMandate = {
      contents: {
        ...mockCartContents,
        payment_request: {
          ...mockCartContents.payment_request,
          method_data: [
            { supported_methods: "https://pay.google.com/", data: { type: "CARD" } },
          ],
        },
      },
    };
    expect(extractX402Requirements(mandate)).toBeUndefined();
  });
});

// ============================================================================
// Bridge Functions — PaymentMandate
// ============================================================================

describe("PaymentMandate Bridge", () => {
  it("createPaymentMandateWithX402 embeds x402 payload", () => {
    const mandate = createPaymentMandateWithX402(mockMandateContents, mockPayload);

    expect(mandate.payment_mandate_contents.payment_mandate_id).toBe("mandate-001");
    expect(
      mandate.payment_mandate_contents.payment_response.method_name,
    ).toBe(X402_PAYMENT_METHOD);
    expect(mandate.payment_mandate_contents.payment_response.details).toBeDefined();
  });

  it("createPaymentMandateWithX402 includes user authorization", () => {
    const mandate = createPaymentMandateWithX402(
      mockMandateContents,
      mockPayload,
      "verifiable-presentation-jwt",
    );
    expect(mandate.user_authorization).toBe("verifiable-presentation-jwt");
  });

  it("extractX402Payload round-trips correctly", () => {
    const mandate = createPaymentMandateWithX402(mockMandateContents, mockPayload);
    const extracted = extractX402Payload(mandate);

    expect(extracted).toBeDefined();
    expect(extracted!.t402Version).toBe(2);
    expect(extracted!.payload.signature).toBe("0xMockSignature");
  });

  it("extractX402Payload returns undefined for non-x402 method", () => {
    const mandate = createPaymentMandateWithX402(mockMandateContents, mockPayload);
    mandate.payment_mandate_contents.payment_response.method_name = "https://pay.google.com/";
    expect(extractX402Payload(mandate)).toBeUndefined();
  });
});

// ============================================================================
// DataPart Helpers
// ============================================================================

describe("DataPart Helpers", () => {
  it("createCartMandateDataPart + extractCartMandateFromArtifact round-trip", () => {
    const mandate = createCartMandateWithX402(mockCartContents, [mockRequirements]);
    const dataPart = createCartMandateDataPart(mandate);

    expect(dataPart.kind).toBe("data");
    expect(dataPart.data[AP2_DATA_KEYS.CART_MANDATE]).toBeDefined();

    const artifact: A2AArtifact = {
      kind: "ap2.cart",
      name: "Cart",
      parts: [dataPart],
    };

    const extracted = extractCartMandateFromArtifact(artifact);
    expect(extracted).toBeDefined();
    expect(extracted!.contents.id).toBe("cart-001");
  });

  it("createPaymentMandateDataPart creates correct DataPart", () => {
    const mandate = createPaymentMandateWithX402(mockMandateContents, mockPayload);
    const dataPart = createPaymentMandateDataPart(mandate);

    expect(dataPart.kind).toBe("data");
    expect(dataPart.data[AP2_DATA_KEYS.PAYMENT_MANDATE]).toBeDefined();
  });

  it("extractPaymentMandateFromMessage extracts mandate", () => {
    const mandate = createPaymentMandateWithX402(mockMandateContents, mockPayload);
    const message: A2AMessage = {
      kind: "message",
      role: "user",
      parts: [
        { kind: "text", text: "Payment" },
        createPaymentMandateDataPart(mandate),
      ],
    };

    const extracted = extractPaymentMandateFromMessage(message);
    expect(extracted).toBeDefined();
    expect(extracted!.payment_mandate_contents.payment_mandate_id).toBe("mandate-001");
  });

  it("createIntentMandateDataPart creates correct DataPart", () => {
    const intent: IntentMandate = {
      natural_language_description: "Book a flight to Tokyo",
      user_cart_confirmation_required: true,
      intent_expiry: "2026-12-31T23:59:59Z",
    };
    const dataPart = createIntentMandateDataPart(intent);

    expect(dataPart.kind).toBe("data");
    expect(dataPart.data[AP2_DATA_KEYS.INTENT_MANDATE]).toBeDefined();
  });

  it("createPaymentReceiptDataPart creates correct DataPart", () => {
    const receipt: PaymentReceipt = {
      payment_mandate_id: "mandate-001",
      timestamp: "2026-02-25T12:01:00Z",
      payment_id: "tx-001",
      amount: { currency: "USD", value: 1.0 },
      payment_status: { merchant_confirmation_id: "conf-001" },
    };
    const dataPart = createPaymentReceiptDataPart(receipt);

    expect(dataPart.kind).toBe("data");
    expect(dataPart.data[AP2_DATA_KEYS.PAYMENT_RECEIPT]).toBeDefined();
  });

  it("extractCartMandateFromArtifact returns undefined for no parts", () => {
    const artifact: A2AArtifact = { kind: "generic" };
    expect(extractCartMandateFromArtifact(artifact)).toBeUndefined();
  });

  it("extractCartMandateFromArtifact returns undefined for non-AP2 parts", () => {
    const artifact: A2AArtifact = {
      kind: "generic",
      parts: [{ kind: "text", text: "hello" }],
    };
    expect(extractCartMandateFromArtifact(artifact)).toBeUndefined();
  });

  it("extractPaymentMandateFromMessage returns undefined for text-only", () => {
    const message: A2AMessage = {
      kind: "message",
      role: "user",
      parts: [{ kind: "text", text: "No mandate here" }],
    };
    expect(extractPaymentMandateFromMessage(message)).toBeUndefined();
  });
});

// ============================================================================
// Extension Helper
// ============================================================================

describe("createAP2Extension", () => {
  it("creates AP2 extension with default merchant role", () => {
    const ext = createAP2Extension();
    expect(ext.uri).toBe(AP2_EXTENSION_URI);
    expect(ext.description).toContain("merchant");
    expect(ext.required).toBe(false);
  });

  it("creates AP2 extension with multiple roles", () => {
    const ext = createAP2Extension(["merchant", "payment-processor"], true);
    expect(ext.description).toContain("merchant");
    expect(ext.description).toContain("payment-processor");
    expect(ext.required).toBe(true);
  });
});

// ============================================================================
// A2APaymentClient — Embedded Flow
// ============================================================================

describe("A2APaymentClient Embedded Flow", () => {
  it("extractEmbeddedRequirements finds CartMandate in artifacts", () => {
    const client = new A2APaymentClient();
    const mandate = createCartMandateWithX402(mockCartContents, [mockRequirements]);
    const task: A2ATask = {
      kind: "task",
      id: "task-embedded",
      status: {
        state: "input-required",
        message: {
          kind: "message",
          role: "agent",
          parts: [{ kind: "text", text: "Pay" }],
          metadata: { "x402.payment.status": "payment-required" },
        },
      },
      artifacts: [
        {
          kind: "ap2.cart",
          parts: [createCartMandateDataPart(mandate)],
        },
      ],
    };

    const reqs = client.extractEmbeddedRequirements(task);
    expect(reqs).toBeDefined();
    expect(reqs).toHaveLength(1);
    expect(reqs![0].network).toBe("eip155:8453");
  });

  it("extractEmbeddedRequirements returns undefined for no artifacts", () => {
    const client = new A2APaymentClient();
    const task: A2ATask = {
      kind: "task",
      id: "task-none",
      status: { state: "working" },
    };
    expect(client.extractEmbeddedRequirements(task)).toBeUndefined();
  });

  it("createEmbeddedPaymentMessage creates message with PaymentMandate", () => {
    const client = new A2APaymentClient();
    const msg = client.createEmbeddedPaymentMessage(
      mockMandateContents,
      mockPayload,
    );

    expect(msg.kind).toBe("message");
    expect(msg.role).toBe("user");
    expect(msg.metadata?.["t402.payment.status"]).toBe("payment-submitted");
    expect(msg.metadata?.["x402.payment.status"]).toBe("payment-submitted");

    // Should have text + DataPart
    expect(msg.parts).toHaveLength(2);
    expect(msg.parts[0].kind).toBe("text");
    expect(msg.parts[1].kind).toBe("data");

    // Extract mandate from message
    const mandate = extractPaymentMandateFromMessage(msg);
    expect(mandate).toBeDefined();
    const payload = extractX402Payload(mandate!);
    expect(payload).toBeDefined();
    expect(payload!.t402Version).toBe(2);
  });
});

// ============================================================================
// A2APaymentServer — Embedded Flow
// ============================================================================

describe("A2APaymentServer Embedded Flow", () => {
  it("createEmbeddedPaymentRequiredTask creates embedded-flow task", () => {
    const server = new A2APaymentServer();
    const task = server.createEmbeddedPaymentRequiredTask(
      "task-embed",
      mockCartContents,
      [mockRequirements],
    );

    expect(task.id).toBe("task-embed");
    expect(task.status.state).toBe("input-required");
    // x402 status present, but NO x402 required (embedded flow)
    expect(task.status.message?.metadata?.["x402.payment.status"]).toBe(
      "payment-required",
    );
    expect(
      task.status.message?.metadata?.["x402.payment.required"],
    ).toBeUndefined();

    // Artifact should contain CartMandate
    expect(task.artifacts).toHaveLength(1);
    const mandate = extractCartMandateFromArtifact(task.artifacts![0]);
    expect(mandate).toBeDefined();
    expect(mandate!.contents.merchant_name).toBe("Test Merchant");

    // x402 requirements should be in CartMandate
    const reqs = extractX402Requirements(mandate!);
    expect(reqs).toHaveLength(1);
    expect(reqs![0].amount).toBe("1000000");
  });

  it("createEmbeddedPaymentRequiredTask is detected as embedded flow", () => {
    const server = new A2APaymentServer();
    const task = server.createEmbeddedPaymentRequiredTask(
      "task-embed",
      mockCartContents,
      [mockRequirements],
    );

    expect(isEmbeddedFlow(task)).toBe(true);
    expect(isStandaloneFlow(task)).toBe(false);
  });

  it("extractEmbeddedPayload finds x402 payload in PaymentMandate", () => {
    const server = new A2APaymentServer();
    const mandate = createPaymentMandateWithX402(mockMandateContents, mockPayload);
    const message: A2AMessage = {
      kind: "message",
      role: "user",
      parts: [
        { kind: "text", text: "Payment" },
        createPaymentMandateDataPart(mandate),
      ],
    };

    const payload = server.extractEmbeddedPayload(message);
    expect(payload).toBeDefined();
    expect(payload!.t402Version).toBe(2);
    expect(payload!.payload.signature).toBe("0xMockSignature");
  });

  it("extractEmbeddedPayload returns undefined for text-only message", () => {
    const server = new A2APaymentServer();
    const message: A2AMessage = {
      kind: "message",
      role: "user",
      parts: [{ kind: "text", text: "Hello" }],
    };
    expect(server.extractEmbeddedPayload(message)).toBeUndefined();
  });
});

// ============================================================================
// Phase 3: AgentCard Extension Composition & Header Helpers
// ============================================================================

describe("createPaymentExtensions", () => {
  it("returns t402 + x402 extensions by default", () => {
    const extensions = createPaymentExtensions();
    expect(extensions).toHaveLength(2);
    expect(extensions[0].uri).toBe(T402_A2A_EXTENSION_URI);
    expect(extensions[1].uri).toBe(X402_A2A_EXTENSION_URI);
    expect(extensions[0].required).toBe(false);
    expect(extensions[1].required).toBe(false);
  });

  it("includes AP2 extension when roles specified", () => {
    const extensions = createPaymentExtensions({ ap2Roles: ["merchant"] });
    expect(extensions).toHaveLength(3);
    expect(extensions[2].uri).toBe(AP2_EXTENSION_URI);
    expect(extensions[2].description).toContain("merchant");
  });

  it("respects required flags", () => {
    const extensions = createPaymentExtensions({
      t402Required: true,
      x402Required: true,
      ap2Roles: ["shopper"],
      ap2Required: true,
    });
    expect(extensions[0].required).toBe(true);
    expect(extensions[1].required).toBe(true);
    expect(extensions[2].required).toBe(true);
  });

  it("supports multiple AP2 roles", () => {
    const extensions = createPaymentExtensions({
      ap2Roles: ["merchant", "payment-processor"],
    });
    expect(extensions[2].description).toContain("merchant");
    expect(extensions[2].description).toContain("payment-processor");
  });
});

describe("getPaymentExtensionHeaders", () => {
  it("returns x402 extension header by default", () => {
    const headers = getPaymentExtensionHeaders();
    expect(headers[A2A_EXTENSIONS_HEADER]).toBe(X402_A2A_EXTENSION_URI);
  });

  it("includes AP2 URI when requested", () => {
    const headers = getPaymentExtensionHeaders(true);
    const value = headers[A2A_EXTENSIONS_HEADER];
    expect(value).toContain(X402_A2A_EXTENSION_URI);
    expect(value).toContain(AP2_EXTENSION_URI);
    expect(value).toBe(`${X402_A2A_EXTENSION_URI}, ${AP2_EXTENSION_URI}`);
  });

  it("header key matches A2A_EXTENSIONS_HEADER constant", () => {
    const headers = getPaymentExtensionHeaders();
    expect(Object.keys(headers)).toEqual([A2A_EXTENSIONS_HEADER]);
    expect(A2A_EXTENSIONS_HEADER).toBe("X-A2A-Extensions");
  });
});
