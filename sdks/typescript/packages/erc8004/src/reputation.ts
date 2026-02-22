import type {
  Address,
  ERC8004ReadClient,
  ReputationSummary,
  FeedbackFile,
  AgentRegistryId,
  ProofOfPayment,
} from "./types";
import { reputationRegistryAbi } from "./abis";

/**
 * Get a reputation summary for an agent from trusted reviewers.
 *
 * Queries the on-chain Reputation Registry and normalizes the result
 * to a 0-100 score. Requires explicit `trustedReviewers` for Sybil resistance.
 *
 * @param client - Read-only client for contract calls
 * @param reputationRegistry - Reputation Registry contract address
 * @param agentId - Agent's on-chain ID
 * @param trustedReviewers - Addresses whose feedback is trusted
 * @param tag1 - Optional primary tag filter
 * @param tag2 - Optional secondary tag filter
 * @returns Reputation summary with normalized 0-100 score
 */
export async function getReputationSummary(
  client: ERC8004ReadClient,
  reputationRegistry: Address,
  agentId: bigint,
  trustedReviewers: Address[],
  tag1: string = "",
  tag2: string = "",
): Promise<ReputationSummary> {
  const result = (await client.readContract({
    address: reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: "getSummary",
    args: [agentId, trustedReviewers, tag1, tag2],
  })) as [bigint, bigint, number];

  const [count, summaryValue, summaryValueDecimals] = result;

  // Normalize to 0-100 scale
  const divisor = 10 ** summaryValueDecimals;
  const normalizedScore =
    count > 0n
      ? Math.min(100, Math.max(0, Number(summaryValue) / divisor))
      : 0;

  return {
    agentId,
    count,
    summaryValue,
    summaryValueDecimals,
    normalizedScore,
  };
}

/**
 * Build an off-chain feedback file with optional proofOfPayment.
 *
 * Creates a structured feedback file object ready for JSON serialization
 * and hosting at a feedbackURI. Used by the afterSettle hook to link
 * on-chain feedback records to off-chain payment proof.
 *
 * @param agentId - Agent's numeric ID
 * @param agentRegistry - Registry identifier
 * @param clientAddress - Address of the feedback submitter
 * @param value - Feedback value (e.g. 100 for positive)
 * @param valueDecimals - Decimal precision for value
 * @param tag1 - Primary classification tag
 * @param tag2 - Secondary classification tag
 * @param proofOfPayment - Optional payment proof from settlement
 * @returns Feedback file object
 */
export function buildFeedbackFile(
  agentId: number,
  agentRegistry: AgentRegistryId,
  clientAddress: string,
  value: number,
  valueDecimals: number,
  tag1: string,
  tag2: string,
  proofOfPayment?: ProofOfPayment,
): FeedbackFile {
  return {
    agentRegistry,
    agentId,
    clientAddress,
    createdAt: new Date().toISOString(),
    value,
    valueDecimals,
    tag1,
    tag2,
    ...(proofOfPayment && { proofOfPayment }),
  };
}
