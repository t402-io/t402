"""Tests for WDK multisig client."""

import pytest
from t402.wdk.multisig import (
    MultisigClient,
    MultisigConfig,
    MultisigProposal,
)


OWNER_1 = "0x" + "1" * 40
OWNER_2 = "0x" + "2" * 40
OWNER_3 = "0x" + "3" * 40
TOKEN = "0x" + "a" * 40
RECIPIENT = "0x" + "b" * 40


class TestMultisigConfig:
    """Tests for MultisigConfig."""

    def test_valid_config(self):
        config = MultisigConfig(
            safe_address="0x" + "f" * 40,
            threshold=2,
            owners=[OWNER_1, OWNER_2, OWNER_3],
        )
        assert config.threshold == 2
        assert len(config.owners) == 3
        assert config.chain_id == 42161

    def test_custom_chain_id(self):
        config = MultisigConfig(
            safe_address="0x" + "f" * 40,
            threshold=1,
            owners=[OWNER_1],
            chain_id=8453,
        )
        assert config.chain_id == 8453


class TestMultisigProposal:
    """Tests for MultisigProposal."""

    def test_create_proposal(self):
        proposal = MultisigProposal(
            proposal_id="test-id",
            to=RECIPIENT,
            amount=1000000,
            token=TOKEN,
        )
        assert proposal.proposal_id == "test-id"
        assert proposal.signature_count == 0
        assert proposal.executed is False

    def test_signature_count(self):
        proposal = MultisigProposal(
            proposal_id="test-id",
            to=RECIPIENT,
            amount=1000000,
            token=TOKEN,
            signatures={OWNER_1: "sig1", OWNER_2: "sig2"},
        )
        assert proposal.signature_count == 2


class TestMultisigClient:
    """Tests for MultisigClient."""

    def test_create_client(self):
        config = MultisigConfig(
            safe_address="0x" + "f" * 40,
            threshold=2,
            owners=[OWNER_1, OWNER_2, OWNER_3],
        )
        client = MultisigClient(config)
        assert client.config == config

    def test_create_client_invalid_threshold(self):
        with pytest.raises(ValueError, match="at least 1"):
            MultisigConfig(
                safe_address="0x" + "f" * 40,
                threshold=0,
                owners=[OWNER_1],
            )
            MultisigClient(MultisigConfig(
                safe_address="0x" + "f" * 40,
                threshold=0,
                owners=[OWNER_1],
            ))

    def test_create_client_insufficient_owners(self):
        config = MultisigConfig(
            safe_address="0x" + "f" * 40,
            threshold=3,
            owners=[OWNER_1, OWNER_2],
        )
        with pytest.raises(ValueError, match="at least 3 owners"):
            MultisigClient(config)

    def test_create_client_duplicate_owners(self):
        config = MultisigConfig(
            safe_address="0x" + "f" * 40,
            threshold=2,
            owners=[OWNER_1, OWNER_1, OWNER_2],
        )
        with pytest.raises(ValueError, match="unique"):
            MultisigClient(config)

    def test_create_client_no_safe_address(self):
        config = MultisigConfig(
            safe_address="",
            threshold=1,
            owners=[OWNER_1],
        )
        with pytest.raises(ValueError, match="Safe address"):
            MultisigClient(config)


@pytest.mark.asyncio
class TestMultisigClientAsync:
    """Async tests for MultisigClient."""

    def _create_client(self, threshold=2):
        config = MultisigConfig(
            safe_address="0x" + "f" * 40,
            threshold=threshold,
            owners=[OWNER_1, OWNER_2, OWNER_3],
        )
        signers = [object(), object(), object()]
        return MultisigClient(config, signers=signers)

    async def test_propose_payment(self):
        client = self._create_client()
        proposal_id = await client.propose_payment(
            to=RECIPIENT, amount=1000000, token=TOKEN
        )
        assert proposal_id is not None
        assert isinstance(proposal_id, str)
        assert len(proposal_id) > 0

    async def test_propose_payment_validates_recipient(self):
        client = self._create_client()
        with pytest.raises(ValueError, match="zero address"):
            await client.propose_payment(
                to="0x" + "0" * 40, amount=1000000, token=TOKEN
            )

    async def test_propose_payment_validates_amount(self):
        client = self._create_client()
        with pytest.raises(ValueError, match="greater than zero"):
            await client.propose_payment(to=RECIPIENT, amount=0, token=TOKEN)

    async def test_approve_payment(self):
        client = self._create_client()
        proposal_id = await client.propose_payment(
            to=RECIPIENT, amount=1000000, token=TOKEN
        )
        result = await client.approve_payment(proposal_id)
        assert result is True

    async def test_approve_payment_not_found(self):
        client = self._create_client()
        with pytest.raises(KeyError, match="not found"):
            await client.approve_payment("nonexistent-id")

    async def test_execute_payment(self):
        client = self._create_client(threshold=2)
        proposal_id = await client.propose_payment(
            to=RECIPIENT, amount=1000000, token=TOKEN
        )
        # Approve twice to meet threshold
        await client.approve_payment(proposal_id)
        await client.approve_payment(proposal_id)

        tx_hash = await client.execute_payment(proposal_id)
        assert tx_hash is not None
        assert tx_hash.startswith("0x")

    async def test_execute_payment_insufficient_signatures(self):
        client = self._create_client(threshold=2)
        proposal_id = await client.propose_payment(
            to=RECIPIENT, amount=1000000, token=TOKEN
        )
        await client.approve_payment(proposal_id)

        with pytest.raises(RuntimeError, match="Insufficient signatures"):
            await client.execute_payment(proposal_id)

    async def test_execute_payment_already_executed(self):
        client = self._create_client(threshold=1)
        proposal_id = await client.propose_payment(
            to=RECIPIENT, amount=1000000, token=TOKEN
        )
        await client.approve_payment(proposal_id)
        await client.execute_payment(proposal_id)

        with pytest.raises(RuntimeError, match="already executed"):
            await client.execute_payment(proposal_id)

    async def test_get_pending_proposals(self):
        client = self._create_client()
        await client.propose_payment(to=RECIPIENT, amount=1000000, token=TOKEN)
        await client.propose_payment(to=RECIPIENT, amount=2000000, token=TOKEN)

        pending = await client.get_pending_proposals()
        assert len(pending) == 2

    async def test_is_ready(self):
        client = self._create_client(threshold=2)
        proposal_id = await client.propose_payment(
            to=RECIPIENT, amount=1000000, token=TOKEN
        )
        assert client.is_ready(proposal_id) is False

        await client.approve_payment(proposal_id)
        assert client.is_ready(proposal_id) is False

        await client.approve_payment(proposal_id)
        assert client.is_ready(proposal_id) is True
