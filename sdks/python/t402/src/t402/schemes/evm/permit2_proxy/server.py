"""EVM Permit2 Proxy Scheme - Server Implementation.

This module provides the server-side implementation of the Permit2 Proxy payment
scheme for EVM networks.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Union

from t402.types import PaymentRequirementsV2, Network
from t402.schemes.interfaces import AssetAmount, SupportedKindDict
from t402.chains import (
    get_default_token_address,
    get_token_decimals,
)

from t402.schemes.evm.permit2.client import PERMIT2_ADDRESS
from t402.schemes.evm.permit2_proxy.client import (
    SCHEME_PERMIT2_PROXY,
    EXACT_PROXY_ADDRESS,
    UPTO_PROXY_ADDRESS,
)


class Permit2ProxyEvmServerScheme:
    """Server scheme for EVM Permit2 Proxy payments.

    Handles parsing user-friendly prices and enhancing payment requirements
    with Permit2 and proxy contract addresses.

    Example:
        ```python
        scheme = Permit2ProxyEvmServerScheme()

        asset_amount = await scheme.parse_price("$0.10", "eip155:8453")
        enhanced = await scheme.enhance_requirements(
            requirements, supported_kind, extensions,
        )
        ```
    """

    scheme = SCHEME_PERMIT2_PROXY
    caip_family = "eip155:*"

    async def parse_price(
        self,
        price: Union[str, int, float, Dict[str, Any]],
        network: Network,
    ) -> AssetAmount:
        """Parse a user-friendly price to atomic amount and asset."""
        chain_id = self._get_chain_id(network)

        if isinstance(price, dict):
            return {
                "amount": str(price.get("amount", "0")),
                "asset": price.get("asset", ""),
                "extra": price.get("extra", {}),
            }

        chain_id_str = str(chain_id)
        asset_address = get_default_token_address(chain_id_str, "usdc")
        decimals = get_token_decimals(chain_id_str, asset_address)

        if isinstance(price, str):
            if price.startswith("$"):
                price = price[1:]
            amount_decimal = Decimal(price)
        else:
            amount_decimal = Decimal(str(price))

        atomic_amount = int(amount_decimal * Decimal(10**decimals))

        extra = {
            "permit2Address": PERMIT2_ADDRESS,
            "exactProxyAddress": EXACT_PROXY_ADDRESS,
            "uptoProxyAddress": UPTO_PROXY_ADDRESS,
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
        """Enhance payment requirements with Permit2 Proxy-specific metadata.

        Adds Permit2 and proxy contract addresses to the extra field.
        """
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        if "extra" not in req or req["extra"] is None:
            req["extra"] = {}

        req["extra"]["permit2Address"] = PERMIT2_ADDRESS
        req["extra"]["exactProxyAddress"] = EXACT_PROXY_ADDRESS
        req["extra"]["uptoProxyAddress"] = UPTO_PROXY_ADDRESS

        if supported_kind.get("extra"):
            for key, value in supported_kind["extra"].items():
                if key not in req["extra"]:
                    req["extra"][key] = value

        return req

    def _get_chain_id(self, network: str) -> int:
        if network.startswith("eip155:"):
            return int(network.split(":")[1])
        raise ValueError(f"Unknown network: {network}")
