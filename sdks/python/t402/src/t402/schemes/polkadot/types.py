"""Polkadot Scheme Types.

This module defines types, payload structures, and validation utilities
for the Polkadot exact-direct payment scheme.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Optional, Protocol, runtime_checkable


# SS58 address regex: base58 characters, typical length 45-50
SS58_REGEX = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{45,50}$")

# Extrinsic/block hash regex: 0x-prefixed 64 hex characters (32 bytes)
HASH_REGEX = re.compile(r"^0x[a-fA-F0-9]{64}$")


@dataclass
class ExactDirectPayload:
    """Payment payload for the exact-direct scheme on Polkadot.

    Contains the on-chain proof of a completed asset transfer.

    Attributes:
        extrinsic_hash: The 0x-prefixed hex hash of the submitted extrinsic
        block_hash: The 0x-prefixed hex hash of the block containing the extrinsic
        extrinsic_index: The index of the extrinsic within the block
        from_address: The SS58-encoded sender address
        to_address: The SS58-encoded recipient address
        amount: The atomic amount transferred (as string)
        asset_id: The on-chain asset ID (e.g., 1984 for USDT)
    """

    extrinsic_hash: str
    block_hash: str
    extrinsic_index: int
    from_address: str
    to_address: str
    amount: str
    asset_id: int

    def to_dict(self) -> Dict[str, Any]:
        """Convert the payload to a dictionary suitable for JSON serialization.

        Returns:
            Dictionary with camelCase keys matching the protocol format
        """
        return {
            "extrinsicHash": self.extrinsic_hash,
            "blockHash": self.block_hash,
            "extrinsicIndex": self.extrinsic_index,
            "from": self.from_address,
            "to": self.to_address,
            "amount": self.amount,
            "assetId": self.asset_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExactDirectPayload":
        """Create an ExactDirectPayload from a dictionary.

        Args:
            data: Dictionary with payload fields (camelCase or snake_case)

        Returns:
            ExactDirectPayload instance

        Raises:
            KeyError: If required fields are missing
            TypeError: If field types are incorrect
        """
        extrinsic_index = data.get("extrinsicIndex", data.get("extrinsic_index", 0))
        if isinstance(extrinsic_index, float):
            extrinsic_index = int(extrinsic_index)

        asset_id = data.get("assetId", data.get("asset_id", 0))
        if isinstance(asset_id, float):
            asset_id = int(asset_id)

        return cls(
            extrinsic_hash=data.get("extrinsicHash", data.get("extrinsic_hash", "")),
            block_hash=data.get("blockHash", data.get("block_hash", "")),
            extrinsic_index=extrinsic_index,
            from_address=data.get("from", data.get("from_address", "")),
            to_address=data.get("to", data.get("to_address", "")),
            amount=str(data.get("amount", "")),
            asset_id=asset_id,
        )


@dataclass
class ExtrinsicResult:
    """Result of querying an extrinsic from the chain.

    Represents the on-chain data for a submitted extrinsic,
    including its parameters and success status.

    Attributes:
        extrinsic_hash: The 0x-prefixed hash of the extrinsic
        block_hash: The 0x-prefixed hash of the containing block
        block_number: The block number
        extrinsic_index: Index within the block
        success: Whether the extrinsic executed successfully
        signer: The SS58-encoded address of the extrinsic signer
        module: The pallet/module name (e.g., "Assets")
        call: The call function name (e.g., "transfer_keep_alive")
        params: List of call parameters
    """

    extrinsic_hash: str
    block_hash: str
    block_number: int
    extrinsic_index: int
    success: bool
    signer: str
    module: str
    call: str
    params: list


@dataclass
class ParsedAssetTransfer:
    """Parsed asset transfer details extracted from an extrinsic.

    Attributes:
        asset_id: The on-chain asset ID
        from_address: Sender SS58 address
        to_address: Recipient SS58 address
        amount: Transfer amount in atomic units (as string)
        success: Whether the transfer succeeded
    """

    asset_id: int
    from_address: str
    to_address: str
    amount: str
    success: bool


@runtime_checkable
class ClientPolkadotSigner(Protocol):
    """Protocol for signing and submitting Polkadot extrinsics.

    Implementations should provide the signer's address and the ability
    to build, sign, and submit asset transfer extrinsics to the chain.

    Example:
        ```python
        class MyPolkadotSigner:
            def address(self) -> str:
                return "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"

            async def sign_and_submit(self, call: Dict, network: str) -> Dict:
                # Build assets.transfer_keep_alive extrinsic
                # Sign with keypair
                # Submit to chain
                return {
                    "extrinsicHash": "0x...",
                    "blockHash": "0x...",
                    "extrinsicIndex": 2,
                }
        ```
    """

    def address(self) -> str:
        """Return the SS58-encoded address of the signer.

        Returns:
            SS58-encoded address string
        """
        ...

    async def sign_and_submit(self, call: Dict[str, Any], network: str) -> Dict[str, Any]:
        """Sign and submit an asset transfer extrinsic.

        The call dictionary contains:
        - assetId: int - The on-chain asset ID
        - target: str - The SS58-encoded recipient address
        - amount: str - The atomic amount to transfer

        Args:
            call: Dictionary describing the assets.transfer_keep_alive call
            network: CAIP-2 network identifier

        Returns:
            Dictionary with:
            - extrinsicHash: str - 0x-prefixed hash of the extrinsic
            - blockHash: str - 0x-prefixed hash of the block
            - extrinsicIndex: int - Index within the block

        Raises:
            Exception: If signing or submission fails
        """
        ...


@runtime_checkable
class FacilitatorPolkadotSigner(Protocol):
    """Protocol for facilitator-side Polkadot operations.

    Implementations should provide the ability to query extrinsics
    from the chain (via indexer or RPC).

    Example:
        ```python
        class MyPolkadotFacilitator:
            async def get_extrinsic(self, extrinsic_hash: str, network: str) -> Dict:
                # Query Subscan or RPC for extrinsic details
                return {
                    "extrinsic_hash": "0x...",
                    "block_hash": "0x...",
                    "block_num": 12345,
                    "extrinsic_index": 2,
                    "success": True,
                    "account_id": "5Grw...",
                    "call_module": "Assets",
                    "call_module_function": "transfer_keep_alive",
                    "params": [...],
                }
        ```
    """

    async def get_extrinsic(self, extrinsic_hash: str, network: str) -> Dict[str, Any]:
        """Query an extrinsic by its hash.

        Args:
            extrinsic_hash: The 0x-prefixed hex hash of the extrinsic
            network: CAIP-2 network identifier

        Returns:
            Dictionary with extrinsic details including:
            - extrinsic_hash: str
            - block_hash: str
            - block_num: int
            - extrinsic_index: int
            - success: bool
            - account_id: str (signer address)
            - call_module: str (e.g., "Assets")
            - call_module_function: str (e.g., "transfer_keep_alive")
            - params: list of parameter dicts

        Raises:
            Exception: If the extrinsic cannot be found or query fails
        """
        ...


def is_valid_ss58_address(address: str) -> bool:
    """Check if a string is a valid SS58-encoded Polkadot address.

    Performs a basic format check using regex. Does not verify the checksum.

    Args:
        address: String to validate

    Returns:
        True if the address matches the SS58 format
    """
    if not address:
        return False
    return bool(SS58_REGEX.match(address))


def is_valid_hash(hash_str: str) -> bool:
    """Check if a string is a valid 0x-prefixed 32-byte hex hash.

    Args:
        hash_str: String to validate

    Returns:
        True if the hash matches the expected format
    """
    if not hash_str:
        return False
    return bool(HASH_REGEX.match(hash_str))


def parse_asset_identifier(asset: str) -> Optional[int]:
    """Parse a CAIP-19 asset identifier to extract the asset ID.

    Format: "{network}/asset:{id}"
    Example: "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984" -> 1984

    Args:
        asset: CAIP-19 asset identifier string

    Returns:
        The asset ID as an integer, or None if parsing fails
    """
    prefix = "/asset:"
    idx = asset.find(prefix)
    if idx == -1:
        return None
    try:
        return int(asset[idx + len(prefix):])
    except (ValueError, IndexError):
        return None


def create_asset_identifier(network: str, asset_id: int) -> str:
    """Create a CAIP-19 asset identifier for a Polkadot asset.

    Format: "{network}/asset:{id}"

    Args:
        network: CAIP-2 network identifier
        asset_id: On-chain asset ID

    Returns:
        CAIP-19 asset identifier string
    """
    return f"{network}/asset:{asset_id}"


def extract_asset_transfer(result: ExtrinsicResult) -> Optional[ParsedAssetTransfer]:
    """Extract asset transfer details from an extrinsic result.

    Validates that the extrinsic is a successful assets.transfer or
    assets.transfer_keep_alive call, and extracts the transfer parameters.

    Args:
        result: ExtrinsicResult from chain query

    Returns:
        ParsedAssetTransfer if the extrinsic is a valid asset transfer,
        None otherwise
    """
    if not result.success:
        return None

    # Check for assets module (case-insensitive)
    module_lower = result.module.lower()
    if module_lower != "assets":
        return None

    # Check for transfer call
    call_lower = result.call.lower()
    if call_lower not in ("transfer", "transfer_keep_alive"):
        return None

    asset_id: Optional[int] = None
    to_address: Optional[str] = None
    amount: Optional[str] = None

    # Extract parameters
    for param in result.params:
        if not isinstance(param, dict):
            continue

        param_name = param.get("name", "")
        param_value = param.get("value")

        if param_name in ("id", "asset_id"):
            if isinstance(param_value, (int, float)):
                asset_id = int(param_value)
            elif isinstance(param_value, str):
                try:
                    asset_id = int(param_value)
                except ValueError:
                    pass
        elif param_name in ("target", "dest"):
            if isinstance(param_value, str):
                to_address = param_value
            elif isinstance(param_value, dict):
                # Handle MultiAddress enum format {"Id": "address"}
                to_address = param_value.get("Id", param_value.get("id", ""))
        elif param_name == "amount":
            if isinstance(param_value, str):
                amount = param_value
            elif isinstance(param_value, (int, float)):
                amount = str(int(param_value))

    if asset_id is None or not to_address or not amount:
        return None

    return ParsedAssetTransfer(
        asset_id=asset_id,
        from_address=result.signer,
        to_address=to_address,
        amount=amount,
        success=True,
    )
