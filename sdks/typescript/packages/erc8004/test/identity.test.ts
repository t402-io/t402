import { describe, it, expect, vi } from "vitest";
import {
  parseAgentRegistry,
  getAgentIdentity,
  fetchRegistrationFile,
  resolveAgent,
  verifyPayToMatchesAgent,
} from "../src/identity";
import type { ERC8004ReadClient, RegistrationFile } from "../src/types";

describe("parseAgentRegistry", () => {
  it("parses valid registry ID", () => {
    const result = parseAgentRegistry(
      "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD05",
    );
    expect(result.namespace).toBe("eip155");
    expect(result.chainId).toBe("8453");
    expect(result.address).toBe(
      "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD05",
    );
    expect(result.id).toBe(
      "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD05",
    );
  });

  it("parses Ethereum mainnet registry ID", () => {
    const result = parseAgentRegistry("eip155:1:0xAbCd1234567890");
    expect(result.namespace).toBe("eip155");
    expect(result.chainId).toBe("1");
    expect(result.address).toBe("0xAbCd1234567890");
  });

  it("throws on too few parts", () => {
    expect(() => parseAgentRegistry("eip155:8453" as `${string}:${string}:${string}`)).toThrow(
      "Invalid agent registry ID",
    );
  });

  it("throws on single part", () => {
    expect(() => parseAgentRegistry("invalid" as `${string}:${string}:${string}`)).toThrow(
      "Invalid agent registry ID",
    );
  });
});

describe("getAgentIdentity", () => {
  it("reads identity from contract", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValueOnce("0xWalletAddress1234567890abcdef")
        .mockResolvedValueOnce("0xOwnerAddress1234567890abcdef0")
        .mockResolvedValueOnce("https://agent.example.com/registration.json"),
    };

    const identity = await getAgentIdentity(
      mockClient,
      "0xRegistryAddress",
      42n,
      "eip155:8453:0xRegistryAddress",
    );

    expect(identity.agentId).toBe(42n);
    expect(identity.agentWallet).toBe("0xWalletAddress1234567890abcdef");
    expect(identity.owner).toBe("0xOwnerAddress1234567890abcdef0");
    expect(identity.agentURI).toBe(
      "https://agent.example.com/registration.json",
    );
    expect(identity.registry.namespace).toBe("eip155");
    expect(identity.registry.chainId).toBe("8453");
    expect(mockClient.readContract).toHaveBeenCalledTimes(3);
  });

  it("calls correct contract functions", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi.fn().mockResolvedValue("0x0"),
    };

    await getAgentIdentity(
      mockClient,
      "0xRegistry",
      1n,
      "eip155:1:0xRegistry",
    );

    const calls = (mockClient.readContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls[0][0].functionName).toBe("getAgentWallet");
    expect(calls[1][0].functionName).toBe("ownerOf");
    expect(calls[2][0].functionName).toBe("tokenURI");
  });
});

describe("fetchRegistrationFile", () => {
  it("fetches and parses registration JSON", async () => {
    const mockRegistration: RegistrationFile = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: "Test Agent",
      services: [
        { name: "A2A", endpoint: "https://agent.example.com/a2a" },
      ],
      x402Support: true,
      active: true,
      registrations: [
        { agentId: 42, agentRegistry: "eip155:8453:0xRegistry" },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRegistration),
      }),
    );

    const result = await fetchRegistrationFile(
      "https://agent.example.com/registration.json",
    );
    expect(result.name).toBe("Test Agent");
    expect(result.x402Support).toBe(true);
    expect(result.services).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );

    await expect(
      fetchRegistrationFile("https://agent.example.com/not-found"),
    ).rejects.toThrow("Failed to fetch registration file");

    vi.unstubAllGlobals();
  });
});

describe("resolveAgent", () => {
  it("combines identity and registration", async () => {
    const mockRegistration: RegistrationFile = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: "Resolved Agent",
      services: [],
      x402Support: true,
      active: true,
      registrations: [],
    };

    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValueOnce("0xWallet")
        .mockResolvedValueOnce("0xOwner")
        .mockResolvedValueOnce("https://agent.example.com/reg.json"),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRegistration),
      }),
    );

    const agent = await resolveAgent(
      mockClient,
      "0xRegistry",
      42n,
      "eip155:8453:0xRegistry",
    );

    expect(agent.agentId).toBe(42n);
    expect(agent.agentWallet).toBe("0xWallet");
    expect(agent.registration.name).toBe("Resolved Agent");
    expect(agent.registration.x402Support).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe("verifyPayToMatchesAgent", () => {
  it("returns true when addresses match (case-insensitive)", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"),
    };

    const result = await verifyPayToMatchesAgent(
      mockClient,
      "0xRegistry",
      42n,
      "0xabcdef1234567890abcdef1234567890abcdef12",
    );

    expect(result).toBe(true);
  });

  it("returns false when addresses differ", async () => {
    const mockClient: ERC8004ReadClient = {
      readContract: vi
        .fn()
        .mockResolvedValue("0x1111111111111111111111111111111111111111"),
    };

    const result = await verifyPayToMatchesAgent(
      mockClient,
      "0xRegistry",
      42n,
      "0x2222222222222222222222222222222222222222",
    );

    expect(result).toBe(false);
  });
});
