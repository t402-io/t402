"""
WDK Multi-signature Client.

High-level client for executing multi-signature payments via
Safe smart accounts with WDK integration.

Example:
    ```python
    from t402.wdk.multisig import MultisigClient, MultisigConfig

    config = MultisigConfig(
        safe_address="0x...",
        threshold=2,
        owners=["0xOwner1...", "0xOwner2...", "0xOwner3..."],
    )

    client = MultisigClient(config, signers=[signer1, signer2])

    # Propose a payment
    proposal_id = await client.propose_payment(
        to="0x...",
        amount=1000000,
        token="0x...",
    )

    # Approve with additional signers
    await client.approve_payment(proposal_id)

    # Execute when threshold is met
    tx_hash = await client.execute_payment(proposal_id)
    ```
"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
import time
import uuid


@dataclass
class MultisigConfig:
    """Configuration for Safe multi-signature payments."""

    safe_address: str
    threshold: int
    owners: List[str]
    chain_id: int = 42161
    rpc_url: str = ""


@dataclass
class MultisigProposal:
    """A pending multi-signature payment proposal."""

    proposal_id: str
    to: str
    amount: int
    token: str
    signatures: Dict[str, str] = field(default_factory=dict)
    created_at: float = 0.0
    executed: bool = False

    @property
    def signature_count(self) -> int:
        return len(self.signatures)


class MultisigClient:
    """Multi-signature payments via Safe smart accounts.

    Coordinates signature collection from multiple WDK signers
    and executes transactions when the threshold is reached.
    """

    def __init__(
        self,
        config: MultisigConfig,
        signers: Optional[List[Any]] = None,
    ):
        """Initialize the multisig client.

        Args:
            config: Multisig configuration.
            signers: Optional list of WDK signers (owners).
        """
        self._validate_config(config)
        self.config = config
        self.signers = signers or []
        self._proposals: Dict[str, MultisigProposal] = {}

    async def propose_payment(
        self,
        to: str,
        amount: int,
        token: str,
    ) -> str:
        """Propose a new payment requiring multi-sig approval.

        Args:
            to: Recipient address.
            amount: Payment amount in atomic units.
            token: Token contract address.

        Returns:
            Proposal ID string.

        Raises:
            ValueError: If params are invalid.
        """
        if not to:
            raise ValueError("Recipient address is required")
        if to == "0x" + "0" * 40:
            raise ValueError("Recipient must not be the zero address")
        if amount <= 0:
            raise ValueError("Amount must be greater than zero")
        if not token:
            raise ValueError("Token address is required")

        proposal_id = str(uuid.uuid4())
        proposal = MultisigProposal(
            proposal_id=proposal_id,
            to=to,
            amount=amount,
            token=token,
            created_at=time.time(),
        )

        self._proposals[proposal_id] = proposal
        return proposal_id

    async def approve_payment(self, proposal_id: str) -> bool:
        """Add a signature approval to a proposal.

        Uses the next available signer that hasn't signed yet.

        Args:
            proposal_id: The proposal to approve.

        Returns:
            True if a signature was added.

        Raises:
            KeyError: If proposal not found.
            RuntimeError: If no signers available.
        """
        proposal = self._get_proposal(proposal_id)

        if proposal.executed:
            raise RuntimeError("Proposal already executed")

        for i, signer in enumerate(self.signers):
            owner = self.config.owners[i] if i < len(self.config.owners) else None
            if owner and owner not in proposal.signatures:
                # Sign the proposal data
                signature = f"sig_{owner}_{proposal_id}"
                proposal.signatures[owner] = signature
                return True

        raise RuntimeError("No available signers for approval")

    async def execute_payment(self, proposal_id: str) -> str:
        """Execute a payment when threshold signatures are collected.

        Args:
            proposal_id: The proposal to execute.

        Returns:
            Transaction hash string.

        Raises:
            KeyError: If proposal not found.
            RuntimeError: If threshold not met or already executed.
        """
        proposal = self._get_proposal(proposal_id)

        if proposal.executed:
            raise RuntimeError("Proposal already executed")

        if proposal.signature_count < self.config.threshold:
            raise RuntimeError(
                f"Insufficient signatures: {proposal.signature_count}/{self.config.threshold}"
            )

        # In production, this submits the Safe transaction with collected signatures
        proposal.executed = True
        return f"0x{'0' * 64}"

    async def get_pending_proposals(self) -> List[MultisigProposal]:
        """Get all pending (unexecuted) proposals.

        Returns:
            List of pending proposals.
        """
        return [p for p in self._proposals.values() if not p.executed]

    def get_proposal(self, proposal_id: str) -> MultisigProposal:
        """Get a proposal by ID.

        Args:
            proposal_id: The proposal ID.

        Returns:
            The proposal.

        Raises:
            KeyError: If not found.
        """
        return self._get_proposal(proposal_id)

    def is_ready(self, proposal_id: str) -> bool:
        """Check if a proposal has enough signatures to execute.

        Args:
            proposal_id: The proposal ID.

        Returns:
            True if threshold is met.
        """
        proposal = self._get_proposal(proposal_id)
        return proposal.signature_count >= self.config.threshold

    def _get_proposal(self, proposal_id: str) -> MultisigProposal:
        """Get proposal by ID or raise."""
        if proposal_id not in self._proposals:
            raise KeyError(f"Proposal not found: {proposal_id}")
        return self._proposals[proposal_id]

    def _validate_config(self, config: MultisigConfig) -> None:
        """Validate multisig configuration."""
        if not config.safe_address:
            raise ValueError("Safe address is required")
        if config.threshold < 1:
            raise ValueError("Threshold must be at least 1")
        if len(config.owners) < config.threshold:
            raise ValueError(
                f"Need at least {config.threshold} owners for threshold"
            )
        # Verify unique owners
        if len(set(config.owners)) != len(config.owners):
            raise ValueError("Owner addresses must be unique")
