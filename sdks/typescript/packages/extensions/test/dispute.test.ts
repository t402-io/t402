import { describe, it, expect } from "vitest";

import {
  DISPUTE_DOMAIN,
  RESOLUTION_DOMAIN,
  DISPUTE_TYPES,
  RESOLUTION_TYPES,
  DISPUTE_PRIMARY_TYPE,
  RESOLUTION_PRIMARY_TYPE,
  STANDARD_DISPUTE_REASONS,
  DISPUTE_VERDICTS,
  ARBITER_SCHEMES,
  DEFAULT_EVIDENCE_URI_SCHEMES,
  DISPUTE_EXTENSION_KEY,
  normalizeDisputeForSigning,
  normalizeResolutionForSigning,
  createSignedDispute,
  createSignedResolution,
  verifyDispute,
  verifyResolution,
  isDisputeExpired,
  isVerdictAmountConsistent,
  buildDisputePayload,
  buildAndSignDispute,
  buildDisputeSubmissionBody,
  extractDisputeTerms,
  isStandardReason,
  buildDisputeRequirements,
  parseDisputeSubmission,
  validateDispute,
  validateResolution,
  isReasonSupported,
  isEvidenceUriAllowed,
  isReasonWellFormed,
  packageResolutionResponse,
  createDisputeFacilitatorHandler,
  buildFacilitatorResolution,
} from "../src/dispute";

import type {
  DisputePayload,
  ResolutionPayload,
  EIP712DisputeSigner,
  EIP712DisputeVerifier,
  DisputeTermsInfo,
  EIP712Dispute,
} from "../src/dispute";

// ===========================================================================
// Mock signer / verifier
// ===========================================================================

const PAYER = "0x1234567890abcdef1234567890abcdef12345678";
const ARBITER = "0xabcdef1234567890abcdef1234567890abcdef12";

const mockSigner = (address: string): EIP712DisputeSigner => ({
  signDispute: async () => "0xdispute_sig_" + address.slice(-6),
  signResolution: async () => "0xresolution_sig_" + address.slice(-6),
  getAddress: () => address,
});

const passingVerifier = (expectedAddress: string): EIP712DisputeVerifier => ({
  recoverDisputeSigner: async () => expectedAddress,
  recoverResolutionSigner: async () => expectedAddress,
});

const failingVerifier: EIP712DisputeVerifier = {
  recoverDisputeSigner: async () => {
    throw new Error("invalid signature");
  },
  recoverResolutionSigner: async () => {
    throw new Error("invalid signature");
  },
};

const sampleReceiptHash =
  "0xcafedade000000000000000000000000000000000000000000000000deadbeef";
const sampleDisputeHash =
  "0xbeefface000000000000000000000000000000000000000000000000feedf00d";

const NOW = 1_716_000_000;

const sampleDispute: DisputePayload = {
  version: 1,
  receiptHash: sampleReceiptHash,
  reason: "not_delivered",
  requestedAmount: "1000000",
  validUntil: NOW + 86_400,
  evidence: ["ipfs://QmEvidenceHash/complaint.json"],
};

const sampleResolution: ResolutionPayload = {
  version: 1,
  disputeHash: sampleDisputeHash,
  verdict: "upheld_full",
  settledAmount: "1000000",
  arbiter: ARBITER,
  issuedAt: NOW + 100,
  refundTransaction: "0xrefundtx0000000000000000000000000000000000000000",
};

const sampleTerms: DisputeTermsInfo = {
  arbiter: ARBITER,
  arbiterScheme: "facilitator",
  disputeWindow: 86_400 * 7, // 7 days
  supportedReasons: [
    "not_delivered",
    "partial_delivery",
    "quality_issue",
  ],
  evidenceUriSchemes: ["ipfs", "arweave", "https"],
};

// ===========================================================================
// EIP-712 Constants
// ===========================================================================

describe("EIP-712 Constants", () => {
  it("dispute domain matches spec", () => {
    expect(DISPUTE_DOMAIN.name).toBe("T402Dispute");
    expect(DISPUTE_DOMAIN.version).toBe("1");
    expect(DISPUTE_DOMAIN.chainId).toBe(1);
  });

  it("resolution domain shares name space with dispute (spec §Signature Formats)", () => {
    expect(RESOLUTION_DOMAIN.name).toBe("T402Dispute");
    expect(RESOLUTION_DOMAIN.version).toBe("1");
    expect(RESOLUTION_DOMAIN.chainId).toBe(1);
  });

  it("dispute primary type and types", () => {
    expect(DISPUTE_PRIMARY_TYPE).toBe("Dispute");
    expect(DISPUTE_TYPES.Dispute).toBeDefined();
    const fields = DISPUTE_TYPES.Dispute.map((f) => f.name);
    expect(fields).toEqual([
      "version",
      "receiptHash",
      "reason",
      "requestedAmount",
      "validUntil",
      "evidence",
    ]);
  });

  it("resolution primary type and types", () => {
    expect(RESOLUTION_PRIMARY_TYPE).toBe("Resolution");
    const fields = RESOLUTION_TYPES.Resolution.map((f) => f.name);
    expect(fields).toEqual([
      "version",
      "disputeHash",
      "verdict",
      "settledAmount",
      "arbiter",
      "issuedAt",
      "refundTransaction",
    ]);
  });

  it("normalize dispute fills empty evidence", () => {
    const without = { ...sampleDispute };
    delete without.evidence;
    const norm = normalizeDisputeForSigning(without);
    expect(norm.evidence).toEqual([]);
  });

  it("normalize resolution fills empty refundTransaction", () => {
    const without = { ...sampleResolution };
    delete without.refundTransaction;
    const norm = normalizeResolutionForSigning(without);
    expect(norm.refundTransaction).toBe("");
  });
});

// ===========================================================================
// Enums
// ===========================================================================

describe("Enums", () => {
  it("standard reasons match the spec table", () => {
    expect(STANDARD_DISPUTE_REASONS).toEqual([
      "not_delivered",
      "partial_delivery",
      "quality_issue",
      "unauthorized",
      "service_unavailable",
      "duplicate_charge",
      "other",
    ]);
  });

  it("verdicts match the spec closed enum", () => {
    expect(DISPUTE_VERDICTS).toEqual([
      "upheld_full",
      "upheld_partial",
      "denied",
      "void",
    ]);
  });

  it("arbiter schemes match the spec", () => {
    expect(ARBITER_SCHEMES).toEqual([
      "facilitator",
      "contract",
      "external",
      "none",
    ]);
  });

  it("extension key matches spec", () => {
    expect(DISPUTE_EXTENSION_KEY).toBe("dispute");
  });

  it("default evidence URI schemes per spec", () => {
    expect(DEFAULT_EVIDENCE_URI_SCHEMES).toEqual([
      "ipfs",
      "arweave",
      "https",
    ]);
  });

  it("isStandardReason matches enum", () => {
    expect(isStandardReason("not_delivered")).toBe(true);
    expect(isStandardReason("x_gdpr_violation")).toBe(false);
    expect(isStandardReason("invalid_typo")).toBe(false);
  });

  it("isReasonWellFormed accepts x_* prefix per spec", () => {
    expect(isReasonWellFormed("not_delivered")).toBe(true);
    expect(isReasonWellFormed("x_anything")).toBe(true);
    expect(isReasonWellFormed("invalid_typo")).toBe(false);
  });
});

// ===========================================================================
// Signing roundtrip
// ===========================================================================

describe("Signing roundtrip", () => {
  it("createSignedDispute roundtrips with verify", async () => {
    const signer = mockSigner(PAYER);
    const verifier = passingVerifier(PAYER);
    const signed = await createSignedDispute(signer, sampleDispute);
    expect(signed.format).toBe("eip712");
    expect(signed.payload).toEqual(sampleDispute);
    expect(signed.signature).toContain("dispute_sig_");

    const result = await verifyDispute(verifier, signed);
    expect(result.valid).toBe(true);
    expect(result.signer?.toLowerCase()).toBe(PAYER.toLowerCase());
    expect(result.payload).toEqual(sampleDispute);
  });

  it("createSignedDispute records explicit signer for delegate", async () => {
    const signer = mockSigner(PAYER);
    const delegate = "0xdelegate1111111111111111111111111111111111";
    const signed = await createSignedDispute(signer, sampleDispute, delegate);
    expect(signed.format).toBe("eip712");
    if (signed.format !== "eip712") return;
    expect(signed.signer).toBe(delegate);

    // verifyDispute should return the explicit signer over the recovered one
    const verifier = passingVerifier(PAYER);
    const verify = await verifyDispute(verifier, signed);
    expect(verify.signer).toBe(delegate);
  });

  it("createSignedResolution roundtrips", async () => {
    const signer = mockSigner(ARBITER);
    const verifier = passingVerifier(ARBITER);
    const signed = await createSignedResolution(signer, sampleResolution);
    expect(signed.format).toBe("eip712");

    const result = await verifyResolution(verifier, signed, ARBITER);
    expect(result.valid).toBe(true);
    expect(result.signer?.toLowerCase()).toBe(ARBITER.toLowerCase());
  });

  it("verifyDispute returns false on signature failure", async () => {
    const signer = mockSigner(PAYER);
    const signed = await createSignedDispute(signer, sampleDispute);
    const result = await verifyDispute(failingVerifier, signed);
    expect(result.valid).toBe(false);
  });

  it("verifyResolution rejects arbiter mismatch", async () => {
    const signer = mockSigner(ARBITER);
    const verifier = passingVerifier(ARBITER);
    const signed = await createSignedResolution(signer, sampleResolution);
    const result = await verifyResolution(
      verifier,
      signed,
      "0xnotthearbiter000000000000000000000000abcd",
    );
    expect(result.valid).toBe(false);
  });

  it("verifyDispute throws on JWS format", async () => {
    await expect(
      verifyDispute(failingVerifier, { format: "jws", signature: "0x" }),
    ).rejects.toThrow(/JWS format is reserved/);
  });
});

// ===========================================================================
// Time windows + envelope expiry
// ===========================================================================

describe("Envelope expiry", () => {
  it("isDisputeExpired returns false for future validUntil", () => {
    const signed: EIP712Dispute = {
      format: "eip712",
      payload: { ...sampleDispute, validUntil: NOW + 100 },
      signature: "0x",
    };
    expect(isDisputeExpired(signed, NOW)).toBe(false);
  });

  it("isDisputeExpired returns true for past validUntil", () => {
    const signed: EIP712Dispute = {
      format: "eip712",
      payload: { ...sampleDispute, validUntil: NOW - 100 },
      signature: "0x",
    };
    expect(isDisputeExpired(signed, NOW)).toBe(true);
  });

  it("isDisputeExpired uses current time when now is omitted", () => {
    const signed: EIP712Dispute = {
      format: "eip712",
      payload: {
        ...sampleDispute,
        validUntil: Math.floor(Date.now() / 1000) - 100,
      },
      signature: "0x",
    };
    expect(isDisputeExpired(signed)).toBe(true);
  });
});

// ===========================================================================
// Verdict ↔ amount consistency (spec §Verification rule 3 on resolution)
// ===========================================================================

describe("Verdict ↔ amount consistency", () => {
  const make = (verdict: string, settled: string) =>
    ({
      format: "eip712",
      payload: { ...sampleResolution, verdict, settledAmount: settled },
      signature: "0x",
    }) as never;

  it("denied/void require settledAmount == 0", () => {
    expect(isVerdictAmountConsistent(make("denied", "0"), "1000000")).toBe(true);
    expect(isVerdictAmountConsistent(make("denied", "1"), "1000000")).toBe(false);
    expect(isVerdictAmountConsistent(make("void", "0"), "1000000")).toBe(true);
    expect(isVerdictAmountConsistent(make("void", "1"), "1000000")).toBe(false);
  });

  it("upheld_full requires settledAmount == requestedAmount", () => {
    expect(isVerdictAmountConsistent(make("upheld_full", "1000000"), "1000000"))
      .toBe(true);
    expect(isVerdictAmountConsistent(make("upheld_full", "500000"), "1000000"))
      .toBe(false);
    expect(isVerdictAmountConsistent(make("upheld_full", "1000001"), "1000000"))
      .toBe(false);
  });

  it("upheld_partial requires 0 < settledAmount <= requestedAmount", () => {
    expect(
      isVerdictAmountConsistent(make("upheld_partial", "500000"), "1000000"),
    ).toBe(true);
    expect(isVerdictAmountConsistent(make("upheld_partial", "0"), "1000000"))
      .toBe(false);
    expect(
      isVerdictAmountConsistent(make("upheld_partial", "1000001"), "1000000"),
    ).toBe(false);
  });

  it("unknown verdict is inconsistent", () => {
    expect(isVerdictAmountConsistent(make("rogue_value", "0"), "0")).toBe(false);
  });
});

// ===========================================================================
// Client helpers
// ===========================================================================

describe("Client helpers", () => {
  it("buildDisputePayload sets defaults", () => {
    const built = buildDisputePayload({
      receiptHash: sampleReceiptHash,
      reason: "not_delivered",
      requestedAmount: "1000000",
    });
    expect(built.version).toBe(1);
    expect(built.reason).toBe("not_delivered");
    expect(built.validUntil).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(built.evidence).toBeUndefined();
  });

  it("buildDisputePayload preserves explicit validUntil + evidence", () => {
    const built = buildDisputePayload({
      receiptHash: sampleReceiptHash,
      reason: "quality_issue",
      requestedAmount: "500000",
      evidence: ["ipfs://X"],
      validUntil: 12345,
      version: 2,
    });
    expect(built.validUntil).toBe(12345);
    expect(built.evidence).toEqual(["ipfs://X"]);
    expect(built.version).toBe(2);
  });

  it("buildAndSignDispute signs in one call", async () => {
    const signer = mockSigner(PAYER);
    const signed = await buildAndSignDispute(signer, {
      receiptHash: sampleReceiptHash,
      reason: "not_delivered",
      requestedAmount: "1000000",
    });
    expect(signed.format).toBe("eip712");
  });

  it("extractDisputeTerms parses 402 extension block", () => {
    const extensions = {
      dispute: { info: sampleTerms },
    };
    const terms = extractDisputeTerms(extensions);
    expect(terms).toEqual(sampleTerms);
  });

  it("extractDisputeTerms returns undefined when missing", () => {
    expect(extractDisputeTerms(undefined)).toBeUndefined();
    expect(extractDisputeTerms({})).toBeUndefined();
    expect(extractDisputeTerms({ other: {} })).toBeUndefined();
  });

  it("buildDisputeSubmissionBody wraps signed dispute in transport shape", async () => {
    const signer = mockSigner(PAYER);
    const signed = await createSignedDispute(signer, sampleDispute);
    const body = buildDisputeSubmissionBody(signed);
    expect(body.extensions.dispute.info.submission).toEqual(signed);
  });
});

// ===========================================================================
// Server helpers
// ===========================================================================

describe("Server: buildDisputeRequirements", () => {
  it("builds a valid requirements block", () => {
    const req = buildDisputeRequirements(sampleTerms);
    expect(req.info.arbiter).toBe(ARBITER);
    expect(req.info.arbiterScheme).toBe("facilitator");
    expect(req.info.disputeWindow).toBe(86_400 * 7);
    expect(req.info.supportedReasons).toContain("not_delivered");
    expect(req.info.evidenceUriSchemes).toEqual([
      "ipfs",
      "arweave",
      "https",
    ]);
  });

  it("rejects unknown arbiterScheme", () => {
    expect(() =>
      buildDisputeRequirements({
        ...sampleTerms,
        arbiterScheme: "invalid" as never,
      }),
    ).toThrow(/unsupported arbiterScheme/);
  });

  it("rejects non-positive disputeWindow", () => {
    expect(() =>
      buildDisputeRequirements({ ...sampleTerms, disputeWindow: 0 }),
    ).toThrow(/disputeWindow must be positive/);
  });

  it("rejects empty supportedReasons", () => {
    expect(() =>
      buildDisputeRequirements({ ...sampleTerms, supportedReasons: [] }),
    ).toThrow(/supportedReasons must not be empty/);
  });
});

describe("Server: parseDisputeSubmission", () => {
  it("parses a well-formed submission body", async () => {
    const signer = mockSigner(PAYER);
    const signed = await createSignedDispute(signer, sampleDispute);
    const body = buildDisputeSubmissionBody(signed);
    const parsed = parseDisputeSubmission(body);
    expect(parsed).toEqual(signed);
  });

  it("returns undefined for malformed input", () => {
    expect(parseDisputeSubmission(null)).toBeUndefined();
    expect(parseDisputeSubmission({})).toBeUndefined();
    expect(parseDisputeSubmission({ extensions: {} })).toBeUndefined();
    expect(parseDisputeSubmission({ extensions: { dispute: {} } }))
      .toBeUndefined();
    expect(
      parseDisputeSubmission({ extensions: { dispute: { info: {} } } }),
    ).toBeUndefined();
  });
});

describe("Server: validateDispute (the seven-step pipeline)", () => {
  const receiptCtx = {
    issuedAt: NOW - 60,
    hash: sampleReceiptHash,
    amount: "1000000",
  };

  it("passes a well-formed dispute", async () => {
    const signer = mockSigner(PAYER);
    const verifier = passingVerifier(PAYER);
    const signed = await createSignedDispute(signer, sampleDispute);
    const result = await validateDispute({
      verifier,
      dispute: signed,
      receipt: receiptCtx,
      terms: sampleTerms,
      now: NOW,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects bad signature", async () => {
    const signer = mockSigner(PAYER);
    const signed = await createSignedDispute(signer, sampleDispute);
    const result = await validateDispute({
      verifier: failingVerifier,
      dispute: signed,
      receipt: receiptCtx,
      terms: sampleTerms,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("dispute_invalid_signature");
  });

  it("rejects expired envelope (validUntil < now)", async () => {
    const signer = mockSigner(PAYER);
    const verifier = passingVerifier(PAYER);
    const signed = await createSignedDispute(signer, {
      ...sampleDispute,
      validUntil: NOW - 1,
    });
    const result = await validateDispute({
      verifier,
      dispute: signed,
      receipt: receiptCtx,
      terms: sampleTerms,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("dispute_expired");
  });

  it("rejects receipt-hash mismatch", async () => {
    const signer = mockSigner(PAYER);
    const verifier = passingVerifier(PAYER);
    const signed = await createSignedDispute(signer, {
      ...sampleDispute,
      receiptHash: "0xdifferenthash" + "0".repeat(52),
    });
    const result = await validateDispute({
      verifier,
      dispute: signed,
      receipt: receiptCtx,
      terms: sampleTerms,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("dispute_unknown_receipt");
  });

  it("rejects out-of-window dispute (past disputeWindow)", async () => {
    const signer = mockSigner(PAYER);
    const verifier = passingVerifier(PAYER);
    const signed = await createSignedDispute(signer, sampleDispute);
    const ctx = {
      ...receiptCtx,
      issuedAt: NOW - sampleTerms.disputeWindow - 100, // already past
    };
    const result = await validateDispute({
      verifier,
      dispute: signed,
      receipt: ctx,
      terms: sampleTerms,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("dispute_out_of_window");
  });

  it("rejects unsupported reason", async () => {
    const signer = mockSigner(PAYER);
    const verifier = passingVerifier(PAYER);
    const signed = await createSignedDispute(signer, {
      ...sampleDispute,
      reason: "duplicate_charge",
    });
    const result = await validateDispute({
      verifier,
      dispute: signed,
      receipt: receiptCtx,
      terms: sampleTerms, // supports only not_delivered/partial_delivery/quality_issue
      now: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("dispute_invalid_reason");
  });

  it("accepts custom x_* reason when listed", async () => {
    const signer = mockSigner(PAYER);
    const verifier = passingVerifier(PAYER);
    const signed = await createSignedDispute(signer, {
      ...sampleDispute,
      reason: "x_gdpr_violation",
    });
    const termsWithCustom: DisputeTermsInfo = {
      ...sampleTerms,
      supportedReasons: ["not_delivered", "x_gdpr_violation"],
    };
    const result = await validateDispute({
      verifier,
      dispute: signed,
      receipt: receiptCtx,
      terms: termsWithCustom,
      now: NOW,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects requestedAmount > receipt.amount", async () => {
    const signer = mockSigner(PAYER);
    const verifier = passingVerifier(PAYER);
    const signed = await createSignedDispute(signer, {
      ...sampleDispute,
      requestedAmount: "1000001",
    });
    const result = await validateDispute({
      verifier,
      dispute: signed,
      receipt: receiptCtx,
      terms: sampleTerms,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("dispute_amount_exceeds_receipt");
  });

  it("rejects evidence URI with disallowed scheme", async () => {
    const signer = mockSigner(PAYER);
    const verifier = passingVerifier(PAYER);
    const signed = await createSignedDispute(signer, {
      ...sampleDispute,
      evidence: ["ftp://server/evidence.json"],
    });
    const result = await validateDispute({
      verifier,
      dispute: signed,
      receipt: receiptCtx,
      terms: sampleTerms,
      now: NOW,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("dispute_evidence_uri_unsupported");
  });
});

describe("Server: validateResolution", () => {
  it("accepts a well-formed resolution", async () => {
    const signer = mockSigner(ARBITER);
    const arbiterVerifier = passingVerifier(ARBITER);
    const signedResolution = await createSignedResolution(
      signer,
      sampleResolution,
    );
    const signedDispute = await createSignedDispute(
      mockSigner(PAYER),
      sampleDispute,
    );
    const result = await validateResolution({
      verifier: arbiterVerifier,
      resolution: signedResolution,
      dispute: signedDispute,
      disputeHash: sampleDisputeHash,
      expectedArbiter: ARBITER,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects arbiter signature mismatch", async () => {
    const signer = mockSigner(ARBITER);
    const wrongArbiterVerifier = passingVerifier(
      "0xwrongarbiter00000000000000000000000000ab",
    );
    const signedResolution = await createSignedResolution(
      signer,
      sampleResolution,
    );
    const signedDispute = await createSignedDispute(
      mockSigner(PAYER),
      sampleDispute,
    );
    const result = await validateResolution({
      verifier: wrongArbiterVerifier,
      resolution: signedResolution,
      dispute: signedDispute,
      disputeHash: sampleDisputeHash,
      expectedArbiter: ARBITER,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("resolution_invalid_signature");
  });

  it("rejects disputeHash mismatch", async () => {
    const signer = mockSigner(ARBITER);
    const arbiterVerifier = passingVerifier(ARBITER);
    const signedResolution = await createSignedResolution(signer, {
      ...sampleResolution,
      disputeHash: "0xwronghash" + "0".repeat(56),
    });
    const signedDispute = await createSignedDispute(
      mockSigner(PAYER),
      sampleDispute,
    );
    const result = await validateResolution({
      verifier: arbiterVerifier,
      resolution: signedResolution,
      dispute: signedDispute,
      disputeHash: sampleDisputeHash,
      expectedArbiter: ARBITER,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("resolution_unknown_dispute");
  });

  it("rejects payload-arbiter ↔ expected mismatch", async () => {
    const signer = mockSigner(ARBITER);
    const arbiterVerifier = passingVerifier(ARBITER);
    const signedResolution = await createSignedResolution(signer, {
      ...sampleResolution,
      arbiter: "0xdifferent0000000000000000000000000000ab12",
    });
    const signedDispute = await createSignedDispute(
      mockSigner(PAYER),
      sampleDispute,
    );
    const result = await validateResolution({
      verifier: arbiterVerifier,
      resolution: signedResolution,
      dispute: signedDispute,
      disputeHash: sampleDisputeHash,
      expectedArbiter: ARBITER,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("resolution_arbiter_mismatch");
  });

  it("rejects verdict ↔ settledAmount inconsistency", async () => {
    const signer = mockSigner(ARBITER);
    const arbiterVerifier = passingVerifier(ARBITER);
    const signedResolution = await createSignedResolution(signer, {
      ...sampleResolution,
      verdict: "denied",
      settledAmount: "1000000", // denied requires 0
    });
    const signedDispute = await createSignedDispute(
      mockSigner(PAYER),
      sampleDispute,
    );
    const result = await validateResolution({
      verifier: arbiterVerifier,
      resolution: signedResolution,
      dispute: signedDispute,
      disputeHash: sampleDisputeHash,
      expectedArbiter: ARBITER,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("resolution_verdict_amount_inconsistent");
  });
});

// ===========================================================================
// Server helper utilities
// ===========================================================================

describe("Server utility predicates", () => {
  it("isReasonSupported", () => {
    expect(isReasonSupported("not_delivered", ["not_delivered"])).toBe(true);
    expect(isReasonSupported("x_custom", ["x_custom"])).toBe(true);
    expect(isReasonSupported("not_delivered", ["quality_issue"])).toBe(false);
  });

  it("isEvidenceUriAllowed", () => {
    expect(isEvidenceUriAllowed("ipfs://hash", ["ipfs"])).toBe(true);
    expect(isEvidenceUriAllowed("ftp://server", ["ipfs", "arweave"]))
      .toBe(false);
    expect(isEvidenceUriAllowed("plaintext-no-colon", ["ipfs"])).toBe(false);
  });

  it("packageResolutionResponse wraps signed resolution", async () => {
    const signer = mockSigner(ARBITER);
    const signedResolution = await createSignedResolution(
      signer,
      sampleResolution,
    );
    const pkg = packageResolutionResponse(signedResolution);
    expect(pkg.info.resolution).toEqual(signedResolution);
  });
});

// ===========================================================================
// Facilitator
// ===========================================================================

describe("Facilitator handler", () => {
  it("createDisputeFacilitatorHandler uses signer address as arbiter", () => {
    const handler = createDisputeFacilitatorHandler(mockSigner(ARBITER));
    expect(handler.getArbiterAddress()).toBe(ARBITER);
  });

  it("resolveDispute signs a resolution with handler's address", async () => {
    const handler = createDisputeFacilitatorHandler(mockSigner(ARBITER));
    const signed = await handler.resolveDispute({
      disputeHash: sampleDisputeHash,
      verdict: "upheld_full",
      settledAmount: "1000000",
    });
    expect(signed.format).toBe("eip712");
    if (signed.format !== "eip712") return;
    expect(signed.payload.arbiter).toBe(ARBITER);
    expect(signed.payload.verdict).toBe("upheld_full");
    expect(signed.payload.disputeHash).toBe(sampleDisputeHash);
  });

  it("buildFacilitatorResolution one-call helper", async () => {
    const handler = createDisputeFacilitatorHandler(mockSigner(ARBITER));
    const signedDispute = await createSignedDispute(
      mockSigner(PAYER),
      sampleDispute,
    );
    const signedResolution = await buildFacilitatorResolution(
      handler,
      signedDispute,
      sampleDisputeHash,
      "denied",
      "0",
    );
    expect(signedResolution.format).toBe("eip712");
    if (signedResolution.format !== "eip712") return;
    expect(signedResolution.payload.verdict).toBe("denied");
    expect(signedResolution.payload.settledAmount).toBe("0");
  });
});
