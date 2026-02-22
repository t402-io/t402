import type {
  Address,
  Hex,
  Bytes32,
  ERC8004ReadClient,
  ERC8004WriteClient,
  ValidationRequestParams,
  ValidationStatus,
  ValidationSummary,
} from "./types";
import { validationRegistryAbi } from "./abis";

/**
 * Submit a validation request for agent work.
 *
 * Calls `validationRequest` on the Validation Registry contract
 * to request validation of an agent's output by a specific validator.
 *
 * @param client - Write-capable client
 * @param validationRegistry - Validation Registry contract address
 * @param params - Validation request parameters
 * @returns Transaction hash
 */
export async function submitValidationRequest(
  client: ERC8004WriteClient,
  validationRegistry: Address,
  params: ValidationRequestParams,
): Promise<Hex> {
  return client.writeContract({
    address: validationRegistry,
    abi: validationRegistryAbi,
    functionName: "validationRequest",
    args: [
      params.validatorAddress,
      params.agentId,
      params.requestURI,
      params.requestHash,
    ],
  });
}

/**
 * Get validation status for a specific request.
 *
 * Queries the on-chain Validation Registry for the current status
 * of a validation request identified by its request hash.
 *
 * @param client - Read-only client
 * @param validationRegistry - Validation Registry contract address
 * @param requestHash - Keccak256 hash of the validation request
 * @returns Validation status
 */
export async function getValidationStatus(
  client: ERC8004ReadClient,
  validationRegistry: Address,
  requestHash: Bytes32,
): Promise<ValidationStatus> {
  const result = (await client.readContract({
    address: validationRegistry,
    abi: validationRegistryAbi,
    functionName: "getValidationStatus",
    args: [requestHash],
  })) as [Address, bigint, number, Bytes32, string, bigint];

  return {
    validatorAddress: result[0],
    agentId: result[1],
    response: result[2],
    responseHash: result[3],
    tag: result[4],
    lastUpdate: result[5],
  };
}

/**
 * Get aggregated validation summary for an agent.
 *
 * Queries the on-chain Validation Registry for the average validation
 * score across trusted validators.
 *
 * @param client - Read-only client
 * @param validationRegistry - Validation Registry contract address
 * @param agentId - Agent's ID
 * @param validatorAddresses - Addresses of trusted validators
 * @param tag - Optional tag filter
 * @returns Validation summary with count and average score
 */
export async function getValidationSummary(
  client: ERC8004ReadClient,
  validationRegistry: Address,
  agentId: bigint,
  validatorAddresses: Address[],
  tag: string = "",
): Promise<ValidationSummary> {
  const result = (await client.readContract({
    address: validationRegistry,
    abi: validationRegistryAbi,
    functionName: "getSummary",
    args: [agentId, validatorAddresses, tag],
  })) as [bigint, number];

  return {
    count: result[0],
    averageResponse: result[1],
  };
}
