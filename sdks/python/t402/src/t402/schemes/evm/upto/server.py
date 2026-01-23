"""EVM Up-To Scheme - Server Implementation.

This module provides the server-side implementation of the upto payment scheme
for EVM networks using EIP-2612 Permit.

The server parses user-friendly prices into atomic token amounts and enhances
payment requirements with EIP-712 domain information needed by clients to
sign Permit authorizations.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional, Union

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
SCHEME_UPTO = "upto"


class UptoEvmServerScheme:
    """Server scheme for EVM upto payments using EIP-2612 Permit.

    Handles parsing user-friendly prices and enhancing payment requirements
    with EIP-712 Permit domain information needed for clients to sign
    gasless token approvals.

    The upto scheme allows clients to authorize a maximum amount (maxAmount)
    that the facilitator can settle up to, enabling usage-based billing.

    Example:
        ```python
        scheme = UptoEvmServerScheme()

        # Parse price to get asset amount info
        asset_amount = await scheme.parse_price("$1.00", "eip155:8453")
        # Returns: {"amount": "1000000", "asset": "0x833589...", "extra": {...}}

        # Enhance requirements with EIP-712 domain info
        enhanced = await scheme.enhance_requirements(
            requirements,
            supported_kind,
            facilitator_extensions,
        )
        ```
    """

    scheme = SCHEME_UPTO
    caip_family = "eip155:*"

    def __init__(
        self,
        router_address: Optional[str] = None,
    ):
        """Initialize the server scheme.

        Args:
            router_address: Optional default router/spender contract address.
                If provided, it will be included in enhanced requirements.
        """
        self._router_address = router_address

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to atomic amount and asset.

        For the upto scheme, this returns the maxAmount the client should
        authorize. The actual settled amount may be less.

        Supports:
        - String with $ prefix: "$1.00" -> 1000000 (6 decimals)
        - String without prefix: "1.00" -> 1000000
        - Integer/float: 1.00 -> 1000000
        - Dict (TokenAmount): {"amount": "1000000", "asset": "0x..."}

        Args:
            price: User-friendly price (represents the max amount)
            network: Network identifier (CAIP-2 format, e.g., "eip155:8453")

        Returns:
            AssetAmount dict with amount, asset, and extra metadata
            containing EIP-712 domain info.

        Raises:
            ValueError: If price format is invalid or network is unsupported
        """
        chain_id = self._get_chain_id(network)

        # Handle dict (already in TokenAmount format)
        if isinstance(price, dict):
            return {
                "amount": str(price.get("amount", "0")),
                "asset": price.get("asset", ""),
                "extra": price.get("extra", {}),
            }

        # Get chain ID as string for token lookups
        chain_id_str = str(chain_id)

        # Get default token for the network
        # Try USDT0 first, fall back to USDT, then USDC
        try:
            asset_address = get_default_token_address(chain_id_str, "usdt0")
        except (ValueError, KeyError):
            try:
                asset_address = get_default_token_address(chain_id_str, "usdt")
            except (ValueError, KeyError):
                try:
                    asset_address = get_default_token_address(chain_id_str, "usdc")
                except (ValueError, KeyError):
                    raise ValueError(
                        f"Unknown network: no known token for chain {chain_id_str}"
                    )

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

        # Get EIP-712 domain info for Permit signing
        extra: Dict[str, Any] = {
            "name": get_token_name(chain_id_str, asset_address),
            "version": get_token_version(chain_id_str, asset_address),
            "decimals": decimals,
        }

        # Include router address if configured
        if self._router_address:
            extra["routerAddress"] = self._router_address

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
        """Enhance payment requirements with EVM Permit-specific metadata.

        Adds EIP-712 domain information (token name, version) and optionally
        the router/spender address to the extra field so clients can properly
        sign the EIP-2612 Permit authorization.

        Args:
            requirements: Base payment requirements (with maxAmount/amount set)
            supported_kind: Matched SupportedKind from facilitator's /supported
            facilitator_extensions: Extensions supported by facilitator

        Returns:
            Enhanced requirements with EIP-712 Permit domain info in extra
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
            try:
                req["extra"]["name"] = get_token_name(chain_id, asset)
            except (ValueError, KeyError):
                # If token not found in known tokens, use a sensible default
                req["extra"]["name"] = "TetherToken"

        if "version" not in req["extra"]:
            try:
                req["extra"]["version"] = get_token_version(chain_id, asset)
            except (ValueError, KeyError):
                req["extra"]["version"] = "1"

        # Add router address if configured and not already present
        if self._router_address and "routerAddress" not in req["extra"]:
            req["extra"]["routerAddress"] = self._router_address

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

        Raises:
            ValueError: If the network format is unrecognized
        """
        # Handle CAIP-2 format (eip155:8453)
        if network.startswith("eip155:"):
            return int(network.split(":")[1])

        # Handle legacy format
        try:
            return int(get_chain_id(network))
        except (KeyError, ValueError):
            raise ValueError(f"Unknown network: {network}")
