"""ERC-8004 Agent Registry extension for the t402 protocol.

Provides identity resolution, reputation queries, validation,
and extension helpers for ERC-8004 agent registries.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from t402.extensions.erc8004.constants import (
    ERC8004_EXTENSION_KEY,
    FEEDBACK_TAGS,
    IDENTITY_REGISTRY_ABI,
    REPUTATION_REGISTRY_ABI,
    VALIDATION_REGISTRY_ABI,
)
from t402.extensions.erc8004.types import (
    Address,
    AgentIdentity,
    AgentRegistry,
    AgentRegistryId,
    Bytes32,
    ERC8004Extension,
    ERC8004PayloadExtension,
    ERC8004ReadClient,
    ERC8004WriteClient,
    FeedbackFile,
    FeedbackParams,
    Hex,
    ProofOfPayment,
    RegistrationFile,
    ReputationSummary,
    ResolvedAgent,
    ValidationRequestParams,
    ValidationStatus,
    ValidationSummary,
)

ZERO_BYTES32 = "0x" + "0" * 64


# ============================================================================
# Identity Functions
# ============================================================================


def parse_agent_registry(registry_id: AgentRegistryId) -> AgentRegistry:
    """Parse an agent registry ID string into components.

    Args:
        registry_id: Format ``{namespace}:{chainId}:{address}``.

    Returns:
        Parsed AgentRegistry.

    Raises:
        ValueError: If the registry ID is malformed.

    Example::

        parse_agent_registry("eip155:8453:0x742d35Cc...")
        # => AgentRegistry(namespace="eip155", chain_id="8453", address="0x742d35Cc...", ...)
    """
    parts = registry_id.split(":")
    if len(parts) < 3:
        raise ValueError(
            f"Invalid agent registry ID: {registry_id}. "
            "Expected format: namespace:chainId:address"
        )

    namespace = parts[0]
    chain_id = parts[1]
    address = ":".join(parts[2:])

    if not namespace or not chain_id or not address:
        raise ValueError(
            f"Invalid agent registry ID: {registry_id}. "
            "All parts must be non-empty"
        )

    return AgentRegistry(
        namespace=namespace, chain_id=chain_id, address=address, id=registry_id
    )


async def get_agent_identity(
    client: ERC8004ReadClient,
    identity_registry: Address,
    agent_id: int,
    registry_id: AgentRegistryId,
) -> AgentIdentity:
    """Resolve an agent's on-chain identity from the Identity Registry.

    Args:
        client: Read-only client for contract calls.
        identity_registry: Identity Registry contract address.
        agent_id: Agent's NFT token ID.
        registry_id: Full agent registry identifier.

    Returns:
        Agent identity with wallet, owner, and URI.
    """
    agent_wallet = await client.read_contract(
        address=identity_registry,
        abi=IDENTITY_REGISTRY_ABI,
        function_name="getAgentWallet",
        args=[agent_id],
    )
    owner = await client.read_contract(
        address=identity_registry,
        abi=IDENTITY_REGISTRY_ABI,
        function_name="ownerOf",
        args=[agent_id],
    )
    agent_uri = await client.read_contract(
        address=identity_registry,
        abi=IDENTITY_REGISTRY_ABI,
        function_name="tokenURI",
        args=[agent_id],
    )

    return AgentIdentity(
        agent_id=agent_id,
        owner=str(owner),
        agent_uri=str(agent_uri),
        agent_wallet=str(agent_wallet),
        registry=parse_agent_registry(registry_id),
    )


async def fetch_registration_file(agent_uri: str) -> RegistrationFile:
    """Fetch and parse the agent's registration file from their agentURI.

    Args:
        agent_uri: URI pointing to the registration JSON file.

    Returns:
        Parsed registration file.

    Raises:
        httpx.HTTPStatusError: If the URI is not reachable.
        ValueError: If the file is malformed.
    """
    async with httpx.AsyncClient() as http_client:
        response = await http_client.get(agent_uri)
        response.raise_for_status()
        data = response.json()
        return RegistrationFile(**data)


async def resolve_agent(
    client: ERC8004ReadClient,
    identity_registry: Address,
    agent_id: int,
    registry_id: AgentRegistryId,
) -> ResolvedAgent:
    """Resolve an agent: fetch on-chain identity + off-chain registration file.

    Args:
        client: Read-only client for contract calls.
        identity_registry: Identity Registry contract address.
        agent_id: Agent's NFT token ID.
        registry_id: Full agent registry identifier.

    Returns:
        Fully resolved agent with registration file.
    """
    identity = await get_agent_identity(
        client, identity_registry, agent_id, registry_id
    )
    registration = await fetch_registration_file(identity.agent_uri)

    return ResolvedAgent(
        agent_id=identity.agent_id,
        owner=identity.owner,
        agent_uri=identity.agent_uri,
        agent_wallet=identity.agent_wallet,
        registry=identity.registry,
        registration=registration,
    )


async def verify_pay_to_matches_agent(
    client: ERC8004ReadClient,
    identity_registry: Address,
    agent_id: int,
    pay_to: str,
) -> bool:
    """Verify that a payTo address matches the on-chain agentWallet.

    Args:
        client: Read-only client for contract calls.
        identity_registry: Identity Registry contract address.
        agent_id: Agent's NFT token ID.
        pay_to: Address from PaymentRequirements.payTo.

    Returns:
        Whether the payTo address matches the on-chain agentWallet.
    """
    agent_wallet = await client.read_contract(
        address=identity_registry,
        abi=IDENTITY_REGISTRY_ABI,
        function_name="getAgentWallet",
        args=[agent_id],
    )
    return str(agent_wallet).lower() == pay_to.lower()


# ============================================================================
# Reputation Functions
# ============================================================================


async def get_reputation_summary(
    client: ERC8004ReadClient,
    reputation_registry: Address,
    agent_id: int,
    trusted_reviewers: List[Address],
    tag1: str = "",
    tag2: str = "",
) -> ReputationSummary:
    """Get a reputation summary for an agent from trusted reviewers.

    Queries the on-chain Reputation Registry and normalizes the result
    to a 0-100 score.

    Args:
        client: Read-only client for contract calls.
        reputation_registry: Reputation Registry contract address.
        agent_id: Agent's on-chain ID.
        trusted_reviewers: Addresses whose feedback is trusted.
        tag1: Optional primary tag filter.
        tag2: Optional secondary tag filter.

    Returns:
        Reputation summary with normalized 0-100 score.
    """
    result = await client.read_contract(
        address=reputation_registry,
        abi=REPUTATION_REGISTRY_ABI,
        function_name="getSummary",
        args=[agent_id, trusted_reviewers, tag1, tag2],
    )

    count, summary_value, summary_value_decimals = result

    divisor = 10 ** summary_value_decimals
    normalized_score = (
        min(100, max(0, summary_value / divisor)) if count > 0 else 0
    )

    return ReputationSummary(
        agent_id=agent_id,
        count=count,
        summary_value=summary_value,
        summary_value_decimals=summary_value_decimals,
        normalized_score=normalized_score,
    )


def build_feedback_file(
    agent_id: int,
    agent_registry: AgentRegistryId,
    client_address: str,
    value: int,
    value_decimals: int,
    tag1: str,
    tag2: str,
    proof_of_payment: Optional[ProofOfPayment] = None,
) -> FeedbackFile:
    """Build an off-chain feedback file with optional proof of payment.

    Args:
        agent_id: Agent's numeric ID.
        agent_registry: Registry identifier.
        client_address: Address of the feedback submitter.
        value: Feedback value (e.g. 100 for positive).
        value_decimals: Decimal precision for value.
        tag1: Primary classification tag.
        tag2: Secondary classification tag.
        proof_of_payment: Optional payment proof from settlement.

    Returns:
        Feedback file object.
    """
    return FeedbackFile(
        agent_registry=agent_registry,
        agent_id=agent_id,
        client_address=client_address,
        created_at=datetime.now(timezone.utc).isoformat(),
        value=value,
        value_decimals=value_decimals,
        tag1=tag1,
        tag2=tag2,
        proof_of_payment=proof_of_payment,
    )


async def submit_feedback(
    client: ERC8004WriteClient,
    reputation_registry: Address,
    params: FeedbackParams,
) -> Hex:
    """Submit feedback for an agent to the on-chain Reputation Registry.

    Args:
        client: Write-capable client for submitting transactions.
        reputation_registry: Reputation Registry contract address.
        params: Feedback parameters.

    Returns:
        Transaction hash.
    """
    return await client.write_contract(
        address=reputation_registry,
        abi=REPUTATION_REGISTRY_ABI,
        function_name="giveFeedback",
        args=[
            params.agent_id,
            params.value,
            params.value_decimals,
            params.tag1,
            params.tag2,
            params.endpoint or "",
            params.feedback_uri or "",
            params.feedback_hash or ZERO_BYTES32,
        ],
    )


# ============================================================================
# Validation Functions
# ============================================================================


async def submit_validation_request(
    client: ERC8004WriteClient,
    validation_registry: Address,
    params: ValidationRequestParams,
) -> Hex:
    """Submit a validation request for agent work.

    Args:
        client: Write-capable client.
        validation_registry: Validation Registry contract address.
        params: Validation request parameters.

    Returns:
        Transaction hash.
    """
    return await client.write_contract(
        address=validation_registry,
        abi=VALIDATION_REGISTRY_ABI,
        function_name="validationRequest",
        args=[
            params.validator_address,
            params.agent_id,
            params.request_uri,
            params.request_hash,
        ],
    )


async def get_validation_status(
    client: ERC8004ReadClient,
    validation_registry: Address,
    request_hash: Bytes32,
) -> ValidationStatus:
    """Get validation status for a specific request.

    Args:
        client: Read-only client.
        validation_registry: Validation Registry contract address.
        request_hash: Keccak256 hash of the validation request.

    Returns:
        Validation status.
    """
    result = await client.read_contract(
        address=validation_registry,
        abi=VALIDATION_REGISTRY_ABI,
        function_name="getValidationStatus",
        args=[request_hash],
    )

    return ValidationStatus(
        validator_address=result[0],
        agent_id=result[1],
        response=result[2],
        response_hash=result[3],
        tag=result[4],
        last_update=result[5],
    )


async def get_validation_summary(
    client: ERC8004ReadClient,
    validation_registry: Address,
    agent_id: int,
    validator_addresses: List[Address],
    tag: str = "",
) -> ValidationSummary:
    """Get aggregated validation summary for an agent.

    Args:
        client: Read-only client.
        validation_registry: Validation Registry contract address.
        agent_id: Agent's ID.
        validator_addresses: Addresses of trusted validators.
        tag: Optional tag filter.

    Returns:
        Validation summary with count and average score.
    """
    result = await client.read_contract(
        address=validation_registry,
        abi=VALIDATION_REGISTRY_ABI,
        function_name="getSummary",
        args=[agent_id, validator_addresses, tag],
    )

    return ValidationSummary(
        count=result[0],
        average_response=result[1],
    )


# ============================================================================
# Extension Helpers
# ============================================================================


def declare_erc8004_extension(
    agent_id: int,
    agent_registry: AgentRegistryId,
    agent_wallet: Optional[str] = None,
) -> ERC8004Extension:
    """Declare an ERC-8004 extension for a PaymentRequired response.

    Args:
        agent_id: Agent's on-chain ID.
        agent_registry: Registry identifier.
        agent_wallet: Optional verified wallet address.

    Returns:
        Extension object to include in route config extensions.
    """
    return ERC8004Extension(
        agent_id=agent_id,
        agent_registry=agent_registry,
        agent_wallet=agent_wallet,
    )


def get_erc8004_extension(
    extensions: Optional[Dict[str, Any]],
) -> Optional[ERC8004Extension]:
    """Extract ERC-8004 extension data from extensions dict.

    Args:
        extensions: Extensions dict from PaymentRequired or similar.

    Returns:
        ERC-8004 extension data or None.
    """
    if not extensions or ERC8004_EXTENSION_KEY not in extensions:
        return None

    raw = extensions[ERC8004_EXTENSION_KEY]
    if isinstance(raw, ERC8004Extension):
        return raw
    if isinstance(raw, dict):
        return ERC8004Extension(**raw)
    return None


def create_erc8004_payload_extension(
    agent_id: int,
    agent_registry: AgentRegistryId,
    verified: bool,
) -> ERC8004PayloadExtension:
    """Create a client-side ERC-8004 payload extension after verifying identity.

    Args:
        agent_id: Agent ID that was verified.
        agent_registry: Registry used.
        verified: Whether verification passed.

    Returns:
        Payload extension to echo back.
    """
    return ERC8004PayloadExtension(
        identity_verified=verified,
        agent_id=agent_id,
        agent_registry=agent_registry,
    )


async def verify_agent_identity(
    client: ERC8004ReadClient,
    extensions: Optional[Dict[str, Any]],
    accepts: List[Dict[str, Any]],
) -> bool:
    """Client-side: verify agent identity from PaymentRequired before paying.

    Checks that the payTo address in each accepts entry matches
    the on-chain agentWallet for the declared agentId.

    Args:
        client: Read-only client for contract calls.
        extensions: Extensions dict from the PaymentRequired response.
        accepts: List of accepts entries (each with a ``payTo`` field).

    Returns:
        Whether all payTo addresses match the on-chain agent wallet.
    """
    ext = get_erc8004_extension(extensions)
    if ext is None:
        return False

    registry = parse_agent_registry(ext.agent_registry)

    for accept in accepts:
        pay_to = accept.get("payTo") or accept.get("pay_to", "")
        matches = await verify_pay_to_matches_agent(
            client, registry.address, ext.agent_id, pay_to
        )
        if not matches:
            return False

    return True
