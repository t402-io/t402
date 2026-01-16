"""EVM Exact Scheme - Server Implementation.

This module provides the server-side implementation of the exact payment scheme
for EVM networks.
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
    get_token_name,
    get_token_version,
    get_default_token_address,
)


# Constants
SCHEME_EXACT = "exact"


class ExactEvmServerScheme:
    """Server scheme for EVM exact payments.

    Handles parsing user-friendly prices and enhancing payment requirements
    with EIP-712 domain information needed for clients.

    Example:
        ```python
        scheme = ExactEvmServerScheme()

        # Parse price
        asset_amount = await scheme.parse_price("$0.10", "eip155:8453")
        # Returns: {"amount": "100000", "asset": "0x833589...", "extra": {...}}

        # Enhance requirements
        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            facilitator_extensions,
        )
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "eip155:*"

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to atomic amount and asset.

        Supports:
        - String with $ prefix: "$0.10" -> 100000 (6 decimals)
        - String without prefix: "0.10" -> 100000
        - Integer/float: 0.10 -> 100000
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

        # Get default token (USDC) for the network
        chain_id_str = str(chain_id)
        asset_address = get_default_token_address(chain_id_str, "usdc")
        decimals = get_token_decimals(chain_id_str, asset_address)

        # Parse price string/number
        if isinstance(price, str):
            if price.startswith("$"):
                price = price[1:]
            amount_decimal = Decimal(price)
        else:
            amount_decimal = Decimal(str(price))

        # Convert to atomic units
        atomic_amount = int(amount_decimal * Decimal(10 ** decimals))

        # Get EIP-712 domain info
        extra = {
            "name": get_token_name(chain_id_str, asset_address),
            "version": get_token_version(chain_id_str, asset_address),
            "decimals": decimals,
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

        Adds EIP-712 domain information to the extra field so clients
        can properly sign the authorization.

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

        network = req.get("network", "")
        asset = req.get("asset", "")

        # Get chain ID as string
        chain_id = str(self._get_chain_id(network))

        # Ensure extra exists
        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        # Add EIP-712 domain info if not present
        if "name" not in req["extra"]:
            req["extra"]["name"] = get_token_name(chain_id, asset)
        if "version" not in req["extra"]:
            req["extra"]["version"] = get_token_version(chain_id, asset)

        # Add facilitator extra data if available
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
            return get_chain_id(network)
        except (KeyError, ValueError):
            raise ValueError(f"Unknown network: {network}")
