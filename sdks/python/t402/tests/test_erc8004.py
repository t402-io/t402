"""Tests for the ERC-8004 Agent Registry extension."""

from datetime import datetime, timezone

import pytest

from t402.extensions.erc8004 import (
    ERC8004_EXTENSION_KEY,
    ERC8004Extension,
    ERC8004PayloadExtension,
    AgentRegistry,
    ReputationSummary,
    ValidationSummary,
    FeedbackFile,
    FeedbackParams,
    ValidationRequestParams,
    ValidationStatus,
    FEEDBACK_TAGS,
    IDENTITY_REGISTRY_ABI,
    REPUTATION_REGISTRY_ABI,
    VALIDATION_REGISTRY_ABI,
    IDENTITY_REGISTRIES,
    REPUTATION_REGISTRIES,
    VALIDATION_REGISTRIES,
    IDENTITY_REGISTRY_DOMAIN,
    SET_AGENT_WALLET_TYPES,
)
from t402.extensions.erc8004.erc8004 import (
    parse_agent_registry,
    declare_erc8004_extension,
    get_erc8004_extension,
    create_erc8004_payload_extension,
    verify_pay_to_matches_agent,
    get_reputation_summary,
    build_feedback_file,
    submit_feedback,
    get_validation_status,
    get_validation_summary,
    submit_validation_request,
    verify_agent_identity,
    get_agent_identity,
)


# ============================================================================
# Mock Client
# ============================================================================


class MockReadClient:
    """Mock ERC-8004 read client for testing."""

    def __init__(self, responses=None):
        self.responses = responses or {}
        self.calls = []

    async def read_contract(self, *, address, abi, function_name, args=None):
        self.calls.append((address, function_name, args))
        key = function_name
        if key in self.responses:
            return self.responses[key]
        raise ValueError(f"No mock response for {function_name}")


class MockWriteClient(MockReadClient):
    """Mock ERC-8004 write client for testing."""

    def __init__(self, responses=None, tx_hash="0xabc123"):
        super().__init__(responses)
        self.tx_hash = tx_hash
        self.write_calls = []

    async def write_contract(self, *, address, abi, function_name, args):
        self.write_calls.append((address, function_name, args))
        return self.tx_hash

    async def wait_for_transaction_receipt(self, *, hash):
        return {"status": "success"}


# ============================================================================
# Constants Tests
# ============================================================================


class TestConstants:
    def test_extension_key(self):
        assert ERC8004_EXTENSION_KEY == "erc8004"

    def test_feedback_tags(self):
        assert FEEDBACK_TAGS["PAYMENT_SUCCESS"] == "paymentSuccess"
        assert FEEDBACK_TAGS["PAYMENT_FAILED"] == "paymentFailed"
        assert FEEDBACK_TAGS["SERVICE_QUALITY"] == "starred"
        assert FEEDBACK_TAGS["RESPONSE_TIME"] == "responseTime"
        assert FEEDBACK_TAGS["UPTIME"] == "uptime"

    def test_registries_empty(self):
        assert IDENTITY_REGISTRIES == {}
        assert REPUTATION_REGISTRIES == {}
        assert VALIDATION_REGISTRIES == {}

    def test_abis_present(self):
        assert len(IDENTITY_REGISTRY_ABI) > 0
        assert len(REPUTATION_REGISTRY_ABI) > 0
        assert len(VALIDATION_REGISTRY_ABI) > 0

    def test_eip712_constants(self):
        assert IDENTITY_REGISTRY_DOMAIN["name"] == "IdentityRegistry"
        assert IDENTITY_REGISTRY_DOMAIN["version"] == "1"
        assert "SetAgentWallet" in SET_AGENT_WALLET_TYPES

    def test_identity_abi_has_expected_functions(self):
        names = [e["name"] for e in IDENTITY_REGISTRY_ABI if e["type"] == "function"]
        assert "register" in names
        assert "getAgentWallet" in names
        assert "tokenURI" in names
        assert "ownerOf" in names

    def test_reputation_abi_has_expected_functions(self):
        names = [e["name"] for e in REPUTATION_REGISTRY_ABI if e["type"] == "function"]
        assert "giveFeedback" in names
        assert "getSummary" in names
        assert "revokeFeedback" in names

    def test_validation_abi_has_expected_functions(self):
        names = [e["name"] for e in VALIDATION_REGISTRY_ABI if e["type"] == "function"]
        assert "validationRequest" in names
        assert "validationResponse" in names
        assert "getValidationStatus" in names
        assert "getSummary" in names


# ============================================================================
# Identity Tests
# ============================================================================


class TestParseAgentRegistry:
    def test_valid_parse(self):
        result = parse_agent_registry("eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f")
        assert result.namespace == "eip155"
        assert result.chain_id == "8453"
        assert result.address == "0x742d35Cc6634C0532925a3b844Bc9e7595f"
        assert result.id == "eip155:8453:0x742d35Cc6634C0532925a3b844Bc9e7595f"

    def test_invalid_too_few_parts(self):
        with pytest.raises(ValueError, match="Invalid agent registry ID"):
            parse_agent_registry("eip155:8453")

    def test_invalid_empty_parts(self):
        with pytest.raises(ValueError, match="All parts must be non-empty"):
            parse_agent_registry("::0x123")

    def test_address_with_colons(self):
        result = parse_agent_registry("cosmos:cosmoshub-4:cosmos1abc:extra")
        assert result.namespace == "cosmos"
        assert result.chain_id == "cosmoshub-4"
        assert result.address == "cosmos1abc:extra"


class TestGetAgentIdentity:
    @pytest.mark.asyncio
    async def test_resolves_identity(self):
        client = MockReadClient(
            responses={
                "getAgentWallet": "0xWallet123",
                "ownerOf": "0xOwner456",
                "tokenURI": "https://example.com/agent.json",
            }
        )
        identity = await get_agent_identity(
            client, "0xRegistry", 42, "eip155:8453:0xRegistry"
        )
        assert identity.agent_id == 42
        assert identity.owner == "0xOwner456"
        assert identity.agent_uri == "https://example.com/agent.json"
        assert identity.agent_wallet == "0xWallet123"
        assert identity.registry.namespace == "eip155"


class TestVerifyPayToMatchesAgent:
    @pytest.mark.asyncio
    async def test_matching_address(self):
        client = MockReadClient(
            responses={"getAgentWallet": "0xABC123"}
        )
        result = await verify_pay_to_matches_agent(
            client, "0xRegistry", 42, "0xabc123"
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_non_matching_address(self):
        client = MockReadClient(
            responses={"getAgentWallet": "0xABC123"}
        )
        result = await verify_pay_to_matches_agent(
            client, "0xRegistry", 42, "0xDEF456"
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_case_insensitive(self):
        client = MockReadClient(
            responses={"getAgentWallet": "0xAbCdEf"}
        )
        result = await verify_pay_to_matches_agent(
            client, "0xRegistry", 42, "0xABCDEF"
        )
        assert result is True


# ============================================================================
# Reputation Tests
# ============================================================================


class TestGetReputationSummary:
    @pytest.mark.asyncio
    async def test_returns_summary(self):
        client = MockReadClient(
            responses={"getSummary": (5, 450, 1)}
        )
        summary = await get_reputation_summary(
            client, "0xRepRegistry", 42, ["0xReviewer1"]
        )
        assert summary.agent_id == 42
        assert summary.count == 5
        assert summary.summary_value == 450
        assert summary.summary_value_decimals == 1
        assert summary.normalized_score == 45.0

    @pytest.mark.asyncio
    async def test_zero_count_returns_zero_score(self):
        client = MockReadClient(
            responses={"getSummary": (0, 0, 0)}
        )
        summary = await get_reputation_summary(
            client, "0xRepRegistry", 42, ["0xReviewer1"]
        )
        assert summary.normalized_score == 0

    @pytest.mark.asyncio
    async def test_clamps_to_100(self):
        client = MockReadClient(
            responses={"getSummary": (1, 200, 0)}
        )
        summary = await get_reputation_summary(
            client, "0xRepRegistry", 42, ["0xReviewer1"]
        )
        assert summary.normalized_score == 100

    @pytest.mark.asyncio
    async def test_clamps_to_zero(self):
        client = MockReadClient(
            responses={"getSummary": (1, -50, 0)}
        )
        summary = await get_reputation_summary(
            client, "0xRepRegistry", 42, ["0xReviewer1"]
        )
        assert summary.normalized_score == 0


class TestBuildFeedbackFile:
    def test_builds_feedback_file(self):
        fb = build_feedback_file(
            agent_id=42,
            agent_registry="eip155:8453:0xReg",
            client_address="0xClient",
            value=100,
            value_decimals=0,
            tag1="paymentSuccess",
            tag2="",
        )
        assert fb.agent_id == 42
        assert fb.agent_registry == "eip155:8453:0xReg"
        assert fb.client_address == "0xClient"
        assert fb.value == 100
        assert fb.created_at is not None
        assert fb.proof_of_payment is None

    def test_with_proof_of_payment(self):
        from t402.extensions.erc8004.types import ProofOfPayment

        proof = ProofOfPayment(
            from_address="0xFrom",
            to_address="0xTo",
            chain_id="eip155:8453",
            tx_hash="0xTxHash",
        )
        fb = build_feedback_file(
            agent_id=42,
            agent_registry="eip155:8453:0xReg",
            client_address="0xClient",
            value=100,
            value_decimals=0,
            tag1="paymentSuccess",
            tag2="",
            proof_of_payment=proof,
        )
        assert fb.proof_of_payment is not None
        assert fb.proof_of_payment.tx_hash == "0xTxHash"


class TestSubmitFeedback:
    @pytest.mark.asyncio
    async def test_submits_feedback(self):
        client = MockWriteClient(tx_hash="0xFeedbackTx")
        params = FeedbackParams(
            agent_id=42,
            value=100,
            value_decimals=0,
            tag1="paymentSuccess",
            tag2="",
        )
        tx = await submit_feedback(client, "0xRepRegistry", params)
        assert tx == "0xFeedbackTx"
        assert len(client.write_calls) == 1
        assert client.write_calls[0][1] == "giveFeedback"


# ============================================================================
# Validation Tests
# ============================================================================


class TestSubmitValidationRequest:
    @pytest.mark.asyncio
    async def test_submits_request(self):
        client = MockWriteClient(tx_hash="0xValReqTx")
        params = ValidationRequestParams(
            validator_address="0xValidator",
            agent_id=42,
            request_uri="https://example.com/request",
            request_hash="0x" + "ab" * 32,
        )
        tx = await submit_validation_request(client, "0xValRegistry", params)
        assert tx == "0xValReqTx"
        assert client.write_calls[0][1] == "validationRequest"


class TestGetValidationStatus:
    @pytest.mark.asyncio
    async def test_returns_status(self):
        client = MockReadClient(
            responses={
                "getValidationStatus": (
                    "0xValidator",
                    42,
                    85,
                    "0x" + "cd" * 32,
                    "quality",
                    1700000000,
                )
            }
        )
        status = await get_validation_status(
            client, "0xValRegistry", "0x" + "ab" * 32
        )
        assert status.validator_address == "0xValidator"
        assert status.agent_id == 42
        assert status.response == 85
        assert status.tag == "quality"


class TestGetValidationSummary:
    @pytest.mark.asyncio
    async def test_returns_summary(self):
        client = MockReadClient(responses={"getSummary": (3, 90)})
        summary = await get_validation_summary(
            client, "0xValRegistry", 42, ["0xValidator1"]
        )
        assert summary.count == 3
        assert summary.average_response == 90


# ============================================================================
# Extension Helper Tests
# ============================================================================


class TestDeclareERC8004Extension:
    def test_basic_declaration(self):
        ext = declare_erc8004_extension(42, "eip155:8453:0xReg")
        assert ext.agent_id == 42
        assert ext.agent_registry == "eip155:8453:0xReg"
        assert ext.agent_wallet is None

    def test_with_wallet(self):
        ext = declare_erc8004_extension(42, "eip155:8453:0xReg", "0xWallet")
        assert ext.agent_wallet == "0xWallet"


class TestGetERC8004Extension:
    def test_extracts_from_dict(self):
        extensions = {
            ERC8004_EXTENSION_KEY: {
                "agentId": 42,
                "agentRegistry": "eip155:8453:0xReg",
            }
        }
        ext = get_erc8004_extension(extensions)
        assert ext is not None
        assert ext.agent_id == 42
        assert ext.agent_registry == "eip155:8453:0xReg"

    def test_extracts_model_instance(self):
        model = ERC8004Extension(agent_id=42, agent_registry="eip155:8453:0xReg")
        extensions = {ERC8004_EXTENSION_KEY: model}
        ext = get_erc8004_extension(extensions)
        assert ext is not None
        assert ext.agent_id == 42

    def test_returns_none_when_missing(self):
        assert get_erc8004_extension({}) is None
        assert get_erc8004_extension(None) is None

    def test_returns_none_for_invalid_type(self):
        assert get_erc8004_extension({ERC8004_EXTENSION_KEY: "not-a-dict"}) is None


class TestCreateERC8004PayloadExtension:
    def test_creates_payload(self):
        payload = create_erc8004_payload_extension(42, "eip155:8453:0xReg", True)
        assert payload.identity_verified is True
        assert payload.agent_id == 42
        assert payload.agent_registry == "eip155:8453:0xReg"

    def test_not_verified(self):
        payload = create_erc8004_payload_extension(42, "eip155:8453:0xReg", False)
        assert payload.identity_verified is False


class TestVerifyAgentIdentity:
    @pytest.mark.asyncio
    async def test_verifies_matching_pay_to(self):
        client = MockReadClient(responses={"getAgentWallet": "0xWallet123"})
        result = await verify_agent_identity(
            client,
            {ERC8004_EXTENSION_KEY: {"agentId": 42, "agentRegistry": "eip155:8453:0xReg"}},
            [{"payTo": "0xWallet123"}],
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_rejects_mismatched_pay_to(self):
        client = MockReadClient(responses={"getAgentWallet": "0xWallet123"})
        result = await verify_agent_identity(
            client,
            {ERC8004_EXTENSION_KEY: {"agentId": 42, "agentRegistry": "eip155:8453:0xReg"}},
            [{"payTo": "0xOtherWallet"}],
        )
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_without_extension(self):
        client = MockReadClient()
        result = await verify_agent_identity(client, {}, [{"payTo": "0xWallet"}])
        assert result is False

    @pytest.mark.asyncio
    async def test_multiple_accepts(self):
        client = MockReadClient(responses={"getAgentWallet": "0xWallet123"})
        result = await verify_agent_identity(
            client,
            {ERC8004_EXTENSION_KEY: {"agentId": 42, "agentRegistry": "eip155:8453:0xReg"}},
            [{"payTo": "0xWallet123"}, {"payTo": "0xwallet123"}],
        )
        assert result is True


# ============================================================================
# Serialization Tests
# ============================================================================


class TestSerialization:
    def test_extension_to_camel_case(self):
        ext = ERC8004Extension(
            agent_id=42,
            agent_registry="eip155:8453:0xReg",
            reputation_score=85.5,
            feedback_count=10,
        )
        data = ext.model_dump(by_alias=True, exclude_none=True)
        assert data["agentId"] == 42
        assert data["agentRegistry"] == "eip155:8453:0xReg"
        assert data["reputationScore"] == 85.5
        assert data["feedbackCount"] == 10
        assert "agentWallet" not in data

    def test_payload_extension_to_camel_case(self):
        payload = ERC8004PayloadExtension(
            identity_verified=True,
            agent_id=42,
            agent_registry="eip155:8453:0xReg",
        )
        data = payload.model_dump(by_alias=True)
        assert data["identityVerified"] is True
        assert data["agentId"] == 42
        assert data["agentRegistry"] == "eip155:8453:0xReg"

    def test_extension_from_camel_case(self):
        ext = ERC8004Extension(
            **{
                "agentId": 42,
                "agentRegistry": "eip155:8453:0xReg",
                "validationScore": 90,
            }
        )
        assert ext.agent_id == 42
        assert ext.validation_score == 90

    def test_feedback_file_serialization(self):
        fb = FeedbackFile(
            agent_registry="eip155:8453:0xReg",
            agent_id=42,
            client_address="0xClient",
            created_at="2025-01-01T00:00:00Z",
            value=100,
            value_decimals=0,
            tag1="paymentSuccess",
            tag2="",
        )
        data = fb.model_dump(by_alias=True, exclude_none=True)
        assert data["agentRegistry"] == "eip155:8453:0xReg"
        assert data["agentId"] == 42
        assert data["createdAt"] == "2025-01-01T00:00:00Z"
