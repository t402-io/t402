"""EVM Exact-Legacy Scheme - Server Implementation.

This module provides the server-side implementation of the exact-legacy payment scheme
for EVM networks using the approve + transferFrom pattern.

.. deprecated:: 2.3.0
    The exact-legacy scheme is deprecated in favor of using USDT0 with the "exact" scheme.
    USDT0 supports EIP-3009 for gasless transfers and is available on 19+ chains via LayerZero.

    **Migration Guide:**
    - Replace: `SCHEME_EXACT_LEGACY` with `SCHEME_EXACT`
    - Replace: legacy USDT tokens with USDT0 tokens
    - See https://docs.t402.io/migration/exact-legacy for full migration guide

    **Why Migrate:**
    1. Gasless transfers: USDT0 supports EIP-3009, eliminating gas costs for users
    2. Cross-chain: USDT0 is available on 19+ chains with LayerZero bridging
    3. Better UX: No separate approve transaction required
    4. Future support: exact-legacy will be removed in v3.0.0

    **Supported Chains for Migration:**
    - Ethereum (1) - USDT0: 0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee
    - Arbitrum (42161) - USDT0: 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9
    - Base (8453) - Use USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    - And 16+ more chains
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Union

from t402.types import (
    PaymentRequirementsV2,
    Network,
)
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.chains import (
    get_chain_id,
    get_token_decimals,
    KNOWN_TOKENS,
)


# Constants
SCHEME_EXACT_LEGACY = "exact-legacy"

# Legacy USDT token addresses by chain ID
LEGACY_USDT_TOKENS = {
    "56": "0x55d398326f99059fF775485246999027B3197955",  # BNB Chain
    "43114": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",  # Avalanche
    "250": "0x049d68029688eabf473097a2fc38ef61633a3c7a",  # Fantom
    "42220": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",  # Celo
    "8217": "0xcee8faf64bb97a73bb51e115aa89c17ffa8dd167",  # Kaia
}


def get_default_legacy_token(chain_id: str) -> str:
    """Get the default legacy USDT token address for a chain.

    Args:
        chain_id: Chain ID as string

    Returns:
        Token address

    Raises:
        ValueError: If chain doesn't have legacy USDT
    """
    if chain_id in LEGACY_USDT_TOKENS:
        return LEGACY_USDT_TOKENS[chain_id]

    # Check KNOWN_TOKENS for usdt entry
    if chain_id in KNOWN_TOKENS:
        for token in KNOWN_TOKENS[chain_id]:
            if token.get("human_name") == "usdt":
                return token["address"]

    raise ValueError(f"No legacy USDT token found for chain {chain_id}")


class ExactLegacyEvmServerScheme:
    """Server scheme for EVM exact-legacy payments.

    Handles parsing user-friendly prices and enhancing payment requirements
    with EIP-712 domain information needed for clients.

    Example:
        ```python
        scheme = ExactLegacyEvmServerScheme()

        # Parse price
        asset_amount = await scheme.parse_price("$0.10", "eip155:56")
        # Returns: {"amount": "100000000000000000", "asset": "0x55d398...", "extra": {...}}

        # Enhance requirements
        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            facilitator_extensions,
        )
        ```
    """

    scheme = SCHEME_EXACT_LEGACY
    caip_family = "eip155:*"

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to atomic amount and asset.

        Supports:
        - String with $ prefix: "$0.10" -> 100000000000000000 (18 decimals for BSC)
        - String without prefix: "0.10" -> 100000000000000000
        - Integer/float: 0.10 -> 100000000000000000
        - Dict (TokenAmount): {"amount": "100000", "asset": "0x..."}

        Args:
            price: User-friendly price
            network: Network identifier (CAIP-2 format)

        Returns:
            AssetAmount dict with amount, asset, and extra metadata
        """
        chain_id = self._get_chain_id(network)

        # Handle dict (already in TokenAmount format)
        if isinstance(price, dict):
            return {
                "amount": str(price.get("amount", "0")),
                "asset": price.get("asset", ""),
                "extra": price.get("extra", {}),
            }

        # Get legacy USDT token for the network
        chain_id_str = str(chain_id)
        asset_address = get_default_legacy_token(chain_id_str)
        decimals = get_token_decimals(chain_id_str, asset_address)

        # Parse price string/number
        if isinstance(price, str):
            if price.startswith("$"):
                price = price[1:]
            amount_decimal = Decimal(price)
        else:
            amount_decimal = Decimal(str(price))

        # Convert to atomic units
        atomic_amount = int(amount_decimal * Decimal(10**decimals))

        # Get EIP-712 domain info
        extra = {
            "name": "T402LegacyTransfer",
            "version": "1",
            "decimals": decimals,
            "tokenType": "legacy",
        }

        return {
            "amount": str(atomic_amount),
            "asset": asset_address,
            "extra": extra,
        }

    async def enhance_requirements(
        self,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        supported_kind: SupportedKindDict,
        facilitator_extensions: List[str],
    ) -> Union[PaymentRequirementsV2, Dict[str, Any]]:
        """Enhance payment requirements with EVM-specific metadata.

        Adds EIP-712 domain information and spender address to the extra field
        so clients can properly sign the authorization.

        Args:
            requirements: Base payment requirements
            supported_kind: Matched SupportedKind from facilitator
            facilitator_extensions: Extensions supported by facilitator

        Returns:
            Enhanced requirements with EIP-712 domain in extra
        """
        # Convert to dict for modification
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        # Ensure extra exists
        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        # Add EIP-712 domain info if not present
        if "name" not in req["extra"]:
            req["extra"]["name"] = "T402LegacyTransfer"
        if "version" not in req["extra"]:
            req["extra"]["version"] = "1"

        # Mark as legacy token type
        req["extra"]["tokenType"] = "legacy"

        # Add facilitator extra data if available (includes spender address)
        if supported_kind.get("extra"):
            for key, value in supported_kind["extra"].items():
                if key not in req["extra"]:
                    req["extra"][key] = value

        return req

    def _get_chain_id(self, network: str) -> int:
        """Get chain ID from network identifier.

        Args:
            network: Network identifier (CAIP-2 or legacy format)

        Returns:
            Chain ID as integer
        """
        # Handle CAIP-2 format (eip155:8453)
        if network.startswith("eip155:"):
            return int(network.split(":")[1])

        # Handle legacy format
        try:
            return int(get_chain_id(network))
        except (KeyError, ValueError):
            raise ValueError(f"Unknown network: {network}")
