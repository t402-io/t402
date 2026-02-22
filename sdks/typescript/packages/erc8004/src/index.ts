// Types
export type {
  Address,
  Hex,
  Bytes32,
  AgentRegistryId,
  AgentRegistry,
  MetadataEntry,
  AgentIdentity,
  ResolvedAgent,
  RegistrationFile,
  ServiceEntry,
  RegistrationEntry,
  FeedbackRecord,
  ReputationSummary,
  FeedbackParams,
  FeedbackFile,
  ProofOfPayment,
  ValidationRequestParams,
  ValidationStatus,
  ValidationSummary,
  ERC8004Extension,
  ERC8004PayloadExtension,
  ERC8004ReadClient,
  ERC8004WriteClient,
  ERC8004Config,
  ReputationCheckConfig,
  FeedbackSubmissionConfig,
} from "./types";

// Constants
export {
  ERC8004_EXTENSION_KEY,
  IDENTITY_REGISTRIES,
  REPUTATION_REGISTRIES,
  VALIDATION_REGISTRIES,
  FEEDBACK_TAGS,
  IDENTITY_REGISTRY_DOMAIN,
  SET_AGENT_WALLET_TYPES,
} from "./constants";

// ABIs
export {
  identityRegistryAbi,
  reputationRegistryAbi,
  validationRegistryAbi,
} from "./abis";

// Identity
export {
  parseAgentRegistry,
  getAgentIdentity,
  fetchRegistrationFile,
  resolveAgent,
  verifyPayToMatchesAgent,
} from "./identity";

// Extension
export {
  declareERC8004Extension,
  getERC8004Extension,
  createERC8004PayloadExtension,
  verifyAgentIdentity,
} from "./extension";
