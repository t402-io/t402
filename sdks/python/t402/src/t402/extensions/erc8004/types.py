"""ERC-8004 Agent Registry types for the t402 protocol.

Defines agent identity, reputation, validation, and extension types
matching the TypeScript @t402/erc8004 package.
"""

from typing import Any, Dict, List, Optional, Protocol

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


# ============================================================================
# Primitive type aliases
# ============================================================================

Address = str
"""Ethereum address (0x-prefixed hex string)."""

Hex = str
"""Hex-encoded bytes (0x-prefixed)."""

Bytes32 = str
"""32-byte hash (0x-prefixed, 66 chars)."""

AgentRegistryId = str
"""ERC-8004 agent registry identifier: {namespace}:{chainId}:{contractAddress}."""


# ============================================================================
# Agent Identifier
# ============================================================================


class AgentRegistry(BaseModel):
    """Parsed agent registry identifier."""

    namespace: str
    chain_id: str
    address: Address
    id: AgentRegistryId

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class MetadataEntry(BaseModel):
    """Metadata entry for agent registration."""

    metadata_key: str
    metadata_value: Hex

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ============================================================================
# Identity Types
# ============================================================================


class AgentIdentity(BaseModel):
    """On-chain agent identity from Identity Registry."""

    agent_id: int
    owner: Address
    agent_uri: str
    agent_wallet: Address
    registry: AgentRegistry

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ServiceEntry(BaseModel):
    """Service endpoint in registration file."""

    name: str
    endpoint: str
    version: Optional[str] = None
    skills: Optional[List[str]] = None
    domains: Optional[List[str]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class RegistrationEntry(BaseModel):
    """Registration entry in registration file."""

    agent_id: int
    agent_registry: AgentRegistryId

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class RegistrationFile(BaseModel):
    """ERC-8004 Registration File (off-chain JSON at agentURI)."""

    type: str
    name: str
    description: Optional[str] = None
    image: Optional[str] = None
    services: List[ServiceEntry]
    x402_support: bool
    active: bool
    registrations: List[RegistrationEntry]
    supported_trust: Optional[List[str]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ResolvedAgent(AgentIdentity):
    """Resolved agent = on-chain identity + fetched registration file."""

    registration: RegistrationFile


# ============================================================================
# Reputation Types
# ============================================================================


class FeedbackRecord(BaseModel):
    """On-chain feedback record."""

    value: int
    value_decimals: int
    tag1: str
    tag2: str
    is_revoked: bool
    feedback_index: int
    client_address: Address

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ReputationSummary(BaseModel):
    """Aggregated reputation summary."""

    agent_id: int
    count: int
    summary_value: int
    summary_value_decimals: int
    normalized_score: float
    """Normalized 0-100 score derived from summary_value/summary_value_decimals."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class FeedbackParams(BaseModel):
    """Parameters for submitting feedback."""

    agent_id: int
    value: int
    value_decimals: int
    tag1: str
    tag2: str
    endpoint: Optional[str] = None
    feedback_uri: Optional[str] = None
    feedback_hash: Optional[Bytes32] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ProofOfPayment(BaseModel):
    """Proof of payment for off-chain feedback."""

    from_address: str
    to_address: str
    chain_id: str
    tx_hash: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class FeedbackFile(BaseModel):
    """Off-chain feedback file structure."""

    agent_registry: AgentRegistryId
    agent_id: int
    client_address: str
    created_at: str
    value: int
    value_decimals: int
    tag1: Optional[str] = None
    tag2: Optional[str] = None
    endpoint: Optional[str] = None
    proof_of_payment: Optional[ProofOfPayment] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ============================================================================
# Validation Types
# ============================================================================


class ValidationRequestParams(BaseModel):
    """Validation request parameters."""

    validator_address: Address
    agent_id: int
    request_uri: str
    request_hash: Bytes32

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ValidationStatus(BaseModel):
    """Validation response."""

    validator_address: Address
    agent_id: int
    response: int  # 0-100
    response_hash: Bytes32
    tag: str
    last_update: int

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ValidationSummary(BaseModel):
    """Validation summary."""

    count: int
    average_response: int  # 0-100

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ============================================================================
# Extension Types
# ============================================================================


class ERC8004Extension(BaseModel):
    """ERC-8004 extension data in PaymentRequired.extensions."""

    agent_id: int
    agent_registry: AgentRegistryId
    agent_wallet: Optional[str] = None
    reputation_score: Optional[float] = None
    feedback_count: Optional[int] = None
    validation_score: Optional[int] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ERC8004PayloadExtension(BaseModel):
    """ERC-8004 extension data echoed in PaymentPayload.extensions."""

    identity_verified: bool
    agent_id: int
    agent_registry: AgentRegistryId

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ============================================================================
# Client Protocols
# ============================================================================


class ERC8004ReadClient(Protocol):
    """Minimal read-only client interface for ERC-8004 registry interactions."""

    async def read_contract(
        self,
        *,
        address: Address,
        abi: list,
        function_name: str,
        args: Optional[list] = None,
    ) -> Any: ...


class ERC8004WriteClient(ERC8004ReadClient, Protocol):
    """Write-capable client for submitting feedback and validation."""

    async def write_contract(
        self,
        *,
        address: Address,
        abi: list,
        function_name: str,
        args: list,
    ) -> Hex: ...

    async def wait_for_transaction_receipt(
        self, *, hash: Hex
    ) -> Dict[str, str]: ...


# ============================================================================
# Configuration Types
# ============================================================================


class ERC8004Config(BaseModel):
    """Configuration for ERC-8004 integration."""

    network: str
    identity_registry: Address
    reputation_registry: Optional[Address] = None
    validation_registry: Optional[Address] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ReputationCheckConfig(BaseModel):
    """Reputation check configuration."""

    min_score: float
    trusted_reviewers: List[Address]
    tag1: Optional[str] = None
    tag2: Optional[str] = None
    on_below_threshold: Optional[str] = "reject"
    """Action on score below threshold: 'reject' or 'warn'."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class FeedbackSubmissionConfig(BaseModel):
    """Feedback submission configuration."""

    tag1: Optional[str] = None
    tag2: Optional[str] = None
    include_proof_of_payment: Optional[bool] = None
    feedback_base_uri: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
