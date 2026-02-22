import { describe, it, expect, vi } from "vitest";
import {
  declareERC8004Extension,
  getERC8004Extension,
  createERC8004PayloadExtension,
  verifyAgentIdentity,
  erc8004ResourceServerExtension,
} from "../src/extension";
import { ERC8004_EXTENSION_KEY } from "../src/constants";
import type { PaymentRequired } from "@t402/core/types";
import type { ERC8004ReadClient } from "../src/types";

describe("declareERC8004Extension", () => {
  it("creates extension with required fields", () => {
    const ext = declareERC8004Extension(42, "eip155:8453:0xRegistry");
    expect(ext.agentId).toBe(42);
    expect(ext.agentRegistry).toBe("eip155:8453:0xRegistry");
    expect(ext.agentWallet).toBeUndefined();
  });

  it("includes optional agentWallet", () => {
    const ext = declareERC8004Extension(
      42,
      "eip155:8453:0xRegistry",
      "0xWallet",
    );
    expect(ext.agentWallet).toBe("0xWallet");
  });
});

describe("getERC8004Extension", () => {
  it("extracts extension from PaymentRequired", () => {
    const pr: PaymentRequired = {
      t402Version: 2,
      resource: { url: "https://api.example.com/data" },
      accepts: [],
      extensions: {
        [ERC8004_EXTENSION_KEY]: {
          agentId: 42,
          agentRegistry: "eip155:8453:0xRegistry",
        },
      },
    };

    const ext = getERC8004Extension(pr);
    expect(ext).toBeDefined();
    expect(ext!.agentId).toBe(42);
    expect(ext!.agentRegistry).toBe("eip155:8453:0xRegistry");
  });

  it("returns undefined when no extension", () => {
    const pr: PaymentRequired = {
      t402Version: 2,
      resource: { url: "https://api.example.com/data" },
      accepts: [],
    };

    expect(getERC8004Extension(pr)).toBeUndefined();
  });

  it("returns undefined when different extension key", () => {
    const pr: PaymentRequired = {
      t402Version: 2,
      resource: { url: "https://api.example.com/data" },
      accepts: [],
      extensions: { bazaar: { info: {} } },
    };

    expect(getERC8004Extension(pr)).toBeUndefined();
  });
});

describe("createERC8004PayloadExtension", () => {
  it("creates verified payload extension", () => {
    const ext = createERC8004PayloadExtension(
      42,
      "eip155:8453:0xRegistry",
      true,
    );
    expect(ext.identityVerified).toBe(true);
    expect(ext.agentId).toBe(42);
    expect(ext.agentRegistry).toBe("eip155:8453:0xRegistry");
  });

  it("creates unverified payload extension", () => {
    const ext = createERC8004PayloadExtension(
      42,
      "eip155:8453:0xRegistry",
      false,
    );
    expect(ext.identityVerified).toBe(false);
  });
});

describe("verifyAgentIdentity", () => {
  it("returns true when payTo matches agentWallet", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"),
    };

    const pr: PaymentRequired = {
      t402Version: 2,
      resource: { url: "https://api.example.com/data" },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          asset: "USDT",
          amount: "1000000",
          payTo: "0xabcdef1234567890abcdef1234567890abcdef12",
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
      extensions: {
        [ERC8004_EXTENSION_KEY]: {
          agentId: 42,
          agentRegistry: "eip155:8453:0xRegistry",
        },
      },
    };

    const result = await verifyAgentIdentity(mockClient, pr);
    expect(result).toBe(true);
  });

  it("returns false when payTo does not match", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0x1111111111111111111111111111111111111111"),
    };

    const pr: PaymentRequired = {
      t402Version: 2,
      resource: { url: "https://api.example.com/data" },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          asset: "USDT",
          amount: "1000000",
          payTo: "0x2222222222222222222222222222222222222222",
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
      extensions: {
        [ERC8004_EXTENSION_KEY]: {
          agentId: 42,
          agentRegistry: "eip155:8453:0xRegistry",
        },
      },
    };

    const result = await verifyAgentIdentity(mockClient, pr);
    expect(result).toBe(false);
  });

  it("returns false when no ERC-8004 extension present", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn(),
    };

    const pr: PaymentRequired = {
      t402Version: 2,
      resource: { url: "https://api.example.com/data" },
      accepts: [],
    };

    const result = await verifyAgentIdentity(mockClient, pr);
    expect(result).toBe(false);
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });

  it("verifies all accepts entries", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"),
    };

    const pr: PaymentRequired = {
      t402Version: 2,
      resource: { url: "https://api.example.com/data" },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          asset: "USDT",
          amount: "1000000",
          payTo: "0xabcdef1234567890abcdef1234567890abcdef12",
          maxTimeoutSeconds: 300,
          extra: {},
        },
        {
          scheme: "exact",
          network: "eip155:1",
          asset: "USDT",
          amount: "1000000",
          payTo: "0xabcdef1234567890abcdef1234567890abcdef12",
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
      extensions: {
        [ERC8004_EXTENSION_KEY]: {
          agentId: 42,
          agentRegistry: "eip155:8453:0xRegistry",
        },
      },
    };

    const result = await verifyAgentIdentity(mockClient, pr);
    expect(result).toBe(true);
    expect(mockClient.readContract).toHaveBeenCalledTimes(2);
  });
});

describe("erc8004ResourceServerExtension", () => {
  it("enriches declaration with live reputation", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue([10n, 85n, 0]),
    };

    const ext = erc8004ResourceServerExtension({
      client: mockClient,
      reputationRegistry: "0xReputationRegistry",
      trustedReviewers: ["0xReviewer1"],
    });

    expect(ext.key).toBe(ERC8004_EXTENSION_KEY);

    const declaration = { agentId: 42, agentRegistry: "eip155:8453:0xRegistry" };
    const enriched = await ext.enrichDeclaration!(declaration, {});

    expect(enriched).toEqual({
      agentId: 42,
      agentRegistry: "eip155:8453:0xRegistry",
      reputationScore: 85,
      feedbackCount: 10,
    });
  });

  it("passes through when no reputation config", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn(),
    };

    const ext = erc8004ResourceServerExtension({
      client: mockClient,
    });

    const declaration = { agentId: 42, agentRegistry: "eip155:8453:0xRegistry" };
    const enriched = await ext.enrichDeclaration!(declaration, {});

    expect(enriched).toEqual(declaration);
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });

  it("passes through when no trusted reviewers", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn(),
    };

    const ext = erc8004ResourceServerExtension({
      client: mockClient,
      reputationRegistry: "0xReputationRegistry",
      trustedReviewers: [],
    });

    const declaration = { agentId: 42, agentRegistry: "eip155:8453:0xRegistry" };
    const enriched = await ext.enrichDeclaration!(declaration, {});

    expect(enriched).toEqual(declaration);
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });
});
