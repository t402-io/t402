import type {
  Address,
  AgentIdentity,
  AgentRegistry,
  AgentRegistryId,
  ERC8004ReadClient,
  ResolvedAgent,
  RegistrationFile,
} from "./types";
import { identityRegistryAbi } from "./abis";

/**
 * Parse an agent registry ID string into components.
 *
 * @param registryId - Format: "{namespace}:{chainId}:{address}"
 * @returns Parsed AgentRegistry
 *
 * @example
 * parseAgentRegistry("eip155:8453:0x742d35Cc...")
 * // => { namespace: "eip155", chainId: "8453", address: "0x742d35Cc...", id: "eip155:8453:0x742d35Cc..." }
 */
export function parseAgentRegistry(registryId: AgentRegistryId): AgentRegistry {
  const parts = registryId.split(":");
  if (parts.length < 3) {
    throw new Error(
      `Invalid agent registry ID: ${registryId}. Expected format: namespace:chainId:address`,
    );
  }
  // Address may contain colons (unlikely but handle gracefully) — rejoin everything after first two parts
  const namespace = parts[0]!;
  const chainId = parts[1]!;
  const address = parts.slice(2).join(":") as Address;

  if (!namespace || !chainId || !address) {
    throw new Error(
      `Invalid agent registry ID: ${registryId}. All parts must be non-empty`,
    );
  }

  return { namespace, chainId, address, id: registryId };
}

/**
 * Resolve an agent's on-chain identity from the Identity Registry.
 *
 * Reads agentWallet, owner, and tokenURI from the contract.
 *
 * @param client - Read-only client for contract calls
 * @param identityRegistry - Identity Registry contract address
 * @param agentId - Agent's NFT token ID
 * @param registryId - Full agent registry identifier
 * @returns Agent identity with wallet, owner, and URI
 */
export async function getAgentIdentity(
  client: ERC8004ReadClient,
  identityRegistry: Address,
  agentId: bigint,
  registryId: AgentRegistryId,
): Promise<AgentIdentity> {
  const [agentWallet, owner, agentURI] = await Promise.all([
    client.readContract({
      address: identityRegistry,
      abi: identityRegistryAbi,
      functionName: "getAgentWallet",
      args: [agentId],
    }) as Promise<Address>,
    client.readContract({
      address: identityRegistry,
      abi: identityRegistryAbi,
      functionName: "ownerOf",
      args: [agentId],
    }) as Promise<Address>,
    client.readContract({
      address: identityRegistry,
      abi: identityRegistryAbi,
      functionName: "tokenURI",
      args: [agentId],
    }) as Promise<string>,
  ]);

  return {
    agentId,
    owner,
    agentURI,
    agentWallet,
    registry: parseAgentRegistry(registryId),
  };
}

/**
 * Fetch and parse the agent's registration file from their agentURI.
 *
 * @param agentURI - URI pointing to the registration JSON file
 * @returns Parsed registration file
 * @throws If the URI is not reachable or the file is malformed
 */
export async function fetchRegistrationFile(
  agentURI: string,
): Promise<RegistrationFile> {
  const response = await fetch(agentURI);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch registration file from ${agentURI}: ${response.status}`,
    );
  }
  return response.json() as Promise<RegistrationFile>;
}

/**
 * Resolve an agent: fetch on-chain identity + off-chain registration file.
 *
 * @param client - Read-only client for contract calls
 * @param identityRegistry - Identity Registry contract address
 * @param agentId - Agent's NFT token ID
 * @param registryId - Full agent registry identifier
 * @returns Fully resolved agent with registration file
 *
 * @example
 * const agent = await resolveAgent(viemClient, registryAddr, 42n, "eip155:8453:0x...");
 * if (agent.agentWallet !== paymentRequirements.payTo) {
 *   throw new Error("Payment address mismatch");
 * }
 */
export async function resolveAgent(
  client: ERC8004ReadClient,
  identityRegistry: Address,
  agentId: bigint,
  registryId: AgentRegistryId,
): Promise<ResolvedAgent> {
  const identity = await getAgentIdentity(
    client,
    identityRegistry,
    agentId,
    registryId,
  );
  const registration = await fetchRegistrationFile(identity.agentURI);

  return { ...identity, registration };
}

/**
 * Verify that a payTo address matches the on-chain agentWallet.
 *
 * @param client - Read-only client for contract calls
 * @param identityRegistry - Identity Registry contract address
 * @param agentId - Agent's NFT token ID
 * @param payTo - Address from PaymentRequirements.payTo
 * @returns Whether the payTo address matches the on-chain agentWallet
 */
export async function verifyPayToMatchesAgent(
  client: ERC8004ReadClient,
  identityRegistry: Address,
  agentId: bigint,
  payTo: string,
): Promise<boolean> {
  const agentWallet = (await client.readContract({
    address: identityRegistry,
    abi: identityRegistryAbi,
    functionName: "getAgentWallet",
    args: [agentId],
  })) as Address;

  return agentWallet.toLowerCase() === payTo.toLowerCase();
}
